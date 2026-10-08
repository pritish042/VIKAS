import {runSchema,type RunResult} from './contract';
import {LabError} from './service';
export const EXECUTION_LIMITS={cpuSeconds:2,wallSeconds:5,memoryKB:256000,fileKB:16,outputBytes:16384,responseBytes:65536,requestMs:12000};
export interface RunnerConfig {url?:string;token?:string}
export function runnerConfigured(config:RunnerConfig){
 try{const u=new URL(config.url||'');return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&!!config.token?.trim();}catch{return false;}
}
export async function executeCode(value:unknown,config:RunnerConfig,fetcher:typeof fetch=fetch):Promise<RunResult>{
 const input=runSchema.parse(value);
 if(!runnerConfigured(config))throw new LabError(503,'C, Python and Java execution is not configured. Editing and saving remain available.');
 const ids={c:50,python:71,java:62};
 const url=new URL(config.url!.replace(/\/$/,'')+'/submissions');url.searchParams.set('base64_encoded','true');url.searchParams.set('wait','true');
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 const timeout=new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new LabError(504,'The isolated execution service timed out.'));},EXECUTION_LIMITS.requestMs);});
 const work=async()=>{
  const response=await fetcher(url,{method:'POST',redirect:'error',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json','X-Auth-Token':config.token!},body:JSON.stringify({
   source_code:Buffer.from(input.source).toString('base64'),stdin:Buffer.from(input.stdin).toString('base64'),language_id:ids[input.language],
   cpu_time_limit:EXECUTION_LIMITS.cpuSeconds,cpu_extra_time:0.5,wall_time_limit:EXECUTION_LIMITS.wallSeconds,memory_limit:EXECUTION_LIMITS.memoryKB,max_file_size:EXECUTION_LIMITS.fileKB,max_processes_and_or_threads:64,enable_network:false,number_of_runs:1,
  })});
  if(!response.ok){await response.body?.cancel();throw new LabError(503,'The execution service is unavailable or needs configuration. Your code remains in the editor.');}
  const reader=response.body?.getReader();if(!reader)throw new LabError(503,'The execution service returned no result.');
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>EXECUTION_LIMITS.responseBytes){await reader.cancel();throw new LabError(502,'Execution output exceeded the response limit. Reduce printed output.');}chunks.push(part.value);}}finally{reader.releaseLock();}
  let data:Record<string,unknown>;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new LabError(502,'The execution service returned an invalid result.');}
  const status=data.status as {id?:unknown;description?:unknown}|undefined;
  if(!status||typeof status.id!=='number'||status.id<3||status.id>14)throw new LabError(503,'Execution did not finish. The isolated service must support synchronous results.');
  let remaining=EXECUTION_LIMITS.outputBytes,truncated=false;
  const decode=(value:unknown)=>{if(value==null)return '';if(typeof value!=='string'||!/^[A-Za-z0-9+/=\r\n]*$/.test(value))throw new LabError(502,'The execution service returned invalid output.');const bytes=Buffer.from(value,'base64');if(bytes.length>remaining)truncated=true;const result=bytes.subarray(0,remaining).toString('utf8');remaining=Math.max(0,remaining-bytes.length);return result;};
  const output=decode(data.stdout),error=[decode(data.compile_output),decode(data.stderr)].filter(Boolean).join('\n');
  const statuses:Record<number,string>={3:'Finished',4:'Wrong answer',5:'Time limit exceeded',6:'Compilation error',7:'Runtime error',8:'Runtime error',9:'Runtime error',10:'Runtime error',11:'Runtime error',12:'Runtime error',13:'Execution service error',14:'Execution error'};
  return {status:statuses[status.id],output,error,truncated};
 };
 try{return await Promise.race([work(),timeout]);}catch(error){if(error instanceof LabError)throw error;throw new LabError(503,'The isolated execution service could not be reached. Your code remains in the editor.');}finally{if(timer)clearTimeout(timer);controller.abort();}
}
