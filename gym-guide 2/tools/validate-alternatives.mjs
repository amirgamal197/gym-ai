/**
 * tools/validate-alternatives.mjs
 * Run:  node tools/validate-alternatives.mjs
 * Exit code 0 = all checks passed, 1 = at least one failure.
 *
 * Checks the exercise-alternatives data model against the real
 * exercise library and the real program (data.js). No dependencies.
 */
import { EXERCISES } from "../js/modules/exercises-data.js";
import { DATA } from "../js/modules/data.js";
import {
  ALT_CATEGORIES,
  getExerciseMeta,
  getAlternatives,
  groupAlternativesByCategory,
  availableCategoriesFromProfile,
  buildRelationshipTable,
  tagTableIds,
  taggedExerciseIds,
  // v2 (Phase 3)
  ALT_DATA_VERSION,
  ALT_OVERRIDES,
  PARTIAL_ONLY_REASONS,
  MUSCLE_LABELS,
  PATTERN_LABELS,
  HOME_NOTES,
  getHomeAlternatives,
  getBestAlternative,
  getPartialOnlyReason,
  getCategoryCounts,
  muscleLabel,
  patternLabel,
} from "../js/modules/exercise-alternatives.js";

let failures = 0;
let checks = 0;
const warnings = [];
function check(name, ok, detail = "") {
  checks++;
  if (!ok) {
    failures++;
    console.error(`FAIL  ${name}${detail ? " — " + detail : ""}`);
  }
}

const libIds = EXERCISES.map((e) => e.id);
const libSet = new Set(libIds);

// 1. IDs unique in the library
check("library ids are unique", libSet.size === libIds.length);

// 2. Tag table <-> library coverage (no orphans, no gaps)
const tagIds = tagTableIds();
const tagSet = new Set(tagIds);
const orphanTags = tagIds.filter((id) => !libSet.has(id));
const untagged = libIds.filter((id) => !tagSet.has(id));
check("no tag rows for unknown exercise ids", orphanTags.length === 0, orphanTags.join(", "));
check("every library exercise is tagged", untagged.length === 0, untagged.join(", "));
check("tag table has no duplicate keys", tagIds.length === tagSet.size);

// 3. Meta sanity
const categoryKeys = new Set(ALT_CATEGORIES.map((c) => c.key));
for (const id of taggedExerciseIds()) {
  const m = getExerciseMeta(id);
  check(`meta ${id}: pattern/muscle present`, !!(m && m.pattern && m.muscle));
  check(`meta ${id}: valid purpose`, ["builder", "isolation", "stability"].includes(m.purpose));
  check(`meta ${id}: categories valid`, m.categories.every((c) => categoryKeys.has(c)));
}

// 4. Relationship integrity
const table = buildRelationshipTable();
let noAlt = [];
let noClose = [];
for (const id of taggedExerciseIds()) {
  const r = getAlternatives(id);
  const all = [...r.close, ...r.partial].map((a) => a.id);
  check(`${id}: no self-alternative`, !all.includes(id));
  check(`${id}: no duplicate alternatives`, new Set(all).size === all.length);
  check(`${id}: alternatives exist in library`, all.every((a) => libSet.has(a)));
  check(`${id}: close/partial are disjoint`, r.close.every((a) => !r.partial.some((p) => p.id === a.id)));
  if (all.length === 0) noAlt.push(id);
  if (r.close.length === 0) noClose.push(id);
}
check("every exercise has at least one alternative", noAlt.length === 0, noAlt.join(", "));
// v2: every exercise without a close substitute must carry a documented reason
// (PARTIAL_ONLY_REASONS) — "partial only" is allowed, "unexplained" is not.
for (const id of noClose) {
  const why = PARTIAL_ONLY_REASONS[id];
  check(`${id}: no close alternative => documented reason (en+ar)`, !!(why && why.en && why.ar));
}
for (const id of Object.keys(PARTIAL_ONLY_REASONS)) {
  check(`PARTIAL_ONLY_REASONS.${id}: exercise exists`, libSet.has(id));
  check(`PARTIAL_ONLY_REASONS.${id}: still has no close alternative (stale entry)`, noClose.includes(id));
}

