#!/usr/bin/env node
/**
 * validate-schedule.mjs — Phase 2 checks (no dependencies)
 * Run from the project root:  node tools/validate-schedule.mjs
 *
 * Covers: program/day data integrity, PPL muscle-group sanity, and the
 * weekly-schedule logic in js/modules/schedule.js (defaults, switching
 * programs, toggling days, corrupt saved state, and that none of it
 * touches workout sets / logs / history).
 */
import { DATA } from "../js/modules/data.js";
import { EXERCISES } from "../js/modules/exercises-data.js";
import { STATE } from "../js/modules/store.js";
import * as S from "../js/modules/schedule.js";

let pass = 0;
const failures = [];
function check(name, cond, detail = "") {
  if (cond) pass++;
  else failures.push(`${name}${detail ? " — " + detail : ""}`);
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const libById = new Map(EXERCISES.map((e) => [e.id, e]));

/* ---------- 1. program + day data integrity ---------- */
for (const p of Object.values(S.PROGRAMS)) {
  check(`${p.id}: dayKeys.length === daysPerWeek`, p.dayKeys.length === p.daysPerWeek);
  check(`${p.id}: shortLabels match dayKeys`, p.shortLabels.length === p.dayKeys.length);
  check(`${p.id}: no duplicate days`, new Set(p.dayKeys).size === p.dayKeys.length);
}
for (const key of S.ALL_DAY_KEYS) {
  const d = DATA[key];
  check(`${key}: exists in DATA`, !!d);
  if (!d) continue;
  check(`${key}: starts with "day" and has no hyphen`, /^day[A-Za-z0-9]+$/.test(key), "state keys are split on '-'");
  check(`${key}: has title with em-dash label`, typeof d.title === "string" && d.title.includes("—"));
  check(`${key}: warmupType is valid`, ["full", "upper", "lower"].includes(d.warmupType) && !!DATA.mobility[d.warmupType]);
  check(`${key}: has 4-8 main exercises`, d.main.length >= 4 && d.main.length <= 8, `${d.main.length}`);
  const seen = new Set();
  d.main.forEach((ex, i) => {
    check(`${key}[${i}]: id "${ex.id}" is in library`, libById.has(ex.id));
    check(`${key}[${i}]: has sets/rest/cue/why`, !!(ex.sets && ex.rest && ex.cue && ex.why));
    check(`${key}[${i}]: sets parse as N×...`, /^\d+×/.test(ex.sets), ex.sets);
    check(`${key}[${i}]: no duplicate exercise in a day`, !seen.has(ex.id));
    seen.add(ex.id);
  });
}

/* ---------- 2. PPL muscle-group sanity ---------- */
const ALLOWED = {
  push: new Set(["chest", "shoulders", "triceps"]),
  pull: new Set(["back", "biceps", "shoulders", "traps", "forearms"]),
  legs: new Set(["quads", "hamstrings", "glutes", "calves", "core"]),
};
const sets = (s) => parseInt(String(s).match(/^(\d+)/)[1], 10);
const splitSets = { push: 0, pull: 0, legs: 0 };
for (const key of S.PROGRAMS.ppl6.dayKeys) {
  const d = DATA[key];
  check(`${key}: has split tag`, ["push", "pull", "legs"].includes(d.split));
  check(`${key}: split tag matches key`, key.toLowerCase().includes(d.split));
  d.main.forEach((ex) => {
    const g = libById.get(ex.id).group;
    check(`${key}: ${ex.id} (${g}) belongs on a ${d.split} day`, ALLOWED[d.split].has(g));
    splitSets[d.split] += sets(ex.sets);
  });
}
check("ppl6: pull volume >= push volume (posture-friendly)", splitSets.pull >= splitSets.push, JSON.stringify(splitSets));
check("ppl6: every major muscle trained twice per week", (() => {
  const count = {};
  for (const key of S.PROGRAMS.ppl6.dayKeys) {
    new Set(DATA[key].main.map((e) => libById.get(e.id).group)).forEach((g) => (count[g] = (count[g] || 0) + 1));
  }
  return ["chest", "back", "shoulders", "quads", "hamstrings", "glutes", "calves", "biceps", "triceps"].every((g) => count[g] >= 2);
})());
check("ppl3 days are the A sessions of ppl6", eq(S.PROGRAMS.ppl3.dayKeys, S.PROGRAMS.ppl6.dayKeys.slice(0, 3)));
check("original day1..day3 untouched (17 main lifts total)", ["day1", "day2", "day3"].reduce((n, k) => n + DATA[k].main.length, 0) === 17);

/* ---------- 3. schedule logic ---------- */
const reset = () => { for (const k of Object.keys(STATE)) delete STATE[k]; };

reset();
check("default program is fullbody", S.getActiveProgramId() === "fullbody");
check("default day keys = day1..day3", eq(S.getActiveDayKeys(), ["day1", "day2", "day3"]));
check("default days/week = 3", S.getDaysPerWeek() === 3);
let plan = S.getWeekPlan();
check("week plan has 7 entries in Sat-first order", plan.length === 7 && plan[0].weekday === 6 && plan[6].weekday === 5);
check("default 3-day plan trains Sat/Mon/Wed", eq(plan.filter((e) => e.training).map((e) => e.weekday), [6, 1, 3]));
check("sessions assigned in order", eq(plan.filter((e) => e.training).map((e) => e.dayKey), ["day1", "day2", "day3"]));
check("default plan has no warnings", S.getScheduleWarnings().length === 0);

// a frozen snapshot of user workout data to prove nothing below touches it
STATE.sets = { "day1-main-0": { 0: true, 1: true } };
STATE.logs = { "day1-main-0-0-w": "80", "day1-main-0-0-r": "8" };
STATE.history = { "day1-main-0": [{ date: "x", dateISO: "2026-09-01", dayKey: "day1", volume: 640, best1rm: 101, name: "Back Squat" }] };
const snapshot = JSON.stringify({ s: STATE.sets, l: STATE.logs, h: STATE.history });

check("setDaysPerWeek(5) is rejected", S.setDaysPerWeek(5) === false && S.getActiveProgramId() === "fullbody");
check("setDaysPerWeek(6) switches to ppl6", S.setDaysPerWeek(6) === true && S.getActiveProgramId() === "ppl6");
check("ppl6 has 6 day keys", S.getActiveDayKeys().length === 6 && S.getDaysPerWeek() === 6);
plan = S.getWeekPlan();
check("default 6-day plan = Sat..Thu, Fri rest", eq(plan.map((e) => e.training), [true, true, true, true, true, true, false]));
check("6-day labels Push A..Legs B", eq(plan.filter((e) => e.training).map((e) => e.label), ["Push A", "Pull A", "Legs A", "Push B", "Pull B", "Legs B"]));
check("legacy programDaysPerWeek kept in step", STATE.programDaysPerWeek === 6);
check("setDaysPerWeek(3) returns to fullbody by default", S.setDaysPerWeek(3) === true && S.getActiveProgramId() === "fullbody");
check("setProgram(ppl3) works", S.setProgram("ppl3") === true && eq(S.getActiveDayKeys(), ["dayPushA", "dayPullA", "dayLegsA"]));
S.setDaysPerWeek(6);
S.setDaysPerWeek(3);
check("3-day split is remembered after visiting 6-day", S.getActiveProgramId() === "ppl3");
check("setProgram(unknown) rejected", S.setProgram("bogus") === false && S.getActiveProgramId() === "ppl3");
check("setProgram(same) reports no change", S.setProgram("ppl3") === false);

// toggling
check("toggle on a full plan is refused", S.toggleTrainingDay(0) === "full");
check("toggle off removes a day", S.toggleTrainingDay(6) === "removed" && eq(S.getTrainingDays(), [1, 3]));
check("incomplete plan: isScheduleComplete false", S.isScheduleComplete() === false);
check("incomplete plan: info warning mentions the gap", S.getScheduleWarnings().some((w) => w.level === "info"));
plan = S.getWeekPlan();
check("incomplete plan: first sessions still assigned", plan.filter((e) => e.training).length === 2);
check("toggle on adds a day (kept in week order)", S.toggleTrainingDay(5) === "added" && eq(S.getTrainingDays(), [1, 3, 5]));
check("invalid weekday rejected", S.toggleTrainingDay(7) === "invalid" && S.toggleTrainingDay("abc") === "invalid" && S.toggleTrainingDay(-1) === "invalid");
check("3-day edits do not change the 6-day plan", eq(S.getTrainingDays(6), [6, 0, 1, 2, 3, 4]));
S.resetTrainingDays();
check("reset restores Sat/Mon/Wed", eq(S.getTrainingDays(3), [6, 1, 3]));

// fullbody adjacency advisory
S.setProgram("fullbody");
S.resetTrainingDays();
[6, 1, 3].forEach((d) => S.toggleTrainingDay(d)); // removes the three defaults
[6, 0, 2].forEach((d) => S.toggleTrainingDay(d)); // Sat, Sun, Tue -> Sat/Sun adjacent
check("fullbody on consecutive days warns", eq(S.getTrainingDays(), [6, 0, 2]) && S.getScheduleWarnings().some((w) => w.level === "warn"));
S.setProgram("ppl3");
check("ppl3 on consecutive days does not warn", !S.getScheduleWarnings().some((w) => w.level === "warn"));
check("Fri+Sat counts as adjacent for fullbody", (() => {
  S.setProgram("fullbody");
  S.resetTrainingDays();
  [6, 1, 3].forEach((d) => S.toggleTrainingDay(d)); // removes all three
  [5, 6, 2].forEach((d) => S.toggleTrainingDay(d));
  return S.getScheduleWarnings().some((w) => w.level === "warn");
})());

// getPlanFor
S.setProgram("ppl6");
S.resetTrainingDays();
const sat = new Date(2026, 9, 24); // Saturday 24 Oct 2026
const fri = new Date(2026, 9, 23); // Friday
check("getPlanFor(Saturday) = Push A", sat.getDay() === 6 && S.getPlanFor(sat).dayKey === "dayPushA");
check("getPlanFor(Friday) is a rest day", fri.getDay() === 5 && S.getPlanFor(fri).training === false);

// nothing above touched workout data
check("sets/logs/history untouched by schedule changes", JSON.stringify({ s: STATE.sets, l: STATE.logs, h: STATE.history }) === snapshot);

/* ---------- 4. corrupt / hostile saved state ---------- */
reset();
STATE.schedule = { programId: "bogus", trainingDays: { 3: [9, -1, "x", 2, 2, 2.5, null] } };
check("unknown programId falls back to fullbody", S.getActiveProgramId() === "fullbody");
check("garbage weekdays are sanitised", eq(S.getTrainingDays(3), [2]));
reset();
STATE.schedule = { programId: "ppl6", trainingDays: { 6: [0, 1, 2, 3, 4, 5, 6] } };
check("more days than allowed are truncated", S.getTrainingDays(6).length === 6);
reset();
STATE.schedule = "not-an-object";
check("non-object schedule state does not throw", S.getActiveProgramId() === "fullbody" && S.setProgram("ppl6") === true);
reset();
STATE.schedule = { programId: "ppl6", trainingDays: [1, 2, 3] };
check("wrong-shaped trainingDays falls back to defaults", eq(S.getTrainingDays(6), [6, 0, 1, 2, 3, 4]));

/* ---------- report ---------- */
if (failures.length) {
  console.error(`FAIL: ${failures.length} failed, ${pass} passed`);
  failures.forEach((f) => console.error("  ✗ " + f));
  process.exit(1);
}
console.log(`OK: ${pass}/${pass} checks passed`);
setTimeout(() => process.exit(0), 0);
