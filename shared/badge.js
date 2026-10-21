import { translate } from "./i18n.js";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const MAX_MINUTES_ON_BADGE = 99;
const PAUSED_BADGE = "II";
const WAITING_BADGE = "▶";

export const BADGE_COLORS = Object.freeze({
  focus: Object.freeze({ background: "#2e7d32", text: "#ffffff" }),
  break: Object.freeze({ background: "#1565c0", text: "#ffffff" }),
  custom: Object.freeze({ background: "#6b6b6b", text: "#ffffff" }),
  paused: Object.freeze({ background: "#9aa0a6", text: "#202124" }),
});

function getTimeLeft(run, now) {
  const remainingMs = run.stageEndsAt - now;
  const minutes = Math.max(1, Math.ceil(remainingMs / MINUTE_MS));
  if (minutes <= MAX_MINUTES_ON_BADGE) {
    return {
      badge: String(minutes),
      title: translate("badgeMinutesLeft", { count: minutes }),
      nextChangeMs: minutes > 1 ? (minutes - 1) * MINUTE_MS : null,
    };
  }
  const hours = Math.ceil(remainingMs / HOUR_MS);
  return {
    badge: translate("badgeHours", { count: hours }),
    title: translate("badgeHoursLeft", { count: hours }),
    nextChangeMs: Math.max((hours - 1) * HOUR_MS, MAX_MINUTES_ON_BADGE * MINUTE_MS),
  };
}

export function getBadgeText(run, now) {
  if (!run) return "";
  if (run.status === "paused") return PAUSED_BADGE;
  if (run.status === "awaitingNext") return WAITING_BADGE;
  return getTimeLeft(run, now).badge;
}

export function getNextBadgeChangeAt(run, now) {
  if (run?.status !== "running") return null;
  const { nextChangeMs } = getTimeLeft(run, now);
  return nextChangeMs === null ? null : run.stageEndsAt - nextChangeMs;
}

export function getBadgeColors(run) {
  if (!run) return null;
  if (run.status === "paused") return BADGE_COLORS.paused;
  return BADGE_COLORS[run.stages[run.stageIndex].kind] ?? BADGE_COLORS.custom;
}

export function getBadgeTitle(run, now) {
  if (!run) return translate("actionTitle");
  const values = {
    routineName: run.routineName,
    label: run.stages[run.stageIndex].label,
    n: run.stageIndex + 1,
    total: run.stages.length,
  };
  if (run.status === "paused") return translate("badgePausedTitle", values);
  if (run.status === "awaitingNext") return translate("badgeWaitingTitle", values);
  return translate("badgeRunningTitle", { ...values, timeLeft: getTimeLeft(run, now).title });
}
