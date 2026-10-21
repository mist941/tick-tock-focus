import {
  ROUTINE_LIMITS,
  ROUTINE_SCHEMA_VERSION,
  STAGE_KINDS,
  validateRoutine,
} from "../shared/routine.js";
import { createElement } from "./dom-helpers.js";
import {
  MAX_EDITOR_MINUTES,
  MAX_EDITOR_SECONDS,
  addRepeatGroup,
  addStage,
  canAddRepeatGroup,
  canMove,
  countEditorRows,
  createEditorModel,
  describeModelContent,
  exceedsEditorRows,
  findItem,
  listEditorItems,
  mapValidationErrors,
  moveItem,
  moveItemTo,
  removeItem,
  summarizeModel,
  toRoutineBlocks,
  updateGroupTimes,
  updateName,
  updateStage,
} from "./editor-model.js";
import { createIcon } from "./icons.js";
import { closeScreen, openScreen, registerScreen } from "./navigation.js";
import { reloadRoutines } from "./popup-state.js";
import * as PopupStorage from "./popup-storage.js";
import { getActiveRun } from "./timer-view.js";
import { UI_STRINGS, formatDurationText, formatUiString } from "./ui-strings.js";

const KIND_LABELS = UI_STRINGS.editor.kinds;
const MODEL_OPTIONS = { kindLabels: KIND_LABELS };

const elements = {
  heading: document.getElementById("editor_heading"),
  form: document.getElementById("editor_form"),
  nameInput: document.getElementById("editor_name"),
  nameError: document.getElementById("editor_name_error"),
  runningNote: document.getElementById("editor_running_note"),
  limitNote: document.getElementById("editor_limit_note"),
  blocks: document.getElementById("editor_blocks"),
  addStageButton: document.getElementById("editor_add_stage"),
  addGroupButton: document.getElementById("editor_add_group"),
  routineError: document.getElementById("editor_routine_error"),
  status: document.getElementById("editor_status"),
  total: document.getElementById("editor_total"),
  cancelButton: document.getElementById("editor_cancel"),
  saveButton: document.getElementById("editor_save"),
  discardPrompt: document.getElementById("editor_discard"),
  discardButton: document.getElementById("editor_discard_confirm"),
  keepEditingButton: document.getElementById("editor_keep_editing"),
};

const FIELD_CONTROLS = {
  label: ["label"],
  duration: ["minutes", "seconds"],
  kind: ["kind"],
  times: ["times"],
  stages: ["add-stage"],
  row: [],
};

let model = null;
let originalRoutine = null;
let initialContent = "";
let fieldErrors = [];
let draggedKey = null;
let focusBeforeDiscardPrompt = null;

export function openRoutineEditor({ routine = null, returnFocusTo } = {}) {
  openScreen("editor", { returnFocusTo, options: { routine } });
}

const getItemElement = (key) => elements.blocks.querySelector(`[data-key="${CSS.escape(key)}"]`);

const getControl = (key, control) =>
  getItemElement(key)?.querySelector(`[data-control="${control}"]:not(:scope .editor-row *)`);

function findStage(key) {
  const item = findItem(model, key);
  if (!item || item.type !== "stage") return null;
  const block = model.blocks[item.blockIndex];
  return item.stageIndex === null ? block : block.stages[item.stageIndex];
}

const describeGroupNumber = (groupNumber) =>
  formatUiString(UI_STRINGS.editor.groupNumber, { position: groupNumber });

function createIconButton(iconName, label, control) {
  const button = createElement("button", {
    className: "icon-button editor-icon-button",
    attributes: { type: "button", "aria-label": label, title: label, "data-control": control },
  });
  button.append(createIcon(iconName));
  return button;
}

function createMoveButtons(key, labels) {
  const moveButtons = createElement("span", { className: "move-buttons" });
  ["up", "down"].forEach((direction) => {
    const button = createIconButton(direction, labels[direction], direction);
    button.disabled = !canMove(model, key, direction);
    button.addEventListener("click", () => moveEditorItem(key, direction));
    moveButtons.append(button);
  });
  return moveButtons;
}

function createItemActions(moveButtons, removeButton) {
  const actions = createElement("span", { className: "editor-item-actions" });
  actions.append(moveButtons, removeButton);
  return actions;
}

