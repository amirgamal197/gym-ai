#!/usr/bin/env node
/**
 * validate-goals.mjs — logic checks for goal-driven personalization (goals.js).
 * Pure Node, no browser:   node tools/validate-goals.mjs
 */
import { STATE } from "../js/modules/store.js";
import { DATA } from "../js/modules/data.js";
import { GOALS } from "../js/modules/profile.js";
import { PROGRAMS } from "../js/modules/schedule.js";
import {
  GOAL_PROFILES, POSTURE_OPTIONS, DEFAULT_BRAND, brandFor, getBrand, getPostureFocus,
  pickPrep, orderByFocus, postureTagsOf, activationCount, recommendProgram, needsOnboarding, wantsFinisher, goalNoteHtml,
} from "../js/modules/goals.js";

let passed = 0;
const failed = [];
function check(name, cond, detail = "") {
  if (cond) passed++;
  else failed.push(name + (detail ? ` — ${detail}` : ""));
}
function reset() {
  for (const k of Object.keys(STATE)) delete STATE[k];
}

const postureKeys = POSTURE_OPTIONS.map((p) => p.key);
const focusSets = [[], ["apt"], ["rounded-shoulders"], ["apt", "rounded-shoulders"]];
const subsets = (a) => a.reduce((acc, x) => acc.concat(acc.map((s) => s.concat(x))), [[]]);

/* A. every goal the profile offers has a profile of its own, with every text field */
for (const g of GOALS) {
  const gp = GOAL_PROFILES[g.key];
  check(`A: goal ${g.key} has a profile`, !!gp);
  if (!gp) continue;
  for (const f of ["brandEn", "brandAr", "pitch", "reps", "rest", "food"]) check(`A: ${g.key}.${f} is text`, typeof gp[f] === "string" && gp[f].trim().length >= 3);
  check(`A: ${g.key}.finisher is boolean`, typeof gp.finisher === "boolean");
}

/* B. brand line: neutral by default, specific once chosen, unique per goal */
reset();
check("B: default brand before any choice", getBrand().en === DEFAULT_BRAND.en && getBrand().ar === DEFAULT_BRAND.ar);
const seen = new Set();
for (const g of GOALS) {
  for (const f of focusSets) {
    const b = brandFor(g.key, f);
    check(`B: brand ${g.key}+${f.join("+") || "none"} has en+ar`, b.en && b.ar);
    check(`B: brand ${g.key}+${f.join("+") || "none"} mentions the goal`, b.ar.includes(GOAL_PROFILES[g.key].brandAr));
    seen.add(b.ar + "|" + b.en);
  }
}
check("B: every goal x posture combination reads differently", seen.size === GOALS.length * focusSets.length, `${seen.size}`);
check("B: no goal + posture only", brandFor(null, ["apt"]).ar.includes("تصحيح") && !brandFor(null, ["apt"]).ar.includes("تضخيم"));
check("B: no goal + no posture is the default", brandFor(null, []) === DEFAULT_BRAND);
STATE.profile = { goal: "fat-loss", posture: [] };
check("B: getBrand reads STATE (fat loss, no posture)", getBrand().ar === "تنشيف");
STATE.profile = { goal: "muscle-gain", posture: ["apt"] };
check("B: getBrand reads STATE (muscle + apt)", getBrand().ar === "تضخيم + تصحيح ميل الحوض", getBrand().ar);
STATE.profile = { goal: "bogus", posture: ["bogus", "apt"] };
check("B: junk goal ignored, junk posture dropped", getPostureFocus().join() === "apt" && getBrand().ar === "تصحيح ميل الحوض");

/* C. posture focus: validated, and drives which drills are picked */
reset();
check("C: no focus by default", getPostureFocus().length === 0);
check("C: activation count 2 without focus", activationCount() === 2);
for (const k of ["mobility", "activation"]) {
  for (const wtype of Object.keys(DATA[k])) {
    const pool = DATA[k][wtype];
    for (const focus of focusSets) {
      STATE.profile = { posture: focus };
      const max = k === "activation" ? activationCount() : 2;
      for (let n = 0; n < 60; n++) {
        const pick = pickPrep(pool, max);
        check(`C: ${k}/${wtype} focus[${focus}] returns ${Math.min(max, pool.length)} items`, pick.length === Math.min(max, pool.length));
        check(`C: ${k}/${wtype} no duplicates`, new Set(pick.map((p) => p.en)).size === pick.length);
        check(`C: ${k}/${wtype} picks come from the pool`, pick.every((p) => pool.includes(p)));
        if (focus.length) {
          // whenever the pool has enough items for the focus, none of the picks may serve ONLY a problem the person did not choose
          const ok = pool.filter((p) => {
            const t = postureTagsOf(p);
            return !t.length || t.some((x) => focus.includes(x));
          });
          if (ok.length >= pick.length) {
            check(`C: ${k}/${wtype} focus[${focus}] never picks an unrelated-posture drill`, pick.every((p) => {
              const t = postureTagsOf(p);
              return !t.length || t.some((x) => focus.includes(x));
            }), pick.map((p) => p.en).join(","));
          }
        }
      }
    }
  }
}
STATE.profile = { posture: ["apt"] };
check("C: activation count 3 with a focus", activationCount() === 3);
// the person's problem is actually trained on the days that can train it
for (const [wtype, focus] of [["full", "apt"], ["lower", "apt"], ["full", "rounded-shoulders"], ["upper", "rounded-shoulders"]]) {
  STATE.profile = { posture: [focus] };
  const hit = Array.from({ length: 40 }, () => pickPrep(DATA.activation[wtype], 3)).every((p) => p.some((x) => postureTagsOf(x).includes(focus)));
  check(`C: ${wtype} day activation always has a ${focus} drill`, hit);
}
STATE.profile = { posture: [] };
const counts = {};
for (let n = 0; n < 400; n++) pickPrep(DATA.activation.full, 2).forEach((p) => (counts[p.en] = (counts[p.en] || 0) + 1));
check("C: no focus still rotates through the whole pool (old behaviour)", Object.keys(counts).length === DATA.activation.full.length, Object.keys(counts).length);

