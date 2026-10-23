#!/usr/bin/env node
/**
 * validate-adaptive.mjs — Adaptive Workout checks (no dependencies)
 * Run from the project root:  node tools/validate-adaptive.mjs [--table]
 *
 * Proves, over EVERY program day x 3 levels x 3 energies x 5 time settings
 * x 7 equipment profiles, the rules the spec calls non-negotiable:
 *   - equipment the person does not have is never selected
 *   - level defines the pool (beginner never gets an advanced exercise,
 *     high energy never widens the pool)
 *   - low energy: essential-tier only, never more exercises/sets than normal
 *   - high energy: never more sets than normal, accessories capped and
 *     bounded by the fatigue budget, never duplicate a pattern
 *   - time: the estimate fits the window, shorter windows never give a
 *     longer workout, 20-30 min is clearly shorter than 60+
 *   - program slot indices are preserved (logs are keyed by slot position)
 *   - deterministic: same input -> identical output
 * `--table` also prints the nine level x energy combinations for two days.
 */
import { DATA } from "../js/modules/data.js";
import { EXERCISES } from "../js/modules/exercises-data.js";
import { ALL_DAY_KEYS } from "../js/modules/schedule.js";
import { availableCategoriesFromProfile } from "../js/modules/exercise-alternatives.js";
import * as M from "../js/modules/adaptive-meta.js";
import * as E from "../js/modules/adaptive-workout.js";