function createGrip() {
  const grip = createElement("span", {
    className: "drag-handle",
    attributes: { "aria-hidden": "true", "data-control": "grip" },
  });
  grip.append(createIcon("grip"));
  return grip;
}

function createUnit(text) {
  return createElement("span", { className: "unit", text, attributes: { "aria-hidden": "true" } });
}

function createNumberInput({ value, control, label, maxLength, errorId }) {
  return createElement("input", {
    className: "input number-input",
    attributes: {
      type: "text",
      inputmode: "numeric",
      autocomplete: "off",
      maxlength: String(maxLength),
      value,
      "aria-label": label,
      "aria-describedby": errorId,
      "data-control": control,
    },
  });
}

function createKindSelect(stage, stageName) {
  const kindSelect = createElement("select", {
    className: "input kind-select",
    attributes: {
      "aria-label": formatUiString(UI_STRINGS.editor.kindOf, { step: stageName }),
      "data-control": "kind",
    },
  });
  STAGE_KINDS.forEach((kind) => {
    const option = createElement("option", { text: KIND_LABELS[kind], attributes: { value: kind } });
    option.selected = kind === stage.kind;
    kindSelect.append(option);
  });
  return kindSelect;
}

function createStageRow(stage, item) {
  const row = createElement("li", { className: "editor-row" });
  row.dataset.key = stage.key;
  row.dataset.kind = stage.kind;
  const stageName = formatUiString(UI_STRINGS.editor.stageNumber, { position: item.stageNumber });
  const errorId = `editor_error_${stage.key}`;

  const kindSelect = createKindSelect(stage, stageName);
  const labelInput = createElement("input", {
    className: "input label-input",
    attributes: {
      type: "text",
      autocomplete: "off",
      maxlength: String(ROUTINE_LIMITS.labelMaxLength),
      value: stage.label,
      "aria-label": formatUiString(UI_STRINGS.editor.labelOf, { step: stageName }),
      "aria-describedby": errorId,
      "data-control": "label",
    },
  });
  const minutesInput = createNumberInput({
    value: stage.minutes,
    control: "minutes",
    label: formatUiString(UI_STRINGS.editor.minutesOf, { step: stageName }),
    maxLength: String(MAX_EDITOR_MINUTES).length,
    errorId,
  });
  const secondsInput = createNumberInput({
    value: stage.seconds,
    control: "seconds",
    label: formatUiString(UI_STRINGS.editor.secondsOf, { step: stageName }),
    maxLength: 2,
    errorId,
  });

  kindSelect.addEventListener("change", () => {
    model = updateStage(model, stage.key, { kind: kindSelect.value }, MODEL_OPTIONS);
    const updatedStage = findStage(stage.key);
    row.dataset.kind = updatedStage.kind;
    labelInput.value = updatedStage.label;
  });
  labelInput.addEventListener("input", () => {
    model = updateStage(model, stage.key, { label: labelInput.value }, MODEL_OPTIONS);
    clearFieldError(stage.key, "label");
  });
  [
    [minutesInput, "minutes", MAX_EDITOR_MINUTES],
    [secondsInput, "seconds", MAX_EDITOR_SECONDS],
  ].forEach(([input, field, max]) => {
    input.addEventListener("input", () => {
      const digits = input.value.replace(/\D/g, "");
      input.value = digits === "" ? "" : String(Math.min(Number(digits), max));
      model = updateStage(model, stage.key, { [field]: input.value }, MODEL_OPTIONS);
      clearFieldError(stage.key, "duration");
      renderFooter();
    });
  });

  const removeButton = createIconButton(
    "close",
    formatUiString(UI_STRINGS.editor.removeStage, { step: stageName }),
    "remove"
  );
  removeButton.addEventListener("click", () => removeEditorItem(stage.key));

  const controls = createElement("div", { className: "editor-row-controls" });
  controls.append(
    kindSelect,
    minutesInput,
    createUnit(UI_STRINGS.editor.minutesUnit),
    secondsInput,
    createUnit(UI_STRINGS.editor.secondsUnit),
    createItemActions(
      createMoveButtons(stage.key, {
        up: formatUiString(UI_STRINGS.editor.moveStageUp, { step: stageName }),
        down: formatUiString(UI_STRINGS.editor.moveStageDown, { step: stageName }),
      }),
      removeButton
    )
  );
  const fields = createElement("div", { className: "editor-row-fields" });
  fields.append(createGrip(), labelInput, controls);
  row.append(fields, createElement("p", { className: "field-error", attributes: { id: errorId } }));
  makeDraggable(row, stage.key);
  return row;
}

