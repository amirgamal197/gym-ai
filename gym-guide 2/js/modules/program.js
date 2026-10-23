/**
 * program.js — Workout Program Page
 * ---------------------------------------------------------------
 * The program hub: choose how many days a week you train (3 or 6),
 * choose the split for 3 days (original Full Body A/B/C or Push/Pull/
 * Legs), pick which weekdays are training days, and see the program's
 * actual days.
 *
 * All program/schedule logic lives in schedule.js; this file only
 * renders it and re-renders after a change. Nothing here touches
 * STATE.sets / logs / history, so changing the plan never loses
 * completed work.
 *
 * 2, 4 and 5 days/week are still shown as an honest "Soon" state
 * instead of fabricating routines that do not exist.
 * ---------------------------------------------------------------
 */
import { DATA } from "./data.js";
import { backLink } from "./ui.js";
import { programDayLabel, isDayComplete, getNextIncompleteExercise } from "./workout.js";
import { renderMesocycleBanner } from "./progression.js";
import { icon } from "./icons.js";
import {
  PROGRAMS,
  SUPPORTED_FREQUENCIES,
  getActiveProgram,
  getActiveDayKeys,
  getDaysPerWeek,
  getTrainingDays,
  getWeekPlan,
  getScheduleWarnings,
  programsForFrequency,
  setDaysPerWeek,
  setProgram,
  toggleTrainingDay,
  resetTrainingDays,
} from "./schedule.js";

// Frequency options offered in the picker. Only SUPPORTED_FREQUENCIES
// (schedule.js) are selectable.
const FREQUENCY_OPTIONS = [2, 3, 4, 5, 6];

const SPLIT_CLASS = { push: "split-push", pull: "split-pull", legs: "split-legs" };
const SPLIT_LABEL = { push: "Push · دفع", pull: "Pull · سحب", legs: "Legs · رجل" };

function frequencyChips(current) {
  return FREQUENCY_OPTIONS.map((n) => {
    const isAvailable = SUPPORTED_FREQUENCIES.includes(n);
    const isActive = isAvailable && current === n;
    return `<button type="button" class="filter-chip freq-chip ${isActive ? "active" : ""} ${isAvailable ? "" : "soon"}"
      data-action="program-set-frequency" data-days="${n}" aria-pressed="${isActive}" ${isAvailable ? "" : 'disabled aria-disabled="true"'}>
      ${n} Days${isAvailable ? "" : '<span class="freq-soon-badge">Soon</span>'}
    </button>`;
  }).join("");
}

/** Program choice for the active frequency. Only shown as a picker when
 * there is a real choice (3 days: Full Body vs PPL); 6 days has a single
 * program, so it just shows its description. */
function splitPicker(activeId) {
  const options = programsForFrequency(getDaysPerWeek());
  if (options.length < 2) {
    return `<div class="split-note">${icon("dumbbell")} ${PROGRAMS[activeId].desc}</div>`;
  }
  const cards = options
    .map((p) => {
      const active = p.id === activeId;
      return `<button type="button" class="split-card ${active ? "active" : ""}" data-action="program-set-split" data-program="${p.id}" aria-pressed="${active}">
        <span class="split-card-title">${p.en}</span>
        <span class="split-card-ar">${p.ar}</span>
        <span class="split-card-desc">${p.desc}</span>
      </button>`;
    })
    .join("");
  return `<div class="split-picker" role="group" aria-label="نوع التقسيم">${cards}</div>`;
}

function weekScheduleHtml() {
  const need = getDaysPerWeek();
  const selected = getTrainingDays();
  const today = new Date().getDay();
  const cells = getWeekPlan()
    .map((e) => {
      const on = e.training;
      return `<button type="button" class="week-day ${on ? "on" : ""} ${e.weekday === today ? "today" : ""}"
        data-action="program-toggle-day" data-weekday="${e.weekday}" aria-pressed="${on}"
        aria-label="${e.ar} — ${on ? "يوم تدريب: " + e.label : "يوم راحة"}">
        <span class="week-day-name">${e.ar}</span>
        <span class="week-day-en">${e.en}</span>
        <span class="week-day-label">${on ? e.label : "راحة"}</span>
      </button>`;
    })
    .join("");
  const warnings = getScheduleWarnings()
    .map((w) => `<div class="sched-note sched-${w.level}" role="status">${icon("alert-triangle")} ${w.ar}</div>`)
    .join("");
  return `
    <div class="sched-head">
      <span>${selected.length} / ${need} أيام تدريب · ${7 - selected.length} راحة</span>
      <button type="button" class="sched-reset" data-action="program-reset-schedule">${icon("refresh")} الافتراضي</button>
    </div>
    <div class="week-grid" role="group" aria-label="أيام الأسبوع">${cells}</div>
    ${warnings}
    <div class="sub-note">اضغط على اليوم عشان تضيفه أو تشيله من أيام التدريب. الجلسات بتتوزع بالترتيب من السبت. تغيير الجدول مابيمسحش أي سيت أو سجل.</div>`;
}

