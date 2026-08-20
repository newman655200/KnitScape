import assert from "node:assert/strict";
import { createServer } from "vite";

globalThis.Path2D = class {};
const registrations = new Map();
const previousWindow = globalThis.window;
globalThis.window = {
  addEventListener(type, callback) {
    registrations.set(type, callback);
  },
};

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const state = await server.ssrLoadModule("/src/state.js");
  const { addKeypressListeners, isEditableTarget } = await server.ssrLoadModule(
    "/src/events/keypressEvents.js"
  );

  for (const tagName of ["INPUT", "SELECT", "TEXTAREA"]) {
    assert.equal(isEditableTarget({ tagName }), true);
  }
  assert.equal(isEditableTarget({ isContentEditable: true }), true);
  assert.equal(isEditableTarget({ tagName: "BUTTON" }), false);
  assert.equal(isEditableTarget(null), false);

  addKeypressListeners();
  const keydown = registrations.get("keydown");
  const keyup = registrations.get("keyup");
  assert.equal(typeof keydown, "function", "keydown listener must register");
  assert.equal(typeof keyup, "function", "keyup listener must register");

  const dispatchKeydown = (key, target, options = {}) =>
    keydown({ key, target, ...options, preventDefault() {} });
  const dispatchKeyup = (key, target) => keyup({ key, target });

  let stateSynchronizations = 0;
  state.StateMonitor.register([
    () => ({
      syncState() {
        stateSynchronizations += 1;
      },
    }),
  ]);

  state.dispatch({ activeSymbol: 0, activeTool: null, grid: true, heldKeys: new Set() });
  stateSynchronizations = 0;
  dispatchKeydown("2", { tagName: "INPUT" });
  dispatchKeyup("2", { tagName: "INPUT" });
  assert.equal(state.GLOBAL_STATE.activeSymbol, 0);
  assert.equal(state.GLOBAL_STATE.activeTool, null);
  assert.equal(state.GLOBAL_STATE.heldKeys.size, 0);
  assert.equal(stateSynchronizations, 0);

  dispatchKeydown("g", { tagName: "SELECT" });
  assert.equal(state.GLOBAL_STATE.grid, true);
  assert.equal(state.GLOBAL_STATE.heldKeys.size, 0);

  dispatchKeydown("3", { tagName: "BUTTON" });
  assert.equal(state.GLOBAL_STATE.activeSymbol, 2);
  assert.equal(state.GLOBAL_STATE.activeTool, "brush");
  assert.ok(state.GLOBAL_STATE.heldKeys.has("3"));
  dispatchKeyup("3", { tagName: "INPUT" });
  assert.equal(state.GLOBAL_STATE.heldKeys.has("3"), false);

  console.log("PASS: editable inputs keep keyboard editing local.");
} finally {
  await server.close();
  if (previousWindow === undefined) delete globalThis.window;
  else globalThis.window = previousWindow;
}
