import { SOUND_IDS, getSoundPath, getSoundSettings } from "../shared/sounds.js";
import { createElement } from "./dom-helpers.js";
import { createIcon } from "./icons.js";
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
  soundEnabled: document.getElementById("sound_enabled"),
  soundSelect: document.getElementById("sound_id"),
  volumeSlider: document.getElementById("sound_volume"),
  volumeValue: document.getElementById("sound_volume_value"),
  testSoundButton: document.getElementById("sound_test"),
  showBadge: document.getElementById("show_badge"),
};

let pendingSaveCount = 0;
let saveQueue = Promise.resolve();
let testAudio = null;

function describeVolume(volume) {
  const text = formatUiString(UI_STRINGS.settings.volumePercent, { volume });
  elements.volumeSlider.setAttribute("aria-valuetext", text);
  elements.volumeValue.textContent = text;
}

function setSoundControlsEnabled(isEnabled) {
  [elements.soundSelect, elements.volumeSlider, elements.testSoundButton].forEach((control) => {
    control.disabled = !isEnabled;
  });
}

function renderSettings() {
  if (pendingSaveCount > 0) return;
  const { settings } = getPopupState();
  const nextStepValue = settings.autoAdvance === false ? "wait" : "auto";
  const timeFormatValue = settings.timeFormat === "12h" ? "12h" : DEFAULT_TIME_FORMAT;
  elements.nextStepOptions.forEach((option) => {
    option.checked = option.value === nextStepValue;
  });
  elements.timeFormatOptions.forEach((option) => {
    option.checked = option.value === timeFormatValue;
  });

  const { soundEnabled, soundId, soundVolume } = getSoundSettings(settings);
  elements.soundEnabled.checked = soundEnabled;
  elements.soundSelect.value = soundId;
  elements.volumeSlider.value = String(soundVolume);
  describeVolume(soundVolume);
  setSoundControlsEnabled(soundEnabled);
  elements.showBadge.checked = settings.showBadge !== false;
}

function saveSetting(key, value) {
  elements.message.textContent = "";
  pendingSaveCount += 1;
  saveQueue = saveQueue
    .then(() => PopupStorage.updateSetting(key, value))
    .then(
      () => {
        pendingSaveCount -= 1;
      },
      (error) => {
        pendingSaveCount -= 1;
        console.error(`Error saving the ${key} setting:`, error);
        elements.message.textContent = UI_STRINGS.settings.saveFailed;
        renderSettings();
      }
    );
}

function playTestSound() {
  testAudio?.pause();
  testAudio = new Audio(chrome.runtime.getURL(getSoundPath(elements.soundSelect.value)));
  testAudio.volume = Number(elements.volumeSlider.value) / 100;
  testAudio.play().catch((error) => console.error("Couldn't play the test sound:", error));
}

function initializeSoundControls() {
  elements.soundSelect.replaceChildren(
    ...SOUND_IDS.map((soundId) =>
      createElement("option", {
        text: UI_STRINGS.settings.soundNames[soundId],
        attributes: { value: soundId },
      })
    )
  );
  elements.testSoundButton.replaceChildren(
    createIcon("play"),
    createElement("span", { text: UI_STRINGS.settings.testSound })
  );

  elements.soundEnabled.addEventListener("change", () => {
    setSoundControlsEnabled(elements.soundEnabled.checked);
    saveSetting("soundEnabled", elements.soundEnabled.checked);
  });
  elements.soundSelect.addEventListener("change", () =>
    saveSetting("soundId", elements.soundSelect.value)
  );
  elements.volumeSlider.addEventListener("input", () =>
    describeVolume(Number(elements.volumeSlider.value))
  );
  elements.volumeSlider.addEventListener("change", () =>
    saveSetting("soundVolume", Number(elements.volumeSlider.value))
  );
  elements.testSoundButton.addEventListener("click", playTestSound);
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
  initializeSoundControls();
  elements.showBadge.addEventListener("change", () =>
    saveSetting("showBadge", elements.showBadge.checked)
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
