const tabs = [...document.querySelectorAll(".tab")];
const tabPanels = [...document.querySelectorAll(".tab-content")];

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

export function initializeTabs() {
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    tab.addEventListener("keydown", handleTabKeydown);
  });
  switchTab("timer");
}
