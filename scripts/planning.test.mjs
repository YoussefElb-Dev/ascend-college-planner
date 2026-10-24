import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  blankState,
  validateState,
  persistState,
  loadState,
  calendarEvents,
  toICS,
} from "../dist/core.js";
import { budgetTotals, backwardPlan, essayInsights } from "../dist/planning.js";

test("previous backups migrate without losing applications, files, or new tool records", () => {
  const s = blankState();
  for (const key of [
    "activities",
    "honors",
    "visits",
    "tests",
    "expenses",
    "goals",
    "contacts",
  ])
    delete s[key];
  s.profile.name = "Existing student";
  const migrated = validateState(s);
  assert.equal(migrated.profile.name, s.profile.name);
  for (const key of [
    "activities",
    "honors",
    "visits",
    "tests",
    "expenses",
    "goals",
    "contacts",
  ])
    assert.deepEqual(migrated[key], []);
  migrated.activities.push({
    id: "activity1",
    title: "Robotics",
    hours: 5,
    weeks: 30,
    description: "Built a robot.",
  });
  migrated.expenses.push({
    id: "expense1",
    title: "Application",
    amount: 75.5,
    status: "Paid",
  });
  migrated.essays.push({
    id: "essay1",
    title: "Draft",
    body: "Text",
    versions: [],
    reviewChecks: [0, 4],
  });
  const map = new Map(),
    storage = { getItem: (k) => map.get(k), setItem: (k, v) => map.set(k, v) };
  persistState(migrated, storage);
  assert.deepEqual(loadState(storage), migrated);
});
test("new collection validation rejects invalid structures and nonfinite expense amounts", () => {
  for (const mutation of [
    (s) => (s.activities = {}),
    (s) => (s.visits = [{ id: "bad/id", title: "Event" }]),
    (s) => (s.expenses = [{ id: "x", title: "Fee", amount: "Infinity" }]),
    (s) => (s.contacts = [{ id: "x", title: "Person", due: "2027-02-30" }]),
    (s) =>
      (s.activities = [
        { id: "x", title: "One" },
        { id: "x", title: "Duplicate" },
      ]),
  ]) {
    const s = blankState();
    mutation(s);
    assert.throws(() => validateState(s));
  }
});
test("budget totals separate money paid, still planned, and waived fees", () => {
  assert.deepEqual(
    budgetTotals([
      { amount: 75.5, status: "Paid" },
      { amount: 100, status: "Planned" },
      { amount: 80, status: "Waived" },
      { amount: 500, status: "Paid", archived: true },
    ]),
    { total: 255.5, paid: 75.5, planned: 100, waived: 80 },
  );
  assert.deepEqual(budgetTotals([]), {
    total: 0,
    paid: 0,
    planned: 0,
    waived: 0,
  });
});
test("backward planning crosses years and leap days using calendar dates", () => {
  const tasks = backwardPlan("2028-03-01", "College");
  assert.equal(tasks.length, 6);
  assert.equal(tasks.at(-1).due, "2028-02-28");
  assert.equal(backwardPlan("2027-01-01", "College")[0].due, "2026-11-20");
  assert.throws(() => backwardPlan("", "College"));
});
test("new calendar sources exclude archived, completed and canceled events", () => {
  const s = blankState();
  s.visits = [
    {
      id: "visit",
      title: "Visit",
      due: "2027-01-10",
      time: "10:00",
      status: "Booked",
    },
    {
      id: "canceled",
      title: "Canceled",
      due: "2027-01-10",
      status: "Canceled",
    },
  ];
  s.tests = [{ id: "exam", title: "Exam", due: "2027-01-15", status: "Done" }];
  s.goals = [
    { id: "goal", title: "Write draft", due: "2027-01-08", status: "To do" },
  ];
  const events = calendarEvents(s);
  assert.deepEqual(
    events.map((e) => e.id),
    ["goal", "visit"],
  );
  assert.equal(events[0].target, "planner");
  assert.ok(toICS(events).includes("SUMMARY:Visit"));
});
test("essay insights handle blanks, repeated words, paragraphs, and over-limit drafts", () => {
  assert.equal(essayInsights("", 650).count, 0);
  assert.equal(essayInsights("   ", 650).readingMinutes, 0);
  const i = essayInsights(
    "Robotics helped me learn. Robotics gave me purpose.\n\nRobotics taught patience.",
    5,
  );
  assert.equal(i.paragraphs, 2);
  assert.equal(i.sentences, 3);
  assert.ok(i.remaining < 0);
  assert.deepEqual(i.repeated, [["robotics", 3]]);
});
test("all new tools ship as local modules with no external requests or remote persistence", () => {
  for (const file of ["extras.js", "home.js", "planning.js"]) {
    const s = fs.readFileSync(
      new URL(`../dist/${file}`, import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(
      s,
      /\b(?:fetch|WebSocket|XMLHttpRequest|sendBeacon)\s*\(/,
    );
    assert.doesNotMatch(
      s,
      /supabase|firebase|api\.openai\.com|analytics\.track/i,
    );
  }
});
