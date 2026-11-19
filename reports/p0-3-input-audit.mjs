import { createServer } from "vite";
import fs from "node:fs";

globalThis.Path2D = class {};
const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
try {
  const actions = await server.ssrLoadModule("/src/actions/singleJerseyCamProgram.js");
  const state = await server.ssrLoadModule("/src/state.js");
  const inputs = [["-1", -1], ["NaN", NaN], ["Infinity", Infinity], ["-Infinity", -Infinity],
    ["non-numeric", "invalid"], ["empty", ""], ["0", 0], ["undefined", undefined], ["null", null],
    ["23", 23], ["27", 27], ["0.5", 0.5], ["23.14", 23.14]];
  const readings = inputs.map(([label, value]) => {
    actions.createSingleJerseyCamProgram(4, 4);
    actions.setSingleJerseyFeedYarnLength(0, 0, 23);
    const before = state.GLOBAL_STATE;
    const returned = actions.setSingleJerseyFeedYarnLength(0, 0, value);
    return { input: label, returned: returned ?? "undefined",
      targetAfter: state.GLOBAL_STATE.singleJerseyCamProgram.feeds[0].yarns[0].yarnLengthCmPer100Needles,
      stateReplaced: before !== state.GLOBAL_STATE };
  });
  fs.writeFileSync("reports/p0-3-input-audit-before.json", JSON.stringify(readings, null, 2) + "\n");
  console.log(JSON.stringify(readings));
} finally {
  await server.close();
}