function createTimesSelect(group, groupName, errorId) {
  const timesSelect = createElement("select", {
    className: "input times-select",
    attributes: {
      "aria-label": formatUiString(UI_STRINGS.editor.repeatCountOf, { group: groupName }),
      "aria-describedby": errorId,
      "data-control": "times",
    },
  });
  for (
    let times = ROUTINE_LIMITS.repeatMinTimes;
    times <= ROUTINE_LIMITS.repeatMaxTimes;
    times += 1
  ) {
    const option = createElement("option", {
      text: formatUiString(UI_STRINGS.editor.timesOption, { times }),
      attributes: { value: String(times) },
    });
    option.selected = times === group.times;
    timesSelect.append(option);
  }
  timesSelect.addEventListener("change", () => {
    model = updateGroupTimes(model, group.key, Number(timesSelect.value));
    renderFooter();
  });
  return timesSelect;
}

function createGroupBlock(group, item, items) {
  const groupElement = createElement("li", { className: "editor-group" });
  groupElement.dataset.key = group.key;
  const groupName = describeGroupNumber(item.groupNumber);
  const errorId = `editor_error_${group.key}`;

  const removeButton = createIconButton(
    "close",
    formatUiString(UI_STRINGS.editor.removeGroup, { group: groupName }),
    "remove"
  );
  removeButton.addEventListener("click", () => removeEditorItem(group.key));

  const header = createElement("div", { className: "editor-group-header" });
  header.append(
    createGrip(),
    createElement("span", { className: "editor-group-title", text: UI_STRINGS.editor.repeat }),
    createTimesSelect(group, groupName, errorId),
    createItemActions(
      createMoveButtons(group.key, {
        up: formatUiString(UI_STRINGS.editor.moveGroupUp, { group: groupName }),
        down: formatUiString(UI_STRINGS.editor.moveGroupDown, { group: groupName }),
      }),
      removeButton
    )
  );

  const stageList = createElement("ol", {
    className: "editor-group-stages",
    attributes: { "aria-label": groupName },
  });
  const stageItems = items.filter((candidate) => candidate.groupKey === group.key);
  group.stages.forEach((stage, stageIndex) =>
    stageList.append(createStageRow(stage, stageItems[stageIndex]))
  );

  const addButton = createElement("button", {
    className: "text-button editor-group-add",
    attributes: { type: "button", "data-control": "add-stage", "aria-describedby": errorId },
  });
  addButton.append(
    createIcon("plus"),
    createElement("span", { text: UI_STRINGS.editor.addStageToGroup })
  );
  addButton.addEventListener("click", () => addEditorStage(group.key));

  groupElement.append(
    header,
    stageList,
    addButton,
    createElement("p", { className: "field-error", attributes: { id: errorId } })
  );
  makeDraggable(groupElement, group.key);
  return groupElement;
}

function renderBlocks({ focus } = {}) {
  const items = listEditorItems(model);
  elements.blocks.replaceChildren(
    ...model.blocks.map((block) => {
      const item = items.find((candidate) => candidate.key === block.key);
      return block.type === "repeat"
        ? createGroupBlock(block, item, items)
        : createStageRow(block, item);
    })
  );
  renderFieldErrors();
  renderFooter();
  if (focus) focusControl(focus);
}

function focusControl({ key, control }) {
  const target = getControl(key, control);
  if (target && !target.disabled) {
    target.focus();
    if (control === "label") target.select();
    return;
  }
  if (control === "up" || control === "down") {
    const otherButton = getControl(key, control === "up" ? "down" : "up");
    if (otherButton && !otherButton.disabled) {
      otherButton.focus();
      return;
    }
  }
  elements.addStageButton.focus();
}

