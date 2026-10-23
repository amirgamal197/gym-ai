/**
 * exercise-alternatives.js — Exercise Alternatives Data Model + Engine
 * ---------------------------------------------------------------
 * Phase 1 foundation, Phase 3 engine (see IMPLEMENTATION_STATUS.md).
 * v2 (Phase 3): band + home exercises tagged, labels for every muscle/
 * pattern, curated overrides, home helpers, documented partial-only list.
 *
 * Pure logic: no DOM, no STATE, no storage. That keeps it importable
 * from Node for validation (tools/validate-alternatives.mjs) and lets
 * later phases build UI / replacement flows on top of it safely.
 *
 * DESIGN
 * - The exercise library (exercises-data.js) stays the single source
 *   of truth for exercise identity. This file only ADDS matching
 *   metadata keyed by the same stable `id` values — it never copies
 *   names, instructions, or media.
 * - Every exercise is tagged with:
 *     pattern : movement pattern (e.g. "h-press", "v-pull", "hinge")
 *     muscle  : matching-level target muscle (finer than library
 *               `group`; used ONLY for matching, the library's own
 *               `primary` text is untouched)
 *     purpose : "builder" (compound) | "isolation" | "stability"
 * - Relationships are derived from those tags by getAlternatives(),
 *   so adding an exercise = adding one tag row, not editing N lists.
 *   ALT_OVERRIDES lets a specific pair be pinned or excluded when the
 *   rules disagree with coaching judgement.
 *
 * TIERS
 *   close   — same movement pattern AND same target muscle.
 *             Can replace the original in a program without changing
 *             what the session trains.
 *   partial — shares the muscle or the movement but not both (or has
 *             limited overload potential). Useful when equipment is
 *             missing, but changes the stimulus; the UI should say so.
 * ---------------------------------------------------------------
 */
import { EXERCISES } from "./exercises-data.js";

export const ALT_DATA_VERSION = 2;

/* ---------------- EQUIPMENT CATEGORIES ---------------- */
// "home" is a cross-cutting category: exercises doable with no
// equipment (or a bodyweight/household-item version of the lift).
export const ALT_CATEGORIES = [
  { key: "machine", label: "Machines", ar: "أجهزة", libraryEquipment: "Machine" },
  { key: "barbell", label: "Barbells", ar: "بار حديد", libraryEquipment: "Barbell" },
  { key: "dumbbell", label: "Dumbbells", ar: "دمبلز", libraryEquipment: "Dumbbell" },
  { key: "cable", label: "Cables", ar: "كابلات", libraryEquipment: "Cable" },
  { key: "band", label: "Resistance Bands", ar: "أحبال مقاومة", libraryEquipment: "Band" },
  { key: "bodyweight", label: "Bodyweight", ar: "وزن الجسم", libraryEquipment: "Bodyweight" },
  { key: "home", label: "Home (no equipment)", ar: "تمارين منزلية بدون أدوات", libraryEquipment: null },
];

const LIBRARY_EQUIPMENT_TO_CATEGORY = Object.fromEntries(
  ALT_CATEGORIES.filter((c) => c.libraryEquipment).map((c) => [c.libraryEquipment, c.key])
);

// Profile equipment keys (profile.js EQUIPMENT_OPTIONS) -> alt categories.
// "home" is always reachable (needs nothing), "full-gym" unlocks everything.
const PROFILE_KEY_TO_CATEGORIES = {
  barbell: ["barbell"],
  dumbbells: ["dumbbell"],
  cables: ["cable"],
  machines: ["machine"],
  bands: ["band"],
  bodyweight: ["bodyweight", "home"],
  "full-gym": ["machine", "barbell", "dumbbell", "cable", "band", "bodyweight", "home"],
};

/** Convert a profile.equipment array into a Set of alt-category keys. Empty/undefined = no restriction (null). */
export function availableCategoriesFromProfile(profileEquipment) {
  if (!Array.isArray(profileEquipment) || !profileEquipment.length) return null;
  const set = new Set(["home"]); // home exercises never need anything
  profileEquipment.forEach((k) => (PROFILE_KEY_TO_CATEGORIES[k] || []).forEach((c) => set.add(c)));
  return set;
}

/* ---------------- EXERCISE TAGS ----------------
 * id: [pattern, muscle, role]   role: C = compound/builder,
 * I = isolation, S = stability/anti-movement core work.
 * Tag vocabulary notes:
 *  - Rows (all) share muscle "mid-back"; vertical pulls share "lats".
 *  - "posterior-chain" groups the deadlift family (conventional,
 *    sumo, rack pull) which load the same hinge from the floor/rack.
 *  - Walking lunge / step-up are tagged "split-squat"/"quads" for
 *    matching even though the library files them under glutes.
 */
