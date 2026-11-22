import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** B is a provisional empirical comparison, separate from numerical acceptance. */
export function checkPlainJerseyCases(results) {
  if(results.length!==4) throw new Error("B requires exactly l=2.6,3,3.5,4 mm");
  const lengths=[2.6,3,3.5,4],parameters=JSON.stringify(results[0].params);
  results.forEach((r,i)=>{
    if(r.cell.topology.loopLengthMm!==lengths[i] || JSON.stringify(r.params)!==parameters) {
      throw new Error("B cases must use the specified lengths and one frozen material parameter set");
    }
  });
  const rows=results.map(r=>({lengthMm:r.cell.topology.loopLengthMm,status:r.status,
    waleDensityPerCm:r.metrics.waleDensityPerCm,courseDensityPerCm:r.metrics.courseDensityPerCm,
    kw:r.metrics.kw,kc:r.metrics.kc,ratio:r.metrics.kcOverKw,
    kwPass:r.metrics.kw>=3.4&&r.metrics.kw<=4.3,
    kcPass:r.metrics.kc>=4.4&&r.metrics.kc<=5.8,
    ratioPass:r.metrics.kcOverKw>=1.15&&r.metrics.kcOverKw<=1.5}));
  const spread=key=>{const values=rows.map(r=>r[key]);return (Math.max(...values)-Math.min(...values))/(values.reduce((a,b)=>a+b,0)/4);};
  const kwSpread=spread("kw"),kcSpread=spread("kc");
  const trend=rows.slice(1).every((r,i)=>r.waleDensityPerCm<rows[i].waleDensityPerCm&&r.courseDensityPerCm<rows[i].courseDensityPerCm);
  const passed=rows.every(r=>r.status==="CONVERGED"&&r.kwPass&&r.kcPass&&r.ratioPass)&&kwSpread<=.15&&kcSpread<=.15&&trend;
  return {status:passed?"PASS":"FAIL",rows,kwSpread,kcSpread,trend,
    interpretation:"Provisional T1 B intervals; literature specimen/relaxation state not independently established; not physical calibration or validation"};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const directory=process.argv[2]??"C:/Users/liuchen/Documents/KnitScape/archives/fabric-form-step1-2026-11-22";
  const results=[2.6,3,3.5,4].map(l=>JSON.parse(fs.readFileSync(path.join(directory,`case-${l}.json`),"utf8")));
  const checked=checkPlainJerseyCases(results);
  fs.writeFileSync(path.join(directory,"b-comparison.json"),JSON.stringify(checked,null,2));
  console.log(JSON.stringify(checked,null,2));
  if(checked.status!=="PASS") process.exitCode=1;
}
