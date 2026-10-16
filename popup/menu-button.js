import { createElement } from "./dom-helpers.js";
import { createIcon } from "./icons.js";

let openMenu = null;

function closeOpenMenu({ restoreFocus = false } = {}) {
  if (!openMenu) return;
  const { button, menu } = openMenu;
  menu.hidden = true;
  button.setAttribute("aria-expanded", "false");
  openMenu = null;
  if (restoreFocus) button.focus();
}

document.addEventListener("pointerdown", (event) => {
  if (openMenu && !openMenu.container.contains(event.target)) closeOpenMenu();
});

export function createMenuButton({ menuId, label, items }) {
  const container = createElement("div", { className: "menu-container" });
  const button = createElement("button", {
    className: "icon-button",
    attributes: {
      type: "button",
      "aria-haspopup": "menu",
      "aria-expanded": "false",
      "aria-controls": menuId,
      "aria-label": label,
      title: label,
    },
  });
  button.append(createIcon("more"));

  const menu = createElement("ul", {
    className: "menu",
    attributes: { id: menuId, role: "menu", "aria-label": label },
  });
  menu.hidden = true;

  const menuItems = items.map(({ text, onSelect, isDanger }) => {
    const itemButton = createElement("button", {
      className: isDanger ? "menu-item is-danger" : "menu-item",
      text,
      attributes: { type: "button", role: "menuitem", tabindex: "-1" },
    });
    itemButton.addEventListener("click", () => {
      closeOpenMenu();
      onSelect();
    });
    const listItem = createElement("li", { attributes: { role: "none" } });
    listItem.append(itemButton);
    menu.append(listItem);
    return itemButton;
  });

  function open(focusIndex) {
    if (openMenu?.button !== button) closeOpenMenu();
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    openMenu = { button, menu, container };
    menuItems[focusIndex]?.focus();
  }

  button.addEventListener("click", () => {
    if (openMenu?.button === button) {
      closeOpenMenu();
    } else {
      open(0);
    }
  });
  button.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      open(0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      open(menuItems.length - 1);
    }
  });

  menu.addEventListener("keydown", (event) => {
    const currentIndex = menuItems.indexOf(document.activeElement);
    const lastIndex = menuItems.length - 1;
    const targetIndexByKey = {
      ArrowDown: currentIndex === lastIndex ? 0 : currentIndex + 1,
      ArrowUp: currentIndex <= 0 ? lastIndex : currentIndex - 1,
      Home: 0,
      End: lastIndex,
    };
    if (Object.hasOwn(targetIndexByKey, event.key)) {
      event.preventDefault();
      menuItems[targetIndexByKey[event.key]].focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeOpenMenu({ restoreFocus: true });
    } else if (event.key === "Tab") {
      closeOpenMenu();
    }
  });

  container.append(button, menu);
  return { container, button };
}
