import { Bimp } from "../lib/Bimp.js";

export function concatNeedleInputs(inputs) {
  return inputs.map((value) => String(value ?? "")).join("");
}

export function validateNeedleInputs(inputs, rowCount) {
  const normalizedInputs = inputs.map((value) => String(value ?? ""));
  const errors = normalizedInputs.map((value) => {
    if (value.length === 0) return "empty";
    if (!/^\d+$/.test(value)) return "characters";

    const unavailableRow = Array.from(value).some((digit) => {
      const row = Number(digit);
      return row < 1 || row > 4 || row > rowCount;
    });

    return unavailableRow ? "row" : null;
  });

  return {
    valid: errors.every((error) => error === null),
    sequence: concatNeedleInputs(normalizedInputs),
    errors,
  };
}

export function buildNeedleBitmap(camBitmap, sequence) {
  if (!sequence) {
    throw new Error("Needle sequence must be non-empty.");
  }

  const selectedRows = Array.from(String(sequence), (digit) => {
    const row = Number(digit);
    if (!Number.isInteger(row) || row < 1 || row > 4 || row > camBitmap.height) {
      throw new Error(`Needle sequence references unavailable row ${digit}.`);
    }
    return row - 1;
  });

  const pixels = [];
  for (let camColumn = 0; camColumn < camBitmap.width; camColumn++) {
    for (const camRow of selectedRows) {
      pixels.push(camBitmap.pixel(camColumn, camRow));
    }
  }

  return new Bimp(selectedRows.length, camBitmap.width, pixels);
}

export function cloneBitmap(bitmap) {
  return new Bimp(bitmap.width, bitmap.height, bitmap.pixels);
}
