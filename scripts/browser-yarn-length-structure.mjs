// Run in a disposable CUA tab after createYarnLengthBatchBrowserTest.setup()/pair().
// All mutations use visible controls; evaluate reads rendered DOM only.
export function createYarnLengthStructureBrowserTest(tab, capture = async () => {}, assetName = 'Batch B') {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const input = (feed, slot = 0) => tab.playwright.locator(`input[data-feed-index="${feed}"][data-yarn-index="${slot}"]`);
  const choice = (feed, slot = 0) => tab.playwright.locator(`input[name="selected-yarn"][data-batch-feed="${feed}"][data-batch-yarn="${slot}"]`);
  async function read() {
    return tab.playwright.evaluate(() => ({
      validity: document.querySelector('[data-preview-validity]').dataset.previewValidity,
      count: document.querySelector('.cam-batch-target-count').textContent.trim(),
      feedback: document.querySelector('.cam-batch-feedback').textContent.trim(),
      disabled: document.querySelector('.cam-yarn-length-batch button[type="submit"]').disabled,
      checked: Array.from(document.querySelectorAll('input[name="selected-yarn"]')).map(e => e.checked),
      inputs: Array.from(document.querySelectorAll('input[data-feed-index]')).map(e => ({
        feed: e.dataset.feedIndex, slot: e.dataset.yarnIndex, value: e.value })),
      rows: Array.from(document.querySelectorAll('[data-solver-feed]')).map(e => e.textContent.trim()),
    }));
  }
  async function commit(feed, slot, value) {
    await input(feed, slot).fill(''); await input(feed, slot).pressSequentially(String(value));
    await tab.playwright.getByRole('heading', { name: 'Cam Program（三角座）', exact: true }).click();
  }
  async function wait(feed, slot, value) {
    await tab.playwright.locator(`[data-solver-feed="${feed}"][data-solver-yarn="${slot}"]`)
      .filter({ hasText: Number(value).toFixed(4) }).filter({ hasText: 'CONVERGED' })
      .waitFor({ state: 'visible', timeoutMs: 30000 });
  }
  async function pending(name) {
    await tab.playwright.getByRole('button', { name: '纱线库', exact: true }).click();
    await tab.playwright.getByRole('button', { name, exact: true }).click();
    await tab.playwright.getByRole('button', { name: '三角座 / 排针', exact: true }).first().click();
  }
  async function selected(targets) {
    for (const [feed, slot = 0] of targets) await choice(feed, slot).press('Space');
    check((await read()).count === `将修改 ${targets.length} 根纱线`, 'Explicit assignment count');
  }
  async function stale(name) {
    const before = await read();
    check(before.feedback.includes('纱线配置已变化') && before.checked.every(value => !value),
      'Immediate stale warning; recreated/moved assignment must never be checked');
    await capture(`${name}-stale`, before, await tab.screenshot({ fullPage: true }));
    const draft = tab.playwright.getByRole('textbox', { name: '批量设置纱长', exact: true });
    await draft.fill(''); await draft.pressSequentially('27');
    await tab.playwright.getByRole('button', { name: '应用', exact: true }).press('Enter');
    const after = await read();
    check(after.feedback === '纱线配置已变化，请重新选择。未修改任何纱线。', 'Clear failure feedback');
    check(after.count === '将修改 0 根纱线' && after.disabled && after.checked.every(value => !value), 'Old selection cleared');
    check(after.validity === before.validity && JSON.stringify(after.inputs) === JSON.stringify(before.inputs) &&
      JSON.stringify(after.rows) === JSON.stringify(before.rows), 'No wrong target/result mutation on rejected batch');
    await capture(`${name}-rejected`, after, await tab.screenshot({ fullPage: true }));
    return after;
  }
  const removeFirst = () => tab.playwright.getByRole('button', { name: '移除 Yarn 1 槽位', exact: true }).first().press('Enter');
  const cancelPending = () => tab.playwright.getByRole('button', { name: '取消待分配', exact: true }).click();
  const add = () => tab.playwright.getByRole('button', { name: '+ Yarn', exact: true }).first().press('Enter');
  return {
    async aba() {
      await commit(0, 0, 23); await commit(0, 1, 18); await wait(0, 0, 23); await wait(0, 1, 18);
      await selected([[0], [2]]); await removeFirst();
      await tab.playwright.locator('.cam-batch-feedback').filter({ hasText: '纱线配置已变化' })
        .waitFor({ state: 'visible', timeoutMs: 30000 });
      check((await read()).feedback.includes('纱线配置已变化'), 'Deletion marks stale before Apply');
      await pending('Yarn 1');
      await tab.playwright.getByRole('button', { name: `Yarn 1 · ${assetName}`, exact: true }).first().press('Enter');
      await commit(0, 0, 23); await pending(assetName); await add(); await commit(0, 1, 18);
      await wait(0, 0, 23); await wait(0, 1, 18);
      const result = await stale('BLOCKER-A'); check(result.inputs[0].value === '23', 'Recreated A keeps23');
      await cancelPending(); return result;
    },
    async shift() {
      await pending('Yarn 1');
      await tab.playwright.getByRole('button', { name: `Yarn 2 · ${assetName}`, exact: true }).press('Enter');
      await cancelPending(); await commit(0, 1, 18); await wait(0, 1, 18);
      await selected([[0, 1]]); await removeFirst(); await wait(0, 0, 18);
      const result = await stale('BLOCKER-B'); check(result.inputs[0].value === '18', 'Shifted A keeps18'); return result;
    },
    async occupiedOldSlot() {
      await pending('Yarn 1'); await add(); await cancelPending();
      await commit(0, 0, 23); await commit(0, 1, 18); await wait(0, 0, 23); await wait(0, 1, 18);
      await selected([[0]]); await removeFirst(); await wait(0, 0, 18);
      const result = await stale('BLOCKER-B-occupied-slot');
      check(result.inputs[0].value === '18', 'Unselected sibling must not inherit old selection'); return result;
    },
  };
}