// 5. "close" symmetry: A close-to B  <=>  B close-to A, unless the
//    limited-overload downgrade applies in one direction only.
for (const a of taggedExerciseIds()) {
  for (const b of table[a].close) {
    const back = table[b].close.includes(a);
    const ma = getExerciseMeta(a);
    const mb = getExerciseMeta(b);
    const explained = !back && (ma.limitedOverload || mb.limitedOverload);
    check(`close symmetry ${a} <-> ${b}`, back || explained);
  }
}

// 6. Real program days: every exercise a day references has alternatives
const programIds = new Set();
Object.values(DATA).forEach((day) => {
  if (day && Array.isArray(day.main)) day.main.forEach((ex) => ex && ex.id && programIds.add(ex.id));
});
check("program references at least one library exercise", programIds.size > 0);
for (const id of programIds) {
  check(`program exercise exists in library: ${id}`, libSet.has(id));
  const r = getAlternatives(id);
  check(`program exercise has alternatives: ${id}`, !!r && r.close.length + r.partial.length > 0);
}

// 7. Equipment filtering behaves
{
  const home = getAlternatives("flat-barbell-bench", { category: "home" });
  check("home filter returns only home-friendly items", [...home.close, ...home.partial].every((a) => a.categories.includes("home")));
  check("home filter finds a bench-press substitute", home.close.length + home.partial.length > 0);

  const dbOnly = availableCategoriesFromProfile(["dumbbells"]);
  const r = getAlternatives("flat-barbell-bench", { availableCategories: dbOnly });
  const ok = [...r.close, ...r.partial].every((a) => a.categories.some((c) => dbOnly.has(c)));
  check("availableCategories filter excludes unavailable equipment", ok);
  check("dumbbell-only user still gets a close bench substitute", r.close.some((a) => a.id === "flat-db-press"));

  const withUnavail = getAlternatives("flat-barbell-bench", { availableCategories: dbOnly, includeUnavailable: true });
  check("includeUnavailable keeps flagged items", withUnavail.close.some((a) => a.available === false));

  check("no profile equipment => no restriction (null)", availableCategoriesFromProfile([]) === null);
  check("unknown id returns null", getAlternatives("does-not-exist") === null);

  const grouped = groupAlternativesByCategory(getAlternatives("lat-pulldown"));
  check("grouping returns every category key", [...categoryKeys].every((k) => Array.isArray(grouped[k])));
}

// 8. Spot-check coaching sanity
{
  const bench = getAlternatives("flat-barbell-bench");
  const closeIds = bench.close.map((a) => a.id);
  check("bench close: DB press, machine press, smith press", ["flat-db-press", "machine-chest-press", "smith-machine-bench-press"].every((i) => closeIds.includes(i)));
  check("push-up is NOT a close substitute for barbell bench", !closeIds.includes("pushup"));
  check("push-up IS a partial substitute for barbell bench", bench.partial.some((a) => a.id === "pushup"));
  check("incline press is only partial for flat bench", bench.partial.some((a) => a.id === "incline-barbell-bench"));
  const pd = getAlternatives("lat-pulldown").close.map((a) => a.id);
  check("lat pulldown close: pull-ups & chin-ups", pd.includes("pullups") && pd.includes("chin-up"));
  const rdl = getAlternatives("rdl").close.map((a) => a.id);
  check("RDL close: good-morning & single-leg RDL", rdl.includes("good-morning") && rdl.includes("single-leg-rdl"));
}


// ======================= Phase 3 (v2) checks =======================
check("ALT_DATA_VERSION is 2", ALT_DATA_VERSION === 2);

