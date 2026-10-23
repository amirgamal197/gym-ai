/**
 * workout.js — Workout Pages & Tracking Logic
 * ---------------------------------------------------------------
 * Builds the Day 1-3 and Tracker pages (Home/Dashboard now lives in
 * dashboard.js, APT/posture content now lives in corrective.js), and
 * owns all set-tracking / weight-reps logging / session-history
 * behaviour those pages need (set checkboxes, saved logs, sessions).
 * ---------------------------------------------------------------
 */
import { DATA } from "./data.js";
import { EXERCISES } from "./exercises-data.js";
import { STATE, persist, localISODate } from "./store.js";
import { progressByExerciseHTML } from "./progress-ui.js";
import { exCard, stretchCard, groupBlock, backLink, formatHistoryEntry, epley1RM, setsCount, sparklineSVG } from "./ui.js";
import { renderRecommendationCard, renderDeloadNote, renderRPEInput, getSuggestedWeight } from "./progression.js";
import { icon } from "./icons.js";
import { getSlotRef, getSlotExerciseId, getReplacementInfo, isArchiveKey } from "./replacements.js";
import { pickPrep, orderByFocus, activationCount, getPostureFocus, goalNoteHtml, wantsFinisher } from "./goals.js";
import { buildAdaptiveWorkout } from "./adaptive-workout.js";
import { renderCheckIn, renderAdaptationNote } from "./adaptive-ui.js";

// NOTE (Phase 2): the old fixed `DAY_KEYS` export was replaced by
// schedule.js — `ALL_DAY_KEYS` (every day page that exists) and
// `getActiveDayKeys()` (the days of the currently selected program).
// Workout state keys ("<dayKey>-main-<i>") are unchanged.

/**
 * Merge a Workout Day's exercise reference (data.js `DayEx` — an `id`
 * plus this program's own sets/tempo/rest/rpe/coaching notes) with its
 * full identity record from the shared Exercise Library (exercises-data.js
 * EXERCISES) — name, muscle group, equipment, difficulty, and the
 * verified illustration link. This is the ONLY place that library lookup
 * happens, so the 3-Day Program and the Exercise Library page always show
 * the exact same name/illustration for a given exercise — nothing
 * duplicated or re-typed.
 *
 * `ref`'s own fields (sets, tempo, rest, rpe, cue, mistake, why, prog,
 * reg, stabilizers, vid) always win — they're this program's prescription,
 * not identity data, and the library doesn't carry them at all.
 */
export function resolveDayExercise(ref) {
  const lib = EXERCISES.find((e) => e.id === ref.id);
  if (!lib) {
    // Unknown/typo'd library id — render *something* identifiable instead
    // of crashing, so a bad id is easy to spot while testing rather than
    // silently blanking a whole day.
    return Object.assign({ en: ref.id || "؟ Unknown exercise", ar: "", primary: "", secondary: "" }, ref);
  }
  const merged = Object.assign({}, ref, {
    en: lib.en,
    ar: lib.ar,
    primary: lib.primary,
    secondary: lib.secondary,
    illustration: lib.illustration,
    gif: lib.gif,
    group: lib.group,
    equipment: lib.equipment,
    difficulty: lib.difficulty,
  });
  if (ref.replaced) {
    // A replacement (Phase 4, replacements.js) keeps the slot's sets/rest/RPE
    // but has no hand-written coaching of its own — use the library's.
    merged.cue = (lib.instructions || []).join(" ");
    merged.mistake = (lib.mistakes || [])[0] || "";
    merged.why = (lib.tips || [])[0] || "";
  }
  return merged;
}

/**
 * Resolved (library-merged) exercise list for one day — used by the Day
 * page, Gym Mode (timer.js), and anywhere else that needs full exercise
 * records rather than the raw id+prescription refs stored in DATA. */
export function resolveDayMain(dayKey) {
  return getActiveSlots(dayKey).map((entry) => ({
    ex: resolveDayExercise(entry),
    reasons: entry.reasons,
  }));
}

/** Get the current adapted list of exercises for a day, based on
 * user profile and daily energy/time settings. */
