/**
 * app.js — Application Entry Point
 * ---------------------------------------------------------------
 * Composes every feature module, registers the single delegated
 * click / keydown / input listener that drives the whole app (no
 * inline `onclick="..."` anywhere — see ui.js for why), and boots
 * the app once saved state has loaded.
 * ---------------------------------------------------------------
 */
import { STATE, initStore, persistImmediately, onPersist } from "./modules/store.js";
import { initNavigation, renderPage } from "./modules/navigation.js";
import { toggleCardOpen, toggleGroupOpen } from "./modules/ui.js";
import { pageDay, pageTracker, toggleSet, updateLog, saveSession, resetDay } from "./modules/workout.js";
import { pageRecovery, toggleCheck, updateFatigue } from "./modules/recovery.js";
import { pageNutrition, calcProtein, calcCalories, calcHydration } from "./modules/nutrition.js";
import { pageInjury } from "./modules/injury.js";
import { openGym, exitGym, markSetDone, startGymTimer, gymNext, gymPrev, isGymModeActive } from "./modules/timer.js";
import {
  pageExercises,
  toggleFavoriteExercise,
  toggleOnlyFavoritesFilter,
  toggleOnlyMyEquipmentFilter,
  setExerciseFilter,
  updateExerciseSearch,
  updateExerciseSelectFilter,
} from "./modules/exercises.js";
import { pageCorrective, openConditionLibrary, backToConditionPicker } from "./modules/corrective.js";
import { pageMetrics, saveMetricsForm, deleteMetricEntry } from "./modules/metrics.js";
import { pageDashboard } from "./modules/dashboard.js";
import { pageProgram, setProgramFrequency, setProgramSplit, toggleProgramDay, resetProgramSchedule } from "./modules/program.js";
import { pageSupport } from "./modules/support.js";
import { pageProfile, setProfileSingle, toggleProfileMulti, updateProfileField } from "./modules/profile.js";
import { ALL_DAY_KEYS } from "./modules/schedule.js";
import {
  openAltSheet,
  closeAltSheet,
  setAltFilter,
  toggleAltMine,
  pickAltExercise,
  backToAltList,
  confirmAltReplacement,
  handleAltKeydown,
  isAltSheetOpen,
  initAlternativesUI,
} from "./modules/alternatives-ui.js";

const PAGES = {
  dashboard: pageDashboard,
  program: pageProgram,
  exercises: pageExercises,
  support: pageSupport,
  corrective: pageCorrective,
  tracker: pageTracker,
  recovery: pageRecovery,
  nutrition: pageNutrition,
  injury: pageInjury,
  metrics: pageMetrics,
  profile: pageProfile,
};
// Every workout day any program uses (day1..day3 Full Body, plus the PPL
// days dayPushA..dayLegsB) gets its own PAGES entry. The list lives in
// schedule.js PROGRAMS, so adding a day there + in data.js is enough.
ALL_DAY_KEYS.forEach((dayKey) => {
  PAGES[dayKey] = () => pageDay(dayKey);
});

/* ---------------- SAVE INDICATOR ---------------- */
let saveMsgTimer = null;
function flashSaveMessage() {
  const el = document.getElementById("saveMsg");
  if (!el) return;
  el.classList.add("show");
  clearTimeout(saveMsgTimer);
  saveMsgTimer = setTimeout(() => el.classList.remove("show"), 900);
}

/* ---------------- ACTION DISPATCH ----------------
 * Every clickable custom control in the app renders with
 * data-action="..." (see ui.js / workout.js / recovery.js /
 * nutrition.js / timer.js templates). This one table replaces the
 * original prototype's ~15 separate inline onclick handlers.
 */
