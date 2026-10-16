import { ROUTINE_LIMITS, ROUTINE_SCHEMA_VERSION, validateRoutine } from "../shared/routine.js";
import { padTwoDigits } from "../shared/format.js";
import { makeStepLabel } from "../shared/stage-labels.js";
import { createElement } from "./dom-helpers.js";
import * as PopupStorage from "./popup-storage.js";
import { switchTab } from "./navigation.js";
import { reloadRoutines } from "./popup-state.js";
import { showRoutinesMessage } from "./routines-view.js";
import { UI_STRINGS, formatUiString } from "./ui-strings.js";

const SEGMENT_FIELD_LIMITS = {
  hours: { min: 0, max: 23, label: UI_STRINGS.presetForm.hours },
  minutes: { min: 0, max: 59, label: UI_STRINGS.presetForm.minutes },
  seconds: { min: 0, max: 59, label: UI_STRINGS.presetForm.seconds },
};

let returnFocusTarget = null;

const elements = {
  form: document.getElementById("preset_form"),
  cancelButton: document.getElementById("cancel_preset"),
  saveButton: document.getElementById("add_preset"),
  addSegmentButton: document.getElementById("add_preset_clock"),
  inputs: {
    name: document.getElementById("preset_name"),
    hours: document.getElementById("preset_hours"),
    minutes: document.getElementById("preset_minutes"),
    seconds: document.getElementById("preset_seconds"),
  },
  list: document.querySelector(".clock-presets-list"),
  segmentsStatus: document.getElementById("segments_status"),
  errors: {
    name: document.getElementById("preset_name_error"),
    segment: document.getElementById("segment_error"),
    segments: document.getElementById("segments_error"),
  },
};

function getFieldInputs(field) {
  const { name, hours, minutes, seconds } = elements.inputs;
  const inputsByField = {
    name: [name],
    segment: [hours, minutes, seconds],
    segments: [],
  };
  return inputsByField[field];
}

function showFieldError(field, text) {
  elements.errors[field].textContent = text;
  getFieldInputs(field).forEach((input) => {
    if (text) {
      input.setAttribute("aria-invalid", "true");
    } else {
      input.removeAttribute("aria-invalid");
    }
  });
}

function clearFieldErrors() {
  Object.keys(elements.errors).forEach((field) => showFieldError(field, ""));
}

function clearForm() {
  Object.values(elements.inputs).forEach((input) => {
    input.value = "";
  });
  elements.list.replaceChildren();
  elements.segmentsStatus.textContent = "";
}

function clearSegmentInputs() {
  elements.inputs.hours.value = "";
  elements.inputs.minutes.value = "";
  elements.inputs.seconds.value = "";
}

function showForm() {
  elements.form.style.display = "block";
  elements.inputs.name.focus();
}

function hideForm() {
  elements.form.style.display = "none";
  clearForm();
  clearFieldErrors();
  returnFocusTarget?.focus();
}

const getSegmentItems = () => [...elements.list.querySelectorAll(".preset-item")];

async function savePreset() {
  try {
    const presetName = elements.inputs.name.value.trim();
    const segmentItems = getSegmentItems();

    let nameError = "";
    if (!presetName) {
      nameError = UI_STRINGS.presetForm.nameMissing;
    } else if (presetName.length > ROUTINE_LIMITS.nameMaxLength) {
      nameError = formatUiString(UI_STRINGS.presetForm.nameTooLong, {
        count: ROUTINE_LIMITS.nameMaxLength,
      });
    }
    const segmentsError = segmentItems.length === 0 ? UI_STRINGS.presetForm.noSegments : "";

    showFieldError("name", nameError);
    showFieldError("segments", segmentsError);
    if (nameError) {
      elements.inputs.name.focus();
      return;
    }
    if (segmentsError) {
      elements.inputs.hours.focus();
      return;
    }

    const now = Date.now();
    const routine = {
      id: crypto.randomUUID(),
      name: presetName,
      createdAt: now,
      updatedAt: now,
      schemaVersion: ROUTINE_SCHEMA_VERSION,
      blocks: segmentItems.map((item, index) => ({
        type: "stage",
        label: makeStepLabel(index + 1),
        kind: "custom",
        durationSec:
          Number(item.dataset.hours) * 3600 +
          Number(item.dataset.minutes) * 60 +
          Number(item.dataset.seconds),
      })),
    };
    const validationErrors = validateRoutine(routine);
    if (validationErrors.length > 0) {
      throw new Error(
        `Invalid routine: ${validationErrors
          .map((validationError) => `${validationError.code} at ${validationError.path}`)
          .join(", ")}`
      );
    }

    await PopupStorage.saveRoutine(routine);
    showRoutinesMessage("");
    hideForm();
    await reloadRoutines();
  } catch (error) {
    console.error("Error saving preset:", error);
    showRoutinesMessage(UI_STRINGS.presetForm.saveFailed);
  }
}

