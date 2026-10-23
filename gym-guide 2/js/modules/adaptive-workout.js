/**
 * adaptive-workout.js — Adaptive Workout engine (single source of truth)
 * ---------------------------------------------------------------
 * ONE program -> a dynamically adapted view of it. This is NOT a second
 * program and it never edits DATA. Given today's program day and the
 * person's level / energy / time / equipment it returns a structured plan:
 * which program slots to do, in what form, and (at high energy) which
 * accessories to add.
 *
 * Pure + deterministic + offline: no DOM, no STATE, no storage, no
 * randomness, no network. Same input -> same output, so it is testable
 * from Node (tools/validate-adaptive.mjs) and safe to cache per day.
 *
 *   buildAdaptiveWorkout({
 *     dayKey,                       // used for messages only
 *     slots: [{ index, id, sets, rest }],   // resolved by the CALLER with
 *                                           // getSlotRef(), so a person's own
 *                                           // Phase-4 replacements are respected
 *     level,   // "beginner"|"intermediate"|"advanced"  (STATE.profile.experience)
 *     energy,  // "low"|"normal"|"high"                   (daily)
 *     time,    // "20-30"|"30-45"|"45-60"|"60+" | null     (daily)
 *     availableCategories,          // Set|string[]|null from
 *                                   // availableCategoriesFromProfile(); null = no restriction
 *   })
 *
 * FLOW (spec §6/§8), in this order:
 *   1 resolve each slot    equipment -> level -> (low energy) tier; swap
 *                          through the existing alternatives engine or drop
 *   2 energy shape         low: fewer exercises, fewer sets, essential only
 *                          normal: whole plan   high: whole plan (+ accessories later)
 *   3 time fit             trim sets, then exercises, until the estimate fits
 *   4 accessories          high energy only; capped by level, fatigue and time
 *   5 balance report       compound/isolation mix, muscle coverage, fatigue
 *
 * Slot indices are PRESERVED on every program entry. Workout logs, sets and
 * history are keyed by slot position (see IMPLEMENTATION_STATUS.md,
 * "Constraints"), so the UI can show a subset without re-keying anything.
 * ---------------------------------------------------------------
 */
import { EXERCISES } from "./exercises-data.js";
import { getAlternatives } from "./exercise-alternatives.js";
import {
  getAdaptiveMeta,
  LEVEL_RULES,
  DEFAULT_LEVEL,
  TIME_OPTIONS,
  ENERGY_OPTIONS,
  TIER_LABELS,
  DIFFICULTY_RANK,
  TIER_RANK,
  PROGRAM_SLOT_SLACK,
} from "./adaptive-meta.js";

export const ADAPTIVE_ENGINE_VERSION = 1;

/* ---------------- TUNABLES (one place) ---------------- */

const WORK_SEC_PER_SET = 40; // time under tension + a few seconds to get into position
const SETUP_SEC_PER_EXERCISE = 60; // adjust seat/weights, walk to the station
const DEFAULT_REST_SEC = 75;
const MIN_SETS = 2; // never trim an exercise below this (unless the program already prescribes less)
const MIN_ENTRIES = 2;
const LOW_ENERGY_MAX_EXERCISES = 4;
const LOW_ENERGY_MIN_EXERCISES = 3;
const ACCESSORY_MAX_STABILITY_FOR_BEGINNER = 2;

// Large muscle groups that must stay represented at low energy / short time
// if today's session trains them. Small groups (arms, calves, core, traps,
// forearms) may be dropped first.
const MAJOR_GROUPS = new Set(["chest", "back", "shoulders", "quads", "hamstrings", "glutes"]);

/* ---------------- PARSING HELPERS ---------------- */

/** "3×8-10" -> { count: 3, suffix: "×8-10" }. Unparseable -> { count: 3, suffix: "" } (same fallback as ui.js setsCount). */
export function parseSets(text) {
  const m = String(text == null ? "" : text).match(/^(\d+)([\s\S]*)$/);
  return m ? { count: parseInt(m[1], 10), suffix: m[2] } : { count: 3, suffix: "" };
}

