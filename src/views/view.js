import { html } from "lit-html";
import { when } from "lit-html/directives/when.js";
import { GLOBAL_STATE } from "../state";

import { taskbar } from "./taskbar";
import { downloadModal } from "./downloadModal";
import { libraryModal } from "./libraryModal";
import { settingsModal } from "./settingsModal";
import { chartTools } from "./chartTools";
import { debugPane } from "./debugPane";
import { leftBar } from "./leftBar";
import { chartEditorToolbar } from "./chartEditorToolbar";
import { bitmapEditor } from "./bitmapEditor.js";

import { simulationView } from "../components/runSimulation";
import { syncDocumentLanguage } from "../i18n";
import { codeGuideOverlay } from "../codeGuide/codeGuideOverlay";

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
            <div id="pattern-editors">
              ${bitmapEditor({
                fullField: "camBitmap",
                unitField: "camUnitBitmap",
                prefix: "cam",
                titleKey: "cam.title",
              })}
              ${bitmapEditor({
                fullField: "needleBitmap",
                unitField: "needleUnitBitmap",
                prefix: "needle",
                titleKey: "needle.title",
                showNeedleControls: true,
              })}
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