// 9. Labels: every muscle / pattern used in tags has bilingual text
{
  const muscles = new Set(), patterns = new Set();
  for (const id of taggedExerciseIds()) {
    const m = getExerciseMeta(id);
    muscles.add(m.muscle);
    patterns.add(m.pattern);
  }
  for (const k of muscles) {
    const l = MUSCLE_LABELS[k];
    check(`muscle label en+ar: ${k}`, !!(l && l.en && l.ar));
  }
  for (const k of patterns) {
    const l = PATTERN_LABELS[k];
    check(`pattern label en+ar: ${k}`, !!(l && l.en && l.ar));
  }
  check("no unused muscle labels", Object.keys(MUSCLE_LABELS).every((k) => muscles.has(k)), Object.keys(MUSCLE_LABELS).filter((k) => !muscles.has(k)).join(", "));
  check("no unused pattern labels", Object.keys(PATTERN_LABELS).every((k) => patterns.has(k)), Object.keys(PATTERN_LABELS).filter((k) => !patterns.has(k)).join(", "));
  check("muscleLabel falls back to the raw key", muscleLabel("zzz") === "zzz" && patternLabel("zzz", "ar") === "zzz");
  check("muscleLabel returns Arabic", muscleLabel("lats", "ar") === MUSCLE_LABELS.lats.ar);
}

// 10. Overrides are sane and curated pairs are symmetric
for (const [src, o] of Object.entries(ALT_OVERRIDES)) {
  check(`override source exists: ${src}`, libSet.has(src));
  for (const [cand, tier] of Object.entries(o.force || {})) {
    check(`override ${src}->${cand}: candidate exists, not self`, libSet.has(cand) && cand !== src);
    check(`override ${src}->${cand}: valid tier`, tier === "close" || tier === "partial");
    const back = (ALT_OVERRIDES[cand] && ALT_OVERRIDES[cand].force) || {};
    check(`override ${src}<->${cand}: pinned in both directions`, back[src] === tier, `reverse is ${back[src]}`);
    const r = getAlternatives(src);
    check(`override ${src}->${cand}: result honours the pinned tier`, r[tier].some((a) => a.id === cand));
  }
  (o.exclude || []).forEach((cand) => check(`override ${src} exclude ${cand}: exists`, libSet.has(cand)));
}

// 11. Equipment categories: every category is populated, every library equipment type maps
{
  const counts = getCategoryCounts();
  for (const c of ALT_CATEGORIES) check(`category "${c.key}" has exercises (${counts[c.key]})`, counts[c.key] >= 10);
  check("Band category has >= 15 exercises", counts.band >= 15, String(counts.band));
  check("Home category has >= 25 exercises", counts.home >= 25, String(counts.home));
  const bandLib = EXERCISES.filter((e) => e.equipment === "Band").map((e) => e.id);
  check("every Band exercise is in the band category", bandLib.every((id) => getExerciseMeta(id).equipmentCategory === "band"));
  const home = taggedExerciseIds().map(getExerciseMeta).filter((m) => m.home);
  check("no-equipment home exercises are all Bodyweight", home.filter((m) => m.homeMode === "none").every((m) => EXERCISES.find((e) => e.id === m.id).equipment === "Bodyweight"));
  check("home exercises are never Band/Machine/Cable/Barbell", home.every((m) => ["bodyweight", "dumbbell"].includes(m.equipmentCategory)));
}

// 12. Home notes cover every household-item (adaptable) exercise, and only those
{
  const adaptable = taggedExerciseIds().filter((id) => getExerciseMeta(id).homeMode === "adaptable");
  for (const id of adaptable) check(`home note (en+ar) for adaptable: ${id}`, !!(HOME_NOTES[id] && HOME_NOTES[id].en && HOME_NOTES[id].ar));
  for (const id of Object.keys(HOME_NOTES)) check(`home note belongs to an adaptable exercise: ${id}`, adaptable.includes(id));
  const h = getHomeAlternatives("flat-barbell-bench");
  check("getHomeAlternatives: pike/push-up family offered with no equipment", h.none.some((a) => a.id === "pushup"));
  check("getHomeAlternatives: adaptable items carry a note", h.adaptable.every((a) => a.note && a.note.en));
  check("getHomeAlternatives: every item has homeMode", [...h.none, ...h.adaptable].every((a) => a.homeMode === "none" || a.homeMode === "adaptable"));
  check("getHomeAlternatives: unknown id => null", getHomeAlternatives("nope") === null);
}

