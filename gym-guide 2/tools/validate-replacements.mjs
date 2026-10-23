#!/usr/bin/env node
/**
 * validate-replacements.mjs — Phase 4 checks (no dependencies)
 * Run from the project root:  node tools/validate-replacements.mjs
 *
 * Proves the safe-replacement layer (js/modules/replacements.js) never loses
 * completed sets, typed weights/reps/RPE or history; that a swap is fully
 * reversible; that untouched slots are never modified; that corrupt saved
 * data degrades to the original program; and that every program slot still
 * has substitutes to offer once same-day duplicates are excluded.
 */
import { DATA } from "../js/modules/data.js";
import { EXERCISES } from "../js/modules/exercises-data.js";
import { STATE } from "../js/modules/store.js";
import * as S from "../js/modules/schedule.js";
import * as R from "../js/modules/replacements.js";
import * as W from "../js/modules/workout.js";
import { getAlternatives, availableCategoriesFromProfile } from "../js/modules/exercise-alternatives.js";

let pass = 0;
const failures = [];
function check(name, cond, detail = "") {
  if (cond) pass++;
  else failures.push(`${name}${detail ? " — " + detail : ""}`);
}
const clone = (o) => JSON.parse(JSON.stringify(o));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const NOW = new Date("2026-10-22T10:00:00Z");
const LATER = new Date("2026-10-23T10:00:00Z");

function reset(seed = {}) {
  Object.keys(STATE).forEach((k) => delete STATE[k]);
  Object.assign(STATE, clone(seed));
}
/** Best swap candidate for a slot that is not already used elsewhere in the day. */
function pickCandidate(dayKey, index, restrict) {
  const used = new Set(R.getDayExerciseIds(dayKey));
  const opts = restrict ? { availableCategories: restrict } : {};
  const r = getAlternatives(R.getSlotExerciseId(dayKey, index), opts);
  return [...r.close, ...r.partial].find((a) => !used.has(a.id));
}

const DAY = "dayPushA";
const SLOT = R.slotKey(DAY, 0);
const base0 = DATA[DAY].main[0].id;
const base1 = DATA[DAY].main[1].id;
const SEED = {
  sets: { [SLOT]: { 0: true, 1: true, 2: false }, [R.slotKey(DAY, 1)]: { 0: true } },
  logs: {
    [`${SLOT}-0-w`]: "60", [`${SLOT}-0-r`]: "8", [`${SLOT}-1-w`]: "60", [`${SLOT}-1-r`]: "7", [`${SLOT}-rpe`]: "8",
    [`${R.slotKey(DAY, 1)}-0-w`]: "20", [`${R.slotKey(DAY, 1)}-0-r`]: "10",
  },
  history: {
    [SLOT]: [{ date: "1/9/2026", dateISO: "2026-09-01", dayKey: DAY, volume: 480, best1rm: 76, name: "Barbell Bench Press" }],
    [R.slotKey(DAY, 1)]: [{ date: "2/9/2026", dateISO: "2026-09-02", dayKey: DAY, volume: 600, best1rm: 80, name: "Incline DB Press" }],
    day1: [{ date: "3/9/2026", dateISO: "2026-09-03", dayKey: "day1", volume: 1, best1rm: 1, name: "legacy" }],
  },
};

/* ---------- 1. untouched program is exactly DATA ---------- */
reset();
let identical = true;
for (const dayKey of S.ALL_DAY_KEYS) {
  DATA[dayKey].main.forEach((ref, i) => {
    if (R.getSlotRef(dayKey, i) !== ref) identical = false;
    if (R.getSlotExerciseId(dayKey, i) !== ref.id) identical = false;
  });
}
check("1: with no overrides every slot resolves to the DATA object itself", identical);
check("1: parseSlotKey parses slot keys", eq(R.parseSlotKey("dayPushA-main-3"), { dayKey: "dayPushA", index: 3 }));
check("1: parseSlotKey rejects archive keys and junk", R.parseSlotKey("dayPushA-main-3~x") === null && R.parseSlotKey("day1-cardio-0") === null && R.parseSlotKey(null) === null);
check("1: isArchiveKey / parseArchiveKey", R.isArchiveKey("dayPushA-main-0~band-row") && !R.isArchiveKey(SLOT) && R.parseArchiveKey("dayPushA-main-0~band-row").exerciseId === "band-row");

