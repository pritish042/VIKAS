import {runSchema,type RunResult} from './contract';
import {LabError} from './service';
export const EXECUTION_LIMITS={cpuSeconds:2,wallSeconds:5,memoryKB:256000,fileKB:16,outputBytes:16384,responseBytes:65536,requestMs:12000,pollMs:400};
export const RUNNER_LANGUAGES={c:50,python:71,java:62} as const;
export interface RunnerConfig {url?:string;token?:string}
export function runnerConfigured(config:RunnerConfig){
 try{const u=new URL(config.url||'');return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&!!config.token?.trim();}catch{return false;}
}
const statuses:Record<number,string>={3:'Finished',4:'Wrong answer',5:'Time limit exceeded',6:'Compilation error',7:'Runtime error',8:'Runtime error',9:'Runtime error',10:'Runtime error',11:'Runtime error',12:'Runtime error',13:'Execution service error',14:'Execution error'};
function object(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
async function readResult(response:Response){
 if(!response.ok){void response.body?.cancel().catch(()=>{});const message=response.status===401||response.status===403?'The execution service credentials need configuration.':response.status===429?'The execution service is busy. Please try again shortly.':'The execution service is unavailable or rejected the run. Please try again or contact the platform team.';throw new LabError(503,message);}
 const reader=response.body?.getReader();if(!reader)throw new LabError(502,'The execution service returned no result.');
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>EXECUTION_LIMITS.responseBytes){void reader.cancel().catch(()=>{});throw new LabError(502,'Execution output exceeded the response limit. Reduce printed output.');}chunks.push(part.value);}}finally{reader.releaseLock();}
 let data:unknown;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new LabError(502,'The execution service returned an invalid result.');}
 if(!object(data))throw new LabError(502,'The execution service returned an invalid result.');return data;
}
function decodeResult(data:Record<string,unknown>,id:number):RunResult{
 let remaining=EXECUTION_LIMITS.outputBytes,truncated=false;
 const decode=(value:unknown)=>{if(value==null)return '';if(typeof value!=='string')throw new LabError(502,'The execution service returned invalid output.');const encoded=value.replace(/[\r\n]/g,'');if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))throw new LabError(502,'The execution service returned invalid output.');const bytes=Buffer.from(Buffer.from(encoded,'base64').toString('utf8'));if(bytes.length>remaining)truncated=true;const result=new TextDecoder().decode(bytes.subarray(0,remaining),{stream:bytes.length>remaining});remaining=Math.max(0,remaining-bytes.length);return result;};
 const stdout=decode(data.stdout),compilationErrors=decode(data.compile_output),stderr=decode(data.stderr);
 // Existing output/error fields are preserved for clients of the initial API.
 return {status:statuses[id],statusId:id,success:id===3,stdout,stderr,compilationErrors,output:stdout,error:[compilationErrors,stderr].filter(Boolean).join('\n'),truncated};
}
function pause(signal:AbortSignal){return new Promise<void>((resolve,reject)=>{if(signal.aborted){reject(new LabError(504,'The isolated execution service timed out.'));return;}const done=()=>{signal.removeEventListener('abort',abort);resolve();};const timer=setTimeout(done,EXECUTION_LIMITS.pollMs);const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(new LabError(504,'The isolated execution service timed out.'));};signal.addEventListener('abort',abort,{once:true});});}
export async function executeCode(value:unknown,config:RunnerConfig,fetcher:typeof fetch=fetch):Promise<RunResult>{
 const input=runSchema.parse(value);
 if(!runnerConfigured(config))throw new LabError(503,'C, Python and Java execution is not configured. Editing and saving remain available.');
 const base=config.url!.replace(/\/$/,'')+'/submissions';
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 const timeout=new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>{reject(new LabError(504,'The isolated execution service timed out. The submitted program may still finish on the runner; no successful output was received.'));controller.abort();},EXECUTION_LIMITS.requestMs);});
 const common={redirect:'error',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json','X-Auth-Token':config.token!.trim()}} as const;
 const work=async()=>{
  let data=await readResult(await fetcher(base+'?base64_encoded=true&wait=false',{...common,method:'POST',body:JSON.stringify({
   source_code:Buffer.from(input.source).toString('base64'),stdin:Buffer.from(input.stdin).toString('base64'),language_id:RUNNER_LANGUAGES[input.language],
   cpu_time_limit:EXECUTION_LIMITS.cpuSeconds,cpu_extra_time:0.5,wall_time_limit:EXECUTION_LIMITS.wallSeconds,memory_limit:EXECUTION_LIMITS.memoryKB,max_file_size:EXECUTION_LIMITS.fileKB,max_processes_and_or_threads:64,enable_network:false,number_of_runs:1,redirect_stderr_to_stdout:false,enable_per_process_and_thread_time_limit:false,enable_per_process_and_thread_memory_limit:false,
  })}));
  // Standard Judge0 create returns a token; some compatible services return a terminal result.
  const token=data.token;
  if(token!==undefined&&(typeof token!=='string'||!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(token)))throw new LabError(502,'The execution service returned an invalid submission token.');
  while(true){
   const id=object(data.status)?data.status.id:undefined;
   if(typeof id==='number'&&Number.isInteger(id)&&statuses[id])return decodeResult(data,id);
   if(id!==undefined&&id!==1&&id!==2)throw new LabError(502,'The execution service returned an invalid status.');
   if(typeof token!=='string')throw new LabError(502,'The execution service returned no submission token.');
   await pause(controller.signal);
   data=await readResult(await fetcher(`${base}/${token}?base64_encoded=true&fields=status,stdout,stderr,compile_output`,{...common,method:'GET'}));
  }
 };
 try{return await Promise.race([work(),timeout]);}catch(error){if(error instanceof LabError)throw error;throw new LabError(503,'The isolated execution service could not be reached. Your code remains in the editor.');}finally{if(timer)clearTimeout(timer);controller.abort();}
}
