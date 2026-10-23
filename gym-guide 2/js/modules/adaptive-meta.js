/**
 * adaptive-meta.js — Adaptive Workout: constants + exercise metadata
 * ---------------------------------------------------------------
 * Pure data/logic (no DOM, no STATE, no storage) so it can be imported
 * from Node by tools/validate-adaptive.mjs exactly like
 * exercise-alternatives.js.
 *
 * WHY THIS FILE IS SMALL: the app already knows most of what the spec
 * asks for, so nothing is duplicated here:
 *   - muscle group / equipment / difficulty / primary+secondary muscles
 *       -> exercises-data.js (library, single source of truth)
 *   - movementPattern / target muscle / exerciseType (compound vs
 *     isolation vs stability)  -> exercise-alternatives.js TAGS
 *   - training level + equipment preference -> STATE.profile
 *       (profile.js: `experience`, `equipment`) — read by the UI layer
 *       in phase 2 and handed to the engine as plain arguments.
 *
 * WHAT IS NEW (derived once per exercise, never stored in STATE):
 *   technicalComplexity  1|2|3   how hard the movement is to learn/execute
 *   stabilityRequirement 1|2|3   how much balance/bracing the setup demands
 *   fatigueCost          1|2|3   systemic + local cost of a hard set
 *   tier  essential|standard|optimal
 *         = the LOWEST energy tier at which the engine may *choose* this
 *           exercise as a substitute or accessory (a low-demand exercise
 *           is eligible everywhere; a demanding one only at high energy).
 *   defaultSets / defaultReps / defaultRest  (used only for accessories
 *           the engine ADDS; program slots keep their own prescription)
 *
 * The three numbers are separate concepts on purpose (spec §13):
 * difficulty (library) != technicalComplexity != fatigueCost.
 * Machine hack squat = Intermediate difficulty, low technique, medium
 * fatigue; a barbell shrug = Beginner difficulty, low technique, low
 * fatigue; a conventional deadlift = high fatigue AND high stability.
 * ---------------------------------------------------------------
 */
import { EXERCISES } from "./exercises-data.js";
import { getExerciseMeta } from "./exercise-alternatives.js";

/* ---------------- OPTION SETS (bilingual inline, like profile.js) ---------------- */

export const LEVEL_ORDER = ["beginner", "intermediate", "advanced"];

// Keys are the SAME as profile.js EXPERIENCE_LEVELS — the engine reads
// STATE.profile.experience; there is no second "trainingLevel" field.
export const DEFAULT_LEVEL = "intermediate";

export const ENERGY_OPTIONS = [
  { key: "low", tier: "essential", label: "Low", ar: "واطية", hint: "Keep it simple", hintAr: "خليها بسيطة" },
  { key: "normal", tier: "standard", label: "Normal", ar: "عادية", hint: "Follow today's workout", hintAr: "كمّل على خطة النهارده" },
  { key: "high", tier: "optimal", label: "High", ar: "عالية", hint: "Make the most of today", hintAr: "استغل يومك" },
];

export const TIER_LABELS = {
  essential: { label: "Essential Workout", ar: "تمرين أساسي" },
  standard: { label: "Standard Workout", ar: "التمرين القياسي" },
  optimal: { label: "Optimal Workout", ar: "التمرين المثالي" },
};

export const ENERGY_QUESTION = { label: "How's your energy today?", ar: "طاقتك النهارده عاملة إيه؟" };
export const TIME_QUESTION = { label: "How much time do you have today?", ar: "معاك وقت قد إيه النهارده؟" };

/**
 * `budgetMin` = minutes available for the MAIN exercises. It is the upper
 * end of the window minus a warm-up/cool-down allowance (the Day page
 * already lists warm-up, mobility, activation and stretching around the
 * main block). Tunable in one place.
 */
export const TIME_OPTIONS = [
  { key: "20-30", label: "20–30 min", ar: "٢٠–٣٠ دقيقة", budgetMin: 20 },
  { key: "30-45", label: "30–45 min", ar: "٣٠–٤٥ دقيقة", budgetMin: 35 },
  { key: "45-60", label: "45–60 min", ar: "٤٥–٦٠ دقيقة", budgetMin: 48 },
  { key: "60+", label: "60+ min", ar: "أكتر من ٦٠ دقيقة", budgetMin: 65 },
];