/* ---------- 2. swap with work in progress ---------- */
reset(SEED);
const before = clone(STATE);
const cand = pickCandidate(DAY, 0);
check("2: a candidate exists for the bench slot", !!cand, "none");
const res = R.replaceExercise(DAY, 0, cand.id, NOW);
check("2: replacement succeeds", res.ok === true, JSON.stringify(res));
check("2: override recorded with original + date", eq(STATE.exerciseOverrides[DAY][0], { id: cand.id, originalId: base0, since: "2026-10-22" }));
check("2: DATA was not edited", DATA[DAY].main[0].id === base0);
check("2: slot now runs the replacement", R.getSlotExerciseId(DAY, 0) === cand.id && R.getOriginalExerciseId(DAY, 0) === base0);
const ref = R.getSlotRef(DAY, 0);
check("2: replacement keeps the slot prescription (sets, rest, rpe)", ref.sets === DATA[DAY].main[0].sets && ref.rest === DATA[DAY].main[0].rest && ref.rpe === DATA[DAY].main[0].rpe);
check("2: replacement drops the original's coaching text", ref.cue === "" && ref.why === "" && ref.replaced === true);
check("2: slot sets/logs start clean", STATE.sets[SLOT] === undefined && !Object.keys(STATE.logs).some((k) => k.startsWith(SLOT + "-")));
const arch = R.archiveKey(DAY, 0, base0);
check("2: completed sets archived byte-for-byte", eq(STATE.sets[arch], before.sets[SLOT]));
check("2: weights, reps and RPE archived", ["-0-w", "-0-r", "-1-w", "-1-r", "-rpe"].every((s) => STATE.logs[arch + s] === before.logs[SLOT + s]));
check("2: no log was lost or invented (count)", Object.keys(STATE.logs).length === Object.keys(before.logs).length);
const archHist = STATE.history[arch];
check("2: old history kept under the old exercise", archHist && eq(archHist[0], before.history[SLOT][0]));
const partial = archHist && archHist[archHist.length - 1];
check("2: partial work saved as a history entry for the OLD exercise", partial && partial.partial === true && partial.exerciseId === base0 && partial.setsDone === 2 && partial.volume === 60 * 8 + 60 * 7, JSON.stringify(partial));
check("2: partial entry is dated and day-tagged for dashboard stats", partial && partial.dateISO === "2026-10-22" && partial.dayKey === DAY);
check("2: slot history is empty for the new exercise", STATE.history[SLOT] === undefined);
check("2: neighbouring slot sets/logs/history untouched", eq(STATE.sets[R.slotKey(DAY, 1)], before.sets[R.slotKey(DAY, 1)]) && STATE.logs[`${R.slotKey(DAY, 1)}-0-w`] === "20" && eq(STATE.history[R.slotKey(DAY, 1)], before.history[R.slotKey(DAY, 1)]));
check("2: unrelated day history untouched", eq(STATE.history.day1, before.history.day1));
check("2: swap log recorded", STATE.swapLog.length === 1 && STATE.swapLog[0].fromId === base0 && STATE.swapLog[0].toId === cand.id && STATE.swapLog[0].setsDone === 2);
check("2: info reports replaced", R.getReplacementInfo(DAY, 0).replaced === true && R.countReplacements(DAY) === 1);

/* ---------- 3. work on the replacement, then restore the original ---------- */
STATE.sets[SLOT] = { 0: true };
STATE.logs[`${SLOT}-0-w`] = "30";
STATE.logs[`${SLOT}-0-r`] = "12";
const back = R.replaceExercise(DAY, 0, base0, LATER);
check("3: restoring the original succeeds", back.ok && back.restoredOriginal === true);
check("3: override removed (no empty day map left)", STATE.exerciseOverrides[DAY] === undefined);
check("3: original completed sets are back exactly", eq(STATE.sets[SLOT], before.sets[SLOT]));
check("3: original weights/reps/RPE are back exactly", ["-0-w", "-0-r", "-1-w", "-1-r", "-rpe"].every((s) => STATE.logs[SLOT + s] === before.logs[SLOT + s]));
check("3: original history is back, including the partial entry", STATE.history[SLOT].length === 2 && STATE.history[SLOT][1].partial === true);
const archNew = R.archiveKey(DAY, 0, cand.id);
check("3: the replacement's own work was archived, not dropped", eq(STATE.sets[archNew], { 0: true }) && STATE.logs[archNew + "-0-w"] === "30" && STATE.logs[archNew + "-0-r"] === "12");
check("3: replacement's partial session saved under it", STATE.history[archNew] && STATE.history[archNew][0].exerciseId === cand.id && STATE.history[archNew][0].setsDone === 1);

