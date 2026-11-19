// Actual renderer method with a fake GL observation surface; not a GPU/browser test.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const dependency=new vm.SyntheticModule(['getReadyYarnTextureImage','getYarnPbrMapSource','getYarnTextureSourceKey'],function(){
  this.setExport('getReadyYarnTextureImage',()=>null);
  this.setExport('getYarnPbrMapSource',map=>map?.assetRef||map?.processedDataUrl||map?.dataUrl||null);
  this.setExport('getYarnTextureSourceKey',s=>String(s));
});
const module=new vm.SourceTextModule(fs.readFileSync('src/simulation/yarnUvWebglRenderer.js','utf8'));
await module.link(()=>dependency);await module.evaluate();
const observed=[];
const gl=new Proxy({canvas:{width:100,height:100},uniform1f:(key,value)=>observed.push({key,value})},
  {get:(o,k)=>k in o?o[k]:()=>({})});
const receiver={gl,locations:{textureStrength:'textureStrength',fuzzStrength:'fuzzStrength'},
  bindArrayBuffer:()=>({}),textureFromDataUrl:()=>null,bindTexture:()=>{}};
module.namespace.YarnUvWebglRenderer.prototype.drawStrip.call(receiver,
  {indices:new Uint16Array([0,1,2]),positions:new Float32Array(6),uvs:new Float32Array(6)},
  {color:'rgba(255,0,0,1)',texture:{enabled:true,textureStrength:0}});
assert.equal(observed.find(x=>x.key==='textureStrength').value,.75);
console.log(JSON.stringify({case:'valid zero strength',input:0,observedUniform:observed.find(x=>x.key==='textureStrength').value,
  boundary:'Actual drawStrip JavaScript method; map loader and GL side effects stubbed; no GPU output claim.'}));
const state={yarnLibrary:[{id:'a',pbr:{physicalRepeatLengthMm:22.987,baseColor:{assetRef:'old'}}}]};
const source=fs.readFileSync('src/actions/yarnLibrary.js','utf8').replace(/^import\b[\s\S]*?;\r?\n/gm,'').replace(/\bexport\s+(?=(?:async\s+)?function|const)/g,'');
const action=new Function('GLOBAL_STATE','dispatch','importPbrFiles','getYarnPbrAssetRefs','yarnAssetRegistry',
  source+'\nreturn importYarnPbr;')(state,a=>Object.assign(state,a),async()=>({normal:{assetRef:'new-normal'}}),()=>[],{release:()=>{}});
await action('a',[]);assert.equal(state.yarnLibrary[0].pbr.physicalRepeatLengthMm,undefined);
console.log(JSON.stringify({case:'PBR group replacement',previousRepeatMm:22.987,repeatPropertyRetained:Object.hasOwn(state.yarnLibrary[0].pbr,'physicalRepeatLengthMm'),
  boundary:'Actual importYarnPbr action; new maps supplied as importer fixture. Actual importPbrFiles return shape separately checked in source; no image decoder/GPU claim.'}));
