import {
  CATCH_UP_GRACE_MS,
  EXTENDED_STAGE_MAX_SEC,
  ROUTINE_LIMITS,
  expandRoutine,
  getRunProgress,
  planCatchUp,
} from "../shared/routine.js";
import { formatClockTime, formatTimerCountdown } from "../shared/format.js";
import { createElement, setTextIfChanged } from "./dom-helpers.js";
import { createIcon } from "./icons.js";
import { getPopupState, subscribeToPopupState } from "./popup-state.js";
import { sendRunCommand } from "./run-commands.js";
import { createProgressRing, createStageStrip } from "./stage-graphics.js";
import { UI_STRINGS, formatDurationText, formatUiString } from "./ui-strings.js";

const EXTEND_MINUTES = 5;
const RENDER_INTERVAL_MS = 1000;

const elements = {
  idleView: document.getElementById("timer_idle"),
  idleMessage: document.getElementById("timer_idle_message"),
  cards: document.getElementById("routine_cards"),
  newRoutineButton: document.getElementById("timer_new_routine"),
  emptyState: document.getElementById("timer_empty_state"),
  createRoutineButton: document.getElementById("timer_create_routine"),
  runView: document.getElementById("timer_run"),
  routineName: document.getElementById("run_routine_name"),
  stageLine: document.getElementById("run_stage_line"),
  ring: document.getElementById("run_ring"),
  countdown: document.getElementById("run_countdown"),
  next: document.getElementById("run_next"),
  endsAt: document.getElementById("run_ends"),
  primaryButton: document.getElementById("run_primary"),
  skipButton: document.getElementById("run_skip"),
  extendButton: document.getElementById("run_extend"),
  stopButton: document.getElementById("run_stop"),
  runMessage: document.getElementById("run_message"),
};

const PRIMARY_ACTIONS = {
  running: { action: "pauseRoutine", icon: "pause", text: () => UI_STRINGS.timer.pause },
  paused: { action: "resumeRoutine", icon: "play", text: () => UI_STRINGS.timer.resume },
  awaitingNext: {
    action: "startNextStage",
    icon: "play",
    text: (stage) => formatUiString(UI_STRINGS.timer.startStage, { label: stage.label }),
  },
};

let renderProgressRing = null;
let renderIntervalId = null;
let shownView = null;
let lastRunRoutineId = null;
let isCommandInFlight = false;

const hasShortStages = (stages) =>
  stages.some((stage) => stage.durationSec < ROUTINE_LIMITS.stageMinSec);

const sumDurationSec = (stages) => stages.reduce((totalSec, stage) => totalSec + stage.durationSec, 0);

function setButtonContent(button, iconName, text) {
  if (button.dataset.icon === iconName && button.textContent === text) return;
  button.dataset.icon = iconName;
  const label = createElement("span", { text });
  button.replaceChildren(...(iconName ? [createIcon(iconName), label] : [label]));
}

function getDisplayedRun(now) {
  const { storedRun, settings } = getPopupState();
  return planCatchUp(storedRun, now, {
    autoAdvance: settings.autoAdvance !== false,
    graceMs: CATCH_UP_GRACE_MS,
  }).run;
}

export function getActiveRun() {
  return getDisplayedRun(Date.now());
}

async function runCommand(action, payload, messageElement) {
  if (isCommandInFlight) return;
  isCommandInFlight = true;
  messageElement.textContent = "";
  try {
    await sendRunCommand(action, payload);
  } catch (error) {
    console.error(`${action} failed:`, error);
    messageElement.textContent = UI_STRINGS.timer.unreachable;
  } finally {
    isCommandInFlight = false;
  }
}

