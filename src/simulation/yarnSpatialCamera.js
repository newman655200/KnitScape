import { finiteVector, dot } from "./yarnSpatialMath.js";

// TEST_ONLY orbit camera. Target and distance use the mesh's declared length unit.
const DEFAULT_VIEW = Object.freeze({ target: Object.freeze([0, 0, 0]), distance: 18,
  yaw: 0.5, pitch: 0.3, fovY: Math.PI / 4 });
const invalid = diagnostic => ({ status: "INVALID", diagnostic });
const bounded = value => Number.isFinite(value) && Math.abs(value) <= 1e12;
const validBounds = bounds => finiteVector(bounds?.min) && finiteVector(bounds?.max) &&
  bounds.min.every((value, axis) => bounded(value) && bounded(bounds.max[axis]) && value <= bounds.max[axis]);

export function resolveYarnSpatialView(patch = {}, current = DEFAULT_VIEW) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return invalid("Camera patch must be an object.");
  const view = { ...current, ...patch };
  if (!finiteVector(view.target) || !view.target.every(bounded) || !bounded(view.distance) || view.distance < 1e-6 ||
    !bounded(view.yaw) || !Number.isFinite(view.pitch) || Math.abs(view.pitch) > Math.PI / 2 ||
    !Number.isFinite(view.fovY) || view.fovY < 0.05 || view.fovY > Math.PI - 0.05) {
    return invalid("Camera needs a finite XYZ target, positive distance, finite yaw, pitch within ±π/2 and field of view within (0, π).");
  }
  return { status: "OK", view: Object.freeze({ target: Object.freeze([...view.target]), distance: view.distance,
    yaw: view.yaw, pitch: view.pitch, fovY: view.fovY }) };
}

export function buildYarnSpatialCamera(input, aspect, bounds) {
  const resolved = resolveYarnSpatialView(input);
  if (resolved.status !== "OK") return resolved;
  if (!Number.isFinite(aspect) || aspect <= 0 || !validBounds(bounds)) return invalid("Camera requires positive aspect and finite ordered bounds.");
  const { target, distance, yaw, pitch, fovY } = resolved.view;
  const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
  // Orbit-derived right/up stay orthonormal even at the north and south poles.
  const right = [cy, 0, -sy], up = [-sy * sp, cp, -cy * sp], back = [sy * cp, sp, cy * cp];
  const eye = target.map((value, axis) => value + back[axis] * distance);
  const view = new Float32Array([right[0], up[0], back[0], 0, right[1], up[1], back[1], 0,
    right[2], up[2], back[2], 0, -dot(right, eye), -dot(up, eye), -dot(back, eye), 1]);
  const near = Math.max(1e-8, distance * 0.01);
  const extent = Math.hypot(...eye.map((value, axis) => Math.max(Math.abs(value - bounds.min[axis]), Math.abs(value - bounds.max[axis]))));
  const far = Math.max(distance * 2, extent * 1.1 + near);
  const f = 1 / Math.tan(fovY / 2), range = 1 / (near - far);
  const projection = new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * range, -1,
    0, 0, 2 * far * near * range, 0]);
  if (![...view, ...projection].every(Number.isFinite)) return invalid("Camera matrices exceed the finite Float32 range.");
  return { status: "OK", eye, view, projection, near, far };
}

export function fitYarnSpatialView(input, bounds, aspect = 1) {
  const resolved = resolveYarnSpatialView(input);
  if (resolved.status !== "OK") return resolved;
  if (!validBounds(bounds) || !Number.isFinite(aspect) || aspect <= 0) return invalid("Fit requires finite ordered bounds and positive aspect.");
  const target = bounds.min.map((value, axis) => (value + bounds.max[axis]) / 2);
  const radius = Math.hypot(...bounds.min.map((value, axis) => (bounds.max[axis] - value) / 2));
  const halfAngle = Math.atan(Math.tan(resolved.view.fovY / 2) * Math.min(aspect, 1));
  return resolveYarnSpatialView({ target, distance: Math.max(1e-6, radius * 1.15 / Math.sin(halfAngle)) }, resolved.view);
}
