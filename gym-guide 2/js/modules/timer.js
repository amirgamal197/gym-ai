/**
 * timer.js — Gym Mode (guided workout runner + rest timer)
 * ---------------------------------------------------------------
 * Full-screen, big-button, guided runner that walks through a day in
 * order: general warm-up → mobility → activation → the main lifts
 * (with their set-by-set rest timer). Lives in its own overlay outside
 * the SPA's #mainContent so it survives independent of page navigation
 * while active.
 *
 * Gym Mode is organised into PHASES (see openGym): each phase has a
 * `kind` ("warmup" | "mobility" | "activation" | "main") and an ordered
 * `items` list. Only the "main" phase has multiple sets + a rest timer
 * per item — warm-up/mobility/activation are single-pass, one tap each,
 * since they're brief prep, not working sets that need recovery.
 * ---------------------------------------------------------------
 */
import { setsCount, illustrationLink } from "./ui.js";
import { resolveDayMain, completeDayFromGym, getDayPrep } from "./workout.js";
import { icon } from "./icons.js";
import { renderPage, getCurrentTab } from "./navigation.js";

const PHASE_META = {
  warmup: { label: "إحماء عام", icon: "footprints" },
  mobility: { label: "موبيليتي ديناميكي", icon: "stretch" },
  activation: { label: "تنشيط عضلي", icon: "zap" },
  main: { label: "التمارين الأساسية", icon: "dumbbell" },
};

const gymState = {
  dayKey: null,
  phases: [], // [{ kind, items }] — built fresh by openGym()
  phaseIdx: 0,
  itemIdx: 0,
  setIdx: 0, // only meaningful while phases[phaseIdx].kind === "main"
  timerInterval: null,
  timeLeft: 0,
  finished: false,
  opener: null, // element that opened Gym Mode — gets focus back on exit
};

let els = {}; // cached DOM refs, populated on first use
let inertEls = []; // background elements made inert while Gym Mode is open

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function cacheEls() {
  els = {
    overlay: document.getElementById("gymOverlay"),
    body: document.getElementById("gymBody"),
    progressBar: document.getElementById("gymProgressBar"),
    pct: document.getElementById("gymPct"),
    status: document.getElementById("gymStatus"),
  };
}

/* ---- focus management (Phase 6) ----------------------------------
 * Gym Mode is a modal dialog: the page behind it is `inert`, focus moves
 * in on open, is kept inside by handleGymKeydown (Tab / Shift+Tab wrap),
 * survives step re-renders, and goes back to the opener on exit. */
function setBackgroundInert(on) {
  if (on) {
    // Skip anything already inert so we never un-inert somebody else's element.
    inertEls = Array.from(document.body.children).filter(
      (el) =>
        !["gymOverlay", "altSheet", "altToast", "saveMsg"].includes(el.id) &&
        el.tagName !== "SCRIPT" &&
        !el.hasAttribute("inert")
    );
    inertEls.forEach((el) => el.setAttribute("inert", ""));
  } else {
    inertEls.forEach((el) => el.removeAttribute("inert"));
    inertEls = [];
  }
}

function visibleFocusables() {
  if (!els.overlay) return [];
  return Array.from(els.overlay.querySelectorAll(FOCUSABLE)).filter((n) => n.getClientRects().length > 0);
}

function announce(text) {
  if (!els.status) return;
  // Clear first so repeating the same text is announced again.
  els.status.textContent = "";
  setTimeout(() => {
    if (els.status) els.status.textContent = text;
  }, 30);
}

function focusTitle() {
  const t = els.body && els.body.querySelector(".gym-ex-title");
  if (t) t.focus({ preventScroll: true });
}

/** Keyboard handling while Gym Mode is open. Returns true when the key was consumed.
 * Tab / Shift+Tab are kept inside the overlay. (Esc is handled in app.js.) The
 * alternatives sheet, when open on top of Gym Mode, owns the keyboard instead. */