function createRoutineCard(routine) {
  const stages = expandRoutine(routine);
  const totalSec = sumDurationSec(stages);
  const durationText = formatDurationText(totalSec);

  const card = createElement("button", { className: "routine-card" });
  card.type = "button";
  card.dataset.routineId = routine.id;
  card.setAttribute(
    "aria-label",
    formatUiString(UI_STRINGS.timer.startRoutine, { name: routine.name, duration: durationText })
  );

  const heading = createElement("span", { className: "routine-card-heading" });
  heading.append(
    createIcon("play"),
    createElement("span", { className: "routine-card-name", text: routine.name }),
    createElement("span", { className: "routine-card-duration", text: durationText })
  );
  card.append(heading, createStageStrip(stages));

  let note = "";
  if (totalSec === 0) {
    note = UI_STRINGS.timer.noDuration;
    card.disabled = true;
  } else if (hasShortStages(stages)) {
    note = formatUiString(UI_STRINGS.timer.shortStages, { seconds: ROUTINE_LIMITS.stageMinSec });
  }
  if (note) {
    const noteId = `routine_card_note_${routine.id}`;
    card.append(createElement("span", { className: "routine-card-note", text: note, attributes: { id: noteId } }));
    card.setAttribute("aria-describedby", noteId);
  }

  card.addEventListener("click", () =>
    runCommand("startRoutine", { routineId: routine.id }, elements.idleMessage)
  );
  const item = createElement("li");
  item.append(card);
  return item;
}

function findRoutineCard(routineId) {
  return [...elements.cards.querySelectorAll(".routine-card")].find(
    (card) => card.dataset.routineId === routineId
  );
}

function renderRoutineCards() {
  const { routines, routinesLoadFailed } = getPopupState();
  const focusedRoutineId = elements.cards.contains(document.activeElement)
    ? document.activeElement.dataset.routineId
    : null;

  elements.cards.replaceChildren(...routines.map(createRoutineCard));
  const hasRoutines = routines.length > 0;
  elements.cards.hidden = !hasRoutines;
  elements.newRoutineButton.hidden = !hasRoutines;
  elements.emptyState.hidden = hasRoutines || routinesLoadFailed;
  if (routinesLoadFailed) elements.idleMessage.textContent = UI_STRINGS.timer.loadFailed;

  if (focusedRoutineId) findRoutineCard(focusedRoutineId)?.focus();
}

export function focusTimer(routineId) {
  if (shownView === "run") {
    elements.primaryButton.focus();
    return;
  }
  const target =
    (routineId && findRoutineCard(routineId)) ??
    elements.cards.querySelector(".routine-card:not(:disabled)") ??
    (elements.newRoutineButton.hidden ? elements.createRoutineButton : elements.newRoutineButton);
  target.focus();
}

function startRenderLoop() {
  if (renderIntervalId === null) {
    renderIntervalId = setInterval(renderTimer, RENDER_INTERVAL_MS);
  }
}

function stopRenderLoop() {
  clearInterval(renderIntervalId);
  renderIntervalId = null;
}

function showIdleView() {
  stopRenderLoop();
  const focusWasInRunView = elements.runView.contains(document.activeElement);
  elements.runView.hidden = true;
  elements.idleView.hidden = false;
  const wasShowingRun = shownView === "run";
  shownView = "idle";
  if (wasShowingRun && focusWasInRunView) focusTimer(lastRunRoutineId);
}

function describeStageLine(run) {
  const stage = run.stages[run.stageIndex];
  const position = { label: stage.label, n: run.stageIndex + 1, total: run.stages.length };
  if (run.status === "awaitingNext") {
    const finishedStage = run.stages[run.stageIndex - 1] ?? stage;
    return {
      kind: finishedStage.kind,
      text: formatUiString(UI_STRINGS.timer.stageDone, { label: finishedStage.label }),
    };
  }
  const template =
    run.status === "paused" ? UI_STRINGS.timer.pausedPosition : UI_STRINGS.timer.stagePosition;
  return { kind: stage.kind, text: formatUiString(template, position) };
}

