import fs from "node:fs";
import { edgeEndpoints } from "../../src/fabricForm/periodicCell.js";

/** Vector plots retain millimetre axes and equal physical scale in each view. */
export function writeFabricFormPlots(result, filename) {
  const { cell }=result, panels=[[0,1,"Top: x / y"],[0,2,"Side: x / z"],[1,2,"End: y / z"]];
  const width=1200,height=470,segments=[];
  for(let q=-1;q<=1;q++) for(let p=-1;p<=1;p++) for(const edge of cell.topology.edges) {
    segments.push({points:edgeEndpoints(cell,edge,p,q),primary:p===0&&q===0});
  }
  const svg=[`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><g font-family="Arial,sans-serif" fill="#172b36">`,
    `<text x="30" y="26" font-size="18">Plain jersey model — l=${cell.topology.loopLengthMm} mm, ${cell.topology.m} × ${cell.topology.n}, N=${cell.topology.nodesPerLoop} — ${result.status}</text>`];
  panels.forEach(([ax,ay,label],index)=>{
    const all=segments.flatMap(s=>s.points),x=all.map(p=>p[ax]),y=all.map(p=>p[ay]);
    const minX=Math.min(...x),maxX=Math.max(...x),minY=Math.min(...y),maxY=Math.max(...y);
    const scale=Math.min(320/(maxX-minX||1),310/(maxY-minY||1));
    const left=55+index*395,bottom=385,cx=(maxX+minX)/2,cy=(maxY+minY)/2;
    const px=v=>left+160+(v-cx)*scale,py=v=>bottom-155-(v-cy)*scale;
    svg.push(`<text x="${left}" y="56" font-size="16">${label} (mm)</text>`);
    const extent=Math.max(maxX-minX,maxY-minY),raw=extent/5;
    const power=10**Math.floor(Math.log10(raw)),step=[1,2,5,10].map(v=>v*power).find(v=>v>=raw);
    for(let v=Math.ceil(minX/step)*step;v<=maxX+step*1e-8;v+=step) {
      svg.push(`<path d="M${px(v)},70 V${bottom}" stroke="#e6ebee"/><text x="${px(v)}" y="${bottom+21}" text-anchor="middle" font-size="11">${Number(v.toPrecision(4))}</text>`);
    }
    for(let v=Math.ceil(minY/step)*step;v<=maxY+step*1e-8;v+=step) {
      svg.push(`<path d="M${left},${py(v)} H${left+320}" stroke="#e6ebee"/><text x="${left-7}" y="${py(v)+4}" text-anchor="end" font-size="11">${Number(v.toPrecision(4))}</text>`);
    }
    for(const primary of [false,true]) for(const segment of segments.filter(s=>s.primary===primary)) {
      const [a,b]=segment.points;
      svg.push(`<path d="M${px(a[ax])},${py(a[ay])} L${px(b[ax])},${py(b[ay])}" fill="none" stroke="${primary?'#146d8e':'#bacbd4'}" stroke-width="${primary?2.1:1}"/>`);
    }
  });
  svg.push(`<text x="30" y="450" font-size="13">Dark: primary cell; pale: periodic images. Centre lines only. W=${cell.W.toFixed(6)} mm, H=${cell.H.toFixed(6)} mm, S=${cell.S.toExponential(3)} mm.</text></g></svg>`);
  fs.writeFileSync(filename,svg.join("\n"));
}