export function handleGymKeydown(e) {
  if (!isGymModeActive() || document.body.classList.contains("alt-open")) return false;
  if (e.key !== "Tab") return false;
  const f = visibleFocusables();
  if (!f.length) return false;
  const first = f[0];
  const last = f[f.length - 1];
  const ae = document.activeElement;
  if (!els.overlay.contains(ae)) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
    return true;
  }
  if (e.shiftKey && ae === first) {
    e.preventDefault();
    last.focus();
    return true;
  }
  if (!e.shiftKey && ae === last) {
    e.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

export function isGymModeActive() {
  return !!(els.overlay && els.overlay.classList.contains("active"));
}

function currentPhase() {
  return gymState.phases[gymState.phaseIdx];
}
function currentItem() {
  const phase = currentPhase();
  return phase ? phase.items[gymState.itemIdx] : null;
}

export function openGym(dayKey) {
  if (!els.overlay) cacheEls();
  const prep = getDayPrep(dayKey);
  gymState.dayKey = dayKey;
  gymState.phases = [
    { kind: "warmup", items: prep.warmup || [] },
    { kind: "mobility", items: prep.mobility || [] },
    { kind: "activation", items: prep.activation || [] },
    { kind: "main", items: resolveDayMain(dayKey) },
  ].filter((p) => p.items.length);
  gymState.phaseIdx = 0;
  gymState.itemIdx = 0;
  gymState.setIdx = 0;
  gymState.finished = false;
  const ae = document.activeElement;
  gymState.opener = ae && ae !== document.body ? ae : null;
  setBackgroundInert(true);
  els.overlay.classList.add("active");
  if (document.documentElement.requestFullscreen) {
    try {
      document.documentElement.requestFullscreen();
    } catch (e) {
      /* fullscreen not permitted (e.g. iOS Safari) — ignore, overlay still works */
    }
  }
  renderGymStep({ focus: "title" });
}

/**
 * Called after an exercise was replaced while Gym Mode is running (see
 * alternatives-ui.js): re-reads the day's main exercises so the runner shows
 * the replacement, and restarts that exercise's set counter at set 1 (the
 * replacement has no completed sets of its own). Other exercises, and the
 * person's position in the session, are left alone.
 */
export function refreshGymAfterReplace(dayKey, index) {
  if (!isGymModeActive() || gymState.dayKey !== dayKey) return;
  const main = gymState.phases.find((p) => p.kind === "main");
  if (!main) return;
  main.items = resolveDayMain(dayKey);
  const phase = currentPhase();
  if (phase && phase.kind === "main" && gymState.itemIdx === index) gymState.setIdx = 0;
  renderGymStep();
}

export function exitGym() {
  clearInterval(gymState.timerInterval);
  if (!els.overlay) cacheEls();
  els.overlay.classList.remove("active");
  setBackgroundInert(false);
  if (document.exitFullscreen && document.fullscreenElement) document.exitFullscreen();
  // Re-render whatever page is underneath so a day just finished in Gym
  // Mode (set-boxes, "Day complete" banner, Dashboard stats) shows up
  // immediately instead of waiting for the next manual navigation.
  if (gymState.finished) {
    renderPage(getCurrentTab());
    gymState.finished = false;
  }
  // Give keyboard focus back to what opened Gym Mode (or the page, if that
  // button was re-rendered by the refresh above).
  const opener = gymState.opener;
  gymState.opener = null;
  const target = opener && opener.isConnected ? opener : document.getElementById("mainContent");
  if (target && target.focus) {
    if (target.id === "mainContent") target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }
}

/** The three coaching boxes (styled like the Exercise Library page) for
 * one exercise: cue → "طريقة الأداء الصحيحة" (green), mistake → "غلط
 * شائع" (red), why → "نصيحة" (blue). Shared by every phase — warm-up,
 * mobility, and activation items carry the exact same cue/mistake/why
 * fields as the main lifts (see data.js Ex()/DayEx()). */
function coachingBoxesHtml(ex) {
  const boxes = [];
  if (ex.cue) boxes.push(`<div class="why">${icon("clipboard")} <b>طريقة الأداء الصحيحة:</b> ${ex.cue}</div>`);
  if (ex.mistake) boxes.push(`<div class="mistake">${icon("alert-triangle")} <b>غلط شائع:</b> ${ex.mistake}</div>`);
  if (ex.why) boxes.push(`<div class="tip">${icon("lightbulb")} <b>نصيحة:</b> ${ex.why}</div>`);
  return boxes.join("");
}

function phaseLabelHtml(phase) {
  const meta = PHASE_META[phase.kind] || {};
  return `<div class="gym-phase-label">${icon(meta.icon)} ${meta.label}</div>`;
}

function renderGymStep(opts = {}) {
  clearInterval(gymState.timerInterval);
  const phase = currentPhase();
  const item = currentItem();
  if (!phase || !item) return;

  // The step markup (and the Prev/Next bar) is rebuilt on every step, which
  // would drop keyboard focus. Remember where it was so we can put it back.
  const ae = document.activeElement;
  const hadFocusInside = !!(els.overlay && ae && els.overlay.contains(ae));
  const keepAction = hadFocusInside && ae.dataset && (ae.dataset.action === "gym-prev" || ae.dataset.action === "gym-next") ? ae.dataset.action : null;

  const pct = Math.round((stepsBefore() / totalSteps()) * 100);
  els.progressBar.style.width = pct + "%";
  els.pct.textContent = pct + "%";

  if (phase.kind === "warmup") {
    // Cardio item: {en, ar, dur, note} — no sets/rest, single tap moves on.
    els.body.innerHTML = `
      ${phaseLabelHtml(phase)}
      <div class="gym-ex-title" tabindex="-1" role="heading" aria-level="2">${item.en}</div>
      <div class="gym-ex-sub">${item.ar} · ${item.dur}</div>
      <div class="link-row">${illustrationLink(item)}</div>
      ${item.note ? `<div class="tip">${icon("lightbulb")} ${item.note}</div>` : ""}
      ${item.neglected ? `<div class="tip">${icon("lightbulb")} <b>عضلة بتتهمل غالبًا:</b> ${item.neglected}</div>` : ""}
      <button class="gym-big-btn start" type="button" id="gymSetBtn" data-action="gym-set-done">${icon("check")} خلصت — التالي</button>
    `;
    refreshNav();
    restoreFocus(opts, hadFocusInside, keepAction, item, phase);
    return;
  }

  if (phase.kind === "mobility" || phase.kind === "activation") {
    // Prep drill: one pass, no rest-timer sub-loop.
    els.body.innerHTML = `
      ${phaseLabelHtml(phase)}
      <div class="gym-ex-title" tabindex="-1" role="heading" aria-level="2">${item.en}</div>
      <div class="gym-ex-sub">${item.ar} · ${item.sets}</div>
      <div class="link-row">${illustrationLink(item)}</div>
      ${coachingBoxesHtml(item)}
      ${item.neglected ? `<div class="tip">${icon("lightbulb")} <b>عضلة بتتهمل غالبًا:</b> ${item.neglected}</div>` : ""}
      <button class="gym-big-btn start" type="button" id="gymSetBtn" data-action="gym-set-done">${icon("check")} خلصت — التالي</button>
    `;
    refreshNav();
    restoreFocus(opts, hadFocusInside, keepAction, item, phase);
    return;
  }

  // "main" — full set × rest-timer flow, same as before.
  const nSets = setsCount(item.sets);
  els.body.innerHTML = `
    ${phaseLabelHtml(phase)}
    <div class="gym-ex-title" tabindex="-1" role="heading" aria-level="2">${item.en}</div>
    <div class="gym-ex-sub">${item.ar} · سيت ${gymState.setIdx + 1} من ${nSets} · ${item.sets}</div>
    <div class="alt-row">
      <button type="button" class="alt-btn" data-action="alt-open" data-day="${gymState.dayKey}" data-index="${gymState.itemIdx}"
          aria-haspopup="dialog" aria-label="بدائل تمرين ${item.en}">${icon("swap")} بدائل · Alternatives</button>
      ${item.replaced ? `<span class="swap-note">${icon("refresh")} تمرين بديل</span>` : ""}
    </div>
    ${coachingBoxesHtml(item)}
    <button class="gym-big-btn start" type="button" id="gymSetBtn" data-action="gym-set-done">${icon("check")} خلصت السيت — ابدأ الراحة</button>
    <div id="gymTimerBox" style="display:none;">
      <div class="gym-timer" id="gymTimerDisplay" role="timer" aria-label="وقت الراحة المتبقي بالثواني" tabindex="-1">60</div>
      <div class="gym-timer-opts">
        <button type="button" data-action="gym-start-timer" data-seconds="30">30 ث</button>
        <button type="button" data-action="gym-start-timer" data-seconds="60">60 ث</button>
        <button type="button" data-action="gym-start-timer" data-seconds="90">90 ث</button>
        <button type="button" data-action="gym-start-timer" data-seconds="120">120 ث</button>
        <button type="button" data-action="gym-start-timer" data-seconds="180">180 ث</button>
      </div>
    </div>
  `;
  refreshNav();
  restoreFocus(opts, hadFocusInside, keepAction, item, phase);
}

/** After a step render: keep focus on Prev/Next if that is where the person was
 * (so Enter, Enter, Enter walks through the session), else move it to the exercise
 * title (screen readers read the new step). Never steals focus from outside the
 * overlay (e.g. the alternatives sheet). */
function restoreFocus(opts, hadFocusInside, keepAction, item, phase) {
  if (opts.focus !== "title" && !hadFocusInside) return;
  if (keepAction) {
    const btn = els.overlay.querySelector(`.gym-nav [data-action="${keepAction}"]`);
    if (btn) {
      btn.focus({ preventScroll: true });
      const sets = phase.kind === "main" ? ` · سيت ${gymState.setIdx + 1} من ${setsCount(item.sets)}` : "";
      announce(`${item.en}${sets}`);
      return;
    }
  }
  focusTitle();
}

function refreshNav() {
  const navHtml = `
    <div class="gym-nav">
      <button type="button" data-action="gym-prev">${icon("arrow-left")} السابق</button>
      <button type="button" data-action="gym-next">التالي ${icon("arrow-right")}</button>
    </div>`;
  els.overlay.querySelectorAll(".gym-nav").forEach((n) => n.remove());
  els.overlay.insertAdjacentHTML("beforeend", navHtml);
}

/** Called when the person taps "خلصت" / "خلصت السيت". Main-phase items
 * reveal the rest-timer choices; prep-phase items (warm-up/mobility/
 * activation) just move straight on to the next step. */
export function markSetDone() {
  const phase = currentPhase();
  const item = currentItem();
  if (!phase || !item) return;

  if (phase.kind !== "main") {
    advanceStep();
    return;
  }

  const timerBox = document.getElementById("gymTimerBox");
  const setBtn = document.getElementById("gymSetBtn");
  if (!timerBox || !setBtn) return;
  const hadFocus = document.activeElement === setBtn;
  timerBox.style.display = "block";
  setBtn.style.display = "none";
  const restSec = parseInt((item.rest || "90").match(/\d+/)?.[0] || 90, 10);
  startGymTimer(restSec);
  // The button that had focus is now hidden: move focus to the timer and say so once
  // (the countdown itself is not a live region — that would read out every second).
  if (hadFocus) {
    const disp = document.getElementById("gymTimerDisplay");
    if (disp) disp.focus({ preventScroll: true });
  }
  announce(`بدأت الراحة — ${restSec} ثانية`);
}

export function startGymTimer(sec) {
  clearInterval(gymState.timerInterval);
  gymState.timeLeft = sec;
  const disp = document.getElementById("gymTimerDisplay");
  if (!disp) return;
  disp.textContent = String(sec);
  gymState.timerInterval = setInterval(() => {
    gymState.timeLeft--;
    if (gymState.timeLeft <= 0) {
      clearInterval(gymState.timerInterval);
      disp.textContent = "0";
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      advanceStep();
    } else {
      disp.textContent = String(gymState.timeLeft);
    }
  }, 1000);
}

/** Total number of steps across the whole session — prep-phase items
 * count as 1 step each, "main" items count as however many sets they
 * have, so the progress bar reflects real work done, not just exercise
 * count. */
function totalSteps() {
  let n = 0;
  gymState.phases.forEach((phase) => {
    if (phase.kind === "main") {
      phase.items.forEach((it) => (n += setsCount(it.sets)));
    } else {
      n += phase.items.length;
    }
  });
  return n;
}

/** How many steps (sets/items) come before the current one — used for
 * the top progress bar. */
function stepsBefore() {
  let n = 0;
  for (let i = 0; i < gymState.phaseIdx; i++) {
    const p = gymState.phases[i];
    if (p.kind === "main") {
      p.items.forEach((it) => (n += setsCount(it.sets)));
    } else {
      n += p.items.length;
    }
  }
  const phase = currentPhase();
  if (phase.kind === "main") {
    for (let i = 0; i < gymState.itemIdx; i++) n += setsCount(phase.items[i].sets);
    n += gymState.setIdx;
  } else {
    n += gymState.itemIdx;
  }
  return n;
}

function lastSetIdx(phase, itemIdx) {
  if (phase.kind !== "main") return 0;
  return setsCount(phase.items[itemIdx].sets) - 1;
}

/** Called once the day's very last step is done — marks the whole day
 * complete in Track Progress / Dashboard automatically (see
 * completeDayFromGym in workout.js). */
function finishGym() {
  gymState.finished = true;
  completeDayFromGym(gymState.dayKey);
  els.body.innerHTML = `<div style="text-align:center;margin-top:60px;">
    <div style="font-size:3rem;" aria-hidden="true">${icon("party", { size: "1em" })}</div>
    <div class="gym-ex-title" tabindex="-1" role="heading" aria-level="2">خلصت اليوم كله!</div>
    <div class="gym-ex-sub">اتسجل في تتبع التقدم تلقائي ${icon("check")}</div>
    </div>`;
  els.progressBar.style.width = "100%";
  els.pct.textContent = "100%";
  refreshNav();
  if (els.overlay.contains(document.activeElement) || document.activeElement === document.body) focusTitle();
}

/** Advance by one step: one set for "main" items, or straight to the
 * next item for prep phases — moving on to the next phase (or finishing
 * the day) once the current phase's items are all done. Used by both
 * the rest timer running out and tapping "التالي" manually. */
function advanceStep() {
  const phase = currentPhase();
  if (!phase) return;

  if (phase.kind === "main") {
    const item = currentItem();
    const nSets = setsCount(item.sets);
    gymState.setIdx++;
    if (gymState.setIdx < nSets) {
      renderGymStep();
      return;
    }
    gymState.setIdx = 0;
  }

  gymState.itemIdx++;
  if (gymState.itemIdx >= phase.items.length) {
    gymState.itemIdx = 0;
    gymState.phaseIdx++;
    if (gymState.phaseIdx >= gymState.phases.length) {
      finishGym();
      return;
    }
  }
  renderGymStep();
}

export function gymNext() {
  if (gymState.finished) return; // already on the finishing screen
  advanceStep();
}

export function gymPrev() {
  if (gymState.finished) {
    // Return to the LAST step of the LAST phase, not the first.
    gymState.finished = false;
    gymState.phaseIdx = gymState.phases.length - 1;
    const phase = currentPhase();
    gymState.itemIdx = phase.items.length - 1;
    gymState.setIdx = lastSetIdx(phase, gymState.itemIdx);
    renderGymStep();
    return;
  }

  const phase = currentPhase();
  if (phase.kind === "main" && gymState.setIdx > 0) {
    gymState.setIdx--;
    renderGymStep();
    return;
  }

  if (gymState.itemIdx > 0) {
    gymState.itemIdx--;
    gymState.setIdx = lastSetIdx(phase, gymState.itemIdx);
    renderGymStep();
    return;
  }

  if (gymState.phaseIdx > 0) {
    gymState.phaseIdx--;
    const prevPhase = currentPhase();
    gymState.itemIdx = prevPhase.items.length - 1;
    gymState.setIdx = lastSetIdx(prevPhase, gymState.itemIdx);
    renderGymStep();
  }
}