export function getActiveSlots(dayKey) {
  const d = DATA[dayKey];
  if (!d) return [];
  const slots = d.main.map((_, i) => ({
    index: i,
    ...getSlotRef(dayKey, i),
  }));
  const state = STATE.adaptive || {};
  const dayState = state.byDay?.[dayKey] || {};
  const result = buildAdaptiveWorkout({
    dayKey,
    slots,
    level: STATE.profile?.experience || "intermediate",
    energy: dayState.energy || "normal",
    time: dayState.time || state.defaultTime || "45-60",
    availableCategories: STATE.profile?.equipment || null,
  });

  // Persist accessories so getSlotRef can find them for tracking/history
  const extras = result.entries.filter((e) => e.source === "extra");
  if (extras.length) {
    STATE.adaptive = STATE.adaptive || {};
    STATE.adaptive.extras = STATE.adaptive.extras || {};
    STATE.adaptive.extras[dayKey] = STATE.adaptive.extras[dayKey] || {};
    const firstMainIdx = d.main.length;
    extras.forEach((e, i) => {
      STATE.adaptive.extras[dayKey][firstMainIdx + i] = e.id;
    });
    persist();
  }

  return result.entries;
}

/** The warm-up/mobility/activation items to run through for `dayKey` —
 * whatever was last shown on that Day page (see pageDay/lastPicks above),
 * or a fresh pick if the Day page hasn't rendered yet this session (e.g.
 * Gym Mode opened straight from a deep link). Used by Gym Mode (timer.js)
 * so its prep phase matches what the person just looked at. */
export function getDayPrep(dayKey) {
  if (lastPicks[dayKey]) return lastPicks[dayKey];
  const d = DATA[dayKey];
  const wtype = d && d.warmupType;
  return {
    warmup: pickFew(DATA.generalWarmup, 2),
    mobility: wtype ? pickPrep(DATA.mobility[wtype], 2) : [],
    activation: wtype ? pickPrep(DATA.activation[wtype], activationCount()) : [],
  };
}

/**
 * Turns a day's stored title ("اليوم الأول — Upper (V Taper)") into the
 * clean English program label ("Upper — V Taper") used across the new
 * Dashboard/Program UI. Purely derived from the existing DATA[dayKey]
 * title on every call — no separate hardcoded label list to keep in sync.
 */
export function programDayLabel(dayKey) {
  const d = DATA[dayKey];
  if (!d || !d.title) return dayKey;
  const parts = d.title.split("—");
  let label = parts.length > 1 ? parts.slice(1).join("—").trim() : d.title.trim();
  label = label.replace(/\s*\(([^)]+)\)\s*$/, " — $1");
  return label;
}

/* ---------------- PROGRESSION (derived from STATE.sets — no separate progress system) ---------------- */

/** How many of a main exercise's sets are ticked done right now. */
export function getExerciseCompletion(dayKey, idx) {
  const d = DATA[dayKey];
  const ex = d && getSlotRef(dayKey, idx);
  if (!ex) return { done: 0, total: 0 };
  const total = setsCount(ex.sets);
  const setsForKey = (STATE.sets && STATE.sets[dayKey + "-main-" + idx]) || {};
  const done = Object.values(setsForKey).filter(Boolean).length;
  return { done: Math.min(done, total), total };
}

export function isExerciseComplete(dayKey, idx) {
  const c = getExerciseCompletion(dayKey, idx);
  return c.total > 0 && c.done >= c.total;
}

/**
 * First incomplete main exercise in `dayKey`, searching forward from
 * `startIndex` and wrapping around (optionally skipping `excludeIndex`,
 * used right after that exercise was just marked Done). Returns
 * { index, ex } or null if every main exercise is complete.
 */
export function getNextIncompleteExercise(dayKey, startIndex, excludeIndex) {
  const slots = getActiveSlots(dayKey);
  if (!slots.length) return null;
  startIndex = startIndex || 0;
  excludeIndex = excludeIndex === undefined ? -1 : excludeIndex;
  const n = slots.length;
  for (let step = 0; step < n; step++) {
    const idx = (startIndex + step) % n;
    if (idx === excludeIndex) continue;
    if (!isExerciseComplete(dayKey, idx)) return { index: idx, ex: resolveDayExercise(slots[idx]) };
  }
  return null;
}

