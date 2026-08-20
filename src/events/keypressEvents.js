import { GLOBAL_STATE, dispatch, undo } from "../state";
import { selectPatternSymbol } from "../actions/patternEditing.js";

const ctrlShortcuts = {
  a: () => console.log("select all?"),
  z: () => undo(),
  s: () => dispatch({ showDownload: true }),
};

const hotkeys = {
  // Misc
  g: () => dispatch({ grid: !GLOBAL_STATE.grid }),

  // UI
  Escape: () =>
    dispatch({
      showLibrary: false,
      showSettings: false,
      showDownload: false,
    }),
  d: () =>
    dispatch({
      debug: !GLOBAL_STATE.debug,
    }),
};

function symbolSwitch(index) {
  if (index >= 0 && index < GLOBAL_STATE.symbolMap.length) {
    selectPatternSymbol(index);
  }
}

export function isEditableTarget(target) {
  const tagName = target?.tagName?.toUpperCase();
  return (
    tagName === "INPUT" ||
    tagName === "SELECT" ||
    tagName === "TEXTAREA" ||
    target?.isContentEditable === true
  );
}

export function addKeypressListeners() {
  window.addEventListener("keydown", (e) => {
    if (isEditableTarget(e.target)) return;
    // if (
    //   !(
    //     GLOBAL_STATE.showSettings ||
    //     GLOBAL_STATE.showDownload ||
    //     GLOBAL_STATE.showLibrary
    //   )
    // ) {
    if (e.ctrlKey && e.key.toLowerCase() in ctrlShortcuts) {
      e.preventDefault();
      ctrlShortcuts[e.key.toLowerCase()]();
    } else if (e.key in hotkeys) hotkeys[e.key]();
    else if (/^[0-9]$/i.test(e.key)) symbolSwitch(Number(e.key) - 1);
    // }
    const newHeldKeys = new Set(GLOBAL_STATE.heldKeys);
    newHeldKeys.add(e.key);
    dispatch({ heldKeys: newHeldKeys });
  });

  window.addEventListener("keyup", (e) => {
    if (!GLOBAL_STATE.heldKeys.has(e.key)) return;
    const newHeldKeys = new Set(GLOBAL_STATE.heldKeys);
    newHeldKeys.delete(e.key);
    dispatch({ heldKeys: newHeldKeys });
  });
}
