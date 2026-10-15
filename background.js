import {
  CATCH_UP_GRACE_MS,
  expandRoutine,
  getStagesDurationMs,
  isLegacyPreset,
  migrateLegacyPreset,
  normalizeRoutine,
  planCatchUp,
} from "./shared/routine.js";
import { makeStepLabel } from "./shared/stage-labels.js";
import {
  STORAGE_KEYS,
  getItems,
  getSettings,
  presetKey,
  setItems,
  toComparableJson,
} from "./shared/storage.js";
import {
  createRun,
  extendCurrentStage,
  migrateLegacyRun,
  pauseRun,
  resumeRun,
  skipCurrentStage,
  startAwaitedStage,
} from "./background/run-engine.js";

const STAGE_END_ALARM = "stage_end";
const LEGACY_COUNTDOWN_ALARM = "countdown";
const LEGACY_SEGMENT_ALARM_PREFIX = "clock_";
const RUN_KEY = "run";
const LEGACY_RUN_KEYS = ["isRunning", "endTime", "totalDuration", "presetName", "clocks"];
const NOTIFICATION_ICON_URL = "icons/icon512.png";
const UNINSTALL_FEEDBACK_URL = "https://ticktockfocus.com/uninstall.html";

let lifecycleQueue = Promise.resolve();
function runExclusive(task) {
  const result = lifecycleQueue.then(task);
  lifecycleQueue = result.catch(() => {});
  return result;
}

async function readEngineSettings() {
  const settings = await getSettings();
  return { autoAdvance: settings.autoAdvance !== false, timeFormat: settings.timeFormat };
}

