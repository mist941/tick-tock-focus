import { fillTemplate, formatClockTime, formatSpokenDuration } from "./format.js";

function getChromeMessage(key) {
  const message = chrome.i18n.getMessage(key);
  if (message) return message;
  console.warn(`Missing message: ${key}`);
  return key;
}

let messageLookup = getChromeMessage;

export function setMessageLookup(lookup = getChromeMessage) {
  messageLookup = lookup;
}

export const translate = (key, values = {}) => fillTemplate(messageLookup(key), values);

export const getLanguageCode = () => translate("languageCode");

export const formatDuration = (totalSeconds) =>
  formatSpokenDuration(totalSeconds, {
    hours: translate("formatHours"),
    minutes: translate("formatMinutes"),
    seconds: translate("formatSeconds"),
  });

export const formatTime = (timestamp, timeFormat) =>
  formatClockTime(timestamp, timeFormat, {
    beforeNoon: translate("formatBeforeNoon"),
    afterNoon: translate("formatAfterNoon"),
  });
