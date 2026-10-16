import { toComparableJson } from "../shared/storage.js";
import * as PopupStorage from "./popup-storage.js";

const LEGACY_PRESETS_KEY = "presets";
const LEGACY_SETTINGS_KEY = "settings";

function readLegacyKey(key) {
  const rawValue = localStorage.getItem(key);
  if (rawValue === null) return { exists: false };
  try {
    return { exists: true, isReadable: true, value: JSON.parse(rawValue) };
  } catch (error) {
    return { exists: true, isReadable: false };
  }
}

const isPresetLike = (preset) =>
  preset !== null && typeof preset === "object" && Array.isArray(preset.clocks);

function collectPresets(legacyPresets, itemsToWrite) {
  const presets = legacyPresets.value ?? [];
  if (!Array.isArray(presets) || !presets.every(isPresetLike)) {
    return false;
  }

  const usedIds = new Set();
  presets.forEach((preset, index) => {
    if (typeof preset.id !== "string" || usedIds.has(preset.id)) {
      preset.id = `${typeof preset.id === "string" ? preset.id : "legacy"}-${index}`;
    }
    usedIds.add(preset.id);
    itemsToWrite[PopupStorage.presetKey(preset.id)] = preset;
  });
  return true;
}

async function collectSettings(legacySettings, itemsToWrite) {
  const settings = legacySettings.value;
  if (settings !== null && (typeof settings !== "object" || Array.isArray(settings))) {
    return false;
  }

  const settingsKey = PopupStorage.STORAGE_KEYS.SETTINGS;
  const storedItems = await PopupStorage.getItems(settingsKey);
  if (settings && !storedItems[settingsKey]) {
    itemsToWrite[settingsKey] = settings;
  }
  return true;
}

async function removeTimerProgress() {
  const { timerProgress } = await chrome.storage.local.get("timerProgress");
  if (timerProgress !== undefined) {
    await chrome.storage.local.remove("timerProgress");
  }
}

export async function migrateLegacyLocalStorage() {
  await removeTimerProgress();

  const legacyPresets = readLegacyKey(LEGACY_PRESETS_KEY);
  const legacySettings = readLegacyKey(LEGACY_SETTINGS_KEY);
  const itemsToWrite = {};
  const legacyKeysToRemove = [];

  if (legacyPresets.isReadable && collectPresets(legacyPresets, itemsToWrite)) {
    legacyKeysToRemove.push(LEGACY_PRESETS_KEY);
  }
  if (legacySettings.isReadable && (await collectSettings(legacySettings, itemsToWrite))) {
    legacyKeysToRemove.push(LEGACY_SETTINGS_KEY);
  }
  if (legacyKeysToRemove.length === 0) return;

  const keysToVerify = Object.keys(itemsToWrite);
  if (keysToVerify.length > 0) {
    await PopupStorage.setItems(itemsToWrite);
    const storedItems = await PopupStorage.getItems(keysToVerify);
    const isIntact = keysToVerify.every(
      (key) => toComparableJson(storedItems[key]) === toComparableJson(itemsToWrite[key])
    );
    if (!isIntact) throw new Error("Migrated data did not read back intact");
  }

  legacyKeysToRemove.forEach((key) => localStorage.removeItem(key));
}
