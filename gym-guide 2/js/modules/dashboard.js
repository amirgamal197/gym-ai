/**
 * dashboard.js — Dashboard Page (new home tab)
 * ---------------------------------------------------------------
 * Replaces the old static "home" page with a real data dashboard
 * built entirely from what's already in STATE (workout history,
 * sets, and body-metrics entries). Nothing here is invented: every
 * stat either renders a real derived number or an honest empty
 * state ("لسه معملتش أي تمرين") when there isn't enough data yet.
 *
 * Derived stats and how they're computed (all from STATE.history,
 * which workout.js already stamps with a real `dateISO` on every
 * saved session — see saveSession() in workout.js):
 *
 *  - Days trained     = count of distinct dateISO values across all
 *                        saved sessions (a day with 2 exercises
 *                        saved only counts once).
 *  - Last workout      = the most recent dateISO + which day (any
 *                        program day, e.g. day1 or dayPushA) was trained.
 *  - Today card (Phase 5) = calendar-aware: today's scheduled session (start /
 *                        continue / done), or a rest-day note + the next scheduled
 *                        session — see progress.js getTodayState().
 *  - Next workout       = (stat card "الجاي بالترتيب") the day after the last-trained day in the ACTIVE
 *                        program's rotation (schedule.js getActiveDayKeys);
 *                        the program's first day if nothing trained yet or
 *                        the last session was in a different program.
 *  - Current streak      = consecutive trained days counted backward
 *                        from the most recent one, allowing up to a
 *                        3-day gap between sessions (this is a 3x/week
 *                        program, not a daily one, so a strict
 *                        "every calendar day" streak would always show
 *                        0). The streak resets to 0 if the last workout
 *                        is more than 3 days old — see computeStreak().
 *  - Weekly progress     = distinct trained days in the current Saturday→Friday
 *                        week (Phase 5: was Monday-start), out of the active program's weekly target
 *                        (3 for Full Body / 3-day PPL, 6 for 6-day PPL).
 *  - Week strip           = the Sat→Fri schedule from schedule.js
 *                        (training vs rest days, today highlighted).
 *  - Weight / measurements = latest entry per field from metrics.js
 *                        (getLatestMetric) — undefined fields render
 *                        as an empty state, never a guessed number.
 * ---------------------------------------------------------------
 */
import { DATA } from "./data.js";
import { STATE } from "./store.js";
import { programDayLabel, getNextIncompleteExercise, resolveDayExercise } from "./workout.js";
import { getSlotRef } from "./replacements.js";
import { getActiveDayKeys, getDaysPerWeek, getWeekPlan, getActiveProgram } from "./schedule.js";
import { getTodayState, sessionsThisWeek } from "./progress.js";
import { weeklyBarsHTML, recentRecordsHTML } from "./progress-ui.js";
import { getLatestMetric } from "./metrics.js";
import { isProfileStarted } from "./profile.js";
import { goalNoteHtml } from "./goals.js";
import { icon } from "./icons.js";

const MS_DAY = 86400000;

/* ---------------- DATA GATHERING (pure, no DOM) ---------------- */

/** Every saved session across every exercise, flattened, newest first isn't guaranteed — caller sorts. */
function allHistoryEntries() {
  const hist = STATE.history || {};
  const out = [];
  Object.keys(hist).forEach((key) => {
    (hist[key] || []).forEach((entry) => {
      // Older entries saved before dateISO existed are skipped for stat
      // purposes (see workout.js saveSession comment) rather than
      // guessed at from the localized `date` string.
      if (entry && entry.dateISO) out.push(entry);
    });
  });
  return out;
}

/** Sorted, de-duplicated list of every distinct dateISO a session was saved on (descending = most recent first). */
function uniqueTrainedDates() {
  const set = new Set(allHistoryEntries().map((e) => e.dateISO));
  return Array.from(set).sort().reverse();
}

function computeDaysTrained() {
  return uniqueTrainedDates().length;
}

function computeLastWorkout() {
  const entries = allHistoryEntries();
  if (!entries.length) return null;
  const latest = entries.reduce((a, b) => (a.dateISO >= b.dateISO ? a : b));
  const dayKey = latest.dayKey;
  const title = (DATA[dayKey] && DATA[dayKey].title) || dayKey;
  return { dateISO: latest.dateISO, dayKey, title };
}

