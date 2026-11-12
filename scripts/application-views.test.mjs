import test from "node:test";
import assert from "node:assert/strict";
import {
  applicationChecklist,
  matchesApplicationView,
  portalCheckInfo,
  requirementMatrix,
  fourYearNetCost,
  essayPromptWarnings,
} from "../dist/application-views.js";

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

test("portalCheckInfo flags stale checks after 14 days for active applications", () => {
  assert.equal(portalCheckInfo({ status: "Submitted", portalAccess: {} }, "2026-11-15").needsCheck, true);
  const fresh = portalCheckInfo({ status: "Submitted", portalAccess: { checkedAt: "2026-11-10" } }, "2026-11-15");
  assert.equal(fresh.needsCheck, false);
  assert.equal(fresh.daysAgo, 5);
  const old = portalCheckInfo({ status: "In Progress", portalAccess: { checkedAt: "2026-10-20" } }, "2026-11-15");
  assert.equal(old.needsCheck, true);
});

test("requirementMatrix maps school checklists across common requirements", () => {
  const matrix = requirementMatrix([
    { id: "a1", name: "MIT", requirements: [{ id: "r1", title: "Transcript", done: true }, { id: "r2", title: "Recommendations", done: false }] },
  ], ["Transcript", "Recommendations", "Financial aid forms"]);
  assert.equal(matrix.rows.length, 1);
  assert.deepEqual(matrix.rows[0].cells.map((c) => [c.exists, c.done]), [[true, true], [true, false], [false, false]]);
});

test("fourYearNetCost separates gift aid from loans and work-study across 4 years", () => {
  const c = fourYearNetCost({ cost: 80000, grants: 50000, scholarships: 10000, loans: 5500, workstudy: 2500 });
  assert.equal(c.annualGiftAid, 60000);
  assert.equal(c.annualNetPrice, 20000);
  assert.equal(c.fourYearNetPrice, 80000);
  assert.equal(c.fourYearLoans, 22000);
  assert.equal(c.annualOutOfPocket, 12000);
});

test("essayPromptWarnings detects word-limit overruns across linked school prompts", () => {
  const essay = { id: "e1", body: Array.from({ length: 310 }, () => "word").join(" ") };
  const prompts = [
    { id: "p1", title: "Why Us", applicationId: "a1", essayId: "e1", limit: 250 },
    { id: "p2", title: "Community", applicationId: "a2", essayId: "e1", limit: 350 },
  ];
  const apps = [{ id: "a1", name: "Columbia" }, { id: "a2", name: "Yale" }];
  const checks = essayPromptWarnings(essay, prompts, apps);
  assert.equal(checks.length, 2);
  assert.equal(checks[0].school, "Columbia");
  assert.equal(checks[0].overBy, 60);
  assert.equal(checks[1].overBy, 0);
});