function describeNextStage(run) {
  const nextStage =
    run.status === "awaitingNext" ? run.stages[run.stageIndex] : run.stages[run.stageIndex + 1];
  if (!nextStage) return UI_STRINGS.timer.lastStage;
  return formatUiString(UI_STRINGS.timer.next, {
    label: nextStage.label,
    duration: formatDurationText(nextStage.durationSec),
  });
}

function renderRunControls(run) {
  const stage = run.stages[run.stageIndex];
  const primaryAction = PRIMARY_ACTIONS[run.status];
  setButtonContent(elements.primaryButton, primaryAction.icon, primaryAction.text(stage));
  elements.primaryButton.dataset.action = primaryAction.action;
  elements.extendButton.hidden = run.status === "awaitingNext";
  elements.extendButton.disabled = stage.durationSec + EXTEND_MINUTES * 60 > EXTENDED_STAGE_MAX_SEC;
}

function showRunView(run, now) {
  const focusWasInIdleView = elements.idleView.contains(document.activeElement);
  const enteringRunView = shownView !== "run";
  elements.idleView.hidden = true;
  elements.runView.hidden = false;
  shownView = "run";
  lastRunRoutineId = run.routineId;

  const { stageRemainingMs, routineRemainingMs } = getRunProgress(run, now);
  const stageLine = describeStageLine(run);
  setTextIfChanged(elements.routineName, run.routineName);
  setTextIfChanged(elements.stageLine, stageLine.text);
  elements.stageLine.dataset.kind = stageLine.kind;
  setTextIfChanged(elements.countdown, formatTimerCountdown(stageRemainingMs));
  setTextIfChanged(elements.next, describeNextStage(run));
  setTextIfChanged(
    elements.endsAt,
    formatUiString(UI_STRINGS.timer.endsAt, {
      time: formatClockTime(now + routineRemainingMs, getPopupState().settings.timeFormat, UI_STRINGS.formats),
    })
  );
  renderRunControls(run);
  renderProgressRing(run, stageRemainingMs);
  startRenderLoop();

  if (enteringRunView && focusWasInIdleView) elements.primaryButton.focus();
}

export function renderTimer() {
  const now = Date.now();
  const run = getDisplayedRun(now);
  if (run) {
    showRunView(run, now);
  } else {
    showIdleView();
  }
}

export function initializeTimerView({ openRoutineEditor }) {
  renderProgressRing = createProgressRing(elements.ring);
  setButtonContent(elements.skipButton, "skip", UI_STRINGS.timer.skip);
  setButtonContent(
    elements.extendButton,
    "",
    formatUiString(UI_STRINGS.timer.extend, { minutes: EXTEND_MINUTES })
  );
  setButtonContent(elements.stopButton, "stop", UI_STRINGS.timer.stop);
  setButtonContent(elements.newRoutineButton, "plus", UI_STRINGS.timer.newRoutine);

  elements.primaryButton.addEventListener("click", () =>
    runCommand(elements.primaryButton.dataset.action, {}, elements.runMessage)
  );
  elements.skipButton.addEventListener("click", () =>
    runCommand("skipStage", {}, elements.runMessage)
  );
  elements.extendButton.addEventListener("click", () =>
    runCommand("extendStage", { minutes: EXTEND_MINUTES }, elements.runMessage)
  );
  elements.stopButton.addEventListener("click", () =>
    runCommand("stopRoutine", {}, elements.runMessage)
  );
  const getVisibleNewRoutineButton = () =>
    elements.newRoutineButton.hidden ? elements.createRoutineButton : elements.newRoutineButton;
  [elements.newRoutineButton, elements.createRoutineButton].forEach((button) =>
    button.addEventListener("click", () =>
      openRoutineEditor({ returnFocusTo: getVisibleNewRoutineButton })
    )
  );

  subscribeToPopupState((change) => {
    if (change.routines) renderRoutineCards();
    if (change.run || change.settings) renderTimer();
  });
  renderRoutineCards();
  renderTimer();
}