const TAGS = {
  // chest
  "flat-barbell-bench": ["h-press", "mid-chest", "C"],
  "machine-chest-press": ["h-press", "mid-chest", "C"],
  "incline-barbell-bench": ["incline-press", "upper-chest", "C"],
  "flat-db-press": ["h-press", "mid-chest", "C"],
  "incline-db-press": ["incline-press", "upper-chest", "C"],
  "pushup": ["h-press", "mid-chest", "C"],
  "cable-fly": ["chest-fly", "mid-chest", "I"],
  "pec-deck-fly": ["chest-fly", "mid-chest", "I"],
  "low-to-high-cable-fly": ["chest-fly", "upper-chest", "I"],
  "chest-dip": ["dip", "lower-chest", "C"],
  "decline-barbell-bench": ["decline-press", "lower-chest", "C"],
  "smith-machine-bench-press": ["h-press", "mid-chest", "C"],
  // back
  "pullups": ["v-pull", "lats", "C"],
  "lat-pulldown": ["v-pull", "lats", "C"],
  "chin-up": ["v-pull", "lats", "C"],
  "chest-supported-row": ["h-row", "mid-back", "C"],
  "seated-cable-row": ["h-row", "mid-back", "C"],
  "bent-over-row": ["h-row", "mid-back", "C"],
  "pendlay-row": ["h-row", "mid-back", "C"],
  "t-bar-row": ["h-row", "mid-back", "C"],
  "single-arm-db-row": ["h-row", "mid-back", "C"],
  "straight-arm-pulldown": ["lat-isolation", "lats", "I"],
  "inverted-row": ["h-row", "mid-back", "C"],
  "conventional-deadlift": ["hinge", "posterior-chain", "C"],
  // shoulders
  "barbell-overhead-press": ["v-press", "delts", "C"],
  "db-shoulder-press": ["v-press", "delts", "C"],
  "seated-db-press": ["v-press", "delts", "C"],
  "arnold-press": ["v-press", "delts", "C"],
  "lateral-raise": ["lateral-raise", "side-delts", "I"],
  "cable-lateral-raise": ["lateral-raise", "side-delts", "I"],
  "upright-row": ["upright-row", "side-delts", "C"],
  "face-pull": ["rear-delt", "rear-delts", "I"],
  "reverse-pec-deck": ["rear-delt", "rear-delts", "I"],
  "front-raise": ["front-raise", "delts", "I"],
  // biceps
  "barbell-curl": ["curl", "biceps", "I"],
  "ez-bar-curl": ["curl", "biceps", "I"],
  "incline-db-curl": ["curl", "biceps", "I"],
  "db-curl-alternating": ["curl", "biceps", "I"],
  "cable-curl": ["curl", "biceps", "I"],
  "preacher-curl": ["curl", "biceps", "I"],
  "concentration-curl": ["curl", "biceps", "I"],
  "hammer-curl": ["neutral-curl", "biceps", "I"],
  // triceps
  "overhead-cable-triceps-extension": ["overhead-extension", "triceps", "I"],
  "overhead-db-extension": ["overhead-extension", "triceps", "I"],
  "tricep-pushdown": ["pushdown", "triceps", "I"],
  "skull-crushers": ["lying-extension", "triceps", "I"],
  "triceps-kickback": ["kickback", "triceps", "I"],
  "close-grip-bench-press": ["h-press", "triceps", "C"],
  "diamond-pushup": ["h-press", "triceps", "C"],
  "dips": ["dip", "triceps", "C"],
  // forearms
  "barbell-wrist-curl": ["wrist-curl", "forearm-flexors", "I"],
  "cable-wrist-curl": ["wrist-curl", "forearm-flexors", "I"],
  "barbell-reverse-wrist-curl": ["wrist-extension", "forearm-extensors", "I"],
  "reverse-curl": ["pronated-curl", "forearm-extensors", "I"],
  "zottman-curl": ["neutral-curl", "forearm-extensors", "I"],
  "dead-hang": ["grip-hold", "grip", "S"],
  // quads
  "back-squat": ["squat", "quads", "C"],
  "front-squat": ["squat", "quads", "C"],
  "smith-machine-squat": ["squat", "quads", "C"],
  "goblet-squat": ["squat", "quads", "C"],
  "hack-squat": ["squat", "quads", "C"],
  "leg-press": ["leg-press", "quads", "C"],
  "leg-extension": ["knee-extension", "quads", "I"],
  "sissy-squat": ["knee-extension", "quads", "I"],
  "split-squat": ["split-squat", "quads", "C"],
  "bulgarian-split-squat": ["split-squat", "quads", "C"],
  "walking-lunge": ["split-squat", "quads", "C"],
  "step-up": ["split-squat", "quads", "C"],
  // hamstrings
  "rdl": ["hinge", "hamstrings", "C"],
  "good-morning": ["hinge", "hamstrings", "C"],
  "single-leg-rdl": ["hinge", "hamstrings", "C"],
  "cable-pull-through": ["hinge", "hamstrings", "C"],
  "seated-leg-curl": ["leg-curl", "hamstrings", "I"],
  "lying-leg-curl": ["leg-curl", "hamstrings", "I"],
  "nordic-hamstring-curl": ["leg-curl", "hamstrings", "I"],
  "glute-ham-raise": ["leg-curl", "hamstrings", "I"],
  // glutes
  "hip-thrust": ["hip-thrust", "glutes", "C"],
  "glute-bridge": ["hip-thrust", "glutes", "C"],
  "single-leg-hip-thrust": ["hip-thrust", "glutes", "C"],
  "sumo-deadlift": ["hinge", "posterior-chain", "C"],
  "cable-kickback": ["glute-kickback", "glutes", "I"],
  "hip-abduction-machine": ["abduction", "glutes", "I"],
  // calves
  "standing-calf-raise-machine": ["calf-raise", "gastrocnemius", "I"],
  "standing-calf-raise-barbell": ["calf-raise", "gastrocnemius", "I"],
  "leg-press-calf-raise": ["calf-raise", "gastrocnemius", "I"],
  "donkey-calf-raise": ["calf-raise", "gastrocnemius", "I"],
  "single-leg-calf-raise": ["calf-raise", "gastrocnemius", "I"],
  "seated-calf-raise-machine": ["calf-raise", "soleus", "I"],
  // core
  "hanging-leg-raise": ["leg-raise", "lower-abs", "I"],
  "reverse-crunch": ["leg-raise", "lower-abs", "I"],
  "cable-crunch": ["crunch", "abs", "I"],
  "bicycle-crunch": ["rotation", "obliques", "I"], // v2: was crunch; the rotation is what trains the obliques
  "plank": ["anti-extension", "abs", "S"],
  "ab-wheel-rollout": ["anti-extension", "abs", "S"],
  "dead-bug": ["anti-extension", "abs", "S"],
  "side-plank": ["anti-lateral", "obliques", "S"],
  "pallof-press": ["anti-rotation", "obliques", "S"],
  "russian-twist": ["rotation", "obliques", "I"],
  // traps
  "barbell-shrug": ["shrug", "upper-traps", "I"],
  "dumbbell-shrug": ["shrug", "upper-traps", "I"],
  "cable-shrug": ["shrug", "upper-traps", "I"],
  "behind-back-barbell-shrug": ["shrug", "upper-traps", "I"],
  "farmers-carry": ["carry", "grip", "S"],
  "rack-pull": ["hinge", "posterior-chain", "C"],

  // ---- Phase 3 additions: resistance bands ----
  "band-chest-press": ["h-press", "mid-chest", "C"],
  "band-chest-fly": ["chest-fly", "mid-chest", "I"],
  "band-lat-pulldown": ["v-pull", "lats", "C"],
  "band-seated-row": ["h-row", "mid-back", "C"],
  "band-straight-arm-pulldown": ["lat-isolation", "lats", "I"],
  "band-pull-apart": ["rear-delt", "rear-delts", "I"],
  "band-face-pull": ["rear-delt", "rear-delts", "I"],
  "band-overhead-press": ["v-press", "delts", "C"],
  "band-lateral-raise": ["lateral-raise", "side-delts", "I"],
  "band-front-raise": ["front-raise", "delts", "I"],
  "band-biceps-curl": ["curl", "biceps", "I"],
  "band-triceps-pushdown": ["pushdown", "triceps", "I"],
  "band-overhead-triceps-extension": ["overhead-extension", "triceps", "I"],
  "band-triceps-kickback": ["kickback", "triceps", "I"],
  "band-squat": ["squat", "quads", "C"],
  "band-pull-through": ["hinge", "hamstrings", "C"],
  "band-leg-curl": ["leg-curl", "hamstrings", "I"],
  "band-glute-kickback": ["glute-kickback", "glutes", "I"],
  "band-lateral-walk": ["abduction", "glutes", "I"],
  "band-pallof-press": ["anti-rotation", "obliques", "S"],
  // ---- Phase 3 additions: home / no equipment ----
  "pike-pushup": ["v-press", "delts", "C"],
  "feet-elevated-pushup": ["incline-press", "upper-chest", "C"], // feet up = steeper press angle, NOT a decline
  "bench-dip": ["dip", "triceps", "C"],
  "doorframe-row": ["h-row", "mid-back", "C"],
  "prone-y-raise": ["rear-delt", "rear-delts", "I"],
  "isometric-towel-curl": ["curl", "biceps", "I"],
  "bodyweight-squat": ["squat", "quads", "C"],
  "reverse-lunge": ["split-squat", "quads", "C"],
  "slider-hamstring-curl": ["leg-curl", "hamstrings", "I"],
  "bent-knee-calf-raise": ["calf-raise", "soleus", "I"],
  "side-lying-leg-raise": ["abduction", "glutes", "I"],
  "donkey-kick": ["glute-kickback", "glutes", "I"],
  "crunch": ["crunch", "abs", "I"],
  "bird-dog": ["anti-rotation", "obliques", "S"],
  // ---- Phase 3 additions: gym gap-fillers ----
  "incline-db-fly": ["chest-fly", "upper-chest", "I"],
  "decline-db-press": ["decline-press", "lower-chest", "C"],
  "close-grip-db-press": ["h-press", "triceps", "C"],
  "dumbbell-skull-crusher": ["lying-extension", "triceps", "I"],
  "cable-rope-hammer-curl": ["neutral-curl", "biceps", "I"],
  "dumbbell-reverse-wrist-curl": ["wrist-extension", "forearm-extensors", "I"],
  "dumbbell-reverse-curl": ["pronated-curl", "forearm-extensors", "I"],
  "seated-dumbbell-calf-raise": ["calf-raise", "soleus", "I"],
  "captains-chair-leg-raise": ["leg-raise", "lower-abs", "I"],
  "machine-crunch": ["crunch", "abs", "I"],
  "cable-woodchop": ["rotation", "obliques", "I"],
  "suitcase-carry": ["carry", "grip", "S"],
  // ---- Phase 3 additions (second pass: equipment-coverage gaps found by the validator) ----
  "band-shrug": ["shrug", "upper-traps", "I"],
  "backpack-shrug": ["shrug", "upper-traps", "I"],
  "bottle-lateral-raise": ["lateral-raise", "side-delts", "I"],
  "dumbbell-pullover": ["lat-isolation", "lats", "I"],
  "prone-lat-pulldown": ["v-pull", "lats", "C"],
};


