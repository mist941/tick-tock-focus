import { fillTemplate } from "./format.js";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const MAX_MINUTES_ON_BADGE = 99;

export const BADGE_TEXTS = Object.freeze({
  idleTitle: "TickTockFocus",
  pausedBadge: "II",
  waitingBadge: "▶",
  underMinuteBadge: "<1",
  hoursBadge: "{count}h",
  runningTitle: "{routineName} · {label} {n} of {total} · {timeLeft}",
  pausedTitle: "{routineName} · Paused · {label} {n} of {total}",
  waitingTitle: "{routineName} · Waiting for you · Next: {label} {n} of {total}",
  minutesLeft: "{count} min left",
  hoursLeft: "{count} h left",
  underMinuteLeft: "less than 1 min left",
});

export const BADGE_COLORS = Object.freeze({
  focus: Object.freeze({ background: "#2e7d32", text: "#ffffff" }),
  break: Object.freeze({ background: "#1565c0", text: "#ffffff" }),
  custom: Object.freeze({ background: "#6b6b6b", text: "#ffffff" }),
  paused: Object.freeze({ background: "#9aa0a6", text: "#202124" }),
});

function getTimeLeft(run, now) {
  const remainingMs = run.stageEndsAt - now;
  if (remainingMs <= MINUTE_MS) {
    return { badge: BADGE_TEXTS.underMinuteBadge, title: BADGE_TEXTS.underMinuteLeft, nextChangeMs: null };
  }
  const minutes = Math.ceil(remainingMs / MINUTE_MS);
  if (minutes <= MAX_MINUTES_ON_BADGE) {
    return {
      badge: String(minutes),
      title: fillTemplate(BADGE_TEXTS.minutesLeft, { count: minutes }),
      nextChangeMs: (minutes - 1) * MINUTE_MS,
    };
  }
  const hours = Math.ceil(remainingMs / HOUR_MS);
  return {
    badge: fillTemplate(BADGE_TEXTS.hoursBadge, { count: hours }),
    title: fillTemplate(BADGE_TEXTS.hoursLeft, { count: hours }),
    nextChangeMs: Math.max((hours - 1) * HOUR_MS, MAX_MINUTES_ON_BADGE * MINUTE_MS),
  };
}

export function getBadgeText(run, now) {
  if (!run) return "";
  if (run.status === "paused") return BADGE_TEXTS.pausedBadge;
  if (run.status === "awaitingNext") return BADGE_TEXTS.waitingBadge;
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
  if (!run) return BADGE_TEXTS.idleTitle;
  const values = {
    routineName: run.routineName,
    label: run.stages[run.stageIndex].label,
    n: run.stageIndex + 1,
    total: run.stages.length,
  };
  if (run.status === "paused") return fillTemplate(BADGE_TEXTS.pausedTitle, values);
  if (run.status === "awaitingNext") return fillTemplate(BADGE_TEXTS.waitingTitle, values);
  return fillTemplate(BADGE_TEXTS.runningTitle, { ...values, timeLeft: getTimeLeft(run, now).title });
}
