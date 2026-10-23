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
import { initNavigation, renderPage, getCurrentTab } from "./modules/navigation.js";
import { toggleCardOpen, toggleGroupOpen } from "./modules/ui.js";
import { pageDay, pageTracker, toggleSet, updateLog, saveSession, resetDay } from "./modules/workout.js";
import { pageRecovery, toggleCheck, updateFatigue } from "./modules/recovery.js";
import { pageNutrition, calcProtein, calcCalories, calcHydration } from "./modules/nutrition.js";
import { pageInjury } from "./modules/injury.js";
import { openGym, exitGym, markSetDone, startGymTimer, gymNext, gymPrev, isGymModeActive, handleGymKeydown } from "./modules/timer.js";
import {
  pageExercises,
  toggleFavoriteExercise,
  toggleOnlyFavoritesFilter,
  toggleOnlyMyEquipmentFilter,
  setExerciseFilter,
  updateExerciseSearch,
  updateExerciseSelectFilter,
  viewExerciseById,
} from "./modules/exercises.js";
import { pageCorrective, openConditionLibrary, backToConditionPicker } from "./modules/corrective.js";
import { pageMetrics, saveMetricsForm, deleteMetricEntry } from "./modules/metrics.js";
import { pageDashboard } from "./modules/dashboard.js";
import { pageProgram, setProgramFrequency, setProgramSplit, toggleProgramDay, resetProgramSchedule, getPlanFor } from "./modules/program.js";
import { pageSupport } from "./modules/support.js";
import { pageProfile, setProfileSingle, toggleProfileMulti, updateProfileField } from "./modules/profile.js";
import { pageSettings, setTheme, setLang, resetAllData, applyTheme, toggleNotifications } from "./modules/settings.js";
import { handleAdaptiveAction } from "./modules/adaptive-ui.js";
import { ALL_DAY_KEYS } from "./modules/schedule.js";
import { loginWithGoogle, logout, syncToCloud, initAuthWatcher } from "./modules/sync.js";
import { analyzeInBodyImage } from "./modules/ocr.js";
import { needsOnboarding, applyBrand } from "./modules/goals.js";
import { openOnboarding, obSelect, obMulti, obNext, obBack, obSkip, obFinish, handleOnboardingKeydown } from "./modules/onboarding.js";
import { flattenHistory, localISODate } from "./modules/progress.js";
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
  settings: pageSettings,
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

/* ---------------- SIDE DRAWER ---------------- */
function toggleDrawer() {
  const drawer = document.getElementById("sideDrawer");
  if (!drawer) return;
  const isOpen = !drawer.hidden;
  drawer.hidden = isOpen;
  if (!isOpen) updateDrawerProfile();
}

function closeDrawer() {
  const drawer = document.getElementById("sideDrawer");
  if (drawer) drawer.hidden = true;
}

