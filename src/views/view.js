import { html } from "lit-html";
import { when } from "lit-html/directives/when.js";
import { dispatch, GLOBAL_STATE } from "../state";

import { taskbar } from "./taskbar";
import { downloadModal } from "./downloadModal";
import { libraryModal } from "./libraryModal";
import { settingsModal } from "./settingsModal";
import { chartTools } from "./chartTools";
import { debugPane } from "./debugPane";
import { leftBar } from "./leftBar";
import { repeatCanvas } from "./repeatCanvas";
import { repeatTools } from "./repeatTools";
import { chartEditorToolbar } from "./chartEditorToolbar";
import { needleArrangementBar } from "./needleArrangementBar";
import { singleJerseyCamProgramEditor } from "./singleJerseyCamProgramEditor";

import { simulationView } from "../components/runSimulation";
import { syncDocumentLanguage } from "../i18n";
import { codeGuideOverlay } from "../codeGuide/codeGuideOverlay";

function selectedChartCell() {
  const selected = GLOBAL_STATE.selectedChartCell;
  if (!selected) return null;

  const cellSize = GLOBAL_STATE.scale / devicePixelRatio;
  return html`<div
    class="selected-chart-cell"
    style="left:${selected.x * cellSize}px; top:${selected.y *
    cellSize}px; width:${cellSize}px; height:${cellSize}px;"></div>`;
}

export function view() {
  syncDocumentLanguage(GLOBAL_STATE.language);

  return html`
    ${when(GLOBAL_STATE.showDownload, downloadModal)}
    ${when(GLOBAL_STATE.showLibrary, libraryModal)}
    ${when(GLOBAL_STATE.showSettings, settingsModal)} ${taskbar()}

    <div id="site">
      <div id="chart-pane">
        <div id="chart-layout">
          ${leftBar()}
          <main id="chart-workspace">
            ${chartEditorToolbar()}
            ${when(GLOBAL_STATE.editingRepeat > -1, repeatTools)}
            ${needleArrangementBar()}
            ${singleJerseyCamProgramEditor()}
            <div id="desktop">
              <div
                id="canvas-transform-group"
                style="transform: translate(${Math.floor(
                  GLOBAL_STATE.chartPan.x
                )}px, ${Math.floor(GLOBAL_STATE.chartPan.y)}px);">
                <div id="yarn-sequence">
                  <canvas id="yarn-sequence-canvas" data-code-guide-key="chart.yarn-sequence"></canvas>
                </div>
                <canvas id="yarn-color-canvas" data-code-guide-key="chart.yarn-color"></canvas>
                <canvas id="symbol-canvas" data-code-guide-key="chart.symbols"></canvas>
                <canvas id="grid" class="grid-canvas" data-code-guide-key="chart.grid"></canvas>
                ${selectedChartCell()}
                ${repeatCanvas()}
              </div>
            </div>
            ${chartTools()}
          </main>
        </div>
      </div>
      ${simulationView()}
    </div>
    ${when(GLOBAL_STATE.debug, debugPane)}
    ${codeGuideOverlay()}
  `;
}
