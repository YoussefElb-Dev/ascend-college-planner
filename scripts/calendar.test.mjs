import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCalendar,
  mergeCalendar,
  calendarFile,
  expandPersonalEvents,
  monthDates,
  changeMonth,
  wallTimeToDate,
} from "../dist/calendar-model.js";
import { blankState, validateState, calendarEvents } from "../dist/core.js";
const wrap = (s) =>
  `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${s.trim().replaceAll("\n", "\r\n")}\r\nEND:VCALENDAR\r\n`;
const event = (s) => `BEGIN:VEVENT\n${s}\nEND:VEVENT`;
const fixture = () =>
  wrap(
    event(
      "UID:volleyball@example.test\nDTSTAMP:20261001T120000Z\nSEQUENCE:2\nSUMMARY:Volleyball\\, varsity\nDTSTART;TZID=America/New_York:20261023T173000\nDTEND;TZID=America/New_York:20261023T190000\nRRULE:FREQ=WEEKLY;COUNT=5\nEXDATE;TZID=America/New_York:20261030T173000\nLOCATION:School gym\nDESCRIPTION:Bring water\\nArrive early",
    ),
  );
const ids = () => {
  let i = 0;
  return () => `test${++i}`;
};
test("month navigation includes all six possible weeks and clamps month ends", () => {
  assert.equal(monthDates("2026-10-23").length, 42);
  assert.equal(monthDates("2026-10-23")[0], "2026-09-28");
  assert.equal(changeMonth("2028-01-31", 1), "2028-02-29");
});
test("calendar imports are idempotent, update by UID and preserve local IDs", () => {
  const incoming = parseCalendar(fixture()).records;
  const first = mergeCalendar([], incoming, ids());
  assert.equal(first.added, 1);
  const again = mergeCalendar(first.records, incoming, ids());
  assert.equal(again.unchanged, 1);
  assert.equal(again.records.length, 1);
  const update = parseCalendar(
    fixture()
      .replace("SEQUENCE:2", "SEQUENCE:3")
      .replace("School gym", "Away gym"),
  ).records;
  const changed = mergeCalendar(first.records, update, ids());
  assert.equal(changed.updated, 1);
  assert.equal(changed.records[0].id, first.records[0].id);
  assert.equal(changed.records[0].location, "Away gym");
  assert.equal(mergeCalendar(changed.records, incoming, ids()).older, 1);
});
test("recurrence excludes EXDATE and retains rules through export/reimport", () => {
  const records = mergeCalendar(
    [],
    parseCalendar(fixture()).records,
    ids(),
  ).records;
  const a = expandPersonalEvents(records, "2026-10-01", "2026-12-01");
  assert.deepEqual(
    a.events.map((e) => e.date),
    ["2026-10-23", "2026-11-06", "2026-11-13", "2026-11-20"],
  );
  assert.deepEqual(a.warnings, []);
  const text = calendarFile(records);
  assert.match(text, /EXDATE;TZID=America\/New_York:20261030T173000/);
  assert.equal(
    parseCalendar(text).records[0].notes,
    "Bring water\nArrive early",
  );
  assert.equal(
    parseCalendar(text).records[0].sourceUid,
    "volleyball@example.test",
  );
});
test("moved recurring exceptions replace one occurrence and cancellation hides one occurrence", () => {
  const text = fixture().replace(
    "END:VCALENDAR",
    event(
      "UID:volleyball@example.test\nRECURRENCE-ID;TZID=America/New_York:20261106T173000\nDTSTART;TZID=America/New_York:20261107T150000\nDTEND;TZID=America/New_York:20261107T163000\nSUMMARY:Rescheduled game",
    ) +
      "\n" +
      event(
        "UID:volleyball@example.test\nRECURRENCE-ID;TZID=America/New_York:20261113T173000\nDTSTART;TZID=America/New_York:20261113T173000\nSTATUS:CANCELLED",
      ) +
      "\nEND:VCALENDAR",
  );
  const records = mergeCalendar([], parseCalendar(text).records, ids()).records;
  const a = expandPersonalEvents(records, "2026-10-01", "2026-12-01");
  assert.deepEqual(
    a.events.map((e) => e.date),
    ["2026-10-23", "2026-11-07", "2026-11-20"],
  );
  assert.deepEqual(a.warnings, []);
});
test("all-day multi-day events preserve exclusive ICS ends and Unicode text", () => {
  const r = {
    id: "trip",
    title: "Campus trip — 你好, research;",
    date: "2026-10-23",
    endDate: "2026-10-25",
    allDay: true,
    repeat: "None",
    notes: "First line\nSecond line",
  };
  const text = calendarFile([r]);
  assert.match(text, /DTEND;VALUE=DATE:20261026/);
  const parsed = parseCalendar(text).records[0];
  assert.equal(parsed.endDate, "2026-10-25");
  assert.equal(parsed.title, r.title);
  assert.equal(parsed.notes, r.notes);
  assert.equal(
    expandPersonalEvents(
      [{ ...parsed, id: "trip" }],
      "2026-10-24",
      "2026-10-24",
    ).events.length,
    1,
  );
});
test("cancellation without a start updates an existing event and exports as canceled", () => {
  const records = mergeCalendar(
    [],
    parseCalendar(fixture()).records,
    ids(),
  ).records;
  const canceled = parseCalendar(
    wrap(event("UID:volleyball@example.test\nSEQUENCE:3\nSTATUS:CANCELLED")),
  ).records;
  const result = mergeCalendar(records, canceled, ids());
  assert.equal(result.updated, 1);
  assert.equal(result.records[0].title, records[0].title);
  assert.equal(result.records[0].notes, records[0].notes);
  assert.equal(result.records[0].repeat, records[0].repeat);
  assert.equal(mergeCalendar(result.records, canceled, ids()).unchanged, 1);
  assert.equal(result.records[0].date, "2026-10-23");
  assert.equal(
    expandPersonalEvents(result.records, "2026-10-01", "2026-12-01").events
      .length,
    0,
  );
  assert.match(calendarFile(result.records), /STATUS:CANCELLED/);
});
test("IANA time conversion respects daylight saving time", () => {
  assert.equal(
    wallTimeToDate("2026-10-23", "17:30", "America/New_York").toISOString(),
    "2026-10-23T21:30:00.000Z",
  );
  assert.equal(
    wallTimeToDate("2026-11-13", "17:30", "America/New_York").toISOString(),
    "2026-11-13T22:30:00.000Z",
  );
});
test("imports normalize end times expressed in a different time zone", () => {
  const parsed = parseCalendar(
    wrap(
      event(
        "UID:zone-test\nSUMMARY:Evening game\nDTSTART;TZID=America/New_York:20261023T173000\nDTEND:20261023T230000Z",
      ),
    ),
  ).records;
  assert.equal(parsed[0].endTime, "19:00");
  const text = calendarFile([{ ...parsed[0], id: "mixed" }]);
  assert.match(text, /DTEND;TZID=America\/New_York:20261023T190000/);
});
test("old workspaces migrate and calendar records survive backup validation", () => {
  const s = blankState();
  delete s.events;
  delete s.dayNotes;
  assert.deepEqual(validateState(s).events, []);
  s.events = mergeCalendar([], parseCalendar(fixture()).records, ids()).records;
  s.dayNotes = [{ id: "note", date: "2026-10-23", body: "Game day." }];
  assert.deepEqual(validateState(s).events, s.events);
  assert.equal(
    calendarEvents(validateState(s), {
      start: "2026-10-23",
      end: "2026-10-23",
    }).filter((e) => e.personal).length,
    1,
  );
  s.events[0].date = "2026-02-30";
  assert.throws(() => validateState(s));
});
test("invalid, oversized and non-calendar files are rejected without changing records", () => {
  assert.throws(() => parseCalendar("not a calendar"));
  assert.throws(() => parseCalendar("x".repeat(2 * 1024 * 1024 + 1)));
  assert.throws(() =>
    parseCalendar(wrap(event("UID:x\nSUMMARY:Missing date"))),
  );
});
test("duration-based events gain an editable end and malformed negative ranges are skipped", () => {
  const text = wrap(
    event(
      "UID:duration\nSUMMARY:Practice\nDTSTART:20261023T170000\nDURATION:PT90M",
    ),
  );
  const records = mergeCalendar([], parseCalendar(text).records, ids()).records;
  assert.equal(records[0].endTime, "18:30");
  assert.equal(
    expandPersonalEvents(records, "2026-10-23", "2026-10-23").events[0].endTime,
    "18:30",
  );
  records[0].endTime = "19:00";
  assert.equal(
    parseCalendar(calendarFile(records)).records[0].endTime,
    "19:00",
  );
  assert.throws(() =>
    parseCalendar(
      wrap(
        event(
          "UID:bad\nDTSTART;VALUE=DATE:20261023\nDTEND;VALUE=DATE:20261020",
        ),
      ),
    ),
  );
});
