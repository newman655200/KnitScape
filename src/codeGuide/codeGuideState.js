let activeCodeGuideKey = null;
const listeners = new Set();

function updateActiveCodeGuideKey(key) {
  if (activeCodeGuideKey === key) return;
  activeCodeGuideKey = key;
  listeners.forEach((listener) => listener());
}

export function getActiveCodeGuideKey() {
  return activeCodeGuideKey;
}

export function setActiveCodeGuideKey(key) {
  updateActiveCodeGuideKey(key);
}

export function clearActiveCodeGuideKey() {
  updateActiveCodeGuideKey(null);
}

export function subscribeCodeGuideState(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
