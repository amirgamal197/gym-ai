/**
 * sync.js — Cloud Synchronization (Firebase)
 * ---------------------------------------------------------------
 * Handles Google Auth and synchronization of the app STATE
 * between the local device and Firestore.
 * ---------------------------------------------------------------
 */
import { firebaseConfig } from "./firebase-config.js";
import { STATE, persist } from "./store.js";

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

/**
 * Syncs the current local state to the user's cloud document.
 */
export async function syncToCloud() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    await db.collection("users").doc(user.uid).set({
      state: STATE,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log("[Sync] State uploaded to cloud.");
  } catch (e) {
    console.error("[Sync] Cloud upload failed:", e);
  }
}

/**
 * Pulls state from the cloud and merges it into the local state.
 * If local state is newer (based on some logic) or empty, cloud wins.
 */
export async function syncFromCloud() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const doc = await db.collection("users").doc(user.uid).get();
    if (doc.exists) {
      const cloudState = doc.data().state;
      if (cloudState) {
        Object.assign(STATE, cloudState);
        persist();
        console.log("[Sync] State pulled from cloud.");
      }
    }
  } catch (e) {
    console.error("[Sync] Cloud pull failed:", e);
  }
}

/**
 * Sign in with Google.
 */
export async function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await auth.signInWithPopup(provider);
    console.log("[Auth] User logged in:", result.user.displayName);
    await syncFromCloud();
    return result.user;
  } catch (e) {
    console.error("[Auth] Login failed:", e);
    throw e;
  }
}

/**
C * Sign out.
 */
export async function logout() {
  try {
    await auth.signOut();
    console.log("[Auth] User logged out.");
  } catch (e) {
    console.error("[Auth] Logout failed:", e);
  }
}

/**
 * Watcher for auth state changes.
 */
export function initAuthWatcher(onUserChanged) {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      await syncFromCloud();
    }
    onUserChanged(user);
  });
}