/** Rewrite only the leading set count so ui.js setsCount() keeps reading it. */
export function withSetCount(text, count) {
  const s = String(text == null ? "" : text);
  return /^\d+/.test(s) ? s.replace(/^\d+/, String(count)) : s;
}

/** "120 ث" -> 120, "60-90 ث" -> 75, anything else -> DEFAULT_REST_SEC. */
export function parseRestSec(text) {
  const m = String(text == null ? "" : text).match(/(\d+)(?:\s*-\s*(\d+))?/);
  if (!m) return DEFAULT_REST_SEC;
  return m[2] ? Math.round((parseInt(m[1], 10) + parseInt(m[2], 10)) / 2) : parseInt(m[1], 10);
}

function entryMinutes(e) {
  const perSet = WORK_SEC_PER_SET + e.restSec;
  return (e.setsCount * perSet - e.restSec + SETUP_SEC_PER_EXERCISE) / 60;
}

/** Realistic duration of the MAIN block in minutes (rest included). */
export function estimateMinutes(entries) {
  return Math.round(entries.reduce((t, e) => t + entryMinutes(e), 0) * 10) / 10;
}

/* ---------------- ELIGIBILITY ---------------- */

function normalizeAvailable(av) {
  if (av == null) return null;
  const set = av instanceof Set ? av : new Set(av);
  return set;
}

/**
 * Equipment rule (hard — spec §3): the exercise's library equipment must be
 * available, or the exercise must need nothing at all (homeMode "none").
 * Household-item "home adaptable" versions are NOT treated as free, so a
 * person who unticked Dumbbells never gets a dumbbell exercise.
 */
function equipmentOk(meta, avail) {
  if (!avail) return true;
  return avail.has(meta.equipmentCategory) || meta.homeMode === "none";
}

function levelOk(meta, level, isProgramSlot) {
  const rules = LEVEL_RULES[level];
  const slack = isProgramSlot ? PROGRAM_SLOT_SLACK[level] || 0 : 0;
  return (
    DIFFICULTY_RANK[meta.difficulty] <= DIFFICULTY_RANK[rules.maxDifficulty] + slack &&
    meta.technicalComplexity <= rules.maxTechnical + slack
  );
}

/**
 * Energy rule. Low = essential-tier only, for program slots too. Normal/High
 * leave program slots alone (the program IS the normal plan); for swaps and
 * accessories the candidate's tier must not exceed the energy tier.
 */
function tierOk(meta, tier, isProgramSlot) {
  if (tier === "essential") return TIER_RANK[meta.tier] <= TIER_RANK.essential;
  if (isProgramSlot) return true;
  return TIER_RANK[meta.tier] <= TIER_RANK[tier];
}

function signature(meta) {
  return meta.movementPattern + "|" + meta.targetMuscle;
}

/* ---------------- STEP 1: RESOLVE ONE SLOT ---------------- */

function failureReason(meta, ctx) {
  if (!equipmentOk(meta, ctx.avail)) return "equipment-swap";
  if (!levelOk(meta, ctx.level, true)) return "level-swap";
  if (!tierOk(meta, ctx.tier, true)) return "energy-swap";
  return null;
}

const BEGINNER_EQUIPMENT_ORDER = { Machine: 0, Cable: 1, Dumbbell: 2, Band: 3, Bodyweight: 3, Barbell: 4 };

/**
 * Ordering shared by every substitute choice.
 *  - beginners and low energy: the more stable setup wins
 *  - beginners: machines, then cables, then free weights (spec §1)
 *  - low energy: lower fatigue wins
 * `a`/`b` are { id, kind, score, order }.
 */
