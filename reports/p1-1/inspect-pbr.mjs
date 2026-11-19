import fs from 'node:fs/promises';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ appType:'custom',logLevel:'silent',server:{middlewareMode:true} });
try {
  const { identifyPbrMap } = await server.ssrLoadModule('/src/yarnTexture/yarnScanTexture.js');
  const inventory = [];
  for (const name of await fs.readdir('PBR/Yarn1')) {
    const b = await fs.readFile('PBR/Yarn1/'+name), chunks = [], types = [];
    for (let pos=8; pos<b.length;) {
      const length=b.readUInt32BE(pos), type=b.toString('ascii',pos+4,pos+8);
      types.push(type); if(type==='IDAT') chunks.push(b.subarray(pos+8,pos+8+length));
      pos+=length+12;
    }
    const width=b.readUInt32BE(16), height=b.readUInt32BE(20), depth=b[24], colorType=b[25];
    assert.equal(width,2172); assert.equal(height,724); assert.equal(depth,8); assert.equal(colorType,6); assert.equal(b[28],0);
    const raw=zlib.inflateSync(Buffer.concat(chunks)), stride=width*4, pixels=Buffer.alloc(stride*height);
    const paeth=(a,c,d)=>{ const p=a+c-d, pa=Math.abs(p-a),pc=Math.abs(p-c),pd=Math.abs(p-d); return pa<=pc&&pa<=pd?a:pc<=pd?c:d; };
    for(let y=0;y<height;y++) {
      const filter=raw[y*(stride+1)];
      for(let x=0;x<stride;x++) {
        const i=y*stride+x,a=x>=4?pixels[i-4]:0,c=y?pixels[i-stride]:0,d=y&&x>=4?pixels[i-stride-4]:0;
        pixels[i]=(raw[y*(stride+1)+1+x]+[0,a,c,Math.floor((a+c)/2),paeth(a,c,d)][filter])&255;
      }
    }
    let alphaMin=255,alphaMax=0,transparent=0,opaque=0,weightedRed=0,alphaWeight=0,maxRed=0;
    for(let i=0;i<pixels.length;i+=4){ const a=pixels[i+3]; alphaMin=Math.min(alphaMin,a);alphaMax=Math.max(alphaMax,a);
      transparent+=a===0;opaque+=a===255;weightedRed+=pixels[i]*a;alphaWeight+=a;if(a)maxRed=Math.max(maxRed,pixels[i]); }
    inventory.push({fileName:name,slot:identifyPbrMap(name),bytes:b.length,width,height,depth,colorType,alphaMin,alphaMax,
      transparentPixels:transparent,opaquePixels:opaque,alphaWeightedMeanRed:weightedRed/alphaWeight,maxRedWhereAlphaPositive:maxRed,
      embeddedPhysicalResolution:types.includes('pHYs'),sha256:crypto.createHash('sha256').update(b).digest('hex')});
  }
  const output={scannerDpi:2400,dpiProvenance:'User supplied; no embedded pHYs in these PNGs',physicalRepeatLengthMm:2172/2400*25.4,inventory};
  await fs.writeFile('reports/p1-1/pbr-source-inventory.json',JSON.stringify(output,null,2));
  console.log(JSON.stringify(output,null,2));
} finally {await server.close();}
