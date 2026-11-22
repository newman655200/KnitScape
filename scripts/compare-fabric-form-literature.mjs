import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { scaleLinear } from "d3";

const mmPerUnit = { mm: 1, cm: 10, in: 25.4 };
const texPerNe = 453.59237 * 1000 / (840 * 0.9144);
const positive = (value, label) => {
  if (!Number.isFinite(value) || value <= 0) throw new TypeError(`${label} must be positive and finite`);
  return value;
};

/** Source input units are explicit; unknown yarn-count systems are not inferred. */
export function convertLiteraturePoint(point) {
  const { yarn, loopLength, courseDensity, waleDensity, observedTF } = point;
  positive(yarn?.value, "yarn value");
  const convertTex = { tex: value => value, Ne: value => texPerNe / value,
    Nm: value => 1000 / value, den: value => value / 9 }[yarn.unit];
  if (!convertTex) throw new TypeError(`Unsupported yarn unit ${yarn.unit}`);
  const tex = convertTex(yarn.value), factor = mmPerUnit[loopLength?.unit];
  if (!factor) throw new TypeError(`Unsupported loop-length unit ${loopLength?.unit}`);
  const lengthMm = positive(loopLength.value, "loop length") * factor;
  const densityPerMm = density => {
    const unit = { per_mm: 1, per_cm: 10, per_in: 25.4 }[density?.unit];
    if (!unit) throw new TypeError(`Unsupported density unit ${density?.unit}`);
    return positive(density.value, "density") / unit;
  };
  const kcFromDensity = densityPerMm(courseDensity) * lengthMm;
  const kwFromDensity = densityPerMm(waleDensity) * lengthMm;
  if (!["reported_k", "derived_density"].includes(point.metricBasis)) throw new TypeError("Explicit metricBasis required");
  const kc = point.metricBasis === "reported_k" ? positive(point.reportedK?.kc, "reported kc") : kcFromDensity;
  const kw = point.metricBasis === "reported_k" ? positive(point.reportedK?.kw, "reported kw") : kwFromDensity;
  const ratio = point.metricBasis === "reported_k" && point.reportedK.ratio !== null
    ? positive(point.reportedK.ratio, "reported kc/kw") : kc / kw;
  const tf = Math.sqrt(tex) / lengthMm;
  let sourceTFmm = null;
  if (observedTF !== null) {
    const tfFactor = mmPerUnit[observedTF?.lengthUnit];
    if (!tfFactor || observedTF.definition !== `sqrt(tex)/l_${observedTF.lengthUnit}`) {
      throw new TypeError("Source TF requires an explicit sqrt(tex)/length definition or null");
    }
    sourceTFmm = positive(observedTF.value, "reported TF") / tfFactor;
  }
  const texFormula = { tex: `${yarn.value} tex`, Ne: `${texPerNe}/${yarn.value}`,
    Nm: `1000/${yarn.value}`, den: `${yarn.value}/9` }[yarn.unit];
  return { ...point, tex, lengthMm, tf, kc, kw, ks: kc * kw, ksFromK: kc * kw,
    ksReported: point.ks ?? null, ratio,
    kcFromDensity, kwFromDensity, ratioFromDensity: kcFromDensity / kwFromDensity, ratioFromK: kc / kw,
    sourceTFmm, sourceTFdifference: sourceTFmm === null ? null : tf - sourceTFmm,
    conversionChain: [
      `tex = ${texFormula} = ${tex}`,
      `l_mm = ${loopLength.value} ${loopLength.unit} * ${factor} = ${lengthMm} mm`,
      `TF_mm = sqrt(${tex})/${lengthMm} = ${tf}`,
    ],
    sourceTFconversion: observedTF === null ? "Source did not report a numeric TF" :
      `${observedTF.value}/${mmPerUnit[observedTF.lengthUnit]} = ${sourceTFmm}; computed minus reported = ${tf - sourceTFmm}`,
    kCalculation: (point.metricBasis === "reported_k"
      ? `Comparison uses printed kc=${kc}, kw=${kw}, kc/kw=${ratio}; density products below are rounding audits only. `
      : "Comparison uses density-derived k. ") +
      `kc_density = ${courseDensity.value} ${courseDensity.unit} * ${lengthMm} mm = ${kcFromDensity}; kw_density = ${waleDensity.value} ${waleDensity.unit} * ${lengthMm} mm = ${kwFromDensity}; both converted to matching length units; ksFromK=${kc * kw}`,
  };
}