/* ---------- 4. swap to the replacement again -> its data returns ---------- */
const again = R.replaceExercise(DAY, 0, cand.id, LATER);
check("4: swapping to the same replacement again works", again.ok);
check("4: its earlier sets/logs are restored", eq(STATE.sets[SLOT], { 0: true }) && STATE.logs[SLOT + "-0-w"] === "30");
check("4: its history is restored with it", STATE.history[SLOT] && STATE.history[SLOT][0].exerciseId === cand.id);
check("4: original's data safely archived again", eq(STATE.sets[arch], before.sets[SLOT]) && STATE.logs[arch + "-rpe"] === "8");

/* ---------- 5. chain A -> B -> C and back ---------- */
reset(SEED);
const used = new Set(R.getDayExerciseIds(DAY));
const pool = [...getAlternatives(base0).close, ...getAlternatives(base0).partial].map((a) => a.id).filter((id) => !used.has(id));
const [B, C] = pool;
R.replaceExercise(DAY, 0, B, NOW);
STATE.sets[SLOT] = { 0: true };
STATE.logs[`${SLOT}-0-w`] = "40";
R.replaceExercise(DAY, 0, C, NOW);
check("5: chain keeps the ORIGINAL id as the reference", STATE.exerciseOverrides[DAY][0].originalId === base0 && STATE.exerciseOverrides[DAY][0].id === C);
check("5: both earlier exercises archived", STATE.sets[R.archiveKey(DAY, 0, base0)] && STATE.sets[R.archiveKey(DAY, 0, B)]);
R.replaceExercise(DAY, 0, B, NOW);
check("5: going back to B restores B's work", eq(STATE.sets[SLOT], { 0: true }) && STATE.logs[SLOT + "-0-w"] === "40");
R.restoreOriginal(DAY, 0, NOW);
check("5: restoreOriginal brings A's sets back", eq(STATE.sets[SLOT], SEED.sets[SLOT]) && STATE.logs[SLOT + "-0-w"] === "60");

/* ---------- 6. refusals leave state untouched ---------- */
reset(SEED);
const snap = clone(STATE);
check("6: same exercise refused", R.replaceExercise(DAY, 0, base0).reason === "same-exercise");
check("6: unknown exercise refused", R.replaceExercise(DAY, 0, "not-a-real-id").reason === "unknown-exercise");
check("6: exercise already in the day refused", R.replaceExercise(DAY, 0, base1).reason === "already-in-day");
check("6: missing slot refused", R.replaceExercise(DAY, 99, "crunch").reason === "no-slot" && R.replaceExercise("dayNope", 0, "crunch").reason === "no-slot");
check("6: refusals did not change state", eq(STATE, snap));
check("6: every refusal reason has a bilingual message", ["no-slot", "unknown-exercise", "same-exercise", "already-in-day"].every((r) => R.REFUSAL_MESSAGES[r].ar && R.REFUSAL_MESSAGES[r].en));

/* ---------- 7. a swap with no work records no fake history ---------- */
reset({ history: { [SLOT]: [{ date: "x", dateISO: "2026-09-01", dayKey: DAY, volume: 1, best1rm: 1, name: "n" }] } });
R.replaceExercise(DAY, 0, pickCandidate(DAY, 0).id, NOW);
check("7: no sets/weights => no partial entry invented", STATE.history[R.archiveKey(DAY, 0, base0)].length === 1);
reset({ sets: { [SLOT]: { 0: true } }, history: { [SLOT]: [{ date: "x", dateISO: "2026-10-22", dayKey: DAY, volume: 5, best1rm: 5, name: "n" }] } });
R.replaceExercise(DAY, 0, pickCandidate(DAY, 0).id, NOW);
check("7: session already saved today => no duplicate partial entry", STATE.history[R.archiveKey(DAY, 0, base0)].length === 1);

