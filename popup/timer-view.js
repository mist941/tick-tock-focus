import {
  CATCH_UP_GRACE_MS,
  ROUTINE_LIMITS,
  expandRoutine,
  getRunProgress,
  getStageDurationMs,
  getStagesDurationMs,
  planCatchUp,
} from "../shared/routine.js";
import { formatCountdown } from "../shared/format.js";
import { createSvgElement, setTextIfChanged } from "./dom-helpers.js";
import * as PopupStorage from "./popup-storage.js";
import { UI_STRINGS, formatUiString } from "./ui-strings.js";

const COUNTDOWN_UPDATE_INTERVAL_MS = 1000;
const POINT_LABEL = { OFFSET: 16, CHARACTER_WIDTH: 6.2, HEIGHT: 13, GAP: 2 };

const elements = {
  toggleButton: document.getElementById("timer_toggle"),
  countdownDisplay: document.getElementById("countdown"),
  stagePosition: document.getElementById("stage_position"),
  stageStatus: document.getElementById("stage_status"),
  presetSelect: document.getElementById("preset_select"),
  progressBar: document.querySelector(".timer-progress-bar"),
  presetPoints: document.querySelector(".preset-points"),
  message: document.getElementById("timer_message"),
};

const boxesOverlap = (first, second) =>
  first.left < second.right &&
  second.left < first.right &&
  first.top < second.bottom &&
  second.top < first.bottom;

const hasShortStages = (stages) =>
  stages.some((stage) => stage.durationSec < ROUTINE_LIMITS.stageMinSec);

