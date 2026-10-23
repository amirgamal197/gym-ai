/**
 * storage.js — Persistence Module
 * ---------------------------------------------------------------
 * IMPORTANT ARCHITECTURE NOTE
 * The original single-file prototype called `window.storage.get/set`.
 * That API only exists inside the Claude.ai Artifacts sandbox — it is
 * NOT a real browser API and does not exist once this app is deployed
 * as a normal website/PWA. Shipping it as-is would mean the app fails
 * to save anything (and throws) for every real visitor.
 *
 * This module replaces it with a small persistence layer built on the
 * real, universally-supported `localStorage` API, wrapped so the rest
 * of the app still calls simple async `loadState()` / `saveState()`
 * functions and never touches `localStorage` directly. If the app
 * ever needs a bigger storage backend (IndexedDB, a backend API) later,
 * only this file needs to change.
 * ---------------------------------------------------------------
 */

const STORAGE_KEY = "gymGuide.state";
const STORAGE_VERSION = 1;
const SAVE_DEBOUNCE_MS = 250;

let saveTimer = null;
let memoryFallback = {}; // used only if localStorage is unavailable (e.g. private mode edge cases)
let storageAvailable = true;

function detectStorage() {
  try {
    const testKey = "__gymGuide_storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}
storageAvailable = typeof window !== "undefined" && "localStorage" in window && detectStorage();

/**
 * Load the persisted app state.
 * Returns a plain object (never null/undefined) so callers can always
 * do STATE.sets = STATE.sets || {} safely.
 */
export async function loadState() {
  if (!storageAvailable) return { ...memoryFallback };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Envelope format: { version, data }. Older/foreign data is ignored safely.
    if (parsed && typeof parsed === "object" && "data" in parsed) {
      return parsed.data || {};
    }
    // Defensive fallback for any unexpected shape.
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch (e) {
    console.error("[storage] failed to read saved state, starting fresh:", e);
    return {};
  }
}

/**
 * Persist app state. Debounced internally so rapid successive calls
 * (e.g. typing in a weight input) collapse into a single write.
 * @param {object} state
 * @param {() => void} [onSaved] optional callback fired after a successful write
 */
export function saveState(state, onSaved) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    persist(state, onSaved);
  }, SAVE_DEBOUNCE_MS);
}

/**
 * Persist immediately, bypassing the debounce. Used when the page is
 * about to unload and we can't afford to lose the last edit.
 */
export function saveStateImmediately(state, onSaved) {
  clearTimeout(saveTimer);
  persist(state, onSaved);
}

function persist(state, onSaved) {
  const envelope = { version: STORAGE_VERSION, data: state };
  if (!storageAvailable) {
    memoryFallback = state;
    if (onSaved) onSaved();
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    if (onSaved) onSaved();
  } catch (e) {
    // Most likely QuotaExceededError (storage full) or private-mode restrictions.
    console.error("[storage] failed to save state:", e);
  }
}

/** Wipe all saved progress (used by a future "reset app" action, if ever added). */
export async function clearState() {
  memoryFallback = {};
  if (!storageAvailable) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("[storage] failed to clear state:", e);
  }
}

export function isStorageAvailable() {
  return storageAvailable;
}
