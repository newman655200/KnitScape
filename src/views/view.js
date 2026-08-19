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
import { needleArrangementControls } from "./needleArrangementControls.js";

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
            ${needleArrangementControls()}
            <div id="pattern-editors">
              ${bitmapEditor({
                field: "camBitmap",
                titleKey: "cam.title",
              })}
              ${bitmapEditor({
                field: "needleBitmap",
                titleKey: "needle.title",
                showYarn: true,
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
