/**
 * progress.js — Progress & "today" logic (Phase 5, no DOM)
 * ---------------------------------------------------------------
 * Pure functions over STATE.history / STATE.sets / STATE.schedule.
 * Nothing here writes to STATE.
 *
 * Rules (the UI relies on these; tools/validate-progress.mjs enforces them):
 *
 *  1. An exercise is followed by its stable id, not by the slot it sits in.
 *     Entry id = entry.exerciseId → else the id in an archive key
 *     ("<slotKey>~<id>") → else the program's own exercise for that slot
 *     (legacy entries) → else a "name:<name>" fallback. Swapping an exercise
 *     out and back therefore never splits or loses its curve, and the same
 *     lift done on two program days is shown as one curve.
 *  2. One entry per (history key, date): if "Done" was pressed twice on the
 *     same day, the latest wins instead of double counting.
 *  3. PARTIAL entries (work done before a mid-session swap) are real lifting:
 *     they count for personal records and weekly totals, but NOT for the
 *     per-exercise volume trend (an interrupted session would look like a dip).
 *  4. Weeks run Saturday → Friday, the same as the schedule grid
 *     (Phase 4 counted from Monday — carry-over fixed here).
 *  5. Entries without a `dateISO` (saved before the dashboard existed) are
 *     kept in per-exercise history but cannot be placed in a week or "today".
 *  6. Every read is defensive: corrupt history/sets/schedule never throws.
 * ---------------------------------------------------------------
 */
import { DATA } from "./data.js";
import { STATE, localISODate, persist } from "./store.js";
import { isArchiveKey, parseArchiveKey } from "./replacements.js";
import { getPlanFor, getWeekPlan, WEEKDAYS } from "./schedule.js";

const MS_DAY = 86400000;

/* ---------------- Body Composition (InBody) ---------------- */

export function getInBodyHistory() {
  const history = STATE.inbody || [];
  return [...history].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
}

export function saveInBodyEntry(entry) {
  STATE.inbody = STATE.inbody || [];
  // Replace if date exists, otherwise push
  const idx = STATE.inbody.findIndex(e => e.dateISO === entry.dateISO);
  if (idx > -1) STATE.inbody[idx] = entry;
  else STATE.inbody.push(entry);
  persist();
}

export function deleteInBodyEntry(dateISO) {
  STATE.inbody = (STATE.inbody || []).filter(e => e.dateISO !== dateISO);
  persist();
}

/* ---------------- dates ---------------- */

