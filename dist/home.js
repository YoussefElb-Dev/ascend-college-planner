import {
  dateLabel,
  today,
  localDate,
  parseDate,
  daysUntil,
  calendarEvents,
  progress,
  safeUrl,
  escapeHTML as h,
} from "./core.js";
import { icon } from "./icons.js";

export function homePage({ state, btn, badge, filterTabs, applicationsTable }) {
  const apps = state.applications.filter((a) => !a.archived);
  const tasks = state.tasks
    .filter((t) => !t.archived && t.status !== "Done")
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  const events = calendarEvents(state).filter((e) => daysUntil(e.date) >= 0);
  const submitted = apps.filter((a) =>
    ["Submitted", "Awaiting Decision"].includes(a.status),
  ).length;
  const complete = apps.length
    ? Math.round(apps.reduce((n, a) => n + progress(a), 0) / apps.length)
    : 0;
  const hour = new Date().getHours(),
    greeting =
      hour < 12
        ? "Good morning"
        : hour < 18
          ? "Good afternoon"
          : "Good evening";
  const doneRequirements = apps.reduce(
    (n, a) => n + a.requirements.filter((r) => r.done).length,
    0,
  );
  const dueSoon = events.filter((e) => daysUntil(e.date) <= 14).length;
  const firstName = (state.profile.name || "").trim().split(/\s+/)[0];
  const pending = apps
    .flatMap((a) =>
      a.requirements
        .filter((r) => !r.done && !r.exempt && r.required !== false)
        .map((r) => ({ app: a, item: r })),
    )
    .slice(0, 3);
  const focus = tasks
    .filter((t) => t.priority === "High" || (t.due && daysUntil(t.due) <= 7))
    .slice(0, 3);
  const portalTasks = state.tasks.filter(
    (t) => !t.archived && t.category === "Portal setup",
  );
  const readyPortals = portalTasks.filter((t) => t.status === "Done");
  const portalCard = (task) => {
    const app = apps.find((a) => a.id === task.applicationId);
    const done = task.status === "Done";
    const url = app && safeUrl(app.url);
    return `<div class="portal-setup-item"><button class="task-check ${done ? "checked" : ""}" data-action="complete-task:${h(task.id)}" aria-label="${done ? "Reopen" : "Complete"} ${h(task.title)}" aria-pressed="${done}">${done ? icon("check") : ""}</button><div><button class="focus-title ${done ? "completed-text" : ""}" data-action="edit-task:${h(task.id)}">${h(task.title)}</button><small>${done ? "Access confirmed" : task.due ? `Your target: ${dateLabel(task.due)}` : "Set your target date"}</small><div class="portal-setup-links">${url ? `<a class="text-link" href="${h(url)}" target="_blank" rel="noopener noreferrer">Open portal ${icon("external")}</a>` : ""}<button class="text-link" data-action="edit-task:${h(task.id)}">View steps ${icon("arrow")}</button></div></div></div>`;
  };
  const portalSetup = portalTasks.length
    ? `<section class="panel portal-setup-panel" aria-labelledby="portal-setup-heading"><div class="panel-heading"><div><h2 id="portal-setup-heading">Portal setup <span class="heading-count">${readyPortals.length}/${portalTasks.length} ready</span></h2><p>Start here: activate your accounts, then review each school’s checklist. Target dates are your own planning goals.</p></div><a class="text-link" href="#tasks">All tasks ${icon("arrow")}</a></div>${readyPortals.length < portalTasks.length ? `<div class="portal-setup-grid">${portalTasks.filter((t) => t.status !== "Done").map(portalCard).join("")}</div>` : `<p class="portal-setup-complete">${icon("check")} All tracked portals are accessible. Keep checking their admissions and financial aid lists.</p>`}${readyPortals.length ? `<details class="portal-setup-ready"><summary>${readyPortals.length} accessible ${readyPortals.length === 1 ? "portal" : "portals"}</summary><div class="portal-setup-grid">${readyPortals.map(portalCard).join("")}</div></details>` : ""}</section>`
    : "";
  const steps = [
    [
      "school",
      "Build your college list",
      "Search colleges and save the ones you want to explore.",
      "colleges",
    ],
    [
      "edit",
      "Tell your story",
      "Keep activities, essays, and documents together.",
      "activities",
    ],
    [
      "calendar",
      "Make a plan",
      "Turn deadlines into a manageable weekly schedule.",
      "planner",
    ],
  ];
  const weekStart = parseDate(today());
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return localDate(d);
  });
  const weekEvents = calendarEvents(state).filter((e) =>
    weekDates.includes(e.date),
  );
  return `<section class="home-welcome"><div class="welcome-copy"><div class="workspace-breadcrumb">YOUR APPLICATION WORKSPACE</div><h1>${greeting}${firstName ? `, ${h(firstName)}` : ""}<span class="welcome-dot">.</span></h1><p>${apps.length ? "Your applications, commitments, and research, all in one place." : "Keep your college plans and everyday commitments in focus."}</p><div class="welcome-actions">${btn("Quick add", "quick-add", "primary", "plus")}<span class="today-label">${icon("calendar")}${new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span></div></div><a class="hero-week" href="#planner"><div class="hero-week-heading"><div><span class="eyebrow">YOUR SCHEDULE</span><h2>This week</h2></div><span class="hero-week-arrow">${icon("arrow")}</span></div><div class="hero-week-days">${weekDates.map((date, i) => `<div class="hero-day ${date === today() ? "current-day" : ""}"><span>${["M", "T", "W", "T", "F", "S", "S"][i]}</span><strong>${parseDate(date).getDate()}</strong><i class="${weekEvents.some((e) => e.date === date) ? "has-event" : ""}"></i></div>`).join("")}</div><div class="hero-week-footer"><span>${weekEvents.length} ${weekEvents.length === 1 ? "item" : "items"} planned</span><strong>Open planner ${icon("arrow")}</strong></div></a></section>
  <section class="overview-metrics" aria-label="Application overview">${[
    [
      "file",
      "Applications",
      apps.length,
      "All",
      "blue",
      `${apps.filter((a) => a.status === "In Progress").length} in progress`,
    ],
    [
      "send",
      "Submitted",
      submitted,
      "Submitted",
      "mint",
      apps.length
        ? `${Math.round((submitted / apps.length) * 100)}% of your list`
        : "Ready when you are",
    ],
    [
      "calendar",
      "Due in 14 days",
      dueSoon,
      "deadlines",
      "blush",
      dueSoon ? "Keep these on your radar" : "No upcoming deadlines",
    ],
    [
      "progress",
      "Checklist progress",
      `${complete}%`,
      "All",
      "lavender",
      `${doneRequirements} ${doneRequirements === 1 ? "requirement" : "requirements"} completed`,
    ],
  ]
    .map(
      ([ico, label, value, action, tint, detail]) =>
        `<button class="overview-metric metric-${tint}" data-action="metric:${action}"><div class="metric-top"><span class="tool-symbol ${tint}">${icon(ico)}</span><span>${label}</span>${icon("arrow")}</div><strong>${value}</strong><small>${detail}</small></button>`,
    )
    .join("")}</section>
  ${!state.profile.onboarded ? `<div class="welcome-setup"><span class="tool-symbol lavender">${icon("users")}</span><div><strong>Make yourself at home</strong><span>Add your name, school, and interests to get set up.</span></div>${btn("Set up profile", "onboard", "ghost", "arrow")}</div>` : ""}
  ${portalSetup}<div class="home-layout"><section class="panel home-applications"><div class="panel-heading"><div><h2>Your applications <span class="heading-count">${apps.length}</span></h2><p>Every school. Every next step.</p></div>${btn("Add application", "add-application", "secondary", "plus")}</div>${apps.length ? `<div class="home-tabs">${filterTabs(true)}<a href="#applications" class="text-link">View all ${icon("arrow")}</a></div>${applicationsTable(true)}${pending.length && apps.length <= 2 ? `<div class="home-checklist"><div class="home-checklist-heading"><strong>Next checklist items</strong><span>From your applications</span></div>${pending.map(({ app, item }) => `<label class="home-requirement"><input type="checkbox" data-requirement="${item.id}" data-app="${app.id}"><span>${h(item.title)}<small>${h(app.name)}</small></span></label>`).join("")}</div>` : ""}` : `<div class="start-list"><div class="start-list-icon">${icon("school")}</div><h3>Build your college plan.</h3><p>Explore the directory or add a college to start tracking<br class="desktop-break"> its requirements, essays, and deadlines.</p><div class="button-group">${btn("Add your first college", "add-application", "primary", "plus")}<a class="btn ghost" href="#colleges">Browse colleges ${icon("arrow")}</a></div></div><div class="getting-started-steps">${steps.map(([ico, title, text, page], i) => `<a href="#${page}"><span class="step-number">0${i + 1}</span><div><strong>${title}</strong><small>${text}</small></div>${icon("arrow")}</a>`).join("")}</div>`}</section>
  <aside class="home-side"><section class="panel focus-panel"><div class="panel-heading"><div class="section-label">${icon("tasks")} Your next steps</div><span class="heading-count">${focus.length}</span></div>${focus.length ? focus.map((t) => `<div class="focus-row"><button class="task-check" data-action="complete-task:${t.id}" aria-label="Complete ${h(t.title)}"></button><button class="focus-title" data-action="edit-task:${t.id}">${h(t.title)}<small>${t.due ? `${dateLabel(t.due)}${daysUntil(t.due) < 0 ? " · Overdue" : ""}` : "High priority"}</small></button></div>`).join("") : `<div class="focus-empty"><span class="focus-check">${icon("check")}</span><strong>A little room to focus</strong><p>Your high priority tasks and items due this week will appear here.</p></div>`}<div class="focus-footer">${btn("Add a task", "add-task", "ghost", "plus")}<a href="#tasks" class="text-link">All tasks ${icon("arrow")}</a></div></section><a href="#planner" class="planner-promo"><span class="tool-symbol lavender">${icon("calendar")}</span><div><span class="eyebrow">MAKE SPACE FOR WHAT’S NEXT</span><h3>Your whole schedule</h3><p>A month of deadlines, plans, and personal commitments.</p><span class="text-link">Open planner ${icon("arrow")}</span></div></a></aside>
  <section class="panel upcoming-panel"><div class="panel-heading"><div><h2>Coming up</h2><p>Your next deadlines and commitments</p></div><a href="#deadlines" class="text-link">Calendar ${icon("arrow")}</a></div>${
    events.length
      ? events
          .slice(0, 4)
          .map(
            (e) =>
              `<a class="upcoming-item" href="#${e.target}"><span class="date-tile"><small>${new Date(e.date + "T12:00:00").toLocaleDateString(undefined, { month: "short" })}</small><strong>${Number(e.date.slice(8))}</strong></span><div><strong>${h(e.title)}</strong><small>${h(e.kind)}${e.time ? ` · ${h(e.time)}` : ""}</small></div><span class="due-pill">${daysUntil(e.date) === 0 ? "Today" : `${daysUntil(e.date)}d`}</span>${icon("arrow")}</a>`,
          )
          .join("")
      : `<div class="compact-empty upcoming-empty"><span class="tool-symbol blue">${icon("calendar")}</span><div><strong>Nothing on the calendar yet</strong><p>Add a deadline, visit, exam, or task to see it here.</p></div>${btn("Add deadline", "add-deadline", "ghost", "plus")}</div>`
  }</section>
  <section class="workspace-shortcuts"><div class="shortcuts-heading"><h2>Keep everything connected</h2><span>Tools for the whole process</span></div><div class="shortcut-grid">${[
    ["edit", "Essay studio", "Draft, review, revise", "essays", "blue"],
    [
      "award",
      "Activities & honors",
      "Your impact, organized",
      "activities",
      "lavender",
    ],
    [
      "wallet",
      "Application budget",
      "Plan fees and expenses",
      "expenses",
      "mint",
    ],
    ["pin", "Visits & interviews", "Prepare and reflect", "visits", "blush"],
  ]
    .map(
      ([ico, title, text, page, tint]) =>
        `<a href="#${page}" class="workspace-shortcut"><span class="tool-symbol ${tint}">${icon(ico)}</span><span><strong>${title}</strong><small>${text}</small></span>${icon("arrow")}</a>`,
    )
    .join("")}</div></section></div>`;
}
