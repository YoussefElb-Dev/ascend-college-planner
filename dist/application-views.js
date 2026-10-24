import { progress } from "./core.js";

export const APPLICATION_TABS = ["All", "Not Started", "In Progress", "Submitted", "Complete"];

export function applicationChecklist(app) {
  const required = (app.requirements || []).filter(
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