// 13. Equipment-profile coverage — each program exercise must have a substitute
//     for someone who owns ONLY that kind of equipment. (Phase 3 goal.)
{
  const profiles = { bands: ["bands"], bodyweight: ["bodyweight"], dumbbells: ["dumbbells"], cables: ["cables"], machines: ["machines"] };
  for (const [name, keys] of Object.entries(profiles)) {
    const avail = availableCategoriesFromProfile(keys);
    const missing = [...programIds].filter((id) => {
      const r = getAlternatives(id, { availableCategories: avail });
      return r.close.length + r.partial.length === 0;
    });
    check(`every program exercise has a substitute for a "${name}"-only user`, missing.length === 0, missing.join(", "));
  }
  const noHome = [...programIds].filter((id) => {
    const h = getHomeAlternatives(id);
    return h.none.length + h.adaptable.length === 0;
  });
  check("every program exercise has a home substitute", noHome.length === 0, noHome.join(", "));
  // Real examples from the brief
  const bench = getAlternatives("flat-barbell-bench", { category: "band" });
  check("bench press has a band substitute", [...bench.close, ...bench.partial].some((a) => a.id === "band-chest-press"));
  const row = getAlternatives("seated-cable-row", { category: "band" });
  const bandRow = row.partial.find((a) => a.id === "band-seated-row");
  check("seated cable row: band row is PARTIAL and flagged limited-overload (band compound)", !!bandRow && bandRow.reasons.includes("limited-overload") && !row.close.some((a) => a.id === "band-seated-row"));
  const pd = getAlternatives("tricep-pushdown");
  check("pushdown: band pushdown is a CLOSE substitute", pd.close.some((a) => a.id === "band-triceps-pushdown"));
  const fp = getAlternatives("face-pull");
  check("face pull: band face pull & pull-apart are CLOSE", ["band-face-pull", "band-pull-apart"].every((i) => fp.close.some((a) => a.id === i)));
}

// 14. Matching rules (muscle-specific, movement pattern, purpose, difficulty, tiers)
{
  const squat = getAlternatives("back-squat");
  check("back squat: hack squat is CLOSE", squat.close.some((a) => a.id === "hack-squat"));
  check("back squat: band squat & bodyweight squat are NOT close (limited overload)", !squat.close.some((a) => ["band-squat", "bodyweight-squat"].includes(a.id)));
  check("back squat: band squat & bodyweight squat ARE partial and flagged", ["band-squat", "bodyweight-squat"].every((i) => { const a = squat.partial.find((x) => x.id === i); return a && a.reasons.includes("limited-overload"); }));
  const lp = getAlternatives("leg-press");
  check("leg press <-> hack squat is a curated CLOSE pair", lp.close.some((a) => a.id === "hack-squat"));
  check("leg press close pair carries the pinned reason", lp.close.find((a) => a.id === "hack-squat").reasons.includes("pinned"));

  // muscle-specific: upper/mid/lower chest never collapse into each other as "close"
  const flat = getAlternatives("flat-barbell-bench").close.map((a) => a.id);
  check("flat bench: no upper-chest or lower-chest exercise is close", !flat.some((i) => ["incline-db-press", "incline-barbell-bench", "decline-db-press", "decline-barbell-bench", "feet-elevated-pushup"].includes(i)));
  const inc = getAlternatives("incline-barbell-bench").close.map((a) => a.id);
  check("incline bench: incline DB press is close, feet-elevated push-up is partial", inc.includes("incline-db-press") && !inc.includes("feet-elevated-pushup") && getAlternatives("incline-barbell-bench").partial.some((a) => a.id === "feet-elevated-pushup"));
  check("feet-elevated push-up is filed as an INCLINE (upper chest) press, not a decline", getExerciseMeta("feet-elevated-pushup").pattern === "incline-press");
  check("decline DB press is a CLOSE substitute for decline barbell bench", getAlternatives("decline-barbell-bench").close.some((a) => a.id === "decline-db-press"));
  const sol = getAlternatives("seated-calf-raise-machine").close.map((a) => a.id);
  check("soleus: seated DB calf raise is close, standing (gastroc) raises are NOT", sol.includes("seated-dumbbell-calf-raise") && !sol.includes("standing-calf-raise-machine"));
  const gastro = getAlternatives("standing-calf-raise-machine").close.map((a) => a.id);
  check("gastrocnemius: bent-knee (soleus) raise is NOT close to a standing raise", !gastro.includes("bent-knee-calf-raise"));
  // movement pattern: same muscle, different pattern stays partial
  const curl = getAlternatives("barbell-curl");
  check("curl: hammer curl is only partial for a barbell curl", !curl.close.some((a) => a.id === "hammer-curl") && curl.partial.some((a) => a.id === "hammer-curl"));
  check("hammer curl: cable rope hammer curl is CLOSE", getAlternatives("hammer-curl").close.some((a) => a.id === "cable-rope-hammer-curl"));
  // purpose: compound vs isolation don't mix in close
  const tri = getAlternatives("tricep-pushdown");
  check("pushdown: compound close-grip press is not a close substitute", !tri.close.some((a) => a.id === "close-grip-bench-press"));
  // difficulty: harder options are labelled
  const pushup = getAlternatives("pushup").partial.concat(getAlternatives("pushup").close);
  check("push-up: a harder alternative is labelled 'harder'", pushup.some((a) => a.reasons.includes("harder")));
  // stability exemption: plank <-> ab wheel are close both ways
  check("plank <-> ab wheel close both ways", getAlternatives("plank").close.some((a) => a.id === "ab-wheel-rollout") && getAlternatives("ab-wheel-rollout").close.some((a) => a.id === "plank"));
  // bicycle crunch is an oblique rotation move, not a plain crunch
  check("bicycle crunch is rotation/obliques", getExerciseMeta("bicycle-crunch").pattern === "rotation" && getExerciseMeta("bicycle-crunch").muscle === "obliques");
  check("bicycle crunch <-> plain crunch partial both ways", getAlternatives("bicycle-crunch").partial.some((a) => a.id === "crunch") && getAlternatives("crunch").partial.some((a) => a.id === "bicycle-crunch"));
  // best-alternative helper
  const best = getBestAlternative("flat-barbell-bench");
  check("getBestAlternative returns the top close substitute", best && best.tier === "close" && best.id === getAlternatives("flat-barbell-bench").close[0].id);
  const bestBand = getBestAlternative("flat-barbell-bench", { availableCategories: availableCategoriesFromProfile(["bands"]) });
  check("getBestAlternative respects equipment (band-only => band/home option)", bestBand && bestBand.categories.some((c) => c === "band" || c === "home"));
  check("getBestAlternative unknown id => null", getBestAlternative("nope") === null);
  check("getPartialOnlyReason: null for exercises with a close substitute", getPartialOnlyReason("flat-barbell-bench") === null);
  check("getPartialOnlyReason: text for dips", !!getPartialOnlyReason("dips"));
}

