// Run with an existing Codex computer-use browser tab on the local application:
// const { runYarnLengthFeedbackBrowserTest } = await import(absoluteModulePath);
// await runYarnLengthFeedbackBrowserTest(tab, async (name, reading, screenshot) => { ... });
// Only visible controls and read-only DOM observations are used. No app state injection.
// This reloads its disposable test tab; it never saves/exports a project.
export async function runYarnLengthFeedbackBrowserTest(tab, capture = async () => {}) {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const readings = [];
  const commitLength = async (feed, yarn, value) => {
    const input = tab.playwright.locator(`input[data-feed-index="${feed}"][data-yarn-index="${yarn}"]`);
    // Native typing/blur commits @change, including browsers whose fill is synthetic.
    await input.fill("");
    await input.pressSequentially(String(value));
    await tab.playwright.getByRole("heading", { name: "Cam Program（三角座）", exact: true }).click();
  };
  const setLengths = async targets => {
    for (let feed = 0; feed < targets.length; feed++) await commitLength(feed, 0, targets[feed]);
  };
  async function observe(testCase, validity) {
    await tab.playwright.locator(`[data-preview-validity="${validity}"]`).waitFor({ state: "visible", timeoutMs: 30000 });
    const reading = await tab.playwright.evaluate(() => ({
      validity: document.querySelector("[data-preview-validity]").getAttribute("data-preview-validity"),
      text: document.querySelector(".yarn-solver-feedback").innerText,
      rows: Array.from(document.querySelectorAll("[data-solver-feed]")).map(row => ({
        feed: Number(row.dataset.solverFeed), yarn: Number(row.dataset.solverYarn),
        target: row.querySelector(".solver-target").textContent.trim(),
        solved: row.querySelector(".solver-length").textContent.trim(),
        status: row.querySelector(".solver-status").textContent.trim(),
        applied: row.querySelector(".solver-applied").textContent.trim(),
        reason: row.querySelector(".solver-reason").textContent.trim(),
      })),
      inputs: Array.from(document.querySelectorAll("input[data-feed-index]")).map(input => ({
        feed: Number(input.dataset.feedIndex), yarn: Number(input.dataset.yarnIndex), value: input.value,
      })),
    }));
    check(reading.text.includes("未经实机验证"), `${testCase}: model-only qualification missing`);
    readings.push({ testCase, ...reading });
    await capture(testCase, reading, await tab.screenshot({ fullPage: true }));
    return reading;
  }
  await tab.reload();
  await tab.playwright.domSnapshot();
  await tab.playwright.getByRole("button", { name: "三角座 / 排针", exact: true }).click();
  await tab.playwright.getByRole("button", { name: "创建 Cam Program", exact: true }).click();
  await tab.playwright.getByRole("textbox", { name: "输入框1", exact: true }).fill("1234");
  await tab.playwright.getByRole("button", { name: "确认排针", exact: true }).click();
  const unset = await observe("D", "DESIGN_PREVIEW");
  check(unset.rows.length === 4 && unset.rows.every(row => row.status === "NOT_SET" && row.applied === "未应用"), "D: unset targets");
  await setLengths([23, 23, 23, 23]);
  const success = await observe("A", "VALIDATED");
  check(success.rows.every(row => row.status === "CONVERGED" && row.applied === "已应用" &&
    Math.abs(Number(row.solved) - 23) <= 0.00079375), "A: target convergence/application");
  await setLengths([100, 100, 100, 100]);
  const unreachable = await observe("B", "INVALID");
  check(unreachable.rows.every(row => row.status === "UNREACHABLE_TARGET" && row.applied === "未应用" &&
    row.target === "100.0000" && row.reason.includes("非实际工艺范围")), "B: failure feedback");
  check(unreachable.inputs.every(input => Number(input.value) === 100), "B: preserve user targets");
  await setLengths([23, 100, 23, 100]);
  const partial = await observe("C", "PARTIAL");
  check(partial.rows.filter(row => row.applied === "已应用").length === 2, "C: partial Feed application");
  await setLengths([23, 23, 23, 23]);
  const recovery = await observe("F", "VALIDATED");
  check(recovery.rows.every(row => row.status === "CONVERGED" && row.applied === "已应用"), "F: recovery");
  await tab.playwright.getByRole("button", { name: "撤回排针", exact: true }).click();
  const withdrawn = await observe("E", "DESIGN_PREVIEW");
  check(withdrawn.rows.every(row => row.applied === "未应用" && row.solved === "—" &&
    row.status === "尚无当前结果"), "E: stale solver feedback after machine change");
  await tab.playwright.getByRole("button", { name: "确认排针", exact: true }).click();
  await tab.playwright.locator('[data-preview-validity="VALIDATED"]').waitFor({ state: "visible", timeoutMs: 30000 });
  await tab.playwright.getByRole("button", { name: "纱线库", exact: true }).click();
  await tab.playwright.domSnapshot();
  await tab.playwright.getByRole("button", { name: "Yarn 1", exact: true }).click();
  await tab.playwright.getByRole("button", { name: "三角座 / 排针", exact: true }).first().click();
  await tab.playwright.getByRole("button", { name: "+ Yarn", exact: true }).first().click();
  await commitLength(0, 1, 100);
  const sameFeed = await observe("G", "PARTIAL");
  check(sameFeed.rows.length === 5 && sameFeed.rows.find(row => row.feed === 0 && row.yarn === 0).applied === "已应用" &&
    sameFeed.rows.find(row => row.feed === 0 && row.yarn === 1).status === "UNREACHABLE_TARGET" &&
    sameFeed.rows.find(row => row.feed === 0 && row.yarn === 1).applied === "未应用", "G: per-Yarn feedback isolation");
  check((await tab.playwright.getByText("基础预览统计，非目标求解值", { exact: true }).count()) === 1, "Legacy preview must be qualified");
  // Reading/selecting a result must not start the canvas pan/texture interaction.
  await tab.playwright.locator('[data-solver-feed="0"][data-solver-yarn="1"] .solver-status').click();
  await tab.playwright.domSnapshot();
  check((await tab.playwright.locator('[data-preview-validity]').getAttribute("data-preview-validity")) === "PARTIAL",
    "Reading solver feedback must not invalidate the preview or pan the canvas");
  await tab.playwright.getByRole("button", { name: "设置", exact: true }).click();
  await tab.playwright.locator("#settings-modal").waitFor({ state: "visible", timeoutMs: 30000 });
  await tab.playwright.locator('[data-solver-feed="0"][data-solver-yarn="1"] .solver-status').click();
  await tab.playwright.domSnapshot();
  check((await tab.playwright.locator("#settings-modal").count()) === 0,
    "Reading feedback must retain existing outside-click modal dismissal");
  return readings;
}