function renderFooter() {
  const { expandedStageCount, totalDurationSec, editorRowCount } = summarizeModel(model);
  const template =
    expandedStageCount === 1 ? UI_STRINGS.editor.totalOneStep : UI_STRINGS.editor.total;
  elements.total.textContent = formatUiString(template, {
    duration: formatDurationText(totalDurationSec),
    count: expandedStageCount,
  });

  const isOverRowLimit = exceedsEditorRows(model);
  elements.limitNote.hidden = !isOverRowLimit;
  elements.limitNote.textContent = isOverRowLimit
    ? formatUiString(UI_STRINGS.editor.rowLimit, {
        count: editorRowCount,
        limit: ROUTINE_LIMITS.maxEditorRows,
      })
    : "";
  elements.saveButton.disabled = isOverRowLimit;

  const isAtRowLimit = editorRowCount >= ROUTINE_LIMITS.maxEditorRows;
  elements.addStageButton.disabled = isAtRowLimit;
  elements.addGroupButton.disabled = !canAddRepeatGroup(model);
  elements.blocks.querySelectorAll('[data-control="add-stage"]').forEach((button) => {
    button.disabled = isAtRowLimit;
  });
}

function describeError(error) {
  const template = UI_STRINGS.editor.errors[error.code] ?? UI_STRINGS.editor.errors.invalid;
  return formatUiString(template, {
    limit: typeof error.limit === "number" ? error.limit : "",
    count: summarizeModel(model).expandedStageCount,
  });
}

function renderFieldErrors() {
  elements.nameError.textContent = "";
  elements.nameInput.removeAttribute("aria-invalid");
  elements.routineError.textContent = "";
  elements.blocks.querySelectorAll(".field-error").forEach((errorElement) => {
    errorElement.textContent = "";
  });
  elements.blocks.querySelectorAll('[aria-invalid="true"]').forEach((control) =>
    control.removeAttribute("aria-invalid")
  );

  fieldErrors.forEach(({ key, field, error }) => {
    const message = describeError(error);
    if (field === "name") {
      elements.nameError.textContent = message;
      elements.nameInput.setAttribute("aria-invalid", "true");
      return;
    }
    if (key === null) {
      elements.routineError.textContent = message;
      return;
    }
    const errorElement = document.getElementById(`editor_error_${key}`);
    if (!errorElement) return;
    errorElement.textContent = errorElement.textContent
      ? `${errorElement.textContent} ${message}`
      : message;
    (FIELD_CONTROLS[field] ?? []).forEach((control) =>
      getControl(key, control)?.setAttribute("aria-invalid", "true")
    );
  });
}

function clearFieldError(key, field) {
  const remainingErrors = fieldErrors.filter(
    (fieldError) => !(fieldError.key === key && fieldError.field === field)
  );
  if (remainingErrors.length === fieldErrors.length) return;
  fieldErrors = remainingErrors;
  renderFieldErrors();
}

function focusFirstError() {
  const firstInvalid = elements.form.querySelector('[aria-invalid="true"]');
  if (firstInvalid) {
    firstInvalid.focus();
  } else if (elements.routineError.textContent) {
    elements.routineError.focus();
  }
}

function announceMove(key) {
  const item = findItem(model, key);
  if (!item) return;
  if (item.type === "repeat") {
    elements.status.textContent = formatUiString(UI_STRINGS.editor.groupMoved, {
      group: describeGroupNumber(item.groupNumber),
    });
    return;
  }
  const groupItem = item.groupKey ? findItem(model, item.groupKey) : null;
  const template = groupItem ? UI_STRINGS.editor.stageMovedInGroup : UI_STRINGS.editor.stageMoved;
  elements.status.textContent = formatUiString(template, {
    label: findStage(key).label,
    position: item.stageNumber,
    count: countEditorRows(model),
    group: groupItem ? describeGroupNumber(groupItem.groupNumber) : "",
  });
}

function moveEditorItem(key, direction) {
  model = moveItem(model, key, direction);
  renderBlocks({ focus: { key, control: direction } });
  announceMove(key);
}