// 15. Library content quality (every entry, old and new)
{
  const urlOk = (u) => u === null || (typeof u === "string" && /^https:\/\//.test(u));
  for (const e of EXERCISES) {
    const ok = e.id && e.en && e.ar && e.group && e.primary && e.secondary
      && Array.isArray(e.instructions) && e.instructions.length >= 2
      && Array.isArray(e.mistakes) && e.mistakes.length >= 1
      && Array.isArray(e.tips) && e.tips.length >= 1;
    check(`library entry complete: ${e.id}`, !!ok);
    check(`library entry id is a safe slug: ${e.id}`, /^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.id));
    check(`library entry illustration is null or https: ${e.id}`, urlOk(e.illustration));
    check(`library entry has Arabic text in name: ${e.id}`, /[\u0600-\u06FF]/.test(e.ar));
  }
  const original = new Set(["flat-barbell-bench", "pullups", "rdl", "back-squat", "hip-thrust", "face-pull"]);
  check("original exercise ids preserved", [...original].every((id) => libSet.has(id)));
}

// Report
console.log(`Exercises in library : ${libIds.length}`);
console.log(`Tagged exercises     : ${taggedExerciseIds().length}`);
console.log(`Program exercises    : ${programIds.size}`);
let closeTotal = 0, partialTotal = 0;
Object.values(table).forEach((t) => { closeTotal += t.close.length; partialTotal += t.partial.length; });
console.log(`Relationships        : ${closeTotal} close, ${partialTotal} partial (directed)`);
warnings.forEach((w) => console.warn("WARN  " + w));
console.log(`\n${checks - failures}/${checks} checks passed${failures ? `, ${failures} FAILED` : ""}`);
process.exit(failures ? 1 : 0);
