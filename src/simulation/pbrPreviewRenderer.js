import {
  collectYarnTextureSources,
  prepareYarnTextureImages,
  releaseYarnTextureImages,
  retainYarnAssetTextureImages,
} from "./yarnTextureBrush.js";
import { buildYarnUvPathOffsets } from "./yarnPathUvStrip.js";
import { normalizeYarnTexture } from "../yarnTexture/yarnScanTexture.js";
import { TEXTURE_PERFORMANCE_MODES } from "../constants";
import { drawYarnSimulation } from "./drawYarnSimulation.js";
import { disposeWebglYarnRenderer } from "./yarnUvWebglRenderer.js";

function shouldRenderTextures(scene) {
  if (scene.texturePerformanceMode === TEXTURE_PERFORMANCE_MODES.SOLID) return false;
  return scene.texturePerformanceMode !== TEXTURE_PERFORMANCE_MODES.AUTO || !scene.texturePreviewInteractionActive;
}

function hasUvTextureMap(ply) {
  const texture = normalizeYarnTexture(ply.texture);
  return texture && texture.enabled !== false && collectYarnTextureSources(texture).length > 0;
}

function sameLinks(left, right) {
  return left?.length === right.length && right.every((link, index) => link === left[index]);
}

function materialUvInputs(ply) {
  const repeat = ply.texture?.pbr?.physicalRepeatLengthMm;
  return [ply.diameter, Number.isFinite(repeat) && repeat > 0 ? repeat : null];
}

// The host supplies a readonly computation snapshot, projected yarnStrands,
// unfiltered yarnPathLinks, shared renderItems, viewport/stitchWidth/gauge,
// structureLineStyle and texture performance/interaction flags. No project
// decisions or numerical computation belong to this resource-owning renderer.
export function createPbrPreviewRenderer() {
  const imageOwner = {};
  const uvStripCache = new Map();
  let canvases = null, geometry = null, preparedStrands = null;
  let uvMaterialKey = null;
  let token = 0, disposed = false;
  let status = Object.freeze({ phase: "unmounted", failedTextureCount: 0 });
  let ready = Promise.resolve(status);
  const setStatus = (phase, failedTextureCount = 0) => {
    status = Object.freeze({ phase, failedTextureCount });
    return status;
  };

  const api = {
    mount(nextCanvases) {
      if (disposed) throw new Error("A disposed PBR renderer cannot be mounted again.");
      if (canvases && Object.keys(canvases).some(key => canvases[key] !== nextCanvases[key])) {
        throw new Error("Dispose a PBR renderer before mounting different canvases.");
      }
      canvases = nextCanvases;
      setStatus("mounted");
      return api;
    },
    update(scene) {
      if (disposed) return ready;
      if (!canvases) throw new Error("Mount PBR canvases before updating the scene.");
      const currentToken = ++token;
      const { snapshot, renderItems, yarnStrands, yarnPathLinks,
        canvasWidth, canvasHeight, stitchWidth, machineGauge } = scene;
      const { activeYarnPlies, feedYarnPlies, strandLinks } = renderItems;
      // Keep only strips for the current UV-affecting inputs. Use unfiltered
      // materials so visibility, colors and image identities do not churn UVs.
      const nextUvMaterialKey = JSON.stringify([machineGauge,
        activeYarnPlies.map(materialUvInputs),
        [...feedYarnPlies].map(([feed, plies]) => [feed, plies.map(materialUvInputs)]),
      ]);
      if (uvMaterialKey !== nextUvMaterialKey) {
        uvStripCache.clear();
        uvMaterialKey = nextUvMaterialKey;
      }
      const textureMaterials = [...new Set([
        ...activeYarnPlies.slice(1),
        ...(feedYarnPlies.size ? [...feedYarnPlies.values()].flat() : [activeYarnPlies[0]]),
      ])];
      retainYarnAssetTextureImages([...textureMaterials, ...activeYarnPlies], imageOwner);
      const renderTextures = shouldRenderTextures({ texturePerformanceMode: TEXTURE_PERFORMANCE_MODES.AUTO, ...scene });
      const renderUvTextures = renderTextures && textureMaterials.some(hasUvTextureMap);
      const needsUvOffsets = renderUvTextures || yarnStrands.length > 1;
      const sameGeometry = geometry && geometry.canvasWidth === canvasWidth && geometry.canvasHeight === canvasHeight &&
        geometry.stitchWidth === stitchWidth && sameLinks(geometry.yarnPathLinks, yarnPathLinks) &&
        geometry.yarnStrands.length === yarnStrands.length && yarnStrands.every((strand, index) =>
          strand.modelPathByLink === geometry.yarnStrands[index].modelPathByLink &&
          strand.resolvedPathByLink === geometry.yarnStrands[index].resolvedPathByLink &&
          sameLinks(geometry.strandLinks[index], strandLinks[index]));
      if (!sameGeometry || (needsUvOffsets && !preparedStrands[0]?.uvOffsets)) {
        uvStripCache.clear();
        preparedStrands = yarnStrands.map((strand, index) => ({ ...strand,
          uvOffsets: needsUvOffsets ? buildYarnUvPathOffsets(strandLinks[index], strand.modelPathByLink) : null,
        }));
        geometry = { canvasWidth, canvasHeight, stitchWidth, yarnPathLinks, yarnStrands, strandLinks };
      }
      // Clone draw items only to attach renderer-local UV metadata. Keep all
      // material, assignment, layer, path and normal-offset decisions unchanged.
      const items = new Map(renderItems.items.map(item => [item,
        { ...item, strand: preparedStrands[item.yarnIndex] }]));
      const resolvedItems = { ...renderItems, items: [...items.values()],
        groups: renderItems.groups.map(group => ({ ...group, items: group.items.map(item => items.get(item)) })),
      };
      const draw = () => drawYarnSimulation({
        renderItems: resolvedItems, canvases, canvasWidth, canvasHeight, yarnPathLinks,
        yarnStrands: preparedStrands, uvStripCache, feedYarnPlies,
        feedYarnIds: snapshot.feedYarnIds, visibleYarnId: renderItems.visibleYarnId,
        structureLineStyle: scene.structureLineStyle, feedCount: snapshot.feedCount,
        machineGauge, stitchWidth, activeYarnPlies,
        normalizedYarnSequence: snapshot.normalizedYarnSequence,
        palette: snapshot.palette, hasYarnSequenceMask: snapshot.hasYarnSequenceMask,
        renderTextures, renderUvTextures,
      });
      setStatus(renderTextures ? "loading" : "ready");
      draw();
      ready = renderTextures ? prepareYarnTextureImages(textureMaterials).then(results => {
        if (disposed || currentToken !== token) return status;
        draw();
        return setStatus("ready", results.filter(result => result.status === "rejected").length);
      }) : Promise.resolve(status);
      return ready;
    },
    suspend() {
      if (disposed) return;
      token++;
      ready = Promise.resolve(setStatus("suspended"));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      token++;
      if (canvases) Object.values(canvases).forEach(disposeWebglYarnRenderer);
      releaseYarnTextureImages(imageOwner);
      uvStripCache.clear();
      canvases = geometry = preparedStrands = null;
      uvMaterialKey = null;
      ready = Promise.resolve(setStatus("disposed"));
    },
    get ready() { return ready; },
    get status() { return status; },
  };
  return api;
}
