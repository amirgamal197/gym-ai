/**
 * schedule.js — Programs & Weekly Schedule (Phase 2)
 * ---------------------------------------------------------------
 * Owns two things and nothing else:
 *   1. PROGRAMS — which workout days make up each selectable program
 *      (the original Full Body A/B/C, a 3-day Push/Pull/Legs, and a
 *      6-day Push/Pull/Legs with A/B variants).
 *   2. The weekly schedule — which weekdays are training days and which
 *      are rest days — persisted in STATE.schedule.
 *
 * It never edits DATA, never touches STATE.sets / STATE.logs /
 * STATE.history, and has no DOM code, so switching program or moving
 * training days can never destroy completed sets or workout history:
 * every day keeps its own "<dayKey>-main-<i>" keys, and a program is
 * just a list of day keys.
 *
 * Persisted shape (all optional — absent means "original behaviour"):
 *   STATE.schedule = {
 *     programId:   "fullbody" | "ppl3" | "ppl6",
 *     lastThree:   "fullbody" | "ppl3",        // remembered 3-day split
 *     trainingDays: { "3": [weekday...], "6": [weekday...] }
 *   }
 * weekday uses JS Date.getDay(): 0 = Sunday ... 6 = Saturday.
 * ---------------------------------------------------------------
 */
import { DATA } from "./data.js";
import { STATE, persist } from "./store.js";

/* ---------------- PROGRAM DEFINITIONS ---------------- */

export const PROGRAMS = {
  fullbody: {
    id: "fullbody",
    daysPerWeek: 3, // Base cycle length
    en: "Full Body A/B/C",
    ar: "فول بادي (الأصلي)",
    desc: "٣ جلسات فول بادي — كل عضلة ٣ مرات في الأسبوع. محتاج يوم راحة بين كل جلستين.",
    dayKeys: ["day1", "day2", "day3"],
    shortLabels: ["Full A", "Full B", "Full C"],
  },
  ppl3: {
    id: "ppl3",
    daysPerWeek: 3, // Base cycle length
    en: "Push / Pull / Legs",
    ar: "دفع / سحب / رجل",
    desc: "٣ جلسات: دفع، سحب، رجل — كل عضلة مرة في الأسبوع بحجم أعلى للجلسة.",
    dayKeys: ["dayPushA", "dayPullA", "dayLegsA"],
    shortLabels: ["Push", "Pull", "Legs"],
  },
  ppl6: {
    id: "ppl6",
    daysPerWeek: 6, // Base cycle length
    en: "PPL ×2 (6-Day)",
    ar: "دفع / سحب / رجل ×٢",
    desc: "٦ جلسات: Push/Pull/Legs مرتين في الأسبوع (A تقيل، B بتركيز مختلف) — كل عضلة مرتين.",
    dayKeys: ["dayPushA", "dayPullA", "dayLegsA", "dayPushB", "dayPullB", "dayLegsB"],
    shortLabels: ["Push A", "Pull A", "Legs A", "Push B", "Pull B", "Legs B"],
  },
};

export const DEFAULT_PROGRAM_ID = "fullbody";

/** All possible training frequencies (1 to 7 days). */
export const SUPPORTED_FREQUENCIES = [1, 2, 3, 4, 5, 6, 7];

/** Every day key any program uses, de-duplicated — used once at boot to
 * register a page per day (app.js). Order = first appearance. */
export const ALL_DAY_KEYS = Array.from(new Set(Object.values(PROGRAMS).flatMap((p) => p.dayKeys)));

/** Egyptian week order (Saturday first). `idx` matches Date.getDay(). */
export const WEEKDAYS = [
  { idx: 6, en: "Sat", ar: "السبت" },
  { idx: 0, en: "Sun", ar: "الأحد" },
  { idx: 1, en: "Mon", ar: "الاتنين" },
  { idx: 2, en: "Tue", ar: "التلات" },
  { idx: 3, en: "Wed", ar: "الأربع" },
  { idx: 4, en: "Thu", ar: "الخميس" },
  { idx: 5, en: "Fri", ar: "الجمعة" },
];

/** Sensible defaults: 3 days spaced by a rest day; 6 days with Friday off. */
export const DEFAULT_TRAINING_DAYS = {
  3: [6, 1, 3], // Sat, Mon, Wed
  6: [6, 0, 1, 2, 3, 4], // Sat..Thu, Fri rest
};

/* ---------------- STATE ACCESS (validated on every read) ---------------- */

function scheduleState() {
  if (!STATE.schedule || typeof STATE.schedule !== "object") STATE.schedule = {};
  return STATE.schedule;
}

function isValidWeekday(n) {
  return Number.isInteger(n) && n >= 0 && n <= 6;
}

/** Sorted-by-week-order, de-duplicated, range-checked copy of a weekday list. */
function sanitizeWeekdays(list) {
  if (!Array.isArray(list)) return [];
  const set = new Set(list.filter(isValidWeekday));
  return WEEKDAYS.map((w) => w.idx).filter((i) => set.has(i));
}

export function getActiveProgramId() {
  const id = STATE.schedule && STATE.schedule.programId;
  return PROGRAMS[id] ? id : DEFAULT_PROGRAM_ID;
}

export function getActiveProgram() {
  return PROGRAMS[getActiveProgramId()];
}

export function getActiveDayKeys() {
  // Defensive: only keys that still exist in DATA are returned, so a
  // content edit can never put a missing day into the rotation.
  return getActiveProgram().dayKeys.filter((k) => DATA[k] && Array.isArray(DATA[k].main));
}

export function getDaysPerWeek() {
  const s = scheduleState();
  return s.daysPerWeek || getActiveProgram().daysPerWeek;
}

