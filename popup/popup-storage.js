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

export async function saveRoutines(routines) {
  if (routines.length === 0) return;
  await setItems(
    Object.fromEntries(
      routines.map((routine) => [
        presetKey(routine.id),
        { ...routine, clocks: toLegacyClocks(expandRoutine(routine)) },
      ])
    )
  );
}

export const saveRoutine = (routine) => saveRoutines([routine]);

export async function deleteRoutine(routineId) {
  const key = presetKey(routineId);
  await Promise.all([chrome.storage.sync.remove(key), chrome.storage.local.remove(key)]);
}

export const NOTICE_KEYS = Object.freeze([
  STORAGE_KEYS.WHATS_NEW_PENDING,
  STORAGE_KEYS.COMPLETED_ROUTINES,
  STORAGE_KEYS.RATING_PROMPT,
]);

export async function getNotices() {
  const items = await chrome.storage.local.get([...NOTICE_KEYS]);
  return {
    whatsNewPending: items[STORAGE_KEYS.WHATS_NEW_PENDING] ?? null,
    completedRoutines: items[STORAGE_KEYS.COMPLETED_ROUTINES] ?? 0,
    ratingPrompt: items[STORAGE_KEYS.RATING_PROMPT] ?? null,
  };
}

export const dismissWhatsNew = () => chrome.storage.local.remove(STORAGE_KEYS.WHATS_NEW_PENDING);

export const saveRatingPrompt = (ratingPrompt) =>
  chrome.storage.local.set({ [STORAGE_KEYS.RATING_PROMPT]: ratingPrompt });