/* Movement FAMILIES: related patterns that are not the same movement but
 * load the same muscles in a recognisably similar way (e.g. incline vs
 * flat press). Same-family pairs become "partial" substitutes. */
const PATTERN_FAMILY = {
  "h-press": "chest-press", "incline-press": "chest-press", "decline-press": "chest-press", "dip": "chest-press",
  "squat": "squat-family", "leg-press": "squat-family", "split-squat": "squat-family",
  "curl": "curl-family", "neutral-curl": "curl-family", "pronated-curl": "curl-family",
  "overhead-extension": "triceps-extension", "pushdown": "triceps-extension",
  "lying-extension": "triceps-extension", "kickback": "triceps-extension",
  "v-pull": "vertical-pull", "lat-isolation": "vertical-pull",
  "lateral-raise": "delt-raise", "front-raise": "delt-raise", "upright-row": "delt-raise",
  "anti-extension": "core-stability", "anti-lateral": "core-stability", "anti-rotation": "core-stability",
  "crunch": "core-flexion", "leg-raise": "core-flexion",
  "glute-kickback": "glute-isolation", "abduction": "glute-isolation",
  "grip-hold": "grip-work", "carry": "grip-work",
  "wrist-curl": "wrist-work", "wrist-extension": "wrist-work",
};