function removeEditorItem(key) {
  const items = listEditorItems(model);
  const removedItem = items.find((item) => item.key === key);
  const isTopLevel = removedItem.type === "repeat" || removedItem.groupKey === null;
  const siblings = items.filter((item) =>
    item.key !== key && (isTopLevel ? item.stageIndex === null : item.groupKey === removedItem.groupKey)
  );
  const removedPosition = items.indexOf(removedItem);
  const nextFocusItem =
    siblings.find((item) => items.indexOf(item) > removedPosition) ?? siblings.at(-1);

  model = removeItem(model, key);
  fieldErrors = fieldErrors.filter((fieldError) => fieldError.key !== key);
  if (nextFocusItem) {
    renderBlocks({ focus: { key: nextFocusItem.key, control: "remove" } });
    return;
  }
  renderBlocks();
  const groupAddButton = removedItem.groupKey ? getControl(removedItem.groupKey, "add-stage") : null;
  (groupAddButton ?? elements.addStageButton).focus();
}

function addEditorStage(groupKey = null) {
  const { model: nextModel, addedKey } = addStage(model, { groupKey, ...MODEL_OPTIONS });
  model = nextModel;
  fieldErrors = fieldErrors.filter(
    (fieldError) => !(fieldError.key === groupKey && fieldError.field === "stages")
  );
  renderBlocks({ focus: { key: addedKey, control: "label" } });
}

function addEditorGroup() {
  const { model: nextModel, addedKey } = addRepeatGroup(model, MODEL_OPTIONS);
  model = nextModel;
  renderBlocks({ focus: { key: addedKey, control: "times" } });
}

function findDropTarget(event) {
  const draggedItem = findItem(model, draggedKey);
  const targetElement = event.target.closest?.(
    ".editor-row, .editor-group-header, .editor-group-add"
  );
  if (!draggedItem || !targetElement) {
    return { target: { groupKey: null, index: model.blocks.length }, element: null };
  }
  const box = targetElement.getBoundingClientRect();
  const isBefore = event.clientY < box.top + box.height / 2;
  const drop = (target, before = isBefore) => ({ target, element: targetElement, isBefore: before });

  if (targetElement.classList.contains("editor-row")) {
    const item = findItem(model, targetElement.dataset.key);
    if (item.groupKey && draggedItem.type === "stage") {
      return drop({ groupKey: item.groupKey, index: item.stageIndex + (isBefore ? 0 : 1) });
    }
    return drop({ groupKey: null, index: item.blockIndex + (isBefore ? 0 : 1) });
  }

  const groupKey = targetElement.closest(".editor-group").dataset.key;
  const groupItem = findItem(model, groupKey);
  if (targetElement.classList.contains("editor-group-header")) {
    if (!isBefore && draggedItem.type === "stage") return drop({ groupKey, index: 0 }, false);
    return drop({ groupKey: null, index: groupItem.blockIndex + (isBefore ? 0 : 1) });
  }
  if (draggedItem.type === "stage") {
    return drop({ groupKey, index: model.blocks[groupItem.blockIndex].stages.length }, true);
  }
  return drop({ groupKey: null, index: groupItem.blockIndex + 1 }, false);
}

function clearDropIndicators() {
  elements.blocks
    .querySelectorAll(".drop-before, .drop-after")
    .forEach((element) => element.classList.remove("drop-before", "drop-after"));
}

function makeDraggable(itemElement, key) {
  const grip = itemElement.querySelector(
    ":scope > .editor-row-fields > .drag-handle, :scope > .editor-group-header > .drag-handle"
  );
  grip.addEventListener("pointerdown", () => {
    itemElement.draggable = true;
  });
  itemElement.addEventListener("dragstart", (event) => {
    if (!itemElement.draggable || draggedKey !== null) return;
    event.stopPropagation();
    draggedKey = key;
    itemElement.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", key);
  });
  itemElement.addEventListener("dragend", () => {
    itemElement.draggable = false;
    itemElement.classList.remove("is-dragging");
    draggedKey = null;
    clearDropIndicators();
  });
}