function describeNotification(notification, { previousRun, nextRun }) {
  const descriptions = {
    stageDone: () => ({
      title: `${previousRun.stages[notification.stageIndex].label} done`,
      message: `Next: ${nextRun.stages[nextRun.stageIndex].label}`,
    }),
    routineComplete: () => ({ title: `${previousRun.routineName} complete`, message: "" }),
    lateFinish: () => ({
      title: `${previousRun.routineName} finished at ${new Date(
        notification.finishedAt
      ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      message: "",
    }),
    caughtUp: () => ({ title: `Now: ${nextRun.stages[nextRun.stageIndex].label}`, message: "" }),
  };
  return descriptions[notification.type]();
}

async function showNotification({ title, message }) {
  try {
    await chrome.notifications.create({
      type: "basic",
      iconUrl: NOTIFICATION_ICON_URL,
      title,
      message,
      priority: 2,
    });
  } catch (error) {
    console.error("Couldn't show notification:", error);
  }
}

const isLegacyAlarmName = (name) =>
  name === LEGACY_COUNTDOWN_ALARM || name.startsWith(LEGACY_SEGMENT_ALARM_PREFIX);

async function clearLegacyAlarms() {
  const alarms = await chrome.alarms.getAll();
  await Promise.all(
    alarms
      .filter((alarm) => isLegacyAlarmName(alarm.name))
      .map((alarm) => chrome.alarms.clear(alarm.name))
  );
}

async function syncStageAlarm(run) {
  if (run?.status === "running") {
    await chrome.alarms.create(STAGE_END_ALARM, { when: run.stageEndsAt });
  } else {
    await chrome.alarms.clear(STAGE_END_ALARM);
  }
}

async function saveRun(run) {
  if (run) {
    await chrome.storage.local.set({ [RUN_KEY]: run });
  } else {
    await chrome.storage.local.remove(RUN_KEY);
  }
  await syncStageAlarm(run);
}

async function loadRun(now) {
  const storedState = await chrome.storage.local.get([RUN_KEY, ...LEGACY_RUN_KEYS]);
  const hasLegacyRunState = LEGACY_RUN_KEYS.some((key) => storedState[key] !== undefined);
  if (!hasLegacyRunState) return storedState[RUN_KEY] ?? null;

  const run = storedState[RUN_KEY] ?? migrateLegacyRun(storedState, now, makeStepLabel);
  if (run) await chrome.storage.local.set({ [RUN_KEY]: run });
  await chrome.storage.local.remove(LEGACY_RUN_KEYS);
  await clearLegacyAlarms();
  return run;
}

async function catchUpRun({ dueAt, announceLateFinish = true } = {}) {
  const now = Date.now();
  const run = await loadRun(now);
  const settings = await readEngineSettings();
  const catchUpTime =
    run?.status === "running" && run.stageEndsAt === dueAt ? Math.max(now, dueAt) : now;
  const plan = planCatchUp(run, catchUpTime, {
    autoAdvance: settings.autoAdvance,
    graceMs: CATCH_UP_GRACE_MS,
  });

  if (plan.run === run) {
    await syncStageAlarm(run);
    return run;
  }

  await saveRun(plan.run);
  if (plan.notification && (announceLateFinish || plan.notification.type !== "lateFinish")) {
    await showNotification(
      describeNotification(plan.notification, { previousRun: run, nextRun: plan.run })
    );
  }
  return plan.run;
}

async function applyRunCommand(transition) {
  const run = await catchUpRun();
  const nextRun = transition(run, Date.now());
  if (nextRun === run) return run;
  await saveRun(nextRun);
  return nextRun;
}

async function readRoutine(routineId) {
  if (typeof routineId !== "string" || routineId === "") return null;
  const key = presetKey(routineId);
  const items = await getItems(key);
  return normalizeRoutine(items[key], makeStepLabel);
}

async function startRoutine({ routineId }) {
  const currentRun = await catchUpRun({ announceLateFinish: false });
  if (currentRun) return currentRun;

  const routine = await readRoutine(routineId);
  if (!routine) throw new Error(`Routine ${routineId} was not found`);
  const stages = expandRoutine(routine);
  if (getStagesDurationMs(stages) <= 0) throw new Error(`Routine ${routineId} has no duration`);

  const run = createRun(routine, stages, Date.now());
  await saveRun(run);
  return run;
}

const MESSAGE_HANDLERS = new Map([
  ["startRoutine", startRoutine],
  ["stopRoutine", () => applyRunCommand(() => null)],
  ["pauseRoutine", () => applyRunCommand(pauseRun)],
  ["resumeRoutine", () => applyRunCommand(resumeRun)],
  ["skipStage", () => applyRunCommand(skipCurrentStage)],
  [
    "extendStage",
    ({ minutes }) => applyRunCommand((run) => extendCurrentStage(run, minutes)),
  ],
  ["startNextStage", () => applyRunCommand(startAwaitedStage)],
]);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handler = MESSAGE_HANDLERS.get(request?.action);
  if (!handler) return false;

  runExclusive(() => handler(request))
    .then((run) => sendResponse({ success: true, run }))
    .catch((error) => {
      console.error(`${request.action} failed:`, error);
      sendResponse({ success: false, error: error.message });
    });
  return true;
});

async function handleAlarm(alarm) {
  if (alarm.name === STAGE_END_ALARM) {
    await catchUpRun({ dueAt: alarm.scheduledTime });
  } else if (isLegacyAlarmName(alarm.name)) {
    await chrome.alarms.clear(alarm.name);
    await catchUpRun();
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  runExclusive(() => handleAlarm(alarm)).catch((error) =>
    console.error(`Handling alarm ${alarm.name} failed:`, error)
  );
});

async function reconcileRunState() {
  await catchUpRun();
  await clearLegacyAlarms();
}

function queueReconcileRunState() {
  runExclusive(() => reconcileRunState()).catch((error) =>
    console.error("Reconciling the run state failed:", error)
  );
}

async function migrateStoredPresets() {
  const storedItems = await getItems(null);
  const migratedItems = Object.fromEntries(
    Object.entries(storedItems)
      .filter(
        ([key, storedPreset]) =>
          key.startsWith(STORAGE_KEYS.PRESET_PREFIX) && isLegacyPreset(storedPreset)
      )
      .map(([key, storedPreset]) => [key, migrateLegacyPreset(storedPreset, makeStepLabel)])
  );
  const migratedKeys = Object.keys(migratedItems);
  if (migratedKeys.length === 0) return;

  await setItems(migratedItems);
  const itemsAfterWrite = await getItems(migratedKeys);
  const unmatchedKeys = migratedKeys.filter(
    (key) => toComparableJson(itemsAfterWrite[key]) !== toComparableJson(migratedItems[key])
  );
  if (unmatchedKeys.length > 0) {
    console.warn("Some presets did not read back as migrated routines:", unmatchedKeys);
  }
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  queueReconcileRunState();
  if (reason === "update") {
    migrateStoredPresets().catch((error) =>
      console.error("Migrating presets to routines failed:", error)
    );
  }
});
chrome.runtime.onStartup.addListener(queueReconcileRunState);

async function registerUninstallFeedbackUrl() {
  try {
    await chrome.runtime.setUninstallURL(UNINSTALL_FEEDBACK_URL);
  } catch (error) {
    console.warn("Couldn't set the uninstall feedback URL:", error);
  }
}

registerUninstallFeedbackUrl();
