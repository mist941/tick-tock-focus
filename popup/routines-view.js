import { ROUTINE_LIMITS, expandRoutine } from "../shared/routine.js";
import { createElement } from "./dom-helpers.js";
import { createIcon } from "./icons.js";
import { createMenuButton } from "./menu-button.js";
import { switchTab } from "./navigation.js";
import { getPopupState, reloadRoutines, subscribeToPopupState } from "./popup-state.js";
import * as PopupStorage from "./popup-storage.js";
import { sendRunCommand } from "./run-commands.js";
import { focusTimer, getActiveRun } from "./timer-view.js";
import { showToast } from "./toast.js";
import { UI_STRINGS, formatDurationText, formatUiString } from "./ui-strings.js";

const elements = {
  message: document.getElementById("routines_message"),
  list: document.getElementById("routine_list"),
  emptyState: document.getElementById("routines_empty"),
  newRoutineButton: document.getElementById("routines_new_routine"),
};

let pendingReplacementRoutineId = null;
let renderedActiveRoutineId;
let openRoutineEditor = () => {};

export function showRoutinesMessage(text) {
  elements.message.textContent = text;
}

function describeRoutine(routine) {
  const stages = expandRoutine(routine);
  const totalSec = stages.reduce((sumSec, stage) => sumSec + stage.durationSec, 0);
  const template =
    stages.length === 1 ? UI_STRINGS.routines.summaryOneStep : UI_STRINGS.routines.summary;
  return formatUiString(template, { count: stages.length, duration: formatDurationText(totalSec) });
}

function copyNameFor(name) {
  return formatUiString(UI_STRINGS.routines.copyName, { name })
    .slice(0, ROUTINE_LIMITS.nameMaxLength)
    .trimEnd();
}

const findRow = (routineId) =>
  [...elements.list.children].find((row) => row.dataset.routineId === routineId);

function focusRowControl(routineId, control) {
  findRow(routineId)?.querySelector(`[data-row-control="${control}"]`)?.focus();
}

function focusRowAt(index) {
  const rows = [...elements.list.children];
  const row = rows[Math.min(index, rows.length - 1)];
  (row?.querySelector('[data-row-control="menu"]') ?? elements.newRoutineButton).focus();
}

async function startRoutine(routineId, { replaceRunning }) {
  try {
    await sendRunCommand("startRoutine", { routineId, replaceRunning });
  } catch (error) {
    console.error("startRoutine failed:", error);
    showRoutinesMessage(UI_STRINGS.timer.unreachable);
    return;
  }
  pendingReplacementRoutineId = null;
  renderRoutineList();
  switchTab("timer");
  focusTimer();
}

function handleStart(routine) {
  const activeRun = getActiveRun();
  if (activeRun && activeRun.routineId === routine.id) {
    switchTab("timer");
    focusTimer();
  } else if (activeRun) {
    pendingReplacementRoutineId = routine.id;
    renderRoutineList();
    focusRowControl(routine.id, "confirm-cancel");
  } else {
    startRoutine(routine.id, { replaceRunning: false });
  }
}

function cancelReplacement(routineId) {
  pendingReplacementRoutineId = null;
  renderRoutineList();
  focusRowControl(routineId, "start");
}

function createReplacementConfirmation(routine, activeRun) {
  const textId = `routine_confirm_text_${routine.id}`;
  const confirmation = createElement("div", {
    className: "row-confirmation",
    attributes: { role: "group", "aria-labelledby": textId },
  });
  const question = createElement("p", {
    text: formatUiString(UI_STRINGS.routines.confirmReplace, {
      running: activeRun.routineName,
      name: routine.name,
    }),
    attributes: { id: textId },
  });
  const startButton = createElement("button", {
    className: "button button-primary",
    text: UI_STRINGS.routines.confirmStart,
    attributes: { type: "button", "data-row-control": "confirm-start" },
  });
  const cancelButton = createElement("button", {
    className: "button button-secondary",
    text: UI_STRINGS.routines.confirmCancel,
    attributes: { type: "button", "data-row-control": "confirm-cancel" },
  });
  startButton.addEventListener("click", () => startRoutine(routine.id, { replaceRunning: true }));
  cancelButton.addEventListener("click", () => cancelReplacement(routine.id));
  confirmation.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    cancelReplacement(routine.id);
  });
  const actions = createElement("div", { className: "row-confirmation-actions" });
  actions.append(startButton, cancelButton);
  confirmation.append(question, actions);
  return confirmation;
}

