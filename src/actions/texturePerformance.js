import { TEXTURE_PERFORMANCE_MODES } from "../constants";
import { GLOBAL_STATE, dispatch } from "../state";

const INTERACTION_IDLE_MS = 180;
let interactionTimer = null;

function setTexturePreviewInteractionActive(active) {
  if (GLOBAL_STATE.texturePerformanceMode !== TEXTURE_PERFORMANCE_MODES.AUTO) {
    return;
  }

  if (GLOBAL_STATE.texturePreviewInteractionActive === active) return;
  dispatch({ texturePreviewInteractionActive: active });
}

export function beginTexturePreviewInteraction() {
  window.clearTimeout(interactionTimer);
  setTexturePreviewInteractionActive(true);
}

export function endTexturePreviewInteraction() {
  window.clearTimeout(interactionTimer);
  interactionTimer = window.setTimeout(() => {
    setTexturePreviewInteractionActive(false);
  }, INTERACTION_IDLE_MS);
}
