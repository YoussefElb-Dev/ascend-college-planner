import { progress, parseDate, today, words } from "./core.js";
import { admissionsRequirements } from "./aid-model.js";

export const APPLICATION_TABS = ["All", "Not Started", "In Progress", "Ready to Submit", "Submitted", "Complete"];

export const COMMON_REQUIREMENTS = [
  "Personal statement",
  "Supplemental essays",
  "Activities list",
  "Transcript",
  "School report",
  "Recommendations",
  "Mid-Year Report",
  "Final review & submission",
];

export const ADMITTED_CHECKLIST = [
  "Attend Admitted Student Day or campus session",
  "Compare 4-year net cost and financial aid offer",
  "Review housing priority deadline and residence options",
  "Check honors college or special program reply date",
  "Submit enrollment deposit before May 1",
];

export const ENROLLED_TRANSITION_CHECKLIST = [
  "Request final high school transcript delivery",
  "Send official AP, IB, or dual-enrollment scores",
  "Complete immunization and student health forms",
  "Take math, writing, or language placement assessments",
  "Submit campus housing and roommate questionnaire",
  "Register for new student orientation and advising",
  "Set up university email, student ID, and billing plan",
  "Complete dorm packing and move-in checklist",
];

export const AID_APPEAL_TASKS = [
  "Gather competing aid offers or special circumstances documentation",
  "Draft financial aid reconsideration request",
  "Follow up with the college financial aid office",
];

export function applicationChecklist(app) {
  const required = admissionsRequirements(app).filter(
    (item) => item.required !== false && !item.exempt,
  );
  const done = required.filter((item) => item.done).length;
  const complete = required.length > 0 && done === required.length;
  return {
    total: required.length,
    done,
    percent: complete ? 100 : Math.min(99, progress(app)),
    // A rounded percentage or an empty checklist must never imply completion.
    complete,
  };
}

export function matchesApplicationView(app, view) {
  if (view === "Archived") return Boolean(app.archived);
  if (app.archived) return false;
  if (view === "All") return true;
  if (view === "Complete") return applicationChecklist(app).complete;
  if (view === "Submitted")
    return ["Submitted", "Awaiting Decision"].includes(app.status);
  return app.status === view;
}

export function portalCheckInfo(app, currentDay = today()) {
  const checkedAt = app?.portalAccess?.checkedAt || "";
  const checkedDate = parseDate(checkedAt);
  const currentDate = parseDate(currentDay);
  const daysAgo =
    checkedDate && currentDate && !Number.isNaN(checkedDate.getTime())
      ? Math.max(0, Math.round((currentDate - checkedDate) / 86400000))
      : null;
  const activePortal = !app?.archived && !["Rejected", "Withdrawn", "Considering"].includes(app?.status || "");
  return {
    checkedAt,
    daysAgo,
    needsCheck: Boolean(activePortal && (daysAgo === null || daysAgo > 14)),
  };
}

export function requirementMatrix(applications = [], columns = COMMON_REQUIREMENTS) {
  const active = applications.filter((a) => !a.archived);
  const rows = active.map((a) => {
    const reqs = admissionsRequirements(a);
    const cells = columns.map((col) => {
      const norm = col.toLowerCase();
      const match = reqs.find((r) => {
        const t = (r.title || "").toLowerCase();
        return t === norm || t.includes(norm) || (norm.includes("recommendation") && t.includes("recommend"));
      });
      return {
        column: col,
        exists: Boolean(match),
        requirementId: match?.id || "",
        title: match?.title || col,
        done: Boolean(match?.done),
        exempt: Boolean(match?.exempt),
      };
    });
    return {
      id: a.id,
      name: a.name,
      tier: a.tier || "",
      round: a.round || "",
      status: a.status || "",
      cells,
    };
  });
  return { columns, rows };
}

export function fourYearNetCost(offer = {}) {
  const annualCoa = Math.max(0, Number(offer.cost) || 0);
  const annualGiftAid = Math.max(0, (Number(offer.grants) || 0) + (Number(offer.scholarships) || 0));
  const annualNetPrice = Math.max(0, annualCoa - annualGiftAid);
  const annualLoans = Math.max(0, Number(offer.loans) || 0);
  const annualWorkStudy = Math.max(0, Number(offer.workstudy) || 0);
  const annualOutOfPocket = Math.max(0, annualNetPrice - annualLoans - annualWorkStudy);
  return {
    annualCoa,
    annualGiftAid,
    annualNetPrice,
    fourYearNetPrice: annualNetPrice * 4,
    annualLoans,
    fourYearLoans: annualLoans * 4,
    annualWorkStudy,
    annualOutOfPocket,
    fourYearOutOfPocket: annualOutOfPocket * 4,
  };
}

export function essayPromptWarnings(essay = {}, prompts = [], applications = []) {
  const count = words(essay.body || "");
  const linked = (prompts || []).filter(
    (p) => !p.archived && (p.essayId === essay.id || (essay.promptId && p.id === essay.promptId)),
  );
  return linked.map((p) => {
    const limit = Number(p.limit) || 0;
    const school = applications.find((a) => a.id === p.applicationId)?.name || "General prompt";
    return {
      id: p.id,
      title: p.title,
      school,
      limit,
      words: count,
      overBy: limit > 0 && count > limit ? count - limit : 0,
    };
  });
}
