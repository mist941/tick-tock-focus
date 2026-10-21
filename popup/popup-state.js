import { STORAGE_KEYS } from "../shared/storage.js";
import * as PopupStorage from "./popup-storage.js";

const ROUTINES_RELOAD_DELAY_MS = 150;

const state = {
  routines: [],
  routinesLoadFailed: false,
  settings: {},
  storedRun: null,
  notices: { whatsNewPending: null },
};
const listeners = new Set();

export const getPopupState = () => state;

export function subscribeToPopupState(listener) {
  listeners.add(listener);
}

function notifyListeners(change) {
  listeners.forEach((listener) => listener(change));
}

export async function reloadRoutines() {
  try {
    state.routines = await PopupStorage.getRoutines();
    state.routinesLoadFailed = false;
  } catch (error) {
    console.error("Error loading routines:", error);
    state.routinesLoadFailed = true;
  }
  notifyListeners({ routines: true });
}

export async function reloadSettings() {
  try {
    state.settings = await PopupStorage.getSettings();
  } catch (error) {
    console.error("Error loading settings:", error);
  }
  notifyListeners({ settings: true });
}

export async function reloadRun() {
  try {
    const { [STORAGE_KEYS.RUN]: storedRun } = await chrome.storage.local.get(STORAGE_KEYS.RUN);
    state.storedRun = storedRun ?? null;
  } catch (error) {
    console.error("Error loading the run:", error);
  }
  notifyListeners({ run: true });
}

export function setStoredRun(run) {
  state.storedRun = run ?? null;
  notifyListeners({ run: true });
}

export async function reloadNotices() {
  try {
    state.notices = await PopupStorage.getNotices();
  } catch (error) {
    console.error("Error loading the notices:", error);
  }
  notifyListeners({ notices: true });
}

export function watchPopupStorage() {
  let routinesReloadTimeoutId = null;
  chrome.storage.onChanged.addListener((changes, areaName) => {
    const changedKeys = Object.keys(changes);
    if (changedKeys.some((key) => key.startsWith(STORAGE_KEYS.PRESET_PREFIX))) {
      clearTimeout(routinesReloadTimeoutId);
      routinesReloadTimeoutId = setTimeout(reloadRoutines, ROUTINES_RELOAD_DELAY_MS);
    }
    if (changedKeys.includes(STORAGE_KEYS.SETTINGS)) reloadSettings();
    if (areaName === "local" && STORAGE_KEYS.RUN in changes) reloadRun();
    if (areaName === "local" && PopupStorage.NOTICE_KEYS.some((key) => key in changes)) {
      reloadNotices();
    }
  });
}
