import {TOOL_KEYS,validateTools} from "./workspace-tools-model.js";
import {
  expandPersonalEvents,
  calendarFile,
  shiftDate,
  validDate,
  validTime,
} from "./calendar-model.js";
export const STORAGE_KEY = "ascend.workspace.v1";
export const STATUSES = [
  "Considering",
  "Not Started",
  "In Progress",
  "Ready to Submit",
  "Submitted",
  "Awaiting Decision",
  "Accepted",
  "Waitlisted",
  "Rejected",
  "Withdrawn",
];
export const ROUNDS = [
  "Regular Decision",
  "Early Action",
  "Early Decision",
  "Early Decision II",
  "Restrictive Early Action",
  "Rolling Admission",
  "QuestBridge Match",
  "Transfer",
  "Custom",
];
export const PATHWAYS = [
  "Common Application",
  "Coalition Application",
  "QuestBridge National College Match",
  "QuestBridge Regular Decision",
  "Direct Institutional Application",
  "UC Application",
  "State University System",
  "Other / Custom",
];
export const SECTIONS = [
  "Overview",
  "Requirements",
  "Essays",
  "Recommendations",
  "Documents",
  "Financial Aid",
  "Notes",
  "Decision",
];
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `a${Date.now()}${Math.random().toString(36).slice(2)}`;
export const today = () => localDate(new Date());
export function localDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function parseDate(s) {
  return s ? new Date(`${s.slice(0, 10)}T12:00:00`) : null;
}
export function dateLabel(s, year = false) {
  const d = parseDate(s);
  return d && !isNaN(d)
    ? d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        ...(year ? { year: "numeric" } : {}),
      })
    : "No date set";
}
export function daysUntil(s) {
  return s ? Math.round((parseDate(s) - parseDate(today())) / 86400000) : null;
}
export function dueLabel(s) {
  const n = daysUntil(s);
  return n === null
    ? "No deadline"
    : n < 0
      ? `${-n}d overdue`
      : n === 0
        ? "Due today"
        : n === 1
          ? "Tomorrow"
          : `In ${n} days`;
}
export const escapeHTML = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const money = (v) =>
  v === undefined || v === null || v === ""
    ? "Not available"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(Number(v));
export const words = (v) =>
  String(v || "")
    .trim()
    .split(/\s+/u)
    .filter(Boolean).length;