const PURPOSE_BY_ROLE = { C: "builder", I: "isolation", S: "stability" };

// Needs nothing at all.
const HOME_NO_EQUIPMENT = new Set([
  "pushup", "diamond-pushup", "glute-bridge", "single-leg-hip-thrust", "single-leg-calf-raise",
  "plank", "side-plank", "bicycle-crunch", "dead-bug", "reverse-crunch", "sissy-squat",
  // v2
  "pike-pushup", "prone-y-raise", "bodyweight-squat", "reverse-lunge",
  "side-lying-leg-raise", "donkey-kick", "crunch", "bird-dog", "prone-lat-pulldown",
]);
// A bodyweight / household-item version exists (backpack, sturdy table, chair).
const HOME_ADAPTABLE = new Set([
  "split-squat", "bulgarian-split-squat", "step-up", "walking-lunge", "single-leg-rdl",
  "goblet-squat", "inverted-row",
  // v2 — see HOME_NOTES for what to use
  "feet-elevated-pushup", "bench-dip", "doorframe-row", "isometric-towel-curl",
  "slider-hamstring-curl", "bent-knee-calf-raise", "seated-dumbbell-calf-raise", "suitcase-carry",
  "backpack-shrug", "bottle-lateral-raise",
]);

/* What household item stands in for the equipment (shown by the UI for
 * homeMode === "adaptable"). Bilingual, one short line each. */
export const HOME_NOTES = {
  "split-squat": { en: "Hold a loaded backpack; rest the rear foot on a chair or the floor.", ar: "امسك شنطة ضهر مليانة، ورجلك الخلفية على كرسي أو الأرض." },
  "bulgarian-split-squat": { en: "Rear foot on a sturdy chair or sofa; hold a loaded backpack.", ar: "رجلك الخلفية على كرسي ثابت أو كنبة، وامسك شنطة ضهر." },
  "step-up": { en: "Use a sturdy chair or stair step; hold a loaded backpack.", ar: "استخدم كرسي ثابت أو درجة سلم، وامسك شنطة ضهر." },
  "walking-lunge": { en: "Bodyweight works; add a loaded backpack to progress.", ar: "بوزن الجسم، وزوّد شنطة ضهر مليانة للتحدي." },
  "single-leg-rdl": { en: "Bodyweight, or hold a water jug / loaded bag.", ar: "بوزن الجسم، أو امسك جركن مياه أو شنطة." },
  "goblet-squat": { en: "Hold a water jug, a loaded backpack or a heavy book bag at the chest.", ar: "امسك جركن مياه أو شنطة ضهر مليانة قدام صدرك." },
  "inverted-row": { en: "Lie under a sturdy table and pull the chest to the edge.", ar: "استلقي تحت ترابيزة ثابتة واسحب صدرك لحافتها." },
  "feet-elevated-pushup": { en: "Feet on a chair, sofa or step.", ar: "القدمين على كرسي أو كنبة أو درجة." },
  "bench-dip": { en: "Hands on the edge of a sturdy chair; check it can't slide.", ar: "الإيدين على حافة كرسي ثابت، وتأكد إنه مش هيتحرك." },
  "doorframe-row": { en: "Hold a door frame or a towel looped round a closed door's handles.", ar: "امسك إطار باب ثابت أو فوطة ملفوفة على مقبض باب مقفول." },
  "isometric-towel-curl": { en: "Stand on a towel and pull it up against your foot.", ar: "قف على فوطة واسحبها لفوق ضد ضغط رجلك." },
  "slider-hamstring-curl": { en: "Heels on a towel (hard floor) or socks (carpet is not suitable).", ar: "الكعبين على فوطة فوق أرض ناعمة (مش سجاد)." },
  "bent-knee-calf-raise": { en: "Use a stair edge; hold a loaded backpack on the thighs to progress.", ar: "على حافة درجة، وحط شنطة ضهر على الفخذ للتحدي." },
  "seated-dumbbell-calf-raise": { en: "Rest a loaded backpack or a water jug on the thighs.", ar: "حط شنطة ضهر مليانة أو جركن مياه على فخذك." },
  "suitcase-carry": { en: "Carry a heavy bag or a full water jug in one hand.", ar: "امسك شنطة تقيلة أو جركن مياه في إيد واحدة." },
  "backpack-shrug": { en: "Load a backpack with books or water bottles and hold it at your sides.", ar: "املأ شنطة ضهر بكتب أو زجاجات مياه وامسكها جنبك." },
  "bottle-lateral-raise": { en: "Two water bottles or small jugs; fill them to progress.", ar: "زجاجتين مياه أو جركنين صغيرين؛ زوّد الميه للتحدي." },
};
// Low overload ceiling (mostly bodyweight, plus goblet squat) — never presented
// as a "close" substitute for a heavily loadable lift.
const LIMITED_OVERLOAD = new Set([
  "pushup", "diamond-pushup", "glute-bridge", "plank", "side-plank",
  "bicycle-crunch", "dead-bug", "reverse-crunch", "dead-hang",
  "goblet-squat", // load ceiling set by how much you can hold in front of you
  // v2 — bodyweight / household versions
  "pike-pushup", "feet-elevated-pushup", "bench-dip", "doorframe-row", "prone-y-raise",
  "isometric-towel-curl", "bodyweight-squat", "reverse-lunge", "slider-hamstring-curl",
  "bent-knee-calf-raise", "side-lying-leg-raise", "donkey-kick", "crunch", "bird-dog",
  // v2 — band COMPOUNDS (band isolation work keeps a usable overload ladder: thicker bands)
  "band-chest-press", "band-lat-pulldown", "band-seated-row", "band-overhead-press",
  "band-squat", "band-pull-through",
  // v2 second pass — bodyweight/household
  "backpack-shrug", "bottle-lateral-raise", "prone-lat-pulldown",
]);

