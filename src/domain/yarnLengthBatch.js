import { validateYarnLengthInput } from "./yarnLengthInput.js";

const reject = (reason, failedTargetIndex) => ({ ok: false, reason, updatedCount: 0,
  ...(failedTargetIndex === undefined ? {} : { failedTargetIndex }) });

// Selection-time locators can later gain assignmentId without changing the commit seam.
export function validateYarnLengthBatchTargets(camProgram, targets) {
  if (!Array.isArray(targets)) return reject("INVALID_TARGET");
  if (!targets.length) return reject("NO_TARGETS");
  const seen = new Set();
  const checked = [];
  for (let index = 0; index < targets.length; index++) {
    const target = targets[index];
    if (!target || typeof target !== "object" || Array.isArray(target) ||
      !Number.isInteger(target.feedIndex) || target.feedIndex < 0 ||
      !Number.isInteger(target.yarnIndex) || target.yarnIndex < 0 ||
      !((typeof target.yarnId === "string" && target.yarnId.trim()) ||
        (Number.isInteger(target.yarnId) && target.yarnId >= 0))) return reject("INVALID_TARGET", index);
    const key = `${target.feedIndex}:${target.yarnIndex}`;
    if (seen.has(key)) return reject("DUPLICATE_TARGET", index);
    seen.add(key);
    const feed = Array.isArray(camProgram?.feeds) ? camProgram.feeds[target.feedIndex] : null;
    const yarn = Array.isArray(feed?.yarns) ? feed.yarns[target.yarnIndex] : null;
    if (!yarn || yarn.yarnId !== target.yarnId) return reject("STALE_TARGET", index);
    if (yarn.yarnLengthCmPer100Needles === undefined ||
      !validateYarnLengthInput(yarn.yarnLengthCmPer100Needles, { allowUnset: true }).ok) {
      return reject("TARGET_NOT_EDITABLE", index);
    }
    checked.push({ feedIndex: target.feedIndex, yarnIndex: target.yarnIndex, yarnId: target.yarnId });
  }
  return { ok: true, targets: checked };
}

export function validateYarnLengthBatchSelection(camProgram, selection, currentStructureRevision) {
  if (!Number.isSafeInteger(selection?.structureRevision) || selection.structureRevision < 0 ||
    !Number.isSafeInteger(currentStructureRevision) || selection.structureRevision !== currentStructureRevision) {
    return reject("STALE_ASSIGNMENT_STRUCTURE");
  }
  return validateYarnLengthBatchTargets(camProgram, selection.targets);
}

export function preflightYarnLengthBatch(camProgram, selection, value, currentStructureRevision) {
  const targets = validateYarnLengthBatchSelection(camProgram, selection, currentStructureRevision);
  if (!targets.ok) return targets;
  const validation = validateYarnLengthInput(value);
  if (!validation.ok) return reject(validation.reason);
  return { ...targets, value: validation.value };
}
