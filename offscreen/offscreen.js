import { SOUND_IDS, getSoundPath } from "../shared/sounds.js";

async function playSound({ soundId, volume }) {
  if (!SOUND_IDS.includes(soundId)) throw new Error(`Unknown sound: ${soundId}`);
  const audio = new Audio(chrome.runtime.getURL(getSoundPath(soundId)));
  audio.volume = Math.min(1, Math.max(0, volume / 100));
  await audio.play();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== "offscreen" || message.action !== "playSound") return false;
  playSound(message)
    .then(() => sendResponse({ success: true }))
    .catch((error) => sendResponse({ success: false, error: error.message }));
  return true;
});