/* ---------------- OVERRIDES ----------------
 * Pin / exclude a specific pair when coaching judgement beats the
 * generic rules. Keys are source ids.
 *   force:   { [candidateId]: "close" | "partial" }
 *   exclude: [candidateId, ...]
 * Add entries only with a reason in a comment. Pairs are listed in BOTH
 * directions (the validator checks that curated pairs are symmetric).
 */
export const ALT_OVERRIDES = {
  // Both are machine-guided, fixed-path, heavily loadable knee-dominant
  // quad builders. The tag rules file them under different patterns
  // (leg-press vs squat) so they would only be "partial" otherwise.
  "leg-press": { force: { "hack-squat": "close" } },
  "hack-squat": { force: { "leg-press": "close" } },
};

// A bicycle crunch is a crunch with a twist: other crunches are honest
// (partial) substitutes in both directions, but the generic family rules
// don't link the "rotation" and "crunch" patterns.
const CRUNCH_LIKE = ["crunch", "machine-crunch", "cable-crunch"];
ALT_OVERRIDES["bicycle-crunch"] = { force: Object.fromEntries(CRUNCH_LIKE.map((id) => [id, "partial"])) };
CRUNCH_LIKE.forEach((id) => { ALT_OVERRIDES[id] = { force: { "bicycle-crunch": "partial" } }; });

/* Exercises with NO close-tier substitute, and why. Every exercise that
 * has no close alternative must be listed here (validator enforces it), so
 * the UI can say "no like-for-like swap exists" honestly instead of
 * showing an unexplained list of weaker options. */
export const PARTIAL_ONLY_REASONS = {
  "chest-dip": { en: "Dips load the lower chest and triceps along a path no other library movement copies; pressing variations only approximate it.", ar: "الديبس بتشغل أسفل الصدر والترايسبس بمسار مفيش تمرين تاني بيكرره بالظبط؛ تمارين الضغط بتقاربه بس." },
  "dips": { en: "Parallel-bar dips are heavily loadable; chair/bench dips are the nearest swap but cap out at bodyweight.", ar: "الديبس على المتوازي ينفع تحميله بقوة؛ الديبس على كرسي أقرب بديل بس محدود بوزن الجسم." },
  "upright-row": { en: "A compound pull for side delts and traps; the isolation raises train the delts but not the traps.", ar: "سحب مركّب للكتف الجانبي والترابيس؛ الرفرفة بتشغل الكتف بس من غير الترابيس." },
  "zottman-curl": { en: "Combines a supinated curl up and a pronated curl down; no single movement matches both halves.", ar: "بيجمع كيرل بكف لفوق ونزول بكف لتحت؛ مفيش تمرين واحد بيعمل النصفين." },
  "dead-hang": { en: "A pure grip hold; carries train grip dynamically, which is a different demand.", ar: "تثبيت مسك صافي؛ الحمل بالمشي بيدرّب المسك بشكل ديناميكي وده تحدي مختلف." },
  "side-plank": { en: "Lateral anti-bend work; other core stability moves resist extension or rotation, not side bending.", ar: "ثبات جانبي ضد الميل؛ باقي تمارين الثبات بتقاوم الفرد أو الدوران مش الميل الجانبي." },
};