/* D. cool-down ordering never drops or invents a stretch */
for (const wtype of Object.keys(DATA.coolDown)) {
  for (const focus of focusSets) {
    STATE.profile = { posture: focus };
    const out = orderByFocus(DATA.coolDown[wtype]);
    check(`D: coolDown/${wtype} focus[${focus}] same stretches`, out.length === DATA.coolDown[wtype].length && new Set(out).size === out.length);
  }
}
STATE.profile = { posture: ["apt"] };
check("D: hip-flexor stretch comes before chest stretch for APT", (() => {
  const out = orderByFocus(DATA.coolDown.full).map((x) => x.en);
  return out.indexOf("Kneeling Hip Flexor Stretch") < out.indexOf("Doorway Chest Stretch");
})());
STATE.profile = { posture: [] };
check("D: no focus keeps the original order", orderByFocus(DATA.coolDown.full).map((x) => x.en).join() === DATA.coolDown.full.map((x) => x.en).join());

/* E. program recommendation always lands on a real program with the right frequency */
for (const g of GOALS) for (const e of ["beginner", "intermediate", "advanced"]) for (const d of [3, 6]) {
  const r = recommendProgram({ goal: g.key, experience: e, days: d });
  check(`E: ${g.key}/${e}/${d} -> real program`, !!PROGRAMS[r.programId], r.programId);
  check(`E: ${g.key}/${e}/${d} -> ${d} days/week`, PROGRAMS[r.programId] && PROGRAMS[r.programId].daysPerWeek === d);
  check(`E: ${g.key}/${e}/${d} has a reason`, typeof r.reason === "string" && r.reason.length > 10);
}

/* F. first-run detection never interrupts someone with existing data */
reset();
check("F: empty install shows setup", needsOnboarding() === true && !STATE.onboarding);
for (const [name, seed] of [
  ["sets", { sets: { "day1-main-0": { 0: true } } }],
  ["history", { history: { "day1-main-0": [{ volume: 100 }] } }],
  ["schedule", { schedule: { programId: "ppl3" } }],
  ["profile goal", { profile: { goal: "strength" } }],
]) {
  reset();
  Object.assign(STATE, seed);
  check(`F: existing user (${name}) is not interrupted`, needsOnboarding() === false);
  check(`F: existing user (${name}) is flagged legacy`, STATE.onboarding && STATE.onboarding.done && STATE.onboarding.legacy);
}
reset();
Object.assign(STATE, { sets: { a: { 0: true } } });
needsOnboarding();
check("F: legacy user without a goal keeps the old header line", getBrand().ar === "تضخيم + تصحيح القوام");
STATE.profile = { goal: "fat-loss" };
check("F: legacy user who then picks a goal gets the new line", getBrand().ar === "تنشيف");
reset();
STATE.onboarding = { done: true, skipped: true };
check("F: skipped setup stays done", needsOnboarding() === false);
check("F: skipped setup shows the neutral default", getBrand().en === DEFAULT_BRAND.en);

/* G. goal note + finisher */
reset();
check("G: no goal note by default", goalNoteHtml() === "");
check("G: no finisher by default", wantsFinisher() === false);
for (const g of GOALS) {
  STATE.profile = { goal: g.key, posture: [] };
  check(`G: ${g.key} renders a goal note`, goalNoteHtml().includes(GOAL_PROFILES[g.key].reps));
  check(`G: ${g.key} finisher matches profile`, wantsFinisher() === GOAL_PROFILES[g.key].finisher);
}
STATE.profile = { goal: "muscle-gain", posture: ["apt", "rounded-shoulders"] };
check("G: goal note names the posture focus", goalNoteHtml().includes("ميل الحوض") && goalNoteHtml().includes("انحناء الكتفين"));

/* H. every posture option has drills tagged for it in all three blocks that use them */
for (const k of postureKeys) {
  for (const block of ["mobility", "activation", "coolDown"]) {
    const any = Object.values(DATA[block]).flat().some((x) => postureTagsOf(x).includes(k));
    check(`H: ${block} has at least one ${k} drill`, any);
  }
}

console.log(`validate-goals: ${passed} passed, ${failed.length} failed`);
if (failed.length) {
  failed.slice(0, 40).forEach((f) => console.log("  FAIL: " + f));
  process.exit(1);
}
