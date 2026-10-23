#!/usr/bin/env node
/**
 * validate-progress.mjs — Phase 5 checks (no dependencies)
 * Run from the project root:  node tools/validate-progress.mjs
 * Covers progress.js: Saturday-start weeks, local dates, exercise-id tracking across
 * swaps/days, per-key/day dedupe, partial entries, legacy entries, corrupt data,
 * personal records, and the calendar-aware "today" state; plus progress-ui.js output.
 */
import { DATA } from "../js/modules/data.js";
import { STATE, localISODate } from "../js/modules/store.js";
import * as P from "../js/modules/progress.js";
import * as UI from "../js/modules/progress-ui.js";

let pass = 0;
const failures = [];
const check = (n, c, d = "") => (c ? pass++ : failures.push(n + (d ? " — " + d : "")));
const reset = (seed = {}) => {
  Object.keys(STATE).forEach((k) => delete STATE[k]);
  Object.assign(STATE, JSON.parse(JSON.stringify(seed)));
};
const e = (dateISO, o = {}) => ({ date: dateISO, dateISO, dayKey: "day1", volume: 1000, best1rm: 100, name: "X", ...o });
const SAT = new Date(2026, 9, 24, 12), FRI = new Date(2026, 9, 23, 12), SUN = new Date(2026, 9, 25, 12);

// ---- dates
check("0: test dates are Sat/Fri/Sun", SAT.getDay() === 6 && FRI.getDay() === 5 && SUN.getDay() === 0);
check("1: weekStart(Fri) is the previous Saturday", localISODate(P.weekStart(FRI)) === "2026-10-17");
check("2: weekStart(Sat) is that Saturday", localISODate(P.weekStart(SAT)) === "2026-10-24");
check("3: weekStart(Sun) is the day before", localISODate(P.weekStart(SUN)) === "2026-10-24");
check("4: local date is not shifted at 00:30 (UTC bug fixed)", localISODate(new Date(2026, 9, 24, 0, 30)) === "2026-10-24" && localISODate(new Date(2026, 9, 24, 23, 59)) === "2026-10-24");

// ---- exercise tracking
reset({
  history: {
    "day1-main-0": [e("2026-10-01", { exerciseId: "back-squat", name: "Back Squat", volume: 1000, best1rm: 100 }), e("2026-10-08", { exerciseId: "back-squat", name: "Back Squat", volume: 1100, best1rm: 110 })],
    "day1-main-0~back-squat": [e("2026-10-15", { exerciseId: "back-squat", name: "Back Squat", volume: 900, best1rm: 90, partial: true, setsDone: 2 })],
    "dayLegsA-main-0": [e("2026-10-16", { dayKey: "dayLegsA", exerciseId: "back-squat", name: "Back Squat", volume: 1300, best1rm: 120 })],
    "day1-main-1": [e("2026-10-02", { exerciseId: "leg-press", name: "Leg Press" }), e("2026-10-02", { exerciseId: "leg-press", name: "Leg Press", volume: 2000, best1rm: 150 })],
    "day1-main-2": [{ date: "old", volume: "500", best1rm: "50", name: "Legacy" }],
  },
});
const prog = P.getExerciseProgress();
const sq = prog.find((p) => p.id === "back-squat");
check("5: one curve for the exercise across slot, archive key and another day", sq && sq.entryCount === 4 && sq.dayKeys.length === 2);
check("6: partial entry excluded from the volume trend", sq.sessions.length === 3 && sq.trend.every((s) => !s.partial));
check("7: best 1RM comes from the full session (120)", sq.best.best1rm === 120);
check("8: change % uses first→last non-partial (1000→1300 = +30)", sq.changePct === 30, String(sq.changePct));
check("9: newest session is a PR", sq.latestIsPR === true);
const lp = prog.find((p) => p.id === "leg-press");
check("10: same key + same date counted once, latest wins", lp.entryCount === 1 && lp.best.best1rm === 150);
const legacy = prog.find((p) => p.id === (DATA.day1.main[2] && DATA.day1.main[2].id));
check("11: legacy entry (no exerciseId, no dateISO) resolves to the slot's original exercise", !!legacy && legacy.entryCount === 1 && legacy.best.best1rm === 50);
check("12: sorted most recent first", prog[0].id === "back-squat");

// partial counts for PR
reset({ history: { "day1-main-0": [e("2026-10-01", { exerciseId: "a", best1rm: 100 })], "day1-main-0~a": [e("2026-10-05", { exerciseId: "a", best1rm: 130, partial: true })] } });
check("13: partial work still counts for the personal record", P.getPersonalRecords()[0].best1rm === 130);

// records
reset({ history: { "day1-main-0": [e("2026-10-01", { exerciseId: "a", name: "A", best1rm: 100 }), e("2026-10-09", { exerciseId: "a", name: "A", best1rm: 90 })], "day1-main-1": [e("2026-10-10", { exerciseId: "b", name: "B", best1rm: 80 })] } });
const prs = P.getPersonalRecords();
check("14: PR is the best value, not the latest", prs.find((r) => r.id === "a").best1rm === 100);
check("15: no 'new PR' when the latest is lower; single-session exercise is not flagged", !prs.find((r) => r.id === "a").isNew && !prs.find((r) => r.id === "b").isNew);
check("16: records limited and ordered by date", P.getPersonalRecords(1).length === 1 && P.getPersonalRecords(1)[0].id === "b");