export const TimerView = {
  countdownIntervalId: null,
  storedRun: null,
  autoAdvance: true,
  drawnStages: null,
  presets: [],
  isRunning: false,

  getPresetDuration(presetId) {
    try {
      const preset = this.presets.find((candidate) => candidate.id === presetId);

      if (!preset) return null;

      return getStagesDurationMs(expandRoutine(preset));
    } catch (error) {
      console.error("Error calculating preset duration:", error);
      return null;
    }
  },

  async loadPresets() {
    try {
      const [presets, { selectedPresetId }] = await Promise.all([
        PopupStorage.getRoutines(),
        chrome.storage.local.get("selectedPresetId"),
      ]);
      this.presets = presets;
      const { presetSelect } = elements;

      const placeholderOption = document.createElement("option");
      placeholderOption.value = "";
      placeholderOption.textContent = UI_STRINGS.timer.selectPresetOption;
      presetSelect.replaceChildren(placeholderOption);

      this.presets.forEach((preset) => {
        const option = document.createElement("option");
        option.value = preset.id;
        option.textContent = preset.name;
        presetSelect.appendChild(option);
      });

      if (this.presets.some((preset) => preset.id === selectedPresetId)) {
        presetSelect.value = selectedPresetId;
      } else if (selectedPresetId) {
        await chrome.storage.local.remove("selectedPresetId");
      }
    } catch (error) {
      console.error("Error loading presets:", error);
    }
    this.updateStartButtonState();
  },

  async restoreTimerState() {
    try {
      const runKey = PopupStorage.STORAGE_KEYS.RUN;
      const [{ [runKey]: storedRun }, settings] = await Promise.all([
        chrome.storage.local.get(runKey),
        PopupStorage.getSettings(),
      ]);
      this.storedRun = storedRun ?? null;
      this.autoAdvance = settings.autoAdvance !== false;
    } catch (error) {
      console.error("Error restoring the timer state:", error);
    }
    this.render();
  },

  getDisplayedRun(now) {
    return planCatchUp(this.storedRun, now, {
      autoAdvance: this.autoAdvance,
      graceMs: CATCH_UP_GRACE_MS,
    }).run;
  },

  render() {
    const now = Date.now();
    const run = this.getDisplayedRun(now);
    if (!run) {
      this.showIdleState();
      return;
    }

    if (!this.isRunning) this.updateToggleButton(true);
    if (this.drawnStages !== run.stages) {
      this.drawPresetPoints(run.stages);
      this.drawnStages = run.stages;
    }

    const { stageRemainingMs, routineRemainingMs, routineDurationMs } = getRunProgress(
      run,
      now
    );
    elements.countdownDisplay.textContent = formatCountdown(stageRemainingMs);
    this.updateCircleProgress(routineDurationMs > 0 ? routineRemainingMs / routineDurationMs : 0);
    this.showStageSummary(run);
    this.startCountdownUpdate();
  },

  showStageSummary(run) {
    const stage = run.stages[run.stageIndex];
    const position = formatUiString(UI_STRINGS.timer.stagePosition, {
      label: stage.label,
      n: run.stageIndex + 1,
      total: run.stages.length,
    });
    const summaryByStatus = {
      running: { position, status: "" },
      paused: { position, status: UI_STRINGS.timer.paused },
      awaitingNext: {
        position: "",
        status: formatUiString(UI_STRINGS.timer.waitingForNext, { label: stage.label }),
      },
    };
    const summary = summaryByStatus[run.status] ?? { position: "", status: "" };
    setTextIfChanged(elements.stagePosition, summary.position);
    setTextIfChanged(elements.stageStatus, summary.status);
  },

  sendTimerCommand(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!response?.success) {
          reject(new Error(response?.error || "No response from the service worker"));
        } else {
          resolve(response);
        }
      });
    });
  },

  showCommandError(action, error) {
    console.error(`${action} failed:`, error);
    this.showTimerMessage(UI_STRINGS.timer.unreachable, { isError: true });
  },

  async startTimer(routineId) {
    let response;
    try {
      response = await this.sendTimerCommand({ action: "startRoutine", routineId });
    } catch (error) {
      this.showCommandError("startRoutine", error);
      return;
    }

    this.storedRun = response.run;
    this.render();
  },

  clearPresetPoints() {
    elements.presetPoints.replaceChildren();
  },

  layoutPointLabel(text, angle, center, radius) {
    const { OFFSET, CHARACTER_WIDTH, HEIGHT, GAP } = POINT_LABEL;
    const x = center.x + (radius + OFFSET) * Math.sin(angle);
    const y = center.y - (radius + OFFSET) * Math.cos(angle);
    const horizontalDirection = Math.sin(angle);
    let anchor = "middle";
    if (horizontalDirection > 0.3) anchor = "start";
    if (horizontalDirection < -0.3) anchor = "end";

    const width = text.length * CHARACTER_WIDTH;
    const anchorShift = { start: 0, middle: width / 2, end: width }[anchor];
    const box = {
      left: x - anchorShift - GAP,
      right: x - anchorShift + width + GAP,
      top: y - HEIGHT / 2 - GAP,
      bottom: y + HEIGHT / 2 + GAP,
    };

    const element = createSvgElement("text", {
      class: "preset-point-label",
      x,
      y,
      "text-anchor": anchor,
    });
    element.textContent = text;
    return { element, box };
  },

  drawPresetPoints(stages) {
    this.clearPresetPoints();
    const circle = elements.progressBar;
    const center = { x: circle.cx.baseVal.value, y: circle.cy.baseVal.value };
    const radius = circle.r.baseVal.value;
    const totalDuration = getStagesDurationMs(stages);
    if (totalDuration <= 0) return;

    const placedLabelBoxes = [];
    let accumulatedTime = 0;

    stages.forEach((stage) => {
      accumulatedTime += getStageDurationMs(stage);
      if (accumulatedTime >= totalDuration) return;

      const angle = (accumulatedTime / totalDuration) * 2 * Math.PI;
      elements.presetPoints.append(
        createSvgElement("circle", {
          class: "preset-point",
          cx: center.x + radius * Math.sin(angle),
          cy: center.y - radius * Math.cos(angle),
          r: 5,
        })
      );

      const label = this.layoutPointLabel(
        formatCountdown(accumulatedTime),
        angle,
        center,
        radius
      );
      if (placedLabelBoxes.some((box) => boxesOverlap(box, label.box))) {
        return;
      }
      placedLabelBoxes.push(label.box);
      elements.presetPoints.append(label.element);
    });
  },

  async stopTimer() {
    let response;
    try {
      response = await this.sendTimerCommand({ action: "stopRoutine" });
    } catch (error) {
      this.showCommandError("stopRoutine", error);
      return;
    }

    this.storedRun = response.run;
    this.render();
  },

  showIdleState() {
    this.stopCountdownUpdate();
    elements.countdownDisplay.textContent = formatCountdown(0);
    this.updateCircleProgress(0);
    this.updateToggleButton(false);
    this.clearPresetPoints();
    this.drawnStages = null;
    setTextIfChanged(elements.stagePosition, "");
    setTextIfChanged(elements.stageStatus, "");
  },

  startCountdownUpdate() {
    if (this.countdownIntervalId !== null) return;
    this.countdownIntervalId = setInterval(() => this.render(), COUNTDOWN_UPDATE_INTERVAL_MS);
  },

  stopCountdownUpdate() {
    clearInterval(this.countdownIntervalId);
    this.countdownIntervalId = null;
  },

  updateCircleProgress(remainingFraction) {
    const circle = elements.progressBar;
    const circumference = 2 * Math.PI * circle.r.baseVal.value;
    const isEmpty = remainingFraction <= 0;
    circle.classList.toggle("is-empty", isEmpty);
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = isEmpty ? 0 : -(1 - remainingFraction) * circumference;
  },

  toggleTimer() {
    if (this.getDisplayedRun(Date.now())) {
      this.stopTimer();
      return;
    }

    const selectedPresetId = elements.presetSelect.value;
    if (!selectedPresetId || !this.getPresetDuration(selectedPresetId)) {
      this.updateStartButtonState();
      return;
    }
    this.startTimer(selectedPresetId);
  },

  updateToggleButton(isRunning) {
    this.isRunning = isRunning;
    elements.toggleButton.textContent = isRunning ? UI_STRINGS.timer.stop : UI_STRINGS.timer.start;
    this.updatePresetSelectState();
    this.updateStartButtonState();
  },

  updatePresetSelectState() {
    const { presetSelect, toggleButton } = elements;
    const hadFocus = document.activeElement === presetSelect;
    presetSelect.disabled = this.isRunning;
    if (this.isRunning && hadFocus) toggleButton.focus();
  },

  selectPreset(presetId) {
    elements.presetSelect.value = presetId;
    chrome.storage.local.set({ selectedPresetId: presetId });
    this.updateStartButtonState();
  },

  focusPresetControls() {
    const { presetSelect, toggleButton } = elements;
    (presetSelect.disabled ? toggleButton : presetSelect).focus();
  },

  showTimerMessage(text, { isError = false } = {}) {
    elements.message.textContent = text;
    elements.message.classList.toggle("error", isError);
  },

  updateStartButtonState() {
    const button = elements.toggleButton;
    if (this.isRunning) {
      button.disabled = false;
      this.showTimerMessage("");
      return;
    }

    const selectedPresetId = elements.presetSelect.value;
    const selectedPreset = this.presets.find((preset) => preset.id === selectedPresetId);
    if (this.presets.length === 0) {
      button.disabled = true;
      this.showTimerMessage(UI_STRINGS.timer.noPresets);
    } else if (!selectedPresetId) {
      button.disabled = true;
      this.showTimerMessage(UI_STRINGS.timer.selectPreset);
    } else if (!this.getPresetDuration(selectedPresetId)) {
      button.disabled = true;
      this.showTimerMessage(UI_STRINGS.timer.noDuration, { isError: true });
    } else if (hasShortStages(expandRoutine(selectedPreset))) {
      button.disabled = false;
      this.showTimerMessage(
        formatUiString(UI_STRINGS.timer.shortStages, { seconds: ROUTINE_LIMITS.stageMinSec })
      );
    } else {
      button.disabled = false;
      this.showTimerMessage("");
    }
  },

  initialize() {
    elements.toggleButton.addEventListener("click", () => this.toggleTimer());
    elements.presetSelect.addEventListener("change", (event) =>
      this.selectPreset(event.target.value)
    );
  },
};
