// Replay through the Codex computer-use browser API on a disposable local tab.
// All edits use visible controls; observations only read DOM, never app state.
// Invoke setup(), rejectCase() for A/B/C, clear(), change(), pair() in order.
export function createYarnLengthInputBrowserTest(tab, capture = async () => {}) {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const readings = [];
  const inputFor = (feed, yarn = 0) => tab.playwright.locator(`input[data-feed-index="${feed}"][data-yarn-index="${yarn}"]`);
  const blur = () => tab.playwright.getByRole("heading", { name: "Cam Program（三角座）", exact: true }).click();
  async function commit(feed, yarn, value) {
    await inputFor(feed, yarn).fill("");
    await inputFor(feed, yarn).pressSequentially(String(value));
    await blur();
  }
  async function read() {
    return tab.playwright.evaluate(() => ({
      validity: document.querySelector("[data-preview-validity]").dataset.previewValidity,
      rows: Array.from(document.querySelectorAll("[data-solver-feed]")).map(row => ({
        feed: Number(row.dataset.solverFeed), yarn: Number(row.dataset.solverYarn),
        target: row.querySelector(".solver-target").textContent.trim(),
        solved: row.querySelector(".solver-length").textContent.trim(),
        status: row.querySelector(".solver-status").textContent.trim(),
        applied: row.querySelector(".solver-applied").textContent.trim(),
      })),
      inputs: Array.from(document.querySelectorAll("input[data-feed-index]")).map(input => ({
        feed: Number(input.dataset.feedIndex), yarn: Number(input.dataset.yarnIndex),
        value: input.value, valid: input.validity.valid,
        notice: input.closest(".cam-feed-yarn-slot").querySelector(".cam-yarn-length-feedback").textContent.trim(),
      })),
    }));
  }
  async function observe(name, validity) {
    await tab.playwright.locator(`[data-preview-validity="${validity}"]`).waitFor({ state: "visible", timeoutMs: 30000 });
    const reading = await read();
    readings.push({ testCase: name, ...reading });
    await capture(name, reading, await tab.screenshot({ fullPage: true }));
    return reading;
  }
  return {
    readings,
    async setup() {
      await tab.reload();
      await tab.playwright.domSnapshot();
      await tab.playwright.getByRole("button", { name: "三角座 / 排针", exact: true }).click();
      await tab.playwright.getByRole("button", { name: "创建 Cam Program", exact: true }).click();
      await tab.playwright.getByRole("textbox", { name: "输入框1", exact: true }).fill("1234");
      await tab.playwright.getByRole("button", { name: "确认排针", exact: true }).click();
      for (let feed = 0; feed < 4; feed++) await commit(feed, 0, 23);
      const success = await observe("initial-23", "VALIDATED");
      check(success.rows.length === 4 && success.rows.every(row => row.target === "23.0000" &&
        row.status === "CONVERGED" && row.applied === "已应用"), "Initial 23 must be applied and validated");
      return success;
    },
    async rejectCase(name, value, enter = false) {
      const before = await read();
      await inputFor(0).fill("");
      await inputFor(0).pressSequentially(value);
      const draft = await read();
      check(draft.inputs[0].value === value && !draft.inputs[0].valid, `${name}: raw draft/custom validity`);
      check(draft.validity === before.validity && JSON.stringify(draft.rows) === JSON.stringify(before.rows), `${name}: draft must not update results`);
      if (enter) await inputFor(0).press("Enter");
      else await blur();
      const rejected = await observe(name, before.validity);
      check(rejected.inputs[0].value === before.inputs[0].value && rejected.inputs[0].notice.includes("未保存"), `${name}: restore target/show rejection`);
      check(JSON.stringify(rejected.rows) === JSON.stringify(before.rows), `${name}: preserve all current solver feedback`);
      check(rejected.inputs.every((input, index) => input.value === before.inputs[index].value), `${name}: preserve sibling targets`);
      return rejected;
    },
    async rejectEmptyCase(name, enter = false) {
      const before = await read();
      // Real Backspace events ensure that an empty value goes through @change.
      await inputFor(0).press("End");
      for (let index = 0; index < before.inputs[0].value.length; index++) await inputFor(0).press("Backspace");
      const draft = await read();
      check(draft.inputs[0].value === "" && !draft.inputs[0].valid, `${name}: empty draft must not mean Clear`);
      check(JSON.stringify(draft.rows) === JSON.stringify(before.rows), `${name}: draft must preserve results`);
      if (enter) await inputFor(0).press("Enter");
      else await blur();
      const rejected = await observe(name, before.validity);
      check(rejected.inputs[0].value === before.inputs[0].value && rejected.inputs[0].notice.includes("未保存"), `${name}: restore target/show rejection`);
      check(JSON.stringify(rejected.rows) === JSON.stringify(before.rows), `${name}: keep current results`);
      return rejected;
    },
    async clear() {
      await tab.playwright.getByRole("button", { name: "清除 Feed 1 / Yarn 1 的目标纱长", exact: true }).click();
      const first = await observe("D-one-clear", "VALIDATED");
      check(first.inputs[0].value === "" && first.inputs[0].notice === "目标已清除" &&
        first.rows[0].status === "NOT_SET" && first.rows[0].applied === "未应用", "D: explicit clear single target");
      for (let feed = 2; feed <= 4; feed++) {
        await tab.playwright.getByRole("button", { name: `清除 Feed ${feed} / Yarn 1 的目标纱长`, exact: true }).click();
      }
      const none = await observe("D-all-clear", "DESIGN_PREVIEW");
      check(none.inputs.every(input => input.value === "") && none.rows.every(row => row.status === "NOT_SET" &&
        row.solved === "—" && row.applied === "未应用"), "D: no targets must be design preview");
      return none;
    },
    async change() {
      for (let feed = 0; feed < 4; feed++) await commit(feed, 0, 23);
      await observe("E-before-23", "VALIDATED");
      await commit(0, 0, 27);
      const changed = await observe("E-after-27", "VALIDATED");
      check(changed.inputs[0].value === "27" && changed.rows[0].target === "27.0000" &&
        changed.rows[0].status === "CONVERGED" && Math.abs(Number(changed.rows[0].solved) - 27) <= 0.00079375,
        "E: valid 27 must commit and converge");
      await commit(0, 0, 23.14);
      const decimal = await observe("positive-decimal", "VALIDATED");
      check(decimal.inputs[0].value === "23.14" && decimal.rows[0].target === "23.1400", "Positive decimals must not be rounded by the input");
      return changed;
    },
    async pair() {
      await commit(0, 0, 23);
      await tab.playwright.getByRole("button", { name: "纱线库", exact: true }).click();
      await tab.playwright.domSnapshot();
      await tab.playwright.getByRole("button", { name: "Yarn 1", exact: true }).click();
      await tab.playwright.getByRole("button", { name: "三角座 / 排针", exact: true }).first().click();
      await tab.playwright.getByRole("button", { name: "+ Yarn", exact: true }).first().click();
      await commit(0, 1, 18);
      const before = await observe("F-pair-23-18", "VALIDATED");
      check(before.rows.length === 5 && before.inputs[0].value === "23" && before.inputs[1].value === "18",
        "F: same Feed two targets");
      await this.rejectCase("F-pair-reject", "-1");
      return readings.at(-1);
    },
  };
}
