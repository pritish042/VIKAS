import test from 'node:test';
import assert from 'node:assert/strict';
import type {Db} from 'mongodb';
import {executeJDoodle,reserveJDoodleCredit,quotaPeriod,dailyLimit,JDOODLE_LIMITS,JDOODLE_LANGUAGES} from '../lib/aprajita/jdoodle';
import {executionProvider} from '../lib/aprajita/provider-config';
// Atomic quota double; no real account, credential or production database is used.
function quotaDb(){const counts=new Map<string,number>();return {counts,db:{collection(){return {async findOneAndUpdate(query:{_id:string}){const count=(counts.get(query._id)||0)+1;counts.set(query._id,count);return {_id:query._id,count};},async updateOne(query:{_id:string},update:{$max:{count:number}}){counts.set(query._id,Math.max(counts.get(query._id)||0,update.$max.count));}};}} as unknown as Db};}
const config={clientId:'test-client-id',clientSecret:'test-server-secret'};
const fake=(fn:(url:string,init:RequestInit)=>Response|Promise<Response>)=>((url,init)=>fn(String(url),init!)) as typeof fetch;
test('JDoodle sends actual code, stdin and pinned language versions only to the official API',async()=>{
 for(const language of ['c','python','java'] as const){let executions=0;const {db}=quotaDb();const answer=await executeJDoodle(db,{language,source:'code',stdin:'42\n'},config,fake((url,init)=>{
 const data=JSON.parse(init.body as string);assert.equal(data.clientId,config.clientId);assert.equal(data.clientSecret,config.clientSecret);assert.equal(init.redirect,'error');
 if(url==='https://api.jdoodle.com/v1/credit-spent')return Response.json({used:0});
 assert.equal(url,'https://api.jdoodle.com/v1/execute');assert.equal(data.script,'code');assert.equal(data.stdin,'42\n');assert.equal(data.language,JDOODLE_LANGUAGES[language].language);assert.equal(data.versionIndex,JDOODLE_LANGUAGES[language].versionIndex);assert.equal(data.libs,undefined);assert.equal(data.compileOnly,undefined);executions++;return Response.json({statusCode:200,output:'42\n'});
 }));assert.equal(executions,1);assert.equal(answer.stdout,'42\n');assert.equal(answer.success,false);assert.equal(answer.diagnosticsCombined,true);assert.equal(JSON.stringify(answer).includes(config.clientSecret),false);
 }
});
test('the last daily credit is atomic and shared across concurrent users and app instances',async()=>{
 const {db}=quotaDb();const now=new Date('2026-10-08T12:00:00Z');for(let i=0;i<19;i++)await reserveJDoodleCredit(db,config,now);
 const attempts=await Promise.allSettled(Array.from({length:10},()=>reserveJDoodleCredit(db,config,now)));assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(quotaPeriod(new Date('2026-10-08T23:54:59Z')),'2026-10-08');assert.equal(quotaPeriod(new Date('2026-10-08T23:55:00Z')),'2026-10-09');await reserveJDoodleCredit(db,config,new Date('2026-10-08T23:55:00Z'));
 assert.equal(dailyLimit({...config,dailyLimit:'200'}),0);assert.equal(dailyLimit({...config,dailyLimit:'10'}),10);assert.equal(executionProvider({}),'none');
});
test('provider exhaustion closes the day without calls that could consume further credits',async()=>{
 const {db}=quotaDb();let executes=0;const fetcher=fake(url=>{if(url.endsWith('/credit-spent'))return Response.json({used:20});executes++;return Response.json({statusCode:200,output:'unexpected'});});
 await assert.rejects(executeJDoodle(db,{language:'python',source:'x'},config,fetcher),/exhausted/);await assert.rejects(executeJDoodle(db,{language:'c',source:'x'},config,fetcher),/exhausted/);assert.equal(executes,0);
 const m=quotaDb();const failure=fake(url=>url.endsWith('/credit-spent')?Response.json({used:0}):new Response(config.clientSecret,{status:429}));await assert.rejects(executeJDoodle(m.db,{language:'c',source:'x'},config,failure),/exhausted/);
});
test('unavailable credentials, failed services and oversized output do not claim program success',async()=>{
 const {db}=quotaDb();await assert.rejects(executeJDoodle(db,{language:'c',source:'x'},{},fake(()=>{throw new Error('must not fetch');})),/not configured/);
 const fetcher=fake(url=>url.endsWith('/credit-spent')?Response.json({used:0}):Response.json({statusCode:200,output:'syntax error'}));const result=await executeJDoodle(db,{language:'c',source:'bad'},config,fetcher);assert.equal(result.stdout,'syntax error');assert.equal(result.success,false);
 await assert.rejects(executeJDoodle(db,{language:'python',source:'x'},config,fake(()=>new Response(config.clientSecret,{status:401}))),error=>error instanceof Error&&!error.message.includes(config.clientSecret));
 const large=fake(url=>url.endsWith('/credit-spent')?Response.json({used:0}):Response.json({statusCode:200,output:'x'.repeat(20000)}));const capped=await executeJDoodle(db,{language:'c',source:'x'},config,large);assert.equal(capped.stdout.length,JDOODLE_LIMITS.outputBytes);assert.equal(capped.truncated,true);
 await assert.rejects(executeJDoodle(db,{language:'c',source:'x'},config,fake(()=>Response.json({used:'unknown'}))),/could not be verified/);
 await assert.rejects(executeJDoodle(db,{language:'c',source:'x'},config,fake(url=>url.endsWith('/credit-spent')?Response.json({used:0}):new Response('x'.repeat(JDOODLE_LIMITS.responseBytes+1)))),/too much output/);
});

test('JDoodle deadline bounds a stalled credit-check body and keeps the uncertain reservation',async()=>{
 const {db,counts}=quotaDb();let signal:AbortSignal|null|undefined;
 const stalled=fake((_url,init)=>{signal=init.signal;return new Response(new ReadableStream({start(){}}));});
 await assert.rejects(executeJDoodle(db,{language:'python',source:'x'},config,stalled),/timed out/);assert.equal(signal?.aborted,true);assert.equal([...counts.values()][0],1);
});
