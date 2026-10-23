/**
 * navigation.js — Tab Navigation & Page Rendering
 * ---------------------------------------------------------------
 * Owns the <nav> tab bar and the #mainContent SPA render cycle.
 *
 * Improvements vs. the original:
 *  - The active tab is now reflected in the URL hash (#day1 etc.),
 *    so the browser/PWA back button and page refresh both keep you
 *    on the tab you were viewing, instead of always resetting to Home.
 *  - Phase 5: the bar is a plain navigation landmark with
 *    aria-current="page" on the active button (it switches pages, it is
 *    not a WAI-ARIA tab widget, so the tablist/tab/tabpanel roles — which
 *    promise arrow-key behaviour and a linked panel — were removed).
 *    Each page gets a real accessible name and document.title, and after
 *    a user-initiated navigation keyboard/screen-reader focus moves to
 *    the page content (not on the first load).
 *  - A small offline banner appears automatically when the network
 *    drops, since this is now an installable offline-capable PWA.
 * ---------------------------------------------------------------
 */
import { hydrateWorkoutUI } from "./workout.js";
import { hydrateRecoveryUI } from "./recovery.js";
import { hydrateExercisesUI } from "./exercises.js";
import { icon } from "./icons.js";

let PAGES = {};
let currentTab = "dashboard";
const DEFAULT_TAB = "dashboard";

const PAGE_TITLES = {
  dashboard: "الرئيسية",
  program: "البرنامج",
  exercises: "التمارين",
  support: "الدعم",
  tracker: "سجل التقدم",
  metrics: "القياسات الجسدية",
  profile: "البروفايل التدريبي",
};
const APP_TITLE = "Personal AI Trainer";

export function initNavigation(pages) {
  PAGES = pages;
  const nav = document.getElementById("tabs");
  nav.querySelectorAll("button").forEach((btn) => {
    btn.setAttribute("aria-current", btn.classList.contains("active") ? "page" : "false");
  });

  nav.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    goToTab(btn.dataset.tab, { pushHistory: true, focus: true });
  });

  // Every internal link in the app (back-links, dashboard quick links/CTA,
  // corrective condition cards' "all conditions" button) navigates via a
  // plain `#tab` hash change, same mechanism as the main nav buttons —
  // routed through goToTab so the nav bar's active state and the
  // page render stay in sync however the person got there.
  window.addEventListener("hashchange", () => {
    const tab = (location.hash || "").replace("#", "") || DEFAULT_TAB;
    goToTab(PAGES[tab] ? tab : DEFAULT_TAB, { pushHistory: false, focus: true });
  });

  window.addEventListener("online", updateOfflineBanner);
  window.addEventListener("offline", updateOfflineBanner);
  updateOfflineBanner();

  const initialTab = (location.hash || "").replace("#", "");
  goToTab(PAGES[initialTab] ? initialTab : DEFAULT_TAB, { pushHistory: false, focus: false });
}

function reducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function goToTab(tab, { pushHistory, focus }) {
  if (!PAGES[tab]) tab = DEFAULT_TAB;
  document.querySelectorAll("nav#tabs button").forEach((b) => {
    const active = b.dataset.tab === tab;
    b.classList.toggle("active", active);
    b.setAttribute("aria-current", active ? "page" : "false");
  });
  if (pushHistory) {
    history.pushState(null, "", "#" + tab);
  } else {
    history.replaceState(null, "", "#" + tab);
  }
  renderPage(tab);
  window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
  if (focus) {
    const main = document.getElementById("mainContent");
    if (main) {
      main.setAttribute("tabindex", "-1");
      main.focus({ preventScroll: true });
    }
  }
}

/** Human page name: known tabs, else the first heading on the page (day pages), else the id. */
function pageLabel(tab, root) {
  if (PAGE_TITLES[tab]) return PAGE_TITLES[tab];
  const h = root && root.querySelector(".section-title, h2, h3");
  const text = h && h.textContent.trim();
  return text || tab;
}

export function renderPage(tab) {
  currentTab = tab;
  const main = document.getElementById("mainContent");
  main.innerHTML = `<section class="active" id="sec-${tab}">${PAGES[tab]()}</section>`;
  const section = main.firstElementChild;
  const label = pageLabel(tab, section);
  section.setAttribute("aria-label", label);
  document.title = `${label} — ${APP_TITLE}`;
  // Generic, cheap, idempotent state hydration — each is a no-op on
  // pages that don't contain the relevant elements.
  hydrateWorkoutUI();
  hydrateRecoveryUI();
  hydrateExercisesUI();
}

export function getCurrentTab() {
  return currentTab;
}

function updateOfflineBanner() {
  let banner = document.getElementById("offlineBanner");
  if (!banner) return;
  const offline = !navigator.onLine;
  banner.classList.toggle("show", offline);
  banner.innerHTML = offline
    ? `${icon("wifi-off")} مفيش اتصال بالإنترنت — بياناتك المحفوظة على الجهاز شغالة عادي، بس روابط الفيديو والصور مش هتفتح دلوقتي.`
    : "";
}