export function compareWithDataset(model, points) {
  const nearby = points.filter(point => point.eligibleForComparison && Math.abs(point.tf - model.tf) <= 0.1);
  const result = { modelId: model.id, tf: model.tf, nodes: model.nodes, a14Status: model.a14Status,
    nearbyCount: nearby.length, nearbyPointIds: nearby.map(point => point.pointId) };
  for (const metric of ["kc", "kw", "ratio"]) {
    if (!nearby.length) { result[metric] = { status: "NO_DATA_AT_TF", min: null, max: null }; continue; }
    const min = Math.min(...nearby.map(point => point[metric])), max = Math.max(...nearby.map(point => point[metric]));
    const value = model[metric];
    result[metric] = { value, min, max, status: value >= min && value <= max ? "WITHIN_DATA_RANGE" : "OUTSIDE_DATA_RANGE" };
  }
  result.status = !nearby.length ? "NO_DATA_AT_TF" :
    ["kc", "kw", "ratio"].every(metric => result[metric].status === "WITHIN_DATA_RANGE") ? "WITHIN_DATA_RANGE" : "OUTSIDE_DATA_RANGE";
  return result;
}

function writeCsv(filename, rows) {
  const keys = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const quote = value => `"${(value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value)).replaceAll('"', '""')}"`;
  fs.writeFileSync(filename, "\ufeff" + [keys.map(quote).join(","), ...rows.map(row => keys.map(key => quote(row[key])).join(","))].join("\r\n") + "\r\n");
}

const escapeXml = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const palette = ["#176f92", "#ce6b27", "#367b46", "#985f9b", "#bc3d51", "#687f23"];
const stateLabels = { greige: "Greige / before washing", dry_relaxed: "Dry relaxed", wet_relaxed: "Wet relaxed",
  fully_relaxed: "Fully relaxed (source protocol)", fully_relaxed_with_press: "Five wash/tumble cycles + final press" };

