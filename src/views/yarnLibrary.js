import { html } from "lit-html";
import { repeat } from "lit-html/directives/repeat.js";
import { GLOBAL_STATE, dispatch } from "../state.js";
import { YARN_CATEGORIES, queryYarnLibrary } from "../domain/yarnLibrary.js";
import { addYarnAsset, updateYarnAsset, deleteYarnAsset,
  selectYarnForAssignment, getYarnPbr, importYarnPbr, clearYarnPbr,
  setYarnPbrPhysicalRepeatLength } from "../actions/yarnLibrary.js";
import { t } from "../i18n/index.js";

let editingYarnId = null;

function toggleYarnEditor(event, id) {
  if (event.currentTarget.open) editingYarnId = id;
  else if (editingYarnId === id) editingYarnId = null;
  else return;
  dispatch({});
}

async function importPbr(event, id) {
  const input = event.currentTarget;
  if (!input.files?.length) return;
  try {
    await importYarnPbr(id, Array.from(input.files));
  } catch (error) {
    const key = error.code === "PBR_AMBIGUOUS_FILES" ? "pbrAmbiguous"
      : error.code === "PBR_UNRECOGNIZED_FILES" ? "pbrUnrecognized" : "pbrImportFailed";
    dispatch({ yarnLibraryError: key });
  } finally { input.value = ""; }
}

function yarnPbrControls(id, language) {
  const pbr = getYarnPbr(id);
  const maps = pbr ? Object.entries(pbr).filter(([, map]) => map?.fileName) : [];
  return html`<div class="yarn-pbr-controls">
    ${pbr?.previewDataUrl ? html`<img class="yarn-pbr-preview" src=${pbr.previewDataUrl}
      alt="BaseColor" width="48" height="48" />` : null}
    <button class="btn" type="button" @click=${event =>
      event.currentTarget.parentElement.querySelector('input[type="file"]').click()}>
      ${t(pbr ? "yarnLibrary.pbrReplace" : "yarnLibrary.pbrImport", language)}
    </button>
    <input type="file" hidden multiple accept="image/png,image/jpeg,image/webp"
      aria-label=${t("yarnLibrary.pbrImport", language)} @change=${event => importPbr(event, id)} />
    ${pbr ? html`<button class="btn" type="button" @click=${() => clearYarnPbr(id)}>
      ${t("yarnLibrary.pbrClear", language)}</button>` : null}
    ${pbr ? html`<label class="yarn-pbr-repeat-length">
      ${t("yarnLibrary.pbrRepeatLength", language)}
      <input type="number" step="any" .value=${String(pbr.physicalRepeatLengthMm ?? "")}
        @input=${event => event.currentTarget.setCustomValidity("")}
        @change=${event => {
          const input = event.currentTarget;
          const value = input.value.trim() === "" ? "" : Number(input.value);
          if (input.validity.badInput || (value !== "" && (!Number.isFinite(value) || value <= 0))) {
            input.setCustomValidity(t("yarnLibrary.pbrRepeatInvalid", language));
            input.reportValidity();
            return;
          }
          setYarnPbrPhysicalRepeatLength(id, value);
        }} /> mm
    </label>` : null}
    <small class="yarn-pbr-help">${t("yarnLibrary.pbrHelp", language)}</small>
    ${maps.length ? html`<ul class="yarn-pbr-maps">${maps.map(([key, map]) =>
      html`<li>${key}: <span title=${map.fileName}>${map.fileName}</span></li>`)}</ul>` : null}
  </div>`;
}

function changeQuery(field, value) {
  dispatch({ yarnLibraryQuery: { ...GLOBAL_STATE.yarnLibraryQuery, [field]: value }, yarnLibraryError: null });
}

function saveYarn(event, id) {
  event.preventDefault();
  const form = event.currentTarget;
  const input = form.elements.yarnName;
  input.setCustomValidity(input.value.trim() ? "" : t("yarnLibrary.nameRequired", GLOBAL_STATE.language));
  if (!form.reportValidity()) return;
  if (id === undefined) {
    addYarnAsset(input.value, form.elements.category.value);
    form.reset();
  } else {
    updateYarnAsset(id, input.value, form.elements.category.value);
    form.closest("details").open = false;
  }
}

function categoryOptions(selected = "OTHER") {
  return YARN_CATEGORIES.map(category => html`<option value=${category}
    ?selected=${category === selected}>${category}</option>`);
}

function yarnForm(language, asset) {
  return html`<form class="yarn-asset-form" @submit=${event => saveYarn(event, asset?.id)}>
    <input name="yarnName" required .value=${asset?.name ?? ""}
      placeholder=${t("yarnLibrary.name", language)}
      aria-label=${t("yarnLibrary.name", language)}
      @input=${event => event.currentTarget.setCustomValidity("")} />
    <select name="category" aria-label=${t("yarnLibrary.category", language)}>
      ${categoryOptions(asset?.category)}
    </select>
    <button class="btn solid" type="submit">
      ${t(asset ? "yarnLibrary.save" : "yarnLibrary.add", language)}
    </button>
  </form>`;
}

