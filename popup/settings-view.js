import { openScreen, registerScreen } from "./navigation.js";
import { getPopupState, subscribeToPopupState } from "./popup-state.js";
import * as PopupStorage from "./popup-storage.js";
import { UI_STRINGS, formatUiString } from "./ui-strings.js";

const DEFAULT_TIME_FORMAT = "24h";

const elements = {
  openButton: document.getElementById("open_settings"),
  version: document.getElementById("settings_version"),
  message: document.getElementById("settings_message"),
  nextStepOptions: [...document.querySelectorAll('input[name="next_step"]')],
  timeFormatOptions: [...document.querySelectorAll('input[name="time_format"]')],
};

function renderSettings() {
  const { settings } = getPopupState();
  const nextStepValue = settings.autoAdvance === false ? "wait" : "auto";
  const timeFormatValue = settings.timeFormat === "12h" ? "12h" : DEFAULT_TIME_FORMAT;
  elements.nextStepOptions.forEach((option) => {
    option.checked = option.value === nextStepValue;
  });
  elements.timeFormatOptions.forEach((option) => {
    option.checked = option.value === timeFormatValue;
  });
}

async function saveSetting(key, value) {
  elements.message.textContent = "";
  try {
    await PopupStorage.updateSetting(key, value);
  } catch (error) {
    console.error(`Error saving the ${key} setting:`, error);
    elements.message.textContent = UI_STRINGS.settings.saveFailed;
    renderSettings();
  }
}

export function initializeSettingsView() {
  elements.version.textContent = formatUiString(UI_STRINGS.settings.version, {
    version: chrome.runtime.getManifest().version,
  });
  elements.nextStepOptions.forEach((option) =>
    option.addEventListener("change", () => saveSetting("autoAdvance", option.value === "auto"))
  );
  elements.timeFormatOptions.forEach((option) =>
    option.addEventListener("change", () => saveSetting("timeFormat", option.value))
  );
  subscribeToPopupState((change) => {
    if (change.settings) renderSettings();
  });
  registerScreen("settings", { onOpen: renderSettings });
  elements.openButton.addEventListener("click", () =>
    openScreen("settings", { returnFocusTo: elements.openButton })
  );
  renderSettings();
}