function writeStatePlot(filename, state, points, models) {
  const ids = [...new Set(points.map(point => point.datasetId))];
  const color = id => palette[ids.indexOf(id) % palette.length];
  const width = 1240, height = 590;
  const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '<rect width="100%" height="100%" fill="white"/><g font-family="Arial,Microsoft YaHei,sans-serif" fill="#24313c">',
    `<text x="30" y="30" font-size="19">${escapeXml(stateLabels[state] ?? state)}</text>`,
    '<text x="30" y="53" font-size="12">Points only; no fitted curve. Grey band: unchanged provisional T1 B interval. TF = sqrt(tex) / l(mm).</text>'];
  for (const [panel, metric, band, label] of [[0, "kc", [4.4, 5.8], "kc"], [1, "kw", [3.4, 4.3], "kw"], [2, "ratio", [1.15, 1.5], "kc / kw"]]) {
    const left = 62 + panel * 405, top = 100, bottom = 407;
    const tfValues = [...points, ...models].map(point => point.tf);
    const values = [...points, ...models].map(point => point[metric]);
    const x = scaleLinear().domain([Math.min(...tfValues) - .05, Math.max(...tfValues) + .05]).nice().range([left, left + 335]);
    const low = Math.min(...values, ...band), high = Math.max(...values, ...band);
    const y = scaleLinear().domain([low - (high - low) * .08, high + (high - low) * .08]).nice().range([bottom, top]);
    svg.push(`<text x="${left}" y="85" font-size="17">${label}</text>`,
      `<rect x="${left}" y="${y(band[1])}" width="335" height="${y(band[0]) - y(band[1])}" fill="#eef0f2"/>`);
    for (const tick of y.ticks(6)) svg.push(`<path d="M${left},${y(tick)}h335" stroke="#dce2e7"/><text x="${left - 9}" y="${y(tick) + 4}" text-anchor="end" font-size="11">${tick}</text>`);
    for (const tick of x.ticks(5)) svg.push(`<path d="M${x(tick)},${top}V${bottom}" stroke="#e8ecef"/><text x="${x(tick)}" y="${bottom + 20}" text-anchor="middle" font-size="11">${tick}</text>`);
    for (const point of points) svg.push(`<circle cx="${x(point.tf)}" cy="${y(point[metric])}" r="4" fill="${color(point.datasetId)}"><title>${escapeXml(point.pointId)}</title></circle>`);
    for (const model of models) {
      const cx = x(model.tf), cy = y(model[metric]);
      const labelY = cy + (model.id === "sop-reference" ? (metric === "kw" ? -16 : 20)
        : metric === "kw" && model.id === "3.5" ? 18 : -9);
      const labelLeft = model.tf > 1.65 || (metric === "kw" && model.id === "3.5");
      const labelX = cx + (labelLeft ? -8 : 8);
      svg.push(`<path d="M${cx},${cy - 6}l6,6 -6,6 -6,-6Z" stroke="#161c22" stroke-width="1.5" fill="${model.convergenceEstablished ? '#161c22' : 'white'}"/>`,
        `<text x="${labelX}" y="${labelY}" text-anchor="${labelLeft ? 'end' : 'start'}" font-size="10">${escapeXml(model.shortLabel)} N${model.nodes}</text>`);
    }
    svg.push(`<text x="${left + 165}" y="450" text-anchor="middle" font-size="12">TF (sqrt(tex)/mm)</text>`);
  }
  svg.push('<text x="30" y="483" font-size="12">Diamonds: T1; hollow = A14 convergence not established / closeout incomplete. Sample ranges are not confidence intervals.</text>');
  ids.forEach((id, i) => svg.push(`<circle cx="38" cy="${510 + i * 22}" r="4" fill="${color(id)}"/><text x="50" y="${514 + i * 22}" font-size="12">${escapeXml(id)}</text>`));
  if (!points.length) svg.push('<text x="30" y="514" font-size="13">No eligible primary numeric points for this state.</text>');
  svg.push("</g></svg>");
  fs.writeFileSync(filename, svg.join("\n"));
}

export function runLiteratureComparison(directory) {
  const read = name => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
  const { sources, points: rawPoints } = read("literature-input.json");
  const { models } = read("model-points.json");
  const points = rawPoints.map(convertLiteraturePoint);
  assert.equal(new Set(points.map(point => `${point.datasetId}/${point.pointId}`)).size, points.length, "Duplicate literature point");
  const sourceIds = new Set(sources.map(source => source.id));
  for (const point of points) {
    assert.ok(sourceIds.has(point.sourceId) && point.pageTable && point.datasetId && point.state, "Missing point provenance");
    assert.equal(typeof point.eligibleForComparison, "boolean", "Point eligibility must be explicit");
  }
  for (const model of models) {
    for (const key of ["tf", "kc", "kw", "ratio", "nodes"]) positive(model[key], `model ${key}`);
    assert.equal(typeof model.convergenceEstablished, "boolean");
    assert.ok(model.sourceFile && model.a14Status);
  }
  const datasets = [...new Set(points.map(point => point.datasetId))];
  const comparisons = datasets.flatMap(id => models.map(model => ({ datasetId: id,
    state: points.find(point => point.datasetId === id).state,
    ...compareWithDataset(model, points.filter(point => point.datasetId === id)) })));
  for (const source of sources.filter(source => !points.some(point => point.sourceId === source.id))) {
    for (const model of models) comparisons.push({ datasetId: source.id, state: "NO_EXTRACTABLE_STATE_POINTS",
      ...compareWithDataset(model, []), reason: source.noNumericReason });
  }
  fs.writeFileSync(path.join(directory, "literature-derived.json"), JSON.stringify({
    units: { texPerNe, lengthToMm: mmPerUnit }, sources, points, models, comparisons,
    interpretation: "Descriptive primary-data range within TF +/-0.1, separately per source and relaxation protocol; no extrapolation, calibration, statistical acceptance, or B-rule change",
  }, null, 2));
  writeCsv(path.join(directory, "literature-sources.csv"), sources);
  writeCsv(path.join(directory, "literature-points.csv"), points.map(point => ({ ...point,
    step1: point.conversionChain[0], step2: point.conversionChain[1], step3: point.conversionChain[2] })));
  writeCsv(path.join(directory, "literature-comparisons.csv"), comparisons);
  for (const state of new Set(points.map(point => point.state))) {
    assert.match(state, /^[a-z_]+$/, "State must be a safe plot filename");
    writeStatePlot(path.join(directory, `literature-${state}.svg`), state,
      points.filter(point => point.state === state && point.eligibleForComparison), models);
  }
  return { sourceCount: sources.length, pointCount: points.length, comparisonCount: comparisons.length };
}