function isISO(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Local-midnight Date from a YYYY-MM-DD string. */
export function parseISO(iso) {
  return new Date(iso + "T00:00:00");
}

/** Start (Saturday, local midnight) of the Sat→Fri week containing `date`. */
export function weekStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const sinceSaturday = (d.getDay() + 1) % 7; // Sat=0, Sun=1 … Fri=6
  d.setDate(d.getDate() - sinceSaturday);
  return d;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/* ---------------- history flattening ---------------- */

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function originalIdForSlot(slotKey) {
  const parts = String(slotKey).split("-");
  if (parts.length !== 3 || parts[1] !== "main") return null;
  const day = DATA[parts[0]];
  const i = parseInt(parts[2], 10);
  const ref = day && Array.isArray(day.main) ? day.main[i] : null;
  return ref && ref.id ? ref.id : null;
}

/** Stable exercise id for a history entry (rule 1). */
export function entryExerciseId(key, entry) {
  if (entry && typeof entry.exerciseId === "string" && entry.exerciseId) return entry.exerciseId;
  const arc = parseArchiveKey(key);
  if (arc && arc.exerciseId) return arc.exerciseId;
  const orig = originalIdForSlot(key);
  if (orig) return orig;
  return "name:" + String((entry && entry.name) || key);
}

/** Every valid history entry, deduplicated per (key, date) — rules 1, 2, 6. */
export function flattenHistory() {
  const hist = STATE.history && typeof STATE.history === "object" && !Array.isArray(STATE.history) ? STATE.history : {};
  const out = [];
  Object.keys(hist).forEach((key) => {
    const list = Array.isArray(hist[key]) ? hist[key] : [];
    const seen = new Map(); // dateISO → index in `kept`
    const kept = [];
    list.forEach((e, order) => {
      if (!e || typeof e !== "object") return;
      const rec = {
        key,
        order,
        archived: isArchiveKey(key),
        exerciseId: entryExerciseId(key, e),
        name: String(e.name || key),
        dateISO: isISO(e.dateISO) ? e.dateISO : null,
        dateLabel: e.date ? String(e.date) : "",
        dayKey: typeof e.dayKey === "string" ? e.dayKey : String(key).split("-")[0],
        volume: num(e.volume),
        best1rm: num(e.best1rm),
        partial: !!e.partial,
        setsDone: num(e.setsDone),
      };
      if (rec.dateISO && seen.has(rec.dateISO)) kept[seen.get(rec.dateISO)] = rec; // latest wins
      else {
        if (rec.dateISO) seen.set(rec.dateISO, kept.length);
        kept.push(rec);
      }
    });
    out.push(...kept);
  });
  return out;
}

/* ---------------- per exercise ---------------- */

/**
 * Progress per exercise id, most recently trained first.
 * @returns {Array<{id,name,sessions:Array,best:Object|null,last:Object,first:Object,
 *   changePct:number|null,dayKeys:string[],entryCount:number,latestIsPR:boolean}>}
 */
export function getExerciseProgress() {
  const groups = new Map();
  flattenHistory().forEach((r) => {
    if (!groups.has(r.exerciseId)) groups.set(r.exerciseId, []);
    groups.get(r.exerciseId).push(r);
  });
  const result = [];
  groups.forEach((rows, id) => {
    // chronological; undated entries (rule 5) sort first, ties keep saved order
    rows.sort((a, b) => (a.dateISO || "").localeCompare(b.dateISO || "") || a.order - b.order);
    const sessions = rows.filter((r) => !r.partial); // rule 3
    const withRM = rows.filter((r) => r.best1rm > 0);
    let best = null;
    withRM.forEach((r) => {
      if (!best || r.best1rm >= best.best1rm) best = r; // ties → the more recent one
    });
    const trend = sessions.filter((r) => r.volume > 0);
    const first = trend[0] || null;
    const last = trend[trend.length - 1] || null;
    const changePct = trend.length >= 2 && first.volume > 0 ? Math.round(((last.volume - first.volume) / first.volume) * 100) : null;
    // newest first by name too: the name of the latest entry is the display name
    const displayName = rows[rows.length - 1].name;
    // is the newest entry a new personal best (strictly above everything earlier)?
    let latestIsPR = false;
    if (withRM.length >= 2) {
      const newest = withRM[withRM.length - 1];
      const earlierMax = Math.max(...withRM.slice(0, -1).map((r) => r.best1rm));
      latestIsPR = newest.best1rm > earlierMax;
    }
    result.push({
      id,
      name: displayName,
      sessions,
      trend,
      best,
      first,
      last,
      changePct,
      dayKeys: Array.from(new Set(rows.map((r) => r.dayKey))),
      entryCount: rows.length,
      lastDateISO: rows.reduce((m, r) => (r.dateISO && r.dateISO > m ? r.dateISO : m), ""),
      latestIsPR,
    });
  });
  result.sort((a, b) => b.lastDateISO.localeCompare(a.lastDateISO) || a.name.localeCompare(b.name));
  return result;
}

/** Personal records (best estimated 1RM per exercise), most recent record first. */
export function getPersonalRecords(limit = Infinity) {
  return getExerciseProgress()
    .filter((p) => p.best && p.best.best1rm > 0)
    .map((p) => ({ id: p.id, name: p.name, best1rm: p.best.best1rm, dateISO: p.best.dateISO, dateLabel: p.best.dateLabel, isNew: p.latestIsPR }))
    .sort((a, b) => (b.dateISO || "").localeCompare(a.dateISO || "") || b.best1rm - a.best1rm)
    .slice(0, limit);
}

/* ---------------- per week ---------------- */

/**
 * The last `count` Sat→Fri weeks, oldest → newest (the last one is this week).
 * sessions = distinct dates trained; volume = total kg×reps (partial work included, rule 3).
 */
export function getWeeklyStats(count = 8, now = new Date()) {
  const thisStart = weekStart(now);
  const weeks = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = addDays(thisStart, -7 * i);
    weeks.push({ startISO: localISODate(start), endISO: localISODate(addDays(start, 6)), sessions: 0, volume: 0, current: i === 0, _dates: new Set() });
  }
  flattenHistory().forEach((r) => {
    if (!r.dateISO) return;
    const w = weeks.find((x) => r.dateISO >= x.startISO && r.dateISO <= x.endISO);
    if (!w) return;
    w._dates.add(r.dateISO);
    w.volume += r.volume;
  });
  return weeks.map((w) => ({ startISO: w.startISO, endISO: w.endISO, sessions: w._dates.size, volume: Math.round(w.volume), current: w.current }));
}

/** Distinct training dates in the current Sat→Fri week. */
export function sessionsThisWeek(now = new Date()) {
  return getWeeklyStats(1, now)[0].sessions;
}

/* ---------------- today ---------------- */

function dayHasTickedSets(dayKey) {
  const day = DATA[dayKey];
  const sets = STATE.sets && typeof STATE.sets === "object" ? STATE.sets : {};
  if (!day || !Array.isArray(day.main)) return false;
  for (let i = 0; i < day.main.length; i++) {
    const s = sets[dayKey + "-main-" + i];
    if (s && typeof s === "object" && Object.values(s).some(Boolean)) return true;
  }
  return false;
}

/**
 * Calendar-aware state for the dashboard "today" card.
 *  status: "none"  – no training days are configured for the active frequency
 *          "train" – today is a scheduled training day (doneToday / inProgress say how far)
 *          "rest"  – today is a rest day
 *  next:   the next scheduled session after today (looks up to 7 days ahead; may be null)
 */
export function getTodayState(now = new Date()) {
  const todayISO = localISODate(now);
  const plan = getPlanFor(now);
  const anyTraining = getWeekPlan().some((e) => e.training);
  const trainedToday = flattenHistory().filter((r) => r.dateISO === todayISO);

  let next = null;
  for (let i = 1; i <= 7 && !next; i++) {
    const d = addDays(now, i);
    const p = getPlanFor(d);
    if (p && p.training) {
      const wd = WEEKDAYS.find((w) => w.idx === d.getDay());
      next = { dayKey: p.dayKey, label: p.label, daysAhead: i, weekdayAr: wd ? wd.ar : "", dateISO: localISODate(d) };
    }
  }

  if (!anyTraining || !plan) return { status: "none", todayISO, next: null, trainedToday: trainedToday.length > 0 };
  if (!plan.training) return { status: "rest", todayISO, next, trainedToday: trainedToday.length > 0, offScheduleDayKeys: Array.from(new Set(trainedToday.map((r) => r.dayKey))) };

  const doneToday = trainedToday.some((r) => r.dayKey === plan.dayKey);
  return {
    status: "train",
    todayISO,
    dayKey: plan.dayKey,
    label: plan.label,
    doneToday,
    inProgress: !doneToday && dayHasTickedSets(plan.dayKey),
    next,
    trainedToday: trainedToday.length > 0,
  };
}