function computeNextWorkout(lastWorkout) {
  // Rotation runs over the ACTIVE program's days (Full Body, 3-day PPL
  // or 6-day PPL — see schedule.js). If the last session belonged to a
  // different program, the rotation restarts at this program's first day.
  const keys = getActiveDayKeys();
  if (!lastWorkout || !keys.includes(lastWorkout.dayKey)) {
    return keys[0];
  }
  const idx = keys.indexOf(lastWorkout.dayKey);
  return keys[(idx + 1) % keys.length];
}

/** Consecutive-session streak, tolerant of rest days (see file header for the reasoning). */
function computeStreak(datesDesc) {
  if (!datesDesc.length) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const mostRecent = new Date(datesDesc[0] + "T00:00:00");
  const daysSinceLast = Math.round((today - mostRecent) / MS_DAY);
  if (daysSinceLast > 3) return 0; // streak has lapsed — last session too long ago to count as "current"

  let streak = 1;
  for (let i = 1; i < datesDesc.length; i++) {
    const cur = new Date(datesDesc[i - 1] + "T00:00:00");
    const prev = new Date(datesDesc[i] + "T00:00:00");
    const gap = Math.round((cur - prev) / MS_DAY);
    if (gap <= 3) streak++;
    else break;
  }
  return streak;
}

function computeWeeklyProgress() {
  // Phase 5: weeks run Saturday → Friday (same as the schedule grid) and use
  // local dates — see progress.js.
  return { count: sessionsThisWeek(), target: getDaysPerWeek() };
}

function formatDateISO(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });
  } catch (e) {
    return iso;
  }
}

/* ---------------- RENDER PIECES ---------------- */

function statCard(iconHtml, label, value, sub) {
  return `
  <div class="dash-stat-card">
    <div class="dash-stat-icon" aria-hidden="true">${iconHtml}</div>
    <div class="dash-stat-value">${value}</div>
    <div class="dash-stat-label">${label}</div>
    ${sub ? `<div class="dash-stat-sub">${sub}</div>` : ""}
  </div>`;
}

function exerciseHint(dayKey) {
  const next = getNextIncompleteExercise(dayKey);
  const d = DATA[dayKey];
  const ex = (next && next.ex) || (d && d.main && d.main[0] && resolveDayExercise(getSlotRef(dayKey, 0)));
  return ex ? { en: ex.en, ar: ex.ar } : null;
}

/** The big hero link (keeps the original .dash-cta markup). */
function ctaLink({ dayKey, eyebrow, hintPrefix }) {
  const hint = exerciseHint(dayKey);
  return `
  <a class="dash-cta" href="#${dayKey}">
    <span class="dash-cta-icon" aria-hidden="true">${icon("dumbbell")}</span>
    <span class="dash-cta-text">
      <span class="dash-cta-eyebrow">${eyebrow}</span>
      <span class="dash-cta-title">${programDayLabel(dayKey)}</span>
      ${hint ? `<span class="dash-cta-ar">${hintPrefix} <span dir="ltr" lang="en">${hint.en}</span>${hint.ar ? " · " + hint.ar : ""}</span>` : ""}
    </span>
    <span class="dash-cta-arrow" aria-hidden="true">${icon("arrow-left")}</span>
  </a>`;
}

function nextSessionLine(next) {
  if (!next) return "";
  const when = next.daysAhead === 1 ? "بكرة" : "يوم " + next.weekdayAr;
  return `الجلسة الجاية في جدولك: <b>${programDayLabel(next.dayKey)}</b> — ${when}`;
}

/**
 * Phase 5 "today" card — calendar-aware (the Phase 4 CTA only followed the
 * rotation). Training day → start/continue today's scheduled session;
 * done → confirmation + what's next; rest day → rest message + next session.
 * People do train off-schedule, so rest/done states keep a smaller link to
 * the next session in the rotation instead of hiding it.
 */
