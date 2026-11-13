// Bounded production HTTP/payload comparison, not a browser rendering benchmark.
import {writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
const [base='http://localhost:3011',output='/tmp/vikas-landing-measurement.json']=process.argv.slice(2);
const url=new URL(base);
if(!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Use a local production server.');
const samples=[];let html='';
for(let i=0;i<6;i++){
 const start=performance.now();const response=await fetch(url,{signal:AbortSignal.timeout(10000)});const headers=performance.now();
 if(!response.ok)throw new Error(`Landing returned ${response.status}`);
 html=await response.text();samples.push({headersMs:+(headers-start).toFixed(2),completeMs:+(performance.now()-start).toFixed(2)});
}
const paths=[...new Set([...html.matchAll(/(?:src|href)="([^" ]+\.(?:js|css)(?:\?[^" ]*)?)"/g)].map(m=>m[1]))].filter(path=>path.startsWith('/_next/'));
const assets=await Promise.all(paths.map(async path=>{const r=await fetch(new URL(path,url),{signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error(`Asset returned ${r.status}`);const bytes=Buffer.from(await r.arrayBuffer());return {kind:path.includes('.css')?'css':'js',decodedBytes:bytes.length,gzipBytes:gzipSync(bytes).length};}));
const summarize=kind=>assets.filter(a=>a.kind===kind).reduce((v,a)=>({files:v.files+1,decodedBytes:v.decodedBytes+a.decodedBytes,gzipBytes:v.gzipBytes+a.gzipBytes}),{files:0,decodedBytes:0,gzipBytes:0});
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
const data={samples,medianWarmHeadersMs:median(samples.slice(1).map(s=>s.headersMs)),medianWarmCompleteMs:median(samples.slice(1).map(s=>s.completeMs)),htmlDecodedBytes:Buffer.byteLength(html),htmlGzipBytes:gzipSync(html).length,scripts:summarize('js'),styles:summarize('css'),headlineInInitialHTML:html.includes('Your goal.'),limitations:'Local production HTTP and initial linked asset sizes only. gzip sizes computed from decoded responses; no browser LCP/CLS/FPS or CPU claim.'};
await writeFile(output,JSON.stringify(data,null,2));console.log(JSON.stringify(data,null,2));