/**
 * Per-level eligible-exercise pool (spec §1). Level decides WHAT may be
 * picked, never WHICH muscle trains today (that comes from the program day).
 *   maxDifficulty/maxTechnical : hard caps on the pool
 *   setCap                     : max sets per exercise at any energy
 *   maxAccessories             : max exercises ADDED at high energy
 *   fatigueBudget              : sum of fatigueCost over the whole session
 */
export const LEVEL_RULES = {
  beginner: { maxDifficulty: "Beginner", maxTechnical: 2, setCap: 3, maxAccessories: 1, fatigueBudget: 12 },
  intermediate: { maxDifficulty: "Intermediate", maxTechnical: 2, setCap: 5, maxAccessories: 2, fatigueBudget: 15 },
  advanced: { maxDifficulty: "Advanced", maxTechnical: 3, setCap: 5, maxAccessories: 2, fatigueBudget: 17 },
};

/**
 * Program slots are the program author's own choices. The library labels
 * some of them Advanced (back-squat, pullups, hanging-leg-raise), yet they
 * sit in the default Full Body week. So an intermediate lifter may keep a
 * program slot that is ONE step above the pool (difficulty + technical
 * cap); beginners get no slack. Swaps and added accessories never use it.
 * Set intermediate to 0 for a strict pool.
 */
export const PROGRAM_SLOT_SLACK = { beginner: 0, intermediate: 1, advanced: 0 };

export const DIFFICULTY_RANK = { Beginner: 1, Intermediate: 2, Advanced: 3 };
export const TIER_RANK = { essential: 0, standard: 1, optimal: 2 };
export const FATIGUE_LABEL = { 1: "low", 2: "medium", 3: "high" };

/* ---------------- DERIVATION RULES ---------------- */

// Patterns where the load sits on the spine / the lifter must brace under a
// free weight — these raise both fatigue and stability demand.
const AXIAL_PATTERNS = new Set(["squat", "hinge", "v-press", "split-squat", "carry"]);
// Unilateral / balance-limited patterns.
const BALANCE_PATTERNS = new Set(["split-squat", "carry"]);
const LOWER_BODY_GROUPS = new Set(["quads", "hamstrings", "glutes"]);
const CORE_ANTI_PATTERNS = new Set(["anti-extension", "anti-rotation", "anti-lateral", "rotation"]);

/**
 * Judgment calls the rules cannot express. Keep this list short and
 * explain every entry; tools/validate-adaptive.mjs fails if an id here
 * does not exist in the library. Any field omitted keeps the derived value.
 */
export const ADAPTIVE_OVERRIDES = {
  // Floor / hip-hinge max-effort lifts: highest systemic fatigue + bracing demand.
  "conventional-deadlift": { fatigueCost: 3, stabilityRequirement: 3, technicalComplexity: 3 },
  "sumo-deadlift": { fatigueCost: 3, stabilityRequirement: 3, technicalComplexity: 3 },
  "good-morning": { fatigueCost: 3, stabilityRequirement: 3, technicalComplexity: 3 },
  // Heavy bent-over rowing is loaded through the spine in a held hip hinge.
  "bent-over-row": { fatigueCost: 3, stabilityRequirement: 3 },
  "pendlay-row": { fatigueCost: 3, stabilityRequirement: 3 },
  // Eccentric-dominant hamstring/quad work: low equipment, high local fatigue.
  "nordic-hamstring-curl": { fatigueCost: 3, technicalComplexity: 3 },
  "sissy-squat": { fatigueCost: 2, technicalComplexity: 3, stabilityRequirement: 2 },
  // Cable hinge: same pattern as a deadlift but supported and light.
  "cable-pull-through": { fatigueCost: 1, stabilityRequirement: 2, technicalComplexity: 1 },
  // Seated + back-supported dumbbell press: the pattern is overhead, the setup is stable.
  "seated-db-press": { stabilityRequirement: 2 },
  // Dips load the shoulder joint heavily relative to their difficulty label.
  "chest-dip": { fatigueCost: 3, stabilityRequirement: 2 },
  "dips": { fatigueCost: 3, stabilityRequirement: 2 },
};

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function derive(ex, tag) {
  const diff = DIFFICULTY_RANK[ex.difficulty] || 2;
  const eq = ex.equipment;
  const builder = tag.purpose === "builder";
  const stability = tag.purpose === "stability";
  const axial = AXIAL_PATTERNS.has(tag.pattern);
  const lower = LOWER_BODY_GROUPS.has(ex.group);

  // ---- technicalComplexity: starts at the library difficulty, supported
  // (machine) setups are easier to execute than their label suggests.
  let technical = diff;
  if (eq === "Machine") technical -= 1;
  if (eq === "Band" && diff === 1) technical = 1;
  technical = clamp(technical, 1, 3);

  // ---- stabilityRequirement: how much the SETUP asks of balance/bracing.
  let stab;
  if (eq === "Machine") stab = 1;
  else if (eq === "Band") stab = axial ? 2 : 1;
  else if (eq === "Cable") stab = builder && !CORE_ANTI_PATTERNS.has(tag.pattern) ? 1 : 2;
  else if (eq === "Dumbbell") stab = axial ? 3 : 2;
  else if (eq === "Barbell") stab = axial ? 3 : 2;
  else stab = diff; // bodyweight: harder progressions are less stable
  if (BALANCE_PATTERNS.has(tag.pattern)) stab += 1;
  if (CORE_ANTI_PATTERNS.has(tag.pattern) && eq === "Cable") stab = 2;
  stab = clamp(stab, 1, 3);

  // ---- fatigueCost: builders cost more than isolation; free-weight axial
  // loading costs more; machines/cables/bands cost less; beginners'
  // easier variants cost less.
  let fatigue = builder ? 2 : 1;
  if (axial && (eq === "Barbell" || eq === "Dumbbell" || eq === "Bodyweight")) fatigue += 1;
  if (eq === "Machine" || eq === "Cable" || eq === "Band") fatigue -= 1;
  if (eq === "Bodyweight" && diff === 3) fatigue += 1;
  if (diff === 1 && fatigue > 2) fatigue -= 1; // goblet squat vs back squat
  if (builder && lower) fatigue = Math.max(fatigue, 2); // a leg press is never "low"
  if (stability) fatigue = Math.min(fatigue, 2);
  fatigue = clamp(fatigue, 1, 3);

  return { technicalComplexity: technical, stabilityRequirement: stab, fatigueCost: fatigue };
}

