import {createServer} from 'vite';
const server=await createServer({configFile:false,server:{host:'127.0.0.1',port:5198,strictPort:true},logLevel:'error'});
await server.listen();
console.log('Audit replay: http://127.0.0.1:5198/reports/real-sop-geometry-gap-audit-2026-10-16/browser-replay.html');
