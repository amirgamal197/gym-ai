/**
 * progression.js — Adaptive Progression & Deload Advisor
 * ---------------------------------------------------------------
 * Turns the weight/reps the person already logs on the Day page
 * (STATE.logs, workout.js) into a plain-language "what to do next
 * session" recommendation, plus a simple deload flag from the
 * session-history trend (STATE.history) and an optional RPE reading.
 *
 * DELIBERATE SCOPE — what this is NOT:
 *  - Not a black-box model. Every recommendation is one of 4 fixed,
 *    named rules (increase / hold-push-reps / repeat / reduce),
 *    chosen from numbers the person typed themselves. The "why" is
 *    always shown, same as every other card in this app.
 *  - Does not touch DATA[dayKey] or rewrite the program. It reads
 *    the exercise's own prescribed rep range straight off `ex.sets`
 *    (data.js) and never invents a different one.
 *  - Nothing here is medical/load-management advice — the deload
 *    flag is a nudge to consider a lighter session, not an order,
 *    and links to the existing Recovery page rather than replacing
 *    professional judgement.
 *
 * Storage: no new state shape. Per-set weight/reps already live in
 * STATE.logs[`${key}-${i}-w`/`-r`] (workout.js). RPE reuses the exact
 * same STATE.logs bucket via a plain `data-log="${key}-rpe"` input —
 * it rides the existing debounced save/hydrate wiring in app.js/
 * workout.js for free, no new plumbing.
 * ---------------------------------------------------------------
 */
import { STATE } from "./store.js";
import { getDaysPerWeek } from "./schedule.js";
import { setsCount } from "./ui.js";
import { icon } from "./icons.js";

/** Parse "3×8-10" / "3×10" / "3×10-12 لكل جانب" → {min, max}. Returns
 * null when no numeric rep target can be found (e.g. a pure time-hold
 * string) — callers must treat null as "can't recommend, don't guess". */
export function parseRepRange(setsStr) {
  const m = (setsStr || "").match(/×\s*(\d+)(?:-(\d+))?/);
  if (!m) return null;
  const min = parseInt(m[1], 10);
  const max = m[2] ? parseInt(m[2], 10) : min;
  return { min, max };
}

function loggedSets(key, nSets) {
  const logs = STATE.logs || {};
  const out = [];
  for (let i = 0; i < nSets; i++) {
    const w = parseFloat(logs[`${key}-${i}-w`]);
    const r = parseFloat(logs[`${key}-${i}-r`]);
    if (!isNaN(w) && !isNaN(r) && w > 0 && r > 0) out.push({ w, r });
  }
  return out;
}

