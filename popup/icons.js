import { createSvgElement } from "./dom-helpers.js";

const ICON_PATHS = {
  play: "M8 5v14l11-7z",
  pause: "M6 5h4v14H6zm8 0h4v14h-4z",
  skip: "M6 6l8.5 6L6 18zm10 0h2v12h-2z",
  stop: "M6 6h12v12H6z",
  plus: "M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z",
  more: "M6 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm6 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm6 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4z",
  up: "M7 14l5-5 5 5z",
  down: "M7 10l5 5 5-5z",
  close:
    "M6.4 5 5 6.4l5.6 5.6L5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6z",
  grip: "M9 5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM9 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM9 16a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z",
};

export function createIcon(name) {
  const icon = createSvgElement("svg", {
    class: "icon",
    viewBox: "0 0 24 24",
    "aria-hidden": "true",
    focusable: "false",
  });
  icon.append(createSvgElement("path", { d: ICON_PATHS[name] }));
  return icon;
}
