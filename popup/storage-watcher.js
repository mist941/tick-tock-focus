import { STORAGE_KEYS } from "../shared/storage.js";

const ROUTINES_RELOAD_DELAY_MS = 150;

export function watchStorage({ onRoutinesChanged, onSettingsChanged, onRunChanged }) {
  let routinesReloadTimeoutId = null;

  chrome.storage.onChanged.addListener((changes, areaName) => {
    const changedKeys = Object.keys(changes);
    if (changedKeys.some((key) => key.startsWith(STORAGE_KEYS.PRESET_PREFIX))) {
      clearTimeout(routinesReloadTimeoutId);
      routinesReloadTimeoutId = setTimeout(onRoutinesChanged, ROUTINES_RELOAD_DELAY_MS);
    }
    const settingsChanged = changedKeys.includes(STORAGE_KEYS.SETTINGS);
    if (settingsChanged) onSettingsChanged();
    if (settingsChanged || (areaName === "local" && STORAGE_KEYS.RUN in changes)) {
      onRunChanged();
    }
  });
}