/* ---------------- REASON LABELS (bilingual) ---------------- */
export const REASON_LABELS = {
  "same-pattern": { en: "Same movement pattern", ar: "نفس نمط الحركة" },
  "same-family": { en: "Closely related movement", ar: "حركة قريبة من الأصلية" },
  "same-muscle": { en: "Same target muscle", ar: "نفس العضلة المستهدفة" },
  "same-purpose": { en: "Same exercise purpose", ar: "نفس الغرض من التمرين" },
  "different-emphasis": { en: "Different muscle emphasis", ar: "تركيز مختلف على العضلة" },
  "different-movement": { en: "Different movement, same muscle", ar: "حركة مختلفة لنفس العضلة" },
  "like-for-like-equipment": { en: "Same equipment type", ar: "نفس نوع الأداة" },
  "easier": { en: "Easier to perform", ar: "أسهل في الأداء" },
  "harder": { en: "Harder to perform", ar: "أصعب في الأداء" },
  "limited-overload": { en: "Limited progressive overload", ar: "مجال محدود لزيادة الأحمال" },
  "home-friendly": { en: "Can be done at home", ar: "ينفع في البيت" },
  "pinned": { en: "Curated substitute", ar: "بديل مختار يدويًا" },
};

/* ---------------- MUSCLE & PATTERN LABELS (bilingual) ----------------
 * For explanations in the UI ("same target muscle: Mid Chest"). Every
 * muscle/pattern used in TAGS must have an entry (validator enforces it). */
export const MUSCLE_LABELS = {
  "mid-chest": { en: "Mid chest", ar: "الصدر الأوسط" },
  "upper-chest": { en: "Upper chest", ar: "الصدر العلوي" },
  "lower-chest": { en: "Lower chest", ar: "الصدر السفلي" },
  "lats": { en: "Lats", ar: "اللاتس" },
  "mid-back": { en: "Mid back", ar: "منتصف الظهر" },
  "posterior-chain": { en: "Posterior chain", ar: "السلسلة الخلفية" },
  "delts": { en: "Shoulders", ar: "الأكتاف" },
  "side-delts": { en: "Side delts", ar: "الكتف الجانبي" },
  "rear-delts": { en: "Rear delts", ar: "الكتف الخلفي" },
  "biceps": { en: "Biceps", ar: "الباي" },
  "triceps": { en: "Triceps", ar: "الترايسبس" },
  "forearm-flexors": { en: "Forearm flexors", ar: "ثنيات الساعد" },
  "forearm-extensors": { en: "Forearm extensors", ar: "باسطات الساعد" },
  "grip": { en: "Grip", ar: "قوة المسك" },
  "quads": { en: "Quads", ar: "الكوادز" },
  "hamstrings": { en: "Hamstrings", ar: "الهامسترينج" },
  "glutes": { en: "Glutes", ar: "الجلوت" },
  "gastrocnemius": { en: "Calves (gastrocnemius)", ar: "السمانة (الغاسترو)" },
  "soleus": { en: "Calves (soleus)", ar: "السمانة (السولس)" },
  "lower-abs": { en: "Lower abs", ar: "أسفل البطن" },
  "abs": { en: "Abs", ar: "البطن" },
  "obliques": { en: "Obliques", ar: "جانبي البطن" },
  "upper-traps": { en: "Upper traps", ar: "الترابيس العلوي" },
};

export const PATTERN_LABELS = {
  "h-press": { en: "Horizontal press", ar: "ضغط أفقي" },
  "incline-press": { en: "Incline press", ar: "ضغط مائل" },
  "decline-press": { en: "Decline press", ar: "ضغط ديكلاين" },
  "dip": { en: "Dip", ar: "ديبس" },
  "chest-fly": { en: "Chest fly", ar: "فلاي صدر" },
  "v-pull": { en: "Vertical pull", ar: "سحب عمودي" },
  "h-row": { en: "Horizontal row", ar: "تجديف أفقي" },
  "lat-isolation": { en: "Lat isolation", ar: "عزل اللاتس" },
  "hinge": { en: "Hip hinge", ar: "هينج الورك" },
  "v-press": { en: "Vertical press", ar: "ضغط عمودي" },
  "lateral-raise": { en: "Lateral raise", ar: "رفرفة جانبية" },
  "upright-row": { en: "Upright row", ar: "سحب عمودي للكتف" },
  "rear-delt": { en: "Rear-delt fly/pull", ar: "فتح/سحب للكتف الخلفي" },
  "front-raise": { en: "Front raise", ar: "رفرفة أمامية" },
  "curl": { en: "Biceps curl", ar: "كيرل باي" },
  "neutral-curl": { en: "Neutral-grip curl", ar: "كيرل بمسك محايد" },
  "pronated-curl": { en: "Reverse-grip curl", ar: "كيرل بمسك مقلوب" },
  "overhead-extension": { en: "Overhead triceps extension", ar: "ترايسبس فوق الراس" },
  "pushdown": { en: "Triceps pushdown", ar: "بوش داون ترايسبس" },
  "lying-extension": { en: "Lying triceps extension", ar: "ترايسبس مستلقي" },
  "kickback": { en: "Triceps kickback", ar: "كيك باك ترايسبس" },
  "wrist-curl": { en: "Wrist curl", ar: "ثني الرسغ" },
  "wrist-extension": { en: "Wrist extension", ar: "فرد الرسغ" },
  "grip-hold": { en: "Grip hold", ar: "تثبيت المسك" },
  "squat": { en: "Squat", ar: "سكوات" },
  "leg-press": { en: "Leg press", ar: "ليج بريس" },
  "knee-extension": { en: "Knee extension", ar: "فرد الركبة" },
  "split-squat": { en: "Single-leg squat / lunge", ar: "سكوات/لانج برجل واحدة" },
  "leg-curl": { en: "Leg curl", ar: "ليج كيرل" },
  "hip-thrust": { en: "Hip thrust / bridge", ar: "هيب ثرست / جسر" },
  "glute-kickback": { en: "Glute kickback", ar: "كيك باك جلوت" },
  "abduction": { en: "Hip abduction", ar: "فتح الورك" },
  "calf-raise": { en: "Calf raise", ar: "رفع السمانة" },
  "leg-raise": { en: "Leg raise", ar: "رفع الرجلين" },
  "crunch": { en: "Crunch", ar: "كرانش" },
  "anti-extension": { en: "Anti-extension core", ar: "ثبات ضد الفرد" },
  "anti-lateral": { en: "Anti-lateral-flexion core", ar: "ثبات ضد الميل الجانبي" },
  "anti-rotation": { en: "Anti-rotation core", ar: "ثبات ضد الدوران" },
  "rotation": { en: "Rotation", ar: "دوران الجذع" },
  "shrug": { en: "Shrug", ar: "شراج" },
  "carry": { en: "Loaded carry", ar: "حمل ومشي" },
};

