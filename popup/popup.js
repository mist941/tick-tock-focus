import { migrateLegacyLocalStorage } from "./legacy-migration.js";
import { initializeNavigation } from "./navigation.js";
import * as PopupStorage from "./popup-storage.js";
import { initializeRoutineEditor } from "./routine-editor.js";
import { loadSavedPresets, showPresetsMessage } from "./routines-view.js";
import { initializeSettingsView } from "./settings-view.js";
import { watchStorage } from "./storage-watcher.js";
import { TimerView } from "./timer-view.js";
import { UI_STRINGS, applyUiStrings } from "./ui-strings.js";

async function reloadRoutines() {
  await loadSavedPresets();
  await TimerView.loadPresets();
}

async function initializePopup() {
  try {
    applyUiStrings();
    initializeNavigation();
    initializeSettingsView();
    TimerView.initialize();
    initializeRoutineEditor();

    try {
      await migrateLegacyLocalStorage();
    } catch (error) {
      console.error("Error migrating presets from localStorage:", error);
      showPresetsMessage(UI_STRINGS.savedPresets.migrationFailed);
    }

    try {
      await PopupStorage.retryLocalOnlyItems();
    } catch (error) {
      console.error("Error moving local-only items to sync:", error);
    }

    watchStorage({
      onRoutinesChanged: reloadRoutines,
      onSettingsChanged: () => {},
      onRunChanged: () => TimerView.restoreTimerState(),
    });

    await reloadRoutines();
    TimerView.restoreTimerState();
  } catch (error) {
    console.error("Error initializing the popup:", error);
  }
}

document.addEventListener("DOMContentLoaded", initializePopup);