function limitInputLength(input, field) {
  const digits = input.value.replace(/\D/g, "").slice(0, 2);
  const { max } = SEGMENT_FIELD_LIMITS[field];
  input.value = digits === "" ? "" : String(Math.min(Number(digits), max));
}

function createSegmentItem(hours, minutes, seconds) {
  const segmentItem = createElement("li", { className: "preset-item" });
  segmentItem.draggable = true;
  Object.assign(segmentItem.dataset, { hours, minutes, seconds });

  [hours, minutes, seconds].forEach((value, index) => {
    if (index > 0) segmentItem.append(":");
    segmentItem.append(
      createElement("div", { className: "preset-clock-item", text: padTwoDigits(value) })
    );
  });

  const actions = createElement("div", { className: "preset-item-actions" });
  [
    ["up", "↑"],
    ["down", "↓"],
  ].forEach(([direction, arrow]) => {
    const moveButton = createElement("button", { className: "preset-move-btn", text: arrow });
    moveButton.type = "button";
    moveButton.dataset.direction = direction;
    actions.append(moveButton);
  });

  const removeButton = createElement("button", { className: "preset-remove-btn", text: "×" });
  removeButton.type = "button";
  actions.append(removeButton);
  segmentItem.append(actions);
  return segmentItem;
}

function getSegmentDurationText(item) {
  const { hours, minutes, seconds } = item.dataset;
  return [hours, minutes, seconds].map(padTwoDigits).join(":");
}

function updateSegmentControls() {
  const items = getSegmentItems();
  const setLabel = (button, label) => {
    button.setAttribute("aria-label", label);
    button.title = label;
  };

  items.forEach((item, index) => {
    const position = index + 1;
    const [moveUpButton, moveDownButton] = item.querySelectorAll(".preset-move-btn");
    setLabel(moveUpButton, formatUiString(UI_STRINGS.presetForm.moveSegmentUp, { position }));
    setLabel(moveDownButton, formatUiString(UI_STRINGS.presetForm.moveSegmentDown, { position }));
    moveUpButton.disabled = index === 0;
    moveDownButton.disabled = index === items.length - 1;
    setLabel(
      item.querySelector(".preset-remove-btn"),
      formatUiString(UI_STRINGS.presetForm.removeSegment, {
        position,
        duration: getSegmentDurationText(item),
      })
    );
  });
}

function moveSegment(item, direction) {
  if (direction === "up" && item.previousElementSibling) {
    item.after(item.previousElementSibling);
  } else if (direction === "down" && item.nextElementSibling) {
    item.before(item.nextElementSibling);
  } else {
    return;
  }
  updateSegmentControls();

  if (item.querySelector(`[data-direction="${direction}"]`).disabled) {
    const otherDirection = direction === "up" ? "down" : "up";
    item.querySelector(`[data-direction="${otherDirection}"]`).focus();
  }

  const items = getSegmentItems();
  elements.segmentsStatus.textContent = formatUiString(UI_STRINGS.presetForm.segmentMoved, {
    duration: getSegmentDurationText(item),
    position: items.indexOf(item) + 1,
    count: items.length,
  });
}

function readSegmentInputs() {
  const { hours, minutes, seconds } = elements.inputs;
  return {
    hours: Number(hours.value) || 0,
    minutes: Number(minutes.value) || 0,
    seconds: Number(seconds.value) || 0,
  };
}

