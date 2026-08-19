import { html } from "lit-html";
import { yarnPlyPanel } from "./yarnPlyPanel";
import { yarnPicker } from "./yarnPicker";

export function leftBar() {
  return html`<div id="left-bar" class="scroller">
    ${yarnPlyPanel()} ${yarnPicker()}
  </div>`;
}
