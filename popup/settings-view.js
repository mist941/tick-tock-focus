import { openScreen, registerScreen } from "./navigation.js";
import { UI_STRINGS, formatUiString } from "./ui-strings.js";

const elements = {
  openButton: document.getElementById("open_settings"),
  version: document.getElementById("settings_version"),
};

export function initializeSettingsView() {
  elements.version.textContent = formatUiString(UI_STRINGS.settings.version, {
    version: chrome.runtime.getManifest().version,
  });
  registerScreen("settings");
  elements.openButton.addEventListener("click", () =>
    openScreen("settings", { returnFocusTo: elements.openButton })
  );
}
