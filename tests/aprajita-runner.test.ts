import test from 'node:test';
import assert from 'node:assert/strict';
import {executeCode,EXECUTION_LIMITS,RUNNER_LANGUAGES,runnerConfigured} from '../lib/aprajita/execution';
const config={url:'https://runner.example/v1',token:'private-runner-secret'};
// Judge0 uses Ruby Base64.encode64, which wraps lines and adds a newline.
const encoded=(value:string)=>(Buffer.from(value).toString('base64').match(/.{1,60}/g)||[]).join('\n')+'\n';
const result=(id=3,extra:Record<string,unknown>={})=>new Response(JSON.stringify({status:{id},...extra}));
const fake=(fn:(url:string,init:RequestInit)=>Promise<Response>|Response)=>((url,init)=>fn(String(url),init!)) as typeof fetch;
test('all three languages forward UTF-8 source/stdin, server credentials and fixed execution limits',async()=>{
 for(const language of ['c','python','java'] as const){
 const answer=await executeCode({language,source:'code ✓',stdin:'42\n'},config,fake((url,init)=>{
  assert.equal(url,'https://runner.example/v1/submissions?base64_encoded=true&wait=false');
  assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');assert.equal(new Headers(init.headers).get('X-Auth-Token'),config.token);
  const payload=JSON.parse(init.body as string);assert.equal(Buffer.from(payload.source_code,'base64').toString(),'code ✓');assert.equal(Buffer.from(payload.stdin,'base64').toString(),'42\n');assert.equal(payload.language_id,RUNNER_LANGUAGES[language]);
  assert.equal(payload.enable_network,false);assert.equal(payload.redirect_stderr_to_stdout,false);assert.equal(payload.enable_per_process_and_thread_time_limit,false);assert.equal(payload.cpu_time_limit,2);assert.equal(payload.wall_time_limit,5);assert.equal(payload.memory_limit,256000);assert.equal(payload.max_file_size,16);assert.equal(payload.max_processes_and_or_threads,64);
  return result(3,{stdout:encoded('42\n'),stderr:encoded('warning\n')});
 }));assert.equal(answer.stdout,'42\n');assert.equal(answer.stderr,'warning\n');assert.equal(answer.success,true);assert.equal(JSON.stringify(answer).includes(config.token),false);
 }
});
test('queued submissions are polled at the same authenticated service without resubmitting code',async()=>{
 const token='12345678-1234-1234-1234-123456789abc';let calls=0;
 const answer=await executeCode({language:'python',source:'print(42)'},config,fake((url,init)=>{
  calls++;if(calls===1){assert.equal(init.method,'POST');return new Response(JSON.stringify({token}));}
  assert.equal(init.method,'GET');assert.equal(init.body,undefined);assert.equal(new Headers(init.headers).get('X-Auth-Token'),config.token);assert.ok(url.startsWith(`https://runner.example/v1/submissions/${token}?`));
  return calls===2?result(2):result(3,{stdout:encoded('42\n')});
 }));assert.equal(calls,3);assert.equal(answer.stdout,'42\n');
});
test('compiler diagnostics and runtime failures remain distinct from stdout',async()=>{
 const compile=await executeCode({language:'c',source:'invalid'},config,fake(()=>result(6,{compile_output:encoded('syntax error'),stderr:encoded('details')})));
 assert.equal(compile.success,false);assert.equal(compile.status,'Compilation error');assert.equal(compile.compilationErrors,'syntax error');assert.equal(compile.stderr,'details');assert.equal(compile.output,'');
 const runtime=await executeCode({language:'python',source:'raise Exception()'},config,fake(()=>result(11,{stderr:encoded('Traceback')})));assert.equal(runtime.success,false);assert.equal(runtime.status,'Runtime error');
 const limit=await executeCode({language:'java',source:'loop'},config,fake(()=>result(5)));assert.equal(limit.status,'Time limit exceeded');assert.equal(limit.success,false);
});
test('missing configuration, provider failures and invalid results never become successful output',async()=>{
 let calls=0;const fetcher=fake(()=>{calls++;throw new Error(config.token);});
 assert.equal(runnerConfigured({url:'http://runner.example',token:'x'}),false);assert.equal(runnerConfigured({url:'https://user:pass@runner.example',token:'x'}),false);
 await assert.rejects(executeCode({language:'c',source:'x'}, {},fetcher),/not configured/);assert.equal(calls,0);
 await assert.rejects(executeCode({language:'python',source:'x'},config,fetcher),error=>error instanceof Error&&!error.message.includes(config.token));
 for(const status of [401,429,500])await assert.rejects(executeCode({language:'c',source:'x'},config,fake(()=>new Response(config.token,{status}))),error=>error instanceof Error&&!error.message.includes(config.token));
 for(const body of ['null','[]','{}','{"token":"https://attacker.example"}','{"status":{"id":3.5}}','{"status":{"id":3},"stdout":"invalid%"}'])await assert.rejects(executeCode({language:'java',source:'x'},config,fake(()=>new Response(body))));
 await assert.rejects(executeCode({language:'python',source:'x',enable_network:true},config,fetcher));
});
test('combined output and provider body sizes are bounded',async()=>{
 const answer=await executeCode({language:'c',source:'x'},config,fake(()=>result(6,{stdout:encoded('x'.repeat(16000)),compile_output:encoded('y'.repeat(1000)),stderr:encoded('z'.repeat(1000))})));
 assert.equal(Buffer.byteLength(answer.stdout+answer.compilationErrors+answer.stderr),EXECUTION_LIMITS.outputBytes);assert.equal(answer.truncated,true);
 const unicode=await executeCode({language:'python',source:'x'},config,fake(()=>result(3,{stdout:encoded('✓'.repeat(6000))})));assert.ok(Buffer.byteLength(unicode.stdout)<=EXECUTION_LIMITS.outputBytes);assert.equal(unicode.stdout.includes('�'),false);
 await assert.rejects(executeCode({language:'c',source:'x'},config,fake(()=>new Response('x'.repeat(EXECUTION_LIMITS.responseBytes+1)))),/response limit/);
});
test('deadline covers response-body reads even when the service ignores abort',async()=>{
 let signal:AbortSignal|null|undefined;
 const answer=executeCode({language:'python',source:'x'},config,fake((_url,init)=>{signal=init.signal;return new Response(new ReadableStream({start(){/* Deliberately stalled test double. */}}));}));
 await assert.rejects(answer,/timed out/);assert.equal(signal?.aborted,true);
});