/* ---------------- LOOKUPS ---------------- */
const EXERCISE_BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));
const DIFFICULTY_RANK = { Beginner: 0, Intermediate: 1, Advanced: 2 };

/** All tagged exercise ids (stable order = library order). */
export function taggedExerciseIds() {
  return EXERCISES.map((e) => e.id).filter((id) => TAGS[id]);
}

/** Raw tag-table ids — used by the validator to catch typos / orphans. */
export function tagTableIds() {
  return Object.keys(TAGS);
}

/** Matching metadata for one exercise, or null if the id is unknown/untagged. */
export function getExerciseMeta(id) {
  const t = TAGS[id];
  const ex = EXERCISE_BY_ID.get(id);
  if (!t || !ex) return null;
  const [pattern, muscle, role] = t;
  const equipmentCategory = LIBRARY_EQUIPMENT_TO_CATEGORY[ex.equipment] || "bodyweight";
  const home = HOME_NO_EQUIPMENT.has(id) || HOME_ADAPTABLE.has(id);
  const categories = home ? [equipmentCategory, "home"] : [equipmentCategory];
  return {
    id,
    group: ex.group,
    pattern,
    muscle,
    purpose: PURPOSE_BY_ROLE[role],
    equipmentCategory,
    categories,
    home,
    homeMode: HOME_NO_EQUIPMENT.has(id) ? "none" : HOME_ADAPTABLE.has(id) ? "adaptable" : null,
    limitedOverload: LIMITED_OVERLOAD.has(id),
    difficulty: ex.difficulty,
  };
}

/* ---------------- MATCHING ---------------- */
function classify(src, cand) {
  const samePattern = src.pattern === cand.pattern;
  const sameMuscle = src.muscle === cand.muscle;
  const samePurpose = src.purpose === cand.purpose;
  const famSrc = PATTERN_FAMILY[src.pattern];
  const sameFamily = !!famSrc && famSrc === PATTERN_FAMILY[cand.pattern];
  const reasons = [];
  let tier = null;
  let base = 0;

  if (samePattern && sameMuscle) {
    tier = "close";
    base = 100;
    reasons.push("same-pattern", "same-muscle");
  } else if (samePattern) {
    tier = "partial";
    base = 55;
    reasons.push("same-pattern", "different-emphasis");
  } else if (sameFamily && sameMuscle) {
    tier = "partial";
    base = 65;
    reasons.push("same-family", "same-muscle");
  } else if (sameFamily) {
    tier = "partial";
    base = 52;
    reasons.push("same-family", "different-emphasis");
  } else if (sameMuscle && samePurpose) {
    tier = "partial";
    base = 50;
    reasons.push("same-muscle", "same-purpose", "different-movement");
  } else if (sameMuscle) {
    tier = "partial";
    base = 40;
    reasons.push("same-muscle", "different-movement");
  }
  if (!tier) return null;

  // A low-overload bodyweight move can't truly stand in for a heavy lift.
  // Exception (v2): stability work (plank vs ab wheel) is not loaded for
  // overload in the first place, so the downgrade would just be noise.
  const bothStability = src.purpose === "stability" && cand.purpose === "stability";
  if (tier === "close" && cand.limitedOverload && !src.limitedOverload && !bothStability) {
    tier = "partial";
    base = 60;
    reasons.push("limited-overload");
  }
  return { tier, base, reasons };
}

/**
 * Alternatives for one exercise.
 * @param {string} id  source exercise id
 * @param {object} [opts]
 * @param {Set<string>|string[]|null} [opts.availableCategories] restrict to these alt-category keys
 *        (see availableCategoriesFromProfile). null/undefined = everything.
 * @param {string|null} [opts.category] show only one category tab (incl. "home")
 * @param {boolean} [opts.includeUnavailable] keep unavailable ones, flagged `available:false`
 * @returns {{ sourceId:string, close:Alt[], partial:Alt[] }|null}  null for unknown ids
 */
