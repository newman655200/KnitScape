// Execute actual boundary functions with merged-state/browser stubs. Not a full UI integration test.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=f=>fs.readFileSync(f,'utf8');
function evaluate(file,deps,names){const code=read(file).replace(/^import\b[\s\S]*?;\r?\n/gm,'').replace(/\bexport\s+(?=(?:async\s+)?function|class|const|let)/g,'');
  return new Function(...Object.keys(deps),code+'\nreturn {'+names.join(',')+'};')(...Object.values(deps));}
const {Bimp}=evaluate('src/lib/Bimp.js',{},['Bimp']);
const sequence=evaluate('src/actions/yarnSequenceRows.js',{Bimp},['normalizeYarnSequence','resizeYarnSequenceToChartHeight']);
const state={activeYarn:2,yarnPalette:['red','green','blue'],singleJerseyCamProgram:null,yarnLibrary:[],patternLibrary:{},needleArrangement:[],machineGauge:32};
const defaults=[{name:'main',color:'gray',diameter:.24,enabled:true,lengthScaleY:1,texture:null}];
const deps={Bimp,GLOBAL_STATE:state,dispatch:a=>Object.assign(state,a),fitChart:()=>{},DEFAULT_YARN_COLOR:'gray',DEFAULT_YARN_PLIES:defaults,DEFAULT_STITCH_SYMBOL_INDEX:0,
  normalizeYarnPly:(p,f)=>({...f,...p}),normalizeYarnSequence:sequence.normalizeYarnSequence};
const api=evaluate('src/actions/importers.js',deps,['newPattern','loadJSON','loadLibraryPattern']);
const fixture=(width,height)=>({width,height,repeats:[{bitmap:{width:1,height:1,pixels:[0]},pos:[0,0],area:[width,height]}],yarnPalette:['gray'],yarnSequence:{width:1,height,pixels:Array(height).fill(0)},yarnPlies:defaults});
api.newPattern();
const filled=sequence.resizeYarnSequenceToChartHeight(state.yarnSequence,41,state.activeYarn).pixel(0,40);
const brush=state.yarnSequence.brush({x:0,y:0},state.activeYarn).pixel(0,0);
api.loadJSON(fixture(2,2));
assert.equal(state.activeYarn,2);assert.equal(state.yarnPalette.length,1);assert.equal(filled,2);assert.equal(brush,2);
console.log(JSON.stringify({case:'stale activeYarn after New and Load',activeYarn:state.activeYarn,paletteLength:state.yarnPalette.length,newRowIndex:filled,brushIndex:brush,paletteEntryMissing:state.yarnPalette[filled]===undefined}));
let resolveOld;state.patternLibrary.slow=()=>new Promise(resolve=>{resolveOld=resolve;});
api.loadLibraryPattern('slow');api.newPattern();const afterNew=[state.chart.width,state.chart.height];
resolveOld(fixture(2,2));await Promise.resolve();await Promise.resolve();
assert.deepEqual(afterNew,[30,40]);assert.equal(state.chart.width,2);
console.log(JSON.stringify({case:'older library request overwrites newer New',afterNew,afterOldRequest:[state.chart.width,state.chart.height],boundary:'Actual importers source; Bimp and sequence helpers real; dispatch, fitChart, ply normalizer/browser boundaries stubbed.'}));
