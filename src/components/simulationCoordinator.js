import { computeYarnSimulation } from "../simulation/computeYarnSimulation.js";
import { createSingleJerseyExecutionInput } from "./singleJerseyExecutionInput.js";
import { yarnMaterialGeometryKey } from "../domain/yarnMaterial.js";
import { resolveYarnLengthInput } from "../domain/yarnLengthInput.js";

function inputKeys(state) {
  const generation = state.projectGeneration ?? 0;
  const { chart, singleJerseyCamProgram: cam } = state;
  const shared = { generation, gauge: state.machineGauge,
    sequence: state.yarnSequence?.toJSON?.() ?? state.yarnSequence };
  const execution = JSON.stringify({ generation, width: chart.width, height: chart.height,
    tracks: cam?.tracks ?? null, arrangement: state.needleArrangement });
  return {
    execution,
    pattern: JSON.stringify({ ...shared, scope: "pattern", width: chart.width, height: chart.height,
      pixels: Array.from(chart.pixels ?? []), material: yarnMaterialGeometryKey({ ...state,
        singleJerseyCamProgram: null, yarnLibrary: null }) }),
    machine: JSON.stringify({ ...shared, scope: "machine", execution,
      revision: state.feedYarnStructureRevision ?? 0, material: yarnMaterialGeometryKey(state),
      assignments: cam?.feeds?.map(feed => feed.yarns?.map(yarn => ({
        yarnId: yarn.yarnId, lengthInput: resolveYarnLengthInput(yarn),
      }))) ?? null }),
  };
}

function isMachineConfigurationError(error) {
  return (error instanceof TypeError || error instanceof RangeError) &&
    /^(?:camProgram\.tracks|needleArrangement|Needle Type )/.test(error.message);
}

// The sole app computation owner. Renderers consume these exact immutable
// objects; viewport, workspace and appearance never participate in these keys.
export function createSimulationCoordinator() {
  let keys = null, executionKey = null, machineInput = null;
  let pattern = null, machine = null, machineExecutionError = null, pending = false, pendingMachine = false;
  const read = () => Object.freeze({ pattern, machine, machineExecutionError, pending, pendingMachine });
  return {
    read,
    invalidate(state) {
      const next = inputKeys(state);
      const changed = !keys || next.pattern !== keys.pattern || next.machine !== keys.machine;
      if (changed) pending = true;
      pendingMachine ||= !keys || next.machine !== keys.machine;
      return changed || pending;
    },
    compute(state, referenceViewport) {
      const next = inputKeys(state);
      const common = { yarnSequence: state.yarnSequence, palette: state.yarnPalette,
        yarnPlies: state.yarnPlies, machineGauge: state.machineGauge,
        projectGeneration: state.projectGeneration ?? 0,
        feedYarnStructureRevision: state.feedYarnStructureRevision ?? 0, ...referenceViewport };
      const patternChanged = !keys || keys.pattern !== next.pattern;
      const machineChanged = !keys || keys.machine !== next.machine;
      const publishMachine = machineChanged || pendingMachine;
      if (patternChanged) pattern = computeYarnSimulation({ ...common,
        pattern: state.chart, scope: "pattern", inputSignature: next.pattern });
      if (executionKey !== next.execution) {
        machineInput = null;
        machineExecutionError = null;
        try {
          machineInput = createSingleJerseyExecutionInput(state.singleJerseyCamProgram,
            state.needleArrangement, state.chart.width, state.chart.height);
        } catch (error) {
          if (!isMachineConfigurationError(error)) throw error;
          machineExecutionError = error.message;
        }
        executionKey = next.execution;
      }
      if (machineChanged) machine = machineInput === null ? null : computeYarnSimulation({ ...common,
        pattern: machineInput, feeds: state.singleJerseyCamProgram.feeds, yarnLibrary: state.yarnLibrary,
        scope: "machine", inputSignature: next.machine });
      keys = next;
      pending = false;
      pendingMachine = false;
      return { ...read(), patternChanged, machineChanged: publishMachine };
    },
  };
}
