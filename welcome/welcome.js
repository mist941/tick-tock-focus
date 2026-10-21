import { formatDuration, translate } from "../shared/i18n.js";
import { ROUTINE_LIMITS } from "../shared/routine.js";
import { STORAGE_KEYS } from "../shared/storage.js";
import {
  ROUTINE_TEMPLATES,
  createRoutineFromTemplate,
  getAddedTemplateIds,
  listTemplatesToAdd,
  previewTemplate,
} from "../shared/templates.js";
import { createElement } from "../popup/dom-helpers.js";
import { createIcon } from "../popup/icons.js";
import * as PopupStorage from "../popup/popup-storage.js";
import { createStageStrip } from "../popup/stage-graphics.js";
import { applyUiStrings } from "../popup/ui-strings.js";

const ROUTINES_RELOAD_DELAY_MS = 150;
const PRESELECTED_TEMPLATE_ID = "pomodoro";

const elements = {
  templateList: document.getElementById("template_list"),
  addButton: document.getElementById("add_templates"),
  addStatus: document.getElementById("add_status"),
  startText: document.getElementById("start_text"),
  stepsText: document.getElementById("steps_text"),
  minimumTitle: document.getElementById("minimum_title"),
  minimumText: document.getElementById("minimum_text"),
};

const isOpenedOnInstall = new URLSearchParams(location.search).get("reason") === "install";
const selectedTemplateIds = new Set(isOpenedOnInstall ? [PRESELECTED_TEMPLATE_ID] : []);
let storedRoutines = [];
let isAdding = false;

function fillTemplateWithNodes(element, template, nodes) {
  const parts = template.split(/\{(\w+)\}/);
  element.replaceChildren(
    ...parts.map((part, index) => (index % 2 === 1 ? nodes[part] ?? `{${part}}` : part))
  );
}

function fillPageTexts() {
  applyUiStrings();
  document.title = translate("welcomePageTitle");
  const startButton = createElement("span", { className: "start-button-name" });
  startButton.append(
    createIcon("play"),
    createElement("span", { className: "visually-hidden", text: translate("welcomeStartButton") })
  );
  fillTemplateWithNodes(elements.startText, translate("welcomeStartText"), { startButton });
  elements.stepsText.textContent = translate("welcomeStepsText", {
    minTimes: ROUTINE_LIMITS.repeatMinTimes,
    maxTimes: ROUTINE_LIMITS.repeatMaxTimes,
  });
  const seconds = { seconds: ROUTINE_LIMITS.stageMinSec };
  elements.minimumTitle.textContent = translate("welcomeMinimumTitle", seconds);
  elements.minimumText.textContent = translate("welcomeMinimumText", seconds);
}

function setAddStatus(text, { isError = false } = {}) {
  elements.addStatus.textContent = text;
  elements.addStatus.classList.toggle("is-error", isError);
}

const getTemplateIdsToAdd = () => listTemplatesToAdd(selectedTemplateIds, storedRoutines);

function createTemplateCard(template) {
  const { id, name, stages, durationSec } = previewTemplate(template);
  const checkbox = createElement("input", {
    className: "template-checkbox",
    attributes: { type: "checkbox", value: id },
  });
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      selectedTemplateIds.add(id);
    } else {
      selectedTemplateIds.delete(id);
    }
    setAddStatus("");
    renderTemplateCards();
  });

  const heading = createElement("span", { className: "template-card-heading" });
  heading.append(checkbox, createElement("span", { className: "template-card-name", text: name }));
  const card = createElement("label", { className: "template-card" });
  card.append(
    heading,
    createElement("span", {
      className: "template-card-duration",
      text: formatDuration(durationSec),
    }),
    createStageStrip(stages),
    createElement("span", { className: "template-card-added", text: translate("welcomeAdded") })
  );
  const item = createElement("li");
  item.dataset.templateId = id;
  item.append(card);
  return item;
}

function renderTemplateCards() {
  const addedTemplateIds = getAddedTemplateIds(storedRoutines);
  addedTemplateIds.forEach((templateId) => selectedTemplateIds.delete(templateId));
  const focusedCheckbox = elements.templateList.contains(document.activeElement)
    ? document.activeElement
    : null;

  [...elements.templateList.children].forEach((item) => {
    const { templateId } = item.dataset;
    const isAdded = addedTemplateIds.has(templateId);
    const checkbox = item.querySelector(".template-checkbox");
    checkbox.disabled = isAdded;
    checkbox.checked = isAdded || selectedTemplateIds.has(templateId);
    item.querySelector(".template-card-added").hidden = !isAdded;
  });
  elements.addButton.setAttribute("aria-disabled", String(getTemplateIdsToAdd().length === 0));

  if (focusedCheckbox?.disabled) elements.addButton.focus();
}

async function reloadRoutines() {
  try {
    storedRoutines = await PopupStorage.getRoutines();
  } catch (error) {
    console.error("Error loading routines:", error);
  }
  renderTemplateCards();
}

async function addSelectedTemplates() {
  if (isAdding || getTemplateIdsToAdd().length === 0) return;
  isAdding = true;
  setAddStatus("");
  try {
    const routines = await PopupStorage.getRoutines();
    const now = Date.now();
    const newRoutines = listTemplatesToAdd(selectedTemplateIds, routines).map((templateId, index) =>
      createRoutineFromTemplate(templateId, now + index)
    );
    await PopupStorage.saveRoutines(newRoutines);
    storedRoutines = [...routines, ...newRoutines];
    selectedTemplateIds.clear();
    renderTemplateCards();
    setAddStatus(translate("welcomeAddedToRoutines"));
  } catch (error) {
    console.error("Error adding the routines:", error);
    setAddStatus(translate("welcomeAddFailed"), { isError: true });
  } finally {
    isAdding = false;
  }
}

function watchRoutines() {
  let reloadTimeoutId = null;
  chrome.storage.onChanged.addListener((changes) => {
    if (!Object.keys(changes).some((key) => key.startsWith(STORAGE_KEYS.PRESET_PREFIX))) return;
    clearTimeout(reloadTimeoutId);
    reloadTimeoutId = setTimeout(reloadRoutines, ROUTINES_RELOAD_DELAY_MS);
  });
}

fillPageTexts();
elements.templateList.replaceChildren(...ROUTINE_TEMPLATES.map(createTemplateCard));
renderTemplateCards();
elements.addButton.addEventListener("click", addSelectedTemplates);
watchRoutines();
reloadRoutines();
