// Replay with a disposable Codex computer-use tab on the local application.
// Visible controls perform every edit; evaluate only reads rendered DOM.
// Call setup(), filters(), crossFeed(), normal(), pair(), invalid(), mixed(),
// unreachable(), stale() in order. No project is saved or exported.
export function createYarnLengthBatchBrowserTest(tab, capture = async () => {}) {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const readings = [];
  const choice = (feed, yarn = 0) => tab.playwright.locator(`input[name="selected-yarn"][data-batch-feed="${feed}"][data-batch-yarn="${yarn}"]`);
  const input = (feed, yarn = 0) => tab.playwright.locator(`input[data-feed-index="${feed}"][data-yarn-index="${yarn}"]`);
  const scope = () => tab.playwright.getByRole("combobox", { name: "筛选 Feed", exact: true });
  const apply = () => tab.playwright.getByRole("button", { name: "应用", exact: true });
  const draft = () => tab.playwright.getByRole("textbox", { name: "批量设置纱长", exact: true });
  async function commit(feed, yarn, value) {
    await input(feed, yarn).fill("");
    await input(feed, yarn).pressSequentially(String(value));
    await tab.playwright.getByRole("heading", { name: "Cam Program（三角座）", exact: true }).click();
  }
  async function read() {
    return tab.playwright.evaluate(() => ({
      validity: document.querySelector("[data-preview-validity]").dataset.previewValidity,
      count: document.querySelector(".cam-batch-target-count").textContent.trim(),
      feedback: document.querySelector(".cam-batch-feedback").textContent.trim(),
      disabled: document.querySelector('.cam-yarn-length-batch button[type="submit"]').disabled,
      selections: Array.from(document.querySelectorAll('input[name="selected-yarn"]')).map(el => ({
        feed: Number(el.dataset.batchFeed), yarn: Number(el.dataset.batchYarn), yarnId: el.dataset.batchYarnId,
        checked: el.checked, disabled: el.disabled,
      })),
      inputs: Array.from(document.querySelectorAll("input[data-feed-index]")).map(el => ({
        feed: Number(el.dataset.feedIndex), yarn: Number(el.dataset.yarnIndex), value: el.value,
      })),
      rows: Array.from(document.querySelectorAll("[data-solver-feed]")).map(row => ({
        feed: Number(row.dataset.solverFeed), yarn: Number(row.dataset.solverYarn),
        target: row.querySelector(".solver-target").textContent.trim(),
        solved: row.querySelector(".solver-length").textContent.trim(),
        status: row.querySelector(".solver-status").textContent.trim(),
        applied: row.querySelector(".solver-applied").textContent.trim(),
      })),
    }));
  }
  async function observe(name, validity) {
    let reading;
    // A fast visible tab may render invalidation between waitFor and read.
    for (let attempt = 0; attempt < 20; attempt++) {
      await tab.playwright.locator(`[data-preview-validity="${validity}"]`).waitFor({ state: "visible", timeoutMs: 30000 });
      reading = await read();
      if (reading.validity === validity) break;
    }
    check(reading.validity === validity, `${name}: current validity`);
    readings.push({ testCase: name, ...reading });
    await capture(name, reading, await tab.screenshot({ fullPage: true }));
    return reading;
  }
  async function select(targets) {
    for (const [feed, yarn = 0] of targets) await choice(feed, yarn).check();
    const reading = await read();
    check(reading.count === `将修改 ${targets.length} 根纱线`, "Exact target count before Apply");
    check(reading.selections.filter(item => item.checked).length === targets.length, "Only explicit assignments selected");
  }
  async function batch(targets, value, name, validity) {
    await select(targets);
    const selected = await read();
    await capture(`${name}-selected`, selected, await tab.screenshot({ fullPage: true }));
    await draft().fill(""); await draft().pressSequentially(String(value));
    await apply().click();
    for (const [feed, yarn = 0] of targets) {
      await tab.playwright.locator(`[data-solver-feed="${feed}"][data-solver-yarn="${yarn}"]`)
        .filter({ hasText: Number(value).toFixed(4) })
        .filter({ hasText: validity === "VALIDATED" ? "CONVERGED" : "UNREACHABLE_TARGET" })
        .waitFor({ state: "visible", timeoutMs: 30000 });
    }
    const reading = await observe(name, validity);
    check(reading.feedback === `已更新 ${targets.length} 根纱线`, `${name}: success count`);
    check(reading.count === "将修改 0 根纱线" && reading.disabled, `${name}: selection cleared after success`);
    return reading;
  }
  const values = reading => reading.inputs.map(item => Number(item.value));
  const solved = (reading, expected) => check(reading.rows.every(row => row.status === "CONVERGED" &&
    row.applied === "已应用" && Math.abs(Number(row.solved) - expected(row)) <= 0.00079375), "Applied convergence");
  return {
    readings,
    async setup() {
      await tab.reload(); await tab.playwright.domSnapshot();
      await tab.playwright.getByRole("button", { name: "三角座 / 排针", exact: true }).click();
      await tab.playwright.getByRole("button", { name: "创建 Cam Program", exact: true }).click();
      await tab.playwright.getByRole("textbox", { name: "输入框1", exact: true }).fill("1234");
      await tab.playwright.getByRole("button", { name: "确认排针", exact: true }).click();
      for (let feed = 0; feed < 4; feed++) await commit(feed, 0, 23);
      const initial = await observe("initial-23", "VALIDATED"); solved(initial, () => 23);
      // C: disabled Apply is the explicit zero-target outcome, with old results retained.
      await draft().fill("27");
      const empty = await observe("C", "VALIDATED");
      check(empty.disabled && empty.feedback === "请选择需要修改的纱线" && empty.count === "将修改 0 根纱线", "C: zero-target feedback");
      check(JSON.stringify(empty.rows) === JSON.stringify(initial.rows), "C: no result changes");
      return empty;
    },
    async filters() {
      for (const [filter, enabled] of [["odd", [0, 2]], ["even", [1, 3]], ["all", [0, 1, 2, 3]]]) {
        await scope().selectOption(filter);
        const reading = await read();
        check(reading.selections.every(item => !item.checked && item.disabled === !enabled.includes(item.feed)), `${filter}: candidate filter only`);
        check(reading.count === "将修改 0 根纱线", `${filter}: must not select assignments implicitly`);
      }
      await tab.playwright.getByRole("checkbox", { name: "选择 Feed 1", exact: true }).check();
      await scope().selectOption("selected");
      const filtered = await read();
      check(filtered.selections.every(item => !item.checked && item.disabled === (item.feed !== 0)), "Selected Feed is only a filter");
      await scope().selectOption("all");
      return observe("filters", "VALIDATED");
    },
    async crossFeed() {
      const reading = await batch([[0], [2]], 27, "A", "VALIDATED");
      check(JSON.stringify(values(reading)) === "[27,23,27,23]", "A: cross-Feed isolation");
      return reading;
    },
    async normal() {
      const reading = await batch([[0], [1], [2], [3]], 27, "F", "VALIDATED");
      check(values(reading).every(value => value === 27), "F: project targets"); solved(reading, () => 27);
      return reading;
    },
    async pair() {
      for (let feed = 0; feed < 4; feed++) await commit(feed, 0, 23);
      await tab.playwright.getByRole("button", { name: "纱线库", exact: true }).click();
      await tab.playwright.domSnapshot();
      await tab.playwright.getByRole("textbox", { name: "名称", exact: true }).fill("Batch B");
      await tab.playwright.getByRole("button", { name: "新增纱线", exact: true }).click();
      await tab.playwright.getByRole("button", { name: "Batch B", exact: true }).click();
      await tab.playwright.getByRole("button", { name: "三角座 / 排针", exact: true }).first().click();
      // Keyboard activation also works when the existing grid is horizontally scrolled.
      await tab.playwright.getByRole("button", { name: "+ Yarn", exact: true }).first().press("Enter");
      await commit(0, 1, 18);
      await tab.playwright.getByRole("button", { name: "取消待分配", exact: true }).click();
      const reading = await batch([[0]], 25, "B", "VALIDATED");
      check(JSON.stringify(values(reading)) === "[25,18,23,23,23]", "B: sibling stays 18");
      check(reading.rows[1].target === "18.0000" && reading.rows[1].status === "CONVERGED", "B: sibling result target retained");
      return reading;
    },
    async invalid() {
      await commit(0, 0, 23); await observe("E-before", "VALIDATED");
      await select([[0], [0, 1]]);
      const before = await read();
      for (const value of ["-1", "0", "", "NaN", "Infinity", "abc"]) {
        await draft().fill(""); if (value) await draft().pressSequentially(value);
        await apply().click();
        const rejected = await observe(value === "-1" ? "E" : `E-reject-${value || "empty"}`, "VALIDATED");
        check(rejected.feedback.includes("未修改任何纱线") && rejected.feedback.includes("有限正数"), "E: reject notice");
        check(JSON.stringify(rejected.rows) === JSON.stringify(before.rows) && JSON.stringify(rejected.inputs) === JSON.stringify(before.inputs), "E: reject keeps every target/result");
      }
      await scope().selectOption("odd"); await scope().selectOption("all");
      return readings.at(-1);
    },
    async mixed() {
      const reading = await batch([[0], [1], [2]], 25, "H", "VALIDATED");
      check(JSON.stringify(values(reading)) === "[25,18,25,25,23]", "H: mixed targets, sibling untouched");
      return reading;
    },
    async unreachable() {
      const partial = await batch([[0], [1], [2], [3]], 100, "G-partial", "PARTIAL");
      check(partial.rows.filter(row => row.yarn === 0).every(row => row.target === "100.0000" && row.status === "UNREACHABLE_TARGET" && row.applied === "未应用"), "G: valid 100 committed but not applied");
      check(partial.inputs[1].value === "18" && partial.rows[1].applied === "已应用", "G: untargeted successful sibling");
      const invalid = await batch([[0, 1]], 100, "G-invalid", "INVALID");
      check(invalid.rows.every(row => row.status === "UNREACHABLE_TARGET" && row.applied === "未应用"), "G: all unreachable");
      return invalid;
    },
    async stale() {
      for (let feed = 0; feed < 4; feed++) await commit(feed, 0, 23);
      await commit(0, 1, 18); await observe("D-before", "VALIDATED");
      // A is last: replacing it must also prevent an earlier valid target from writing.
      await select([[2], [0]]);
      const selected = await read();
      await tab.playwright.getByRole("button", { name: "Yarn 1 · Yarn 1", exact: true }).first().press("Enter");
      await tab.playwright.domSnapshot();
      await tab.playwright.getByRole("button", { name: "Batch B", exact: true }).click();
      await tab.playwright.getByRole("button", { name: "三角座 / 排针", exact: true }).first().click();
      await tab.playwright.getByRole("button", { name: "Yarn 1 · Yarn 1", exact: true }).first().press("Enter");
      const replacement = await observe("D-replaced", "VALIDATED");
      check(replacement.selections[0].yarnId !== selected.selections[0].yarnId, "D: actual slot replaced");
      check(replacement.feedback.includes("纱线配置已变化"), "D: pre-submit stale warning");
      await draft().fill(""); await draft().pressSequentially("27"); await apply().click();
      const rejected = await observe("D", "VALIDATED");
      check(rejected.feedback === "纱线配置已变化，请重新选择。未修改任何纱线。", "D: stale failure feedback");
      check(JSON.stringify(rejected.rows) === JSON.stringify(replacement.rows) && JSON.stringify(rejected.inputs) === JSON.stringify(replacement.inputs), "D: reject whole batch including earlier target");
      return rejected;
    },
  };
}
