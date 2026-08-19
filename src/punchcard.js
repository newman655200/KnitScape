import { html, svg } from "lit-html";
import { GLOBAL_STATE } from "./state";
import { Bimp } from "./lib/Bimp";

const machineConfigs = {
  th860: {
    cardWidth: 144,
    holeSize: 5,
    cols: 24,
    punchRadius: 3.75 / 2,
    h: 4.5,
    v: 5,
    b: 16,
    c: 11,
  },
};

function punch(x, y, r = machineConfigs[GLOBAL_STATE.machine].punchRadius) {
  const points = [];

  const angle = (2 * Math.PI) / GLOBAL_STATE.numSides;

  for (let i = 0; i < GLOBAL_STATE.numSides; i++) {
    points.push([x + r * Math.sin(i * angle), y + r * Math.cos(i * angle)]);
  }

  return svg`<polygon points="${points.map((pt) => `${pt[0]},${pt[1]}`)}" />`;
}

export function punchcardRowCount() {
  return (
    GLOBAL_STATE.needleBitmap.height * GLOBAL_STATE.punchVerticalRepeats
  );
}

function overlap(rows) {
  const { b, c, h, v, cols } = machineConfigs[GLOBAL_STATE.machine];
  const punches = [];
  for (let i = 0; i < cols; i++) {
    punches.push(punch(b + h / 2 + i * h, c + v / 2 - v));
    punches.push(punch(b + h / 2 + i * h, c + v / 2 - 2 * v));

    punches.push(punch(b + h / 2 + i * h, c + v / 2 + rows * v));
    punches.push(
      punch(b + h / 2 + i * h, c + v / 2 + (rows + 1) * v)
    );
  }

  return punches;
}

function pattern(rows) {
  const { b, h, c, v, cols } = machineConfigs[GLOBAL_STATE.machine];

  const rp = Bimp.fromTile(cols, rows, GLOBAL_STATE.needleBitmap).make2d();
  const punches = [];

  for (let y = 0; y < rp.length; y++) {
    for (let x = 0; x < rp[0].length; x++) {
      if (rp[y][x] == 0) {
        punches.push(punch(h * x + b + h / 2, v * y + c + v / 2));
      }
    }
  }

  return punches;
}

function belt(rows) {
  const { b, h, c, v, cols, punchRadius } =
    machineConfigs[GLOBAL_STATE.machine];
  const punches = [];

  for (let j = -2; j < rows + 2; j++) {
    punches.push(punch(b + h / 2 - 5.5, c + v / 2 + j * v, punchRadius - 0.25));
    punches.push(
      punch(
        b + h / 2 + (cols - 1) * h + 5.5,
        c + v / 2 + j * v,
        punchRadius - 0.25
      )
    );
  }

  return punches;
}

function loop(rows) {
  const { b, c, v, h, cols } = machineConfigs[GLOBAL_STATE.machine];
  const punches = [];

  for (const i of [-1, 0, rows / 2 - 1, rows / 2]) {
    punches.push(punch(b - 10.5, c + v + i * 2 * v));
    punches.push(punch(b + cols * h + 10.5, c + (i * 2 + 1) * v));
  }

  return punches;
}

function cardHeight(rows) {
  const { v, c } = machineConfigs[GLOBAL_STATE.machine];
  return rows * v + 2 * c;
}

function cardWidth() {
  const { cols, h, b } = machineConfigs[GLOBAL_STATE.machine];
  return cols * h + 2 * b;
}

export function punchCardSVG() {
  const rows = punchcardRowCount();
  const height = cardHeight(rows);
  return html`<svg
    id="punchcard"
    viewBox="0 0 ${cardWidth()} ${height}"
    width="${cardWidth()}mm"
    height="${height}mm">
    <g stroke="black" stroke-width="0.5" fill="none">
      <rect width="${cardWidth()}" height="${height}" />
      ${overlap(rows)}${belt(rows)}${loop(rows)}${pattern(rows)}
    </g>
  </svg>`;
}
