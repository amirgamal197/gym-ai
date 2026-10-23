/**
 * replacements.js — Safe exercise replacement (Phase 4)
 * ---------------------------------------------------------------
 * Lets a person swap ONE exercise inside ONE workout day for another
 * from the library, without ever editing DATA (data.js) and without
 * destroying completed sets, typed weights/reps or session history.
 *
 * Model
 * - A *slot* is a position in a day: `dayKey` + `index`. The slot key
 *   is the same "<dayKey>-main-<i>" key the whole app already uses for
 *   STATE.sets / STATE.logs / STATE.history, so tracking, Gym Mode,
 *   progression and the dashboard keep working unchanged.
 * - STATE.exerciseOverrides[dayKey][index] = { id, originalId, since }
 *   says "this slot currently runs <id> instead of DATA's exercise".
 *   Removing the entry (swapping back to the original) restores the
 *   program exactly as written.
 * - The slot key always holds the data of the ACTIVE exercise. When a
 *   slot changes exercise, the outgoing exercise's sets, logs (weights,
 *   reps, RPE) and history are MOVED — not deleted — to an archive key
 *   "<slotKey>~<exerciseId>". Swapping back moves them home again.
 *   The incoming exercise therefore starts with clean sets/logs and its
 *   own history, and the old exercise's history stays attached to it.
 * - Before archiving, any work already done on the outgoing exercise
 *   today (ticked sets or typed weights) is written to that exercise's
 *   history as a `partial` entry, so a mid-session swap never loses it.
 * - Every history entry written from here (and, since Phase 4, from
 *   workout.js) carries `exerciseId`.
 * - STATE.swapLog keeps a small audit trail of swaps (last 100).
 *
 * Pure state logic: no DOM. Importable from Node for validation.
 * ---------------------------------------------------------------
 */
import { DATA } from "./data.js";
import { EXERCISES } from "./exercises-data.js";
import { STATE, persist, localISODate } from "./store.js";

const LIB = new Map(EXERCISES.map((e) => [e.id, e]));
const ARCHIVE_SEP = "~";
const MAX_HISTORY = 8; // same cap workout.js applies per exercise
const MAX_SWAP_LOG = 100;

/* ---------------- slot helpers ---------------- */

export function slotKey(dayKey, index) {
  return `${dayKey}-main-${index}`;
}

/** "dayPushA-main-2" -> { dayKey, index }; null for anything else (incl. archive keys). */
export function parseSlotKey(key) {
  const m = /^(day[A-Za-z0-9]+)-main-(\d+)$/.exec(String(key || ""));
  return m ? { dayKey: m[1], index: parseInt(m[2], 10) } : null;
}

export function archiveKey(dayKey, index, exerciseId) {
  return slotKey(dayKey, index) + ARCHIVE_SEP + exerciseId;
}

/** True for "<slotKey>~<exerciseId>" history/sets keys. */
export function isArchiveKey(key) {
  return String(key || "").includes(ARCHIVE_SEP);
}

/** { slotKey, exerciseId } for an archive key, else null. */
export function parseArchiveKey(key) {
  const i = String(key || "").indexOf(ARCHIVE_SEP);
  if (i < 0) return null;
  return { slotKey: key.slice(0, i), exerciseId: key.slice(i + 1) };
}

function baseRef(dayKey, index) {
  const d = DATA[dayKey];
  return d && Array.isArray(d.main) ? d.main[index] || null : null;
}

function overrideFor(dayKey, index) {
  const map = isPlainObject(STATE.exerciseOverrides) ? STATE.exerciseOverrides[dayKey] : null;
  const o = isPlainObject(map) ? map[index] : null;
  if (!o || typeof o !== "object" || typeof o.id !== "string" || !LIB.has(o.id)) return null; // corrupt/unknown -> ignore
  const base = baseRef(dayKey, index);
  if (!base || o.id === base.id) return null;
  return o;
}

/* ---------------- reading the effective program ---------------- */

/** Id of the exercise currently active in a slot (override or the program's own). */
export function getSlotExerciseId(dayKey, index) {
  const base = baseRef(dayKey, index);
  if (!base) return null;
  const o = overrideFor(dayKey, index);
  return o ? o.id : base.id;
}

/** Id of the exercise the program originally prescribes for this slot. */
export function getOriginalExerciseId(dayKey, index) {
  const base = baseRef(dayKey, index);
  return base ? base.id : null;
}

/**
 * The effective DayEx-style reference for a slot. For an untouched slot
 * this IS the DATA object. For a replaced slot it keeps the slot's
 * PRESCRIPTION (sets x reps, rest, RPE target — the session structure)
 * but drops the original's exercise-specific coaching text, tempo and
 * progression notes, which would be wrong for a different movement;
 * workout.js fills the replacement's coaching from the library instead.
 */
