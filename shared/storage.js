export const STORAGE_KEYS = Object.freeze({
  SETTINGS: "settings",
  PRESET_PREFIX: "preset_",
  RUN: "run",
  NOTIFICATION_ACTIONS: "notificationActions",
  WHATS_NEW_PENDING: "whatsNewPending",
  COMPLETED_ROUTINES: "completedRoutines",
  RATING_PROMPT: "ratingPrompt",
});

export function presetKey(presetId) {
  return `${STORAGE_KEYS.PRESET_PREFIX}${presetId}`;
}

export function isQuotaError(error) {
  return /quota/i.test(error?.message || "");
}

export function isWriteRateError(error) {
  return /MAX_WRITE_OPERATIONS_PER_(MINUTE|HOUR)/.test(error?.message || "");
}

export async function getItems(keys) {
  const [syncItems, localItems] = await Promise.all([
    chrome.storage.sync.get(keys),
    chrome.storage.local.get(keys),
  ]);
  return { ...syncItems, ...localItems };
}

export async function setItems(items) {
  try {
    await chrome.storage.sync.set(items);
  } catch (error) {
    if (!isQuotaError(error)) throw error;

    const entries = Object.entries(items);
    if (entries.length === 1) {
      await chrome.storage.local.set(items);
      return;
    }
    for (const [key, value] of entries) {
      await setItems({ [key]: value });
    }
    return;
  }
  await chrome.storage.local.remove(Object.keys(items));
}

export async function retryLocalOnlyItems({ maxItems }) {
  const localItems = await chrome.storage.local.get(null);
  const keysToRetry = Object.keys(localItems)
    .filter(
      (key) => key.startsWith(STORAGE_KEYS.PRESET_PREFIX) || key === STORAGE_KEYS.SETTINGS
    )
    .slice(0, maxItems);

  for (const key of keysToRetry) {
    try {
      await chrome.storage.sync.set({ [key]: localItems[key] });
    } catch (error) {
      if (isWriteRateError(error)) return;
      if (isQuotaError(error)) continue;
      throw error;
    }
    await chrome.storage.local.remove(key);
  }
}

export function toComparableJson(value) {
  return JSON.stringify(value, (key, nestedValue) =>
    nestedValue && typeof nestedValue === "object" && !Array.isArray(nestedValue)
      ? Object.fromEntries(
          Object.entries(nestedValue).sort(([first], [second]) =>
            first < second ? -1 : first > second ? 1 : 0
          )
        )
      : nestedValue
  );
}

export async function getSettings() {
  const items = await getItems(STORAGE_KEYS.SETTINGS);
  return items[STORAGE_KEYS.SETTINGS] || {};
}