let pass = 0;
const failures = [];
function check(name, cond, detail = "") {
  if (cond) pass++;
  else if (failures.length < 60) failures.push(`${name}${detail ? " — " + detail : ""}`);
  else failures.push("…");
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ============ A. metadata ============ */
const all = M.allAdaptiveMeta();
check("A1 every library exercise has adaptive metadata", all.length === EXERCISES.length, `${all.length}/${EXERCISES.length}`);
check("A2 every ADAPTIVE_OVERRIDES id exists", Object.keys(M.ADAPTIVE_OVERRIDES).every((id) => M.getAdaptiveMeta(id)));
check("A3 unknown id -> null", M.getAdaptiveMeta("no-such-exercise") === null);
for (const m of all) {
  const ok = (v) => v === 1 || v === 2 || v === 3;
  check(`A4 ${m.id} ranges`, ok(m.technicalComplexity) && ok(m.stabilityRequirement) && ok(m.fatigueCost));
  check(`A5 ${m.id} tier`, ["essential", "standard", "optimal"].includes(m.tier));
  check(`A6 ${m.id} defaults`, m.defaultSets >= 1 && typeof m.defaultReps === "string" && m.defaultRest >= 30);
  if (m.difficulty === "Beginner") check(`A7 beginner ${m.id} is not highly technical`, m.technicalComplexity <= 2);
  if (m.tier === "essential") check(`A8 essential ${m.id} is low-demand`, m.fatigueCost <= 2 && m.technicalComplexity <= 2 && m.stabilityRequirement <= 2);
}
// The three concepts must really be separate (spec §13), not one number copied.
check("A9 difficulty != technicalComplexity somewhere", all.some((m) => M.DIFFICULTY_RANK[m.difficulty] !== m.technicalComplexity));
check("A10 fatigue != technical somewhere", all.some((m) => m.fatigueCost !== m.technicalComplexity));
check("A11 deadlifts/squats are high fatigue", ["conventional-deadlift", "back-squat", "front-squat"].every((id) => M.getAdaptiveMeta(id).fatigueCost === 3));
check("A12 machine isolation is low fatigue", ["leg-extension", "seated-leg-curl", "pec-deck-fly"].every((id) => M.getAdaptiveMeta(id).fatigueCost === 1));
// every library muscle group must be able to serve a low-energy day
const groups = [...new Set(EXERCISES.map((e) => e.group))];
groups.forEach((g) => {
  check(`A13 group ${g} has essential exercises`, all.some((m) => m.muscleGroup === g && m.tier === "essential"));
  check(`A14 group ${g} has a beginner exercise`, all.some((m) => m.muscleGroup === g && m.difficulty === "Beginner"));
});

/* ============ B. parsing ============ */
check("B1 parseSets 3×8-10", E.parseSets("3×8-10").count === 3);
check("B2 parseSets fallback", E.parseSets("").count === 3 && E.parseSets(undefined).count === 3);
check("B3 withSetCount keeps suffix", E.withSetCount("4×6-8", 3) === "3×6-8");
check("B4 withSetCount leaves non-numeric alone", E.withSetCount("abc", 2) === "abc");
check("B5 rest 120", E.parseRestSec("120 ث") === 120);
check("B6 rest range", E.parseRestSec("60-90 ث") === 75);
check("B7 rest with note", E.parseRestSec("45 ث (سوبرسيت مع اللي بعده)") === 45);
check("B8 rest fallback", E.parseRestSec("") === 75);
// every main slot in the program parses to a sane set count + rest
ALL_DAY_KEYS.forEach((dk) =>
  DATA[dk].main.forEach((s, i) => {
    check(`B9 ${dk}[${i}] sets parse`, /^\d+×/.test(s.sets) && E.parseSets(s.sets).count >= 1);
    check(`B10 ${dk}[${i}] rest parse`, E.parseRestSec(s.rest) >= 30);
    check(`B11 ${dk}[${i}] id in library`, !!M.getAdaptiveMeta(s.id), s.id);
  })
);

/* ============ C. engine matrix ============ */
const LEVELS = ["beginner", "intermediate", "advanced"];
const ENERGIES = ["low", "normal", "high"];
const TIMES = ["20-30", "30-45", "45-60", "60+", null];
const PROFILES = {
  none: [],
  fullGym: ["full-gym"],
  machinesOnly: ["machines"],
  noBarbell: ["dumbbells", "cables", "machines", "bodyweight"],
  dumbbellsOnly: ["dumbbells"],
  bodyweightOnly: ["bodyweight"],
  bandsOnly: ["bands"],
};

const slotsOf = (dk) => DATA[dk].main.map((s, i) => ({ index: i, id: s.id, sets: s.sets, rest: s.rest }));
const run = (dk, level, energy, time, profile) =>
  E.buildAdaptiveWorkout({ dayKey: dk, slots: slotsOf(dk), level, energy, time, availableCategories: availableCategoriesFromProfile(PROFILES[profile]) });

const availOk = (m, avail) => !avail || avail.has(m.equipmentCategory) || m.homeMode === "none";
let combos = 0;
let budgetMisses = 0;
let emptyPlans = 0;

for (const dk of ALL_DAY_KEYS) {
  const slots = slotsOf(dk);
  for (const profile of Object.keys(PROFILES)) {
    const avail = availableCategoriesFromProfile(PROFILES[profile]);
    for (const level of LEVELS) {
      const rules = M.LEVEL_RULES[level];
      const normalByTime = {};
      for (const time of TIMES) {
        const lo = run(dk, level, "low", time, profile);
        const no = run(dk, level, "normal", time, profile);
        const hi = run(dk, level, "high", time, profile);
        normalByTime[time] = no;
        for (const [energy, r] of [["low", lo], ["normal", no], ["high", hi]]) {
          combos++;
          const tag = `${dk}/${profile}/${level}/${energy}/${time}`;

          // determinism
          check(`C1 deterministic ${tag}`, eq(r, run(dk, level, energy, time, profile)));

          // structure
          const idx = r.entries.filter((e) => e.slotIndex !== null).map((e) => e.slotIndex);
          check(`C2 unique slot indices ${tag}`, new Set(idx).size === idx.length && idx.every((i) => i >= 0 && i < slots.length));
          check(`C3 no duplicate ids ${tag}`, new Set(r.entries.map((e) => e.id)).size === r.entries.length);
          check(`C4 sorted program-then-extras ${tag}`, eq(idx, [...idx].sort((a, b) => a - b)) && r.entries.slice(idx.length).every((e) => e.source === "extra"));
          check(`C5 label matches energy ${tag}`, r.tierLabel === M.TIER_LABELS[{ low: "essential", normal: "standard", high: "optimal" }[energy]]);
          if (r.entries.length === 0) emptyPlans++;
          // spec §2: low energy must never cancel the workout
          check(`C28 never an empty plan ${tag}`, r.entries.length >= 1);
          if (!["bodyweightOnly"].includes(profile)) check(`C29 at least two exercises with real equipment ${tag}`, r.entries.length >= Math.min(2, slots.length), String(r.entries.length));

          for (const e of r.entries) {
            const m = M.getAdaptiveMeta(e.id);
            check(`C6 known exercise ${tag} ${e.id}`, !!m);
            if (!m) continue;
            // HARD RULE 1 — never an unavailable-equipment exercise
            check(`C7 equipment available ${tag} ${e.id}`, availOk(m, avail), `${m.equipment}`);
            // HARD RULE 2 — level defines the pool
            const slack = e.source === "program" ? M.PROGRAM_SLOT_SLACK[level] || 0 : 0;
            check(`C8 difficulty within pool ${tag} ${e.id}`, M.DIFFICULTY_RANK[m.difficulty] <= M.DIFFICULTY_RANK[rules.maxDifficulty] + slack, m.difficulty);
            check(`C9 technique within pool ${tag} ${e.id}`, m.technicalComplexity <= rules.maxTechnical + slack);
            if (level === "beginner") check(`C10 beginner never advanced ${tag} ${e.id}`, m.difficulty === "Beginner");
            // set counts honour the cap and are at least 1
            check(`C11 sets within cap ${tag} ${e.id}`, e.setsCount >= 1 && e.setsCount <= Math.max(rules.setCap, e.originalSetsCount && Math.min(e.originalSetsCount, rules.setCap)));
            check(`C12 setsText agrees with count ${tag} ${e.id}`, E.parseSets(e.setsText).count === e.setsCount);
            if (energy === "low") {
              const relaxed = e.reasons.includes("relaxed-tier") || e.reasons.includes("kept-demanding");
              check(`C13 low energy is essential-tier unless relaxed ${tag} ${e.id}`, m.tier === "essential" || relaxed, m.tier);
              // a relaxation is only legitimate when the equipment profile is genuinely restrictive
              if (relaxed) check(`C13b relaxed tier only with limited equipment ${tag} ${e.id}`, !["none", "fullGym", "noBarbell"].includes(profile), profile);
            }
          }

          // swap/extras never duplicate a movement pattern+muscle already in the plan
          const sigs = r.entries.filter((e) => e.source !== "program").map((e) => {
            const m = M.getAdaptiveMeta(e.id);
            return m.movementPattern + "|" + m.targetMuscle;
          });
          check(`C14 no repeated pattern among swaps/extras ${tag}`, new Set(sigs).size === sigs.length);

          // time
          if (r.estimate.budget != null && !r.estimate.withinBudget) {
            budgetMisses++;
            const atFloor = r.entries.length <= 2 && r.entries.every((e) => e.setsCount <= 2);
            check(`C15 over budget only at the floor ${tag}`, atFloor, `${r.estimate.minutes}>${r.estimate.budget}`);
          }
          check(`C16 estimate matches entries ${tag}`, Math.abs(E.estimateMinutes(r.entries) - r.estimate.minutes) < 0.11);

          // energy semantics vs the normal plan for the same inputs
          if (energy === "low") {
            check(`C17 low <= normal exercises ${tag}`, lo.entries.length <= no.entries.length + 0, `${lo.entries.length} vs ${no.entries.length}`);
            check(`C18 low <= normal total sets ${tag}`, lo.entries.reduce((t, e) => t + e.setsCount, 0) <= no.entries.reduce((t, e) => t + e.setsCount, 0));
          }
          if (energy === "high") {
            const progHi = hi.entries.filter((e) => e.source !== "extra");
            check(`C19 high never adds sets to program slots ${tag}`, progHi.every((e) => e.setsCount <= (no.entries.find((n) => n.slotIndex === e.slotIndex) || { setsCount: 99 }).setsCount));
            const extras = hi.entries.filter((e) => e.source === "extra");
            check(`C20 accessories capped ${tag}`, extras.length <= rules.maxAccessories);
            check(`C21 high fatigue stays in budget or equals normal ${tag}`, hi.balance.fatigueTotal <= Math.max(rules.fatigueBudget, no.balance.fatigueTotal));
            extras.forEach((e) => {
              const m = M.getAdaptiveMeta(e.id);
              check(`C22 accessory trains today's muscles ${tag} ${e.id}`, slots.some((s) => M.getAdaptiveMeta(s.id).muscleGroup === m.muscleGroup));
              check(`C23 accessory is not high-fatigue for beginners ${tag} ${e.id}`, level !== "beginner" || m.fatigueCost <= 2);
            });
          }
          // High energy must not WIDEN the pool beyond Normal's level cap (covered by C8/C9) and
          // normal/high without trimming keep every program slot that fits the person.
          if (energy !== "low" && profile === "fullGym" && time === null && level !== "beginner") {
            check(`C24 ${energy} keeps the whole program ${tag}`, r.entries.filter((e) => e.source !== "extra").length === slots.length);
          }
          // coverage of large muscle groups when nothing external forces a loss
          if (profile === "fullGym" && (time === null || time === "60+" || time === "45-60")) {
            check(`C25 major groups covered ${tag}`, r.balance.missingMajorGroups.length === 0, r.balance.missingMajorGroups.join(","));
          }
        }
      }
      // time ordering for the same energy
      for (const energy of ENERGIES) {
        const mins = ["20-30", "30-45", "45-60", "60+"].map((t) => run(dk, level, energy, t, profile).estimate.minutes);
        check(`C26 shorter window never longer ${dk}/${profile}/${level}/${energy}`, mins[0] <= mins[1] + 0.05 && mins[1] <= mins[2] + 0.05 && mins[2] <= mins[3] + 0.05, mins.join("<="));
        if (profile === "fullGym" && slots.length >= 4 && energy !== "low") {
          check(`C27 20-30 is clearly shorter than 60+ ${dk}/${level}/${energy}`, mins[0] + 2 <= mins[3], mins.join("/"));
        }
      }
    }
  }
}

/* ============ D. spec scenarios (qualitative) ============ */
function plan(dk, level, energy, time = "45-60", profile = "fullGym") { return run(dk, level, energy, time, profile); }
{
  const base = plan("dayPushA", "intermediate", "normal", null);
  check("D1 normal+intermediate keeps all 6 push slots", base.entries.length === 6 && base.summaryKey === "unchanged");
  const lowA = plan("dayPushA", "advanced", "low", null);
  check("D2 advanced+low is still reduced", lowA.entries.length < 6 && lowA.balance.fatigueTotal < base.balance.fatigueTotal);
  const begHigh = plan("dayPushA", "beginner", "high", "60+");
  check("D3 beginner+high stays beginner", begHigh.entries.every((e) => M.getAdaptiveMeta(e.id).difficulty === "Beginner"));
  const advHigh = plan("dayPushA", "advanced", "high", "60+");
  check("D4 advanced+high adds accessories, not unlimited", advHigh.entries.filter((e) => e.source === "extra").length >= 1 && advHigh.entries.length <= 8);
  const noBar = run("dayPushA", "advanced", "normal", null, "noBarbell");
  check("D5 no barbell -> the bench slot is swapped, not kept", !noBar.entries.some((e) => M.getAdaptiveMeta(e.id).equipment === "Barbell") && noBar.entries.some((e) => e.originalId === "flat-barbell-bench" && e.source === "swap"));
  const mach = run("dayLegsA", "intermediate", "normal", null, "machinesOnly");
  check("D6 machines-only leg day is mostly machines/no-equipment", mach.entries.every((e) => ["Machine", "Bodyweight"].includes(M.getAdaptiveMeta(e.id).equipment)));
  const short = plan("day1", "intermediate", "normal", "20-30");
  const long = plan("day1", "intermediate", "normal", "60+");
  check("D7 20–30 min is shorter than 60+", short.estimate.minutes < long.estimate.minutes && short.entries.length <= long.entries.length);
  const begLow = plan("day1", "beginner", "low", "20-30", "machinesOnly");
  check("D8 beginner+low+short+machines is small and simple", begLow.entries.length <= 4 && begLow.entries.every((e) => M.getAdaptiveMeta(e.id).fatigueCost <= 2 && M.getAdaptiveMeta(e.id).stabilityRequirement <= 2));
  const unknownLevel = E.buildAdaptiveWorkout({ dayKey: "day1", slots: slotsOf("day1"), level: undefined, energy: "normal", time: null, availableCategories: null });
  check("D9 missing level falls back and says so", unknownLevel.level === "intermediate" && unknownLevel.levelAssumed === true);
  const empty = E.buildAdaptiveWorkout({ dayKey: "x", slots: [], level: "beginner", energy: "high", time: "20-30", availableCategories: null });
  check("D10 empty day does not throw", empty.entries.length === 0);
  const junk = E.buildAdaptiveWorkout({ dayKey: "x", slots: [{ index: 0, id: "typo-id", sets: "3×10", rest: "60 ث" }], level: "beginner", energy: "low", time: "20-30", availableCategories: null });
  check("D11 unknown exercise id is kept, never crashes", junk.entries.length === 1 && junk.entries[0].id === "typo-id");
  const noEquip = E.buildAdaptiveWorkout({ dayKey: "day1", slots: slotsOf("day1"), level: "advanced", energy: "high", time: "60+", availableCategories: new Set([]) });
  check("D12 nothing available -> only equipment-free exercises", noEquip.entries.every((e) => M.getAdaptiveMeta(e.id).homeMode === "none"));
  // a person's own Phase-4 replacement is respected because the caller passes it in
  const swapped = slotsOf("dayPushA");
  swapped[0] = { ...swapped[0], id: "machine-chest-press" };
  const r = E.buildAdaptiveWorkout({ dayKey: "dayPushA", slots: swapped, level: "beginner", energy: "normal", time: null, availableCategories: null });
  check("D13 caller-resolved replacement is used", r.entries.some((e) => e.slotIndex === 0 && e.id === "machine-chest-press" && e.source === "program"));
}

/* ============ E. library-gap report (informational) ============ */
if (process.argv.includes("--gaps")) {
  const gaps = {};
  for (const profile of Object.keys(PROFILES)) {
    for (const dk of ALL_DAY_KEYS) {
      for (const level of LEVELS) {
        const r = run(dk, level, "low", null, profile);
        r.entries.filter((e) => e.reasons.includes("relaxed-tier") || e.reasons.includes("kept-demanding") || e.reasons.includes("group-fallback"))
          .forEach((e) => { const k = `${profile}: ${e.slotGroup} -> ${e.id}`; gaps[k] = (gaps[k] || 0) + 1; });
        r.dropped.filter((d) => d.detail === "no-alternative")
          .forEach((d) => { const k = `${profile}: DROPPED ${d.id}`; gaps[k] = (gaps[k] || 0) + 1; });
      }
    }
  }
  console.log("\nLow-energy relaxations / drops (profile: slot group -> chosen):");
  Object.keys(gaps).sort().forEach((k) => console.log("  " + k + "  x" + gaps[k]));
}

/* ============ report ============ */
if (process.argv.includes("--table")) {
  for (const dk of ["day1", "dayPushA"]) {
    console.log(`\n=== ${dk} (full gym, 45-60 min) ===`);
    for (const level of LEVELS) for (const energy of ENERGIES) {
      const r = plan(dk, level, energy, "45-60");
      const names = r.entries.map((e) => `${M.getAdaptiveMeta(e.id).name}[${e.setsCount}${e.source === "swap" ? ",swap" : e.source === "extra" ? ",+" : ""}]`).join("; ");
      console.log(`${level.padEnd(12)} ${energy.padEnd(6)} ${r.entries.length}x  ~${String(r.estimate.minutes).padStart(4)}min  ${names}`);
    }
  }
}

console.log(`\nadaptive: ${combos} engine runs; ${budgetMisses} runs ended over budget at the floor; ${emptyPlans} empty plans`);
console.log(`validate-adaptive: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log("  FAIL " + f));
  process.exit(1);
}
