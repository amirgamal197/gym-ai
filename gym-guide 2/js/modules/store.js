/**
 * store.js — Central App State
 * ---------------------------------------------------------------
 * A single shared, mutable STATE object (sets done, logged weights/reps,
 * session history, recovery checklist, fatigue score). Feature modules
 * import STATE and mutate it directly, then call persist() — this
 * mirrors the original prototype's global STATE object, just properly
 * scoped as a module instead of a window global.
 * ---------------------------------------------------------------
 */
import { loadState, saveState, saveStateImmediately } from "./storage.js";

export const STATE = {
  adaptive: {
    date: null,
    byDay: {},
    defaultTime: 60,
  },
};

let saveIndicatorCallback = null;


/** Register a callback fired every time state is (about to be) persisted, used to flash the "اتحفظ" toast (see #saveMsg in index.html). */
export function onPersist(callback) {
  saveIndicatorCallback = callback;
}

/** Load persisted state from storage into STATE at boot. */
export async function initStore() {
  const loaded = await loadState();
  Object.assign(STATE, loaded);
  clearAdaptiveIfStale();
}

/** Ensures energy/time settings expire when the calendar date changes. */
export function clearAdaptiveIfStale() {
  const today = localISODate();
  if (STATE.adaptive && STATE.adaptive.date !== today) {
    STATE.adaptive.date = today;
    STATE.adaptive.byDay = {};
    persist();
  }
}

/** Debounced save — call this after any STATE mutation. */
export function persist() {
  saveState(STATE, () => {
    if (saveIndicatorCallback) saveIndicatorCallback();
  });
}

/** Immediate (non-debounced) save, used on page hide/unload. */
export function persistImmediately() {
  saveStateImmediately(STATE, () => {
    if (saveIndicatorCallback) saveIndicatorCallback();
  });
}

/**
 * Local-calendar date as YYYY-MM-DD. Phase 5: replaces `toISOString().slice(0,10)`,
 * which is the UTC date — in Egypt (UTC+2/+3) anything logged between midnight and
 * ~03:00 was stamped with the PREVIOUS day, which would break "today" and weekly counts.
 */
export function localISODate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