function updateDrawerProfile() {
  const p = STATE.profile || {};
  const nameEl = document.getElementById("drawerUserName");
  const levelEl = document.getElementById("drawerUserLevel");
  const avatarEl = document.querySelector(".profile-avatar");
  const syncBtn = document.querySelector(".google-sync-btn");

  if (nameEl) nameEl.textContent = p.name || "User Name";
  if (levelEl) levelEl.textContent = p.experience ? p.experience.charAt(0).toUpperCase() + p.experience.slice(1) : "Intermediate";
  if (avatarEl) {
    if (p.avatar) {
      avatarEl.innerHTML = `<img src="${p.avatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
    } else {
      avatarEl.textContent = "AI";
    }
  }

  if (syncBtn) {
    const user = firebase.auth().currentUser;
    if (user) {
      syncBtn.dataset.action = "auth-logout";
      syncBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-2.08 5.28-7.84 5.28-4.68 0-8.48-3.8-8.48-8.52s3.8-8.52 8.48-8.52c2.64 0 4.68 1.12 6.04 2.44l2.6-2.6C18.8 1.32 15.56 0 12.48 0 6.56 0 2 5.56 2 11.48s4.56 11.48 10.48 11.48c6.12 0 10.56-4.44 10.56-10.56 0-.72-.08-1.36-.2-2H12.48z"/></svg> Logged In <span class="nav-ar">مسجل دخول</span>`;
    } else {
      syncBtn.dataset.action = "auth-login";
      syncBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-2.08 5.28-7.84 5.28-4.68 0-8.48-3.8-8.48-8.52s3.8-8.52 8.48-8.52c2.64 0 4.68 1.12 6.04 2.44l2.6-2.6C18.8 1.32 15.56 0 12.48 0 6.56 0 2 5.56 2 11.48s4.56 11.48 10.48 11.48c6.12 0 10.56-4.44 10.56-10.56 0-.72-.08-1.36-.2-2H12.48z"/></svg> Sync with Google <span class="nav-ar">مزامنة مع جوجل</span>`;
    }
  }
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
  "save-macro-entry": () => {
    import("./modules/nutrition.js").then(m => m.saveMacroEntry());
  },
  "set-macro-goal": () => {
    import("./modules/nutrition.js").then(m => m.setMacroGoal());
  },
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
  "alt-view": (el) => {
    viewExerciseById(el.dataset.id);
    closeAltSheet();
  },
  "alt-back": () => backToAltList(),
  "alt-confirm": () => confirmAltReplacement(),
  "profile-set-single": (el) => setProfileSingle(el.dataset.field, el.dataset.value),
  "profile-toggle-multi": (el) => toggleProfileMulti(el.dataset.field, el.dataset.value),
  "ob-select": (el) => obSelect(el.dataset.field, el.dataset.value),
  "ob-multi": (el) => obMulti(el.dataset.field, el.dataset.value),
  "ob-next": () => obNext(),
  "ob-back": () => obBack(),
  "ob-skip": () => obSkip(),
  "ob-finish": () => obFinish(),
  "ob-reopen": () => openOnboarding(refreshAfterSetup),
  "metric-save": () => saveMetricsForm(),
  "metric-delete": (el) => {
    deleteMetricEntry(el.dataset.id);
    const sec = document.getElementById("sec-metrics");
    if (sec) sec.innerHTML = pageMetrics();
  },
  "save-inbody": () => {
    import("./modules/progress.js").then(m => {
      const entry = {
        dateISO: document.getElementById("ibDate").value,
        weight: parseFloat(document.getElementById("ibWeight").value) || 0,
        muscle: parseFloat(document.getElementById("ibMuscle").value) || 0,
        fat: parseFloat(document.getElementById("ibFat").value) || 0,
      };
      m.saveInBodyEntry(entry);
      window.dispatchEvent(new CustomEvent("render-current-page"));
    });
  },
  "delete-inbody": (el) => {
    import("./modules/progress.js").then(m => {
      m.deleteInBodyEntry(el.dataset.date);
      window.dispatchEvent(new CustomEvent("render-current-page"));
    });
  },
  "adaptive-set": (el) => {
    const dayKey = el.closest(".adaptive-checkin")?.dataset.day ||
                   (el.closest("main section")?.id?.replace("sec-", "") || "unknown");
    handleAdaptiveAction("adaptive-set", dayKey, el.dataset.value, el.dataset.field);
    renderPage(getCurrentTab());
  },
  "adaptive-reset": (el) => {
    handleAdaptiveAction("adaptive-reset", el.dataset.day);
    renderPage(getCurrentTab());
  },
  "drawer-open": () => toggleDrawer(),
  "drawer-close": () => closeDrawer(),
  "set-theme": (el) => setTheme(el.dataset.value),
  "set-lang": (el) => setLang(el.dataset.value),
  "toggle-notifications": () => toggleNotifications(),
  "reset-app": () => resetAllData(),
  "auth-login": async () => {
    try {
      await loginWithGoogle();
      updateDrawerProfile();
    } catch (e) {
      alert("Login failed. Please try again.");
    }
  },
  "auth-logout": async () => {
    await logout();
    updateDrawerProfile();
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
    if (el) {
      handleAction(el);
    } else if (e.target.closest("#menuBtn")) {
      toggleDrawer();
    } else if (e.target.closest("[data-drawer-link]")) {
      const link = e.target.closest("a");
      const tab = link.getAttribute("href").slice(1);
      renderPage(tab);
      closeDrawer();
    }
  });

  // Keyboard activation (Enter/Space) for the custom role="button" /
  // role="checkbox" controls (div-based toggles need this manually;
  // real <button> elements already get it for free from the browser).
  // The alternatives sheet is modal: while it is open it owns Esc and Tab.
  // Gym Mode is modal too (Phase 6): when no sheet is on top of it, it keeps Tab inside.
  document.addEventListener("keydown", (e) => {
    if (handleOnboardingKeydown(e) || handleAltKeydown(e) || handleGymKeydown(e)) e.stopImmediatePropagation();
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

/* ---------------- FIRST-RUN SETUP ---------------- */
/** After the setup closes, redraw whatever page is open so it reflects the new goal/program. */
function refreshAfterSetup() {
  renderPage(getCurrentTab());
}

/* ---------------- REMINDERS ---------------- */
async function checkDailyReminder() {
  const s = STATE.settings || {};
  if (!s.notifications) return;

  const now = new Date();
  const todayISO = localISODate(now);
  const plan = getPlanFor(now);

  // Only remind if today is a training day and no sessions have been logged today yet
  if (plan && plan.training) {
    const trainedToday = flattenHistory().some(r => r.dateISO === todayISO);
    if (!trainedToday) {
      if (Notification.permission === "granted") {
        new Notification("وقت التمرين! 🏋️", {
          body: `اليوم عندك ${plan.label} — يلا ابدأ تمرينك دلوقتي!`,
          icon: "icons/favicon.ico"
        });
      }
    }
  }
}

/* ---------------- BOOT ---------------- */
(async function boot() {
  await initStore();
  const hadFlag = !!(STATE.onboarding && STATE.onboarding.done);
  const showSetup = needsOnboarding(); // existing users are marked done here, never interrupted
  if (!hadFlag && !showSetup) persistImmediately(STATE); // one silent write to remember the legacy flag
  onPersist(flashSaveMessage); // registered after, so boot itself never flashes "اتحفظ"
  applyBrand();
  applyTheme();
  wireGlobalEvents();
  initNavigation(PAGES);
  initAlternativesUI();
  registerServiceWorker();
  if (showSetup) openOnboarding(refreshAfterSetup);

  // Check for daily workout reminder
  checkDailyReminder();
})();

// Expose specific profile helpers to window for inline HTML handlers
import { updateProfileAvatar as _upa } from "./modules/profile.js";
window.updateProfileAvatar = _upa;

window.handleInBodyUpload = async (input) => {
  const file = input.files[0];
  if (!file) return;

  const statusEl = document.getElementById("ocrStatus");
  if (statusEl) {
    statusEl.style.display = "block";
    statusEl.textContent = "جاري تحليل الصورة... يرجى الانتظار";
  }

  try {
    const results = await analyzeInBodyImage(file);
    if (results) {
      alert(`تم استخراج البيانات بنجاح:\nالوزن: ${results.weight || "غير معروف"} كجم\nالعضلات: ${results.muscle || "غير معروف"} كجم\nالدهون: ${results.fat || "غير معروف"} %`);
    } else {
      alert("لم يتم العثور على بيانات واضحة في الصورة. يرجى التأكد من جودة الصورة.");
    }
  } catch (e) {
    console.error(e);
    alert("حدث خطأ أثناء تحليل الصورة. يرجى المحاولة مرة أخرى.");
  } finally {
    if (statusEl) statusEl.style.display = "none";
  }
};