function createRoutineRow(routine, activeRun, routineIndex) {
  const row = createElement("li", { className: "routine-row" });
  row.dataset.routineId = routine.id;

  const startButton = createElement("button", {
    className: "icon-button routine-row-start",
    attributes: {
      type: "button",
      "data-row-control": "start",
      "aria-label": formatUiString(UI_STRINGS.routines.start, { name: routine.name }),
      title: formatUiString(UI_STRINGS.routines.start, { name: routine.name }),
    },
  });
  startButton.append(createIcon("play"));
  startButton.addEventListener("click", () => handleStart(routine));

  const details = createElement("div", { className: "routine-row-details" });
  details.append(
    createElement("span", { className: "routine-row-name", text: routine.name }),
    createElement("span", { className: "routine-row-summary", text: describeRoutine(routine) })
  );
  if (activeRun && activeRun.routineId === routine.id) {
    details.append(
      createElement("span", { className: "routine-row-badge", text: UI_STRINGS.routines.running })
    );
  }

  const { container: menuContainer, button: menuButton } = createMenuButton({
    menuId: `routine_menu_${routineIndex}`,
    label: formatUiString(UI_STRINGS.routines.moreActions, { name: routine.name }),
    items: [
      {
        text: UI_STRINGS.routines.edit,
        onSelect: () =>
          openRoutineEditor({
            routine,
            returnFocusTo: () =>
              findRow(routine.id)?.querySelector('[data-row-control="menu"]') ??
              elements.newRoutineButton,
          }),
      },
      { text: UI_STRINGS.routines.duplicate, onSelect: () => duplicateRoutine(routine) },
      {
        text: UI_STRINGS.routines.delete,
        onSelect: () => deleteRoutine(routine, routineIndex),
        isDanger: true,
      },
    ],
  });
  menuButton.dataset.rowControl = "menu";

  const rowMain = createElement("div", { className: "routine-row-main" });
  rowMain.append(startButton, details, menuContainer);
  row.append(rowMain);
  if (pendingReplacementRoutineId === routine.id && activeRun) {
    row.append(createReplacementConfirmation(routine, activeRun));
  }
  return row;
}

function renderRoutineList() {
  const { routines, routinesLoadFailed } = getPopupState();
  const activeRun = getActiveRun();
  const focusedRow = document.activeElement?.closest?.(".routine-row");
  const focusedControl = focusedRow ? document.activeElement.dataset.rowControl : null;
  const focusedRoutineId = focusedRow?.dataset.routineId;

  if (!routines.some((routine) => routine.id === pendingReplacementRoutineId) || !activeRun) {
    pendingReplacementRoutineId = null;
  }
  elements.list.replaceChildren(
    ...routines.map((routine, index) => createRoutineRow(routine, activeRun, index))
  );
  elements.list.hidden = routines.length === 0;
  elements.emptyState.hidden = routines.length > 0 || routinesLoadFailed;
  if (routinesLoadFailed) showRoutinesMessage(UI_STRINGS.timer.loadFailed);
  renderedActiveRoutineId = activeRun?.routineId ?? null;

  if (focusedRoutineId && focusedControl) focusRowControl(focusedRoutineId, focusedControl);
}

async function duplicateRoutine(routine) {
  const now = Date.now();
  const copy = {
    ...structuredClone(routine),
    id: crypto.randomUUID(),
    name: copyNameFor(routine.name),
    createdAt: now,
    updatedAt: now,
  };
  try {
    await PopupStorage.saveRoutine(copy);
  } catch (error) {
    console.error("Error duplicating the routine:", error);
    showRoutinesMessage(UI_STRINGS.routines.saveFailed);
    return;
  }
  showRoutinesMessage("");
  await reloadRoutines();
  focusRowControl(copy.id, "menu");
  showToast({ message: formatUiString(UI_STRINGS.routines.duplicated, { name: copy.name }) });
}

async function restoreRoutine(routine) {
  try {
    await PopupStorage.saveRoutine(routine);
  } catch (error) {
    console.error("Error restoring the routine:", error);
    showRoutinesMessage(UI_STRINGS.routines.saveFailed);
    return;
  }
  await reloadRoutines();
  focusRowControl(routine.id, "menu");
}

async function deleteRoutine(routine, routineIndex) {
  try {
    await PopupStorage.deleteRoutine(routine.id);
  } catch (error) {
    console.error("Error deleting the routine:", error);
    showRoutinesMessage(UI_STRINGS.routines.deleteFailed);
    return;
  }
  showRoutinesMessage("");
  await reloadRoutines();
  focusRowAt(routineIndex);
  showToast({
    message: UI_STRINGS.routines.deleted,
    actionText: UI_STRINGS.routines.undo,
    onAction: () => restoreRoutine(routine),
    getFocusFallback: () =>
      elements.list.querySelector('[data-row-control="menu"]') ?? elements.newRoutineButton,
  });
}

export function initializeRoutinesView({ openRoutineEditor: openEditor }) {
  openRoutineEditor = openEditor;
  elements.newRoutineButton.replaceChildren(
    createIcon("plus"),
    createElement("span", { text: UI_STRINGS.routines.newRoutine })
  );
  elements.newRoutineButton.addEventListener("click", () =>
    openRoutineEditor({ returnFocusTo: elements.newRoutineButton })
  );
  subscribeToPopupState((change) => {
    const activeRoutineChanged = (getActiveRun()?.routineId ?? null) !== renderedActiveRoutineId;
    if (change.routines || ((change.run || change.settings) && activeRoutineChanged)) {
      renderRoutineList();
    }
  });
  renderRoutineList();
}
