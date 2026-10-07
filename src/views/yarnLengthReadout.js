import { html } from "lit-html";
import { GLOBAL_STATE, dispatch } from "../state";
import {
  gaugeToNeedlePitchMm,
  normalizeMachineGauge,
} from "../simulation/yarnLengthMetrics";
import { t } from "../i18n";

export function yarnLengthReadout() {
  const language = GLOBAL_STATE.language;
  const metrics = GLOBAL_STATE.yarnLengthMetrics;
  const gauge = normalizeMachineGauge(GLOBAL_STATE.machineGauge);
  const needlePitchMm = metrics?.needlePitchMm ?? gaugeToNeedlePitchMm(gauge);
  const cmPer100 = metrics?.cmPer100Loops;

  return html`<section class="yarn-length-readout">
    <label
      class="form-control machine-gauge-control"
      data-code-guide-key="machine.gauge">
      <span>${t("machine.gauge", language)}</span>
      <input
        type="number"
        min="1"
        max="120"
        step="1"
        .value=${String(gauge)}
        @change=${(event) =>
          dispatch({
            machineGauge: normalizeMachineGauge(event.target.value),
          })} />
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
