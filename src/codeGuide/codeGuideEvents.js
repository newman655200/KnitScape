import {
  getActiveCodeGuideKey,
  setActiveCodeGuideKey,
} from "./codeGuideState";

const BLOCKED_EVENTS = [
  "pointerdown",
  "pointerup",
  "click",
  "input",
  "change",
  "wheel",
  "contextmenu",
];

function guideTarget(event) {
  if (!(event.target instanceof Element)) return null;
  if (event.target.closest("[data-code-guide-ui]")) return null;
  return event.target.closest("[data-code-guide-key]");
}

function blockGuideEvent(event) {
  const target = guideTarget(event);
  if (!target) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  if (getActiveCodeGuideKey() !== target.dataset.codeGuideKey) {
    setActiveCodeGuideKey(target.dataset.codeGuideKey);
  }
}

function blockGuideKeyboard(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  blockGuideEvent(event);
}

export function initCodeGuideEvents(documentTarget = document) {
  for (const eventName of BLOCKED_EVENTS) {
    documentTarget.addEventListener(eventName, blockGuideEvent, {
      capture: true,
      passive: false,
    });
  }
  documentTarget.addEventListener("keydown", blockGuideKeyboard, {
    capture: true,
  });
}
