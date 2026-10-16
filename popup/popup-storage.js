import { expandRoutine, normalizeRoutine, toLegacyClocks } from "../shared/routine.js";
import { makeStepLabel } from "../shared/stage-labels.js";
import * as SharedStorage from "../shared/storage.js";

const MAX_SYNC_RETRIES_PER_OPEN = 10;

export const { STORAGE_KEYS, presetKey, getItems, setItems, getSettings } = SharedStorage;

export function retryLocalOnlyItems() {
  return SharedStorage.retryLocalOnlyItems({ maxItems: MAX_SYNC_RETRIES_PER_OPEN });
}

export async function updateSetting(key, value) {
  const settings = await getSettings();
  settings[key] = value;
  await setItems({ [STORAGE_KEYS.SETTINGS]: settings });
}

export async function getRoutines() {
  const items = await getItems(null);
  return Object.entries(items)
    .filter(([key]) => key.startsWith(STORAGE_KEYS.PRESET_PREFIX))
    .map(([, storedPreset]) => normalizeRoutine(storedPreset, makeStepLabel))
    .filter((routine) => routine !== null)
    .sort((first, second) => (first.createdAt || 0) - (second.createdAt || 0));
}

export async function saveRoutine(routine) {
  const storedRoutine = { ...routine, clocks: toLegacyClocks(expandRoutine(routine)) };
  await setItems({ [presetKey(routine.id)]: storedRoutine });
}

export async function deleteRoutine(routineId) {
  const key = presetKey(routineId);
  await Promise.all([chrome.storage.sync.remove(key), chrome.storage.local.remove(key)]);
}