function renderToday(lastWorkout) {
  const t = getTodayState();
  const rotationDay = computeNextWorkout(lastWorkout);
  const extra = (label) => `<a class="dash-quicklink dash-today-extra" href="#${rotationDay}">${icon("dumbbell")} ${label}: ${programDayLabel(rotationDay)} ${icon("arrow-left")}</a>`;

  if (t.status === "train" && !t.doneToday) {
    return `<div role="group" class="dash-today" aria-label="تمرين النهاردة">
      ${ctaLink({ dayKey: t.dayKey, eyebrow: t.inProgress ? "CONTINUE · كمّل تمرين النهاردة" : "TODAY · تمرين النهاردة", hintPrefix: t.inProgress ? "كمّل من" : "يبدأ بـ" })}
      ${t.next ? `<p class="dash-today-note">${nextSessionLine(t.next)}</p>` : ""}
    </div>`;
  }
  if (t.status === "train" && t.doneToday) {
    return `<div role="group" class="dash-today done" aria-label="تمرين النهاردة">
      <div class="dash-today-card" role="status">
        <span class="dash-today-ico" aria-hidden="true">${icon("check")}</span>
        <div><div class="dash-today-title">خلّصت تمرين النهاردة — ${programDayLabel(t.dayKey)}</div>
        <div class="dash-today-sub">${t.next ? nextSessionLine(t.next) : "ارتاح واستشفى."}</div></div>
      </div>
      ${extra("تمرّن زيادة؟ الجاي بالترتيب")}
    </div>`;
  }
  if (t.status === "rest") {
    return `<div role="group" class="dash-today rest" aria-label="تمرين النهاردة">
      <div class="dash-today-card">
        <span class="dash-today-ico" aria-hidden="true">${icon("moon")}</span>
        <div><div class="dash-today-title">النهاردة يوم راحة${t.trainedToday ? " (وبرضه سجّلت تمرين — برافو)" : ""}</div>
        <div class="dash-today-sub">${t.next ? nextSessionLine(t.next) : "الراحة جزء من البرنامج — العضلة بتكبر وانت بترتاح."}</div></div>
      </div>
      ${extra("عايز تتمرن النهاردة؟ الجاي بالترتيب")}
    </div>`;
  }
  // status "none": no training days configured for this frequency
  return `<div role="group" class="dash-today" aria-label="تمرين النهاردة">
    <div class="dash-today-card">
      <span class="dash-today-ico" aria-hidden="true">${icon("calendar")}</span>
      <div><div class="dash-today-title">مفيش أيام تمرين متحددة في جدولك</div>
      <div class="dash-today-sub"><a class="dash-weekstrip-edit" href="#program">اختار أيام التمرين</a> أو ابدأ على طول:</div></div>
    </div>
    ${ctaLink({ dayKey: rotationDay, eyebrow: "NEXT WORKOUT", hintPrefix: "يبدأ بـ" })}
  </div>`;
}

function renderWeeklyProgress(weekly) {
  const pct = Math.min(100, Math.round((weekly.count / weekly.target) * 100));
  return `
  <div class="dash-week">
    <div class="dash-week-head">
      <span>${icon("calendar")} التقدّم الأسبوعي</span>
      <span>${weekly.count} / ${weekly.target} أيام</span>
    </div>
    <div class="dash-week-bar" role="progressbar" aria-label="التقدّم الأسبوعي" aria-valuemin="0" aria-valuemax="${weekly.target}" aria-valuenow="${Math.min(weekly.count, weekly.target)}" aria-valuetext="${weekly.count} من ${weekly.target} أيام"><div class="dash-week-bar-fill" style="width:${pct}%"></div></div>
  </div>`;
}

/** Compact Sat→Fri strip from the weekly schedule (program.js lets the
 * person edit it). Today is highlighted; rest days are muted. */
function renderWeekStrip() {
  const todayWd = new Date().getDay();
  const cells = getWeekPlan()
    .map((e) => {
      const cls = ["dash-weekday", e.training ? "train" : "rest", e.weekday === todayWd ? "today" : ""].join(" ");
      const inner = `<span class="dash-weekday-name">${e.ar}</span><span class="dash-weekday-label">${e.training ? e.label : "راحة"}</span>`;
      return e.training
        ? `<a class="${cls}" href="#${e.dayKey}"${e.weekday === todayWd ? ' aria-current="date"' : ""}>${inner}</a>`
        : `<div class="${cls}"${e.weekday === todayWd ? ' aria-current="date"' : ""}>${inner}</div>`;
    })
    .join("");
  return `
  <div class="dash-weekstrip-wrap">
    <div class="dash-week-head"><span>${icon("calendar")} جدولك الأسبوعي · ${getActiveProgram().en}</span><a class="dash-weekstrip-edit" href="#program">عدّل</a></div>
    <div class="dash-weekstrip">${cells}</div>
  </div>`;
}

