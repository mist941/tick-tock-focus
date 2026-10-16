import { migrateLegacyLocalStorage } from "./legacy-migration.js";
import { initializeNavigation } from "./navigation.js";
import {
  reloadRoutines,
  reloadRun,
  reloadSettings,
  subscribeToPopupState,
  watchPopupStorage,
} from "./popup-state.js";
import * as PopupStorage from "./popup-storage.js";
import { initializeRoutineEditor, openRoutineEditor } from "./routine-editor.js";
import { loadSavedPresets, showPresetsMessage } from "./routines-view.js";
import { initializeSettingsView } from "./settings-view.js";
import { initializeTimerView } from "./timer-view.js";
import { UI_STRINGS, applyUiStrings } from "./ui-strings.js";

async function initializePopup() {
  try {
    applyUiStrings();
    initializeNavigation();
    initializeSettingsView();
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

    watchPopupStorage();
    subscribeToPopupState((change) => {
      if (change.routines) loadSavedPresets();
    });
    await Promise.all([reloadRoutines(), reloadSettings(), reloadRun()]);
    initializeTimerView({ openRoutineEditor });
  } catch (error) {
    console.error("Error initializing the popup:", error);
  }
}

document.addEventListener("DOMContentLoaded", initializePopup);