export function getSlotRef(dayKey, index) {
  const base = baseRef(dayKey, index);
  if (!base) return null;
  const o = overrideFor(dayKey, index);
  if (!o) return base;
  return {
    id: o.id,
    sets: base.sets,
    rest: base.rest,
    rpe: base.rpe,
    tempo: "—",
    stabilizers: "",
    cue: "",
    mistake: "",
    why: "",
    prog: "",
    reg: "",
    vid: null,
    replaced: true,
    originalId: base.id,
  };
}

export function getReplacementInfo(dayKey, index) {
  const o = overrideFor(dayKey, index);
  const base = baseRef(dayKey, index);
  if (!o || !base) return { replaced: false, id: base ? base.id : null, originalId: base ? base.id : null, since: null };
  return { replaced: true, id: o.id, originalId: base.id, since: o.since || null };
}

/** Active exercise ids for every slot of a day, in order. */
export function getDayExerciseIds(dayKey) {
  const d = DATA[dayKey];
  if (!d || !Array.isArray(d.main)) return [];
  return d.main.map((_, i) => getSlotExerciseId(dayKey, i));
}

/* ---------------- slot data movement ---------------- */

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
/** Saved state comes from localStorage — never trust its shape. */
function plainObject(v) {
  return isPlainObject(v) ? v : {};
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Regex matching exactly the log keys that belong to `prefixKey`: "<key>-<n>-w|r" and "<key>-rpe". */
function logKeyRe(prefixKey) {
  return new RegExp("^" + escapeRe(prefixKey) + "-(?:\\d+-[wr]|rpe)$");
}

function logKeysOf(prefixKey) {
  const re = logKeyRe(prefixKey);
  return Object.keys(STATE.logs || {}).filter((k) => re.test(k));
}

/** Move sets/logs/history stored under `fromKey` to `toKey` (overwriting toKey's sets/logs; merging history). */
function moveData(fromKey, toKey) {
  if (fromKey === toKey) return;
  if (STATE.sets && STATE.sets[fromKey] !== undefined) {
    STATE.sets[toKey] = STATE.sets[fromKey];
    delete STATE.sets[fromKey];
  }
  if (STATE.logs) {
    const suffixRe = /-(?:\d+-[wr]|rpe)$/;
    logKeysOf(fromKey).forEach((k) => {
      const suffix = k.slice(fromKey.length); // "-0-w" | "-rpe"
      if (suffixRe.test(suffix)) STATE.logs[toKey + suffix] = STATE.logs[k];
      delete STATE.logs[k];
    });
  }
  if (STATE.history && STATE.history[fromKey] !== undefined) {
    const moved = STATE.history[fromKey];
    const existing = STATE.history[toKey];
    STATE.history[toKey] = Array.isArray(existing) && existing.length ? mergeHistory(existing, moved) : moved;
    delete STATE.history[fromKey];
  }
}

function mergeHistory(a, b) {
  const all = a.concat(b).sort((x, y) => String(x.dateISO || "").localeCompare(String(y.dateISO || "")));
  return all.slice(-MAX_HISTORY);
}

function epley(w, r) {
  return w && r ? Math.round(w * (1 + r / 30) * 10) / 10 : 0;
}

/**
 * Work currently recorded on a slot: ticked sets and typed weight x reps.
 * Used both to preserve it on swap and to tell the person what is kept.
 */
export function getSlotWorkSummary(dayKey, index) {
  const key = slotKey(dayKey, index);
  const sets = (STATE.sets && STATE.sets[key]) || {};
  const setsDone = Object.values(sets).filter(Boolean).length;
  let volume = 0;
  let best1rm = 0;
  let loggedSets = 0;
  logKeysOf(key).forEach((k) => {
    const m = /-(\d+)-w$/.exec(k);
    if (!m) return;
    const w = parseFloat(STATE.logs[k]) || 0;
    const r = parseFloat(STATE.logs[`${key}-${m[1]}-r`]) || 0;
    if (w > 0 && r > 0) loggedSets++;
    volume += w * r;
    best1rm = Math.max(best1rm, epley(w, r));
  });
  const rpe = STATE.logs && STATE.logs[`${key}-rpe`];
  return {
    setsDone,
    loggedSets,
    volume: Math.round(volume),
    best1rm,
    hasWork: setsDone > 0 || volume > 0 || (rpe !== undefined && rpe !== ""),
  };
}

/* ---------------- replacing / restoring ---------------- */

/**
 * Why a swap would be refused (null = allowed). `newId` must be a library
 * exercise, different from the active one, and not already used by another
 * slot of the same day (two identical exercises in one session would also
 * share nothing but confuse history).
 */
export function validateReplacement(dayKey, index, newId) {
  if (!baseRef(dayKey, index)) return "no-slot";
  if (!LIB.has(newId)) return "unknown-exercise";
  const active = getSlotExerciseId(dayKey, index);
  if (newId === active) return "same-exercise";
  const others = getDayExerciseIds(dayKey).filter((_, i) => i !== index);
  if (others.includes(newId)) return "already-in-day";
  return null;
}

export const REFUSAL_MESSAGES = {
  "no-slot": { en: "That exercise slot no longer exists.", ar: "مكان التمرين ده مبقاش موجود." },
  "unknown-exercise": { en: "That exercise is not in the library.", ar: "التمرين ده مش موجود في المكتبة." },
  "same-exercise": { en: "That is already the exercise in this slot.", ar: "ده نفس التمرين الحالي." },
  "already-in-day": { en: "That exercise is already in this workout day.", ar: "التمرين ده موجود فعلًا في نفس اليوم." },
};

/**
 * Replace (or restore) the exercise in a slot. Returns
 *   { ok:true, restoredOriginal, preserved:{setsDone, volume, savedPartial}, fromId, toId }
 * or { ok:false, reason }.
 * Passing the slot's ORIGINAL id restores the program's own exercise.
 */
export function replaceExercise(dayKey, index, newId, now = new Date()) {
  const reason = validateReplacement(dayKey, index, newId);
  if (reason) return { ok: false, reason };

  const base = baseRef(dayKey, index);
  const oldId = getSlotExerciseId(dayKey, index);
  const key = slotKey(dayKey, index);
  const dateISO = localISODate(now);

  STATE.sets = plainObject(STATE.sets);
  STATE.logs = plainObject(STATE.logs);
  STATE.history = plainObject(STATE.history);

  // 1) Keep today's partial work on the outgoing exercise as a history entry.
  const work = getSlotWorkSummary(dayKey, index);
  let savedPartial = false;
  if (work.hasWork) {
    const list = STATE.history[key] || [];
    const alreadySavedToday = list.length && list[list.length - 1].dateISO === dateISO;
    if (!alreadySavedToday) {
      const lib = LIB.get(oldId);
      list.push({
        date: now.toLocaleDateString("ar-EG"),
        dateISO,
        dayKey,
        volume: work.volume,
        best1rm: work.best1rm,
        name: lib ? lib.en : oldId,
        exerciseId: oldId,
        partial: true,
        setsDone: work.setsDone,
      });
      if (list.length > MAX_HISTORY) list.shift();
      STATE.history[key] = list;
      savedPartial = true;
    }
  }

  // 2) Archive the outgoing exercise's data, then bring the incoming one's home (if it was used here before).
  moveData(key, archiveKey(dayKey, index, oldId));
  moveData(archiveKey(dayKey, index, newId), key);

  // 3) Update the override map (the original id clears the override).
  STATE.exerciseOverrides = plainObject(STATE.exerciseOverrides);
  if (STATE.exerciseOverrides[dayKey] !== undefined && !isPlainObject(STATE.exerciseOverrides[dayKey])) delete STATE.exerciseOverrides[dayKey];
  const restoring = newId === base.id;
  if (restoring) {
    if (STATE.exerciseOverrides[dayKey]) {
      delete STATE.exerciseOverrides[dayKey][index];
      if (!Object.keys(STATE.exerciseOverrides[dayKey]).length) delete STATE.exerciseOverrides[dayKey];
    }
  } else {
    STATE.exerciseOverrides[dayKey] = STATE.exerciseOverrides[dayKey] || {};
    STATE.exerciseOverrides[dayKey][index] = { id: newId, originalId: base.id, since: dateISO };
  }

  // 4) Audit trail.
  STATE.swapLog = Array.isArray(STATE.swapLog) ? STATE.swapLog : [];
  STATE.swapLog.push({
    dayKey,
    index,
    fromId: oldId,
    toId: newId,
    originalId: base.id,
    dateISO,
    setsDone: work.setsDone,
    volume: work.volume,
    savedPartial,
  });
  if (STATE.swapLog.length > MAX_SWAP_LOG) STATE.swapLog.splice(0, STATE.swapLog.length - MAX_SWAP_LOG);

  persist();
  return {
    ok: true,
    restoredOriginal: restoring,
    fromId: oldId,
    toId: newId,
    preserved: { setsDone: work.setsDone, volume: work.volume, savedPartial },
  };
}

/** Convenience: put the program's own exercise back into a slot. */
export function restoreOriginal(dayKey, index, now) {
  const base = baseRef(dayKey, index);
  if (!base) return { ok: false, reason: "no-slot" };
  return replaceExercise(dayKey, index, base.id, now);
}

/** Number of slots in a day that currently run a replacement. */
export function countReplacements(dayKey) {
  const d = DATA[dayKey];
  if (!d || !Array.isArray(d.main)) return 0;
  return d.main.reduce((n, _, i) => n + (overrideFor(dayKey, i) ? 1 : 0), 0);
}
