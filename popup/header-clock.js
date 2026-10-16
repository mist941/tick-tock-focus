import { padTwoDigits } from "../shared/format.js";
import * as PopupStorage from "./popup-storage.js";
import { UI_STRINGS } from "./ui-strings.js";

const DEFAULT_TIME_FORMAT = "24h";
const CLOCK_UPDATE_INTERVAL_MS = 1000;

const clockButton = document.getElementById("clock");
let timeFormat = DEFAULT_TIME_FORMAT;

function formatTime(hours, minutes, format) {
  const formattedHours = format === "12h" ? hours % 12 || 12 : hours;
  const meridiem =
    format === "12h"
      ? hours >= 12
        ? UI_STRINGS.clock.afterNoon
        : UI_STRINGS.clock.beforeNoon
      : "";
  return `${padTwoDigits(formattedHours)}:${padTwoDigits(minutes)} ${meridiem}`;
}

function updateClock() {
  const now = new Date();
  clockButton.textContent = formatTime(now.getHours(), now.getMinutes(), timeFormat);
}

async function toggleTimeFormat() {
  timeFormat = timeFormat === "12h" ? "24h" : "12h";
  updateClock();
  try {
    await PopupStorage.updateSetting("timeFormat", timeFormat);
  } catch (error) {
    console.error("Error saving time format:", error);
  }
}

export async function loadTimeFormat() {
  try {
    const settings = await PopupStorage.getSettings();
    timeFormat = settings.timeFormat || DEFAULT_TIME_FORMAT;
  } catch (error) {
    console.error("Error loading settings:", error);
  }
  updateClock();
}

export async function startHeaderClock() {
  clockButton.addEventListener("click", toggleTimeFormat);
  await loadTimeFormat();
  setInterval(updateClock, CLOCK_UPDATE_INTERVAL_MS);
}