function tierOf(m, limitedOverload) {
  // Low-demand on every axis and able to be overloaded -> safe on a bad day.
  if (m.fatigueCost <= 2 && m.technicalComplexity <= 2 && m.stabilityRequirement <= 2 && !limitedOverload) return "essential";
  if (m.technicalComplexity <= 2) return "standard";
  return "optimal";
}

const DEFAULTS_BY_PURPOSE = {
  builder: { defaultSets: 3, defaultReps: "8-12", defaultRest: 90 },
  isolation: { defaultSets: 2, defaultReps: "12-15", defaultRest: 60 },
  stability: { defaultSets: 2, defaultReps: "10-12", defaultRest: 60 },
};

/* ---------------- PUBLIC LOOKUP ---------------- */

const CACHE = new Map();
const EX_BY_ID = new Map(EXERCISES.map((e, i) => [e.id, { ex: e, order: i }]));

/**
 * Full adaptive metadata for one library exercise, or null for an unknown id.
 * Combines library fields + alternatives-engine tags + derived fields.
 */
export function getAdaptiveMeta(id) {
  if (CACHE.has(id)) return CACHE.get(id);
  const entry = EX_BY_ID.get(id);
  const tag = getExerciseMeta(id);
  if (!entry || !tag) {
    CACHE.set(id, null);
    return null;
  }
  const { ex, order } = entry;
  const derived = Object.assign(derive(ex, tag), ADAPTIVE_OVERRIDES[id] || {});
  const meta = {
    id,
    order, // library position: deterministic tie-break, "best-supported first"
    name: ex.en,
    muscleGroup: ex.group,
    secondaryMuscles: ex.secondary,
    equipment: ex.equipment, // library label: Barbell|Dumbbell|Cable|Machine|Bodyweight|Band
    equipmentCategory: tag.equipmentCategory,
    homeMode: tag.homeMode, // "none" = needs nothing at all
    difficulty: ex.difficulty,
    movementPattern: tag.pattern,
    targetMuscle: tag.muscle,
    exerciseType: tag.purpose, // builder | isolation | stability
    limitedOverload: tag.limitedOverload,
    ...derived,
  };
  meta.tier = tierOf(meta, meta.limitedOverload);
  Object.assign(meta, DEFAULTS_BY_PURPOSE[meta.exerciseType] || DEFAULTS_BY_PURPOSE.builder);
  CACHE.set(id, Object.freeze(meta));
  return CACHE.get(id);
}

export function allAdaptiveMeta() {
  return EXERCISES.map((e) => getAdaptiveMeta(e.id)).filter(Boolean);
}
