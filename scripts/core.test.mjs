import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  STORAGE_KEY,
  blankState,
  validateState,
  persistState,
  loadState,
  progress,
  nextRecurringDate,
  toICS,
  fuzzyMatch,
  safeUrl,
  words,
} from "../dist/core.js";
import { makeDocx } from "../dist/exports.js";
test("workspace survives a complete local-storage save and reload, including private documents", () => {
  const map = new Map(),
    storage = {
      getItem: (k) => map.get(k) || null,
      setItem: (k, v) => map.set(k, v),
    };
  const s = blankState();
  s.profile.name = "A student";
  s.applications.push({
    id: "app1",
    name: "College",
    requirements: [],
    statusHistory: [],
  });
  s.documents.push({
    id: "doc1",
    name: "essay.txt",
    type: "text/plain",
    size: 5,
    data: "data:text/plain;base64,aGVsbG8=",
  });
  s.essays.push({
    id: "essay1",
    title: "My story",
    body: "A beginning.",
    versions: [],
  });
  persistState(s, storage);
  assert.deepEqual(loadState(storage), s);
  assert.ok(map.has(STORAGE_KEY));
});
test("storage quota failures are visible to the caller and never silently treated as success", () => {
  assert.throws(
    () =>
      persistState(blankState(), {
        setItem() {
          throw new Error("QuotaExceededError");
        },
      }),
    /Quota/,
  );
});
test("backup validation rejects malformed versions, duplicates, unsafe IDs, and active file types", () => {
  assert.throws(() => validateState({ version: 2 }));
  for (const id of ['bad" onclick="alert(1)', "<script>"]) {
    const s = blankState();
    s.notes.push({ id, title: "test" });
    assert.throws(() => validateState(s));
  }
  const s = blankState();
  s.notes = [
    { id: "same", title: "a" },
    { id: "same", title: "b" },
  ];
  assert.throws(() => validateState(s));
  const d = blankState();
  d.documents.push({
    id: "d1",
    name: "bad.svg",
    type: "image/svg+xml",
    size: 5,
    data: "data:image/svg+xml;base64,aGVsbG8=",
  });
  assert.throws(() => validateState(d));
});
test("backup validation rejects broken essay structures without modifying existing state", () => {
  const s = blankState();
  s.essays.push({ id: "e1", title: "Broken", body: "body", versions: null });
  assert.throws(() => validateState(s), /essay/);
  assert.equal(s.essays[0].body, "body");
});
test("progress uses required weights and excludes optional and exempt items", () => {
  assert.equal(progress({ requirements: [] }), 0);
  assert.equal(
    progress({
      requirements: [
        { required: true, weight: 3, done: true },
        { required: true, weight: 1, done: false },
        { required: false, weight: 100, done: false },
        { required: true, weight: 100, exempt: true, done: false },
      ],
    }),
    75,
  );
});
test("monthly recurring dates clamp to month end and handle leap years", () => {
  assert.equal(nextRecurringDate("2027-01-31", "Monthly"), "2027-02-28");
  assert.equal(nextRecurringDate("2028-01-31", "Monthly"), "2028-02-29");
  assert.equal(nextRecurringDate("2026-12-30", "Weekly"), "2027-01-06");
});
test("ICS escapes student text and preserves all-day dates and explicit time zones", () => {
  const s = toICS([
    {
      id: "1",
      title: "Essay, review; now\nplease",
      kind: "Task",
      date: "2026-11-01",
    },
    {
      id: "2",
      title: "Deadline",
      date: "2026-11-02",
      time: "23:59",
      zone: "America/Los_Angeles",
      kind: "Application",
    },
  ]);
  assert.match(s, /DTSTART;VALUE=DATE:20261101/);
  assert.match(s, /DTSTART;TZID=America\/Los_Angeles:20261102T235900/);
  assert.ok(s.includes("Essay\\, review\\; now\\nplease"));
  assert.ok(s.includes("\r\nEND:VCALENDAR"));
});
test("school search matches aliases, common acronyms, and small misspellings", () => {
  const mit = {
    name: "Massachusetts Institute of Technology",
    city: "Cambridge",
    state: "MA",
    aliases: ["MIT, M.I.T."],
  };
  assert.ok(fuzzyMatch("MIT", mit));
  assert.ok(fuzzyMatch("Princetom", { name: "Princeton University" }));
  assert.ok(fuzzyMatch("Cambridge", mit));
  assert.equal(fuzzyMatch("totallyunrelated", mit), false);
});
test("links cannot execute JavaScript and word counts ignore blank whitespace", () => {
  assert.equal(safeUrl("javascript:alert(1)"), "");
  assert.equal(safeUrl("https://mit.edu"), "https://mit.edu/");
  assert.equal(words("   "), 0);
  assert.equal(words("My\n next  chapter"), 3);
});
test("DOCX export produces an OOXML ZIP with Unicode text and XML escaping", async () => {
  const b = Buffer.from(
    await makeDocx("My story", "Curiosity & <discovery> — 你好").arrayBuffer(),
  );
  assert.equal(b.readUInt32LE(0), 0x04034b50);
  assert.ok(b.includes(Buffer.from("[Content_Types].xml")));
  assert.ok(
    b.includes(Buffer.from("Curiosity &amp; &lt;discovery&gt; — 你好")),
  );
  assert.equal(b.readUInt32LE(b.length - 22), 0x06054b50);
});
test("shipped app contains no external runtime dependencies or data-service SDKs", () => {
  for (const file of [
    "app.js",
    "core.js",
    "exports.js",
    "icons.js",
    "index.html",
  ]) {
    const text = fs.readFileSync(
      new URL("../dist/" + file, import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(
      text,
      /fetch\(['"]https?:|supabase|firebase|sendBeacon|XMLHttpRequest|WebSocket/,
    );
  }
});
