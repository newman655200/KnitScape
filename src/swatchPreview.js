import { readProjectPackage } from './actions/projectPackage.js';
import { loadJSON } from './actions/importers.js';
import { dispatch } from './state.js';

async function applyExampleMaterial({ project, registry }) {
  // Appearance override for this bookmarked candidate only. Keep the original SOP
  // package, yarn identities and physical/length fields intact.
  const maps = await Promise.all([
    ['baseColor', 'yarn_basecolor_alpha.png'],
    ['roughness', 'yarn_roughness.png'],
  ].map(async ([channel, fileName]) => {
    const response = await fetch(import.meta.env.BASE_URL + 'materials/white-gray-yarn/' + fileName);
    if (!response.ok) throw new Error(fileName + ': HTTP ' + response.status);
    const blob = await response.blob();
    return [channel, { fileName, assetRef: registry.register(blob), mimeType: blob.type, byteLength: blob.size }];
  }));
  const activeIds = new Set((project.singleJerseyCamProgram?.feeds ?? [])
    .flatMap(feed => feed.yarns ?? []).map(yarn => String(yarn.yarnId)));
  const pbr = Object.fromEntries(maps);
  project.yarnLibrary = project.yarnLibrary.map(asset => activeIds.has(String(asset.id))
    ? { ...asset, color: '#c8c8c8', pbr } : asset);
}

// The bookmarked example uses the same editor, project import and published machine
// snapshot as a manually opened SOP. Resolve it before mounting the editable UI.
export async function startExampleEditor(startEditor, status) {
  let opened, error;
  try {
    const response = await fetch(import.meta.env.BASE_URL + 'current-SOP.knitscape');
    if (!response.ok) throw new Error('HTTP ' + response.status);
    opened = await readProjectPackage(await response.blob());
    await applyExampleMaterial(opened);
  } catch (caught) {
    error = caught;
  }

  status.remove();
  startEditor();
  if (opened) {
    try {
      loadJSON(opened.project, opened.registry);
      dispatch({ workbenchMode: 'sop3d', workspaceMode: 'machine' });
    } catch (caught) {
      error = caught;
    }
  }
  if (error) window.alert('SOP 示例打开失败：' + error.message);
}
