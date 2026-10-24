import ICAL from "./vendor/ical.js";

const dateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const clockKey = (d) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
export const shiftDate = (date, n) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return dateKey(d);
};
export const validDate = (s) =>
  typeof s === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(new Date(s + "T12:00:00").getTime()) &&
  dateKey(new Date(s + "T12:00:00")) === s;
export const validTime = (s) =>
  typeof s === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s);
export function monthDates(date) {
  const d = new Date(date + "T12:00:00");
  d.setDate(1);
  const first = dateKey(d);
  const start = shiftDate(first, -((d.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => shiftDate(start, i));
}
export function weekDates(date) {
  const d = new Date(date + "T12:00:00");
  const start = shiftDate(date, -((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => shiftDate(start, i));
}
export function changeMonth(date, offset) {
  const d = new Date(date + "T12:00:00"),
    day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  d.setDate(
    Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()),
  );
  return dateKey(d);
}
function hash(s) {
  let n = 2166136261;
  for (const c of s) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return (n >>> 0).toString(36);
}
function localZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "floating";
}
function timeFields(prop) {
  if (!prop) return null;
  const t = prop.getFirstValue();
  if (!t?.year) return null;
  return {
    date: `${String(t.year).padStart(4, "0")}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`,
    time: t.isDate
      ? ""
      : `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`,
    allDay: t.isDate,
    zone:
      prop.getParameter("tzid") ||
      (t.zone?.tzid === "UTC" ? "UTC" : "floating"),
  };
}
function registerZones(definitions) {
  for (const text of definitions || []) {
    try {
      const c = new ICAL.Component(ICAL.parse(text));
      ICAL.TimezoneService.register(
        c.getFirstPropertyValue("tzid"),
        new ICAL.Timezone({ component: c }),
      );
    } catch {
      /* Invalid definitions are reported at import. */
    }
  }
}

export function parseCalendar(text, sourceName = "Calendar") {
  if (
    typeof text !== "string" ||
    new TextEncoder().encode(text).length > 2 * 1024 * 1024
  )
    throw Error("Choose an iCalendar (.ics) file smaller than 2 MB.");
  let root;
  try {
    root = new ICAL.Component(ICAL.parse(text.replace(/^\uFEFF/, "")));
  } catch {
    throw Error("This file could not be read as an iCalendar (.ics) calendar.");
  }
  if (root.name !== "vcalendar")
    throw Error("Choose a VCALENDAR file exported by your calendar app.");
  const components = root.getAllSubcomponents("vevent");
  if (components.length > 2000)
    throw Error(
      "This calendar contains more than 2,000 events. Export a smaller date range.",
    );
  const zones = root.getAllSubcomponents("vtimezone").map((c) => c.toString());
  registerZones(zones);
  const records = [],
    warnings = [];
  let skipped = 0;
  for (const comp of components) {
    try {
      let start = timeFields(comp.getFirstProperty("dtstart"));
      let end = timeFields(comp.getFirstProperty("dtend"));
      const status = String(
        comp.getFirstPropertyValue("status") || "CONFIRMED",
      ).toUpperCase();
      if (!start && status === "CANCELLED")
        start = timeFields(comp.getFirstProperty("recurrence-id"));
      const sourceUid = String(
        comp.getFirstPropertyValue("uid") ||
          `import-${hash(comp.toString())}@ascend.local`,
      ).slice(0, 500);
      if (!start && status !== "CANCELLED") {
        skipped++;
        continue;
      }
      if (start && !validDate(start.date)) {
        skipped++;
        continue;
      }
      const recurrenceId = String(
        comp.getFirstPropertyValue("recurrence-id") || "",
      );
      const rrule = comp.getFirstPropertyValue("rrule");
      if (rrule && ["SECONDLY", "MINUTELY", "HOURLY"].includes(rrule.freq))
        warnings.push(
          "Sub-daily repeat rules are retained for export but shown as a single occurrence.",
        );
      if (!end && start && comp.hasProperty("duration")) {
        const t = new ICAL.Event(comp).endDate;
        end = {
          date: t.toString().slice(0, 10),
          time: t.isDate ? "" : t.toString().slice(11, 16),
          allDay: t.isDate,
          zone: start.zone,
        };
      }
      if (
        start &&
        end &&
        !start.allDay &&
        !end.allDay &&
        start.zone !== end.zone
      ) {
        const endProp = comp.getFirstProperty("dtend");
        const instant = ICAL.TimezoneService.has(end.zone)
          ? endProp.getFirstValue().toJSDate()
          : wallTimeToDate(end.date, end.time, end.zone);
        if (
          !["UTC", "floating"].includes(start.zone) &&
          ICAL.TimezoneService.has(start.zone)
        ) {
          const converted = ICAL.Time.fromJSDate(instant, true).convertToZone(
            ICAL.TimezoneService.get(start.zone),
          );
          end = {
            ...end,
            date: converted.toString().slice(0, 10),
            time: converted.toString().slice(11, 16),
            zone: start.zone,
          };
        } else {
          const parts = Object.fromEntries(
            new Intl.DateTimeFormat("en-US", {
              ...(start.zone === "floating" ? {} : { timeZone: start.zone }),
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hourCycle: "h23",
            })
              .formatToParts(instant)
              .map((p) => [p.type, p.value]),
          );
          end = {
            ...end,
            date: `${parts.year}-${parts.month}-${parts.day}`,
            time: `${parts.hour}:${parts.minute}`,
            zone: start.zone,
          };
        }
      }
      const changed =
        comp.getFirstPropertyValue("last-modified") ||
        comp.getFirstPropertyValue("dtstamp");
      let endDate = end?.date || start?.date || "",
        endTime = end?.time || start?.time || "";
      if (start?.allDay && end) endDate = shiftDate(endDate, -1);
      if (
        start &&
        (!validDate(endDate) ||
          endDate < start.date ||
          (!start.allDay &&
            (!validTime(start.time) ||
              !validTime(endTime) ||
              (start.date === endDate && endTime < start.time))))
      ) {
        skipped++;
        continue;
      }
      const defs = zones.filter(
        (z) => !start || z.includes(`TZID:${start.zone}`),
      );
      const knownZone = start?.zone || "floating";
      if (
        !["floating", "UTC"].includes(knownZone) &&
        !ICAL.TimezoneService.has(knownZone)
      ) {
        try {
          new Intl.DateTimeFormat("en", { timeZone: knownZone });
        } catch {
          warnings.push(
            `Time zone “${knownZone}” is unavailable; its original wall time is shown.`,
          );
        }
      }
      const categories = comp.getFirstPropertyValue("categories");
      records.push({
        title: String(
          comp.getFirstPropertyValue("summary") || "Untitled event",
        ).slice(0, 180),
        date: start?.date || "",
        endDate,
        time: start?.time || "",
        endTime,
        allDay: start?.allDay ?? true,
        timezone: knownZone,
        category: String(
          Array.isArray(categories) ? categories[0] : categories || "Imported",
        ).slice(0, 80),
        location: String(comp.getFirstPropertyValue("location") || "").slice(
          0,
          1000,
        ),
        notes: String(comp.getFirstPropertyValue("description") || "").slice(
          0,
          15000,
        ),
        status: status === "CANCELLED" ? "Canceled" : "Planned",
        repeat: rrule || comp.hasProperty("rdate") ? "Imported" : "None",
        sourceUid,
        recurrenceId,
        sequence: Number(comp.getFirstPropertyValue("sequence")) || 0,
        sourceModified: changed?.toJSDate?.().getTime() || 0,
        calendarSource: sourceName.slice(0, 180),
        ical: comp.toString(),
        timezoneDefinitions: defs,
      });
    } catch {
      skipped++;
    }
  }
  if (!records.length)
    throw Error("No supported events were found in this calendar.");
  if (root.getAllSubcomponents("vtodo").length)
    warnings.push(
      "Calendar task components (VTODO) were not imported; this importer reads events (VEVENT).",
    );
  return { records, warnings: [...new Set(warnings)], skipped };
}

const identity = (r) =>
  `${r.sourceUid || `${r.id}@ascend.local`}|${r.recurrenceId || ""}`;
const comparable = (r) =>
  JSON.stringify([
    r.title,
    r.date,
    r.endDate,
    r.time,
    r.endTime,
    r.allDay,
    r.timezone,
    r.location,
    r.notes,
    r.status,
    r.ical,
  ]);
export function mergeCalendar(existing, incoming, makeId) {
  const records = structuredClone(existing),
    lookup = new Map(records.map((r, i) => [identity(r), i]));
  let added = 0,
    updated = 0,
    unchanged = 0,
    older = 0;
  for (const next of incoming) {
    const key = identity(next),
      i = lookup.get(key),
      old = i === undefined ? null : records[i];
    if (old) {
      if (
        next.sequence < (old.sequence || 0) ||
        (next.sequence === (old.sequence || 0) &&
          next.sourceModified &&
          old.sourceModified &&
          next.sourceModified < old.sourceModified)
      ) {
        older++;
        continue;
      }
      if (comparable(old) === comparable(next)) {
        unchanged++;
        continue;
      }
      const merged = {
        ...old,
        ...next,
        id: old.id,
        created: old.created,
        updated: Date.now(),
        archived: old.archived || false,
      };
      if (next.status === "Canceled" && next.ical) {
        const cancellation = new ICAL.Component(ICAL.parse(next.ical));
        for (const [property, field] of [
          ["summary", "title"],
          ["description", "notes"],
          ["location", "location"],
          ["categories", "category"],
        ]) {
          if (!cancellation.hasProperty(property)) merged[field] = old[field];
        }
        if (!cancellation.hasProperty("rrule") && !next.recurrenceId) {
          merged.repeat = old.repeat;
          if (old.ical) merged.ical = old.ical;
        }
        if (!cancellation.hasProperty("dtstart"))
          merged.timezoneDefinitions = old.timezoneDefinitions || [];
      }
      if (!next.date) {
        if (next.status !== "Canceled") {
          unchanged++;
          continue;
        }
        Object.assign(merged, {
          date: old.date,
          endDate: old.endDate,
          time: old.time,
          endTime: old.endTime,
          allDay: old.allDay,
          timezone: old.timezone,
        });
      }
      if (
        comparable(old) === comparable(merged) &&
        (old.sequence || 0) === (next.sequence || 0)
      ) {
        unchanged++;
        continue;
      }
      records[i] = merged;
      updated++;
    } else if (next.date) {
      records.push({
        ...next,
        id: makeId(),
        created: Date.now(),
        updated: Date.now(),
      });
      lookup.set(key, records.length - 1);
      added++;
    } else unchanged++;
  }
  return { records, added, updated, unchanged, older };
}

export function wallTimeToDate(date, time, zone) {
  if (zone === "UTC") return new Date(date + "T" + time + ":00Z");
  if (!zone || zone === "floating") return new Date(date + "T" + time + ":00");
  const [y, m, d] = date.split("-").map(Number),
    [h, min] = time.split(":").map(Number),
    guess = Date.UTC(y, m - 1, d, h, min);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let stamp = guess;
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date(stamp)).map((p) => [p.type, p.value]),
    );
    const asUTC = Date.UTC(
      +parts.year,
      +parts.month - 1,
      +parts.day,
      +parts.hour,
      +parts.minute,
      +parts.second,
    );
    const correction = guess - asUTC;
    if (!correction) break;
    stamp += correction;
  }
  return new Date(stamp);
}
function setTime(comp, name, date, time, allDay, zone) {
  comp.removeAllProperties(name);
  const prop = new ICAL.Property(name);
  prop.setValue(
    ICAL.Time.fromString(
      allDay
        ? date
        : `${date}T${time || "00:00"}:00${zone === "UTC" ? "Z" : ""}`,
    ),
  );
  if (!allDay && zone && !["UTC", "floating"].includes(zone))
    prop.setParameter("tzid", zone);
  comp.addProperty(prop);
}
export function eventComponent(r) {
  registerZones(r.timezoneDefinitions);
  const comp = r.ical
    ? new ICAL.Component(ICAL.parse(r.ical))
    : new ICAL.Component("vevent");
  const set = (name, v) => comp.updatePropertyWithValue(name, v);
  set("uid", r.sourceUid || `${r.id}@ascend.local`);
  if (r.category) set("categories", r.category);
  set("summary", r.title || "Untitled event");
  set("description", r.notes || "");
  set("location", r.location || "");
  set("status", r.status === "Canceled" ? "CANCELLED" : "CONFIRMED");
  set("sequence", Number(r.sequence) || 0);
  if (!comp.hasProperty("dtstamp"))
    set(
      "dtstamp",
      ICAL.Time.fromJSDate(new Date(r.updated || Date.now()), true),
    );
  if (r.updated)
    set("last-modified", ICAL.Time.fromJSDate(new Date(r.updated), true));
  if (r.date) {
    setTime(comp, "dtstart", r.date, r.time, r.allDay, r.timezone);
    {
      comp.removeAllProperties("duration");
      setTime(
        comp,
        "dtend",
        r.allDay ? shiftDate(r.endDate || r.date, 1) : r.endDate || r.date,
        r.endTime || r.time,
        r.allDay,
        r.timezone,
      );
    }
  }
  if (r.repeat !== "Imported") {
    for (const p of ["rrule", "rdate", "exdate"]) comp.removeAllProperties(p);
    if (r.repeat && r.repeat !== "None") {
      let rule = `FREQ=${r.repeat.toUpperCase()};INTERVAL=${Number(r.repeatInterval) || 1}`;
      if (r.repeatUntil) {
        const until = r.allDay
          ? r.repeatUntil.replaceAll("-", "")
          : wallTimeToDate(r.repeatUntil, "23:59", r.timezone)
              .toISOString()
              .replace(/[-:]/g, "")
              .replace(/\.\d+Z/, "Z");
        rule += `;UNTIL=${until}`;
      }
      comp.addPropertyWithValue("rrule", ICAL.Recur.fromString(rule));
    }
    for (const date of r.excludedDates || []) {
      const p = new ICAL.Property("exdate");
      p.setValue(
        ICAL.Time.fromString(
          r.allDay
            ? date
            : `${date}T${r.time || "00:00"}:00${r.timezone === "UTC" ? "Z" : ""}`,
        ),
      );
      if (!r.allDay && r.timezone && !["UTC", "floating"].includes(r.timezone))
        p.setParameter("tzid", r.timezone);
      comp.addProperty(p);
    }
  }
  return comp;
}
function localTime(time, prop, record) {
  if (time.isDate) return { date: time.toString().slice(0, 10), time: "" };
  const zone = prop?.getParameter("tzid") || record.timezone || "floating";
  let d;
  try {
    d =
      zone !== "floating" && ICAL.TimezoneService.has(zone)
        ? time.toJSDate()
        : wallTimeToDate(
            time.toString().slice(0, 10),
            time.toString().slice(11, 16),
            zone,
          );
  } catch {
    d = new Date(time.toString().slice(0, 19));
  }
  return { date: dateKey(d), time: clockKey(d) };
}
export function expandPersonalEvents(records, rangeStart, rangeEnd) {
  const events = [],
    warnings = [],
    groups = new Map();
  for (const r of records.filter((r) => !r.archived)) {
    registerZones(r.timezoneDefinitions);
    const key = r.sourceUid || r.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  for (const group of groups.values()) {
    const masters = group.filter((r) => !r.recurrenceId),
      exceptions = group.filter((r) => r.recurrenceId);
    for (const r of masters.length ? masters : exceptions) {
      if (r.status === "Canceled" || !r.date) continue;
      try {
        const comp = eventComponent(r),
          exceptionEvents = exceptions.map(
            (x) => new ICAL.Event(eventComponent(x)),
          ),
          event = new ICAL.Event(comp, { exceptions: exceptionEvents });
        const recurring = event.isRecurring(),
          rule = comp.getFirstPropertyValue("rrule"),
          subdaily =
            rule && ["SECONDLY", "MINUTELY", "HOURLY"].includes(rule.freq);
        if (subdaily)
          warnings.push(
            `${r.title}: sub-daily repeats are retained for export; only the first occurrence is displayed.`,
          );
        const iterator = recurring && !subdaily ? event.iterator() : null;
        let next = iterator ? iterator.next() : event.startDate,
          iterations = 0;
        const seen = new Set();
        const add = (details, occurrence) => {
          const item = details.item;
          if (
            String(
              item.component.getFirstPropertyValue("status"),
            ).toUpperCase() === "CANCELLED"
          )
            return;
          const a = localTime(
              details.startDate,
              item.component.getFirstProperty("dtstart"),
              r,
            ),
            b = localTime(
              details.endDate,
              item.component.getFirstProperty("dtend"),
              r,
            );
          const endDate = details.startDate.isDate
            ? shiftDate(b.date, -1)
            : b.time === "00:00" && b.date > a.date
              ? shiftDate(b.date, -1)
              : b.date;
          if (a.date > rangeEnd || endDate < rangeStart) return;
          const instance = occurrence.toString();
          if (seen.has(instance)) return;
          seen.add(instance);
          events.push({
            id: r.id,
            instance,
            title: item.summary || r.title,
            date: a.date,
            endDate: endDate < a.date ? a.date : endDate,
            time: a.time,
            endTime: b.time,
            allDay: details.startDate.isDate,
            zone: r.timezone,
            kind: r.category || "Personal",
            category: r.category || "Personal",
            location: item.location || "",
            notes: item.description || "",
            personal: true,
            recurring: !!recurring,
            recordId: r.id,
            target: `planner/${a.date}`,
          });
        };
        while (next && iterations++ < 12000) {
          if (next.toString().slice(0, 10) > shiftDate(rangeEnd, 2)) break;
          add(event.getOccurrenceDetails(next), next);
          if (!iterator) break;
          next = iterator.next();
        }
        // A moved exception can enter this range even when its original date is outside it.
        for (const ex of exceptionEvents)
          if (ex.startDate)
            add(
              { item: ex, startDate: ex.startDate, endDate: ex.endDate },
              ex.recurrenceId || ex.startDate,
            );
        if (iterations >= 12000)
          warnings.push(
            `${r.title}: repeat preview reached its safety limit. The full rule remains in exported calendars.`,
          );
      } catch {
        warnings.push(
          `${r.title}: this event could not be expanded. Its saved calendar data is preserved.`,
        );
      }
    }
  }
  return {
    events: events.sort((a, b) =>
      (a.date + a.time).localeCompare(b.date + b.time),
    ),
    warnings: [...new Set(warnings)],
  };
}
export function calendarFile(personal, linked = []) {
  const root = new ICAL.Component("vcalendar");
  root.addPropertyWithValue("version", "2.0");
  root.addPropertyWithValue("prodid", "-//Ascend//Browser Calendar//EN");
  root.addPropertyWithValue("calscale", "GREGORIAN");
  root.addPropertyWithValue("x-wr-calname", "Ascend");
  const seenZones = new Set();
  for (const r of personal.filter((r) => !r.archived)) {
    for (const def of r.timezoneDefinitions || [])
      if (!seenZones.has(def)) {
        seenZones.add(def);
        root.addSubcomponent(new ICAL.Component(ICAL.parse(def)));
      }
    root.addSubcomponent(eventComponent(r));
  }
  const seen = new Set();
  for (const e of linked.filter((e) => !e.personal)) {
    const uid = `${String(e.kind || "event").replace(/[^a-z0-9]/gi, "-")}-${e.id}@ascend.local`;
    if (seen.has(uid) || !e.date) continue;
    seen.add(uid);
    root.addSubcomponent(
      eventComponent({
        id: e.id,
        sourceUid: uid,
        title: e.title,
        date: e.date,
        endDate: e.endDate || e.date,
        time: e.time || "",
        endTime: e.endTime || e.time || "",
        allDay: !e.time,
        timezone: e.zone || localZone(),
        notes: e.notes || `${e.kind || "Planner item"}. Saved in Ascend.`,
        location: e.location || "",
        repeat: "None",
      }),
    );
  }
  return root.toString() + "\r\n";
}
