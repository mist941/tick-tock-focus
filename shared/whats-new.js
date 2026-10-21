export const WHATS_NEW_VERSION = "1.2";

const FIRST_VERSION_WITH_WHATS_NEW = "1.2.0";

const toVersionParts = (version) =>
  String(version ?? "")
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);

export function compareVersions(first, second) {
  const firstParts = toVersionParts(first);
  const secondParts = toVersionParts(second);
  const partCount = Math.max(firstParts.length, secondParts.length);
  for (let index = 0; index < partCount; index += 1) {
    const difference = (firstParts[index] ?? 0) - (secondParts[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

export const isOlderThanWhatsNew = (version) =>
  compareVersions(version, FIRST_VERSION_WITH_WHATS_NEW) < 0;