export function getExerciseRPE(key) {
  const v = STATE.logs && STATE.logs[`${key}-rpe`];
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

/** Round a suggested new weight to a plate-friendly step: 1kg above
 * 20kg (typical barbell/machine increments), 0.5kg at or below it
 * (typical dumbbell/cable pin increments) — a reasonable default, not
 * a per-exercise-equipment lookup, so it's always presented as "~"
 * (see renderRecommendationCard) rather than an exact prescription. */
function roundToPlate(weight) {
  const step = weight > 20 ? 1 : 0.5;
  return Math.round(weight / step) * step;
}

/**
 * Core rule engine. Returns one of:
 *   { status: "no-data" }                              — nothing logged yet for this exercise
 *   { status: "no-range" }                              — ex.sets has no parseable rep target (e.g. time hold)
 *   { status: "increase", from, to, reason }             — hit/beat the top of the range on every logged set
 *   { status: "hold", weight, reason }                   — in range but not yet at the top
 *   { status: "repeat", weight, reason }                 — missed the bottom of the range by 1-2 reps
 *   { status: "reduce", from, to, reason }                — missed the bottom of the range by 3+ reps (or RPE 10 + missed)
 * `key` is the same per-exercise id used throughout workout.js
 * (`${dayKey}-main-${idx}`); `ex` is the resolved exercise record.
 */
export function computeRecommendation(key, ex) {
  const range = parseRepRange(ex.sets);
  if (!range) return { status: "no-range" };

  const nSets = setsCount(ex.sets);
  const sets = loggedSets(key, nSets);
  if (!sets.length) return { status: "no-data" };

  const rpe = getExerciseRPE(key);
  const avgWeight = Math.round((sets.reduce((s, x) => s + x.w, 0) / sets.length) * 10) / 10;
  const minRepLogged = Math.min(...sets.map((s) => s.r));
  const allAtOrAboveMax = sets.every((s) => s.r >= range.max);
  const missedBy = range.min - minRepLogged; // positive = came up short of the bottom of the range

  if (allAtOrAboveMax) {
    const bump = rpe !== null && rpe <= 7 ? 0.05 : 0.025; // felt easy (RPE≤7) → slightly bigger jump
    const to = roundToPlate(avgWeight * (1 + bump));
    return {
      status: "increase",
      from: avgWeight,
      to,
      reason: `عدّيت أعلى مدى العدات (${range.max}) في كل السيتات${rpe !== null ? ` بمجهود RPE ${rpe}` : ""} — وقت الزيادة.`,
    };
  }

  if (missedBy >= 3 || (missedBy > 0 && rpe === 10)) {
    const to = roundToPlate(avgWeight * 0.92);
    return {
      status: "reduce",
      from: avgWeight,
      to,
      reason: `أقل سيت وصل ${minRepLogged} عدة بس (المطلوب ${range.min} على الأقل)${rpe === 10 ? " وحسيت إن الوزن أقصى مجهود ممكن (RPE 10)" : ""} — قلل الوزن شوية وارجع للمدى الصح.`,
    };
  }

  if (missedBy > 0) {
    return {
      status: "repeat",
      weight: avgWeight,
      reason: `قربت من ${range.min} عدة (وصلت ${minRepLogged}) — كرر نفس الوزن المرة الجاية وحاول توصل للمدى كامل.`,
    };
  }

  return {
    status: "hold",
    weight: avgWeight,
    reason: `وصلت للمدى (${range.min}-${range.max}) بس لسه ملقتش أعلى نقطة (${range.max}) في كل السيتات — كمّل بنفس الوزن وادفع للعدات الأكتر.`,
  };
}

const STATUS_LABEL = {
  increase: { icon: "arrow-up", cls: "prog-tip-up", title: "زوّد الوزن المرة الجاية" },
  hold: { icon: "target", cls: "prog-tip-hold", title: "استمر بنفس الوزن" },
  repeat: { icon: "refresh", cls: "prog-tip-hold", title: "كرر نفس الوزن" },
  reduce: { icon: "arrow-down", cls: "prog-tip-down", title: "قلل الوزن شوية" },
};

/** Markup for the "before you start" recommendation, or "" when there's
 * nothing honest to say yet (no-data/no-range) — silence beats a
 * fabricated tip. Injected via exCard's opts.beforeSets slot. */
export function renderRecommendationCard(key, ex) {
  const rec = computeRecommendation(key, ex);
  if (rec.status === "no-data" || rec.status === "no-range") return "";

  const meta = STATUS_LABEL[rec.status];
  const weightLine =
    rec.status === "increase" || rec.status === "reduce"
      ? `<b>${rec.from} كجم ← ${rec.to} كجم</b>`
      : `<b>${rec.weight} كجم</b>`;

  return `
  <div class="prog-tip ${meta.cls}">
    <div class="prog-tip-head">${icon(meta.icon)} <b>${meta.title}</b> — بناءً على آخر تسجيل</div>
    <div class="prog-tip-weight">${weightLine}</div>
    <div class="prog-tip-reason">${rec.reason}</div>
    <div class="prog-tip-disclaimer">تقدير تقريبي — قرّبه لأقرب وزن متاح عندك في الجيم.</div>
  </div>`;
}

/** Deload signal: the last up-to-3 saved history entries for this
 * exercise show volume declining session over session, which usually
 * means fatigue is outrunning recovery rather than a program issue.
 * Needs at least 3 saved sessions to say anything — two data points
 * isn't a trend, it's noise. */
export function computeDeloadFlag(key) {
  const entries = (STATE.history && STATE.history[key]) || [];
  if (entries.length < 3) return null;

  const last3 = entries.slice(-3).map((e) => parseFloat(e.volume) || 0);
  const declining = last3[0] > last3[1] && last3[1] > last3[2];
  if (!declining) return null;

  const rpe = getExerciseRPE(key);
  return {
    decliningSessions: 3,
    rpe,
    reason:
      rpe !== null && rpe >= 9
        ? `حجم التمرين نازل 3 جلسات على بعض ومجهودك (RPE ${rpe}) عالي — علامة إرهاق تراكمي.`
        : `حجم التمرين نازل 3 جلسات على بعض — ممكن يكون علامة إرهاق تراكمي.`,
  };
}

/** Markup for the deload nudge, or "" when there's nothing to flag.
 * Injected via exCard's opts.afterLogs slot, next to the RPE input. */
export function renderDeloadNote(key) {
  const flag = computeDeloadFlag(key);
  if (!flag) return "";
  return `
  <div class="prog-tip prog-tip-down">
    <div class="prog-tip-head">${icon("alert-triangle")} <b>ممكن تكون محتاج ديلود</b></div>
    <div class="prog-tip-reason">${flag.reason} فكر في جلسة أخف الأسبوع ده (وزن أقل ~%40-50 أو راحة يوم زيادة) — شوف <a href="#recovery">صفحة الاستشفاء</a>.</div>
  </div>`;
}

/** Scheduled (proactive) deload signal — independent from the reactive
 * declining-volume flag above. Counts *total* distinct trained days ever
 * logged (STATE.history — same source dashboard.js already reads) and
 * flags every ~18 sessions (≈6 weeks on a 3-day/week program) as a
 * deload week, regardless of whether performance has dipped yet. This
 * turns the existing "deload every 5-6 weeks" text tip (Recovery page)
 * into something the app actually tracks instead of the person having
 * to count weeks themselves. */
// ≈6 weeks of training at the active program's weekly frequency: 18 for a
// 3-day program (unchanged from before), 36 for the 6-day PPL.
const DELOAD_CYCLE_WEEKS = 6;
function sessionsPerDeloadCycle() {
  return getDaysPerWeek() * DELOAD_CYCLE_WEEKS;
}

export function computeMesocycleStatus() {
  const hist = STATE.history || {};
  const dates = new Set();
  Object.keys(hist).forEach((key) => {
    (hist[key] || []).forEach((entry) => {
      if (entry && entry.dateISO) dates.add(entry.dateISO);
    });
  });
  const totalSessions = dates.size;
  const perWeek = getDaysPerWeek();
  const cycle = sessionsPerDeloadCycle();
  if (totalSessions === 0) return { totalSessions: 0, week: 0, perWeek, isDeloadWeek: false, sessionsUntilDeload: cycle };

  const cyclePosition = totalSessions % cycle;
  const week = Math.ceil(totalSessions / perWeek);
  const isDeloadWeek = cyclePosition === 0; // just completed a full cycle
  const sessionsUntilDeload = isDeloadWeek ? 0 : cycle - cyclePosition;
  return { totalSessions, week, perWeek, isDeloadWeek, sessionsUntilDeload };
}

/** Markup for the Program-page mesocycle banner, or "" before any
 * session is logged (nothing honest to show yet). */
export function renderMesocycleBanner() {
  const m = computeMesocycleStatus();
  if (!m.totalSessions) return "";

  if (m.isDeloadWeek) {
    return `
    <div class="prog-tip prog-tip-down">
      <div class="prog-tip-head">${icon("alert-triangle")} <b>الأسبوع ده — Deload</b></div>
      <div class="prog-tip-reason">خلّصت ${m.totalSessions} جلسة (~${m.week} أسبوع) — وقت أسبوع حمل أخف (60-70% من أوزانك المعتادة، نفس التمارين) عشان تسمح بالاستشفاء الكامل قبل ما تكمل تزويد الوزن. ${SESSIONS_PER_DELOAD_CYCLE} جلسة جاية هيبقى وقت الديلود اللي بعده.</div>
    </div>`;
  }

  return `
  <div class="prog-tip prog-tip-hold">
    <div class="prog-tip-head">${icon("trending-down")} <b>الأسبوع ${m.week} من دورتك الحالية</b></div>
    <div class="prog-tip-reason">${m.totalSessions} جلسة متسجلة — باقي ${m.sessionsUntilDeload} جلسة (~${Math.ceil(m.sessionsUntilDeload / m.perWeek)} أسبوع) لحد أسبوع الـ Deload الجاي.</div>
  </div>`;
}

/** The RPE input row itself — a plain 1-10 number field reusing the
 * exact same `data-log` mechanism as weight/reps (see file header),
 * so it persists/hydrates for free. */
export function renderRPEInput(key) {
  return `
  <div class="log-row">
    <label for="log-${key}-rpe">RPE اليوم</label>
    <input type="number" inputmode="numeric" min="1" max="10" placeholder="1-10" id="log-${key}-rpe"
      aria-label="تقييم شدة المجهود (RPE) من 1 لـ10" data-log="${key}-rpe">
  </div>
  <div class="sub-note" style="margin:-4px 0 8px;">1 = سهل جدًا · 10 = أقصى مجهود ممكن (اختياري — بيحسّن دقة اقتراح الأسبوع الجاي)</div>`;
}