// ---- weekly
reset({ history: { "day1-main-0": [e("2026-10-23", { exerciseId: "a", volume: 500 }), e("2026-10-24", { exerciseId: "a", volume: 700 })], "day1-main-1": [e("2026-10-23", { exerciseId: "b", volume: 300 })] } });
const wk = P.getWeeklyStats(3, SAT);
check("17: 3 weeks, oldest→newest, last is current", wk.length === 3 && wk[2].current && !wk[0].current);
check("18: Friday belongs to the previous week, Saturday starts a new one", wk[1].volume === 800 && wk[1].sessions === 1 && wk[2].volume === 700 && wk[2].sessions === 1, JSON.stringify(wk));
check("19: sessionsThisWeek(Sat) = 1, sessionsThisWeek(Fri) = 1", P.sessionsThisWeek(SAT) === 1 && P.sessionsThisWeek(FRI) === 1);
check("20: weeks are 7 days apart", wk.every((w) => (P.parseISO(w.endISO) - P.parseISO(w.startISO)) / 86400000 === 6));

// ---- today (default schedule: Full Body, Sat/Mon/Wed)
reset({});
let t = P.getTodayState(SAT);
check("21: Saturday is a training day: Full A, not done", t.status === "train" && t.dayKey === "day1" && !t.doneToday && !t.inProgress, JSON.stringify(t));
check("22: next session is Monday, 2 days ahead", t.next && t.next.dayKey === "day2" && t.next.daysAhead === 2);
t = P.getTodayState(SUN);
check("23: Sunday is a rest day with next = Full B tomorrow+1", t.status === "rest" && t.next.dayKey === "day2" && t.next.daysAhead === 1);
reset({ sets: { "day1-main-0": { 0: true } } });
check("24: ticked sets → in progress", P.getTodayState(SAT).inProgress === true);
reset({ history: { "day1-main-0": [e("2026-10-24", { exerciseId: "a" })] } });
t = P.getTodayState(SAT);
check("25: history entry today for today's day → done", t.doneToday === true && !t.inProgress);
reset({ history: { "day2-main-0": [e("2026-10-24", { dayKey: "day2" })] } });
check("26: a different day trained today does not mark today's session done", P.getTodayState(SAT).doneToday === false);
reset({ history: { "day2-main-0": [e("2026-10-25", { dayKey: "day2" })] } });
t = P.getTodayState(SUN);
check("27: rest day with an off-schedule workout is reported", t.status === "rest" && t.trainedToday === true);
reset({ schedule: { programId: "fullbody", trainingDays: { 3: [] } } });
check("28: no training days → status none, no throw", P.getTodayState(SAT).status === "none");
reset({ schedule: { programId: "ppl6" } });
t = P.getTodayState(new Date(2026, 9, 29, 12)); // Thursday, 6th session
check("29: 6-day PPL Thursday = Legs B, next is Saturday (Push A)", t.status === "train" && t.dayKey === "dayLegsB" && t.next.dayKey === "dayPushA" && t.next.daysAhead === 2, JSON.stringify(t));

// ---- corrupt data never throws
const bad = [{ history: "x" }, { history: [] }, { history: { a: "x", b: [null, 5, "z", {}], c: [{ dateISO: "nope", volume: "abc" }] } }, { history: null, sets: 5, schedule: "q" }];
let threw = false;
for (const seed of bad) {
  reset(seed);
  try {
    P.getExerciseProgress(); P.getPersonalRecords(); P.getWeeklyStats(8); P.getTodayState(SAT);
    UI.progressByExerciseHTML(); UI.weeklyBarsHTML(); UI.recentRecordsHTML();
  } catch (err) { threw = true; failures.push("30: corrupt state threw: " + err.message); }
}
check("30: corrupt saved history/sets/schedule never throws", !threw);

// ---- UI output
reset({ history: { "day1-main-0": [e("2026-10-01", { exerciseId: "a", name: "A <b>", best1rm: 100 }), e("2026-10-08", { exerciseId: "a", name: "A <b>", best1rm: 110, volume: 1200 })] } });
const html = UI.progressByExerciseHTML();
check("31: chart is an image with a text alternative and a data table", /role="img" aria-label="[^"]*A &lt;b&gt;/.test(html) && html.includes("<table") && html.includes('scope="col"'));
check("32: names are escaped", !html.includes("A <b>"));
check("33: LTR chart, y-axis min/max labels present", html.includes("direction:ltr") && html.includes(">110<") && html.includes(">100<"));
check("34: single session → note instead of a chart", (() => { reset({ history: { "day1-main-0": [e("2026-10-01", { exerciseId: "a" })] } }); const h = UI.progressByExerciseHTML(); return !h.includes("pg-chart\"") && h.includes("جلستين"); })());
reset({});
check("35: empty state renders nothing", UI.progressByExerciseHTML() === "" && UI.weeklyBarsHTML() === "" && UI.recentRecordsHTML() === "");
reset({ history: { "day1-main-0": [e(localISODate(new Date()), { exerciseId: "a", volume: 2500 })] } });
const bars = UI.weeklyBarsHTML(8);
check("36: weekly bars: group label, hidden table, 8 columns", bars.includes('role="group"') && bars.includes('class="sr-only"') && (bars.match(/pg-bar-col/g) || []).length >= 8);

console.log(failures.length ? `FAIL: ${failures.length} failed, ${pass} passed\n` + failures.map((f) => "  ✗ " + f).join("\n") : `OK: ${pass}/${pass} checks passed`);
process.exit(failures.length ? 1 : 0);