function renderMetricsSummary() {
  const fields = [
    { key: "weight", label: "Weight", ar: "الوزن", unit: "kg", icon: icon("scale") },
    { key: "bodyFatPct", label: "Body Fat", ar: "نسبة الدهون", unit: "%", icon: icon("trending-down") },
    { key: "muscleMass", label: "Muscle Mass", ar: "الكتلة العضلية", unit: "kg", icon: icon("muscle") },
    { key: "waist", label: "Waist", ar: "محيط الخصر", unit: "cm", icon: icon("ruler") },
  ];
  const cards = fields
    .map((f) => {
      const m = getLatestMetric(f.key);
      return `
      <div class="dash-metric-card">
        <div class="dash-metric-icon" aria-hidden="true">${f.icon}</div>
        <div class="dash-metric-value">${m ? `${m.value}${f.unit ? " " + f.unit : ""}` : "—"}</div>
        <div class="dash-metric-label">${f.label} <span class="dash-metric-ar">${f.ar}</span></div>
        ${m ? `<div class="dash-metric-date">${formatDateISO(m.dateISO)}</div>` : `<div class="dash-metric-date">Not measured yet · لسه معملتش قياس</div>`}
      </div>`;
    })
    .join("");
  return `
  <div class="section-title">Measurements · القياسات الجسدية</div>
  <div class="dash-metrics-grid">${cards}</div>
  <a class="dash-quicklink dash-metrics-link" href="#metrics">${icon("camera")} سجّل قياس جديد / شوف السجل كامل ${icon("arrow-left")}</a>`;
}

/** Nudges toward the new profile/assessment page (profile.js) when it's
 * still empty; once started, becomes a plain review link instead — same
 * "quicklink" visual language as renderMetricsSummary's link above. */
function renderProfileLink() {
  const started = isProfileStarted();
  return `
  <a class="dash-quicklink dash-metrics-link" href="#profile">
    ${icon("clipboard")} ${started ? "شوف/عدّل بروفايلك التدريبي" : "كمّل بروفايلك التدريبي (هدفك، مستواك، معداتك)"} ${icon("arrow-left")}
  </a>`;
}

/* ---------------- PAGE ---------------- */
export function pageDashboard() {
  const datesDesc = uniqueTrainedDates();
  const daysTrained = datesDesc.length;
  const lastWorkout = computeLastWorkout();
  const nextDayKey = computeNextWorkout(lastWorkout);
  const streak = computeStreak(datesDesc);
  const weekly = computeWeeklyProgress();

  if (daysTrained === 0) {
    // Honest empty state — no fabricated stats for a user who hasn't
    // trained yet, just the CTA and the pages that are still useful.
    return `
      <div class="top-note">أهلاً بيك ${icon("hand-wave")} لسه معملتش أي تمرين متسجل. ابدأ أول يوم وهيبدأ لوحة التحكم تعرض إحصائياتك الحقيقية.</div>
      ${renderToday(null)}
      ${goalNoteHtml()}
      ${renderWeekStrip()}
      ${renderProfileLink()}
      ${renderMetricsSummary()}
    `;
  }

  return `
    ${renderToday(lastWorkout)}

    <div class="dash-stat-grid">
      ${statCard(icon("calendar"), "أيام التدريب", daysTrained)}
      ${statCard(icon("flame"), "الستريك الحالي", streak, streak > 0 ? "يوم متتالي" : "استأنف عشان يبدأ يعد")}
      ${statCard(icon("skip-back"), "آخر تمرين", programDayLabel(lastWorkout.dayKey), formatDateISO(lastWorkout.dateISO))}
      ${statCard(icon("skip-forward"), "الجاي بالترتيب", programDayLabel(nextDayKey))}
    </div>

    ${renderWeeklyProgress(weekly)}
    ${renderWeekStrip()}
    ${goalNoteHtml()}
    ${weeklyBarsHTML(8)}
    ${recentRecordsHTML(3)}
    <a class="dash-quicklink dash-metrics-link" href="#tracker">${icon("trending-up")} سجل التقدّم لكل تمرين ${icon("arrow-left")}</a>
    ${renderProfileLink()}
    ${renderMetricsSummary()}
  `;
}
