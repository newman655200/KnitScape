import { Bimp } from "../lib/Bimp.js";

export function isNeedleArrangementValid(arrangement, needleTypeCount) {
  return (
    Array.isArray(arrangement) &&
    arrangement.length > 0 &&
    Number.isInteger(needleTypeCount) &&
    needleTypeCount > 0 &&
    arrangement.every(
      (needleType) =>
        Number.isInteger(needleType) &&
        needleType >= 1 &&
        needleType <= needleTypeCount
    )
  );
}

export function getNeedleTypeAtPosition(arrangement, position) {
  if (
    !Array.isArray(arrangement) ||
    arrangement.length === 0 ||
    !Number.isInteger(position) ||
    position < 0
  ) {
    return null;
  }

  return arrangement[position % arrangement.length];
}

export function needleTypeToMatrixRow(needleType, matrixHeight) {
  if (
    !Number.isInteger(needleType) ||
    !Number.isInteger(matrixHeight) ||
    needleType < 1 ||
    needleType > matrixHeight
  ) {
    return null;
  }

  // Repeat bitmap y=0 is drawn as the first visual row in drawRepeats.js.
  return needleType - 1;
}

export function resolveNeedleSymbol(camMatrix, needleType, course) {
  if (
    !camMatrix ||
    !Number.isInteger(camMatrix.width) ||
    camMatrix.width < 1 ||
    !Number.isInteger(camMatrix.height) ||
    camMatrix.height < 1 ||
    !Number.isInteger(course) ||
    course < 0
  ) {
    return null;
  }

  const matrixRow = needleTypeToMatrixRow(needleType, camMatrix.height);
  if (matrixRow === null) return null;

  return camMatrix.pixel(course % camMatrix.width, matrixRow);
}

export function buildArrangedChart({
  camMatrix,
  needleArrangement,
  outputWidth,
  outputHeight,
}) {
  if (
    !camMatrix ||
    !Number.isInteger(outputWidth) ||
    outputWidth < 1 ||
    !Number.isInteger(outputHeight) ||
    outputHeight < 1 ||
    !isNeedleArrangementValid(needleArrangement, camMatrix.height)
  ) {
    return null;
  }

  const pixels = [];
  for (let course = 0; course < outputHeight; course++) {
    for (let position = 0; position < outputWidth; position++) {
      const needleType = getNeedleTypeAtPosition(
        needleArrangement,
        position
      );
      pixels.push(resolveNeedleSymbol(camMatrix, needleType, course));
    }
  }

  return new Bimp(outputWidth, outputHeight, pixels);
}
