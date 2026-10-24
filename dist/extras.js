import {
  uid,
  today,
  parseDate,
  localDate,
  dateLabel,
  daysUntil,
  calendarEvents,
  escapeHTML as h,
  download,
  words,
} from "./core.js";
import { budgetTotals, backwardPlan, essayInsights } from "./planning.js";
import { icon } from "./icons.js";

// All tools operate on the existing workspace and use its transactional save path.
export function createExtras(ctx) {
  const {
    getState,
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
  } = ctx;
  const money = (v) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(v) || 0);
  let weekOffset = 0,
    showArchived = false,
    lastPage = "";
  const config = {
    activities: {
      name: "Activities",
      single: "activity",
      icon: "users",
      description:
        "Keep a reusable record of your roles, time commitments, and impact.",
      fields: (r) =>
        `${field("Activity / position", "title", r.title, "text", 'required maxlength="120"')}${field("Organization", "organization", r.organization, "text", 'maxlength="160"')}${select("Category", "category", ["Academic", "Arts", "Athletics", "Community service", "Employment", "Family responsibilities", "Leadership", "Research", "Other"], r.category || "Other")}${field("Grades / years", "grades", r.grades, "text", 'maxlength="80" placeholder="9, 10, 11, 12"')}${field("Hours per week", "hours", r.hours, "number", 'min="0" max="168" step="0.5"')}${field("Weeks per year", "weeks", r.weeks, "number", 'min="0" max="52"')}${textarea("Impact and responsibilities", "description", r.description, 'maxlength="2000" data-character-count="true" placeholder="What did you contribute? What changed?"')}`,
    },
    honors: {
      name: "Honors",
      single: "honor",
      icon: "award",
      description: "Save awards and recognition alongside your activities.",
      fields: (r) =>
        `${field("Honor / award", "title", r.title, "text", 'required maxlength="180"')}${field("Organization", "organization", r.organization, "text", 'maxlength="160"')}${select("Recognition level", "level", ["School", "Local", "Regional", "State", "National", "International", "Other"], r.level || "School")}${field("Grades / years", "grades", r.grades, "text", 'maxlength="80"')}${textarea("Details", "description", r.description, 'maxlength="2000"')}`,
    },
    visits: {
      name: "Visits & interviews",
      single: "visit or interview",
      icon: "pin",
      description:
        "Prepare questions, plan the details, and capture what you learn.",
      fields: (r) =>
        `${field("Event title", "title", r.title, "text", 'required maxlength="180"')}${appSelect(r.applicationId)}${select("Event type", "category", ["Campus visit", "Virtual tour", "Information session", "Interview", "College fair", "Other"], r.category || "Campus visit")}${select("Status", "status", ["Planning", "Booked", "Done", "Canceled"], r.status || "Planning")}${field("Date", "due", r.due, "date")}${field("Time (your local time)", "time", r.time, "time")}${field("Location / meeting details", "location", r.location, "text", 'maxlength="300"')}${field("Contact / host", "contact", r.contact, "text", 'maxlength="180"')}${textarea("Questions to ask (one per line)", "questions", r.questions, 'maxlength="5000"')}${textarea("Reflections and follow-up", "reflection", r.reflection, 'maxlength="10000"')}`,
    },
    tests: {
      name: "Testing plan",
      single: "test",
      icon: "book",
      description:
        "Track dates, preparation goals, and scores you enter yourself.",
      fields: (r) =>
        `${field("Test / exam name", "title", r.title, "text", 'required maxlength="160" placeholder="SAT, ACT, AP, or another exam"')}${field("Subject / sections", "subject", r.subject, "text", 'maxlength="180"')}${field("Exam date", "due", r.due, "date")}${select("Status", "status", ["Planning", "Registered", "Preparing", "Done", "Canceled"], r.status || "Planning")}${field("Score / section scores", "score", r.score, "text", 'maxlength="180" placeholder="Enter your own scores"')}${field("Target score", "target", r.target, "text", 'maxlength="120"')}${textarea("Preparation plan and score-send notes", "notes", r.notes, 'maxlength="10000"')}`,
    },
    expenses: {
      name: "Application budget",
      single: "expense",
      icon: "wallet",
      description:
        "Track application fees, score reports, travel, and fee waivers.",
      fields: (r) =>
        `${field("Expense", "title", r.title, "text", 'required maxlength="180"')}${appSelect(r.applicationId)}${select("Category", "category", ["Application fee", "Testing", "Score report", "Travel", "Documents", "Other"], r.category || "Application fee")}${field("Amount (USD)", "amount", r.amount, "number", 'required min="0" max="1000000" step="0.01"')}${select("Status", "status", ["Planned", "Paid", "Waived"], r.status || "Planned")}${field("Payment / due date", "due", r.due, "date")}${textarea("Notes", "notes", r.notes, 'maxlength="5000"')}`,
    },
    goals: {
      name: "Weekly goals",
      single: "goal",
      icon: "tasks",
      description: "Choose a few outcomes for the week.",
      fields: (r) =>
        `${field("Goal", "title", r.title, "text", 'required maxlength="180"')}${field("Target date", "due", r.due || today(), "date")}${appSelect(r.applicationId)}${select("Status", "status", ["To do", "In Progress", "Done"], r.status || "To do")}${textarea("What does finished look like?", "notes", r.notes, 'maxlength="5000"')}`,
    },
    contacts: {
      name: "People & outreach",
      single: "contact",
      icon: "users",
      description:
        "Keep counselors, recommenders, and college contacts organized.",
      fields: (r) =>
        `${field("Name", "title", r.title, "text", 'required maxlength="180"')}${select("Role", "role", ["Counselor", "Teacher", "Admissions contact", "Alumni interviewer", "Mentor", "Other"], r.role || "Other")}${appSelect(r.applicationId)}${field("Organization", "organization", r.organization, "text", 'maxlength="180"')}${field("Email", "email", r.email, "email", 'maxlength="180"')}${field("Phone", "phone", r.phone, "tel", 'maxlength="80"')}${field("Next follow-up", "due", r.due, "date")}${select("Status", "status", ["To contact", "Waiting for reply", "Follow up", "Complete"], r.status || "To contact")}${textarea("Conversation log (date + notes)", "history", r.history, 'maxlength="15000"')}${textarea("Notes", "notes", r.notes, 'maxlength="10000"')}`,
    },
  };
  const state = () => getState();
  const collection = (key) => state()[key] || [];
  const college = (r) =>
    state().applications.find((a) => a.id === r.applicationId)?.name || "";
  const active = (key) =>
    collection(key).filter((r) => (showArchived ? !!r.archived : !r.archived));
  const tools = (key, r) =>
    `${ibtn("edit", `Edit ${r.title}`, `extra-form:${key}/${r.id}`)}${ibtn(r.archived ? "plus" : "archive", r.archived ? "Restore record" : "Archive record", `extra-archive:${key}/${r.id}`)}`;
  function form(key, id = "") {
    const c = config[key];
    if (!c) return;
    const r = collection(key).find((r) => r.id === id) || {};
    formDialog(
      `${id ? "Edit" : "Add"} ${c.single}`,
      c.fields(r),
      (v) => {
        for (const name of ["amount", "hours", "weeks"])
          if (v[name] !== undefined && v[name] !== "")
            v[name] = Number(v[name]);
        if (key === "visits")
          v.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return mutate(
          () => {
            if (id) Object.assign(r, v, { updated: Date.now() });
            else state()[key].push({ ...v, id: uid(), created: Date.now() });
          },
          `${c.single[0].toUpperCase() + c.single.slice(1)} saved`,
        );
      },
      "Save",
      true,
    );
  }
  function toolbar(key) {
    return `<div class="toolbar"><span class="muted">${active(key).length} ${showArchived ? "archived " : ""}${active(key).length === 1 ? "record" : "records"}</span><div class="button-group">${btn(showArchived ? "Show active" : "Show archived", "extra-archived", "ghost", "archive")}${btn("Export CSV", `extra-csv:${key}`, "ghost", "download")}</div></div>`;
  }
  function cards(key) {
    const c = config[key],
      list = active(key);
    return list.length
      ? `<div class="collection-grid">${list
          .map(
            (r) =>
              `<article class="collection-card"><div class="collection-heading"><span class="tool-symbol ${key === "visits" ? "lavender" : "blue"}">${icon(c.icon)}</span><div class="button-group">${tools(key, r)}</div></div><div class="eyebrow">${h(r.category || r.role || r.level || "")}</div><h3>${h(r.title)}</h3>${college(r) ? `<p class="collection-college">${h(college(r))}</p>` : ""}${r.organization ? `<p>${h(r.organization)}</p>` : ""}<div class="collection-meta">${r.status ? badge(r.status) : ""}${r.due ? `<span>${icon("calendar")}${dateLabel(r.due, true)}${r.time ? ` · ${h(r.time)}` : ""}</span>` : ""}</div>${key === "activities" ? `<div class="activity-facts"><span>${h(r.grades || "Years not set")}</span><span>${Number(r.hours) || 0} h/wk · ${Number(r.weeks) || 0} wk/yr</span></div>` : ""}${key === "tests" ? `<div class="score-pair"><div><small>Your score</small><strong>${h(r.score || "—")}</strong></div><div><small>Target</small><strong>${h(r.target || "—")}</strong></div></div>` : ""}${key === "expenses" ? `<div class="expense-amount">${money(r.amount)}</div>` : ""}${r.location ? `<p>${icon("pin")} ${h(r.location)}</p>` : ""}${r.email ? `<p class="contact-detail">${h(r.email)}${r.phone ? `<br>${h(r.phone)}` : ""}</p>` : ""}${r.description || r.notes ? `<p class="collection-description">${h(r.description || r.notes)}</p>` : ""}${
                r.questions
                  ? `<details><summary>Questions to ask</summary><ul>${r.questions
                      .split("\n")
                      .filter(Boolean)
                      .map((q) => `<li>${h(q)}</li>`)
                      .join("")}</ul></details>`
                  : ""
              }${r.reflection ? `<details><summary>Reflections & follow-up</summary><p class="preserve-lines">${h(r.reflection)}</p></details>` : ""}${r.history ? `<details><summary>Conversation log</summary><p class="preserve-lines">${h(r.history)}</p></details>` : ""}${key === "activities" ? `<div class="card-footer">${btn("Move up", `extra-up:${key}/${r.id}`, "ghost", "chevron")}<small>${(r.description || "").length} characters</small></div>` : ""}</article>`,
          )
          .join("")}</div>`
      : empty(
          c.icon,
          showArchived
            ? "No archived records"
            : `No ${c.name.toLowerCase()} yet`,
          c.description,
          btn(`Add ${c.single}`, `extra-form:${key}`, "secondary", "plus"),
        );
  }
  function budget() {
    const sums = budgetTotals(collection("expenses"));
    const cap = Number(state().profile.budgetLimit) || 0,
      committed = sums.paid + sums.planned;
    return `<section class="budget-summary panel"><div><span class="eyebrow">APPLICATION SPENDING</span><strong class="budget-total">${money(committed)}</strong><p>Paid + planned · excludes waived fees</p>${cap ? `<div class="progress-track"><i style="width:${Math.min(100, (committed / cap) * 100)}%"></i></div><small>${money(Math.max(0, cap - committed))} remaining of ${money(cap)}${committed > cap ? ` · ${money(committed - cap)} over budget` : ""}</small>` : ""}</div><div class="budget-breakdown"><div><span>Paid</span><strong>${money(sums.paid)}</strong></div><div><span>Planned</span><strong>${money(sums.planned)}</strong></div><div><span>Fees waived</span><strong>${money(sums.waived)}</strong></div>${btn("Set budget", "extra-budget", "secondary", "edit")}</div></section>`;
  }
  function activitiesPage() {
    return (
      header(
        "Activities & honors",
        "A reusable record of what you do and the impact you make.",
        `<div class="button-group">${btn("Export résumé", "extra-resume", "secondary", "download")}${btn("Add activity", "extra-form:activities", "primary", "plus")}</div>`,
      ) +
      `<section class="panel">${toolbar("activities")}${cards("activities")}</section><section class="panel"><div class="panel-heading"><div><h2>Honors & recognition</h2><p>Awards, achievements, and the context behind them.</p></div>${btn("Add honor", "extra-form:honors", "secondary", "plus")}</div>${cards("honors")}</section>`
    );
  }
  function recordPage(key) {
    const c = config[key];
    return (
      header(
        c.name,
        c.description,
        btn(`Add ${c.single}`, `extra-form:${key}`, "primary", "plus"),
      ) +
      (key === "expenses" ? budget() : "") +
      `<section class="panel">${toolbar(key)}${cards(key)}</section>`
    );
  }
  function planner() {
    const start = parseDate(today());
    start.setDate(
      start.getDate() - ((start.getDay() + 6) % 7) + weekOffset * 7,
    );
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return localDate(d);
    });
    const events = calendarEvents(state()).filter(
      (e) => e.date >= dates[0] && e.date <= dates[6],
    );
    const goals = collection("goals").filter(
      (g) =>
        !g.archived && (!g.due || (g.due >= dates[0] && g.due <= dates[6])),
    );
    const overdue = state().tasks.filter(
      (t) =>
        !t.archived && t.status !== "Done" && t.due && daysUntil(t.due) < 0,
    );
    return (
      header(
        "Weekly planner",
        "See your commitments, set a few goals, and make room for focused work.",
        btn("Plan an application", "extra-plan", "secondary", "calendar"),
      ) +
      `<div class="planner-layout"><section class="panel weekly-panel"><div class="panel-heading"><div><h2>${dateLabel(dates[0])} – ${dateLabel(dates[6], true)}</h2><p>${events.length} scheduled items this week</p></div><div class="button-group">${ibtn("chevron", "Previous week", "extra-week:-1")}${btn("This week", "extra-week:0", "ghost")}${ibtn("arrow", "Next week", "extra-week:1")}</div></div><div class="week-strip">${dates
        .map(
          (date, i) =>
            `<div class="week-column ${date === today() ? "is-today" : ""}"><div class="week-date"><span>${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}</span><strong>${parseDate(date).getDate()}</strong>${date === today() ? "<small>Today</small>" : ""}</div><div class="week-items">${
              events
                .filter((e) => e.date === date)
                .map(
                  (e) =>
                    `<button class="week-event ${e.kind === "Application" ? "lavender" : "blue"}" data-action="nav:${e.target}"><small>${h(e.kind)}${e.time ? ` · ${h(e.time)}` : ""}</small><strong>${h(e.title)}</strong></button>`,
                )
                .join("") || '<span class="free-day">No items</span>'
            }</div></div>`,
        )
        .join(
          "",
        )}</div></section><section class="panel weekly-goals"><div class="panel-heading"><div><h2>Weekly goals</h2><p>${goals.filter((g) => g.status === "Done").length} of ${goals.length} completed</p></div>${ibtn("plus", "Add goal", "extra-form:goals")}</div>${goals.map((g) => `<div class="goal-row"><button class="task-check ${g.status === "Done" ? "checked" : ""}" data-action="extra-goal:${g.id}" aria-label="${g.status === "Done" ? "Reopen" : "Complete"} ${h(g.title)}">${g.status === "Done" ? icon("check") : ""}</button><button class="goal-title ${g.status === "Done" ? "completed-text" : ""}" data-action="extra-form:goals/${g.id}">${h(g.title)}<small>${dateLabel(g.due)}</small></button>${ibtn("archive", "Archive goal", `extra-archive:goals/${g.id}`)}</div>`).join("") || '<div class="compact-empty"><p>Choose one or two outcomes to focus on.</p></div>'}<a href="#goals" class="text-link">All goals ${icon("arrow")}</a></section><section class="panel overdue-panel"><div class="panel-heading"><div><h2>Needs attention</h2><p>${overdue.length} overdue tasks</p></div>${btn("Create task", "add-task", "ghost", "plus")}</div>${
        overdue
          .slice(0, 5)
          .map(
            (t) =>
              `<div class="goal-row"><button class="task-check" data-action="complete-task:${t.id}" aria-label="Complete ${h(t.title)}"></button><button class="goal-title" data-action="edit-task:${t.id}">${h(t.title)}<small>${dateLabel(t.due)} · ${Math.abs(daysUntil(t.due))} days overdue</small></button></div>`,
          )
          .join("") ||
        '<div class="compact-empty"><span class="tool-symbol mint">' +
          icon("check") +
          "</span><p>No overdue tasks.</p></div>"
      }</section></div>`
    );
  }
  function planForm() {
    const apps = state().applications.filter((a) => !a.archived);
    if (!apps.length) {
      toast("Add an application with a deadline first.");
      return;
    }
    formDialog(
      "Build a backward plan",
      `${appSelect(apps[0].id)}<div class="full info-note">Creates six editable tasks at 6, 4, 3, 2, and 1 week, and 2 days before your saved application deadline. Past dates are kept visible so you can adjust them. Existing tasks with the same title are skipped.</div>`,
      (v) => {
        const a = apps.find((a) => a.id === v.applicationId);
        if (!a) throw new Error("Choose an application.");
        const tasks = backwardPlan(a.deadline, a.name);
        return mutate(() => {
          for (const t of tasks)
            if (
              !state().tasks.some(
                (x) => x.applicationId === a.id && x.title === t.title,
              )
            )
              state().tasks.push({
                id: uid(),
                title: t.title,
                due: t.due,
                applicationId: a.id,
                status: "To do",
                priority: "Medium",
                recurrence: "Never",
                subtasks: [],
                created: Date.now(),
              });
        }, "Application plan added to Tasks");
      },
      "Create six-task plan",
    );
  }
  function review(id) {
    const e = state().essays.find((e) => e.id === id);
    if (!e) return;
    const s = essayInsights(e.body, e.limit);
    dialog(
      `<div class="dialog-heading"><div><span class="eyebrow">ON-DEVICE WRITING TOOLS</span><h2>Review your draft</h2></div>${ibtn("x", "Close review", "close-dialog")}</div><p class="body-copy">${h(e.title)} · Text analysis runs in your browser.</p><div class="insight-grid">${[
        [s.count, "Words"],
        [s.characters, "Characters"],
        [s.paragraphs, "Paragraphs"],
        [`${s.readingMinutes} min`, "Reading time"],
      ]
        .map(([v, l]) => `<div><strong>${v}</strong><small>${l}</small></div>`)
        .join(
          "",
        )}</div>${s.remaining !== null ? `<div class="info-note ${s.remaining < 0 ? "danger-text" : ""}">${s.remaining < 0 ? `${-s.remaining} words over` : `${s.remaining} words remaining in`} your ${h(e.limit)}-word limit.</div>` : ""}<h3>Repeated words</h3><p class="body-copy">Words longer than three letters used at least three times, with common words filtered out. Repetition can be intentional.</p><div class="keyword-chips">${s.repeated.map(([w, n]) => `<span>${h(w)} <b>${n}</b></span>`).join("") || "<span>No frequent words detected.</span>"}</div><h3>Revision checklist</h3><div class="review-checklist">${["The opening gives a specific moment or detail.", "The draft shows my actions and perspective.", "Reflection explains why this experience matters.", "Every paragraph supports the prompt.", "Names and college-specific details are correct.", "I read it aloud and checked the word limit."].map((t, i) => `<label><input type="checkbox" data-review="${id}/${i}" ${e.reviewChecks?.includes(i) ? "checked" : ""}>${t}</label>`).join("")}</div><p class="body-copy">These are editing aids, not an admissions score or a prediction.</p>`,
      true,
    );
  }
  function prompts() {
    const ideas = [
      [
        "A small turning point",
        "Describe a moment that changed how you approach a familiar problem.",
      ],
      [
        "Something you keep doing",
        "What do you return to even when nobody asks you to? What keeps you interested?",
      ],
      [
        "A contribution",
        "Tell the story of a specific contribution to your family, school, work, or community.",
      ],
      [
        "A question worth following",
        "What question led you to investigate, build, read, or try something new?",
      ],
      [
        "A changed perspective",
        "When did listening carefully change your mind?",
      ],
      [
        "A place or tradition",
        "What place or routine holds meaning for you, and why?",
      ],
    ];
    dialog(
      `<div class="dialog-heading"><div><span class="eyebrow">BRAINSTORMING</span><h2>Start with a memory</h2></div>${ibtn("x", "Close ideas", "close-dialog")}</div><p class="body-copy">Original brainstorming exercises, not official application prompts. Choose one to create an editable draft.</p><div class="prompt-grid">${ideas.map(([title, prompt], i) => `<button data-action="extra-prompt:${i}" class="prompt-card"><strong>${title}</strong><p>${prompt}</p><span class="text-link">Start a draft ${icon("arrow")}</span></button>`).join("")}</div>`,
      true,
    );
    return ideas;
  }
  const promptIdeas = [
    [
      "A small turning point",
      "Describe a moment that changed how you approach a familiar problem.",
    ],
    [
      "Something you keep doing",
      "What do you return to even when nobody asks you to? What keeps you interested?",
    ],
    [
      "A contribution",
      "Tell the story of a specific contribution to your family, school, work, or community.",
    ],
    [
      "A question worth following",
      "What question led you to investigate, build, read, or try something new?",
    ],
    ["A changed perspective", "When did listening carefully change your mind?"],
    [
      "A place or tradition",
      "What place or routine holds meaning for you, and why?",
    ],
  ];
  async function handle(action, arg) {
    const [key, id] = arg.split("/");
    switch (action) {
      case "extra-form":
        form(key, id);
        break;
      case "extra-archived":
        showArchived = !showArchived;
        render();
        break;
      case "extra-archive":
        if (!config[key]) break;
        mutate(() => {
          const r = collection(key).find((r) => r.id === id);
          if (r) r.archived = !r.archived;
        }, "Record updated");
        break;
      case "extra-up":
        mutate(() => {
          const a = collection(key),
            i = a.findIndex((r) => r.id === id);
          if (i > 0) [a[i - 1], a[i]] = [a[i], a[i - 1]];
        });
        break;
      case "extra-week":
        weekOffset = arg === "0" ? 0 : weekOffset + Number(arg);
        render();
        break;
      case "extra-goal":
        mutate(() => {
          const g = collection("goals").find((g) => g.id === key);
          if (g) g.status = g.status === "Done" ? "To do" : "Done";
        });
        break;
      case "extra-plan":
        planForm();
        break;
      case "extra-review":
        review(arg);
        break;
      case "extra-prompts":
        prompts();
        break;
      case "extra-prompt": {
        const idea = promptIdeas[Number(arg)];
        if (!idea) break;
        const eid = uid();
        if (
          mutate(
            () =>
              state().essays.push({
                id: eid,
                title: idea[0],
                prompt: idea[1],
                body: "",
                category: "Personal statement",
                limit: 650,
                tags: "Brainstorm",
                versions: [],
                updated: Date.now(),
              }),
            "Brainstorm draft created",
            false,
          )
        )
          ctx.openEssay(eid);
        break;
      }
      case "extra-budget":
        formDialog(
          "Set your application budget",
          field(
            "Budget limit (USD)",
            "budgetLimit",
            state().profile.budgetLimit || "",
            "number",
            'required min="0" max="10000000" step="0.01"',
          ),
          (v) =>
            mutate(
              () => (state().profile.budgetLimit = Number(v.budgetLimit)),
              "Budget saved",
            ),
        );
        break;
      case "extra-csv": {
        if (!config[key]) break;
        const fields = [
          ...new Set(collection(key).flatMap(Object.keys)),
        ].filter((k) => !["id", "created", "updated"].includes(k));
        download(
          `ascend-${key}.csv`,
          csv([
            fields,
            ...collection(key).map((r) => fields.map((f) => r[f] ?? "")),
          ]),
          "text/csv",
        );
        break;
      }
      case "extra-resume": {
        const body = [
          state().profile.name || "Activities & honors",
          state().profile.highSchool || "",
          `Class of ${state().profile.graduation || "—"}`,
          "",
          "ACTIVITIES",
          ...collection("activities")
            .filter((r) => !r.archived)
            .flatMap((r) => [
              `${r.title}${r.organization ? ` — ${r.organization}` : ""}`,
              `${r.grades || ""} · ${Number(r.hours) || 0} hours/week · ${Number(r.weeks) || 0} weeks/year`,
              r.description || "",
              "",
            ]),
          "HONORS",
          ...collection("honors")
            .filter((r) => !r.archived)
            .flatMap((r) => [
              r.title,
              `${r.level || ""} · ${r.grades || ""}`,
              r.description || "",
              "",
            ]),
        ].join("\n");
        dialog(
          `<div class="dialog-heading"><h2>Export activities résumé</h2>${ibtn("x", "Close export", "close-dialog")}</div><pre class="text-preview">${h(body)}</pre><div class="button-group">${btn("Download TXT", "extra-resume-txt", "primary", "download")}${btn("Download DOCX", "extra-resume-docx", "secondary", "download")}</div>`,
          true,
        );
        break;
      }
      case "extra-resume-txt":
        download(
          "ascend-activities-resume.txt",
          document.querySelector(".text-preview").textContent,
        );
        break;
      case "extra-resume-docx": {
        const { makeDocx } = await import("./exports.js");
        download(
          "ascend-activities-resume.docx",
          makeDocx(
            "Activities & honors",
            document.querySelector(".text-preview").textContent,
          ),
        );
        break;
      }
      default:
        return false;
    }
    return true;
  }
  document.addEventListener("change", (e) => {
    if (e.target.dataset.review) {
      const [id, i] = e.target.dataset.review.split("/");
      mutate(
        () => {
          const essay = state().essays.find((x) => x.id === id);
          if (!essay) return;
          const checks = new Set(essay.reviewChecks || []);
          e.target.checked ? checks.add(Number(i)) : checks.delete(Number(i));
          essay.reviewChecks = [...checks];
        },
        "",
        false,
      );
    }
  });
  document.addEventListener("input", (e) => {
    if (e.target.dataset.characterCount) {
      let counter = e.target.parentElement.querySelector(".character-count");
      if (!counter) {
        counter = document.createElement("small");
        counter.className = "character-count";
        e.target.after(counter);
      }
      counter.textContent = `${e.target.value.length} characters · ${words(e.target.value)} words`;
    }
  });
  return {
    handle,
    renderPage: (page) => {
      if (lastPage !== page) {
        lastPage = page;
        showArchived = false;
      }
      return page === "planner"
        ? planner()
        : page === "activities"
          ? activitiesPage()
          : config[page]
            ? recordPage(page)
            : null;
    },
  };
}
