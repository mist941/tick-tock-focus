import { migrateLegacyLocalStorage } from "./legacy-migration.js";
import { initializeNavigation } from "./navigation.js";
import {
  reloadNotices,
  reloadRoutines,
  reloadRun,
  reloadSettings,
  watchPopupStorage,
} from "./popup-state.js";
import * as PopupStorage from "./popup-storage.js";
import { initializeRatingPromptView } from "./rating-prompt-view.js";
import { initializeRoutineEditor, openRoutineEditor } from "./routine-editor.js";
import { initializeRoutinesView, showRoutinesMessage } from "./routines-view.js";
import { initializeSettingsView } from "./settings-view.js";
import { initializeTimerView } from "./timer-view.js";
import { initializeToast } from "./toast.js";
import { UI_STRINGS, applyUiStrings } from "./ui-strings.js";
import { initializeWhatsNewView } from "./whats-new-view.js";

async function initializePopup() {
  try {
    applyUiStrings();
    initializeNavigation();
    initializeSettingsView();
    initializeRoutineEditor();
    initializeToast();

    try {
      await migrateLegacyLocalStorage();
    } catch (error) {
      console.error("Error migrating presets from localStorage:", error);
      showRoutinesMessage(UI_STRINGS.routines.migrationFailed);
    }

    try {
      await PopupStorage.retryLocalOnlyItems();
    } catch (error) {
      console.error("Error moving local-only items to sync:", error);
    }

    watchPopupStorage();
    await Promise.all([reloadRoutines(), reloadSettings(), reloadRun(), reloadNotices()]);
    initializeTimerView({ openRoutineEditor });
    initializeRoutinesView({ openRoutineEditor });
    initializeWhatsNewView();
    initializeRatingPromptView();
  } catch (error) {
    console.error("Error initializing the popup:", error);
  }
}

document.addEventListener("DOMContentLoaded", initializePopup);
