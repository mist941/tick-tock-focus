const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export function createElement(tag, { className, text, attributes = {} } = {}) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
  return element;
}

export function createSvgElement(tag, attributes = {}) {
  const element = document.createElementNS(SVG_NAMESPACE, tag);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
  return element;
}

export function setTextIfChanged(element, text) {
  if (element.textContent !== text) element.textContent = text;
}
