export const MAX_SCALE = 100;
export const MIN_SCALE = 5;

export const MAX_SIM_SCALE = 6;
export const MIN_SIM_SCALE = 0.6;

export const SNAPSHOT_INTERVAL = 1000;

export {
  DEFAULT_MACHINE_GAUGE,
  MAX_MACHINE_GAUGE,
  MIN_MACHINE_GAUGE,
} from "./simulation/yarnLengthMetrics";

export const SNAPSHOT_FIELDS = [
  "yarnPalette",
  "yarnSequence",
  "yarnPlies",
  "repeats",
  "camBitmap",
  "needleBitmap",
  "needleInputs",
  "appliedNeedleInputs",
];

export const LAYERS = ["chart", "repeats", "yarn"];

export const DEFAULT_YARN_COLOR = "rgba(190,190,190,1)";

export const YARN_TEXTURE_SIZES = [256, 512, 1024];

export const YARN_UV_TEXTURE_REPEAT_LENGTH = 48;
export const YARN_UV_SAMPLE_SPACING = 3;
export const YARN_UV_MAX_POINTS_PER_PATH = 1200;

export const TEXTURE_PERFORMANCE_MODES = {
  AUTO: "auto",
  QUALITY: "quality",
  SOLID: "solid",
};

export const DEFAULT_YARN_PLIES = [
  {
    name: "main",
    color: DEFAULT_YARN_COLOR,
    diameter: 0.24,
    lengthScaleY: 1,
    enabled: true,
    texture: null,
  },
  {
    name: "companion",
    color: "rgba(80,140,220,1)",
    diameter: 0.14,
    lengthScaleY: 1,
    enabled: false,
    texture: null,
  },
];

export const SYMBOL_PATHS = {
  knit: new Path2D("M 0.25 0.75 L 0.5 0.25 L 0.75 0.75"),
  purl: new Path2D("M 0.25 0.25 L 0.5 0.75 L 0.75 0.25"),
  slip: new Path2D("M 0.2 0.5 L 0.8 0.5"),
  tuck: new Path2D("M 0.25 0.25 L 0.75 0.25 L 0.75 0.75 L 0.25 0.75 Z"),
};

export const SYMBOL_BITS = {
  knit: false,
  purl: false,
  slip: true,
  tuck: true,
};

export const DEFAULT_SYMBOLS = ["knit", "purl", "slip", "tuck"];
export const DEFAULT_STITCH_SYMBOL = "purl";
export const DEFAULT_STITCH_SYMBOL_INDEX = DEFAULT_SYMBOLS.indexOf(
  DEFAULT_STITCH_SYMBOL
);

export const DEFAULT_PATTERN_LIBRARY = import.meta.glob("../examples/*.json");

export const toolData = {
  brush: { icon: "fa-solid fa-paintbrush", hotkey: "b" },
};