function initializeDragAndDrop() {
  elements.blocks.addEventListener("dragover", (event) => {
    if (draggedKey === null) return;
    event.preventDefault();
    const { element, isBefore } = findDropTarget(event);
    clearDropIndicators();
    element?.classList.add(isBefore ? "drop-before" : "drop-after");
  });
  elements.blocks.addEventListener("drop", (event) => {
    if (draggedKey === null) return;
    event.preventDefault();
    const movedKey = draggedKey;
    model = moveItemTo(model, movedKey, findDropTarget(event).target);
    draggedKey = null;
    renderBlocks();
    announceMove(movedKey);
  });
  document.addEventListener("pointerup", () => {
    if (draggedKey !== null) return;
    elements.blocks.querySelectorAll('[draggable="true"]').forEach((element) => {
      element.draggable = false;
    });
  });
}

function loadRoutine(routine) {
  originalRoutine = routine;
  model = createEditorModel(routine, MODEL_OPTIONS);
  initialContent = describeModelContent(model);
  fieldErrors = [];
  elements.heading.textContent = routine
    ? UI_STRINGS.editor.editHeading
    : UI_STRINGS.editor.newHeading;
  elements.nameInput.value = model.name;
  elements.discardPrompt.hidden = true;
  elements.status.textContent = "";
  const activeRun = getActiveRun();
  elements.runningNote.hidden = !(routine && activeRun?.routineId === routine.id);
  renderBlocks();
  elements.form.scrollTop = 0;
}

async function saveEditedRoutine() {
  const now = Date.now();
  const routine = {
    ...(originalRoutine ?? { id: crypto.randomUUID(), createdAt: now }),
    schemaVersion: ROUTINE_SCHEMA_VERSION,
    name: model.name.trim(),
    blocks: toRoutineBlocks(model),
    updatedAt: now,
  };
  const validationErrors = validateRoutine(routine);
  if (validationErrors.length > 0) {
    fieldErrors = mapValidationErrors(model, validationErrors);
    renderFieldErrors();
    focusFirstError();
    return;
  }

  try {
    await PopupStorage.saveRoutine(routine);
  } catch (error) {
    console.error("Error saving the routine:", error);
    elements.routineError.textContent = UI_STRINGS.editor.saveFailed;
    elements.routineError.focus();
    return;
  }
  initialContent = describeModelContent(model);
  await reloadRoutines();
  closeScreen();
}

const hasUnsavedChanges = () => model !== null && describeModelContent(model) !== initialContent;

function showDiscardPrompt() {
  focusBeforeDiscardPrompt = document.activeElement;
  elements.discardPrompt.hidden = false;
  elements.keepEditingButton.focus();
}

function hideDiscardPrompt() {
  elements.discardPrompt.hidden = true;
  (focusBeforeDiscardPrompt?.isConnected ? focusBeforeDiscardPrompt : elements.nameInput).focus();
}

function requestLeave() {
  if (hasUnsavedChanges()) {
    if (elements.discardPrompt.hidden) showDiscardPrompt();
    return false;
  }
  return true;
}

export function initializeRoutineEditor() {
  elements.nameInput.maxLength = ROUTINE_LIMITS.nameMaxLength;
  elements.nameInput.addEventListener("input", () => {
    model = updateName(model, elements.nameInput.value);
    clearFieldError(null, "name");
  });
  elements.addStageButton.replaceChildren(
    createIcon("plus"),
    createElement("span", { text: UI_STRINGS.editor.addStage })
  );
  elements.addGroupButton.replaceChildren(
    createIcon("plus"),
    createElement("span", { text: UI_STRINGS.editor.addGroup })
  );
  elements.addStageButton.addEventListener("click", () => addEditorStage());
  elements.addGroupButton.addEventListener("click", addEditorGroup);
  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveEditedRoutine();
  });
  elements.saveButton.addEventListener("click", saveEditedRoutine);
  elements.cancelButton.addEventListener("click", () => {
    if (requestLeave()) closeScreen();
  });
  elements.discardButton.addEventListener("click", () => {
    initialContent = describeModelContent(model);
    elements.discardPrompt.hidden = true;
    closeScreen();
  });
  elements.keepEditingButton.addEventListener("click", hideDiscardPrompt);
  elements.discardPrompt.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    hideDiscardPrompt();
  });
  initializeDragAndDrop();

  registerScreen("editor", {
    onOpen: ({ routine } = {}) => loadRoutine(routine ?? null),
    canClose: requestLeave,
  });
}
