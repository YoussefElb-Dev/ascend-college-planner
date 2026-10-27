import {privacyReady,isPrivacyLocked,lockWorkspace} from "./privacy-lock.js";
import {createDeviceSync} from "./device-sync.js";
await privacyReady;
import {createWorkspaceTools} from "./workspace-tools.js";
import {TOOL_DEFINITIONS,validateTools} from "./workspace-tools-model.js";
import {
  STORAGE_KEY,
  STATUSES,
  ROUNDS,
  PATHWAYS,
  SECTIONS,
  uid,
  today,
  localDate,
  parseDate,
  dateLabel,
  daysUntil,
  dueLabel,
  escapeHTML as h,
  money,
  words,
  safeUrl,
  progress,
  blankState,
  parseWorkspaceBackup,
  loadState,
  persistState,
  download,
  nextRecurringDate,
  calendarEvents,
  toICS,
  fuzzyMatch,
} from "./core.js";
import { icon } from "./icons.js";
import { createExtras } from "./extras.js";
import { homePage } from "./mission-home.js";
import { APPLICATION_TABS, applicationChecklist, matchesApplicationView } from "./application-views.js";
import { createPlanner } from "./planner.js";
import {
  collegeCardMedia,
  collegeHero,
  collegeAbout,
  collegeCredits,
  featuredCollegeIds,
  hydrateCollegeMedia,
} from "./college-media.js";

const APPEARANCES = [
  ["light", "sun", "Classic", "Clean white, cobalt accents"],
  ["dark", "moon", "Dark", "A softer evening view"],
  ["monochrome", "contrast", "Black & white", "Every detail in monochrome"],
  ["system", "settings", "System", "Follow your device"],
];

let state,
  loadError = "",
  storageReadFailed = false;
try {
  state = loadState();
} catch (e) {
  state = blankState();
  loadError = e.message;
  storageReadFailed = true;
}
let route = location.hash.slice(1) || "home",
  missionFilter = "All",
  missionPhaseFilter = "All",
  appFilter = "All",
  appQuery = "",
  appSort = "added",
  taskView = "List",
  taskFilter = "All",
  taskPriority = "All",
  taskCollege = "",
  calendarView = "Month",
  calendarDate = new Date(),
  directoryKind = "colleges",
  directoryQuery = "",
  directoryState = "",
  directoryType = "",
  savedOnly = false,
  selectedEssay = "",
  essayQuery = "",
  essayCategory = "",
  showTools = false,
  workspaceTab = "Overview",
  mobileMenu = false;
let directoryAdvanced = {
  level: "",
  setting: "",
  maxTuition: "",
  minSize: "",
  maxSize: "",
  minGrad: "",
  maxAdmission: "",
};
let directories = {},
  directoryErrors = {},
  directoryLoading = {},
  searchIndex = -1,
  dragged = "",
  toastTimer,
  modalReturnFocus,
  editorTimer;
const formHandlers = new Map();
const root = document.querySelector("#app");
const pageNames = {
  home: "Mission Map",
  applications: "Applications",
  colleges: "Colleges",
  tasks: "Tasks",
  deadlines: "Deadlines",
  resources: "Resources",
  "high-schools": "High Schools",
  essays: "Essays",
  scholarships: "Scholarships",
  "financial-aid": "Financial Aid",
  documents: "Documents",
  recommendations: "Recommendations",
  compare: "College Compare",
  questbridge: "QuestBridge",
  notes: "Notes",
  analytics: "Analytics",
  settings: "Settings",
  planner: "Planner",
  activities: "Activities & honors",
  visits: "Visits & interviews",
  tests: "Testing plan",
  expenses: "Application budget",
  contacts: "People & outreach",
  goals: "Goals",
};
const morePages = [
  "studio", "focus", "readiness", "sync",
  "deadlines",
  "resources",
  "activities",
  "visits",
  "tests",
  "expenses",
  "contacts",
  "goals",
  "high-schools",
  "essays",
  "scholarships",
  "financial-aid",
  "documents",
  "recommendations",
  "compare",
  "questbridge",
  "notes",
  "analytics",
  "settings",
];
Object.assign(pageNames,{studio:"Studio & tools",focus:"Focus timer",readiness:"Submission review",sync:"Device sync",...Object.fromEntries(TOOL_DEFINITIONS.map(d=>[d.key,d.title]))});
const pageIcons = {
  home:"chart", applications:"file", colleges:"school", tasks:"tasks",
  studio:"spark",focus:"clock",readiness:"check",sync:"shield",
  deadlines: "calendar",
  resources: "book",
  planner: "calendar",
  activities: "award",
  visits: "pin",
  tests: "book",
  expenses: "wallet",
  contacts: "users",
  goals: "tasks",
  "high-schools": "school",
  essays: "edit",
  scholarships: "award",
  "financial-aid": "wallet",
  documents: "folder",
  recommendations: "users",
  compare: "compare",
  questbridge: "spark",
  notes: "note",
  analytics: "chart",
  settings: "settings",
};
const activeApps = () => state.applications.filter((a) => !a.archived);
const btn = (label, action, style = "secondary", ico = "", extra = "") =>
  `<button class="btn ${style}" data-action="${action}" ${extra}>${ico ? icon(ico) : ""}${label}</button>`;
const ibtn = (name, label, action, extra = "") =>
  `<button class="icon-btn" aria-label="${h(label)}" title="${h(label)}" data-action="${action}" ${extra}>${icon(name)}</button>`;
const link = (label, url, cls = "text-link") =>
  safeUrl(url)
    ? `<a class="${cls}" href="${h(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${label}${icon("external")}</a>`
    : "";
function badge(status) {
  const cls = /Accepted|Submitted|Done|Confirmed|Complete/.test(status)
    ? "green"
    : /Progress|Requested|Ready/.test(status)
      ? "blue"
      : /Waitlist|Planning/.test(status)
        ? "amber"
        : /Rejected|Overdue/.test(status)
          ? "red"
          : "gray";
  return `<span class="badge ${cls}"><i></i>${h(status)}</span>`;
}
const initials = (name) =>
  name
    .split(/\s+/)
    .filter((w) => !["of", "the", "at", "and"].includes(w.toLowerCase()))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
const monogram = (name, size = "") =>
  `<span class="monogram ${size}" style="--tint:${["blue", "plum", "green", "ochre"][[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % 4]}">${h(initials(name))}</span>`;
function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `${icon("check")}<span>${h(message)}</span>`;
  document.querySelector("#toasts").append(el);
  setTimeout(() => el.remove(), 4200);
}
function save(renderAfter = false) {
  if (storageReadFailed) {
    toast(
      "Existing data could not be opened. Export the original data or import a backup in Settings before making changes.",
    );
    return false;
  }
  try {
    validateTools(state);
    persistState(state);
    deviceSync?.changed();
    if (renderAfter) render();
    return true;
  } catch (e) {
    toast(
      "Browser storage is full or unavailable. Export a backup, then remove a document.",
    );
    return false;
  }
}
function mutate(fn, message, renderAfter = true) {
  const before = structuredClone(state);
  fn();
  if (!save(false)) {
    state = before;
    return false;
  }
  if (renderAfter) render();
  if (message) toast(message);
  return true;
}
function navigate(path) {
  closeDialog();
  if (location.hash.slice(1) === path) {
    route = path;
    render();
  } else location.hash = path;
}
function header(title, subtitle, actions = "") {
  return `<div class="page-heading"><div><h1>${title}</h1><p>${subtitle}</p></div><div class="heading-actions">${actions}</div></div>`;
}
function empty(ico, title, text, action = "") {
  return `<div class="empty-state"><div class="empty-icon">${icon(ico)}</div><h3>${title}</h3><p>${text}</p>${action}</div>`;
}
function field(label, name, value = "", type = "text", extra = "") {
  return `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${h(value)}" ${extra}></label>`;
}
function select(label, name, options, value = "", extra = "") {
  return `<label class="field"><span>${label}</span><select name="${name}" ${extra}>${options
    .map((o) => {
      const v = Array.isArray(o) ? o[0] : o,
        t = Array.isArray(o) ? o[1] : o;
      return `<option value="${h(v)}" ${v === value ? "selected" : ""}>${h(t)}</option>`;
    })
    .join("")}</select></label>`;
}
function textarea(label, name, value = "", extra = "") {
  return `<label class="field full"><span>${label}</span><textarea name="${name}" ${extra}>${h(value)}</textarea></label>`;
}
function appSelect(value = "", label = "College") {
  return select(
    label,
    "applicationId",
    [
      ["", "General / not assigned"],
      ...activeApps().map((a) => [a.id, a.name]),
    ],
    value,
  );
}
function formDialog(
  title,
  body,
  handler,
  submitLabel = "Save changes",
  wide = false,
) {
  const id = uid();
  formHandlers.set(id, handler);
  dialog(
    `<form data-form="${id}" class="dialog-form"><div class="dialog-heading"><div><div class="eyebrow">ASCEND WORKSPACE</div><h2>${title}</h2></div>${ibtn("x", "Close dialog", "close-dialog")}</div><div class="form-grid">${body}</div><p class="form-error" role="alert"></p><div class="dialog-footer"><span class="local-label">${icon("shield")} Saved in this browser</span>${btn("Cancel", "close-dialog", "ghost")}<button class="btn primary" type="submit">${submitLabel}${icon("arrow")}</button></div></form>`,
    wide,
  );
}
function dialog(html, wide = false) {
  if(isPrivacyLocked())return;
  closeDialog();
  modalReturnFocus = document.activeElement;
  const returnFocus = modalReturnFocus;
  const returnAction = returnFocus?.dataset?.action;
  const container = document.querySelector("#dialogs");
  container.innerHTML = `<dialog class="modal ${wide ? "wide" : ""}" aria-label="Ascend dialog">${html}</dialog>`;
  const d = container.querySelector("dialog");
  d.showModal();
  d.addEventListener("click", (e) => {
    if (e.target === d) {
      const rect = d.getBoundingClientRect();
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      )
        closeDialog(true);
    }
  });
  d.addEventListener("close", () => {
    const form = d.querySelector("[data-form]");
    if (form) formHandlers.delete(form.dataset.form);
    d.remove();
    if (!container.querySelector("dialog")) {
      const target = returnFocus?.isConnected
        ? returnFocus
        : returnAction
          ? [...document.querySelectorAll("[data-action]")].find(
              (el) => el.dataset.action === returnAction,
            )
          : null;
      (target || document.querySelector("main"))?.focus?.();
    }
  });
  d.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeDialog(true);
  });
  requestAnimationFrame(() =>
    d.querySelector("input:not([type=hidden]),textarea,button")?.focus(),
  );
}
function closeDialog(animate = false) {
  const d = document.querySelector("dialog");
  if (d) {
    if (animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (d.classList.contains("closing")) return;
      d.classList.add("closing");
      setTimeout(() => {
        if (d.isConnected) {
          d.close();
          d.remove();
        }
      }, 160);
    } else {
      d.close();
      d.remove();
    }
  }
}
function confirmAction(title, text, fn) {
  formDialog(
    title,
    `<p class="full body-copy">${text}</p>`,
    () => {
      fn();
      return true;
    },
    "Confirm",
  );
}
function applyTheme() {
  const pref = APPEARANCES.some(([value]) => value === state.profile.theme)
    ? state.profile.theme
    : "light";
  document.documentElement.dataset.theme =
    pref === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : pref;
  document.documentElement.style.colorScheme =
    document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]').content =
    document.documentElement.dataset.theme === "dark"
      ? "#111722"
      : pref === "monochrome"
        ? "#e9e9e9"
        : "#ffffff";
}

function appearanceOptions() {
  const selected = state.profile.theme || "light";
  return `<div class="theme-options" role="group" aria-label="Color appearance">${APPEARANCES.map(
    ([value, ico, name, description]) =>
      `<button class="appearance-option ${selected === value ? "selected" : ""}" data-action="set-theme:${value}" aria-pressed="${selected === value}"><span class="appearance-swatch swatch-${value}" aria-hidden="true"><i></i><i></i><i></i></span><span class="appearance-label">${icon(ico)}<strong>${name}</strong>${selected === value ? icon("check") : ""}<small>${description}</small></span></button>`,
  ).join("")}</div>`;
}

