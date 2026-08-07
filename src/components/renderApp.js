export function createAppRenderer({
  renderView,
  requestFrame = (callback) => window.requestAnimationFrame(callback),
}) {
  let framePending = false;

  function renderInitial() {
    renderView();
  }

  function renderQueuedFrame() {
    framePending = false;
    renderView();
  }

  function syncState() {
    if (framePending) return;
    framePending = true;
    requestFrame(renderQueuedFrame);
  }

  return { renderInitial, syncState };
}