/* ---------- 8. corrupt saved overrides degrade safely ---------- */
reset({ exerciseOverrides: { [DAY]: { 0: { id: "no-such-exercise" }, 1: { id: base1 }, 2: "junk", 3: null } } });
check("8: unknown override id ignored", R.getSlotRef(DAY, 0) === DATA[DAY].main[0]);
check("8: override equal to the original ignored", R.getSlotRef(DAY, 1) === DATA[DAY].main[1] && !R.getReplacementInfo(DAY, 1).replaced);
check("8: non-object override ignored", R.getSlotRef(DAY, 2) === DATA[DAY].main[2] && R.getSlotRef(DAY, 3) === DATA[DAY].main[3]);
check("8: count ignores corrupt entries", R.countReplacements(DAY) === 0);
reset({ exerciseOverrides: "garbage", swapLog: "garbage" });
check("8: non-object override map does not throw", R.getSlotExerciseId(DAY, 0) === base0);
check("8: swap works on top of a corrupt swapLog/override map", R.replaceExercise(DAY, 0, pickCandidate(DAY, 0).id, NOW).ok && Array.isArray(STATE.swapLog));

/* ---------- 9. id-prefix collisions cannot mix archived logs ---------- */
const prefixPair = (() => {
  for (const a of EXERCISES) for (const b of EXERCISES) if (a.id !== b.id && b.id.startsWith(a.id + "-")) return [a.id, b.id];
  return null;
})();
if (prefixPair) {
  const [pa, pb] = prefixPair;
  const usedHere = new Set(R.getDayExerciseIds(DAY));
  if (!usedHere.has(pa) && !usedHere.has(pb)) {
    reset();
    R.replaceExercise(DAY, 0, pa, NOW);
    STATE.logs[`${SLOT}-0-w`] = "11";
    R.replaceExercise(DAY, 0, pb, NOW);
    STATE.logs[`${SLOT}-0-w`] = "22";
    R.replaceExercise(DAY, 0, pa, NOW);
    check(`9: ${pa} / ${pb} (id is a prefix of the other) keep their own logs`, STATE.logs[`${SLOT}-0-w`] === "11" && STATE.logs[R.archiveKey(DAY, 0, pb) + "-0-w"] === "22");
  } else check("9: prefix pair unavailable in this day (skipped)", true);
} else check("9: no prefix-colliding ids in library (nothing to test)", true);

/* ---------- 10. every slot: swap + restore is lossless ---------- */
let slots = 0;
let lossless = 0;
const seedFor = (dayKey, i) => ({
  sets: { [R.slotKey(dayKey, i)]: { 0: true, 1: false } },
  logs: { [`${R.slotKey(dayKey, i)}-0-w`]: "50", [`${R.slotKey(dayKey, i)}-0-r`]: "9", [`${R.slotKey(dayKey, i)}-rpe`]: "7" },
  history: { [R.slotKey(dayKey, i)]: [{ date: "d", dateISO: "2026-09-09", dayKey, volume: 450, best1rm: 65, name: "x" }] },
});
for (const dayKey of S.ALL_DAY_KEYS) {
  DATA[dayKey].main.forEach((r, i) => {
    slots++;
    reset(seedFor(dayKey, i));
    const orig = clone(STATE);
    const c = pickCandidate(dayKey, i);
    if (!c) return;
    const a = R.replaceExercise(dayKey, i, c.id, NOW);
    const b = R.restoreOriginal(dayKey, i, NOW);
    const k = R.slotKey(dayKey, i);
    const same = a.ok && b.ok && eq(STATE.sets[k], orig.sets[k]) && Object.keys(orig.logs).every((lk) => STATE.logs[lk] === orig.logs[lk]) && STATE.history[k][0].volume === 450 && R.countReplacements(dayKey) === 0;
    if (same) lossless++;
    else failures.push(`10: ${dayKey}[${i}] ${r.id} -> ${c.id} -> back lost data`);
  });
}
check(`10: all ${slots} program slots round-trip losslessly`, lossless === slots, `${lossless}/${slots}`);