function validateSegment(segment) {
  for (const [field, { min, max, label }] of Object.entries(SEGMENT_FIELD_LIMITS)) {
    const value = segment[field];
    if (!Number.isInteger(value) || value < min || value > max) {
      return formatUiString(UI_STRINGS.presetForm.fieldOutOfRange, { label, min, max });
    }
  }

  const { hours, minutes, seconds } = segment;
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  if (totalSeconds === 0) {
    return UI_STRINGS.presetForm.zeroDuration;
  }
  if (totalSeconds < ROUTINE_LIMITS.stageMinSec) {
    return formatUiString(UI_STRINGS.presetForm.segmentTooShort, {
      seconds: ROUTINE_LIMITS.stageMinSec,
    });
  }
  return "";
}

function initializeSegmentItem(item) {
  item.addEventListener("dragstart", (event) => event.target.classList.add("dragging"));
  item.addEventListener("dragend", (event) => {
    event.target.classList.remove("dragging");
    updateSegmentControls();
  });

  item.querySelectorAll(".preset-move-btn").forEach((moveButton) => {
    moveButton.addEventListener("click", () => moveSegment(item, moveButton.dataset.direction));
  });

  item.querySelector(".preset-remove-btn").addEventListener("click", () => {
    const neighbour = item.nextElementSibling || item.previousElementSibling;
    const nextFocus = neighbour
      ? neighbour.querySelector(".preset-remove-btn")
      : elements.inputs.hours;
    item.remove();
    updateSegmentControls();
    nextFocus.focus();
  });
}

function addSegment() {
  if (getSegmentItems().length >= ROUTINE_LIMITS.maxEditorRows) {
    showFieldError(
      "segments",
      formatUiString(UI_STRINGS.presetForm.tooManySegments, {
        count: ROUTINE_LIMITS.maxEditorRows,
      })
    );
    return;
  }

  const segment = readSegmentInputs();
  const segmentError = validateSegment(segment);
  if (segmentError) {
    showFieldError("segment", segmentError);
    return;
  }

  const segmentItem = createSegmentItem(segment.hours, segment.minutes, segment.seconds);
  elements.list.appendChild(segmentItem);

  clearSegmentInputs();
  initializeSegmentItem(segmentItem);
  updateSegmentControls();
  showFieldError("segment", "");
  showFieldError("segments", "");
}

function initializeSegmentDragAndDrop() {
  elements.list.addEventListener("dragover", (event) => {
    event.preventDefault();
    const draggingItem = elements.list.querySelector(".dragging");
    if (!draggingItem) return;

    const siblings = [...elements.list.querySelectorAll(".preset-item:not(.dragging)")];
    const nextSibling = siblings.find((sibling) => {
      const box = sibling.getBoundingClientRect();
      return event.clientY < box.top + box.height / 2;
    });

    elements.list.insertBefore(draggingItem, nextSibling);
  });
}

function initializeInputLimits() {
  elements.inputs.name.maxLength = ROUTINE_LIMITS.nameMaxLength;
  elements.inputs.name.addEventListener("input", () => showFieldError("name", ""));

  Object.entries(SEGMENT_FIELD_LIMITS).forEach(([field, { min, max }]) => {
    const input = elements.inputs[field];
    input.min = String(min);
    input.max = String(max);

    input.addEventListener("keypress", (event) => {
      if ([".", ",", "e", "E", "+", "-"].includes(event.key)) event.preventDefault();
    });

    input.addEventListener("input", () => {
      limitInputLength(input, field);
      showFieldError("segment", "");
    });
  });
}

export function openRoutineEditor({ returnFocusTo }) {
  returnFocusTarget = returnFocusTo;
  switchTab("routines");
  showForm();
}

export function initializeRoutineEditor() {
  elements.cancelButton.addEventListener("click", hideForm);
  elements.saveButton.addEventListener("click", savePreset);
  elements.addSegmentButton.addEventListener("click", addSegment);
  initializeInputLimits();
  initializeSegmentDragAndDrop();
}
