import { getStageDurationMs, getStagesDurationMs } from "../shared/routine.js";
import { createElement, createSvgElement } from "./dom-helpers.js";

const RING_CENTER = 100;
const RING_RADIUS = 84;
const FULL_CIRCLE = 2 * Math.PI;
const SEGMENT_GAP = (3 * Math.PI) / 180;
const MAX_GAP_SHARE_OF_SEGMENT = 0.3;
const SMALLEST_ARC = 0.0001;

export function createStageStrip(stages) {
  const strip = createElement("span", { className: "stage-strip", attributes: { "aria-hidden": "true" } });
  stages
    .filter((stage) => stage.durationSec > 0)
    .forEach((stage) => {
      const part = createElement("span", { className: "stage-strip-part" });
      part.dataset.kind = stage.kind;
      part.style.flexGrow = String(stage.durationSec);
      strip.append(part);
    });
  return strip;
}

const formatCoordinate = (value) => value.toFixed(2);

function pointOnRing(angle) {
  return [
    formatCoordinate(RING_CENTER + RING_RADIUS * Math.sin(angle)),
    formatCoordinate(RING_CENTER - RING_RADIUS * Math.cos(angle)),
  ];
}

function describeArc(startAngle, endAngle) {
  const sweep = endAngle - startAngle;
  if (sweep <= SMALLEST_ARC) return "";
  const [startX, startY] = pointOnRing(startAngle);
  const radii = `${RING_RADIUS} ${RING_RADIUS}`;
  if (sweep >= FULL_CIRCLE - SMALLEST_ARC) {
    const [oppositeX, oppositeY] = pointOnRing(startAngle + Math.PI);
    return `M ${startX} ${startY} A ${radii} 0 1 1 ${oppositeX} ${oppositeY} A ${radii} 0 1 1 ${startX} ${startY}`;
  }
  const [endX, endY] = pointOnRing(endAngle);
  const largeArc = sweep > Math.PI ? 1 : 0;
  return `M ${startX} ${startY} A ${radii} 0 ${largeArc} 1 ${endX} ${endY}`;
}

function layOutSegments(stages) {
  const totalMs = getStagesDurationMs(stages);
  const visibleCount = stages.filter((stage) => stage.durationSec > 0).length;
  let elapsedMs = 0;
  return stages.map((stage) => {
    const stageMs = getStageDurationMs(stage);
    const startAngle = totalMs > 0 ? (elapsedMs / totalMs) * FULL_CIRCLE : 0;
    elapsedMs += stageMs;
    const endAngle = totalMs > 0 ? (elapsedMs / totalMs) * FULL_CIRCLE : 0;
    const inset =
      visibleCount > 1
        ? Math.min(SEGMENT_GAP / 2, (endAngle - startAngle) * (MAX_GAP_SHARE_OF_SEGMENT / 2))
        : 0;
    return { kind: stage.kind, startAngle: startAngle + inset, endAngle: endAngle - inset };
  });
}

function createSegmentPath(className, kind, pathData) {
  const path = createSvgElement("path", { class: className, d: pathData });
  if (kind) path.dataset.kind = kind;
  return path;
}

export function createProgressRing(container) {
  const svg = createSvgElement("svg", {
    class: "progress-ring",
    viewBox: "0 0 200 200",
    "aria-hidden": "true",
    focusable: "false",
  });
  svg.append(
    createSvgElement("circle", {
      class: "ring-track",
      cx: RING_CENTER,
      cy: RING_CENTER,
      r: RING_RADIUS,
    })
  );
  const segmentGroup = createSvgElement("g", { class: "ring-segments" });
  svg.append(segmentGroup);
  container.prepend(svg);

  let drawnLayoutKey = null;
  let currentSegment = null;
  let currentPaths = null;

  return function renderProgressRing(run, stageRemainingMs) {
    const layoutKey = [run.stages, run.stageIndex, run.status];
    const isSameLayout =
      drawnLayoutKey !== null && layoutKey.every((part, index) => part === drawnLayoutKey[index]);

    if (!isSameLayout) {
      const segments = layOutSegments(run.stages);
      segmentGroup.replaceChildren();
      currentPaths = null;
      segments.forEach((segment, stageIndex) => {
        const arc = describeArc(segment.startAngle, segment.endAngle);
        if (!arc) return;
        if (stageIndex < run.stageIndex) {
          segmentGroup.append(createSegmentPath("ring-segment is-done", null, arc));
        } else if (stageIndex > run.stageIndex) {
          segmentGroup.append(createSegmentPath("ring-segment", segment.kind, arc));
        } else {
          currentPaths = {
            elapsed: createSegmentPath("ring-segment is-done", null, ""),
            remaining: createSegmentPath("ring-segment is-current", segment.kind, arc),
          };
          segmentGroup.append(currentPaths.elapsed, currentPaths.remaining);
        }
      });
      currentSegment = segments[run.stageIndex];
      drawnLayoutKey = layoutKey;
    }

    if (!currentPaths || !currentSegment) return;
    const stageMs = getStageDurationMs(run.stages[run.stageIndex]);
    const remainingShare = stageMs > 0 ? Math.min(1, stageRemainingMs / stageMs) : 0;
    const { startAngle, endAngle } = currentSegment;
    const splitAngle = endAngle - (endAngle - startAngle) * remainingShare;
    currentPaths.elapsed.setAttribute("d", describeArc(startAngle, splitAngle));
    currentPaths.remaining.setAttribute("d", describeArc(splitAngle, endAngle));
  };
}