const ACTIONS = {
  "toggle-card": (el) => toggleCardOpen(el.dataset.key),
  "toggle-group": (el) => toggleGroupOpen(el.dataset.group),
  "toggle-set": (el) => toggleSet(el.dataset.key, el.dataset.set),
  "save-session": (el) => saveSession(el.dataset.key, el.dataset.name),
  "open-gym": (el) => openGym(el.dataset.day),
  "reset-day": (el) => resetDay(el.dataset.day),
  "toggle-check": (el) => toggleCheck(el.dataset.check),
  "calc-protein": () => calcProtein(),
  "calc-calories": () => calcCalories(),
  "calc-hydration": () => calcHydration(),
  "gym-exit": () => exitGym(),
  "gym-set-done": () => markSetDone(),
  "gym-start-timer": (el) => startGymTimer(parseInt(el.dataset.seconds, 10)),
  "gym-prev": () => gymPrev(),
  "gym-next": () => gymNext(),
  "ex-toggle-favorite": (el) => toggleFavoriteExercise(el.dataset.id),
  "ex-toggle-fav-filter": () => toggleOnlyFavoritesFilter(),
  "ex-toggle-my-equipment": () => toggleOnlyMyEquipmentFilter(),
  "ex-filter": (el) => setExerciseFilter(el.dataset.type, el.dataset.value),
  "corrective-open": (el) => openConditionLibrary(el.dataset.condition),
  "corrective-back": () => backToConditionPicker(),
  "program-set-frequency": (el) => setProgramFrequency(el.dataset.days),
  "program-set-split": (el) => setProgramSplit(el.dataset.program),
  "program-toggle-day": (el) => toggleProgramDay(el.dataset.weekday),
  "program-reset-schedule": () => resetProgramSchedule(),
  "alt-open": (el) => openAltSheet(el),
  "alt-close": () => closeAltSheet(),
  "alt-filter": (el) => setAltFilter(el.dataset.cat),
  "alt-toggle-mine": () => toggleAltMine(),
  "alt-pick": (el) => pickAltExercise(el.dataset.id),
  "alt-back": () => backToAltList(),
  "alt-confirm": () => confirmAltReplacement(),
  "profile-set-single": (el) => setProfileSingle(el.dataset.field, el.dataset.value),
  "profile-toggle-multi": (el) => toggleProfileMulti(el.dataset.field, el.dataset.value),
  "metric-save": () => saveMetricsForm(),
  "metric-delete": (el) => {
    deleteMetricEntry(el.dataset.id);
    const sec = document.getElementById("sec-metrics");
    if (sec) sec.innerHTML = pageMetrics();
  },
};

function handleAction(el) {
  const action = el.dataset.action;
  const fn = ACTIONS[action];
  if (fn) fn(el);
}

function wireGlobalEvents() {
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    handleAction(el);
  });

  // Keyboard activation (Enter/Space) for the custom role="button" /
  // role="checkbox" controls (div-based toggles need this manually;
  // real <button> elements already get it for free from the browser).
  // The alternatives sheet is modal: while it is open it owns Esc and Tab.
  document.addEventListener("keydown", (e) => {
    if (handleAltKeydown(e)) e.stopImmediatePropagation();
  }, true);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
    const el = e.target.closest('[data-action][role="button"], [data-action][role="checkbox"]');
    if (!el) return;
    e.preventDefault();
    handleAction(el);
  });

  // Debounced weight/reps log inputs (matches the original 400ms feel).
  const logDebounce = new WeakMap();
  let exerciseSearchDebounce = null;
  document.addEventListener("input", (e) => {
    const target = e.target;
    if (target.matches && target.matches("[data-log]")) {
      clearTimeout(logDebounce.get(target));
      const t = setTimeout(() => updateLog(target.dataset.log, target.value), 400);
      logDebounce.set(target, t);
    } else if (target.matches && target.matches("[data-profile-field]")) {
      clearTimeout(logDebounce.get(target));
      const t = setTimeout(() => updateProfileField(target.dataset.profileField, target.value), 400);
      logDebounce.set(target, t);
    } else if (target.id === "fatigueSlider") {
      updateFatigue(target.value);
    } else if (target.id === "exerciseSearch") {
      clearTimeout(exerciseSearchDebounce);
      exerciseSearchDebounce = setTimeout(() => updateExerciseSearch(target.value), 250);
    }
  });

  // Exercise library equipment/difficulty filter dropdowns.
  document.addEventListener("change", (e) => {
    const target = e.target;
    if (target.id === "exEquipmentFilter" || target.id === "exDifficultyFilter") {
      updateExerciseSelectFilter(target.id, target.value);
    }
  });

  // Flush any pending debounced save immediately if the person leaves
  // or backgrounds the app — avoids losing the last few keystrokes.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") persistImmediately(STATE);
  });
  window.addEventListener("pagehide", () => persistImmediately(STATE));

  // Esc closes Gym Mode as a convenience/safety exit.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isGymModeActive() && !isAltSheetOpen()) exitGym();
  });
}

/* ---------------- SERVICE WORKER (offline support) ---------------- */
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  // Only register over HTTPS or on localhost — avoids noisy console
  // errors when opened directly from disk (file://) during development.
  const isLocalhost = ["localhost", "127.0.0.1"].includes(location.hostname);
  if (location.protocol !== "https:" && !isLocalhost) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((err) => {
      console.error("[app] service worker registration failed:", err);
    });
  });
}

/* ---------------- BOOT ---------------- */
(async function boot() {
  await initStore();
  onPersist(flashSaveMessage);
  wireGlobalEvents();
  initNavigation(PAGES);
  initAlternativesUI();
  registerServiceWorker();
})();
