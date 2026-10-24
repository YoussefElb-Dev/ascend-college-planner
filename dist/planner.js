import {
  uid,
  today,
  dateLabel,
  escapeHTML as h,
  calendarEvents,
  download,
} from "./core.js";
import {
  monthDates,
  weekDates,
  changeMonth,
  shiftDate,
  validDate,
  validTime,
  wallTimeToDate,
  parseCalendar,
  mergeCalendar,
  calendarFile,
} from "./calendar-model.js";
import { icon } from "./icons.js";

export function createPlanner(ctx) {
  const {
    getState,
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
  } = ctx;
  let selected = today(),
    view = "Month",
    filter = "All",
    pendingImport = null,
    lastRoute = "",
    noteTimer,
    noteWrite;
  const categories = [
    "Personal",
    "School",
    "Sports",
    "Work",
    "Appointment",
    "Family",
    "Other",
  ];
  const zone = () =>
    Intl.DateTimeFormat().resolvedOptions().timeZone || "floating";
  const stamp = (d) => new Date(d + "T12:00:00");
  const fullDate = (d) =>
    stamp(d).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  const inDay = (e, d) => e.date <= d && (e.endDate || e.date) >= d;
  const clock = (t) => {
    if (!t) return "All day";
    const [a, b] = t.split(":").map(Number);
    return `${a % 12 || 12}:${String(b).padStart(2, "0")} ${a < 12 ? "AM" : "PM"}`;
  };
  const eventColor = (e) =>
    e.personal
      ? /Sports/.test(e.kind)
        ? "sports"
        : /School|Work/.test(e.kind)
          ? "school"
          : "personal"
      : "college";
  function flushNotes() {
    if (noteTimer) clearTimeout(noteTimer);
    noteTimer = null;
    if (noteWrite) {
      const write = noteWrite;
      noteWrite = null;
      return write();
    }
    return true;
  }
  function entry(e, compact = false) {
    const action = e.personal
      ? "planner-edit:" + e.recordId
      : "nav:" + e.target;
    const title = h(
      e.title + " · " + clock(e.time) + (e.location ? " · " + e.location : ""),
    );
    const top = compact
      ? '<span class="event-clock">' + (e.time ? clock(e.time) : "") + "</span>"
      : "<small>" + h(e.kind) + (e.recurring ? " · Repeats" : "") + "</small>";
    const timeLine =
      clock(e.time) +
      (e.endTime && e.time ? " – " + clock(e.endTime) : "") +
      (e.endDate && e.endDate !== e.date
        ? " · through " + dateLabel(e.endDate)
        : "");
    const detail = compact
      ? ""
      : "<span>" +
        timeLine +
        "</span>" +
        (e.location ? "<span>" + icon("pin") + h(e.location) + "</span>" : "") +
        (e.notes ? '<span class="event-note">' + h(e.notes) + "</span>" : "");
    return (
      '<button class="schedule-event ' +
      eventColor(e) +
      (compact ? " compact" : "") +
      '" data-action="' +
      action +
      '" title="' +
      title +
      '"><span class="event-mark"></span><span class="event-content">' +
      top +
      "<strong>" +
      h(e.title) +
      "</strong>" +
      detail +
      "</span>" +
      (!compact ? icon(e.personal ? "edit" : "arrow") : "") +
      "</button>"
    );
  }
  function dayPanel(events) {
    const list = events.filter((e) => inDay(e, selected));
    const note =
      getState().dayNotes.find((n) => n.date === selected)?.body || "";
    return `<aside class="panel day-detail"><div class="day-detail-head"><div class="eyebrow">${selected === today() ? "TODAY" : "DAY DETAILS"}</div><h2>${stamp(selected).toLocaleDateString(undefined, { weekday: "long" })}</h2><p>${dateLabel(selected, true)}</p></div><div class="day-detail-actions">${btn("Add event", `planner-add:${selected}`, "secondary", "plus")}${btn("Day view", "planner-view:Day", "ghost", "search")}</div><div class="day-agenda">${list.length ? list.map((e) => entry(e)).join("") : '<div class="schedule-empty">No commitments scheduled.<br>Add a class, game, appointment, or personal plan.</div>'}</div><label class="day-note-label" for="day-note">Daily notes</label><textarea id="day-note" data-planner-note="${selected}" maxlength="15000" placeholder="Plans, reminders, meals, a training session…">${h(note)}</textarea><small id="day-note-status" aria-live="polite">Saved only in this browser</small><div class="planner-links"><a href="#goals">Weekly goals ${icon("arrow")}</a><button data-action="extra-plan">Plan from an application deadline ${icon("arrow")}</button></div></aside>`;
  }
  function month(events) {
    const dates = monthDates(selected),
      current = selected.slice(0, 7);
    return `<div class="month-weekdays">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<span>${d}</span>`).join("")}</div><div class="month-grid">${dates
      .map((d) => {
        const list = events.filter((e) => inDay(e, d));
        return `<section class="month-cell ${d.slice(0, 7) !== current ? "outside" : ""} ${d === today() ? "is-today" : ""} ${d === selected ? "is-selected" : ""}" aria-label="${h(fullDate(d))}"><div class="month-cell-head"><button data-action="planner-select:${d}" aria-label="Select ${h(fullDate(d))}" aria-pressed="${d === selected}">${Number(d.slice(-2))}</button><button class="cell-add" data-action="planner-add:${d}" aria-label="Add event on ${h(fullDate(d))}">${icon("plus")}</button></div><div class="cell-events">${list
          .slice(0, 3)
          .map((e) => entry(e, true))
          .join(
            "",
          )}${list.length > 3 ? `<button class="more-events" data-action="planner-day:${d}">+${list.length - 3} more</button>` : ""}</div></section>`;
      })
      .join(
        "",
      )}</div><p class="calendar-hint">Select a date for details. Use Week or Day to zoom in.</p>`;
  }
  function week(events) {
    return `<div class="schedule-week">${weekDates(selected)
      .map(
        (d) =>
          `<section class="schedule-week-day ${d === today() ? "is-today" : ""}"><button class="week-date" data-action="planner-day:${d}"><span>${stamp(d).toLocaleDateString(undefined, { weekday: "short" })}</span><strong>${Number(d.slice(-2))}</strong></button>${events
            .filter((e) => inDay(e, d))
            .map((e) => entry(e))
            .join(
              "",
            )}${btn("Add", `planner-add:${d}`, "ghost", "plus")}</section>`,
      )
      .join("")}</div>`;
  }
  function day(events) {
    const list = events.filter((e) => inDay(e, selected));
    return `<div class="schedule-day"><div class="all-day-row"><span>All day</span><div>${
      list
        .filter((e) => !e.time || e.date < selected)
        .map((e) => entry(e))
        .join("") || "<small>No all-day events</small>"
    }</div></div>${Array.from({ length: 24 }, (_, i) => {
      const time = String(i).padStart(2, "0") + ":00";
      return `<section class="hour-row"><button class="hour-label" data-action="planner-hour:${time}">${clock(time)}</button><div>${list
        .filter(
          (e) =>
            e.date === selected && e.time && Number(e.time.slice(0, 2)) === i,
        )
        .map((e) => entry(e))
        .join("")}</div></section>`;
    }).join("")}</div>`;
  }
  function page(routeDate = "") {
    if (routeDate && routeDate !== lastRoute && validDate(routeDate)) {
      selected = routeDate;
      view = "Day";
    }
    lastRoute = routeDate;
    const dates =
      view === "Month"
        ? monthDates(selected)
        : view === "Week"
          ? weekDates(selected)
          : [selected];
    const all = calendarEvents(getState(), {
      start: dates[0],
      end: dates.at(-1),
    });
    const localEvents = all.map((e) => {
        if (e.personal || !e.time) return e;
        try {
          const d = wallTimeToDate(e.date, e.time, e.zone || zone());
          const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          return {
            ...e,
            date,
            endDate: date,
            time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
          };
        } catch {
          return e;
        }
      }),
      events = localEvents.filter(
        (e) =>
          (filter === "All" ||
            (filter === "Personal" ? e.personal : !e.personal)) &&
          e.date <= dates.at(-1) &&
          (e.endDate || e.date) >= dates[0],
      );
    const period =
      view === "Month"
        ? stamp(selected).toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          })
        : view === "Week"
          ? `${dateLabel(dates[0])} – ${dateLabel(dates[6], true)}`
          : fullDate(selected);
    return (
      header(
        "Planner",
        "Your applications, schedule, and everyday commitments in one calendar.",
        `${btn("Calendar import / export", "planner-sync", "secondary", "download")}${btn("Add event", `planner-add:${selected}`, "primary", "plus")}`,
      ) +
      `<div class="planner-summary"><span><i class="legend-dot personal"></i>Personal events</span><span><i class="legend-dot college"></i>College commitments</span><span class="planner-timezone">Times shown in ${h(zone())}</span></div><div class="schedule-layout"><section class="panel calendar-panel"><div class="schedule-toolbar"><div class="calendar-period">${ibtn("chevron", "Previous period", "planner-move:-1")}<h2>${h(period)}</h2>${ibtn("chevron", "Next period", "planner-move:1")}${btn("Today", "planner-today", "ghost")}</div><div class="view-switch" aria-label="Calendar zoom">${["Month", "Week", "Day"].map((v) => `<button data-action="planner-view:${v}" class="${v === view ? "selected" : ""}" aria-pressed="${v === view}">${v}</button>`).join("")}</div></div><div class="schedule-filters"><label>Jump to date <input type="date" id="planner-jump" value="${selected}" aria-label="Jump to date"></label><label>Show <select id="planner-filter" aria-label="Calendar event filter">${["All", "Personal", "College"].map((v) => `<option ${v === filter ? "selected" : ""}>${v}</option>`).join("")}</select></label><button data-action="planner-archived" class="text-link">Archived / canceled</button></div>${view === "Month" ? month(events) : view === "Week" ? week(events) : day(events)}${all.warnings?.length ? `<details class="calendar-warnings"><summary>Calendar notices (${all.warnings.length})</summary>${all.warnings.map((s) => `<p>${h(s)}</p>`).join("")}</details>` : ""}</section>${dayPanel(events)}</div>`
    );
  }
  function eventForm(id = "", date = selected, time = "") {
    const old = getState().events.find((e) => e.id === id);
    const r = old || {
      date,
      endDate: date,
      time: time || "17:00",
      endTime: time
        ? `${String(Math.min(23, Number(time.slice(0, 2)) + 1)).padStart(2, "0")}:${time.slice(3)}`
        : "18:00",
      allDay: !time,
      timezone: zone(),
      category: "Personal",
      repeat: "None",
    };
    formDialog(
      old ? "Edit event" : "Add an event",
      `${r.repeat === "Imported" ? '<p class="info-note full">Changes apply to this repeating series. Its imported schedule stays the same unless you choose a different repeat option.</p>' : ""}${r.recurrenceId ? '<p class="info-note full">This is one exception in a repeating series.</p>' : ""}${field("Event title", "title", r.title, "text", 'required maxlength="180" placeholder="Volleyball game, class, appointment…"')}${select("Category", "category", [...new Set([...categories, r.category || "Personal"])], r.category)}${field("Start date", "date", r.date, "date", "required")}${field("End date (inclusive)", "endDate", r.endDate || r.date, "date", "required")}<label class="check-label full"><input type="checkbox" name="allDay" data-all-day ${r.allDay ? "checked" : ""}>All-day event</label><div class="event-time-fields full" ${r.allDay ? "hidden" : ""}>${field("Start time", "time", r.time || "17:00", "time")}${field("End time", "endTime", r.endTime || "18:00", "time")}${field("Time zone (IANA name)", "timezone", r.timezone || zone(), "text", 'required maxlength="100" placeholder="America/New_York"')}<small>Use an IANA zone, UTC, or floating. Your planner displays timed events in your device’s time zone.</small></div>${field("Location / meeting link", "location", r.location, "text", 'maxlength="1000"')}${select("Status", "status", ["Planned", "Canceled"], r.status || "Planned")}${select("Repeat", "repeat", r.repeat === "Imported" ? ["Imported", "None", "Daily", "Weekly", "Monthly", "Yearly"] : ["None", "Daily", "Weekly", "Monthly", "Yearly"], r.repeat || "None", "data-planner-repeat")}<div class="repeat-controls full" ${r.repeat === "Imported" ? "hidden" : ""}>${field("Repeat every (interval)", "repeatInterval", r.repeatInterval || 1, "number", 'min="1" max="365" step="1" required')}${field("Repeat until (optional)", "repeatUntil", r.repeatUntil, "date")}</div>${textarea("Notes and details", "notes", r.notes, 'maxlength="15000" placeholder="Bring your uniform, goals for the day, travel details…"')}${old ? `<div class="full event-form-tools">${btn(r.archived ? "Restore event" : "Archive event", `planner-archive:${id}`, "ghost", "archive")}<small>For repeats, editing or archiving applies to the entire series.</small></div>` : ""}`,
      (v) => {
        if (!validDate(v.date) || !validDate(v.endDate) || v.endDate < v.date)
          throw Error("Choose valid dates with the end on or after the start.");
        const allDay = v.allDay === "on";
        if (
          !allDay &&
          (!validTime(v.time) ||
            !validTime(v.endTime) ||
            (v.date === v.endDate && v.endTime < v.time))
        )
          throw Error("Set an end time on or after the start time.");
        if (v.repeatUntil && v.repeatUntil < v.date)
          throw Error("Repeat until must be on or after the start date.");
        const tz = v.timezone || zone();
        if (!["floating", "UTC"].includes(tz)) {
          try {
            new Intl.DateTimeFormat("en", { timeZone: tz });
          } catch {
            if (!r.timezoneDefinitions?.length)
              throw Error(
                "Enter a valid IANA time zone, such as America/New_York.",
              );
          }
        }
        const record = {
          ...r,
          ...v,
          allDay,
          timezone: tz,
          time: allDay ? "" : v.time,
          endTime: allDay ? "" : v.endTime,
          repeatInterval: Number(v.repeatInterval),
          id: id || uid(),
          created: r.created || Date.now(),
          updated: Date.now(),
          sequence: (Number(r.sequence) || 0) + 1,
        };
        const ok = mutate(() => {
          if (old)
            Object.assign(
              getState().events.find((e) => e.id === id),
              record,
            );
          else getState().events.push(record);
        }, "Event saved.");
        return ok;
      },
      "Save event",
      true,
    );
  }
  function syncDialog() {
    dialog(
      `<div class="dialog-heading"><div><div class="eyebrow">CALENDAR EXCHANGE</div><h2>Bring your schedule together</h2></div>${ibtn("x", "Close dialog", "close-dialog")}</div><div class="calendar-sync"><p>Import events from Google Calendar, Outlook, Apple Calendar, or any app that exports an <strong>.ics</strong> file. All imported data stays in this browser.</p><section><h3>Import a calendar</h3><p>Export an iCalendar file from your calendar app, then choose it here. Matching event IDs update existing entries. Repeat rules, exceptions, locations, notes, cancellations, and time zones are preserved when supported.</p>${btn("Choose .ics file", "planner-import-choose", "secondary", "plus")}<input type="file" accept=".ics,text/calendar" data-planner-import hidden><small>Up to 2 MB and 2,000 events per file. Review changes before importing.</small></section><section><h3>Export Ascend</h3><p>Download a calendar file, then import it into your calendar app. Personal repeats stay as series; college items are included as dated commitments.</p><div class="button-group">${btn("Export entire calendar", "planner-export:all", "primary", "download")}${btn("Personal events only", "planner-export:personal", "secondary", "download")}</div></section><div class="info-note">File exchange is manual. Changes in another app appear here after you import its latest file. Your calendar app controls how it handles repeated imports of Ascend exports. To share a cancellation, set an event’s status to Canceled and export again. Archiving affects Ascend only.</div>${getState().profile.lastCalendarImport ? `<small>Last import: ${h(getState().profile.lastCalendarImport)}</small>` : ""}</div>`,
      true,
    );
  }
  function reviewImport(parsed, name) {
    const linked = calendarEvents(getState()).filter((e) => !e.personal),
      linkedIds = new Set(
        linked.map(
          (e) =>
            `${String(e.kind || "event").replace(/[^a-z0-9]/gi, "-")}-${e.id}@ascend.local`,
        ),
      );
    const incoming = parsed.records.filter((r) => !linkedIds.has(r.sourceUid));
    const preview = mergeCalendar(getState().events, incoming, uid);
    pendingImport = { incoming, name };
    dialog(
      `<div class="dialog-heading"><div><div class="eyebrow">REVIEW CALENDAR IMPORT</div><h2>${h(name)}</h2></div>${ibtn("x", "Close dialog", "close-dialog")}</div><div class="calendar-sync"><div class="import-counts"><div><strong>${preview.added}</strong><span>New events</span></div><div><strong>${preview.updated}</strong><span>Updates</span></div><div><strong>${preview.unchanged + preview.older}</strong><span>Unchanged / older</span></div></div><p>${parsed.skipped} unsupported entries skipped. ${parsed.records.length - incoming.length} existing Ascend college items skipped.</p>${parsed.warnings.map((w) => `<p class="info-note">${h(w)}</p>`).join("")}<div class="import-preview">${incoming
        .slice(0, 15)
        .map(
          (e) =>
            `<div><strong>${h(e.title)}</strong><span>${dateLabel(e.date)} · ${h(e.repeat)}${e.status === "Canceled" ? " · Canceled" : ""}</span></div>`,
        )
        .join(
          "",
        )}${incoming.length > 15 ? `<small>And ${incoming.length - 15} more…</small>` : ""}</div><div class="dialog-footer">${btn("Cancel", "close-dialog", "ghost")}${btn("Import calendar", "planner-import-confirm", "primary", "check")}</div></div>`,
      true,
    );
  }
  async function handle(key, arg) {
    if (!key.startsWith("planner-")) return false;
    if (!flushNotes()) return true;
    switch (key) {
      case "planner-view":
        view = arg;
        render();
        break;
      case "planner-select":
        selected = arg;
        render();
        break;
      case "planner-day":
        selected = arg;
        view = "Day";
        render();
        break;
      case "planner-move":
        selected =
          view === "Month"
            ? changeMonth(selected, Number(arg))
            : shiftDate(selected, Number(arg) * (view === "Week" ? 7 : 1));
        render();
        break;
      case "planner-today":
        selected = today();
        render();
        break;
      case "planner-add":
        eventForm("", arg || selected);
        break;
      case "planner-hour":
        eventForm("", selected, arg);
        break;
      case "planner-edit":
        eventForm(arg);
        break;
      case "planner-archive": {
        const r = getState().events.find((e) => e.id === arg);
        if (r) {
          const archived = !r.archived;
          const family = r.sourceUid || r.id + "@ascend.local";
          if (
            mutate(
              () => {
                for (const e of getState().events)
                  if (
                    e.id === r.id ||
                    (!r.recurrenceId &&
                      (e.sourceUid || e.id + "@ascend.local") === family)
                  )
                    e.archived = archived;
              },
              archived ? "Event archived." : "Event restored.",
            )
          )
            closeDialog();
        }
        break;
      }
      case "planner-archived":
        dialog(
          `<div class="dialog-heading"><h2>Archived & canceled events</h2>${ibtn("x", "Close dialog", "close-dialog")}</div><div class="calendar-sync">${
            getState()
              .events.filter(
                (r) =>
                  (r.archived || r.status === "Canceled") && !r.recurrenceId,
              )
              .map(
                (r) =>
                  `<div class="archived-event"><strong>${h(r.title)}</strong>${r.archived ? btn("Restore", `planner-archive:${r.id}`, "secondary") : btn("Edit", `planner-edit:${r.id}`, "secondary")}</div>`,
              )
              .join("") || "<p>No archived or canceled events.</p>"
          }</div>`,
        );
        break;
      case "planner-sync":
        syncDialog();
        break;
      case "planner-import-choose":
        document.querySelector("[data-planner-import]")?.click();
        break;
      case "planner-export": {
        const linked =
          arg === "personal"
            ? []
            : calendarEvents(getState()).filter((e) => !e.personal);
        download(
          `ascend-${arg === "personal" ? "personal" : "calendar"}-${today()}.ics`,
          calendarFile(getState().events, linked),
          "text/calendar;charset=utf-8",
        );
        toast("Calendar file downloaded. Import it into your calendar app.");
        break;
      }
      case "planner-import-confirm":
        if (pendingImport) {
          const p = pendingImport;
          const result = mergeCalendar(getState().events, p.incoming, uid);
          if (
            mutate(() => {
              getState().events = result.records;
              getState().profile.lastCalendarImport = `${p.name} · ${new Date().toLocaleString()}`;
            }, `${result.added} events added, ${result.updated} updated.`)
          ) {
            pendingImport = null;
            closeDialog();
          }
        }
        break;
    }
    return true;
  }
  document.addEventListener("change", async (e) => {
    const el = e.target;
    if (el.matches("[data-planner-repeat]"))
      el.closest("form").querySelector(".repeat-controls").hidden =
        el.value === "Imported";
    if (el.matches("[data-all-day]"))
      el.closest("form").querySelector(".event-time-fields").hidden =
        el.checked;
    if (el.id === "planner-jump" && validDate(el.value)) {
      flushNotes();
      selected = el.value;
      render();
    }
    if (el.id === "planner-filter") {
      flushNotes();
      filter = el.value;
      render();
    }
    if (el.matches("[data-planner-import]") && el.files?.[0]) {
      const f = el.files[0];
      try {
        if (f.size > 2 * 1024 * 1024)
          throw Error("Choose an .ics file smaller than 2 MB.");
        reviewImport(parseCalendar(await f.text(), f.name), f.name);
      } catch (err) {
        toast(err.message);
        el.value = "";
      }
    }
  });
  document.addEventListener("input", (e) => {
    if (!e.target.matches("[data-planner-note]")) return;
    const el = e.target,
      date = el.dataset.plannerNote,
      value = el.value,
      status = document.querySelector("#day-note-status");
    if (status) status.textContent = "Saving…";
    noteWrite = () => {
      const ok = mutate(
        () => {
          let r = getState().dayNotes.find((n) => n.date === date);
          if (!r) {
            r = { id: uid(), date, body: "" };
            getState().dayNotes.push(r);
          }
          r.body = value;
          r.updated = Date.now();
        },
        "",
        false,
      );
      if (status?.isConnected)
        status.textContent = ok
          ? "Saved in this browser"
          : "Could not save. Export a backup in Settings.";
      return ok;
    };
    if (noteTimer) clearTimeout(noteTimer);
    noteTimer = setTimeout(flushNotes, 300);
  });
  window.addEventListener("pagehide", flushNotes);
  window.addEventListener("hashchange", flushNotes);
  return { page, handle, flushNotes };
}
