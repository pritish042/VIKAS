// Executable JavaScript is authored here, never interpolated from student code.
export const PYODIDE_VERSION='314.0.7';
export const PYODIDE_BASE=`https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
export const PYTHON_LIMITS={loadMs:45000,runMs:10000,outputBytes:16384} as const;
export const PYTHON_FRAME_CSP=`default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval' blob: ${PYODIDE_BASE}; worker-src blob:; connect-src ${PYODIDE_BASE}; frame-src 'none'; form-action 'none'; base-uri 'none'`;
const workerSource=`
const send = self.postMessage.bind(self);
const limit = ${PYTHON_LIMITS.outputBytes};
let used = 0;
const encode = new TextEncoder();
const output = (kind, buffer) => {
 const remaining = Math.max(0, limit - used);
 const text = new TextDecoder().decode(buffer.subarray(0, remaining), {stream: buffer.length > remaining});
 used += buffer.length;
 if(text) send({type: kind, text});
 if(used > limit) {send({type:'limit'}); throw new Error('Output limit reached');}
 return buffer.length;
};
self.onmessage = async ({data}) => {
 try {
  const {loadPyodide} = await import(${JSON.stringify(PYODIDE_BASE+'pyodide.mjs')});
  const pyodide = await loadPyodide({indexURL:${JSON.stringify(PYODIDE_BASE)}});
  // Defense in depth. The opaque origin and CSP are the actual storage/network boundary.
  for(const name of ['fetch','XMLHttpRequest','WebSocket','EventSource','Worker','SharedWorker','importScripts']) {
   try {Object.defineProperty(self,name,{value:()=>{throw new Error('Network access and nested workers are disabled in APRAJITA');},writable:false,configurable:false});} catch {}
  }
  pyodide.setStdout({write:buffer=>output('stdout',buffer)});
  pyodide.setStderr({write:buffer=>output('stderr',buffer)});
  let input = encode.encode(data.stdin);
  pyodide.setStdin({stdin:()=>{const value=input;input=null;return value;},isatty:false});
  send({type:'running'});
  try {const value = pyodide.runPython(data.source); value?.destroy?.();send({type:'done',success:true});}
  catch(error) {const bytes=encode.encode(String(error?.message||error));output('stderr',bytes);send({type:'done',success:false});}
 } catch(error) {send({type:'unavailable',text:'Python could not be loaded. Check your connection or try again. No successful output was produced.'});}
};`;
const frameScript=`
let port, worker, workerUrl, running=false, connected=false;
const finish = (message) => {worker?.terminate();worker=null;if(workerUrl)URL.revokeObjectURL(workerUrl);port?.postMessage(message);};
addEventListener('message',event=>{
 if(connected||event.source!==parent||event.data?.type!=='aprajita-connect'||!event.ports[0])return;
 connected=true;port=event.ports[0];
 port.onmessage=({data})=>{
  if(data.type==='stop'){finish({type:'stopped'});return;}
  if(data.type!=='run'||worker)return;
  const blob=new Blob([${JSON.stringify(workerSource)}],{type:'text/javascript'});
  const url=URL.createObjectURL(blob);workerUrl=url;
  worker=new Worker(url);
  worker.onmessage=({data:message})=>{
   if(message.type==='running'){if(running)return;running=true;}
   if(['done','limit','unavailable'].includes(message.type)){finish(message);return;}
   if(['running','stdout','stderr'].includes(message.type))port.postMessage(message);
  };
  worker.onerror=()=>{finish({type:'unavailable',text:'The Python worker failed. Try again with a smaller program.'});};
  worker.postMessage({source:data.source,stdin:data.stdin});
 };
 port.start();port.postMessage({type:'connected'});
});`;
export const PYTHON_FRAME_HTML=`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${PYTHON_FRAME_CSP}"><meta name="referrer" content="no-referrer"></head><body><script>${frameScript.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
