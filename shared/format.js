export function fillTemplate(template, values) {
  return template.replace(/\{(\w+)\}/g, (placeholder, name) =>
    Object.hasOwn(values, name) ? String(values[name]) : placeholder
  );
}

export const padTwoDigits = (value) => String(value).padStart(2, "0");

export function formatCountdown(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map(padTwoDigits).join(":");
}

export function formatTimerCountdown(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = padTwoDigits(Math.floor((totalSeconds % 3600) / 60));
  const seconds = padTwoDigits(totalSeconds % 60);
  return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}

export function formatSpokenDuration(totalSeconds, units) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [
    [hours, units.hours],
    [minutes, units.minutes],
    [seconds, units.seconds],
  ]
    .filter(([count]) => count > 0)
    .map(([count, template]) => fillTemplate(template, { count }));
  return parts.length > 0 ? parts.join(" ") : fillTemplate(units.seconds, { count: 0 });
}

export function formatClockTime(timestamp, timeFormat, { beforeNoon, afterNoon }) {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = padTwoDigits(date.getMinutes());
  if (timeFormat !== "12h") return `${padTwoDigits(hours)}:${minutes}`;

  const suffix = hours >= 12 ? afterNoon : beforeNoon;
  return `${padTwoDigits(hours % 12 || 12)}:${minutes} ${suffix}`;
}