/** Short label for a day within the *active* program ("Push A"), or "" if not in it. */
export function shortDayLabel(dayKey) {
  const p = getActiveProgram();
  const i = p.dayKeys.indexOf(dayKey);
  return i === -1 ? "" : p.shortLabels[i];
}

/** Programs that run `n` days per week, in display order. */
export function programsForFrequency(n) {
  return Object.values(PROGRAMS).filter((p) => p.daysPerWeek === n);
}

/**
 * Selected training weekdays for the active frequency. May hold FEWER
 * than daysPerWeek entries while the person is mid-edit (see
 * toggleTrainingDay); never more. Falls back to the default plan when
 * nothing valid is saved.
 */
export function getTrainingDays(count = getDaysPerWeek()) {
  const s = scheduleState();
  const saved = s.trainingDays && s.trainingDays[count];
  if (saved === undefined) return DEFAULT_TRAINING_DAYS[count] ? DEFAULT_TRAINING_DAYS[count].slice() : [];
  return sanitizeWeekdays(saved).slice(0, count);
}

export function isScheduleComplete() {
  return getTrainingDays().length === getDaysPerWeek();
}

/**
 * The week laid out in Egyptian order. Sessions are handed out to the
 * selected training days in order, so the first training day of the week
 * is session 1 of the program, and so on. Unselected days are rest days.
 * @returns {{weekday:number, en:string, ar:string, training:boolean,
 *   dayKey:string|null, label:string, sessionIndex:number}[]}
 */
export function getWeekPlan() {
  const keys = getActiveDayKeys();
  const program = getActiveProgram();
  const selected = new Set(getTrainingDays());
  let session = 0;
  return WEEKDAYS.map((w) => {
    if (!selected.has(w.idx)) {
      return { weekday: w.idx, en: w.en, ar: w.ar, training: false, dayKey: null, label: "", sessionIndex: -1 };
    }
    // Round-robin: if we run out of unique days in the program, loop back to the start.
    const keyIdx = session % keys.length;
    const dayKey = keys[keyIdx];
    const label = program.shortLabels[keyIdx] || program.shortLabels[0];
    session++;
    return { weekday: w.idx, en: w.en, ar: w.ar, training: true, dayKey, label, sessionIndex: session - 1 };
  });
}

/** Plan entry for a given Date (default: today). */
export function getPlanFor(date = new Date()) {
  const wd = date.getDay();
  return getWeekPlan().find((e) => e.weekday === wd) || null;
}

/**
 * Human-readable advisories about the current selection. Pure — returns
 * [{level:"info"|"warn", ar:string}] and never blocks anything.
 */
export function getScheduleWarnings() {
  const out = [];
  const need = getDaysPerWeek();
  const days = getTrainingDays();
  if (days.length < need) {
    out.push({ level: "info", ar: `اختار ${need - days.length} ${need - days.length === 1 ? "يوم" : "أيام"} كمان عشان الجدول يكمل (${days.length}/${need}).` });
    return out;
  }
  if (getActiveProgramId() === "fullbody") {
    const set = new Set(days);
    const adjacent = days.some((d) => set.has((d + 1) % 7));
    if (adjacent) {
      out.push({ level: "warn", ar: "فول بادي محتاج يوم راحة على الأقل بين كل جلستين (نفس العضلات بتتدرب كل جلسة) — جرّب توزّع الأيام بالتبادل." });
    }
  }
  return out;
}

/* ---------------- MUTATIONS (all persist; none touch workout data) ---------------- */

/** Switch the active program. Returns true if anything changed. */
export function setProgram(programId) {
  if (!PROGRAMS[programId]) return false;
  const s = scheduleState();
  if (s.programId === programId) return false;
  s.programId = programId;
  if (PROGRAMS[programId].daysPerWeek === 3) s.lastThree = programId;
  // Keep the legacy field in step so older code paths/readers stay correct.
  STATE.programDaysPerWeek = PROGRAMS[programId].daysPerWeek;
  persist();
  return true;
}

/** Switch weekly frequency (3 or 6), picking the program for it. */
export function setDaysPerWeek(n) {
  const days = parseInt(n, 10);
  if (!SUPPORTED_FREQUENCIES.includes(days)) return false;
  if (days === getDaysPerWeek()) return false;
  const s = scheduleState();
  s.daysPerWeek = days;
  // If it's 6, we might want to suggest/force PPL6, but we allow the user
  // to keep their chosen program template (e.g. FullBody cycled over 6 days).
  if (days === 6 && s.programId !== "ppl6") {
    // Optional: automatically switch to ppl6 if user chooses 6 days?
    // Let's keep it flexible as requested.
  }
  persist();
  return true;
}

/**
 * Toggle one weekday in/out of the training days for the active
 * frequency. Adding is refused once the plan is full (the person must
 * free a day first), so the count can never exceed daysPerWeek.
 * @returns {"added"|"removed"|"full"|"invalid"}
 */
export function toggleTrainingDay(weekday) {
  const wd = parseInt(weekday, 10);
  if (!isValidWeekday(wd)) return "invalid";
  const need = getDaysPerWeek();
  const days = getTrainingDays(need);
  const has = days.includes(wd);
  let next;
  if (has) {
    next = days.filter((d) => d !== wd);
  } else {
    if (days.length >= need) return "full";
    next = sanitizeWeekdays(days.concat(wd));
  }
  const s = scheduleState();
  s.trainingDays = s.trainingDays || {};
  s.trainingDays[need] = next;
  persist();
  return has ? "removed" : "added";
}

/** Restore the default weekdays for the active frequency. */
export function resetTrainingDays() {
  const need = getDaysPerWeek();
  const s = scheduleState();
  s.trainingDays = s.trainingDays || {};
  s.trainingDays[need] = DEFAULT_TRAINING_DAYS[need].slice();
  persist();
}
