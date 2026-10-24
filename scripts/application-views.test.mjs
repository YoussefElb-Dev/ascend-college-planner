import test from "node:test";
import assert from "node:assert/strict";
import { applicationChecklist, matchesApplicationView } from "../dist/application-views.js";

test("complete view requires every applicable required item, even when weighted progress rounds to 100", () => {
  const app = { status: "In Progress", requirements: [
    { done: true, weight: 999 }, { done: false, weight: 1 },
  ] };
  assert.equal(applicationChecklist(app).percent, 99);
  assert.equal(matchesApplicationView(app, "Complete"), false);
  app.requirements[1].done = true;
  assert.equal(matchesApplicationView(app, "Complete"), true);
});

test("complete view excludes empty, optional-only, exempt-only, and archived checklists", () => {
  for (const requirements of [[], [{ done: true, required: false }], [{ done: true, exempt: true }]]) {
    assert.equal(matchesApplicationView({ requirements }, "Complete"), false);
  }
  const app = { requirements: [{ done: true }, { done: false, required: false }, { done: false, exempt: true }] };
  assert.deepEqual(applicationChecklist(app), { total: 1, done: 1, percent: 100, complete: true });
  assert.equal(matchesApplicationView(app, "Complete"), true);
  assert.equal(matchesApplicationView({ ...app, archived: true }, "Complete"), false);
});

test("submission status and checklist completion remain independent without changing saved data", () => {
  const app = { status: "Submitted", requirements: [{ done: false }] };
  const before = structuredClone(app);
  assert.equal(matchesApplicationView(app, "Submitted"), true);
  assert.equal(matchesApplicationView(app, "Complete"), false);
  assert.deepEqual(app, before);
  assert.equal(matchesApplicationView({ ...app, status: "Awaiting Decision" }, "Submitted"), true);
  assert.equal(matchesApplicationView({ ...app, status: "In Progress" }, "In Progress"), true);
  assert.equal(matchesApplicationView({ ...app, status: "Accepted" }, "Submitted"), false);
  assert.equal(matchesApplicationView({ ...app, archived: true }, "All"), false);
  assert.equal(matchesApplicationView({ ...app, archived: true }, "Archived"), true);
  assert.equal(matchesApplicationView(app, "Archived"), false);
});
