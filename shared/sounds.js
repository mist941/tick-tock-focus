export const SOUND_IDS = Object.freeze(["chime", "bell", "soft"]);

export const DEFAULT_SOUND_SETTINGS = Object.freeze({
  soundEnabled: true,
  soundId: "chime",
  soundVolume: 70,
});

const MAX_SOUND_VOLUME = 100;

export function getSoundSettings(settings = {}) {
  const { soundEnabled, soundId, soundVolume } = settings;
  return {
    soundEnabled: soundEnabled !== false,
    soundId: SOUND_IDS.includes(soundId) ? soundId : DEFAULT_SOUND_SETTINGS.soundId,
    soundVolume: Number.isFinite(soundVolume)
      ? Math.min(MAX_SOUND_VOLUME, Math.max(0, Math.round(soundVolume)))
      : DEFAULT_SOUND_SETTINGS.soundVolume,
  };
}

export const getSoundPath = (soundId) => `sounds/${soundId}.ogg`;