export function isDayComplete(dayKey) {
  return getNextIncompleteExercise(dayKey) === null;
}

function setCardOpen(key, open) {
  const card = document.getElementById("card-" + key);
  if (!card) return;
  card.classList.toggle("open", open);
  const head = card.querySelector('[data-action="toggle-card"]');
  if (head) head.setAttribute("aria-expanded", String(open));
}

/** Open + scroll to the next incomplete main exercise for `dayKey`, if any. Called on arrival at a day page. */
export function focusNextExercise(dayKey) {
  const sec = document.getElementById("sec-" + dayKey);
  if (!sec) return;
  const next = getNextIncompleteExercise(dayKey);
  if (!next) return;
  setCardOpen(dayKey + "-main-" + next.index, true);
  requestAnimationFrame(() => {
    const card = document.getElementById("card-" + dayKey + "-main-" + next.index);
    if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

/** Called right after the person presses "Done" on one exercise — moves on to the next incomplete one automatically. */
export function advanceToNextExercise(dayKey, fromIndex) {
  const sec = document.getElementById("sec-" + dayKey);
  if (!sec) return;
  setCardOpen(dayKey + "-main-" + fromIndex, false);
  const next = getNextIncompleteExercise(dayKey, fromIndex + 1, fromIndex);
  if (!next) {
    // Whole day done — full re-render shows the "day complete" state (see pageDay).
    sec.innerHTML = pageDay(dayKey);
    hydrateWorkoutUI();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  setCardOpen(dayKey + "-main-" + next.index, true);
  requestAnimationFrame(() => {
    const card = document.getElementById("card-" + dayKey + "-main-" + next.index);
    if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

/**
 * "Alternatives" button for one main-exercise card, plus a one-line note
 * when the slot currently runs a replacement (and which exercise it
 * replaced). The button only carries data-* attributes; alternatives-ui.js
 * owns the sheet that opens (see app.js `alt-open`).
 */
function slotToolsHtml(dayKey, index, ex) {
  const info = getReplacementInfo(dayKey, index);
  const orig = info.replaced ? EXERCISES.find((e) => e.id === info.originalId) : null;
  return `
    <div class="alt-row">
      <button type="button" class="alt-btn" data-action="alt-open" data-day="${dayKey}" data-index="${index}"
          aria-haspopup="dialog" aria-label="بدائل تمرين ${ex.en}">${icon("swap")} بدائل · Alternatives</button>
      ${
        info.replaced
          ? `<span class="swap-note">${icon("refresh")} بديل لـ <bdi>${orig ? orig.en : info.originalId}</bdi></span>`
          : ""
      }
    </div>`;
}

/** Re-render one day page in place after a replacement, keeping the same warm-up picks, then open + scroll to the changed card. */
export function refreshDayPage(dayKey, index) {
  const sec = document.getElementById("sec-" + dayKey);
  if (!sec) return false;
  sec.innerHTML = pageDay(dayKey, { keepPicks: true });
  hydrateWorkoutUI({ focus: false });
  if (index !== undefined) {
    setCardOpen(dayKey + "-main-" + index, true);
    const card = document.getElementById("card-" + dayKey + "-main-" + index);
    if (card) card.scrollIntoView({ block: "center" });
  }
  return true;
}

/* ---------------- PAGE: DAY 1 / 2 / 3 ---------------- */

/** Pick a small rotation (1-2 items) from a warm-up/mobility/activation
 * "library" pool instead of running through every item every time —
 * keeps pre-workout prep short so it doesn't eat into the energy/time
 * meant for the main lifts. Re-rolled fresh on each Day-page render
 * (non-mutating partial Fisher–Yates shuffle). */
function pickFew(pool, max = 2) {
  if (!pool || pool.length <= max) return pool || [];
  const copy = pool.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, max);
}

/** Most recently-shown warm-up/mobility/activation picks per day, so Gym
 * Mode (timer.js) runs through the exact same prep drills the person
 * just saw on the Day page instead of re-rolling a second random set —
 * see getDayPrep() below. */
const lastPicks = {};

export function pageDay(dayKey, opts = {}) {
  const d = DATA[dayKey];
  const wtype = d.warmupType;
  // `keepPicks` (used when one exercise is replaced) re-renders the page
  // without re-rolling the random warm-up/mobility/activation picks.
  const kept = opts.keepPicks && lastPicks[dayKey];
  const warmupPicks = kept ? kept.warmup : pickFew(DATA.generalWarmup, 2);
  // Mobility/activation follow the person's posture focus (goals.js); with no
  // focus chosen pickPrep is the same random pick as before.
  const mobilityPicks = kept ? kept.mobility : pickPrep(DATA.mobility[wtype], 2);
  const activationPicks = kept ? kept.activation : pickPrep(DATA.activation[wtype], activationCount());
  // Cardio finisher: only for goals that ask for it (fat loss / general fitness).
  const finisherPicks = kept && kept.finisher ? kept.finisher : wantsFinisher() ? pickFew(DATA.generalWarmup.filter((c) => !/Jump Rope/.test(c.en)), 1) : [];
  lastPicks[dayKey] = { warmup: warmupPicks, mobility: mobilityPicks, activation: activationPicks, finisher: finisherPicks };

  const cardioHtml = warmupPicks
    .map((c, i) => stretchCard(dayKey + "-cardio-" + i, i, c))
    .join("");
  const mobilityHtml = mobilityPicks.map((ex, i) => exCard(dayKey + "-mob-" + i, i, ex, { trackable: false })).join("");
  const activationHtml = activationPicks.map((ex, i) => exCard(dayKey + "-act-" + i, i, ex, { trackable: false })).join("");
  const mainHtml = resolveDayMain(dayKey)
    .map(({ ex, reasons }, i) => {
      const key = dayKey + "-main-" + i;
      const suggested = getSuggestedWeight(key, ex);
      return exCard(key, i, ex, {
        trackable: true,
        suggestedWeight: suggested,
        slotTools: slotToolsHtml(dayKey, i, ex),
        beforeSets: renderRecommendationCard(key, ex),
        afterLogs: renderRPEInput(key) + renderDeloadNote(key),
        adaptationNote: reasons.length ? renderAdaptationNote(reasons) : null,
      });
    })
    .join("");
  const finisherHtml = finisherPicks
    .map((c, i) =>
      stretchCard(dayKey + "-finisher-" + i, i, Object.assign({}, c, { dur: "10-15 دقيقة", note: "كارديو بسرعة ثابتة تقدر تكمل بيها بعد آخر تمرين. بيزوّد حرق السعرات من غير ما يضعف أوزانك." }))
    )
    .join("");
  const coolDownHtml = orderByFocus(DATA.coolDown[wtype])
    .map((c, i) => stretchCard(dayKey + "-cooldown-" + i, i, c))
    .join("");
  const dayComplete = isDayComplete(dayKey);

  return `
    ${backLink("Program · البرنامج", "program")}
    <div class="section-title">${programDayLabel(dayKey)}</div>
    ${goalNoteHtml()}
    ${dayComplete ? `<div class="day-complete-banner">${icon("check")} Day complete — خلصت كل تمارين اليوم ده</div>` : ""}
    <button class="save-session" type="button" style="margin-bottom:14px;background:var(--energy-grad-solid);color:#fff;border:none;"
        data-action="open-gym" data-day="${dayKey}">${icon("dumbbell")} ابدأ وضع الجيم لليوم ده</button>

    ${groupBlock(dayKey + "-cardio", `${icon("footprints")} إحماء عام (5-7 دقايق)`, "كارديو خفيف يرفع نبضك — حركة أو اتنين بس، مش كل الاختيارات", cardioHtml, true)}
    ${groupBlock(dayKey + "-mob", `${icon("stretch")} موبيليتي ديناميكي`, "يفتح مدى الحركة قبل التمرين الأساسي — حركة أو اتنين بس", mobilityHtml, true)}
    ${groupBlock(dayKey + "-act", `${icon("zap")} تنشيط عضلي`, getPostureFocus().length ? "مختارة عشان تخدم تصحيح قوامك قبل الحمل التقيل" : "ينشط العضلات المستهدفة قبل الحمل التقيل — حركة أو اتنين بس", activationHtml, true)}

    ${renderCheckIn(dayKey)}

    <div class="section-title">${icon("dumbbell")} التمارين الأساسية</div>
    ${mainHtml}

    ${finisherHtml ? groupBlock(dayKey + "-finisher", `${icon("flame")} كارديو ختامي`, "حسب هدفك: بعد التمارين الأساسية", finisherHtml, true) : ""}

    <button class="reset-btn" type="button" data-action="reset-day" data-day="${dayKey}">${icon("refresh")} إعادة تعيين علامات اليوم ده</button>

    ${groupBlock(dayKey + "-cooldown", `${icon("meditate")} إطالة ما بعد التمرين`, "10 دقايق إطالة ثابتة تساعد الاستشفاء", coolDownHtml, true)}
  `;
}

/* ---------------- PAGE: TRACKER ---------------- */
export function pageTracker() {
  let html = backLink();
  html += `<div class="top-note">كل تمرين أساسي في أي يوم من أيام البرنامج بيتسجل هنا لو حفظت الجلسة من صفحة اليوم. آخر 8 جلسات لكل تمرين في كل يوم بيتحفظوا على جهازك.</div>`;
  const hist = STATE.history || {};
  const keys = Object.keys(hist);
  if (keys.length === 0) {
    html += `<div class="rule-card"><p>لسه معملتش أي جلسة متسجلة. سجّل أول تمرين من أي يوم وهيظهر هنا.</p></div>`;
  } else {
    html += progressByExerciseHTML();
    keys.forEach((k) => {
      const entries = hist[k];
      if (!Array.isArray(entries) || !entries.length || !entries[entries.length - 1]) return; // corrupt/empty saved list: skip instead of crashing the page
      const last = entries[entries.length - 1];
      const volumes = entries.map((e) => parseFloat(e.volume) || 0);
      const spark = sparklineSVG(volumes);
      // % change from the oldest to the newest of the up-to-8 saved
      // sessions kept for this exercise — not a long-term trend line,
      // just "since the earliest session still on your device".
      const pctChange = volumes.length >= 2 && volumes[0] > 0 ? Math.round(((volumes[volumes.length - 1] - volumes[0]) / volumes[0]) * 100) : null;
      const trendChip =
        pctChange !== null
          ? `<div class="chip"><b>${icon(pctChange > 0 ? "arrow-up" : pctChange < 0 ? "arrow-down" : "target")} الاتجاه</b>${pctChange > 0 ? "+" : ""}${pctChange}% من أول جلسة متسجلة</div>`
          : "";
      // The same exercise can appear on several days (e.g. Back Squat in
      // Full Body A and in Legs A) and each keeps its own history, so
      // say which day this card belongs to.
      const histDayKey = k.split("-")[0];
      let histDayLabel = DATA[histDayKey] ? programDayLabel(histDayKey) : "";
      // Phase 4: history of an exercise that was swapped out of its slot is
      // kept under "<slotKey>~<exerciseId>" — label it so it is clear why it
      // is listed separately from the exercise now in that slot.
      if (isArchiveKey(k)) histDayLabel += (histDayLabel ? " · " : "") + "تمرين اتبدّل — سجله محفوظ";
      html += `<div class="rule-card">
        <h3>${last.name}</h3>
        ${histDayLabel ? `<div class="sub-note" style="margin:-4px 0 8px;">${histDayLabel}</div>` : ""}
        <div class="chip-grid">
          <div class="chip"><b>آخر حجم تمرين</b>${last.volume} كجم</div>
          <div class="chip"><b>أفضل 1RM تقديري</b>${last.best1rm} كجم</div>
          ${trendChip}
        </div>
        ${spark ? `<div class="tracker-spark">${spark}</div>` : ""}
        <div class="history-list">${entries.slice().reverse().map(formatHistoryEntry).join("<br>")}</div>
      </div>`;
    });
  }
  return html;
}

/* ---------------- TRACKING LOGIC ---------------- */

/** Recompute and render the volume/1RM stat line for one exercise card, from currently-typed (unsaved) log values. */
export function updateStatLine(container) {
  if (!container) return;
  const statEl = container.querySelector("[id^='stat-']");
  if (!statEl) return;
  const key = statEl.id.replace("stat-", "");
  let vol = 0,
    best = 0;
  const nSets = container.querySelectorAll(`[data-key="${key}"]`).length;
  for (let i = 0; i < nSets; i++) {
    const w = parseFloat((STATE.logs && STATE.logs[`${key}-${i}-w`]) || 0) || 0;
    const r = parseFloat((STATE.logs && STATE.logs[`${key}-${i}-r`]) || 0) || 0;
    vol += w * r;
    best = Math.max(best, epley1RM(w, r));
  }
  statEl.textContent = `حجم التمرين: ${Math.round(vol)} كجم · أفضل 1RM تقديري: ${best} كجم`;
}

/** Handle a set-box tap/keypress: toggle done state, persist, update aria. */
export function toggleSet(key, setIndex) {
  const box = document.querySelector(`.set-box[data-key="${key}"][data-set="${setIndex}"]`);
  if (!box) return;
  box.classList.toggle("done");
  const done = box.classList.contains("done");
  box.setAttribute("aria-pressed", String(done));
  STATE.sets = STATE.sets || {};
  STATE.sets[key] = STATE.sets[key] || {};
  STATE.sets[key][setIndex] = done;
  persist();
}

/** Handle typing in a weight/reps log input: store value, refresh stat line, persist (caller debounces). */
export function updateLog(logKey, value) {
  STATE.logs = STATE.logs || {};
  STATE.logs[logKey] = value;
  const input = document.querySelector(`[data-log="${logKey}"]`);
  if (input) updateStatLine(input.closest(".ex-body-inner"));
  persist();
}

/** Save the current session's volume/1RM into history for one exercise. */
export function saveSession(key, name) {
  const container = document.getElementById("card-" + key);
  if (!container) return;
  updateStatLine(container.querySelector(".ex-body-inner"));
  const statEl = document.getElementById("stat-" + key);
  const match = statEl.textContent.match(/حجم التمرين: ([\d.]+).*1RM تقديري: ([\d.]+)/);
  const volume = match ? match[1] : 0;
  const best1rm = match ? match[2] : 0;
  STATE.history = STATE.history || {};
  STATE.history[key] = STATE.history[key] || [];
  // `dateISO` (YYYY-MM-DD) is stored alongside the existing display-only
  // Arabic-formatted `date` so the Dashboard can reliably compute
  // days-trained/streak/last-workout without trying to re-parse a
  // localized string. Older history entries saved before this change
  // won't have `dateISO` and are simply skipped by those calculations
  // (no fabricated numbers) — see dashboard.js.
  const now = new Date();
  const slotParts = key.split("-");
  STATE.history[key].push({
    date: now.toLocaleDateString("ar-EG"),
    dateISO: localISODate(now),
    dayKey: slotParts[0],
    volume,
    best1rm,
    name,
    // Phase 4: which exercise was actually done in this slot (it can differ
    // from DATA when the person replaced it — see replacements.js).
    exerciseId: slotParts.length === 3 ? getSlotExerciseId(slotParts[0], parseInt(slotParts[2], 10)) : undefined,
  });
  if (STATE.history[key].length > 8) STATE.history[key].shift();
  persist();
  const histEl = document.getElementById("hist-" + key);
  if (histEl) histEl.innerHTML = STATE.history[key].slice().reverse().map(formatHistoryEntry).join("<br>");

  // "Done" was just pressed on this exercise — auto-advance to the next
  // incomplete one in the same day (existing DATA[dayKey].main order,
  // existing STATE.sets progress — no separate progression system).
  const parts = key.split("-");
  if (parts.length === 3 && parts[1] === "main" && DATA[parts[0]]) {
    advanceToNextExercise(parts[0], parseInt(parts[2], 10));
  }
}

/**
 * Called when Gym Mode (وضع الجيم) is run start-to-finish for a day.
 * Marks every set of every main exercise as done in STATE.sets — the
 * same flag the manual set-box taps use — and logs a history entry per
 * exercise (volume/1RM from whatever was typed on the Day page, 0 if
 * nothing was), so Track Progress / Dashboard days-trained / streak /
 * "Day complete" all pick it up immediately. This means finishing Gym
 * Mode is enough on its own — no need to also tap the "Done" button
 * under each exercise card afterwards.
 */
export function completeDayFromGym(dayKey) {
  const slots = getActiveSlots(dayKey);
  if (!slots.length) return;
  const now = new Date();
  const dateISO = localISODate(now);
  const dateAr = now.toLocaleDateString("ar-EG");
  STATE.sets = STATE.sets || {};
  STATE.history = STATE.history || {};
  slots.forEach((slot, i) => {
    const ex = resolveDayExercise(slot);
    const key = dayKey + "-main-" + slot.slotIndex;
    const total = setsCount(ex.sets);

    STATE.sets[key] = STATE.sets[key] || {};
    for (let s = 0; s < total; s++) STATE.sets[key][s] = true;

    let vol = 0,
      best = 0;
    for (let s = 0; s < total; s++) {
      const w = parseFloat((STATE.logs && STATE.logs[`${key}-${s}-w`]) || 0) || 0;
      const r = parseFloat((STATE.logs && STATE.logs[`${key}-${s}-r`]) || 0) || 0;
      vol += w * r;
      best = Math.max(best, epley1RM(w, r));
    }

    STATE.history[key] = STATE.history[key] || [];
    STATE.history[key].push({ date: dateAr, dateISO, dayKey, volume: vol, best1rm: best, name: ex.en, exerciseId: ex.id });
    if (STATE.history[key].length > 8) STATE.history[key].shift();
  });
  persist();
}

/** Clear every logged set-box for one day (does not clear logged weights/reps or history). */
export function resetDay(dayKey) {
  const n = getActiveSlots(dayKey).length;
  STATE.sets = STATE.sets || {};
  for (let i = 0; i < n; i++) {
    const key = dayKey + "-main-" + i;
    if (STATE.sets[key]) Object.keys(STATE.sets[key]).forEach((s) => (STATE.sets[key][s] = false));
  }
  persist();
  const sec = document.getElementById("sec-" + dayKey);
  if (sec) {
    // Full re-render (not just clearing set-box classes) so a stale
    // "day complete" banner and the auto-focused card both refresh too.
    sec.innerHTML = pageDay(dayKey);
    hydrateWorkoutUI();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

/**
 * Re-apply persisted STATE onto freshly-rendered DOM: set-box "done"
 * marks, saved log input values, computed stat lines, and saved
 * history lists. Safe to call after ANY page render — it's a no-op
 * on pages that don't contain these elements.
 */
export function hydrateWorkoutUI(opts = {}) {
  document.querySelectorAll(".set-box").forEach((box) => {
    const key = box.dataset.key,
      set = box.dataset.set;
    const done = !!(STATE.sets && STATE.sets[key] && STATE.sets[key][set]);
    box.classList.toggle("done", done);
    box.setAttribute("aria-pressed", String(done));
  });

  document.querySelectorAll("[data-log]").forEach((input) => {
    const k = input.dataset.log;
    if (STATE.logs && STATE.logs[k] !== undefined) input.value = STATE.logs[k];
  });

  document.querySelectorAll("[id^='stat-']").forEach((el) => {
    updateStatLine(el.closest(".ex-body-inner"));
  });

  document.querySelectorAll("[id^='hist-']").forEach((el) => {
    const key = el.id.replace("hist-", "");
    const entries = (STATE.history && STATE.history[key]) || [];
    el.innerHTML = entries.length ? entries.slice().reverse().map(formatHistoryEntry).join("<br>") : "";
  });

  // Landed on a day page — auto-open + scroll to the next incomplete
  // exercise, same rotation the Dashboard "Next Exercise" CTA points at.
  const daySection = opts.focus === false ? null : document.querySelector('main section[id^="sec-day"]');
  if (daySection) {
    const dayKey = daySection.id.replace("sec-", "");
    if (DATA[dayKey]) focusNextExercise(dayKey);
  }
}
