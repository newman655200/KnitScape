import { html } from "lit-html";
import { GLOBAL_STATE, dispatch } from "../state";
import { gaugeToNeedlePitchMm } from "../simulation/yarnLengthMetrics";
import { MIN_MACHINE_GAUGE, MAX_MACHINE_GAUGE, validateMachineGauge } from "../domain/machineGauge.js";
import { t } from "../i18n";

export function yarnLengthReadout() {
  const language = GLOBAL_STATE.language;
  const metrics = GLOBAL_STATE.yarnLengthMetrics;
  const gauge = GLOBAL_STATE.machineGauge;
  const needlePitchMm = gaugeToNeedlePitchMm(gauge);
  const cmPer100 = metrics?.cmPer100Loops;

  return html`<section class="yarn-length-readout">
    <label
      class="form-control machine-gauge-control"
      data-code-guide-key="machine.gauge">
      <span>${t("machine.gauge", language)}</span>
      <input
        type="number"
        min=${MIN_MACHINE_GAUGE}
        max=${MAX_MACHINE_GAUGE}
        step="any"
        .value=${String(gauge)}
        @input=${(event) => event.target.setCustomValidity("")}
        @change=${(event) => {
          const input = event.target;
          input.setCustomValidity("");
          let value;
          try {
            value = validateMachineGauge(Number(input.value));
          } catch (error) {
            input.setCustomValidity(error.message);
            input.reportValidity();
            return;
          }
          dispatch({ machineGauge: value });
        }} />
    </label>
    <div
      class="machine-needle-pitch"
      data-code-guide-key="machine.needle-pitch">
      ${t("machine.needlePitch", language)} ${needlePitchMm.toFixed(3)} mm
    </div>
    <div
      class="current-yarn-length"
      data-code-guide-key="yarn.length-current">
      ${t("yarnLength.current", language)}
      ${Number.isFinite(cmPer100) ? cmPer100.toFixed(2) : "--"}
      ${t("yarnLength.cmPer100", language)}
      <div>${t("yarnSolver.legacyMetric", language)}</div>
    </div>
  </section>`;
}