/* ---------- 11. UI-facing coverage after same-day exclusion ---------- */
const PROFILES = [["bands"], ["bodyweight"], ["dumbbells"], ["cables"], ["machines"], ["barbell"], ["full-gym"]];
let holes = [];
for (const dayKey of S.ALL_DAY_KEYS) {
  DATA[dayKey].main.forEach((r, i) => {
    reset();
    if (!pickCandidate(dayKey, i)) holes.push(`${dayKey}[${i}] ${r.id} (no filter)`);
    for (const p of PROFILES) {
      if (!pickCandidate(dayKey, i, availableCategoriesFromProfile(p))) holes.push(`${dayKey}[${i}] ${r.id} (${p[0]})`);
    }
  });
}
check("11: every program slot has a swap candidate for every equipment profile, even after hiding same-day duplicates", holes.length === 0, holes.slice(0, 6).join("; "));

/* ---------- 12. workout.js integration (pure functions) ---------- */
reset(SEED);
STATE.sets[SLOT] = { 0: true, 1: true, 2: true, 3: true }; // flat bench is 4 sets
const c12 = pickCandidate(DAY, 0);
check("12: slot complete before swap", W.isExerciseComplete(DAY, 0) === true);
R.replaceExercise(DAY, 0, c12.id, NOW);
const resolved = W.resolveDayMain(DAY);
check("12: resolveDayMain returns the replacement (library name/muscle)", resolved[0].id === c12.id && resolved[0].en === EXERCISES.find((e) => e.id === c12.id).en && resolved[0].replaced === true);
check("12: replacement gets library coaching text", resolved[0].cue.length > 10 && resolved[0].mistake.length > 5 && resolved[0].why.length > 5);
check("12: other slots resolve unchanged", resolved[1].id === base1 && resolved[1].replaced === undefined);
check("12: completion counts restart for the replacement", W.getExerciseCompletion(DAY, 0).done === 0 && W.getExerciseCompletion(DAY, 0).total === 4 && W.isExerciseComplete(DAY, 0) === false);
check("12: replacement keeps the slot position in getNextIncompleteExercise", W.getNextIncompleteExercise(DAY, 0).index === 0 && W.getNextIncompleteExercise(DAY, 0).ex.id === c12.id);
W.completeDayFromGym(DAY);
const gymEntry = STATE.history[SLOT][STATE.history[SLOT].length - 1];
check("12: Gym Mode completion records the replacement's id and name", gymEntry.exerciseId === c12.id && gymEntry.name === resolved[0].en);
check("12: Gym Mode completion leaves the archived exercise's history alone", STATE.history[R.archiveKey(DAY, 0, base0)].length === 2);
check("12: other slots' history entries carry their exercise id", STATE.history[R.slotKey(DAY, 1)].slice(-1)[0].exerciseId === base1);

import { formatHistoryEntry } from "../js/modules/ui.js";
check("12: formatHistoryEntry marks partial sessions and leaves normal ones alone", formatHistoryEntry({ date: "d", volume: 1, best1rm: 2, partial: true, setsDone: 2 }).includes("جزئية (2 سيت") && !formatHistoryEntry({ date: "d", volume: 1, best1rm: 2 }).includes("جزئية"));

/* ---------- 13. service worker + wiring ---------- */
import { readFileSync } from "node:fs";
const sw = readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");
check("13: service worker precaches the three new modules and bumps the cache", ["exercise-alternatives.js", "replacements.js", "alternatives-ui.js"].every((f) => sw.includes("./js/modules/" + f)) && sw.includes("gym-guide-shell-v1.16.0"));
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
check("13: index.html hosts the sheet (dialog, labelled, modal) and toast", /id="altPanel"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="altTitle"/.test(html) && html.includes('id="altToast"'));

console.log(failures.length ? `FAIL: ${failures.length} failed, ${pass} passed` : `OK: ${pass}/${pass} checks passed`);
failures.forEach((f) => console.log("  ✗", f));
process.exit(failures.length ? 1 : 0);