export function getAlternatives(id, opts = {}) {
  const src = getExerciseMeta(id);
  if (!src) return null;
  const avail = opts.availableCategories ? new Set(opts.availableCategories) : null;
  const override = ALT_OVERRIDES[id] || {};
  const excluded = new Set(override.exclude || []);
  const forced = override.force || {};
  const out = { sourceId: id, close: [], partial: [] };

  for (const candId of taggedExerciseIds()) {
    if (candId === id || excluded.has(candId)) continue;
    const cand = getExerciseMeta(candId);
    let result = classify(src, cand);
    if (forced[candId]) {
      result = { tier: forced[candId], base: forced[candId] === "close" ? 100 : 50, reasons: ["pinned"] };
    }
    if (!result) continue;

    if (opts.category && !cand.categories.includes(opts.category)) continue;
    const available = !avail || cand.categories.some((c) => avail.has(c));
    if (!available && !opts.includeUnavailable) continue;

    const reasons = result.reasons.slice();
    let score = result.base;
    // Prefer substitutes that train the same library muscle group (an incline
    // press should outrank a triceps-focused close-grip press for a bench).
    if (cand.group === src.group) score += 8;
    if (cand.equipmentCategory === src.equipmentCategory) {
      score += 3;
      reasons.push("like-for-like-equipment");
    }
    const diff = DIFFICULTY_RANK[cand.difficulty] - DIFFICULTY_RANK[src.difficulty];
    if (diff === 0) score += 5;
    else if (diff < 0) { score += 2; reasons.push("easier"); }
    else { score -= 8 * diff; reasons.push("harder"); }
    if (cand.limitedOverload && !src.limitedOverload && !reasons.includes("limited-overload")) {
      score -= 5;
      reasons.push("limited-overload");
    }
    if (cand.home) reasons.push("home-friendly");

    out[result.tier].push({
      id: candId,
      tier: result.tier,
      score,
      category: cand.equipmentCategory,
      categories: cand.categories,
      available,
      reasons,
    });
  }
  const byScore = (a, b) => b.score - a.score || a.id.localeCompare(b.id);
  out.close.sort(byScore);
  out.partial.sort(byScore);
  return out;
}

/** Group a getAlternatives() result by equipment category tab (an item may appear under its equipment AND "home"). */
export function groupAlternativesByCategory(result) {
  const groups = Object.fromEntries(ALT_CATEGORIES.map((c) => [c.key, []]));
  if (!result) return groups;
  [...result.close, ...result.partial].forEach((alt) => {
    alt.categories.forEach((c) => groups[c] && groups[c].push(alt));
  });
  return groups;
}

/** Explicit relationship table for every tagged exercise — for export / debugging / tests. */
export function buildRelationshipTable() {
  const table = {};
  taggedExerciseIds().forEach((id) => {
    const r = getAlternatives(id);
    table[id] = { close: r.close.map((a) => a.id), partial: r.partial.map((a) => a.id) };
  });
  return table;
}

/* ---------------- v2 HELPERS ---------------- */

/** Bilingual label for a matching muscle / pattern key (falls back to the raw key). */
export function muscleLabel(key, lang = "en") {
  return (MUSCLE_LABELS[key] && MUSCLE_LABELS[key][lang]) || key;
}
export function patternLabel(key, lang = "en") {
  return (PATTERN_LABELS[key] && PATTERN_LABELS[key][lang]) || key;
}

/** Why an exercise has no like-for-like (close) substitute, or null if it has one. */
export function getPartialOnlyReason(id) {
  return PARTIAL_ONLY_REASONS[id] || null;
}

/**
 * Best single substitute for one exercise: the top close alternative,
 * otherwise the top partial one, otherwise null. Respects equipment.
 */
export function getBestAlternative(id, opts = {}) {
  const r = getAlternatives(id, opts);
  if (!r) return null;
  return r.close[0] || r.partial[0] || null;
}

/**
 * Home-workout substitutes, split by how much "home" they really are:
 *   none      — needs nothing at all
 *   adaptable — needs a household item (chair, towel, backpack, door);
 *               `note` says which one
 * Within each list the closer tier and higher score come first. Bands are
 * NOT home exercises here (they are equipment) — use category "band".
 * @returns {{ sourceId:string, none:Alt[], adaptable:Alt[] }|null}
 */
export function getHomeAlternatives(id, opts = {}) {
  const r = getAlternatives(id, { ...opts, category: "home" });
  if (!r) return null;
  const out = { sourceId: id, none: [], adaptable: [] };
  [...r.close, ...r.partial].forEach((alt) => {
    const meta = getExerciseMeta(alt.id);
    const item = { ...alt, homeMode: meta.homeMode };
    if (meta.homeMode === "none") out.none.push(item);
    else {
      item.note = HOME_NOTES[alt.id] || null;
      out.adaptable.push(item);
    }
  });
  return out;
}

/** Number of tagged exercises per equipment category (an exercise may count under its equipment AND "home"). */
export function getCategoryCounts() {
  const counts = Object.fromEntries(ALT_CATEGORIES.map((c) => [c.key, 0]));
  taggedExerciseIds().forEach((id) => getExerciseMeta(id).categories.forEach((c) => { counts[c] += 1; }));
  return counts;
}
