import { setStoredRun } from "./popup-state.js";

function sendMessage(message) {
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
}

export async function sendRunCommand(action, payload = {}) {
  const response = await sendMessage({ action, ...payload });
  setStoredRun(response.run);
  return response.run;
}
