// Small XYZ primitives shared only by the experimental spatial geometry modules.
export const add = (a, b) => a.map((v, i) => v + b[i]);
export const subtract = (a, b) => a.map((v, i) => v - b[i]);
export const scale = (a, amount) => a.map(v => v * amount);
export const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const magnitude = a => Math.hypot(...a);
export const distance = (a, b) => magnitude(subtract(a, b));
export function normalize(a) {
  const largest = Math.max(...a.map(Math.abs));
  const scaled = a.map(value => value / largest);
  const length = magnitude(scaled);
  return scaled.map(value => value / length);
}
export const finiteVector = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
export const validUnit = unit => ["mm", "cm", "m"].includes(unit);
export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const diagnostic = (code, message, details = {}) => ({ code, message, ...details });
export const invalid = (code, message, details = {}) => ({ status: "INVALID", reason: code,
  diagnostics: [diagnostic(code, message, details)] });

export function rotate(vector, axis, angle) {
  const cosine = Math.cos(angle), sine = Math.sin(angle);
  return add(add(scale(vector, cosine), scale(cross(axis, vector), sine)),
    scale(axis, dot(axis, vector) * (1 - cosine)));
}

export function perpendicular(tangent) {
  let axis = 0;
  for (let i = 1; i < 3; i++) if (Math.abs(tangent[i]) < Math.abs(tangent[axis])) axis = i;
  const reference = [0, 0, 0];
  reference[axis] = 1;
  return normalize(subtract(reference, scale(tangent, dot(reference, tangent))));
}
