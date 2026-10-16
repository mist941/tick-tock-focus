const MAIN_SCREEN = "main";

const tabs = [...document.querySelectorAll('[role="tab"]')];
const tabPanels = [...document.querySelectorAll('[role="tabpanel"]')];
const screens = new Map(
  [...document.querySelectorAll("[data-screen]")].map((screen) => [screen.dataset.screen, screen])
);
const screenHandlers = new Map();
const tabListeners = new Set();

let currentScreen = MAIN_SCREEN;
let returnFocusTarget = null;

export const getCurrentScreen = () => currentScreen;

export const getSelectedTab = () =>
  tabs.find((tab) => tab.getAttribute("aria-selected") === "true")?.dataset.tab;

export function onTabChange(listener) {
  tabListeners.add(listener);
}

export function switchTab(tabName, { focusTab = false } = {}) {
  tabs.forEach((tab) => {
    const isSelected = tab.dataset.tab === tabName;
    tab.setAttribute("aria-selected", String(isSelected));
    tab.tabIndex = isSelected ? 0 : -1;
    if (isSelected && focusTab) tab.focus();
  });
  tabPanels.forEach((panel) => {
    panel.hidden = panel.dataset.tab !== tabName;
  });
  tabListeners.forEach((listener) => listener(tabName));
}

function handleTabKeydown(event) {
  const currentIndex = tabs.indexOf(event.currentTarget);
  const lastIndex = tabs.length - 1;
  const targetIndexByKey = {
    ArrowRight: currentIndex === lastIndex ? 0 : currentIndex + 1,
    ArrowLeft: currentIndex === 0 ? lastIndex : currentIndex - 1,
    Home: 0,
    End: lastIndex,
  };
  if (!Object.hasOwn(targetIndexByKey, event.key)) return;

  event.preventDefault();
  switchTab(tabs[targetIndexByKey[event.key]].dataset.tab, { focusTab: true });
}

export function registerScreen(screenName, { onOpen, canClose } = {}) {
  screenHandlers.set(screenName, { onOpen, canClose });
}

function showOnly(screenName) {
  screens.forEach((screen, name) => {
    screen.hidden = name !== screenName;
  });
  currentScreen = screenName;
}

export function openScreen(screenName, { returnFocusTo, options } = {}) {
  returnFocusTarget = returnFocusTo ?? document.activeElement;
  showOnly(screenName);
  screenHandlers.get(screenName)?.onOpen?.(options);
  screens.get(screenName).querySelector("[data-screen-heading]")?.focus();
}

function resolveReturnFocus() {
  const target =
    typeof returnFocusTarget === "function" ? returnFocusTarget() : returnFocusTarget;
  return target?.isConnected ? target : null;
}

export function closeScreen() {
  if (currentScreen === MAIN_SCREEN) return;
  showOnly(MAIN_SCREEN);
  const target = resolveReturnFocus();
  returnFocusTarget = null;
  (target ?? tabs.find((tab) => tab.tabIndex === 0))?.focus();
}

export function requestCloseScreen() {
  const canClose = screenHandlers.get(currentScreen)?.canClose;
  if (canClose && !canClose()) return;
  closeScreen();
}

export function initializeNavigation() {
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    tab.addEventListener("keydown", handleTabKeydown);
  });
  document.querySelectorAll("[data-back]").forEach((backButton) => {
    backButton.addEventListener("click", requestCloseScreen);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || event.defaultPrevented || currentScreen === MAIN_SCREEN) return;
    event.preventDefault();
    requestCloseScreen();
  });
  showOnly(MAIN_SCREEN);
  switchTab("timer");
}