function appearanceDialog() {
  dialog(
    `<div class="dialog-heading"><div><div class="eyebrow">MAKE IT YOURS</div><h2>Appearance</h2></div>${ibtn("x", "Close appearance", "close-dialog")}</div><p class="body-copy">Choose a look for your entire workspace. Your choice is saved in this browser.</p><div class="appearance-dialog">${appearanceOptions()}</div><p class="appearance-note">Black & white includes photos, calendar colors, and every workspace.</p><div class="dialog-footer">${btn("Done", "close-dialog", "primary", "check")}</div>`,
  );
}
function render() {
  if(isPrivacyLocked())return;
  applyTheme();
  const base = route.split("/")[0];
  document.title = `${pageNames[base] || "College workspace"} · Ascend`;
  const navItem = (p) => {
    const selected = base === p || (p === "applications" && base === "application") || (p === "colleges" && base === "college");
    return `<a href="#${p}" class="sidebar-link ${selected ? "active" : ""}" ${selected ? 'aria-current="page"' : ""}>${icon(pageIcons[p] || "folder")}<span>${pageNames[p]}</span>${p === "tasks" ? `<small>${state.tasks.filter(t => !t.archived && t.status !== "Done").length}</small>` : ""}</a>`;
  };
  const groups = [
    ["Workspace", ["home", "applications", "planner", "tasks", "colleges"]],
    ["Your application", ["essays", "financial-aid", "scholarships", "recommendations", "activities", "readiness"]],
    ["Plan & organize", ["studio", "focus", "documents", "notes", "deadlines", "analytics"]],
  ];
  root.innerHTML = `<aside class="app-sidebar ${mobileMenu ? "is-open" : ""}" id="mobile-navigation"><a class="brand" href="#home"><img class="brand-mark" src="./assets/ascend-mark.png" alt=""><span>ascend<span class="brand-period">.</span></span></a>${btn("Quick add", "quick-add", "primary sidebar-add", "plus")}<button class="sidebar-search" data-action="search">${icon("search")}<span>Search workspace</span><kbd>⌘ K</kbd></button><nav class="sidebar-navigation" aria-label="Main navigation">${groups.map(([label, pages]) => `<div class="sidebar-group"><span class="sidebar-label">${label}</span>${pages.map(navItem).join("")}</div>`).join("")}<details class="sidebar-extra"><summary>${icon("folder")} More tools ${icon("down")}</summary>${Object.keys(pageNames).filter(p => !groups.some(([, pages]) => pages.includes(p)) && !["settings", "sync"].includes(p)).map(navItem).join("")}</details></nav><div class="sidebar-bottom"><a href="#sync" class="sidebar-sync">${icon("shield")}<span>Private workspace<small>Local storage · optional sync</small></span>${icon("arrow")}</a><div class="sidebar-profile"><button class="avatar" data-action="profile" aria-label="Your profile">${h(state.profile.name ? initials(state.profile.name) : "Y")}</button><button class="sidebar-profile-name" data-action="profile"><strong>${h(state.profile.name || "Your workspace")}</strong><small>Personal planner</small></button><a href="#settings" class="icon-btn" aria-label="Settings">${icon("settings")}</a></div></div></aside>${mobileMenu ? '<button class="sidebar-backdrop" data-action="mobile-menu" aria-label="Close navigation"></button>' : ""}<header class="workspace-topbar"><div class="workspace-topbar-title">${ibtn("menu", "Open navigation", "mobile-menu", `aria-controls="mobile-navigation" aria-expanded="${mobileMenu}"`)}<div><span class="workspace-context">MY WORKSPACE</span><strong>${pageNames[base] || "College workspace"}</strong></div></div><div class="workspace-topbar-actions">${ibtn("search", "Search everything (Ctrl+K)", "search")}${ibtn("bell", "Notifications", "notifications")}${ibtn(document.documentElement.dataset.theme === "dark" ? "moon" : "sun", "Change appearance", "theme")}<a class="btn secondary topbar-planner" href="#planner">${icon("calendar")} Planner</a>${btn("Add new", "quick-add", "primary", "plus")}</div></header><div class="app-content"><main id="main" data-page="${base}" tabindex="-1">${storageReadFailed ? `<div class="recovery-banner"><strong>Your saved workspace needs attention.</strong><p>It has been preserved. Download the original data before importing a backup or resetting.</p>${btn("Download original data", "export-original", "secondary", "download")}${btn("Open recovery settings", "nav:settings", "ghost")}</div>` : ""}${renderPage()}</main><footer class="site-footer"><span>Ascend · Your next chapter, in focus.</span><a href="#sync">${icon("shield")} Private workspace</a></footer></div>`;
  if (["colleges", "high-schools", "compare", "college"].includes(base))
    loadDirectory(base === "high-schools" ? "high-schools" : "colleges");
  if (base === "essays") connectEditor();
  if (base === "colleges" || base === "college") hydrateCollegeMedia();
  if (loadError) {
    toast(
      `Saved data could not be opened: ${loadError}. Your existing storage has been preserved.`,
    );
    loadError = "";
  }
}
function renderPage() {
  const [base, id] = route.split("/");
  if (base === "sync") return deviceSync.page();
  if (base === "planner") return planner.page(id);
  const toolPage = studio.renderPage(base);
  if (toolPage !== null) return toolPage;
  const extraPage = extras.renderPage(base);
  if (extraPage !== null) return extraPage;
  switch (base) {
    case "home":
      return dashboard();
    case "applications":
      return applicationsPage();
    case "application":
      return applicationWorkspace(id);
    case "colleges":
    case "high-schools":
      directoryKind = base;
      return directoryPage();
    case "college":
      return collegeProfile(id);
    case "tasks":
      return tasksPage();
    case "deadlines":
      return deadlinesPage();
    case "essays":
      return essaysPage();
    case "documents":
      return documentsPage();
    case "resources":
      return resourcesPage();
    case "recommendations":
    case "scholarships":
    case "financial-aid":
    case "notes":
      return recordsPage(base);
    case "compare":
      return comparePage();
    case "questbridge":
      return questbridgePage();
    case "analytics":
      return analyticsPage();
    case "settings":
      return settingsPage();
    default:
      return dashboard();
  }
}
function dashboard() {
  return homePage({ state, btn, missionFilter, missionPhaseFilter });
}
function filterTabs(compact = false) {
  const values = compact
    ? ["All", "In Progress", "Submitted", "Accepted"]
    : APPLICATION_TABS;
  const prefix = compact ? "home-apps" : "applications";
  return `<div class="filter-tabs ${compact ? "compact" : "application-status-tabs"}" role="tablist" aria-label="Application views">${values.map((s, i) => `<button id="${prefix}-tab-${i}" role="tab" aria-selected="${appFilter === s}" aria-controls="${prefix}-results" tabindex="${appFilter === s || (!values.includes(appFilter) && i === 0) ? 0 : -1}" class="${appFilter === s ? "selected" : ""}" data-action="app-filter:${s}">${s}<span>${state.applications.filter((a) => matchesApplicationView(a, s)).length}</span></button>`).join("")}</div>`;
}
function filteredApps() {
  return state.applications
    .filter(
      (a) =>
        matchesApplicationView(a, appFilter) &&
        [a.name, a.major, a.round]
          .join(" ")
          .toLowerCase()
          .includes(appQuery.toLowerCase()),
    )
    .sort((a, b) =>
      appSort === "name"
        ? a.name.localeCompare(b.name)
        : appSort === "deadline"
          ? (a.deadline || "9999").localeCompare(b.deadline || "9999")
          : appSort === "progress"
            ? progress(b) - progress(a)
            : 0,
    );
}
function applicationsTable(home = false) {
  let list = filteredApps();
  if (home) list = list.slice(0, 5);
  const panelAttributes = `id="${home ? "home-apps" : "applications"}-results" role="tabpanel" aria-label="${h(appFilter)} applications"`;
  if (!list.length)
    return `<div ${panelAttributes}>` + empty(
      "school",
      activeApps().length ? (appFilter === "Complete" && !appQuery ? "No completed checklists yet" : "No matching applications") : "No applications yet",
      activeApps().length
        ? (appFilter === "Complete" && !appQuery ? "Applications appear here when every required checklist item is done. Try opening another tab to keep working on them." : "Try another status tab or clear your search to see more applications.")
        : "Add a college to track its requirements and deadlines.",
      activeApps().length ? btn("View all applications", "reset-app-filters", "secondary", "arrow") : btn(
        "Add your first application",
        "add-application",
        "secondary",
        "plus",
      ) +
        '<a href="#colleges" class="text-link">Explore colleges ' +
        icon("arrow") +
        "</a>",
    ) + "</div>";
  return `<div ${panelAttributes} class="application-table"><div class="table-labels"><span>COLLEGE & CHECKLIST PROGRESS</span><span>INTENDED MAJOR</span><span>STATUS</span><span>NEXT DEADLINE</span><span></span></div>${list.map((a) => {
    const checklist = applicationChecklist(a);
    return `<div class="application-row"><a href="#application/${a.id}" class="college-cell">${monogram(a.name)}<span><strong>${h(a.name)}</strong><small>${h(a.round || "Round not set")}</small><span class="application-checklist ${checklist.complete ? "is-complete" : ""}"><span class="application-progress-label"><b>${checklist.percent}%</b><span>${checklist.total ? `${checklist.done}/${checklist.total} required${checklist.complete ? " · Complete" : ""}` : "No required items yet"}</span></span><progress class="application-progress-bar" value="${checklist.percent}" max="100" aria-label="${h(a.name)} required checklist progress">${checklist.percent}%</progress></span></span></a><span class="major-cell"><span>${h(a.major || "Major to explore")}</span></span><span>${badge(a.status)}</span><span class="deadline-cell">${a.deadline ? `<small class="${daysUntil(a.deadline) < 0 ? "danger-text" : ""}">${dueLabel(a.deadline)}</small><strong>${dateLabel(a.deadline, true)}</strong>` : "<small>Verify the official date</small><strong>No deadline set</strong>"}</span><span class="row-actions"><a class="icon-btn" aria-label="Open ${h(a.name)} workspace" href="#application/${a.id}">${icon("arrow")}</a>${ibtn("more", `Actions for ${a.name}`, `app-menu:${a.id}`)}</span></div>`;
  }).join("")}</div>${home && filteredApps().length > 5 ? '<a class="table-footer-link" href="#applications">View all applications ' + icon("arrow") + "</a>" : ""}`;
}
function applicationsPage() {
  return (
    header(
      "Applications",
      "One workspace for every school on your list.",
      btn("Add application", "add-application", "primary", "plus"),
    ) +
    `<section class="panel applications-list-panel">${filterTabs()}<p class="application-view-hint">Complete = every required checklist item done. Submitted applications can still have items to finish.</p><div class="toolbar"><label class="search-field">${icon("search")}<input id="app-search" placeholder="Find an application…" value="${h(appQuery)}" aria-label="Find an application"></label><select id="app-status" aria-label="Filter applications">${["All", ...STATUSES, "Complete", "Archived"].map((s) => `<option ${s === appFilter ? "selected" : ""}>${s}</option>`).join("")}</select><select id="app-sort" aria-label="Sort applications">${[
      ["added", "Added order"],
      ["name", "College name"],
      ["deadline", "Deadline"],
      ["progress", "Progress"],
    ]
      .map(
        ([v, label]) =>
          `<option value="${v}" ${appSort === v ? "selected" : ""}>${label}</option>`,
      )
      .join(
        "",
      )}</select><span id="app-results-count" class="muted" role="status">${filteredApps().length} of ${state.applications.filter((a) => appFilter === "Archived" ? a.archived : !a.archived).length} applications</span></div>${applicationsTable()}</section>`
  );
}
function addApplication(college = null, existing = null) {
  const a = existing || {
    name: college?.name || "",
    major: state.profile.major,
    status: "Not Started",
    round: "Regular Decision",
    pathway: "Common Application",
    deadline: "",
    deadlineTime: "23:59",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    url: college?.url || "",
  };
  formDialog(
    existing ? "Edit application" : "Add application",
    `${field("College name", "name", a.name, "text", 'required maxlength="160" list="college-names"')}<datalist id="college-names">${(
      directories.colleges?.records || []
    )
      .slice(0, 600)
      .map((c) => `<option>${h(c.name)}</option>`)
      .join(
        "",
      )}</datalist>${field("Intended major", "major", a.major, "text", 'maxlength="120"')}${select("Application status", "status", STATUSES, a.status)}${select("Application round", "round", ROUNDS, a.round)}${select("Application pathway", "pathway", PATHWAYS, a.pathway)}${field("Your deadline (verify with college)", "deadline", a.deadline, "date")}${field("Deadline time", "deadlineTime", a.deadlineTime, "time")}${select("Deadline time zone", "timezone", timezones(a.timezone), a.timezone)}${field("Official website / portal link", "url", a.url, "text", 'placeholder="https://…" maxlength="500"')}${textarea("Private notes", "notes", a.notes || "")}`,
    (values) => {
      if (!validTimezone(values.timezone))
        throw new Error("Choose a valid time zone.");
      const record = existing || {
        id: uid(),
        collegeId: college?.id || null,
        created: Date.now(),
        requirements: [],
        statusHistory: [],
      };
      if (record.status !== values.status)
        record.statusHistory.push({
          status: values.status,
          at: new Date().toISOString(),
        });
      if (
        !mutate(
          () => {
            Object.assign(record, values);
            if (!existing) state.applications.push(record);
          },
          existing ? "Application updated" : "A new possibility, saved.",
        )
      )
        return false;
      if (!existing) navigate(`application/${record.id}`);
      return true;
    },
    existing ? "Save changes" : "Add application",
    true,
  );
}
function timezones(current) {
  return [
    ...new Set(
      [
        current,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        "America/New_York",
        "America/Chicago",
        "America/Denver",
        "America/Los_Angeles",
        "America/Anchorage",
        "Pacific/Honolulu",
        "UTC",
      ].filter(Boolean),
    ),
  ];
}
function validTimezone(zone) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
function applicationWorkspace(id) {
  const a = state.applications.find((a) => a.id === id);
  if (!a)
    return empty(
      "school",
      "This application isn’t here.",
      "It may have been removed.",
      btn("View applications", "nav:applications"),
    );
  const p = progress(a);
  return `<a class="back-link" href="#applications">${icon("arrow")}All applications</a><div class="workspace-heading">${monogram(a.name, "large")}<div><div class="eyebrow">${h(a.pathway || "YOUR COLLEGE WORKSPACE")}</div><h1>${h(a.name)}</h1><p>${h(a.major || "A major to explore")} <span>·</span> ${h(a.round)}</p></div>${btn("Edit application", `edit-application:${id}`, "secondary", "edit")}</div><div class="workspace-summary"><span>${badge(a.status)}<small>Manually confirmed by you</small></span><span>${icon("calendar")}<strong>${dateLabel(a.deadline, true)}</strong><small>${a.deadline ? (a.deadlineTime ? h(`${a.deadlineTime} ${a.timezone || ""}`) : "Cutoff time not verified") : "Set your deadline in Edit application"}</small></span><span class="summary-progress"><strong>${p}% complete</strong><span class="progress-track"><i style="width:${p}%"></i></span><small>Based on your required checklist items</small></span></div><div class="workspace-tabs" role="tablist">${SECTIONS.map((t) => `<button role="tab" aria-selected="${workspaceTab === t}" class="${workspaceTab === t ? "selected" : ""}" data-action="workspace-tab:${t}">${t}</button>`).join("")}</div><section class="panel workspace-content">${workspaceBody(a)}</section>`;
}
function workspaceBody(a) {
  switch (workspaceTab) {
    case "Overview":
      return `<div class="two-columns"><div><div class="panel-heading"><h2>A plan for ${h(a.name.split(" ")[0])}.</h2></div><p class="body-copy">Keep your requirements, writing, and next steps together. You decide what’s needed, and Ascend keeps track of your progress.</p><div class="detail-list"><div><span>Application round</span><strong>${h(a.round)}</strong></div><div><span>Application pathway</span><strong>${h(a.pathway)}</strong></div><div><span>Deadline</span><strong>${dateLabel(a.deadline, true)}</strong></div><div><span>Requirements completed</span><strong>${a.requirements.filter((r) => r.done && !r.exempt).length} of ${a.requirements.filter((r) => !r.exempt).length}</strong></div></div>${a.url ? link("Open official website", a.url, "btn secondary") : ""}</div><div class="soft-box"><span class="eyebrow">YOUR NEXT STEP</span><h3>${a.requirements.find((r) => !r.done && !r.exempt)?.title || "Make your own checklist."}</h3><p>Requirements are personal to this application. Check the college’s official site before adding them.</p>${btn("Open requirements", "workspace-tab:Requirements", "secondary", "tasks")}<div class="info-note">${icon("shield")}Your changes here don’t submit anything to a college.</div></div></div>`;
    case "Requirements":
      return `<div class="panel-heading"><div><h2>Application requirements</h2><p>${progress(a)}% of required weight complete. Optional and exempt items are excluded.</p></div><div class="button-group">${!a.requirements.length ? btn("Use starter checklist", `starter-requirements:${a.id}`, "ghost", "plus") : ""}${btn("Add requirement", `add-requirement:${a.id}`, "secondary", "plus")}</div></div>${a.requirements.length ? `<div class="checklist">${a.requirements.map((r) => `<div class="checklist-row"><input type="checkbox" aria-label="Complete ${h(r.title)}" data-requirement="${r.id}" data-app="${a.id}" ${r.done ? "checked" : ""} ${r.exempt ? "disabled" : ""}><div><strong class="${r.done ? "completed-text" : ""}">${h(r.title)}</strong><small>${r.exempt ? "Not applicable" : r.required === false ? "Optional" : `Required · weight ${r.weight || 1}`}${r.doneAt ? ` · Completed ${dateLabel(r.doneAt)}` : ""}${r.dependsOn ? ` · After ${h(a.requirements.find((x) => x.id === r.dependsOn)?.title || "removed item")}` : ""}</small></div>${ibtn("edit", "Edit requirement", `edit-requirement:${a.id}/${r.id}`)}${ibtn("trash", "Delete requirement", `delete-requirement:${a.id}/${r.id}`)}</div>`).join("")}</div>` : empty("tasks", "A checklist that fits your application.", "Add your own requirements or customize a starter checklist. Nothing is assumed to be required.")}`;
    case "Essays":
      return essayList(a.id);
    case "Recommendations":
      return recordsBody("recommendations", a.id);
    case "Documents":
      return documentsBody(a.id);
    case "Financial Aid":
      return recordsBody("financial-aid", a.id);
    case "Notes":
      return `<div class="panel-heading"><div><h2>Your thoughts, kept together.</h2><p>Private notes for this college. Changes save automatically.</p></div></div><textarea class="notes-editor" aria-label="College notes" data-app-notes="${a.id}" placeholder="Campus visit thoughts, questions, things that matter to you…">${h(a.notes || "")}</textarea>`;
    case "Decision":
      return `<div class="two-columns"><div><h2>The next chapter.</h2><p class="body-copy">Record a decision when you hear from the college. This is your personal record.</p><div class="detail-list"><div><span>Your recorded outcome</span>${badge(a.decision || "Not recorded")}</div><div><span>Decision date</span><strong>${dateLabel(a.decisionDate, true)}</strong></div></div>${btn("Record a decision", `record-decision:${a.id}`, "secondary", "edit")}</div><div class="soft-box"><span class="eyebrow">ROOM FOR EVERYTHING</span><h3>There’s more than one way forward.</h3><p>Every outcome is part of your story. Keep your options and financial aid offers together as you find your path.</p><a class="text-link" href="#financial-aid">View financial aid ${icon("arrow")}</a></div></div>`;
  }
}
function requirementForm(app, id) {
  const r = app.requirements.find((r) => r.id === id) || {
    title: "",
    required: true,
    weight: 1,
    exempt: false,
    dependsOn: "",
  };
  formDialog(
    id ? "Edit requirement" : "Add requirement",
    `${field("Requirement", "title", r.title, "text", 'required maxlength="180"')}${field("Weight", "weight", r.weight, "number", 'min="1" max="100" required')}${select(
      "Include in progress",
      "required",
      [
        ["true", "Required"],
        ["false", "Optional"],
      ],
      String(r.required),
    )}${select(
      "Applicability",
      "exempt",
      [
        ["false", "Applicable"],
        ["true", "Not applicable"],
      ],
      String(r.exempt),
    )}${select("Complete after", "dependsOn", [["", "No dependency"], ...app.requirements.filter((x) => x.id !== id).map((x) => [x.id, x.title])], r.dependsOn)}`,
    (v) => {
      // Reject circular dependencies before saving an unusable checklist.
      const seen = new Set(id ? [id] : []);
      let next = v.dependsOn;
      while (next) {
        if (seen.has(next))
          throw new Error("Choose a dependency that doesn’t create a loop.");
        seen.add(next);
        next = app.requirements.find((item) => item.id === next)?.dependsOn;
      }
      return mutate(() => {
        Object.assign(r, v, {
          weight: Number(v.weight),
          required: v.required === "true",
          exempt: v.exempt === "true",
        });
        if (!id) {
          r.id = uid();
          app.requirements.push(r);
        }
      }, "Requirement saved");
    },
  );
}
function eventRow(e) {
  const d = parseDate(e.date);
  return `<a class="event-row" href="#${e.target}"><span class="event-date"><small>${d.toLocaleDateString(undefined, { month: "short" })}</small><strong>${d.getDate()}</strong></span><span><strong>${h(e.title)}</strong><small>${h(e.kind)}${e.time ? ` · ${h(e.time)} ${h(e.zone || "")}` : ""}</small></span><span class="due-text ${daysUntil(e.date) < 0 ? "danger-text" : ""}">${dueLabel(e.date)}</span>${icon("arrow")}</a>`;
}
async function loadDirectory(kind) {
  if (directories[kind] || directoryLoading[kind] || directoryErrors[kind])
    return;
  directoryLoading[kind] = true;
  try {
    const r = await fetch(`./data/${kind}.json`);
    if (!r.ok)
      throw new Error(
        "The school directory is unavailable. You can still add a school manually.",
      );
    const data = await r.json();
    if (!Array.isArray(data.records))
      throw new Error("Directory format could not be read.");
    directories[kind] = data;
  } catch (e) {
    directoryErrors[kind] = e.message;
  } finally {
    directoryLoading[kind] = false;
    if (
      ["colleges", "high-schools", "college", "compare"].includes(
        route.split("/")[0],
      )
    )
      render();
  }
}
function schoolRecords(kind = directoryKind) {
  return [
    ...(directories[kind]?.records || []),
    ...(kind === "colleges" ? state.customColleges : state.customSchools),
  ];
}
function directoryPage() {
  const colleges = directoryKind === "colleges",
    data = directories[directoryKind];
  return (
    header(
      colleges ? "College directory" : "High school directory",
      colleges
        ? "Find a place for your curiosity, ambition, and everything you are."
        : "Find your high school and make it part of your profile.",
      btn("Add a school manually", "manual-school", "secondary", "plus"),
    ) +
    `<section class="panel directory-panel"><div class="toolbar"><label class="search-field grow">${icon("search")}<input id="directory-search" value="${h(directoryQuery)}" placeholder="${colleges ? "Search colleges, cities, or states…" : "Search by school name, city, or ZIP…"}" aria-label="Search school directory"></label><select id="directory-state" aria-label="Filter by state"><option value="">All states</option>${[
      ...new Set(
        schoolRecords()
          .map((c) => c.state)
          .filter(Boolean),
      ),
    ]
      .sort()
      .map(
        (s) =>
          `<option ${s === directoryState ? "selected" : ""}>${h(s)}</option>`,
      )
      .join(
        "",
      )}</select><select id="directory-type" aria-label="Filter by institution type"><option value="">All types</option>${[
      ...new Set(
        schoolRecords()
          .map((c) => c.type)
          .filter(Boolean),
      ),
    ]
      .sort()
      .map(
        (s) =>
          `<option ${s === directoryType ? "selected" : ""}>${h(s)}</option>`,
      )
      .join(
        "",
      )}</select>${colleges ? `<button class="btn ${savedOnly ? "selected" : "ghost"}" data-action="saved-schools">${icon("heart")}Saved</button>` : ""}</div>${directoryKind === "colleges" ? advancedDirectoryControls() : ""}<div id="directory-results">${directoryResults()}</div></section><div class="source-note">${icon("book")}<span>${data ? `${schoolRecords().length.toLocaleString()} institutions · ${h(data.source)} · ${h(data.year)}. ${link("Source & coverage", data.sourceUrl)}<br>Published directory snapshot. Statistics may be unavailable; confirm application requirements on the official school website.` : "Official directory files are bundled with Ascend. Personal records are stored separately in your browser."}</span></div>`
  );
}
function directoryResults() {
  const data = directories[directoryKind];
  if (!data && !directoryErrors[directoryKind])
    return `<div class="loading-skeleton" role="status">Loading the school directory from the app…<i></i><i></i><i></i></div>`;
  if (directoryErrors[directoryKind])
    return empty(
      "school",
      "Your school is still a possibility.",
      h(directoryErrors[directoryKind]),
      btn("Add a school manually", "manual-school"),
    );
  let results = schoolRecords().filter(
    (c) =>
      (!directoryState || c.state === directoryState) &&
      (!directoryType || c.type === directoryType) &&
      (!savedOnly || state.favorites.includes(c.id)) &&
      (!directoryQuery || fuzzyMatch(directoryQuery, c)) &&
      (directoryKind !== "colleges" || matchesAdvanced(c)),
  );
  if (directoryQuery)
    results.sort(
      (a, b) => searchRank(directoryQuery, b) - searchRank(directoryQuery, a),
    );
  const colleges = directoryKind === "colleges";
  if (colleges && !directoryQuery && !savedOnly)
    results.sort((a, b) => {
      const i = featuredCollegeIds.indexOf(a.id),
        j = featuredCollegeIds.indexOf(b.id);
      return (i < 0 ? 999 : i) - (j < 0 ? 999 : j);
    });
  return `<div class="results-caption"><span>${results.length.toLocaleString()} ${colleges ? "colleges" : "schools"}${results.length > 60 ? " · Showing the first 60. Narrow your search to see more." : ""}</span>${colleges ? `<a class="text-link" href="#compare">Compare schools (${state.compare.length}) ${icon("arrow")}</a>` : ""}</div>${
    results.length
      ? `<div class="college-grid">${results
          .slice(0, 60)
          .map(
            (c) =>
              `<article class="college-card ${colleges ? "with-campus" : ""}">${colleges ? collegeCardMedia(c) : ""}<div class="college-card-top">${monogram(c.name)}${colleges ? ibtn("heart", state.favorites.includes(c.id) ? "Unsave college" : "Save college", `favorite:${c.id}`, `aria-pressed="${state.favorites.includes(c.id)}"`) : ""}</div><${colleges ? "a" : "div"} ${colleges ? `href="#college/${c.id}"` : ""} class="college-title"><h3>${h(c.name)}</h3></${colleges ? "a" : "div"}><p class="school-location">${icon("pin")}${h([c.city, c.state].filter(Boolean).join(", "))}</p><div class="college-details"><span>${h(c.type || "Type unavailable")}</span><span>${h(c.level || c.grades || "")}</span></div><div class="college-card-footer">${colleges ? `<a class="text-link" href="#college/${c.id}">View profile ${icon("arrow")}</a>${btn("Add to list", `add-college:${c.id}`, "ghost", "plus")}${ibtn("compare", "Add to compare", `compare-add:${c.id}`, `aria-pressed="${state.compare.includes(c.id)}"`)}` : btn("Select school", `select-school:${c.id}`, "secondary", "check")}</div></article>`,
          )
          .join("")}</div>`
      : empty(
          "search",
          "Let’s try a different search.",
          "Try the full school name, a nearby city, or remove a filter.",
          btn("Reset filters", "reset-directory", "secondary"),
        )
  }`;
}
function collegeProfile(id) {
  const c = schoolRecords("colleges").find((x) => x.id === id);
  if (!c)
    return directories.colleges
      ? empty(
          "school",
          "We couldn’t find this college.",
          "Search the directory or add it manually.",
          btn("Explore colleges", "nav:colleges"),
        )
      : '<div class="loading-skeleton">Loading college profile…</div>';
  const facts = [
    ["Institution type", c.type],
    ["Degree level", c.level],
    ["Undergraduates · fall 2024", c.enrollment?.toLocaleString()],
    [
      "In-state tuition & fees · 2025–26",
      c.tuitionIn != null ? money(c.tuitionIn) : null,
    ],
    [
      "Out-of-state tuition & fees · 2025–26",
      c.tuitionOut != null ? money(c.tuitionOut) : null,
    ],
    [
      "Admission rate · fall 2024",
      c.admissionRate != null ? `${(c.admissionRate * 100).toFixed(1)}%` : null,
    ],
    [
      "Graduation rate · 150% normal time",
      c.graduationRate != null
        ? `${(c.graduationRate * 100).toFixed(1)}%`
        : null,
    ],
  ];
  const factsMarkup = (rows) =>
    '<dl class="college-fact-list">' +
    rows
      .map(
        ([label, value]) =>
          "<div><dt>" +
          h(label) +
          "</dt><dd>" +
          h(value ?? "Not available") +
          "</dd></div>",
      )
      .join("") +
    "</dl>";
  return (
    '<a class="back-link" href="#colleges">' +
    icon("arrow") +
    "Explore colleges</a>" +
    collegeHero(c) +
    '<div class="college-profile-heading"><div><div class="eyebrow">COLLEGE PROFILE</div><h1>' +
    h(c.name) +
    "</h1><p>" +
    h([c.city, c.state].filter(Boolean).join(", ")) +
    " · " +
    h(c.type || "Type unavailable") +
    '</p></div><div class="button-group">' +
    btn("Add application", "add-college:" + id, "primary", "plus") +
    btn(
      state.favorites.includes(id) ? "Saved" : "Save college",
      "favorite:" + id,
      "secondary",
      "heart",
    ) +
    btn("Compare", "compare-add:" + id, "secondary", "compare") +
    '</div></div><div class="college-overview-facts">' +
    facts
      .slice(2, 6)
      .map(
        ([label, value]) =>
          "<div><span>" +
          label +
          "</span><strong>" +
          h(value || "Not available") +
          "</strong></div>",
      )
      .join("") +
    '</div><section class="panel college-sections"><details open><summary>About the university<span>Overview and background</span></summary><div class="college-section-body">' +
    collegeAbout(c) +
    '</div></details><details open><summary>Tuition and financial aid<span>Published costs, official aid resources</span></summary><div class="college-section-body">' +
    factsMarkup(facts.slice(3, 5)) +
    '<p class="muted">Annual undergraduate tuition and required fees, reported for 2025–26. Living expenses, books, travel, and financial aid are excluded. Your actual cost may differ.</p><div class="profile-links">' +
    link("Financial aid office", c.financialAidUrl || "") +
    link("Net price calculator", c.netPriceCalculatorUrl || "") +
    '</div></div></details><details><summary>Admissions and student outcomes<span>Application resources and reported statistics</span></summary><div class="college-section-body">' +
    factsMarkup(facts.slice(5)) +
    '<div class="profile-links">' +
    link("Admissions office", c.admissionsUrl || "") +
    link("Official application", c.applicationUrl || "") +
    '</div><p class="muted">Admission rates describe past applicants. They do not estimate your chances. Graduation rates cover first-time, full-time students at 150% of normal time: the 2019 entering cohort for four-year colleges and 2022 for shorter programs, reported in 2025–26. Confirm current requirements, programs, and deadlines on the official website.</p></div></details><details><summary>Campus and institution<span>Location, enrollment, and degree information</span></summary><div class="college-section-body">' +
    factsMarkup([
      ...facts.slice(0, 3),
      ["Campus setting", c.campusSetting],
      [
        "Address",
        [c.address, c.city, c.state, c.zip].filter(Boolean).join(", "),
      ],
      [
        "Undergraduate programs",
        c.undergraduate === true
          ? "Available"
          : c.undergraduate === false
            ? "Not offered"
            : null,
      ],
      [
        "Graduate programs",
        c.graduate === true
          ? "Available"
          : c.graduate === false
            ? "Not offered"
            : null,
      ],
      ["NCES institution ID", id],
    ]) +
    '<div class="profile-links">' +
    link("Official website", c.url || "") +
    link(
      "College Navigator",
      "https://nces.ed.gov/collegenavigator/?id=" +
        encodeURIComponent(id.replace(/^\D+/, "")),
    ) +
    '</div></div></details><details><summary>Your research notes<span>Private notes saved in this browser</span></summary><div class="college-section-body"><textarea class="notes-editor" data-college-notes="' +
    id +
    '" aria-label="College research notes" placeholder="Programs to explore, campus impressions, questions to ask…">' +
    h(state.notes.find((n) => n.collegeId === id)?.body || "") +
    '</textarea></div></details><details><summary>Sources and photo credits<span>Reporting periods and image attribution</span></summary><div class="college-section-body"><p>' +
    h(directories.colleges?.source || "Manually added institution") +
    " · " +
    h(directories.colleges?.year || "User record") +
    ". Missing values are shown as unavailable.</p>" +
    collegeCredits(c) +
    '<p class="muted">Public descriptions and photos are retrieved from Wikipedia and Wikimedia Commons where an institution match can be verified. Photos may be unavailable offline. Personal workspace data is never included in those requests.</p></div></details></section>'
  );
}
function manualSchool() {
  formDialog(
    "Add a school.",
    `${field("School name", "name", "", "text", 'required maxlength="180"')}${field("City", "city", "", "text", 'required maxlength="100"')}${field("State / territory", "state", "", "text", 'required maxlength="2" placeholder="NY"')}${select("School type", "type", directoryKind === "colleges" ? ["Public", "Private nonprofit", "Private for-profit", "Other"] : ["Public", "Private", "Charter", "Other"])}${field("ZIP code", "zip", "", "text", 'maxlength="10"')}${field("Official website (optional)", "url", "", "text", 'maxlength="500"')}`,
    (v) =>
      mutate(() => {
        v.id = `custom-${uid()}`;
        v.state = v.state.toUpperCase();
        v.source = "Manually added by you";
        state[
          directoryKind === "colleges" ? "customColleges" : "customSchools"
        ].push(v);
      }, "School added to your local directory"),
  );
}
function tasksPage() {
  const list = state.tasks.filter(
    (t) =>
      (taskFilter === "Archived" ? t.archived : !t.archived) &&
      (taskFilter === "All" ||
        taskFilter === "Archived" ||
        (taskFilter === "Overdue"
          ? t.due && daysUntil(t.due) < 0 && t.status !== "Done"
          : t.status === taskFilter)) &&
      (taskPriority === "All" || t.priority === taskPriority) &&
      (!taskCollege || t.applicationId === taskCollege),
  );
  return (
    header(
      "Tasks",
      "Manage your next steps in a list, board, or calendar.",
      btn("Create task", "add-task", "primary", "plus"),
    ) +
    `<section class="panel"><div class="toolbar"><div class="view-switch">${["List", "Board", "Calendar"].map((v) => `<button data-action="task-view:${v}" class="${taskView === v ? "selected" : ""}">${icon(v === "Calendar" ? "calendar" : v === "Board" ? "compare" : "tasks")}${v}</button>`).join("")}</div><select id="task-filter" aria-label="Filter task status">${["All", "To do", "In Progress", "Done", "Overdue", "Archived"].map((v) => `<option ${v === taskFilter ? "selected" : ""}>${v}</option>`).join("")}</select><select id="task-priority" aria-label="Filter task priority">${["All", "High", "Medium", "Low"].map((v) => `<option ${v === taskPriority ? "selected" : ""} value="${v}">${v === "All" ? "All priorities" : v}</option>`).join("")}</select><select id="task-college" aria-label="Filter by college"><option value="">All colleges</option>${activeApps()
      .map(
        (a) =>
          `<option value="${a.id}" ${a.id === taskCollege ? "selected" : ""}>${h(a.name)}</option>`,
      )
      .join("")}</select></div>${
      taskView === "Calendar"
        ? calendarMarkup(
            list
              .filter((t) => t.due)
              .map((t) => ({
                id: t.id,
                title: t.title,
                date: t.due,
                kind: "Task",
                target: "tasks",
              })),
          )
        : !list.length
          ? empty(
              "tasks",
              "A fresh page for your plans.",
              "Add a task, choose a date, and take it one small step at a time.",
              btn("Create your first task", "add-task", "secondary", "plus"),
            )
          : taskView === "Board"
            ? `<div class="kanban">${["To do", "In Progress", "Done"]
                .map(
                  (s) =>
                    `<div class="kanban-column" data-drop-status="${s}"><div class="kanban-heading"><h3>${s}</h3><span>${list.filter((t) => t.status === s).length}</span></div>${list
                      .filter((t) => t.status === s)
                      .map((t) => taskCard(t, true))
                      .join("")}</div>`,
                )
                .join("")}</div>`
            : `<div class="bulk-toolbar"><span>Drag tasks to reorder</span>${btn("Complete selected", "bulk-complete", "ghost", "check")}${btn("Delete selected", "bulk-delete", "ghost", "trash")}</div><div class="task-list">${list.map((t) => taskCard(t)).join("")}</div>`
    }</section>`
  );
}
function taskCard(t, board = false) {
  const app = state.applications.find((a) => a.id === t.applicationId);
  return `<div class="task-card ${board ? "board-card" : ""}" draggable="true" data-drag-id="${t.id}" data-drop-task="${t.id}">${!board ? `<input type="checkbox" class="bulk-check" value="${t.id}" aria-label="Select ${h(t.title)}"><span class="drag-grip" aria-hidden="true">${icon("grip")}</span>` : ""}<button class="task-check ${t.status === "Done" ? "checked" : ""}" data-action="complete-task:${t.id}" aria-label="${t.status === "Done" ? "Reopen" : "Complete"} ${h(t.title)}">${t.status === "Done" ? icon("check") : ""}</button><div class="task-info"><button class="task-title ${t.status === "Done" ? "completed-text" : ""}" data-action="edit-task:${t.id}">${h(t.title)}</button><div class="task-meta">${app ? `<span>${h(app.name)}</span>` : "<span>Personal task</span>"}${t.due ? `<span class="${daysUntil(t.due) < 0 && t.status !== "Done" ? "danger-text" : ""}">${dateLabel(t.due)} · ${dueLabel(t.due)}</span>` : ""}${t.recurrence && t.recurrence !== "Never" ? `<span>↻ ${h(t.recurrence)}</span>` : ""}${t.subtasks?.length ? `<span>${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length} steps</span>` : ""}</div></div><span class="priority ${t.priority?.toLowerCase()}">${h(t.priority || "Medium")}</span>${ibtn("edit", "Edit task", `edit-task:${t.id}`)}</div>`;
}
function taskForm(id) {
  const t = state.tasks.find((t) => t.id === id) || {
    title: "",
    applicationId: "",
    due: "",
    time: "",
    priority: "Medium",
    status: "To do",
    recurrence: "Never",
    notes: "",
    subtasks: [],
  };
  formDialog(
    id ? "Edit task" : "Create task",
    `${field("What needs doing?", "title", t.title, "text", 'required maxlength="200"')}${appSelect(t.applicationId)}${select("Task type", "category", ["General", "Portal setup", "Application work", "Financial aid", "Follow-up", "Final review"], t.category || "General")}${field("Due date", "due", t.due, "date")}${field("Due time (optional)", "time", t.time, "time")}${select("Priority", "priority", ["Low", "Medium", "High"], t.priority)}${select("Status", "status", ["To do", "In Progress", "Done"], t.status)}${select("Repeat", "recurrence", ["Never", "Daily", "Weekly", "Monthly"], t.recurrence)}${select("Time zone", "timezone", timezones(t.timezone), t.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone)}${textarea("Subtasks (one per line; use [x] for completed)", "subtaskText", (t.subtasks || []).map((s) => `${s.done ? "[x] " : ""}${s.title}`).join("\n"))}${textarea("Notes & links", "notes", t.notes)}`,
    (v) =>
      mutate(() => {
        const r = id ? t : { id: uid(), created: Date.now() };
        const subtasks = v.subtaskText
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean)
          .map((x) => ({
            id: uid(),
            title: x.replace(/^\[x\]\s*/i, ""),
            done: /^\[x\]/i.test(x),
          }));
        delete v.subtaskText;
        Object.assign(r, v, { subtasks });
        transitionTask(r, v.status);
        if (!id) state.tasks.push(r);
      }, "Task saved"),
    id ? "Save changes" : "Create task",
    true,
  );
  if (id)
    document
      .querySelector(".form-grid")
      .insertAdjacentHTML(
        "beforeend",
        `<div class="full button-group">${btn(t.archived ? "Restore task" : "Archive task", `archive-task:${id}`, "ghost", "archive")}${btn("Delete task", `delete-task:${id}`, "danger", "trash")}</div>`,
      );
}
function completeTask(id) {
  const t = state.tasks.find((t) => t.id === id);
  if (!t) return;
  const reopening = t.status === "Done";
  mutate(
    () => transitionTask(t, reopening ? "To do" : "Done"),
    reopening ? "Task reopened" : "A little progress, made.",
  );
}
function transitionTask(t, status) {
  t.status = status;
  t.completedAt =
    status === "Done" ? t.completedAt || new Date().toISOString() : null;
  if (
    status === "Done" &&
    t.recurrence &&
    t.recurrence !== "Never" &&
    !t.nextId
  ) {
    const next = {
      ...structuredClone(t),
      id: uid(),
      status: "To do",
      due: nextRecurringDate(t.due, t.recurrence),
      completedAt: null,
      subtasks: (t.subtasks || []).map((x) => ({ ...x, done: false })),
    };
    delete next.nextId;
    state.tasks.push(next);
    t.nextId = next.id;
  }
}
function deadlinesPage() {
  return (
    header(
      "Deadlines & calendar",
      "Make room for what’s coming. Every date here is entered by you.",
      btn("Export calendar", "export-calendar", "secondary", "download") +
        btn("Add deadline", "add-deadline", "primary", "plus"),
    ) +
    `<section class="panel"><div class="toolbar calendar-toolbar"><div class="button-group">${ibtn("chevron", "Previous period", "calendar-prev", 'style="transform:rotate(180deg)"')}<h2>${calendarDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>${ibtn("chevron", "Next period", "calendar-next")}${btn("Today", "calendar-today", "ghost")}</div><div class="view-switch">${["Month", "Week", "Agenda"].map((v) => `<button data-action="calendar-view:${v}" class="${calendarView === v ? "selected" : ""}">${v}</button>`).join("")}</div></div>${calendarMarkup(calendarEvents(state))}</section>`
  );
}
function calendarMarkup(events) {
  if (calendarView === "Agenda")
    return events.length
      ? `<div class="agenda">${events.map(eventRow).join("")}</div>`
      : empty(
          "calendar",
          "Nothing on the calendar yet.",
          "Your application, task, aid, and scholarship deadlines come together here.",
        );
  const start = new Date(
    calendarDate.getFullYear(),
    calendarDate.getMonth(),
    1,
  );
  start.setDate(start.getDate() - start.getDay());
  let count = 42;
  if (calendarView === "Week") {
    start.setTime(calendarDate.getTime());
    start.setDate(start.getDate() - start.getDay());
    count = 7;
  }
  return `<div class="calendar-scroll"><div class="calendar-grid"><div class="weekdays">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => `<span>${d}</span>`).join("")}</div><div class="calendar-days ${count === 7 ? "week-view" : ""}">${Array.from(
    { length: count },
    (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = localDate(d);
      return `<div class="calendar-day ${d.getMonth() !== calendarDate.getMonth() ? "other-month" : ""} ${key === today() ? "today" : ""}"><button data-action="deadline-on:${key}" aria-label="Add deadline ${dateLabel(key, true)}">${d.getDate()}</button>${events
        .filter((e) => e.date === key)
        .map(
          (e) =>
            `<a href="#${e.target}" class="calendar-event ${e.kind === "Application" ? "blue" : "mint"}" title="${h(e.title)}">${h(e.title)}</a>`,
        )
        .join("")}</div>`;
    },
  ).join(
    "",
  )}</div></div></div><div class="calendar-key"><span><i class="blue-dot"></i> Applications</span><span><i class="green-dot"></i> Tasks & other deadlines</span></div>`;
}
function deadlineForm(date = "") {
  formDialog(
    "Add deadline",
    `${field("Deadline title", "title", "", "text", 'required maxlength="200"')}${appSelect()}${field("Date", "due", date, "date", "required")}${field("Time (optional)", "time", "", "time")}${select("Time zone", "timezone", timezones(), Intl.DateTimeFormat().resolvedOptions().timeZone)}${textarea("Source link / notes", "notes")}`,
    (v) =>
      mutate(
        () =>
          state.tasks.push({
            ...v,
            id: uid(),
            priority: "High",
            status: "To do",
            recurrence: "Never",
            subtasks: [],
          }),
        "Deadline saved",
      ),
    "Add deadline",
  );
}
function essayList(applicationId) {
  const list = state.essays.filter((e) => e.applicationId === applicationId);
  return `<div class="panel-heading"><div><h2>Essays</h2><p>Drafts save locally as you write.</p></div>${btn("New essay", `add-essay:${applicationId}`, "secondary", "plus")}</div>${list.length ? list.map((e) => `<button class="record-row" data-action="open-essay:${e.id}">${icon("edit")}<span><strong>${h(e.title)}</strong><small>${words(e.body)} words · ${h(e.category)}</small></span>${icon("arrow")}</button>`).join("") : empty("edit", "Start with a few words.", "Create a draft and give your story a little space.")}`;
}
function essaysPage() {
  let list = state.essays.filter(
    (e) =>
      (!essayQuery ||
        [e.title, e.body, e.tags]
          .join(" ")
          .toLowerCase()
          .includes(essayQuery.toLowerCase())) &&
      (!essayCategory || e.category === essayCategory),
  );
  if (!selectedEssay && list.length) selectedEssay = list[0].id;
  const selected = state.essays.find((e) => e.id === selectedEssay);
  return (
    header(
      "Essay studio",
      "Draft, revise, and organize your application writing.",
      btn("Brainstorm", "extra-prompts", "secondary", "spark") +
        btn("New essay", "add-essay:", "primary", "plus"),
    ) +
    `<section class="panel writing-workspace"><aside class="essay-library"><label class="search-field">${icon("search")}<input id="essay-search" value="${h(essayQuery)}" placeholder="Find a draft…" aria-label="Search essays"></label><select id="essay-category" aria-label="Essay category"><option value="">All writing</option>${essayCategories()
      .map(
        (c) => `<option ${c === essayCategory ? "selected" : ""}>${c}</option>`,
      )
      .join(
        "",
      )}</select><div class="essay-list">${list.map((e) => `<button class="essay-item ${e.id === selectedEssay ? "selected" : ""}" data-action="select-essay:${e.id}">${icon("file")}<span><strong>${h(e.title)}</strong><small>${h(e.category)} · ${words(e.body)} words</small></span></button>`).join("") || '<p class="muted library-empty">Your next draft starts here.</p>'}</div></aside><div class="essay-main">${selected ? `<div class="editor-toolbar"><span id="save-state" class="local-label">${icon("shield")} Saved locally</span><div class="button-group">${ibtn("edit", "Edit essay details", `edit-essay:${selected.id}`)}${btn("Review", `extra-review:${selected.id}`, "ghost", "tasks")}${btn("Versions", `essay-versions:${selected.id}`, "ghost", "clock")}${btn("Export", `essay-export:${selected.id}`, "secondary", "download")}</div></div><div class="essay-paper"><span class="eyebrow">${h(selected.category)}</span><h2>${h(selected.title)}</h2>${selected.prompt ? `<p class="essay-prompt">${h(selected.prompt)}</p>` : ""}<textarea id="essay-editor" data-essay-id="${selected.id}" placeholder="Start anywhere. A memory, a moment, a sentence…" aria-label="Essay draft" spellcheck="true">${h(selected.body || "")}</textarea></div><div class="editor-footer"><span id="word-counter">${words(selected.body)}${selected.limit ? ` / ${selected.limit}` : ""} words · ${(selected.body || "").length} characters</span><span>${selected.limit && words(selected.body) > selected.limit ? "Over your word limit" : "Saved in this browser"}</span></div>` : empty("edit", "There’s a story only you can tell.", "Start a new essay. Your words stay in this browser.", btn("Create your first draft", "add-essay:", "secondary", "plus"))}</div></section>`
  );
}
function essayCategories() {
  return [
    "Personal statement",
    "Common App",
    "QuestBridge",
    "Supplement",
    "Short answer",
    "Scholarship",
    "Activities",
    "Other",
  ];
}
function essayForm(id = "", applicationId = "") {
  const e = state.essays.find((x) => x.id === id) || {
    title: "",
    category: "Personal statement",
    applicationId,
    limit: 650,
    tags: "",
    prompt: "",
    body: "",
    versions: [],
  };
  formDialog(
    id ? "Essay details" : "New essay",
    `${field("Essay title", "title", e.title, "text", 'required maxlength="180"')}${select("Writing type", "category", essayCategories(), e.category)}${appSelect(e.applicationId)}${field("Word limit (optional)", "limit", e.limit, "number", 'min="1" max="20000"')}${field("Tags / folder", "tags", e.tags, "text", 'maxlength="200"')}${textarea("Prompt (verify with the application)", "prompt", e.prompt)}`,
    (v) => {
      const r = id ? e : { ...e, id: uid() };
      const ok = mutate(
        () => {
          Object.assign(r, v, { updated: Date.now() });
          if (!id) state.essays.push(r);
        },
        "Draft ready",
        false,
      );
      if (ok) {
        selectedEssay = r.id;
        navigate("essays");
      }
      return ok;
    },
    id ? "Save details" : "Create draft",
  );
  if (id)
    document
      .querySelector(".form-grid")
      .insertAdjacentHTML(
        "beforeend",
        `<div class="full">${btn("Delete essay", `delete-essay:${id}`, "danger", "trash")}</div>`,
      );
}
function connectEditor() {
  const el = document.querySelector("#essay-editor");
  if (!el) return;
  el.addEventListener("input", () => {
    const e = state.essays.find((e) => e.id === el.dataset.essayId);
    if (!e) return;
    const before = e.body;
    e.body = el.value;
    e.updated = Date.now();
    if (save()) {
      document.querySelector("#save-state").innerHTML =
        `${icon("shield")} Saved locally`;
      document.querySelector("#word-counter").textContent =
        `${words(e.body)}${e.limit ? ` / ${e.limit}` : ""} words · ${e.body.length} characters`;
      document.querySelector(".editor-footer>span:last-child").textContent =
        e.limit && words(e.body) > Number(e.limit)
          ? "Over your word limit"
          : "Saved in this browser";
    } else {
      e.body = before;
      document.querySelector("#save-state").textContent =
        "Not saved — storage unavailable";
    }
  });
}
function essayVersions(id) {
  const e = state.essays.find((e) => e.id === id);
  dialog(
    `<div class="dialog-heading"><div><div class="eyebrow">YOUR WORDS, OVER TIME</div><h2>Draft history</h2></div>${ibtn("x", "Close", "close-dialog")}</div><p class="body-copy">Save a snapshot before taking your draft in a new direction. Up to 20 snapshots stay in this browser.</p>${btn("Save current snapshot", `snapshot-essay:${id}`, "secondary", "plus")}<div class="version-list">${
      e.versions.length
        ? e.versions
            .slice()
            .reverse()
            .map(
              (v) =>
                `<div class="record-row"><span><strong>${new Date(v.at).toLocaleString()}</strong><small>${words(v.body)} words</small></span>${btn("Compare", `compare-version:${id}/${v.id}`, "ghost")}${btn("Restore", `restore-version:${id}/${v.id}`, "ghost")}</div>`,
            )
            .join("")
        : '<p class="muted">No snapshots yet. Your current draft is autosaved.</p>'
    }</div>`,
  );
}
function essayExport(id) {
  dialog(
    `<div class="dialog-heading"><h2>Export essay</h2>${ibtn("x", "Close", "close-dialog")}</div><p class="body-copy">Export this draft in a format that works for you.</p><div class="export-options">${btn("Plain text (.txt)", `export-essay-txt:${id}`, "secondary", "file")}${btn("Word document (.docx)", `export-essay-docx:${id}`, "secondary", "file")}${btn("Print / save as PDF", `export-essay-pdf:${id}`, "secondary", "download")}${btn("Copy to clipboard", `copy-essay:${id}`, "secondary", "edit")}</div>`,
  );
}
const fileTypes = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "Word",
  "text/plain": "Text",
  "image/png": "Image",
  "image/jpeg": "Image",
  "image/gif": "Image",
  "image/webp": "Image",
};
function documentsPage() {
  return (
    header(
      "Documents",
      "Keep your files organized, close at hand, and in your browser.",
      btn("Upload document", "upload-document:", "primary", "upload"),
    ) +
    `<section class="panel">${documentsBody()}</section><div class="source-note">${icon("shield")}<span>Files stay in browser local storage. Up to 1 MB per file and 3 MB of documents in total. Browser limits vary; export a backup before clearing browsing data.</span></div>`
  );
}
function documentsBody(applicationId) {
  const docs = state.documents.filter(
    (d) => !applicationId || d.applicationId === applicationId,
  );
  return `<div class="panel-heading"><div><h2>Your document library</h2><p>${docs.length} ${docs.length === 1 ? "file" : "files"} · ${Math.ceil(state.documents.reduce((n, d) => n + d.size, 0) / 1024)} KB stored locally</p></div>${applicationId ? btn("Upload document", `upload-document:${applicationId}`, "secondary", "upload") : ""}</div><div class="toolbar"><label class="search-field grow">${icon("search")}<input id="document-search" placeholder="Find a file by name, folder, or tag…" aria-label="Search documents"></label></div><div class="document-list">${docs.length ? docs.map((d) => `<div class="document-row" data-search-text="${h([d.name, d.folder, d.tags].join(" ").toLowerCase())}"><span class="file-icon">${icon(d.type.startsWith("image/") ? "school" : "file")}</span><div><button class="record-title" data-action="preview-document:${d.id}">${h(d.name)}</button><small>${h(d.folder)} · ${h(fileTypes[d.type] || "Document")} · ${Math.ceil(d.size / 1024)} KB${d.tags ? ` · ${h(d.tags)}` : ""}</small></div>${ibtn("edit", "Rename and organize file", `edit-document:${d.id}`)}${ibtn("download", "Download file", `download-document:${d.id}`)}${ibtn("trash", "Delete file", `delete-document:${d.id}`)}</div>`).join("") : empty("folder", "Everything in its place.", "Upload a transcript, essay, or other application document.", btn("Choose a file", `upload-document:${applicationId || ""}`, "secondary", "upload"))}</div>`;
}
function uploadDocument(applicationId = "") {
  formDialog(
    "Upload a document",
    `<label class="upload-zone full">${icon("upload")}<strong>Choose a document</strong><span>PDF, DOCX, TXT, PNG, JPG, GIF, or WebP · up to 1 MB</span><input name="file" type="file" accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.gif,.webp" required></label>${appSelect(applicationId)}${select("Folder", "folder", ["Transcripts", "Essays", "Recommendation Materials", "Financial Aid", "Scholarships", "Other"], "Other")}${field("Tags (optional)", "tags", "", "text", 'maxlength="200"')}`,
    async (v, form) => {
      const file = form.elements.file.files[0];
      if (!file || !fileTypes[file.type])
        throw new Error("Choose one of the supported document types.");
      if (file.size > 1024 * 1024)
        throw new Error(
          "This file exceeds 1 MB. Please choose a smaller file.",
        );
      if (
        state.documents.reduce((n, d) => n + d.size, 0) + file.size >
        3 * 1024 * 1024
      )
        throw new Error(
          "Your library exceeds 3 MB. Back up and remove a file first.",
        );
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () =>
          reject(new Error("This file could not be read."));
        reader.readAsDataURL(file);
      });
      delete v.file;
      return mutate(
        () =>
          state.documents.push({
            ...v,
            id: uid(),
            name: file.name,
            type: file.type,
            size: file.size,
            data,
            created: Date.now(),
          }),
        "Document saved in this browser",
      );
    },
    "Save document",
  );
}
function previewDocument(id) {
  const d = state.documents.find((x) => x.id === id);
  let content;
  if (d.type.startsWith("image/"))
    content = `<img class="document-preview" src="${d.data}" alt="${h(d.name)}">`;
  else if (d.type === "text/plain")
    content = `<pre class="text-preview">${h(new TextDecoder().decode(Uint8Array.from(atob(d.data.split(",")[1]), (c) => c.charCodeAt(0))))}</pre>`;
  else
    content = `<div class="empty-state"><div class="empty-icon">${icon("file")}</div><h3>${h(d.name)}</h3><p>Download this ${fileTypes[d.type]} to open it with your preferred viewer.</p>${btn("Download document", `download-document:${id}`, "secondary", "download")}</div>`;
  dialog(
    `<div class="dialog-heading"><h2>${h(d.name)}</h2>${ibtn("x", "Close preview", "close-dialog")}</div>${content}`,
    true,
  );
}
const config = {
  recommendations: {
    key: "recommendations",
    title: "Recommendations",
    subtitle: "Keep track of the people helping you take your next step.",
    noun: "recommender",
    icon: "users",
  },
  scholarships: {
    key: "scholarships",
    title: "Scholarships",
    subtitle: "A thoughtful place for scholarships you discover and verify.",
    noun: "scholarship",
    icon: "award",
  },
  "financial-aid": {
    key: "aid",
    title: "Financial aid",
    subtitle: "Your forms, offers, and financial questions, organized.",
    noun: "aid requirement",
    icon: "wallet",
  },
  notes: {
    key: "notes",
    title: "Notes",
    subtitle: "Campus visits, questions, ideas. Everything worth remembering.",
    noun: "note",
    icon: "note",
  },
};
function recordsPage(page) {
  const c = config[page];
  return (
    header(
      c.title,
      c.subtitle,
      btn(`Add ${c.noun}`, `add-record:${page}`, "primary", "plus"),
    ) +
    `<section class="panel">${recordsBody(page)}</section>${page === "financial-aid" ? offersSection() : ""}${page === "scholarships" ? `<div class="source-note">${icon("book")}<span>Discover opportunities at ${link("CareerOneStop", "https://www.careeronestop.org/toolkit/training/find-scholarships.aspx")} and ${link("Federal Student Aid", "https://studentaid.gov/understand-aid/types/scholarships")}. Ascend doesn’t invent opportunities, awards, or deadlines.</span></div>` : ""}`
  );
}
function recordsBody(page, applicationId) {
  const c = config[page];
  const list = state[c.key].filter(
    (r) => !applicationId || r.applicationId === applicationId,
  );
  return `<div class="panel-heading"><div><h2>${page === "recommendations" ? "Your support circle" : page === "financial-aid" ? "The financial aid checklist" : page === "scholarships" ? "Your scholarship list" : "Your notebook"}</h2><p>${list.length} ${list.length === 1 ? c.noun : `${c.noun}s`}</p></div>${applicationId ? btn(`Add ${c.noun}`, `add-record:${page}/${applicationId}`, "secondary", "plus") : ""}</div>${list.length ? `<div class="records-list">${list.map((r) => `<article class="record-row">${icon(c.icon)}<div class="record-info"><button class="record-title" data-action="edit-record:${page}/${r.id}">${h(r.title || r.name)}</button><small>${h(r.role || r.category || r.tags || "Personal record")}${r.applicationId ? ` · ${h(state.applications.find((a) => a.id === r.applicationId)?.name || "Removed application")}` : ""}${r.due ? ` · ${dateLabel(r.due)} · ${dueLabel(r.due)}` : ""}</small>${r.body || r.notes ? `<p class="record-preview">${h((r.body || r.notes).slice(0, 160))}</p>` : ""}</div>${r.status ? badge(r.status) : ""}${r.amount ? `<strong>${money(r.amount)}</strong>` : ""}${ibtn("edit", `Edit ${c.noun}`, `edit-record:${page}/${r.id}`)}${ibtn("trash", `Delete ${c.noun}`, `delete-record:${page}/${r.id}`)}</article>`).join("")}</div>` : empty(c.icon, page === "recommendations" ? "You don’t have to do it alone." : page === "notes" ? "A fresh page for your ideas." : "A little organization goes a long way.", page === "recommendations" ? "Add a teacher, counselor, or mentor and track your requests." : "Add your first record when you’re ready.", btn(`Add ${c.noun}`, `add-record:${page}/${applicationId || ""}`, "secondary", "plus"))}`;
}
function recordForm(page, id = "", applicationId = "") {
  const c = config[page],
    r = state[c.key].find((x) => x.id === id) || {
      title: "",
      applicationId,
      notes: "",
      body: "",
      due: "",
      status:
        page === "recommendations"
          ? "Not Requested"
          : page === "scholarships"
            ? "Researching"
            : "Not Started",
    };
  let fields =
    field(
      page === "recommendations"
        ? "Recommender name"
        : page === "notes"
          ? "Note title"
          : page === "scholarships"
            ? "Scholarship name"
            : "Requirement title",
      "title",
      r.title,
      "text",
      'required maxlength="200"',
    ) + appSelect(r.applicationId);
  if (page === "recommendations")
    fields +=
      field("Role / subject", "role", r.role) +
      field("Email / contact", "contact", r.contact) +
      field("Date requested", "requested", r.requested, "date") +
      field("Deadline", "due", r.due, "date") +
      select(
        "Status",
        "status",
        [
          "Not Requested",
          "Planning to Request",
          "Requested",
          "Recommender Confirmed",
          "Submitted",
          "Unable to Confirm",
        ],
        r.status,
      );
  if (page === "scholarships")
    fields +=
      field(
        "Amount (if verified)",
        "amount",
        r.amount,
        "number",
        'min="0" step="0.01"',
      ) +
      field("Deadline", "due", r.due, "date") +
      field("Official source URL", "url", r.url) +
      select(
        "Verification",
        "verification",
        ["Not verified", "Verified by me"],
        r.verification,
      ) +
      select(
        "Status",
        "status",
        [
          "Researching",
          "Not Started",
          "In Progress",
          "Submitted",
          "Awarded",
          "Not Awarded",
        ],
        r.status,
      );
  if (page === "financial-aid")
    fields +=
      select(
        "Category",
        "category",
        [
          "FAFSA",
          "CSS Profile",
          "Institution form",
          "Financial aid document",
          "Other",
        ],
        r.category || "Other",
      ) +
      field("Deadline", "due", r.due, "date") +
      select(
        "Status",
        "status",
        [
          "Not Started",
          "In Progress",
          "Submitted",
          "Complete",
          "Not applicable",
          "Not verified",
        ],
        r.status,
      ) +
      field("Official source URL", "url", r.url);
  if (page === "notes")
    fields +=
      field("Tags / folder", "tags", r.tags) +
      textarea("Your thoughts", "body", r.body, 'rows="9"');
  else fields += textarea("Private notes", "notes", r.notes);
  formDialog(
    `${id ? "Edit" : "Add"} ${c.noun}`,
    fields,
    (v) =>
      mutate(
        () => {
          Object.assign(r, v);
          if (!id) {
            r.id = uid();
            state[c.key].push(r);
          }
        },
        `${c.noun[0].toUpperCase() + c.noun.slice(1)} saved`,
      ),
    "Save",
    page === "notes",
  );
}
function offersSection() {
  return `<section class="panel offers-panel"><div class="panel-heading"><div><h2>See the whole picture.</h2><p>Compare your own estimates and confirmed offers. Loans are borrowing; work-study is earned.</p></div>${btn("Add offer", "add-offer", "secondary", "plus")}</div>${
    state.offers.length
      ? `<div class="offer-grid">${state.offers
          .map((o) => {
            const net =
              Number(o.cost) -
              Number(o.grants || 0) -
              Number(o.scholarships || 0);
            return `<article class="offer-card"><div class="eyebrow">${h(o.verification || "Estimate")} · ${h(o.year || "Year not set")}</div><h3>${h(state.applications.find((a) => a.id === o.applicationId)?.name || o.title || "College offer")}</h3><div class="detail-list"><div><span>Cost of attendance</span><strong>${money(o.cost)}</strong></div><div><span>Grants</span><strong>− ${money(o.grants || 0)}</strong></div><div><span>Scholarships</span><strong>− ${money(o.scholarships || 0)}</strong></div><div class="net-cost"><span>Net annual cost</span><strong>${money(net)}</strong></div><div><span>Loans offered (borrowed)</span><strong>${money(o.loans || 0)}</strong></div><div><span>Work-study (earned)</span><strong>${money(o.workstudy || 0)}</strong></div></div><div class="button-group">${btn("Edit", `edit-offer:${o.id}`, "ghost", "edit")}${ibtn("trash", "Delete offer", `delete-offer:${o.id}`)}</div></article>`;
          })
          .join("")}</div>`
      : empty(
          "wallet",
          "A clearer cost comparison.",
          "Add annual costs and aid to see what each college could mean for you.",
        )
  }</section>`;
}
function offerForm(id) {
  const o = state.offers.find((x) => x.id === id) || {};
  formDialog(
    id ? "Update financial aid offer" : "See the whole picture.",
    `${field("Offer label", "title", o.title, "text", 'required maxlength="120"')}${appSelect(o.applicationId)}${field("Academic year", "year", o.year || "2027–28")}${select("These figures are", "verification", ["Estimate", "Confirmed offer"], o.verification || "Estimate")}${field("Annual cost of attendance ($)", "cost", o.cost, "number", 'required min="0" step="0.01"')}${field("Annual grants ($)", "grants", o.grants || 0, "number", 'min="0" step="0.01"')}${field("Annual scholarships ($)", "scholarships", o.scholarships || 0, "number", 'min="0" step="0.01"')}${field("Loans offered ($)", "loans", o.loans || 0, "number", 'min="0" step="0.01"')}${field("Work-study offered ($)", "workstudy", o.workstudy || 0, "number", 'min="0" step="0.01"')}${textarea("Source / notes", "notes", o.notes)}`,
    (v) =>
      mutate(() => {
        Object.assign(o, v);
        if (!id) {
          o.id = uid();
          state.offers.push(o);
        }
      }, "Offer saved"),
    "Save offer",
    true,
  );
}
function comparePage() {
  const colleges = state.compare
    .map((id) => schoolRecords("colleges").find((c) => c.id === id))
    .filter(Boolean);
  const fields = [
    ["Location", (c) => `${c.city}, ${c.state}`],
    ["Institution type", (c) => c.type],
    ["Degree level", (c) => c.level],
    ["Campus setting", (c) => c.campusSetting],
    [
      "Undergraduate enrollment (fall 2024)",
      (c) => c.enrollment?.toLocaleString(),
    ],
    [
      "In-state tuition & fees (2025–26)",
      (c) => (c.tuitionIn != null ? money(c.tuitionIn) : null),
    ],
    [
      "Out-of-state tuition & fees (2025–26)",
      (c) => (c.tuitionOut != null ? money(c.tuitionOut) : null),
    ],
    [
      "Admission rate (fall 2024)",
      (c) =>
        c.admissionRate != null
          ? `${(c.admissionRate * 100).toFixed(1)}%`
          : null,
    ],
    [
      "Graduation rate (150% of normal time)",
      (c) =>
        c.graduationRate != null
          ? `${(c.graduationRate * 100).toFixed(1)}%`
          : null,
    ],
    [
      "Your research notes",
      (c) => state.notes.find((n) => n.collegeId === c.id)?.body,
    ],
  ];
  return (
    header(
      "College compare",
      "A few possibilities, side by side. Compare up to five colleges.",
      btn("Export comparison", "export-compare", "secondary", "download") +
        btn("Explore colleges", "nav:colleges", "primary", "plus"),
    ) +
    `<section class="panel compare-panel">${
      colleges.length
        ? `<div class="compare-scroll"><table class="compare-table"><thead><tr><th>THE DETAILS THAT MATTER</th>${colleges.map((c) => `<th>${monogram(c.name)}<a href="#college/${c.id}">${h(c.name)}</a>${ibtn("x", "Remove from comparison", `compare-add:${c.id}`)}</th>`).join("")}</tr></thead><tbody>${fields.map(([label, value]) => `<tr><th>${label}</th>${colleges.map((c) => `<td>${h(value(c) || "Not available")}</td>`).join("")}</tr>`).join("")}<tr><th>Your personal fit (1–5)<small>Your own rating, never an admissions probability.</small></th>${colleges.map((c) => `<td><label class="field"><span>Academic fit</span><input type="range" min="1" max="5" value="${state.profile.fit?.[c.id]?.academic || 3}" data-fit="${c.id}/academic" aria-label="Academic fit ${h(c.name)}"></label><label class="field"><span>Affordability</span><input type="range" min="1" max="5" value="${state.profile.fit?.[c.id]?.cost || 3}" data-fit="${c.id}/cost" aria-label="Affordability ${h(c.name)}"></label><label class="field"><span>Campus fit</span><input type="range" min="1" max="5" value="${state.profile.fit?.[c.id]?.campus || 3}" data-fit="${c.id}/campus" aria-label="Campus fit ${h(c.name)}"></label><strong class="fit-score">${fitScore(c.id)} / 5</strong></td>`).join("")}</tr></tbody></table></div><div class="toolbar"><span class="muted">Personal fit weights</span>${[
            ["academic", "Academics"],
            ["cost", "Cost"],
            ["campus", "Campus"],
          ]
            .map(
              ([k, t]) =>
                `<label class="inline-field">${t}<input type="number" min="0" max="10" value="${state.profile.fitWeights?.[k] ?? 1}" data-fit-weight="${k}" aria-label="${t} weight"></label>`,
            )
            .join(
              "",
            )}${btn("Reset ratings", "reset-fit", "ghost")}</div><div class="info-note">${icon("book")}Fit = sum of (your rating × chosen weight) ÷ total weight. Missing ratings start at 3. Figures use the bundled source’s reporting periods. Tuition excludes living expenses. Graduation rates reflect first-time, full-time cohorts.</div>`
        : empty(
            "compare",
            "Put your possibilities side by side.",
            "Choose the compare icon on a college card to start your comparison.",
            btn("Explore colleges", "nav:colleges", "secondary", "search"),
          )
    }</section>`
  );
}
function fitScore(id) {
  const ratings = state.profile.fit?.[id] || {},
    w = state.profile.fitWeights || {};
  let sum = 0,
    total = 0;
  for (const k of ["academic", "cost", "campus"]) {
    const weight = Number(w[k] ?? 1);
    sum += Number(ratings[k] || 3) * weight;
    total += weight;
  }
  return total ? (sum / total).toFixed(1) : "—";
}
function questbridgePage() {
  if (!state.profile.questbridge)
    return (
      header(
        "QuestBridge",
        "An optional workspace for your QuestBridge journey.",
      ) +
      `<section class="panel">${empty("spark", "Make space for your QuestBridge plans.", "Turn on a personal workspace for finalist status, college rankings, Match requirements, and your next steps.", btn("Enable QuestBridge", "enable-questbridge", "secondary", "plus"))}<div class="info-note">${icon("book")}${link("Explore the official QuestBridge program", "https://www.questbridge.org/")} · Check official rules, partner colleges, and current deadlines before making a plan.</div></section>`
    );
  const q = state.questbridge,
    ranked = q.ranking
      .map((id) => state.applications.find((a) => a.id === id))
      .filter(Boolean);
  return (
    header(
      "QuestBridge",
      "Your ranking, requirements, and next steps, together.",
      btn("Update your status", "edit-questbridge", "secondary", "edit"),
    ) +
    `<div class="quest-layout"><section class="panel"><div class="panel-heading"><div><h2>Your college ranking</h2><p>Drag to reorder, or use the move controls. This is your private plan.</p></div></div>${ranked.length ? ranked.map((a, i) => `<div class="ranking-row" draggable="true" data-rank-drag="${a.id}" data-rank-drop="${a.id}"><span class="rank-number">${i + 1}</span>${monogram(a.name)}<a href="#application/${a.id}">${h(a.name)}</a><div class="button-group">${ibtn("chevron", "Move up", `rank-up:${a.id}`, 'style="transform:rotate(-90deg)"')}${ibtn("chevron", "Move down", `rank-down:${a.id}`, 'style="transform:rotate(90deg)"')}${ibtn("x", "Remove from ranking", `rank-remove:${a.id}`)}</div></div>`).join("") : empty("school", "Start with the schools that feel right.", "Add applications to your ranking below. Verify partner eligibility with QuestBridge.")}<div class="toolbar"><select id="rank-college" aria-label="Choose an application to rank"><option value="">Choose an application</option>${activeApps()
      .filter((a) => !q.ranking.includes(a.id))
      .map((a) => `<option value="${a.id}">${h(a.name)}</option>`)
      .join(
        "",
      )}</select>${btn("Add to ranking", "rank-add", "secondary", "plus")}</div></section><section class="panel"><span class="eyebrow">YOUR PERSONAL TRACKER</span><h2>Your program status</h2><div class="detail-list"><div><span>Current stage</span><strong>${h(q.status)}</strong></div><div><span>Outcome</span><strong>${h(q.outcome || "Not recorded")}</strong></div></div><p class="body-copy">Match requirements live in each college’s application checklist. Tag essays as QuestBridge to keep your writing together.</p><div class="resource-links">${link("Program & current requirements", "https://www.questbridge.org/college-programs/national-college-match")}${link("Official college partners", "https://www.questbridge.org/college-partners")}</div><div class="info-note">Rankings and outcomes are manually recorded. Your Ascend ranking does not change your QuestBridge account.</div></section></div>`
  );
}
function analyticsPage() {
  const apps = activeApps(),
    done = state.tasks.filter((t) => t.status === "Done").length;
  return (
    header(
      "Progress overview",
      "Your application statuses, completed tasks, and writing activity.",
    ) +
    `<section class="panel"><div class="panel-heading"><h2>Application status</h2><span class="muted">${apps.length} possibilities</span></div>${
      apps.length
        ? `<div class="analytics-list">${STATUSES.map((s) => {
            const n = apps.filter((a) => a.status === s).length;
            return n
              ? `<div><span>${s}</span><span class="progress-track"><i style="width:${(n / apps.length) * 100}%"></i></span><strong>${n}</strong></div>`
              : "";
          }).join("")}</div>`
        : empty(
            "chart",
            "Your journey is just beginning.",
            "Your application activity will appear here as you build your list.",
          )
    }<div class="analytics-totals"><div><strong>${done}</strong><span>Tasks completed</span></div><div><strong>${state.essays.length}</strong><span>Essay drafts</span></div><div><strong>${state.essays.reduce((n, e) => n + words(e.body), 0).toLocaleString()}</strong><span>Words written</span></div><div><strong>${apps.length ? Math.round(apps.reduce((n, a) => n + progress(a), 0) / apps.length) : 0}%</strong><span>Average checklist progress</span></div></div></section>`
  );
}
function resourcesPage() {
  const resources = [
    [
      "school",
      "Finding your fit",
      "Research schools using official federal directories.",
      "College Navigator",
      "https://nces.ed.gov/collegenavigator/",
      "College Scorecard",
      "https://collegescorecard.ed.gov/",
    ],
    [
      "file",
      "Applications, made clearer",
      "Go directly to your application platform for current requirements.",
      "Common App",
      "https://www.commonapp.org/",
      "Coalition for College",
      "https://www.coalitionforcollegeaccess.org/",
    ],
    [
      "wallet",
      "Understand financial aid",
      "Find current forms and guidance from the official providers.",
      "Federal Student Aid / FAFSA",
      "https://studentaid.gov/",
      "CSS Profile",
      "https://cssprofile.collegeboard.org/",
    ],
    [
      "award",
      "More ways to get there",
      "Explore official scholarship and access resources.",
      "CareerOneStop scholarships",
      "https://www.careeronestop.org/toolkit/training/find-scholarships.aspx",
      "QuestBridge",
      "https://www.questbridge.org/",
    ],
    [
      "edit",
      "Give your story a little space",
      "Organize your prompts, preserve your drafts, and write in your own voice.",
      "Open your essay workspace",
      "#essays",
      "Plan a writing session",
      "#tasks",
    ],
    [
      "users",
      "Build your support circle",
      "Track requests and prepare notes for the teachers and mentors helping you.",
      "Open recommendation tracker",
      "#recommendations",
      "Organize your documents",
      "#documents",
    ],
  ];
  return (
    header(
      "Resources",
      "Useful places to turn, whenever you need a starting point.",
    ) +
    `<div class="resource-grid">${resources.map(([ico, title, text, l1, u1, l2, u2]) => `<article class="panel resource-card"><span class="quick-icon">${icon(ico)}</span><h2>${title}</h2><p>${text}</p><div class="resource-links">${u1.startsWith("#") ? `<a class="text-link" href="${u1}">${l1}${icon("arrow")}</a>` : link(l1, u1)}${u2.startsWith("#") ? `<a class="text-link" href="${u2}">${l2}${icon("arrow")}</a>` : link(l2, u2)}</div></article>`).join("")}</div><div class="source-note">${icon("external")}Official resources open in a new tab. Confirm dates, eligibility, fees, and requirements with the provider. Ascend does not submit forms or requests.</div>`
  );
}
function settingsPage() {
  const bytes = new Blob([JSON.stringify(state)]).size;
  return (
    header(
      "Settings",
      "Manage your profile, appearance, and browser-local workspace.",
    ) +
    `<div class="settings-grid"><section class="panel"><div class="panel-heading"><div><h2>Your profile</h2><p>The person behind the possibilities.</p></div>${btn("Edit profile", "profile", "secondary", "edit")}</div><div class="profile-intro"><span class="avatar large">${h(initials(state.profile.name || "You"))}</span><div><h3>${h(state.profile.name || "Your next chapter")}</h3><p>Class of ${h(state.profile.graduation || "—")}</p></div></div><div class="detail-list"><div><span>High school</span><strong>${h(state.profile.highSchool || "Not selected")}</strong></div><div><span>Academic interests</span><strong>${h(state.profile.major || "Still exploring")}</strong></div><div><span>Home state</span><strong>${h(state.profile.state || "Not set")}</strong></div><div><span>Application stage</span><strong>${h(state.profile.stage || "Getting started")}</strong></div></div></section><section class="panel"><h2>Appearance</h2><p class="body-copy">Clean lines, in your preferred palette.</p>${appearanceOptions()}<div class="setting-row"><div><strong>QuestBridge workspace</strong><p>An optional place for your QuestBridge plans.</p></div><input type="checkbox" id="quest-toggle" aria-label="Enable QuestBridge workspace" ${state.profile.questbridge ? "checked" : ""}></div><div class="info-note">${icon("leaf")}Motion and transparency follow your device’s accessibility settings.</div></section><section class="panel data-panel"><div class="panel-heading"><div><span class="eyebrow">YOUR BROWSER. YOUR DATA.</span><h2>Backup & data</h2></div><span class="metric-icon mint">${icon("shield")}</span></div><p class="body-copy">Applications, essays, documents, and personal information save locally in this browser. If you enable device sync, an encrypted copy also saves in your private GitHub repository. There is no database or analytics. The local password screen is a privacy lock; protect access to your browser profile.</p><div class="storage-meter"><span>${(bytes / 1024).toFixed(0)} KB saved locally</span><span>Browser capacity varies</span></div><p class="body-copy">Clearing site data, switching browsers, or using private browsing can remove or separate your workspace. Download a backup regularly. Backups include your private files; keep them somewhere you trust.</p><div class="button-group">${btn("Download full backup", "export-backup", "primary", "download")}${btn("Import backup", "import-backup", "secondary", "upload")}${btn("Paste backup", "paste-backup", "ghost", "edit")}${btn("Export applications CSV", "export-applications", "ghost", "download")}</div><input id="backup-file" type="file" accept=".json,application/json" hidden></section><section class="panel data-panel"><h2>Privacy & device sync</h2><p class="body-copy">Unlock with your chosen password. The local lock hides the workspace after five minutes of inactivity. It is not server authentication. Optional device sync sends only encrypted records to your private GitHub repository.</p>${btn("Lock now", "lock-workspace", "secondary", "shield")}${btn("Open device sync", "nav:sync", "secondary")}<hr><h2>Reset workspace</h2><p class="body-copy">Remove all personal workspace data from this browser. The bundled school directory stays available.</p>${btn("Reset this workspace", "reset-workspace", "danger", "trash")}</section></div>`
  );
}
function profileForm(onboard = false) {
  formDialog(
    onboard ? "Set up your profile" : "Your profile",
    `${field("What should we call you?", "name", state.profile.name, "text", 'maxlength="60" placeholder="Your preferred name"')}${field("Graduation year", "graduation", state.profile.graduation, "number", 'min="2020" max="2100"')}${field("High school (optional)", "highSchool", state.profile.highSchool, "text", 'maxlength="180"')}<div class="field"><span>Find your school</span><button type="button" class="btn secondary" data-action="nav:high-schools">${icon("search")}Browse the school directory</button></div>${field("Academic interests", "major", state.profile.major, "text", 'maxlength="160" placeholder="Anything you’re curious about"')}${field("Home state / territory", "state", state.profile.state, "text", 'maxlength="2" placeholder="NY"')}${select("Where are you in your journey?", "stage", ["Getting started", "Researching colleges", "Working on applications", "Waiting for decisions", "Choosing a college"], state.profile.stage)}${select(
      "QuestBridge workspace",
      "questbridge",
      [
        ["false", "Maybe later"],
        ["true", "Yes, include QuestBridge"],
      ],
      String(state.profile.questbridge),
    )}`,
    (v) =>
      mutate(
        () =>
          Object.assign(state.profile, v, {
            questbridge: v.questbridge === "true",
            onboarded: true,
          }),
        "Your workspace, a little more you.",
      ),
    onboard ? "Start my next chapter" : "Save profile",
    true,
  );
}
function exportBackup() {
  if (storageReadFailed) {
    download(
      "ascend-original-data.json",
      localStorage.getItem(STORAGE_KEY) || "",
    );
    return;
  }
  download(
    `ascend-backup-${today()}.json`,
    JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2),
    "application/json",
  );
  toast("Backup downloaded. Keep it somewhere safe.");
}
function previewWorkspaceImport(imported) {
  formDialog(
    "Bring your workspace with you.",
    `<div class="full body-copy"><p>This backup contains <strong>${imported.applications.length} applications, ${imported.essays.length} essays, ${imported.tasks.length} tasks, and ${imported.documents.length} files.</strong></p><p>Importing replaces this browser’s current workspace. A backup of your current workspace will download first.</p></div>`,
    () => {
      exportBackup();
      const old = state, wasLocked = storageReadFailed;
      state = imported;
      storageReadFailed = false;
      if (!save()) {
        state = old;
        storageReadFailed = wasLocked;
        return false;
      }
      selectedEssay = "";
      appFilter = "All";
      navigate("home");
      toast("Your workspace, right where you left it.");
      return true;
    },
    "Import workspace",
  );
}
function globalSearch() {
  if(isPrivacyLocked())return;
  loadDirectory("colleges");
  loadDirectory("high-schools");
  dialog(
    `<div class="command-input">${icon("search")}<input id="global-search" placeholder="Where would you like to go?" aria-label="Search everything" autocomplete="off"><kbd>ESC</kbd></div><div id="command-results" class="command-results">${commandResults("")}</div><div class="command-footer"><span>↑ ↓ to explore</span><span>↵ to open</span><span>All your possibilities, one search.</span></div>`,
    true,
  );
}
function commandResults(query) {
  const q = query.toLowerCase().trim(),
    groups = [];
  const pages = Object.entries(pageNames).filter(([, n]) =>
    n.toLowerCase().includes(q),
  );
  if (!q) {
    groups.push([
      "QUICK ACTIONS",
      [
        ["Add application", "add-application", "plus"],
        ["Create task", "add-task", "tasks"],
        ["New essay", "add-essay:", "edit"],
        ["Upload document", "upload-document:", "upload"],
      ],
    ]);
  } else {
    for (const [key, title, routePrefix] of [
      ["applications", "APPLICATIONS", "application/"],
      ["tasks", "TASKS", "tasks"],
      ["essays", "ESSAYS", "essays"],
      ["documents", "DOCUMENTS", "documents"],
      ["notes", "NOTES", "notes"],
      ["scholarships", "SCHOLARSHIPS", "scholarships"],
      ["activities", "ACTIVITIES", "activities"],
      ["honors", "HONORS", "activities"],
      ["visits", "VISITS & INTERVIEWS", "visits"],
      ["tests", "TESTING", "tests"],
      ["expenses", "EXPENSES", "expenses"],
      ["contacts", "CONTACTS", "contacts"],
      ["goals", "GOALS", "goals"],
      ["events", "PERSONAL EVENTS", "planner"],
      ["dayNotes", "DAILY NOTES", "planner"],
      ...TOOL_DEFINITIONS.map(d=>[d.key,d.title.toUpperCase(),d.key]),
    ]) {
      const matches = state[key]
        .filter((r) =>
          [
            r.name,
            r.title,
            r.body,
            r.notes,
            r.description,
            r.organization,
            r.location,
            r.date,
          ]
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
        .slice(0, 5)
        .map((r) => [
          r.name || r.title || dateLabel(r.date, true),
          key === "events"
            ? `planner-edit:${r.id}`
            : key === "dayNotes"
              ? `nav:planner/${r.date}`
              : key === "essays"
                ? `open-essay:${r.id}`
                : TOOL_DEFINITIONS.some(d=>d.key===key)
                  ? `studio-edit:${key}/${r.id}`
                : key === "documents"
                  ? `preview-document:${r.id}`
                  : `nav:${routePrefix.endsWith("/") ? routePrefix + r.id : routePrefix}`,
          key === "tasks" ? "tasks" : "file",
        ]);
      if (matches.length) groups.push([title, matches]);
    }
    for (const [kind, label] of [
      ["colleges", "COLLEGES"],
      ["high-schools", "HIGH SCHOOLS"],
    ]) {
      const matches = schoolRecords(kind)
        .filter((c) => fuzzyMatch(q, c))
        .sort((a, b) => searchRank(q, b) - searchRank(q, a))
        .slice(0, 5)
        .map((c) => [
          `${c.name} · ${c.city}, ${c.state}`,
          kind === "colleges" ? `nav:college/${c.id}` : `select-school:${c.id}`,
          "school",
        ]);
      if (matches.length) groups.push([label, matches]);
    }
  }
  if (pages.length)
    groups.push([
      "PAGES",
      pages
        .slice(0, q ? 10 : 6)
        .map(([p, n]) => [n, `nav:${p}`, pageIcons[p] || "arrow"]),
    ]);
  searchIndex = -1;
  return groups.length
    ? groups
        .map(
          ([label, items]) =>
            `<div class="command-group"><span class="eyebrow">${label}</span>${items.map(([text, action, ico]) => `<button class="command-result" data-action="${action}">${icon(ico)}<span>${h(text)}</span>${icon("arrow")}</button>`).join("")}</div>`,
        )
        .join("")
    : '<div class="empty-state"><h3>No matches yet.</h3><p>Try a different name or keyword.</p></div>';
}
function notifications() {
  const all = calendarEvents(state).filter((e) => daysUntil(e.date) <= 14);
  const visible = all.filter(
    (e) =>
      !state.notifications.find(
        (n) =>
          n.eventId === e.id && (n.dismissed || n.snoozedUntil > Date.now()),
      ),
  );
  dialog(
    `<div class="dialog-heading"><div><div class="eyebrow">A LITTLE HEADS-UP</div><h2>Your reminders</h2></div>${ibtn("x", "Close notifications", "close-dialog")}</div><p class="body-copy">Upcoming and overdue items from your own records. No emails or background notifications are sent.</p>${visible.length ? visible.map((e) => `<div class="notification-item">${eventRow(e)}<div class="button-group">${btn("Mark read", `read-notification:${e.id}`, "ghost")}${btn("Snooze 1 day", `snooze-notification:${e.id}`, "ghost")}${ibtn("x", "Dismiss reminder", `dismiss-notification:${e.id}`)}</div></div>`).join("") : empty("bell", "A little breathing room.", "There’s nothing needing your attention right now.")}`,
  );
}
async function action(value, el) {
  const index = value.indexOf(":"),
    key = index < 0 ? value : value.slice(0, index),
    arg = index < 0 ? "" : value.slice(index + 1);
  const [id, sub] = arg.split("/");
  if(isPrivacyLocked())return;
  if(key==="lock-workspace"){lockWorkspace();return;}
  if(key.startsWith("cloud-") && await deviceSync.handle(key,arg))return;
  if (key.startsWith("studio-") && (await studio.handle(key,arg))) return;
  if (key.startsWith("planner-") && (await planner.handle(key, arg))) return;
  if (key.startsWith("extra-") && (await extras.handle(key, arg))) return;
  switch (key) {
    case "quick-add":
      dialog(
        `<div class="dialog-heading"><h2>What would you like to add?</h2>${ibtn("x", "Close quick add", "close-dialog")}</div><div class="quick-add-grid">${[
          ["Application", "add-application", "school"],
          ["Task", "add-task", "tasks"],
          ["Personal event", "planner-add:", "calendar"],
          ["Essay", "add-essay:", "edit"],
          ["Activity", "extra-form:activities", "award"],
          ["Visit or interview", "extra-form:visits", "pin"],
          ["Expense", "extra-form:expenses", "wallet"],
          ["Test", "extra-form:tests", "book"],
          ["Contact", "extra-form:contacts", "users"],
        ]
          .map(
            ([label, action, ico]) =>
              `<button data-action="${action}">${icon(ico)}${label}${icon("plus")}</button>`,
          )
          .join("")}</div>`,
      );
      break;
    case "noop":
      break;
    case "nav":
      navigate(arg);
      break;
    case "close-dialog":
      closeDialog(true);
      break;
    case "more": {
      const menu = document.querySelector("#more-menu");
      menu.hidden = !menu.hidden;
      el.setAttribute("aria-expanded", String(!menu.hidden));
      if (!menu.hidden) menu.querySelector("a").focus();
      break;
    }
    case "mobile-menu":
      mobileMenu = !mobileMenu;
      render();
      break;
    case "mission-filter":
      missionFilter = arg;
      render();
      break;
    case "mission-phase":
      missionPhaseFilter = missionPhaseFilter === arg ? "All" : arg;
      render();
      break;
    case "mission-board":
      taskView = "Board";
      navigate("tasks");
      break;
    case "search":
      globalSearch();
      break;
    case "notifications":
      notifications();
      break;
    case "theme":
      appearanceDialog();
      break;
    case "set-theme": {
      if (!APPEARANCES.some(([value]) => value === arg)) break;
      const inDialog = document.querySelector(".appearance-dialog");
      if (mutate(() => (state.profile.theme = arg))) {
        if (inDialog) inDialog.innerHTML = appearanceOptions();
        const scope = inDialog || root;
        scope.querySelector(`[data-action="set-theme:${arg}"]`)?.focus();
      }
      break;
    }
    case "profile":
      profileForm();
      break;
    case "onboard":
      profileForm(true);
      break;
    case "more-tools":
      showTools = !showTools;
      render();
      break;
    case "metric":
      if (arg === "deadlines") navigate("deadlines");
      else {
        appFilter = arg;
        appQuery = "";
        navigate("applications");
      }
      break;
    case "app-filter":
      appFilter = arg;
      render();
      document.querySelector(`.filter-tabs [data-action="app-filter:${CSS.escape(arg)}"]`)?.focus();
      break;
    case "reset-app-filters":
      appFilter = "All";
      appQuery = "";
      render();
      document.querySelector('.filter-tabs [data-action="app-filter:All"]')?.focus();
      break;
    case "add-application":
      addApplication();
      break;
    case "edit-application":
      addApplication(
        null,
        state.applications.find((a) => a.id === id),
      );
      break;
    case "app-menu": {
      const a = state.applications.find((a) => a.id === id);
      dialog(
        `<div class="dialog-heading"><h2>${h(a.name)}</h2>${ibtn("x", "Close actions", "close-dialog")}</div><div class="export-options">${btn("Open workspace", `nav:application/${id}`, "secondary", "arrow")}${btn("Edit application", `edit-application:${id}`, "secondary", "edit")}${btn("Duplicate application", `duplicate-application:${id}`, "secondary", "file")}${btn(a.archived ? "Restore application" : "Archive application", `archive-application:${id}`, "secondary", "archive")}${btn("Delete application", `delete-application:${id}`, "danger", "trash")}</div>`,
      );
      break;
    }
    case "duplicate-application": {
      mutate(() => {
        const a = structuredClone(state.applications.find((a) => a.id === id));
        a.id = uid();
        a.name += " (copy)";
        const ids = new Map(a.requirements.map((r) => [r.id, uid()]));
        a.requirements.forEach((r) => {
          r.id = ids.get(r.id);
          if (r.dependsOn) r.dependsOn = ids.get(r.dependsOn) || "";
        });
        a.created = Date.now();
        state.applications.push(a);
      }, "Application duplicated");
      closeDialog();
      break;
    }
    case "archive-application":
      mutate(() => {
        const a = state.applications.find((a) => a.id === id);
        a.archived = !a.archived;
      }, "Application updated");
      closeDialog();
      break;
    case "delete-application":
      confirmAction(
        "Remove this possibility?",
        "This removes the application and its checklist. Associated essays, files, and tasks stay in your workspace.",
        () =>
          mutate(() => {
            state.applications = state.applications.filter((a) => a.id !== id);
            state.questbridge.ranking = state.questbridge.ranking.filter(
              (x) => x !== id,
            );
          }, "Application removed"),
      );
      break;
    case "workspace-tab":
      workspaceTab = arg;
      render();
      break;
    case "add-requirement":
      requirementForm(state.applications.find((a) => a.id === id));
      break;
    case "edit-requirement":
      requirementForm(
        state.applications.find((a) => a.id === id),
        sub,
      );
      break;
    case "delete-requirement":
      mutate(() => {
        const a = state.applications.find((a) => a.id === id);
        a.requirements = a.requirements.filter((r) => r.id !== sub);
        a.requirements.forEach((r) => {
          if (r.dependsOn === sub) r.dependsOn = "";
        });
      }, "Requirement removed");
      break;
    case "starter-requirements":
      mutate(() => {
        const a = state.applications.find((a) => a.id === id);
        a.requirements.push(
          ...[
            "Review official requirements",
            "Personal information",
            "Activities list",
            "Personal statement",
            "Supplemental essays",
            "Transcript",
            "Recommendations",
            "Financial aid forms",
            "Final review & submission",
          ].map((title) => ({
            id: uid(),
            title,
            done: false,
            required: true,
            weight: 1,
            exempt: false,
            dependsOn: "",
          })),
        );
      }, "Starter checklist added. Customize it to match verified requirements.");
      break;
    case "record-decision": {
      const a = state.applications.find((a) => a.id === id);
      formDialog(
        "A new chapter.",
        `${select("Your confirmed decision", "decision", ["Accepted", "Waitlisted", "Rejected", "Withdrawn"], a.decision || "Accepted")}${field("Decision date", "decisionDate", a.decisionDate || today(), "date", "required")}${textarea("Notes about the decision", "decisionNotes", a.decisionNotes)}`,
        (v) =>
          mutate(() => {
            Object.assign(a, v);
            a.status = v.decision;
            a.statusHistory.push({
              status: v.decision,
              at: new Date().toISOString(),
            });
          }, "Decision recorded"),
      );
      break;
    }
    case "add-college":
      addApplication(schoolRecords("colleges").find((c) => c.id === id));
      break;
    case "manual-school":
      manualSchool();
      break;
    case "favorite":
      mutate(() => {
        state.favorites = state.favorites.includes(id)
          ? state.favorites.filter((x) => x !== id)
          : [...state.favorites, id];
      }, "Saved colleges updated");
      break;
    case "compare-add":
      if (!state.compare.includes(id) && state.compare.length >= 5) {
        toast("Compare up to five colleges. Remove one to make room.");
        break;
      }
      mutate(
        () =>
          (state.compare = state.compare.includes(id)
            ? state.compare.filter((x) => x !== id)
            : [...state.compare, id]),
        "Comparison updated",
      );
      break;
    case "saved-schools":
      savedOnly = !savedOnly;
      render();
      break;
    case "reset-directory":
      directoryQuery = "";
      directoryState = "";
      directoryType = "";
      savedOnly = false;
      directoryAdvanced = {
        level: "",
        setting: "",
        maxTuition: "",
        minSize: "",
        maxSize: "",
        minGrad: "",
        maxAdmission: "",
      };
      render();
      break;
    case "select-school": {
      const s = schoolRecords("high-schools").find((s) => s.id === id);
      if (s) {
        mutate(() => {
          state.profile.highSchool = s.name;
          state.profile.highSchoolId = s.id;
        }, "High school saved to your profile");
        closeDialog();
        navigate("settings");
      }
      break;
    }
    case "delete-essay":
      confirmAction(
        "Remove this essay?",
        "This deletes the draft and all of its snapshots. Export your words first if you need a copy.",
        () => {
          mutate(
            () => (state.essays = state.essays.filter((e) => e.id !== id)),
            "Essay removed",
          );
          selectedEssay = "";
          render();
        },
      );
      break;
    case "archive-task":
      mutate(
        () =>
          (state.tasks.find((t) => t.id === id).archived = !state.tasks.find(
            (t) => t.id === id,
          ).archived),
        "Task updated",
      );
      closeDialog();
      break;
    case "delete-task":
      confirmAction(
        "Remove this task?",
        "This removes the task and its subtasks from your workspace.",
        () =>
          mutate(
            () => (state.tasks = state.tasks.filter((t) => t.id !== id)),
            "Task removed",
          ),
      );
      break;
    case "add-task":
      taskForm();
      break;
    case "edit-task":
      taskForm(id);
      break;
    case "complete-task":
      completeTask(id);
      break;
    case "task-view":
      taskView = arg;
      render();
      break;
    case "bulk-complete":
    case "bulk-delete": {
      const ids = [...document.querySelectorAll(".bulk-check:checked")].map(
        (c) => c.value,
      );
      if (!ids.length) {
        toast("Select a few tasks first.");
        break;
      }
      if (key === "bulk-delete")
        confirmAction(
          "Remove selected tasks?",
          `This deletes ${ids.length} selected tasks.`,
          () =>
            mutate(
              () =>
                (state.tasks = state.tasks.filter((t) => !ids.includes(t.id))),
              "Tasks removed",
            ),
        );
      else {
        for (const taskId of ids) {
          const t = state.tasks.find((t) => t.id === taskId);
          if (t.status !== "Done") completeTask(taskId);
        }
      }
      break;
    }
    case "add-deadline":
      deadlineForm();
      break;
    case "deadline-on":
      deadlineForm(arg);
      break;
    case "calendar-view":
      calendarView = arg;
      render();
      break;
    case "calendar-prev":
    case "calendar-next":
      if (calendarView === "Week")
        calendarDate.setDate(
          calendarDate.getDate() + (key === "calendar-next" ? 7 : -7),
        );
      else {
        calendarDate.setDate(1);
        calendarDate.setMonth(
          calendarDate.getMonth() + (key === "calendar-next" ? 1 : -1),
        );
      }
      render();
      break;
    case "calendar-today":
      calendarDate = new Date();
      render();
      break;
    case "export-calendar":
      download(
        "ascend-calendar.ics",
        toICS(calendarEvents(state), state.events),
        "text/calendar",
      );
      toast("Calendar downloaded. Import it into your calendar app.");
      break;
    case "add-essay":
      essayForm("", arg);
      break;
    case "edit-essay":
      essayForm(id);
      break;
    case "open-essay":
      selectedEssay = id;
      navigate("essays");
      break;
    case "select-essay":
      selectedEssay = id;
      render();
      break;
    case "essay-versions":
      essayVersions(id);
      break;
    case "snapshot-essay":
      mutate(
        () => {
          const e = state.essays.find((e) => e.id === id);
          e.versions.push({ id: uid(), at: Date.now(), body: e.body });
          if (e.versions.length > 20) e.versions.shift();
        },
        "Snapshot saved",
        false,
      );
      essayVersions(id);
      break;
    case "compare-version": {
      const e = state.essays.find((e) => e.id === id),
        v = e.versions.find((v) => v.id === sub);
      dialog(
        `<div class="dialog-heading"><h2>Your draft, then and now.</h2>${ibtn("x", "Close comparison", "close-dialog")}</div><div class="version-compare"><div><span class="eyebrow">${new Date(v.at).toLocaleDateString()}</span><pre>${h(v.body)}</pre></div><div><span class="eyebrow">CURRENT DRAFT</span><pre>${h(e.body)}</pre></div></div>`,
        true,
      );
      break;
    }
    case "restore-version":
      mutate(() => {
        const e = state.essays.find((e) => e.id === id),
          v = e.versions.find((v) => v.id === sub);
        e.versions.push({ id: uid(), at: Date.now(), body: e.body });
        e.body = v.body;
        if (e.versions.length > 20) e.versions.shift();
      }, "Draft restored. Previous draft saved as a snapshot.");
      closeDialog();
      break;
    case "essay-export":
      essayExport(id);
      break;
    case "export-essay-txt": {
      const e = state.essays.find((e) => e.id === id);
      download(`${e.title}.txt`, e.body);
      break;
    }
    case "export-essay-docx": {
      const e = state.essays.find((e) => e.id === id);
      const { makeDocx } = await import("./exports.js");
      download(`${e.title}.docx`, makeDocx(e.title, e.body));
      break;
    }
    case "export-essay-pdf": {
      const e = state.essays.find((e) => e.id === id);
      document.querySelector("#print-root").innerHTML =
        `<h1>${h(e.title)}</h1><div>${h(e.body).replace(/\n/g, "<br>")}</div>`;
      window.print();
      break;
    }
    case "copy-essay":
      try {
        await navigator.clipboard.writeText(
          state.essays.find((e) => e.id === id).body,
        );
        toast("Your words, copied.");
      } catch {
        toast(
          "Clipboard unavailable. Select the essay text and copy it manually.",
        );
      }
      break;
    case "upload-document":
      uploadDocument(arg);
      break;
    case "preview-document":
      previewDocument(id);
      break;
    case "download-document": {
      const d = state.documents.find((d) => d.id === id);
      const bytes = Uint8Array.from(atob(d.data.split(",")[1]), (c) =>
        c.charCodeAt(0),
      );
      download(d.name, new Blob([bytes], { type: d.type }));
      break;
    }
    case "edit-document": {
      const d = state.documents.find((d) => d.id === id);
      formDialog(
        "Everything in its place.",
        `${field("File name", "name", d.name, "text", 'required maxlength="180"')}${appSelect(d.applicationId)}${select("Folder", "folder", ["Transcripts", "Essays", "Recommendation Materials", "Financial Aid", "Scholarships", "Other"], d.folder)}${field("Tags", "tags", d.tags)}`,
        (v) => mutate(() => Object.assign(d, v), "Document updated"),
      );
      break;
    }
    case "delete-document":
      confirmAction(
        "Remove this document?",
        "The file will be removed from browser storage. Download a copy first if you need to keep it.",
        () =>
          mutate(
            () =>
              (state.documents = state.documents.filter((d) => d.id !== id)),
            "Document removed",
          ),
      );
      break;
    case "add-record":
      recordForm(id, "", sub);
      break;
    case "edit-record":
      recordForm(id, sub);
      break;
    case "delete-record":
      confirmAction(
        "Remove this record?",
        "This permanently removes this record from your browser workspace.",
        () =>
          mutate(
            () =>
              (state[config[id].key] = state[config[id].key].filter(
                (r) => r.id !== sub,
              )),
            "Record removed",
          ),
      );
      break;
    case "add-offer":
      offerForm();
      break;
    case "edit-offer":
      offerForm(id);
      break;
    case "delete-offer":
      confirmAction(
        "Remove this offer?",
        "This removes your recorded financial aid offer.",
        () =>
          mutate(
            () => (state.offers = state.offers.filter((o) => o.id !== id)),
            "Offer removed",
          ),
      );
      break;
    case "export-compare": {
      const rows = [
        [
          "College",
          "City",
          "State",
          "Type",
          "In-state tuition 2025–26",
          "Out-of-state tuition 2025–26",
          "Undergraduates fall 2024",
          "Admission rate fall 2024",
          "Graduation rate",
          "Your personal fit",
        ],
      ];
      for (const collegeId of state.compare) {
        const c = schoolRecords("colleges").find((c) => c.id === collegeId);
        if (c)
          rows.push([
            c.name,
            c.city,
            c.state,
            c.type,
            c.tuitionIn,
            c.tuitionOut,
            c.enrollment,
            c.admissionRate,
            c.graduationRate,
            fitScore(c.id),
          ]);
      }
      download("ascend-college-comparison.csv", csv(rows), "text/csv");
      break;
    }
    case "reset-fit":
      mutate(() => {
        state.profile.fit = {};
        state.profile.fitWeights = { academic: 1, cost: 1, campus: 1 };
      }, "Personal ratings reset");
      break;
    case "enable-questbridge":
      mutate(
        () => (state.profile.questbridge = true),
        "QuestBridge workspace enabled",
      );
      break;
    case "edit-questbridge":
      formDialog(
        "QuestBridge",
        `${select("Your stage", "status", ["Exploring", "Preparing application", "Applied", "Finalist", "Not selected as finalist", "Match requirements", "Match decision", "Regular Decision"], state.questbridge.status)}${field("Your recorded outcome", "outcome", state.questbridge.outcome, "text", 'maxlength="200"')}`,
        (v) =>
          mutate(
            () => Object.assign(state.questbridge, v),
            "QuestBridge status saved",
          ),
      );
      break;
    case "rank-add": {
      const selected = document.querySelector("#rank-college").value;
      if (selected)
        mutate(
          () => state.questbridge.ranking.push(selected),
          "Added to your personal ranking",
        );
      else toast("Choose an application to rank.");
      break;
    }
    case "rank-remove":
      mutate(
        () =>
          (state.questbridge.ranking = state.questbridge.ranking.filter(
            (x) => x !== id,
          )),
      );
      break;
    case "rank-up":
    case "rank-down":
      mutate(() => {
        const list = state.questbridge.ranking,
          i = list.indexOf(id),
          j = i + (key === "rank-up" ? -1 : 1);
        if (j >= 0 && j < list.length) [list[i], list[j]] = [list[j], list[i]];
      });
      break;
    case "export-original":
      download(
        "ascend-original-data.json",
        localStorage.getItem(STORAGE_KEY) || "",
      );
      break;
    case "export-backup":
      if (storageReadFailed)
        download(
          "ascend-original-data.json",
          localStorage.getItem(STORAGE_KEY) || "",
        );
      else exportBackup();
      break;
    case "import-backup":
      document.querySelector("#backup-file").click();
      break;
    case "paste-backup":
      formDialog(
        "Paste a workspace backup",
        `<p class="full body-copy">Paste the contents of an Ascend JSON backup. It is validated here in your browser before you review the import.</p>${textarea("Backup JSON", "backupText", "", 'required rows="10" maxlength="12582912" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off" data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false"')}`,
        (v) => {
          const imported = parseWorkspaceBackup(v.backupText);
          previewWorkspaceImport(imported);
          return false;
        },
        "Review backup",
        true,
      );
      break;
    case "export-applications":
      download(
        "ascend-applications.csv",
        csv([
          [
            "College",
            "Major",
            "Status",
            "Round",
            "Pathway",
            "Deadline",
            "Time",
            "Time zone",
            "Checklist progress",
            "Notes",
          ],
          ...state.applications.map((a) => [
            a.name,
            a.major,
            a.status,
            a.round,
            a.pathway,
            a.deadline,
            a.deadlineTime,
            a.timezone,
            progress(a),
            a.notes,
          ]),
        ]),
        "text/csv",
      );
      break;
    case "reset-workspace":
      formDialog(
        "Start a fresh chapter.",
        `<p class="full body-copy">Download a backup before resetting. This permanently removes your applications, essays, documents, and other personal records from this browser.</p>${field("Type RESET to confirm", "confirmation", "", "text", 'required pattern="RESET" autocomplete="off"')}`,
        (v) => {
          if (v.confirmation !== "RESET")
            throw new Error("Type RESET to confirm.");
          state = blankState();
          persistState(state);
          storageReadFailed = false;
          selectedEssay = "";
          appFilter = "All";
          navigate("home");
          toast("A fresh workspace, ready for your next chapter.");
          return true;
        },
        "Reset workspace",
      );
      break;
    case "read-notification":
    case "dismiss-notification":
    case "snooze-notification":
      mutate(
        () => {
          let n = state.notifications.find((n) => n.eventId === id);
          if (!n) {
            n = { id: uid(), eventId: id };
            state.notifications.push(n);
          }
          if (key === "read-notification") n.read = true;
          else if (key === "dismiss-notification") n.dismissed = true;
          else n.snoozedUntil = Date.now() + 86400000;
        },
        key === "read-notification"
          ? "Reminder marked read"
          : "Reminder updated",
        false,
      );
      if (key === "read-notification") {
        el.textContent = "Read";
        el.disabled = true;
      } else notifications();
      break;
  }
}
function csv(rows) {
  return (
    "\uFEFF" +
    rows
      .map((r) =>
        r
          .map((v) => {
            const text = String(v ?? "");
            return (
              '"' +
              (/^[=+@\-]/.test(text) ? "'" : "") +
              text.replaceAll('"', '""') +
              '"'
            );
          })
          .join(","),
      )
      .join("\r\n")
  );
}
document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-action]");
  if (el) {
    e.preventDefault();
    try {
      await action(el.dataset.action, el);
    } catch (error) {
      toast(error.message || "That couldn’t be saved. Please try again.");
    }
  } else if (!e.target.closest(".dropdown")) {
    const menu = document.querySelector("#more-menu");
    if (menu) {
      menu.hidden = true;
      document
        .querySelector('[data-action="more"]')
        .setAttribute("aria-expanded", "false");
    }
  }
});
document.addEventListener("submit", async (e) => {
  const form = e.target.closest("[data-form]");
  if (!form) return;
  e.preventDefault();
  const submit = form.querySelector("button[type=submit]");
  if (submit) submit.disabled = true;
  try {
    const values = Object.fromEntries(new FormData(form));
    const result = await formHandlers.get(form.dataset.form)(values, form);
    if (result !== false) {
      formHandlers.delete(form.dataset.form);
      closeDialog();
    }
  } catch (error) {
    form.querySelector(".form-error").textContent = error.message;
  } finally {
    if (submit) submit.disabled = false;
  }
});
document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.id === "global-search") {
    document.querySelector("#command-results").innerHTML = commandResults(
      el.value,
    );
    return;
  }
  if (el.id === "directory-search") {
    directoryQuery = el.value;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      const target = document.querySelector("#directory-results");
      if (target) {
        target.innerHTML = directoryResults();
        if (directoryKind === "colleges") hydrateCollegeMedia();
      }
    }, 140);
    return;
  }
  if (el.id === "app-search") {
    appQuery = el.value;
    const p = document.querySelector("#applications-results");
    if (p) {
      const tmp = document.createElement("div");
      tmp.innerHTML = applicationsTable();
      p.replaceWith(...tmp.childNodes);
    }
    const count = document.querySelector("#app-results-count");
    if (count) count.textContent = `${filteredApps().length} of ${state.applications.filter((a) => appFilter === "Archived" ? a.archived : !a.archived).length} applications`;
    return;
  }
  if (el.id === "essay-search") {
    essayQuery = el.value;
    const pos = el.selectionStart;
    render();
    const input = document.querySelector("#essay-search");
    input.focus();
    input.setSelectionRange(pos, pos);
    return;
  }
  if (el.id === "document-search") {
    const q = el.value.toLowerCase();
    document
      .querySelectorAll("[data-search-text]")
      .forEach((row) => (row.hidden = !row.dataset.searchText.includes(q)));
    return;
  }
  if (el.dataset.appNotes) {
    const a = state.applications.find((a) => a.id === el.dataset.appNotes);
    const before = a.notes;
    a.notes = el.value;
    if (!save()) a.notes = before;
  }
  if (el.dataset.collegeNotes) {
    let note = state.notes.find((n) => n.collegeId === el.dataset.collegeNotes);
    const before = structuredClone(state.notes);
    if (!note) {
      note = {
        id: uid(),
        collegeId: el.dataset.collegeNotes,
        title: `${schoolRecords("colleges").find((c) => c.id === el.dataset.collegeNotes)?.name || "College"} research`,
        body: "",
      };
      state.notes.push(note);
    }
    note.body = el.value;
    if (!save()) state.notes = before;
  }
});
document.addEventListener("change", async (e) => {
  const el = e.target;
  const filters = {
    "app-status": (v) => (appFilter = v),
    "app-sort": (v) => (appSort = v),
    "task-filter": (v) => (taskFilter = v),
    "task-priority": (v) => (taskPriority = v),
    "task-college": (v) => (taskCollege = v),
    "directory-state": (v) => (directoryState = v),
    "directory-type": (v) => (directoryType = v),
    "essay-category": (v) => (essayCategory = v),
  };
  if (el.dataset.directoryAdvanced) {
    directoryAdvanced[el.dataset.directoryAdvanced] = el.value;
    document.querySelector("#directory-results").innerHTML = directoryResults();
    if (directoryKind === "colleges") hydrateCollegeMedia();
    return;
  }
  if (filters[el.id]) {
    filters[el.id](el.value);
    render();
  }
  if (el.dataset.requirement) {
    const a = state.applications.find((a) => a.id === el.dataset.app),
      r = a.requirements.find((r) => r.id === el.dataset.requirement);
    if (
      el.checked &&
      r.dependsOn &&
      !a.requirements.find((x) => x.id === r.dependsOn)?.done
    ) {
      el.checked = false;
      toast("Complete the prerequisite requirement first.");
      return;
    }
    mutate(
      () => {
        r.done = el.checked;
        r.doneAt = r.done ? new Date().toISOString() : null;
        if (!r.done) {
          const pending = [r.id],
            seen = new Set();
          while (pending.length) {
            const next = pending.pop();
            if (seen.has(next)) continue;
            seen.add(next);
            for (const dependent of a.requirements.filter(
              (x) => x.dependsOn === next,
            )) {
              dependent.done = false;
              dependent.doneAt = null;
              pending.push(dependent.id);
            }
          }
        }
      },
      r.done ? "Requirement reopened" : "A little progress, made.",
    );
  }
  if (el.id === "quest-toggle")
    mutate(() => (state.profile.questbridge = el.checked));
  if (el.dataset.fit) {
    const [id, key] = el.dataset.fit.split("/");
    mutate(() => {
      state.profile.fit ||= {};
      state.profile.fit[id] ||= {};
      state.profile.fit[id][key] = Number(el.value);
    });
  }
  if (el.dataset.fitWeight)
    mutate(() => {
      state.profile.fitWeights ||= {};
      state.profile.fitWeights[el.dataset.fitWeight] = Math.max(
        0,
        Math.min(10, Number(el.value) || 0),
      );
    });
  if (el.id === "backup-file" && el.files[0]) {
    try {
      if (el.files[0].size > 12 * 1024 * 1024)
        throw new Error("Backup is too large (12 MB maximum).");
      previewWorkspaceImport(parseWorkspaceBackup(await el.files[0].text()));
    } catch (error) {
      toast(`Could not import: ${error.message}`);
    }
    el.value = "";
  }
});
document.addEventListener("keydown", (e) => {
  if(isPrivacyLocked())return;
  if (
    e.target.matches('[role="tab"]') &&
    ["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)
  ) {
    const tabs = [
      ...e.target.closest('[role="tablist"]').querySelectorAll('[role="tab"]'),
    ];
    const i = tabs.indexOf(e.target),
      next =
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? tabs.length - 1
            : (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) %
              tabs.length;
    e.preventDefault();
    tabs[next].click();
    document.querySelectorAll('[role="tablist"] [role="tab"]')[next]?.focus();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    globalSearch();
  }
  if (e.key === "Escape") {
    const menu = document.querySelector("#more-menu");
    if (menu && !menu.hidden) {
      menu.hidden = true;
      document
        .querySelector('[data-action="more"]')
        .setAttribute("aria-expanded", "false");
      document.querySelector('[data-action="more"]').focus();
    }
    if (mobileMenu) {
      mobileMenu = false;
      render();
      document.querySelector('[data-action="mobile-menu"]')?.focus();
    }
  }
  if (e.target.id === "global-search") {
    const options = [...document.querySelectorAll(".command-result")];
    if (["ArrowDown", "ArrowUp"].includes(e.key)) {
      e.preventDefault();
      searchIndex = Math.max(
        0,
        Math.min(
          options.length - 1,
          searchIndex + (e.key === "ArrowDown" ? 1 : -1),
        ),
      );
      options.forEach((o, i) =>
        o.classList.toggle("keyboard-selected", i === searchIndex),
      );
      options[searchIndex]?.scrollIntoView({ block: "nearest" });
    }
    if (e.key === "Enter") {
      e.preventDefault();
      (options[searchIndex] || options[0])?.click();
    }
  }
  if (
    e.target.closest("#more-menu") &&
    ["ArrowDown", "ArrowUp"].includes(e.key)
  ) {
    e.preventDefault();
    const list = [...document.querySelectorAll("#more-menu a")],
      i = list.indexOf(document.activeElement);
    list[
      (i + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length
    ].focus();
  }
});
document.addEventListener("dragstart", (e) => {
  const task = e.target.closest("[data-drag-id]"),
    rank = e.target.closest("[data-rank-drag]");
  if (task) dragged = `task:${task.dataset.dragId}`;
  else if (rank) dragged = `rank:${rank.dataset.rankDrag}`;
  else return;
  e.dataTransfer.setData("text/plain", dragged);
  e.dataTransfer.effectAllowed = "move";
  e.target.classList.add("dragging");
});
document.addEventListener("dragend", () =>
  document
    .querySelectorAll(".dragging")
    .forEach((e) => e.classList.remove("dragging")),
);
document.addEventListener("dragover", (e) => {
  if (e.target.closest("[data-drop-status],[data-drop-task],[data-rank-drop]"))
    e.preventDefault();
});
document.addEventListener("drop", (e) => {
  e.preventDefault();
  const value = e.dataTransfer.getData("text/plain"),
    [kind, id] = value.split(":");
  if (kind === "task") {
    const column = e.target.closest("[data-drop-status]"),
      target = e.target.closest("[data-drop-task]");
    if (column)
      mutate(() => {
        const task = state.tasks.find((t) => t.id === id);
        if (task) transitionTask(task, column.dataset.dropStatus);
      });
    else if (target)
      mutate(() => {
        const from = state.tasks.findIndex((t) => t.id === id),
          to = state.tasks.findIndex((t) => t.id === target.dataset.dropTask);
        if (from >= 0 && to >= 0) {
          const [item] = state.tasks.splice(from, 1);
          state.tasks.splice(to, 0, item);
        }
      });
  } else if (kind === "rank") {
    const target = e.target.closest("[data-rank-drop]");
    if (target)
      mutate(() => {
        const list = state.questbridge.ranking,
          from = list.indexOf(id),
          to = list.indexOf(target.dataset.rankDrop);
        if (from >= 0 && to >= 0) {
          const [item] = list.splice(from, 1);
          list.splice(to, 0, item);
        }
      });
  }
});
window.addEventListener("hashchange", () => {
  closeDialog();
  route = location.hash.slice(1) || "home";
  mobileMenu = false;
  workspaceTab = "Overview";
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
});
window.addEventListener("storage", (e) => {
  if (e.key === STORAGE_KEY) {
    try {
      state = loadState();
      render();
      toast("Workspace updated from another tab.");
    } catch {
      toast("Another tab saved data this version could not read.");
    }
  }
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (state.profile.theme === "system") render();
});
window.addEventListener("error", () =>
  toast(
    "Something didn’t open correctly. Your saved data is still in this browser.",
  ),
);
const planner = createPlanner({
  getState: () => state,
  mutate,
  render,
  header,
  btn,
  ibtn,
  field,
  select,
  textarea,
  formDialog,
  dialog,
  closeDialog,
  toast,
  navigate,
});
const extras = createExtras({
  getState: () => state,
  mutate,
  render,
  header,
  empty,
  btn,
  ibtn,
  badge,
  field,
  select,
  textarea,
  appSelect,
  formDialog,
  dialog,
  toast,
  csv,
  completeTask,
  openEssay: (id) => {
    selectedEssay = id;
    navigate("essays");
  },
});
let deviceSync = createDeviceSync({getState:()=>state,render,header,btn,field,formDialog,toast,isLocked:isPrivacyLocked,applyRemote:workspace=>{try{if(storageReadFailed)return false;const next=parseWorkspaceBackup(JSON.stringify(workspace));localStorage.setItem("ascend.before-last-sync.v1",JSON.stringify(state));persistState(next);state=next;applyTheme();return true;}catch{return false;}}});
const studio = createWorkspaceTools({getState:()=>state,mutate,render,header,btn,ibtn,field,select,textarea,appSelect,formDialog,dialog,closeDialog,toast,csv});
window.addEventListener("ascend:unlock",()=>{render();deviceSync.sync();});
render();deviceSync.start();
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("./sw.js").catch(() => {});

function searchRank(query, c) {
  const q = query.toLowerCase().trim(),
    name = c.name.toLowerCase(),
    aliases = (c.aliases || [])
      .join(",")
      .toLowerCase()
      .split(/[,;|]/)
      .map((s) => s.trim());
  return name === q || aliases.includes(q)
    ? 100
    : name.startsWith(q)
      ? 80
      : name
            .split(/\s+/)
            .filter((w) => !["of", "the", "at", "and"].includes(w))
            .map((w) => w[0])
            .join("") === q
        ? 95
        : name.includes(q)
          ? 50
          : 10;
}

function advancedDirectoryControls() {
  const d = directoryAdvanced;
  return (
    '<details class="directory-advanced"><summary>More ways to find your fit</summary><div class="advanced-grid">' +
    [
      [
        "level",
        "Degree level",
        [
          ["", "Any degree level"],
          ["4-year or above", "Four-year or above"],
          ["2-year", "Two-year"],
          ["Less than 2-year", "Certificate / shorter programs"],
        ],
      ],
      [
        "setting",
        "Campus setting",
        [
          ["", "Any campus setting"],
          ["City", "City"],
          ["Suburb", "Suburb"],
          ["Town", "Town"],
          ["Rural", "Rural"],
        ],
      ],
    ]
      .map(
        ([k, label, options]) =>
          '<label class="field"><span>' +
          label +
          '</span><select data-directory-advanced="' +
          k +
          '">' +
          options
            .map(
              ([v, t]) =>
                '<option value="' +
                v +
                '" ' +
                (v === d[k] ? "selected" : "") +
                ">" +
                t +
                "</option>",
            )
            .join("") +
          "</select></label>",
      )
      .join("") +
    [
      ["maxTuition", "Max annual out-of-state tuition ($)"],
      ["minSize", "Min undergraduate enrollment"],
      ["maxSize", "Max undergraduate enrollment"],
      ["minGrad", "Min graduation rate (%)"],
      ["maxAdmission", "Max admission rate (%)"],
    ]
      .map(
        ([k, label]) =>
          '<label class="field"><span>' +
          label +
          '</span><input type="number" min="0" ' +
          (k.includes("Grad") || k.includes("Admission") ? 'max="100"' : "") +
          ' data-directory-advanced="' +
          k +
          '" value="' +
          h(d[k]) +
          '" placeholder="Any"></label>',
      )
      .join("") +
    '</div><p class="muted">Tuition: 2025–26 · Undergraduates & admissions: fall 2024. Missing figures are excluded when a numeric filter is active. Program offerings and current test policies must be checked with the institution.</p></details>'
  );
}
function matchesAdvanced(c) {
  const d = directoryAdvanced;
  return (
    (!d.level || c.level === d.level) &&
    (!d.setting || c.campusSetting === d.setting) &&
    (!d.maxTuition ||
      (c.tuitionOut != null && c.tuitionOut <= Number(d.maxTuition))) &&
    (!d.minSize ||
      (c.enrollment != null && c.enrollment >= Number(d.minSize))) &&
    (!d.maxSize ||
      (c.enrollment != null && c.enrollment <= Number(d.maxSize))) &&
    (!d.minGrad ||
      (c.graduationRate != null &&
        c.graduationRate * 100 >= Number(d.minGrad))) &&
    (!d.maxAdmission ||
      (c.admissionRate != null &&
        c.admissionRate * 100 <= Number(d.maxAdmission)))
  );
}