export function yarnAssignmentNotice() {
  const { yarnLibrary, pendingYarnId, language, workspaceMode } = GLOBAL_STATE;
  const asset = yarnLibrary.find(yarn => yarn.id === pendingYarnId);
  if (!asset) return null;
  return html`<div class="yarn-assignment-notice" role="status">
    <span>${t("yarnLibrary.pending", language, { name: asset.name })}
      ${t("yarnLibrary.assignHelp", language)}</span>
    ${workspaceMode === "yarns" ? html`<button class="btn" type="button"
      @click=${() => dispatch({ workspaceMode: "machine" })}>
      ${t("workspace.machine", language)}</button>` : null}
    <button class="btn" type="button" @click=${() => dispatch({ pendingYarnId: null })}>
      ${t("yarnLibrary.cancel", language)}</button>
  </div>`;
}

export function yarnLibraryWorkspace() {
  const { language, yarnLibrary, yarnLibraryQuery, pendingYarnId, yarnLibraryError } = GLOBAL_STATE;
  const yarns = queryYarnLibrary(yarnLibrary, yarnLibraryQuery);
  return html`<h2>${t("workspace.yarns", language)}</h2>
    ${yarnAssignmentNotice()}
    <div class="yarn-library-toolbar">
      <input type="search" .value=${yarnLibraryQuery.search}
        aria-label=${t("yarnLibrary.search", language)}
        placeholder=${t("yarnLibrary.search", language)}
        @input=${event => changeQuery("search", event.currentTarget.value)} />
      <select aria-label=${t("yarnLibrary.category", language)}
        @change=${event => changeQuery("category", event.currentTarget.value)}>
        <option value="ALL" ?selected=${yarnLibraryQuery.category === "ALL"}>${t("yarnLibrary.all", language)}</option>
        ${categoryOptions(yarnLibraryQuery.category)}
      </select>
      <select aria-label=${t("yarnLibrary.sort", language)}
        @change=${event => changeQuery("sort", event.currentTarget.value)}>
        <option value="name" ?selected=${yarnLibraryQuery.sort === "name"}>${t("yarnLibrary.sortName", language)}</option>
        <option value="updated" ?selected=${yarnLibraryQuery.sort === "updated"}>${t("yarnLibrary.sortUpdated", language)}</option>
      </select>
    </div>
    ${yarnForm(language)}
    ${yarnLibraryError ? html`<p class="yarn-library-error" role="alert">
      ${t(`yarnLibrary.${yarnLibraryError}`, language)}</p>` : null}
    <div class="yarn-library-list">
      <table class="yarn-library-table">
        <thead><tr><th>${t("yarnLibrary.name", language)}</th>
          <th>${t("yarnLibrary.category", language)}</th>
          <th>${t("yarnLibrary.updated", language)}</th><th></th></tr></thead>
        <tbody>${repeat(yarns, yarn => yarn.id, asset => html`<tr
          class=${asset.id === pendingYarnId ? "yarn-pending" : ""}>
          <td><div class="yarn-asset-title"><button class="yarn-asset-name" type="button" title=${asset.name}
            aria-pressed=${asset.id === pendingYarnId}
            @click=${() => selectYarnForAssignment(asset.id)}>${asset.name}</button>
            <small class="yarn-pbr-status">${t(asset.pbr ? "yarnLibrary.pbrSet" : "yarnLibrary.pbrUnset", language)}</small>
          </div></td>
          <td>${asset.category}</td>
          <td><time datetime=${asset.updatedAt}>${new Date(asset.updatedAt).toLocaleString(language)}</time></td>
          <td class="yarn-asset-actions">
            <details ?open=${editingYarnId === asset.id} @toggle=${event => toggleYarnEditor(event, asset.id)}>
              <summary>${t("yarnLibrary.edit", language)}</summary>${yarnForm(language, asset)}
              ${editingYarnId === asset.id && GLOBAL_STATE.workspaceMode === "yarns"
                ? yarnPbrControls(asset.id, language) : null}
            </details>
            <button class="btn" type="button" @click=${() => {
              dispatch({ yarnLibraryError: deleteYarnAsset(asset.id) ? null : "inUse" });
            }}>${t("yarnLibrary.delete", language)}</button>
          </td>
        </tr>`)}</tbody>
      </table>
      ${yarns.length ? null : html`<p>${t("yarnLibrary.empty", language)}</p>`}
    </div>
    <p class="yarn-library-hint">${t("yarnLibrary.rendererLimit", language)}</p>`;
}