function compareCandidates(a, b, ctx) {
  const rank = (x) => (x.kind === "close" ? 0 : x.kind === "partial" ? 1 : 2);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  // Same-group fallback: a compound slot must get a compound substitute before
  // stability/fatigue are weighed (a hip-abduction machine is not a lunge).
  if (a.kind === "group" && b.kind === "group" && a.score !== b.score) return b.score - a.score;
  const ma = getAdaptiveMeta(a.id), mb = getAdaptiveMeta(b.id);
  if (ctx.energy === "low" || ctx.level === "beginner") {
    if (ma.stabilityRequirement !== mb.stabilityRequirement) return ma.stabilityRequirement - mb.stabilityRequirement;
  }
  if (ctx.level === "beginner") {
    const ea = BEGINNER_EQUIPMENT_ORDER[ma.equipment], eb = BEGINNER_EQUIPMENT_ORDER[mb.equipment];
    if (ea !== eb) return ea - eb;
  }
  if (ctx.energy === "low" && ma.fatigueCost !== mb.fatigueCost) return ma.fatigueCost - mb.fatigueCost;
  return b.score - a.score || a.order - b.order;
}

/**
 * Substitute for a slot the person cannot (or should not) do today.
 * 1) the existing alternatives engine: same pattern AND muscle ("close"),
 *    then same group ("partial");
 * 2) fallback "group": nothing in (1) fits (e.g. low energy removed the only
 *    lunge variants) -> a simple exercise for the SAME muscle group so a large
 *    muscle is not silently lost. The stimulus differs, so it is flagged.
 */
function pickSwap(srcId, srcMeta, ctx, taken) {
  const sigs = new Set([...taken.values()].map(signature));
  const fits = (m) =>
    m && !taken.has(m.id) && !sigs.has(signature(m)) &&
    equipmentOk(m, ctx.avail) && levelOk(m, ctx.level, false) && tierOk(m, ctx.tier, false);

  const alts = getAlternatives(srcId, { availableCategories: null });
  const pool = [];
  if (alts) {
    alts.close.forEach((a) => pool.push({ id: a.id, kind: "close", score: a.score }));
    alts.partial.forEach((a) => {
      const m = getAdaptiveMeta(a.id);
      if (m && m.muscleGroup === srcMeta.muscleGroup) pool.push({ id: a.id, kind: "partial", score: a.score });
    });
  }
  let usable = pool.filter((c) => fits(getAdaptiveMeta(c.id))).map((c) => ({ ...c, order: getAdaptiveMeta(c.id).order }));
  if (!usable.length) {
    usable = EXERCISES.map((ex) => getAdaptiveMeta(ex.id))
      .filter((m) => m && m.muscleGroup === srcMeta.muscleGroup && fits(m))
      // keep the slot's role: a compound slot prefers a compound substitute
      .map((m) => ({ id: m.id, kind: "group", score: m.exerciseType === srcMeta.exerciseType ? 10 : 0, order: m.order }));
  }
  if (!usable.length) return null;
  usable.sort((a, b) => compareCandidates(a, b, ctx));
  return { id: usable[0].id, kind: usable[0].kind };
}

function makeEntry(slot, id, source, reasons, meta, slotGroup) {
  const sets = parseSets(slot.sets);
  const restSec = parseRestSec(slot.rest);
  return {
    slotIndex: slot.index,
    id,
    originalId: slot.id,
    source, // "program" | "swap"
    reasons,
    sets: slot.sets,
    setsCount: sets.count,
    originalSetsCount: sets.count,
    rest: slot.rest,
    restSec,
    muscleGroup: meta.muscleGroup,
    // The group the SLOT trains today. A close swap can sit in a different
    // library group (walking-lunge is filed under glutes, its swap
    // split-squat under quads) while still doing the same job in the plan,
    // so coverage and trimming are judged on this, not on the swap's label.
    slotGroup: slotGroup || meta.muscleGroup,
    exerciseType: meta.exerciseType,
    fatigueCost: meta.fatigueCost,
    prio: 0,
  };
}

/* ---------------- ENGINE ---------------- */