function selfCheck() {
  const base = { yarn: { value: 20, unit: "tex" }, loopLength: { value: 3, unit: "mm" },
    courseDensity: { value: 20, unit: "per_cm" }, waleDensity: { value: 12, unit: "per_cm" },
    observedTF: { value: Math.sqrt(20) / .3, lengthUnit: "cm", definition: "sqrt(tex)/l_cm" },
    metricBasis: "derived_density", eligibleForComparison: true, pointId: "example" };
  const point = convertLiteraturePoint(base);
  assert.ok(Math.abs(point.tf - point.sourceTFmm) < 1e-14);
  assert.equal(point.kc, 6); assert.ok(Math.abs(point.kw - 3.6) < 1e-14);
  const inches = convertLiteraturePoint({ ...base, loopLength: { value: 3 / 25.4, unit: "in" },
    observedTF: { value: Math.sqrt(20) / (3 / 25.4), lengthUnit: "in", definition: "sqrt(tex)/l_in" } });
  assert.ok(Math.abs(inches.tf - point.tf) < 1e-14 && Math.abs(inches.sourceTFdifference) < 1e-14);
  assert.ok(Math.abs(convertLiteraturePoint({ ...base, yarn: { value: texPerNe / 20, unit: "Ne" } }).tex - 20) < 1e-14);
  assert.equal(convertLiteraturePoint({ ...base, yarn: { value: 50, unit: "Nm" } }).tex, 20);
  assert.equal(convertLiteraturePoint({ ...base, yarn: { value: 180, unit: "den" } }).tex, 20);
  const reported = convertLiteraturePoint({ ...base, metricBasis: "reported_k", reportedK: { kc: 5.9, kw: 3.5, ratio: 1.69 } });
  assert.equal(reported.kc, 5.9); assert.equal(reported.kcFromDensity, 6); assert.equal(reported.ratio, 1.69);
  assert.throws(() => convertLiteraturePoint({ ...base, yarn: { value: 30, unit: "ambiguous count" } }), /Unsupported yarn/);
  assert.equal(compareWithDataset({ ...point, tf: point.tf + .2 }, [point]).status, "NO_DATA_AT_TF");
  assert.equal(compareWithDataset(point, [{ ...point, eligibleForComparison: false }]).nearbyCount, 0);
  assert.equal(compareWithDataset(point, [point]).status, "WITHIN_DATA_RANGE");
  assert.equal(compareWithDataset({ ...point, kc: 7 }, [point]).kc.status, "OUTSIDE_DATA_RANGE");
  console.log(JSON.stringify({ status: "PASS", texPerNe, example: point.conversionChain,
    sourceTFmm: point.sourceTFmm, difference: point.sourceTFdifference }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === "--self-check") selfCheck();
  else {
    if (!process.argv[2]) throw new Error("Pass the closeout archive directory, or --self-check");
    console.log(runLiteratureComparison(path.resolve(process.argv[2])));
  }
}
