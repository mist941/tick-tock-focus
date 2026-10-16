import { createElement } from "./dom-helpers.js";

const TOAST_DURATION_MS = 5000;

const toast = document.getElementById("toast");
let hideTimeoutId = null;
let isHeld = false;
let focusFallback = null;

function hideToast() {
  clearTimeout(hideTimeoutId);
  hideTimeoutId = null;
  const hadFocus = toast.contains(document.activeElement);
  toast.replaceChildren();
  isHeld = false;
  if (hadFocus) focusFallback?.()?.focus();
}

function scheduleHide() {
  clearTimeout(hideTimeoutId);
  hideTimeoutId = isHeld ? null : setTimeout(hideToast, TOAST_DURATION_MS);
}

export function showToast({ message, actionText, onAction, getFocusFallback }) {
  focusFallback = getFocusFallback;
  const content = [createElement("span", { className: "toast-message", text: message })];
  if (actionText) {
    const actionButton = createElement("button", {
      className: "toast-action",
      text: actionText,
      attributes: { type: "button" },
    });
    actionButton.addEventListener("click", async () => {
      hideToast();
      await onAction();
    });
    content.push(actionButton);
  }
  toast.replaceChildren(...content);
  isHeld = toast.matches(":hover") || toast.contains(document.activeElement);
  scheduleHide();
}

function holdToast() {
  isHeld = true;
  scheduleHide();
}

function releaseToast() {
  if (toast.matches(":hover") || toast.contains(document.activeElement)) return;
  isHeld = false;
  if (toast.childElementCount > 0) scheduleHide();
}

export function initializeToast() {
  toast.addEventListener("pointerenter", holdToast);
  toast.addEventListener("pointerleave", releaseToast);
  toast.addEventListener("focusin", holdToast);
  toast.addEventListener("focusout", () => setTimeout(releaseToast));
}