export function safeUrl(value) {
  try {
    const u = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return ["http:", "https:"].includes(u.protocol) ? u.href : "";
  } catch {
    return "";
  }
}
export function progress(app) {
  const list = (app.requirements || []).filter(
    (r) => r.required !== false && !r.exempt,
  );
  const total = list.reduce((n, r) => n + Number(r.weight || 1), 0);
  const done = list.reduce(
    (n, r) => n + (r.done ? Number(r.weight || 1) : 0),
    0,
  );
  return total ? Math.round((done / total) * 100) : 0;
}
export function blankState() {
  return {
    version: 1,
    profile: {
      name: "",
      graduation: "2027",
      major: "",
      highSchool: "",
      state: "",
      stage: "Getting started",
      questbridge: false,
      theme: "light",
      onboarded: false,
    },
    applications: [],
    tasks: [],
    essays: [],
    documents: [],
    recommendations: [],
    aid: [],
    scholarships: [],
    offers: [],
    notes: [],
    favorites: [],
    compare: [],
    customColleges: [],
    customSchools: [],
    notifications: [],
    activities: [],
    honors: [],
    visits: [],
    tests: [],
    expenses: [],
    goals: [],
    contacts: [],
    events: [],
    dayNotes: [],
    ...Object.fromEntries(TOOL_KEYS.map(k=>[k,[]])),
    questbridge: { status: "Exploring", outcome: "", ranking: [] },
  };
}
const collections = [
  "applications",
  "tasks",
  "essays",
  "documents",
  "recommendations",
  "aid",
  "scholarships",
  "offers",
  "notes",
  "favorites",
  "compare",
  "customColleges",
  "customSchools",
  "notifications",
];
const optionalCollections = [
  ...TOOL_KEYS,
  "activities",
  "honors",
  "visits",
  "tests",
  "expenses",
  "goals",
  "contacts",
  "events",
  "dayNotes",
];
export function validateState(value) {
  if (
    !value ||
    value.version !== 1 ||
    !value.profile ||
    typeof value.profile !== "object" ||
    Array.isArray(value.profile)
  )
    throw new Error("Choose a valid Ascend version 1 backup.");
  for (const key of collections)
    if (!Array.isArray(value[key]))
      throw new Error(`Backup is missing ${key}.`);
  for (const key of optionalCollections)
    if (value[key] !== undefined && !Array.isArray(value[key]))
      throw new Error(`Invalid ${key} collection.`);
  const validId = (id) =>
    typeof id === "string" && /^[a-zA-Z0-9_-]{1,120}$/.test(id);
  for (const key of [...collections, ...optionalCollections].filter(
    (k) => !["favorites", "compare"].includes(k),
  )) {
    const ids = new Set();
    for (const record of value[key] || []) {
      if (
        !record ||
        typeof record !== "object" ||
        !validId(record.id) ||
        ids.has(record.id)
      )
        throw new Error(`Invalid or duplicate ${key} record.`);
      ids.add(record.id);
      for (const reference of ["applicationId", "collegeId", "dependsOn"])
        if (record[reference] && !validId(record[reference]))
          throw new Error(`Invalid ${key} association.`);
      for (const field of [
        "title",
        "name",
        "body",
        "notes",
        "tags",
        "status",
        "category",
        "role",
        "contact",
        "url",
        "city",
        "state",
        "zip",
        "type",
        "folder",
        "organization",
        "description",
        "grades",
        "location",
        "questions",
        "reflection",
        "subject",
        "score",
        "target",
        "email",
        "phone",
        "history",
        "level",
      ])
        if (record[field] != null && typeof record[field] !== "string")
          throw new Error(`Invalid ${key} ${field}.`);
      for (const field of [
        "due",
        "deadline",
        "decisionDate",
        "requested",
        "date",
        "endDate",
        "repeatUntil",
      ]) {
        const date = record[field];
        if (
          date &&
          (typeof date !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            Number.isNaN(parseDate(date)?.getTime()) ||
            localDate(parseDate(date)) !== date)
        )
          throw new Error(`Invalid ${key} date.`);
      }
      for (const field of ["amount", "hours", "weeks"])
        if (
          record[field] != null &&
          (!Number.isFinite(Number(record[field])) ||
            Number(record[field]) < 0 ||
            Number(record[field]) > 10000000)
        )
          throw new Error(`Invalid ${key} ${field}.`);
      for (const field of ["time", "deadlineTime", "endTime"])
        if (
          record[field] &&
          (typeof record[field] !== "string" ||
            !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(record[field]))
        )
          throw new Error(`Invalid ${key} time.`);
    }
  }
  for (const event of value.events || []) {
    if (
      !validDate(event.date) ||
      (event.endDate && event.endDate < event.date) ||
      typeof event.allDay !== "boolean" ||
      typeof event.title !== "string" ||
      (!event.allDay &&
        (!validTime(event.time) || !validTime(event.endTime || event.time))) ||
      (event.repeatUntil && event.repeatUntil < event.date) ||
      (event.repeatInterval != null &&
        (!Number.isInteger(event.repeatInterval) ||
          event.repeatInterval < 1 ||
          event.repeatInterval > 365)) ||
      ["timezone", "sourceUid", "recurrenceId", "calendarSource"].some(
        (k) => event[k] != null && typeof event[k] !== "string",
      ) ||
      !["None", "Daily", "Weekly", "Monthly", "Yearly", "Imported"].includes(
        event.repeat || "None",
      ) ||
      (event.ical &&
        (typeof event.ical !== "string" || event.ical.length > 2000000)) ||
      (event.timezoneDefinitions &&
        (!Array.isArray(event.timezoneDefinitions) ||
          event.timezoneDefinitions.some((s) => typeof s !== "string")))
    )
      throw Error("Invalid calendar event.");
  }
  for (const key of ["favorites", "compare"])
    if (value[key].some((id) => !validId(id)))
      throw new Error("Invalid saved college reference.");
  for (const key of [
    "name",
    "graduation",
    "major",
    "highSchool",
    "state",
    "stage",
    "theme",
  ])
    if (value.profile[key] != null && typeof value.profile[key] !== "string")
      throw new Error("Invalid student profile.");
  for (const app of value.applications) {
    if (
      typeof app.name !== "string" ||
      !Array.isArray(app.requirements) ||
      !Array.isArray(app.statusHistory)
    )
      throw new Error("Invalid application record.");
    const ids = new Set();
    for (const r of app.requirements) {
      if (
        !r ||
        !validId(r.id) ||
        ids.has(r.id) ||
        typeof r.title !== "string" ||
        (r.weight != null &&
          (!Number.isFinite(Number(r.weight)) ||
            Number(r.weight) < 1 ||
            Number(r.weight) > 100)) ||
        (r.dependsOn && !validId(r.dependsOn))
      )
        throw new Error("Invalid checklist requirement.");
      ids.add(r.id);
    }
  }
  for (const essay of value.essays)
    if (
      typeof essay.title !== "string" ||
      typeof essay.body !== "string" ||
      !Array.isArray(essay.versions) ||
      essay.versions.some(
        (v) =>
          !validId(v.id) ||
          typeof v.body !== "string" ||
          !Number.isFinite(v.at),
      )
    )
      throw new Error("Invalid essay draft.");
  for (const essay of value.essays)
    if (
      essay.reviewChecks &&
      (!Array.isArray(essay.reviewChecks) ||
        essay.reviewChecks.some((i) => !Number.isInteger(i) || i < 0 || i > 5))
    )
      throw new Error("Invalid essay revision checklist.");
  for (const activity of value.activities || [])
    if (Number(activity.hours || 0) > 168 || Number(activity.weeks || 0) > 52)
      throw new Error("Invalid activity time commitment.");
  if (
    value.profile.budgetLimit != null &&
    (!Number.isFinite(Number(value.profile.budgetLimit)) ||
      Number(value.profile.budgetLimit) < 0)
  )
    throw new Error("Invalid application budget.");
  for (const task of value.tasks)
    if (
      typeof task.title !== "string" ||
      (task.subtasks && !Array.isArray(task.subtasks))
    )
      throw new Error("Invalid task record.");
  for (const doc of value.documents)
    if (
      typeof doc.data !== "string" ||
      !/^data:(?:application\/(?:pdf|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)|text\/plain|image\/(?:png|jpeg|gif|webp));base64,[A-Za-z0-9+/]*={0,2}$/i.test(
        doc.data,
      ) ||
      !Number.isFinite(doc.size) ||
      doc.size > 1024 * 1024 ||
      doc.size < 0 ||
      typeof doc.name !== "string" ||
      typeof doc.type !== "string"
    )
      throw new Error("Invalid or unsupported document in backup.");
  if (
    value.questbridge &&
    (!Array.isArray(value.questbridge.ranking) ||
      value.questbridge.ranking.some((id) => !validId(id)))
  )
    throw new Error("Invalid QuestBridge ranking.");
  validateTools(value);
  const dw=value.profile.decisionWeights;
  if(dw!=null && (typeof dw!=="object"||Array.isArray(dw)||["academics","affordability","campus","opportunity"].some(k=>typeof dw[k]!=="number"||!Number.isFinite(dw[k])||dw[k]<0||dw[k]>100)||!["academics","affordability","campus","opportunity"].some(k=>dw[k]>0)))throw Error("Choose valid decision weights.");
  const clean = blankState();
  for (const key of [
    ...collections,
    ...optionalCollections,
    "profile",
    "questbridge",
  ])
    if (value[key]) clean[key] = structuredClone(value[key]);
  return clean;
}
export function parseWorkspaceBackup(text) {
  if (typeof text !== "string") throw new Error("Choose a valid backup.");
  if (new Blob([text]).size > 12 * 1024 * 1024)
    throw new Error("Backup is too large (12 MB maximum).");
  return validateState(JSON.parse(text));
}
export function loadState(storage = globalThis.localStorage) {
  const saved = storage.getItem(STORAGE_KEY);
  return saved ? validateState(JSON.parse(saved)) : blankState();
}
export function persistState(value, storage = globalThis.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(value));
}
export function download(name, content, type = "text/plain") {
  const url = URL.createObjectURL(
    content instanceof Blob ? content : new Blob([content], { type }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function nextRecurringDate(date, recurrence) {
  const d = parseDate(date || today());
  if (recurrence === "Daily") d.setDate(d.getDate() + 1);
  else if (recurrence === "Weekly") d.setDate(d.getDate() + 7);
  else if (recurrence === "Monthly") {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    d.setDate(
      Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()),
    );
  }
  return localDate(d);
}
export function calendarEvents(s, range = {}) {
  const items = [];
  for (const a of s.applications)
    if (
      a.deadline &&
      !a.archived &&
      !["Withdrawn", "Rejected"].includes(a.status)
    )
      items.push({
        id: a.id,
        title: `${a.name} application`,
        date: a.deadline,
        time: a.deadlineTime,
        zone: a.timezone,
        kind: "Application",
        target: `application/${a.id}`,
      });
  for (const [key, kind] of [
    ["tasks", "Task"],
    ["aid", "Financial aid"],
    ["scholarships", "Scholarship"],
    ["recommendations", "Recommendation"],
    ["visits", "Visit / interview"],
    ["tests", "Test"],
    ["goals", "Goal"],
    ["contacts", "Follow-up"],
    ["expenses", "Expense"],
    ["assignments", "Assignment"], ["prompts", "Essay prompt"], ["interviewPractice", "Interview practice"],
  ])
    for (const r of s[key] || [])
      if (
        r.due &&
        !r.archived &&
        !r.done &&
        r.status !== "Submitted" &&
        r.status !== "Done" &&
        r.status !== "Canceled" &&
        r.status !== "Complete" &&
        r.status !== "Paid" &&
        r.status !== "Waived"
      )
        items.push({
          id: r.id,
          title: r.title || r.name,
          date: r.due,
          time: r.time,
          zone: r.timezone,
          kind,
          location: r.location || "",
          notes: r.notes || "",
          target:
            key === "tasks"
              ? "tasks"
              : key === "aid"
                ? "financial-aid"
                : key === "goals"
                  ? "planner"
                  : key,
        });
  const personal = expandPersonalEvents(
    s.events || [],
    range.start || shiftDate(today(), -366),
    range.end || shiftDate(today(), 732),
  );
  items.push(...personal.events);
  items.warnings = personal.warnings;
  return items.sort((a, b) =>
    (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")),
  );
}
export function toICS(events, personal = []) {
  return calendarFile(personal, events);
}
export function fuzzyMatch(query, record) {
  const q = query.toLowerCase().trim();
  const name = record.name.toLowerCase();
  const text = [
    name,
    record.city,
    record.state,
    record.zip,
    ...(record.aliases || []),
  ]
    .join(" ")
    .toLowerCase();
  if (text.includes(q)) return true;
  const initials = name
    .split(/\s+/)
    .filter((w) => !["of", "the", "at", "and", "in"].includes(w))
    .map((w) => w[0])
    .join("");
  if (initials === q) return true;
  if (q.length < 4) return false;
  return name
    .split(/\s+/)
    .some((w) => Math.abs(w.length - q.length) <= 1 && editDistance(q, w) <= 1);
}
function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = old;
    }
  }
  return row[b.length];
}
