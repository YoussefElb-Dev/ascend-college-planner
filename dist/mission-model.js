export const MISSION_PHASES = [
  { id: "applications", title: "Applications & portals", icon: "school", description: "Requirements, supplements, and submissions", route: "applications" },
  { id: "writing", title: "Essays & your story", icon: "edit", description: "Drafts, recommendations, and revisions", route: "essays" },
  { id: "aid", title: "Scholarships & aid", icon: "wallet", description: "Financial forms, documents, and funding", route: "financial-aid" },
  { id: "school", title: "Academics & activities", icon: "award", description: "Testing, coursework, and experiences", route: "activities" },
  { id: "planning", title: "Life & planning", icon: "calendar", description: "Your schedule, goals, and everything else", route: "planner" },
];
export const MISSION_STATUSES = ["To do", "In Progress", "Done", "Waiting"];
export function missionStatus(task) {
  const value = String(task.status || "").toLowerCase();
  if (["done", "complete", "completed"].includes(value)) return "Done";
  if (["in progress", "in-progress"].includes(value)) return "In Progress";
  if (["waiting", "blocked"].includes(value)) return "Waiting";
  return "To do";
}
export function missionPhase(task) {
  const text = `${task.category || ""} ${task.title || ""}`.toLowerCase();
  if (/financial|\baid\b|fafsa|css|idoc|tax|scholarship|pfaa|w-?2/.test(text)) return "aid";
  if (/essay|writing|draft|recommend|short.answer|graded.paper/.test(text)) return "writing";
  if (/test|\bsat\b|\bact\b|course|academic|activity|activities|transcript|overgrad/.test(text)) return "school";
  if (task.applicationId || /application|portal|supplement|questionnaire|college|admission/.test(text)) return "applications";
  return "planning";
}
export function missionSummary(tasks = []) {
  const active = tasks.filter(task => !task.archived);
  const counts = Object.fromEntries(MISSION_STATUSES.map(status => [status, active.filter(task => missionStatus(task) === status).length]));
  const phases = MISSION_PHASES.map(phase => {
    const items = active.filter(task => missionPhase(task) === phase.id);
    const done = items.filter(task => missionStatus(task) === "Done").length;
    return { ...phase, items, done, percent: items.length ? Math.round(done / items.length * 100) : 0 };
  });
  return { tasks: active, counts, phases, total: active.length, done: counts.Done };
}
