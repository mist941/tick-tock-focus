import {
  getStageDurationMs,
  getStagesDurationMs,
  stagesFromLegacyClocks,
} from "../shared/routine.js";

export const RUN_SCHEMA_VERSION = 2;
export const EXTENDED_STAGE_MAX_SEC = 24 * 3600;

function startStage(run, stageIndex, now) {
  const { remainingMs, ...runWithoutRemaining } = run;
  return {
    ...runWithoutRemaining,
    status: "running",
    stageIndex,
    stageEndsAt: now + getStageDurationMs(run.stages[stageIndex]),
  };
}

export function createRun(routine, stages, now) {
  return startStage(
    {
      schemaVersion: RUN_SCHEMA_VERSION,
      status: "running",
      routineId: routine.id,
      routineName: routine.name,
      stages,
      stageIndex: 0,
      startedAt: now,
    },
    0,
    now
  );
}

export function pauseRun(run, now) {
  if (run?.status !== "running") return run;
  const { stageEndsAt, ...runWithoutEnd } = run;
  return { ...runWithoutEnd, status: "paused", remainingMs: Math.max(0, stageEndsAt - now) };
}

export function resumeRun(run, now) {
  if (run?.status !== "paused") return run;
  const { remainingMs, ...runWithoutRemaining } = run;
  return { ...runWithoutRemaining, status: "running", stageEndsAt: now + remainingMs };
}

export function skipCurrentStage(run, now) {
  if (!run) return run;
  const nextStageIndex = run.stageIndex + 1;
  if (nextStageIndex >= run.stages.length) return null;
  return startStage(run, nextStageIndex, now);
}

export function extendCurrentStage(run, minutes) {
  if (run?.status !== "running" && run?.status !== "paused") return run;
  if (!Number.isInteger(minutes) || minutes < 1) return run;

  const currentStage = run.stages[run.stageIndex];
  const addedSec = Math.min(minutes * 60, EXTENDED_STAGE_MAX_SEC - currentStage.durationSec);
  if (addedSec <= 0) return run;

  const stages = run.stages.map((stage, stageIndex) =>
    stageIndex === run.stageIndex ? { ...stage, durationSec: stage.durationSec + addedSec } : stage
  );
  return run.status === "running"
    ? { ...run, stages, stageEndsAt: run.stageEndsAt + addedSec * 1000 }
    : { ...run, stages, remainingMs: run.remainingMs + addedSec * 1000 };
}

export function startAwaitedStage(run, now) {
  if (run?.status !== "awaitingNext") return run;
  return startStage(run, run.stageIndex, now);
}

export function migrateLegacyRun(legacyState, now, makeStageLabel) {
  const { isRunning, endTime, presetName, clocks } = legacyState;
  if (!isRunning || !Number.isFinite(endTime) || !Array.isArray(clocks) || clocks.length === 0) {
    return null;
  }

  const stages = stagesFromLegacyClocks(clocks, makeStageLabel);
  const startedAt = endTime - getStagesDurationMs(stages);
  const lastStageIndex = stages.length - 1;
  let stageIndex = 0;
  let stageEndsAt = startedAt + getStageDurationMs(stages[0]);
  while (stageIndex < lastStageIndex && stageEndsAt <= now) {
    stageIndex += 1;
    stageEndsAt += getStageDurationMs(stages[stageIndex]);
  }

  return {
    schemaVersion: RUN_SCHEMA_VERSION,
    status: "running",
    routineId: null,
    routineName: presetName ?? "",
    stages,
    stageIndex,
    stageEndsAt,
    startedAt,
  };
}