export function buildAdaptiveWorkout(input = {}) {
  const levelKnown = LEVEL_RULES[input.level];
  const level = levelKnown ? input.level : DEFAULT_LEVEL;
  const energyOpt = ENERGY_OPTIONS.find((o) => o.key === input.energy) || ENERGY_OPTIONS[1];
  const energy = energyOpt.key;
  const tier = energyOpt.tier;
  const timeOpt = TIME_OPTIONS.find((o) => o.key === input.time) || null;
  const avail = normalizeAvailable(input.availableCategories);
  const rules = LEVEL_RULES[level];
  const ctx = { level, energy, tier, avail };
  const notes = new Set();
  const dropped = [];

  const slots = (Array.isArray(input.slots) ? input.slots : []).filter((s) => s && s.id);

  /* ---- step 1: resolve every slot (equipment -> level -> energy) ---- */
  const taken = new Map(); // id -> meta, reserved so a swap never duplicates another slot
  slots.forEach((s) => {
    const m = getAdaptiveMeta(s.id);
    if (m && !failureReason(m, ctx)) taken.set(s.id, m);
  });

  let entries = [];
  slots.forEach((slot) => {
    const meta = getAdaptiveMeta(slot.id);
    if (!meta) {
      // Unknown id: never crash a day — keep it exactly as the program has it.
      const sets = parseSets(slot.sets);
      entries.push({
        slotIndex: slot.index, id: slot.id, originalId: slot.id, source: "program", reasons: ["unknown-exercise"],
        sets: slot.sets, setsCount: sets.count, originalSetsCount: sets.count,
        rest: slot.rest, restSec: parseRestSec(slot.rest),
        muscleGroup: "", slotGroup: "", exerciseType: "builder", fatigueCost: 2, prio: 0,
      });
      return;
    }
    const why = failureReason(meta, ctx);
    if (!why) {
      entries.push(makeEntry(slot, slot.id, "program", [], meta, meta.muscleGroup));
      return;
    }
    // Fallback ladder. Low energy must never cancel the session (spec §2), so
    // when no ESSENTIAL substitute exists we relax step by step and flag it:
    //   essential swap -> standard swap -> keep the program's own exercise
    //   (volume is still reduced later) -> drop only if equipment/level forbid it.
    let swap = pickSwap(slot.id, meta, ctx, taken);
    let relaxed = null;
    if (!swap && energy === "low") {
      swap = pickSwap(slot.id, meta, { ...ctx, tier: "standard" }, taken);
      if (swap) relaxed = "relaxed-tier";
    }
    if (!swap && energy === "low" && equipmentOk(meta, avail) && levelOk(meta, level, true)) {
      taken.set(slot.id, meta);
      entries.push(makeEntry(slot, slot.id, "program", ["kept-demanding"], meta, meta.muscleGroup));
      notes.add("kept-demanding");
      return;
    }
    if (!swap) {
      dropped.push({ slotIndex: slot.index, id: slot.id, reason: why, detail: "no-alternative" });
      notes.add("dropped-no-alternative");
      return;
    }
    const swapMeta = getAdaptiveMeta(swap.id);
    taken.set(swap.id, swapMeta);
    const reasons = [why];
    if (swap.kind !== "close") {
      const flag = swap.kind === "group" ? "group-fallback" : "partial-swap";
      reasons.push(flag); // the stimulus differs from the program's exercise: the UI must say so
      notes.add(flag);
    }
    if (relaxed) {
      reasons.push(relaxed);
      notes.add(relaxed);
    }
    entries.push(makeEntry(slot, swap.id, "swap", reasons, swapMeta, meta.muscleGroup));
    notes.add(why);
  });

  /* ---- priority (used by every later trimming step) ----
   * lower = more important: large muscle groups first, then compound before
   * isolation, then untouched program slots before substitutes, then the
   * program's own order (the author put the key lift first). */
  entries.forEach((e) => {
    const major = MAJOR_GROUPS.has(e.slotGroup) ? 0 : 1;
    const type = e.exerciseType === "builder" ? 0 : 1;
    // +50: when two slots train the same thing, keep the one the program
    // author wrote before a substitute (50 < 100, so type still dominates).
    e.prio = major * 1000 + type * 100 + (e.source === "swap" ? 50 : 0) + e.slotIndex;
  });
  const byPrio = (a, b) => a.prio - b.prio;

  /* ---- step 2a: low energy keeps the essentials only ---- */
  if (energy === "low" && entries.length > LOW_ENERGY_MIN_EXERCISES) {
    const majorsPresent = new Set(entries.filter((e) => MAJOR_GROUPS.has(e.slotGroup)).map((e) => e.slotGroup)).size;
    const base = Math.min(LOW_ENERGY_MAX_EXERCISES, Math.max(LOW_ENERGY_MIN_EXERCISES, Math.ceil(entries.length * 0.6)));
    const target = Math.min(entries.length, Math.max(base, Math.min(majorsPresent, LOW_ENERGY_MAX_EXERCISES + 1)));
    const sorted = entries.slice().sort(byPrio);
    const chosen = new Set();
    const groupsSeen = new Set();
    sorted.forEach((e) => {
      if (chosen.size < target && !groupsSeen.has(e.slotGroup)) {
        chosen.add(e);
        groupsSeen.add(e.slotGroup);
      }
    });
    sorted.forEach((e) => {
      if (chosen.size < target && !chosen.has(e)) chosen.add(e);
    });
    entries.forEach((e) => {
      if (!chosen.has(e)) dropped.push({ slotIndex: e.slotIndex, id: e.id, reason: "energy", detail: "fewer-exercises" });
    });
    if (chosen.size < entries.length) notes.add("fewer-exercises");
    entries = entries.filter((e) => chosen.has(e));
  }

  /* ---- step 2b: set counts (volume) ---- */
  entries.forEach((e) => {
    let n = e.setsCount;
    if (energy === "low" && n > MIN_SETS) {
      n -= 1;
      notes.add("fewer-sets");
    }
    if (n > rules.setCap) {
      n = rules.setCap;
      notes.add("set-cap");
    }
    e.setsCount = n;
  });

  /* ---- step 3: time fit (rest is never shortened to cram work in) ---- */
  const budget = timeOpt ? timeOpt.budgetMin : null;
  const trim = () => {
    if (budget == null) return;
    for (let guard = 0; guard < 200 && estimateMinutes(entries) > budget; guard++) {
      const reducible = entries.filter((e) => e.setsCount > MIN_SETS).sort((a, b) => b.prio - a.prio);
      if (reducible.length) {
        reducible[0].setsCount -= 1;
        notes.add("time-trimmed");
        continue;
      }
      if (entries.length <= MIN_ENTRIES) break;
      const groupCount = {};
      entries.forEach((e) => (groupCount[e.slotGroup] = (groupCount[e.slotGroup] || 0) + 1));
      const redundant = entries.filter((e) => groupCount[e.slotGroup] > 1).sort((a, b) => b.prio - a.prio);
      const victim = (redundant.length ? redundant : entries.slice().sort((a, b) => b.prio - a.prio))[0];
      entries = entries.filter((e) => e !== victim);
      dropped.push({ slotIndex: victim.slotIndex, id: victim.id, reason: "time", detail: "time-trimmed" });
      notes.add("time-trimmed");
    }
  };
  trim();

  /* ---- step 4: accessories (high energy only) ---- */
  const extras = [];
  if (energy === "high" && slots.length) {
    const todayGroups = new Set(
      slots.map((s) => getAdaptiveMeta(s.id)).filter(Boolean).map((m) => m.muscleGroup)
    );
    const fatigueOf = () => entries.concat(extras).reduce((t, e) => t + e.fatigueCost, 0);
    for (let i = 0; i < rules.maxAccessories; i++) {
      const all = entries.concat(extras);
      const have = new Set(all.map((e) => e.id));
      const sigs = new Set(all.map((e) => signature(getAdaptiveMeta(e.id) || { movementPattern: "", targetMuscle: "" })));
      const muscles = new Set(all.map((e) => (getAdaptiveMeta(e.id) || {}).targetMuscle));
      const cats = new Set(all.map((e) => (getAdaptiveMeta(e.id) || {}).equipmentCategory));
      const hasIso = all.some((e) => e.exerciseType !== "builder");
      const hasBuilder = all.some((e) => e.exerciseType === "builder");
      let best = null;
      for (const ex of EXERCISES) {
        const m = getAdaptiveMeta(ex.id);
        if (!m || have.has(m.id) || !todayGroups.has(m.muscleGroup)) continue;
        if (sigs.has(signature(m))) continue;
        if (!equipmentOk(m, avail) || !levelOk(m, level, false) || !tierOk(m, tier, false)) continue;
        if (level === "beginner" && m.stabilityRequirement > ACCESSORY_MAX_STABILITY_FOR_BEGINNER) continue;
        if (fatigueOf() + m.fatigueCost > rules.fatigueBudget) continue;
        let score = 0;
        if (!muscles.has(m.targetMuscle)) score += 3; // fills a gap
        if (!hasIso && m.exerciseType !== "builder") score += 2; // avoid all-compound
        if (!hasBuilder && m.exerciseType === "builder") score += 2; // avoid all-isolation
        if (cats.has(m.equipmentCategory)) score += 1; // same station/equipment as the session
        score -= m.fatigueCost * 0.5; // high energy != high fatigue
        if (!best || score > best.score) best = { m, score };
      }
      if (!best) break;
      const m = best.m;
      const setsCount = Math.min(m.defaultSets, rules.setCap);
      const candidate = {
        slotIndex: null, id: m.id, originalId: null, source: "extra", reasons: ["accessory-added"],
        sets: setsCount + "×" + m.defaultReps, setsCount, originalSetsCount: setsCount,
        rest: m.defaultRest + " ث", restSec: m.defaultRest,
        muscleGroup: m.muscleGroup, slotGroup: m.muscleGroup, exerciseType: m.exerciseType, fatigueCost: m.fatigueCost, prio: 9000 + i,
      };
      if (budget != null && estimateMinutes(entries.concat(extras, [candidate])) > budget) break;
      extras.push(candidate);
      notes.add("accessory-added");
    }
  }
  const finalEntries = entries.sort((a, b) => a.slotIndex - b.slotIndex).concat(extras);

  /* ---- finalize: rewrite the visible set text, never the original ---- */
  finalEntries.forEach((e) => {
    if (e.source !== "extra") e.sets = withSetCount(e.sets, e.setsCount);
    if (e.setsCount < e.originalSetsCount && !e.reasons.includes("fewer-sets")) e.reasons.push("fewer-sets");
  });

  /* ---- step 5: balance report (read by tests and the UI "why" line) ---- */
  const metas = finalEntries.map((e) => getAdaptiveMeta(e.id)).filter(Boolean);
  const originalGroups = new Set(slots.map((s) => (getAdaptiveMeta(s.id) || {}).muscleGroup).filter(Boolean));
  const finalGroups = new Set(finalEntries.map((e) => e.slotGroup).filter(Boolean));
  const missingGroups = [...originalGroups].filter((g) => !finalGroups.has(g));
  const missingMajorGroups = missingGroups.filter((g) => MAJOR_GROUPS.has(g));
  const minutes = estimateMinutes(finalEntries);
  const changed =
    finalEntries.length !== slots.length ||
    finalEntries.some((e) => e.source !== "program" || e.setsCount !== e.originalSetsCount);

  return {
    version: ADAPTIVE_ENGINE_VERSION,
    dayKey: input.dayKey || null,
    level,
    levelAssumed: !levelKnown,
    energy,
    tier,
    tierLabel: TIER_LABELS[tier],
    time: timeOpt ? timeOpt.key : null,
    entries: finalEntries,
    dropped,
    notes: [...notes],
    summaryKey: changed ? "adapted" : "unchanged",
    estimate: { minutes, budget, withinBudget: budget == null || minutes <= budget },
    balance: {
      builders: metas.filter((m) => m.exerciseType === "builder").length,
      isolations: metas.filter((m) => m.exerciseType === "isolation").length,
      stability: metas.filter((m) => m.exerciseType === "stability").length,
      fatigueTotal: finalEntries.reduce((t, e) => t + e.fatigueCost, 0),
      groups: [...finalGroups],
      missingGroups,
      missingMajorGroups,
    },
  };
}
