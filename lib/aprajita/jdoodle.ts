import {createHash} from 'node:crypto';
import type {Db} from 'mongodb';
import {runSchema,type RunResult} from './contract';
import {LabError} from './service';
export const JDOODLE_FREE_DAILY_LIMIT=20;
export const JDOODLE_LIMITS={requestMs:12000,responseBytes:65536,outputBytes:16384};
export interface JDoodleConfig {clientId?:string;clientSecret?:string;dailyLimit?:string}
export const JDOODLE_LANGUAGES={c:{language:'c',versionIndex:'7'},python:{language:'python3',versionIndex:'6'},java:{language:'java',versionIndex:'6'}} as const;
export function jdoodleConfigured(config:JDoodleConfig){return !!config.clientId?.trim()&&!!config.clientSecret?.trim()&&dailyLimit(config)>0;}
export function dailyLimit(config:JDoodleConfig){if(config.dailyLimit===undefined||config.dailyLimit==='')return JDOODLE_FREE_DAILY_LIMIT;const value=Number(config.dailyLimit);return Number.isInteger(value)&&value>0&&value<=JDOODLE_FREE_DAILY_LIMIT?value:0;}
// Provider credits reset at 23:55 UTC, not midnight in the student's timezone.
export function quotaPeriod(now:Date){return new Date(now.getTime()+5*60*1000).toISOString().slice(0,10);}
function quotaId(config:JDoodleConfig,now:Date){const account=createHash('sha256').update(config.clientId!.trim()).digest('hex');return `jdoodle:${account}:${quotaPeriod(now)}`;}
export async function reserveJDoodleCredit(db:Db,config:JDoodleConfig,now=new Date()){
 const id=quotaId(config,now),limit=dailyLimit(config);if(!limit)throw new LabError(503,'JDoodle daily allowance must be between 1 and 20.');
 const counters=db.collection<{_id:string;count:number}>('aprajita_execution_quota');
 // Atomic increment on a unique _id: concurrent users/instances cannot each claim the final credit.
 const result=await counters.findOneAndUpdate({_id:id},{$inc:{count:1}},{upsert:true,returnDocument:'after'});
 if(!result||result.count>limit)throw new LabError(429,'The shared JDoodle daily execution allowance is exhausted. It resets at 23:55 UTC. Browser Python, editing and saving remain available.');
 return id;
}
async function providerJSON(path:'execute'|'credit-spent',payload:unknown,signal:AbortSignal,fetcher:typeof fetch){
 const response=await fetcher(`https://api.jdoodle.com/v1/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),redirect:'error',cache:'no-store',signal});
 if(!response.ok){void response.body?.cancel().catch(()=>{});if(response.status===429)throw new LabError(429,'JDoodle daily credits are exhausted. Try after 23:55 UTC; browser Python and saving remain available.');if(response.status===401||response.status===403)throw new LabError(503,`JDoodle rejected authentication (HTTP ${response.status}). Verify JDOODLE_CLIENT_ID/JDOODLE_CLIENT_SECRET and Free Compiler API access in the deployed environment.`,'JDOODLE_AUTH_REJECTED');throw new LabError(503,`JDoodle returned HTTP ${response.status}. Your work remains in the editor.`,'JDOODLE_UPSTREAM_HTTP_ERROR');}
 const reader=response.body?.getReader();if(!reader)throw new LabError(502,'JDoodle returned no result.');let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>JDOODLE_LIMITS.responseBytes){void reader.cancel().catch(()=>{});throw new LabError(502,'JDoodle returned too much output. Reduce printed output.');}chunks.push(part.value);}}finally{reader.releaseLock();}
 let data:unknown;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new LabError(502,'JDoodle returned an invalid result.');}
 if(!data||typeof data!=='object'||Array.isArray(data))throw new LabError(502,'JDoodle returned an invalid result.');return data as Record<string,unknown>;
}
export async function executeJDoodle(db:Db,value:unknown,config:JDoodleConfig,fetcher:typeof fetch=fetch,now=new Date()):Promise<RunResult>{
 const input=runSchema.parse(value);if(!jdoodleConfigured(config))throw new LabError(503,'JDoodle execution is not configured. Editing and saving remain available.');
 const id=await reserveJDoodleCredit(db,config,now);
 const credentials={clientId:config.clientId!.trim(),clientSecret:config.clientSecret!.trim()};
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 const timeout=new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>{reject(new LabError(504,'JDoodle timed out. The reserved credit is kept because the program may have executed.'));controller.abort();},JDOODLE_LIMITS.requestMs);});
 const work=async()=>{
  // This endpoint is free and catches usage outside VIKAS under the same provider account.
  const usage=await providerJSON('credit-spent',credentials,controller.signal,fetcher);
  if(usage.statusCode===429)throw new LabError(429,'JDoodle daily credits are exhausted. Try after 23:55 UTC.');
  if(typeof usage.used!=='number'||!Number.isInteger(usage.used)||usage.used<0)throw new LabError(502,'JDoodle credit usage could not be verified. No program was submitted.');
  if(usage.used>=dailyLimit(config))throw new LabError(429,'JDoodle daily credits are exhausted. Try after 23:55 UTC; browser Python and saving remain available.');
  const data=await providerJSON('execute',{...credentials,script:input.source,stdin:input.stdin,...JDOODLE_LANGUAGES[input.language]},controller.signal,fetcher);
  if(data.statusCode===429)throw new LabError(429,'JDoodle daily credits are exhausted. Try after 23:55 UTC.');
  if(data.statusCode!==200||data.error!=null)throw new LabError(503,'JDoodle rejected the execution response. Check API account access and supported language/version configuration.','JDOODLE_EXECUTION_REJECTED');
  if(typeof data.output!=='string')throw new LabError(502,'JDoodle returned no program output.');
  const bytes=Buffer.from(data.output),truncated=bytes.length>JDOODLE_LIMITS.outputBytes;
  const output=new TextDecoder().decode(bytes.subarray(0,JDOODLE_LIMITS.outputBytes),{stream:truncated});
  // REST statusCode is a request status. Its documented output mixes compiler/runtime messages.
  // Do not infer program success from HTTP 200 or invent separate stdout/stderr.
  return {status:'JDoodle result received — review output for errors',statusId:0,success:false,stdout:output,stderr:'',compilationErrors:'',output,error:'',truncated,diagnosticsCombined:true};
 };
 try{return await Promise.race([work(),timeout]);}catch(error){if(error instanceof LabError){if(error.status===429)await db.collection<{_id:string;count:number}>('aprajita_execution_quota').updateOne({_id:id},{$max:{count:dailyLimit(config)}});throw error;}throw new LabError(503,'The server could not reach JDoodle. Check provider availability and outbound HTTPS access. Your work remains in the editor.','JDOODLE_NETWORK_ERROR');}finally{if(timer)clearTimeout(timer);controller.abort();}
}