export function pageProgram() {
  const program = getActiveProgram();
  const current = getDaysPerWeek();

  const dayCards = getActiveDayKeys()
    .map((dayKey, i) => {
      const d = DATA[dayKey];
      const label = programDayLabel(dayKey);
      const complete = isDayComplete(dayKey);
      const next = getNextIncompleteExercise(dayKey);
      const statusText = complete ? "Complete" : next ? `Next: ${next.ex.en}` : "";
      const badge = d.split ? `<span class="split-badge ${SPLIT_CLASS[d.split] || ""}">${SPLIT_LABEL[d.split] || d.split}</span>` : "";
      return `
    <a class="program-day-card ${complete ? "complete" : ""}" href="#${dayKey}">
      <div class="program-day-num">${i + 1}</div>
      <div class="program-day-info">
        <div class="program-day-title">${label} ${badge}</div>
        <div class="program-day-sub"><bdi>${d.main.length} exercises${statusText ? " · " + statusText : ""}</bdi></div>
      </div>
      <div class="program-day-status" aria-hidden="true">${complete ? icon("check") : icon("arrow-left")}</div>
    </a>`;
    })
    .join("");

  return `
    ${backLink()}
    <div class="top-note">اختار عدد أيام تدريبك (٣ أو ٦)، نوع التقسيم، وأنهي أيام الأسبوع تتدرب فيها — وبعدها شوف جلسات برنامجك بالتفصيل.</div>

    ${renderMesocycleBanner()}

    <div class="section-title">Days per week · أيام الأسبوع</div>
    <div class="filter-chip-row freq-row">${frequencyChips(current)}</div>

    <div class="section-title">Split · نوع التقسيم</div>
    ${splitPicker(program.id)}

    <div class="section-title">Weekly Schedule · الجدول الأسبوعي</div>
    ${weekScheduleHtml()}

    <div class="section-title">Your Training Days · جلسات برنامجك</div>
    <div class="program-day-list">${dayCards}</div>
  `;
}

/* ---------------- ACTION HANDLERS ---------------- */

/** Re-render the program page in place and put keyboard focus back on the
 * control that triggered the change (innerHTML replacement drops it). */
function rerender(focusSelector) {
  const sec = document.getElementById("sec-program");
  if (!sec) return;
  sec.innerHTML = pageProgram();
  if (focusSelector) {
    const el = sec.querySelector(focusSelector);
    if (el && typeof el.focus === "function") el.focus({ preventScroll: true });
  }
}

export function setProgramFrequency(days) {
  const n = parseInt(days, 10);
  if (!SUPPORTED_FREQUENCIES.includes(n)) return;
  setDaysPerWeek(n); // no-op when already active
  rerender(`[data-action="program-set-frequency"][data-days="${n}"]`);
}

export function setProgramSplit(programId) {
  if (!PROGRAMS[programId]) return;
  setProgram(programId);
  rerender(`[data-action="program-set-split"][data-program="${programId}"]`);
}

export function toggleProgramDay(weekday) {
  const wd = parseInt(weekday, 10);
  const result = toggleTrainingDay(wd);
  rerender(`[data-action="program-toggle-day"][data-weekday="${wd}"]`);
  if (result === "full") {
    // Plan already has all its days: explain instead of silently ignoring.
    const sec = document.getElementById("sec-program");
    const head = sec && sec.querySelector(".sched-head");
    if (head) {
      head.insertAdjacentHTML(
        "afterend",
        `<div class="sched-note sched-warn sched-full" role="alert">${icon("alert-triangle")} الجدول مكتمل (${getDaysPerWeek()} أيام). شيل يوم الأول وبعدين ضيف اليوم الجديد.</div>`
      );
    }
  }
}

export function resetProgramSchedule() {
  resetTrainingDays();
  rerender('[data-action="program-reset-schedule"]');
}
