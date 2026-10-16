import { switchTab } from "./navigation.js";
import * as PopupStorage from "./popup-storage.js";
import { TimerView } from "./timer-view.js";
import { UI_STRINGS, formatUiString } from "./ui-strings.js";

const elements = {
  list: document.querySelector(".saved-presets-list"),
  message: document.getElementById("presets_message"),
  form: document.getElementById("preset_form"),
  formSaveButton: document.getElementById("add_preset"),
  createButton: document.getElementById("create_preset"),
};

export function showPresetsMessage(text) {
  elements.message.textContent = text;
}

function openOnTimerTab(presetId) {
  if (!TimerView.isRunning) TimerView.selectPreset(presetId);
  switchTab("timer");
  TimerView.focusPresetControls();
}

function createSavedPresetItem(preset, index) {
  const presetItem = document.createElement("li");
  presetItem.className = "saved-preset-item";
  presetItem.dataset.presetId = preset.id;

  const selectButton = document.createElement("button");
  selectButton.type = "button";
  selectButton.className = "saved-preset-name";
  selectButton.textContent = preset.name;
  selectButton.title = UI_STRINGS.savedPresets.selectOnTimerTab;
  selectButton.addEventListener("click", () => openOnTimerTab(preset.id));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "saved-preset-delete";
  deleteButton.textContent = "×";
  const deleteLabel = formatUiString(UI_STRINGS.savedPresets.deletePreset, { name: preset.name });
  deleteButton.setAttribute("aria-label", deleteLabel);
  deleteButton.title = deleteLabel;
  deleteButton.addEventListener("click", () => deletePreset(preset.id, index));

  presetItem.append(selectButton, deleteButton);
  return { presetItem, selectButton, deleteButton };
}

export async function loadSavedPresets() {
  try {
    const presets = await PopupStorage.getRoutines();

    const focusedButton = elements.list.contains(document.activeElement)
      ? document.activeElement
      : null;
    const focusedPresetId = focusedButton?.closest(".saved-preset-item").dataset.presetId;
    let buttonToRefocus = null;

    elements.list.replaceChildren();

    presets.forEach((preset, index) => {
      const { presetItem, selectButton, deleteButton } = createSavedPresetItem(preset, index);
      if (preset.id === focusedPresetId) {
        buttonToRefocus = focusedButton.classList.contains("saved-preset-delete")
          ? deleteButton
          : selectButton;
      }
      elements.list.appendChild(presetItem);
    });

    buttonToRefocus?.focus();
  } catch (error) {
    console.error("Error loading saved presets:", error);
    showPresetsMessage(UI_STRINGS.savedPresets.loadFailed);
  }
}

async function deletePreset(presetId, listIndex) {
  try {
    await PopupStorage.deleteRoutine(presetId);
    showPresetsMessage("");
    await loadSavedPresets();

    const presetItems = elements.list.querySelectorAll(".saved-preset-item");
    const itemInPlace = presetItems[Math.min(listIndex, presetItems.length - 1)];
    if (itemInPlace) {
      itemInPlace.querySelector(".saved-preset-delete").focus();
    } else if (elements.form.style.display === "block") {
      elements.formSaveButton.focus();
    } else {
      elements.createButton.focus();
    }

    await TimerView.loadPresets();
  } catch (error) {
    console.error("Error deleting preset:", error);
    showPresetsMessage(UI_STRINGS.savedPresets.deleteFailed);
  }
}
