import test from 'node:test';
import assert from 'node:assert/strict';
import {Memory} from './helpers/memory-db';
import {emptyProfile} from '../lib/types';
import {labEligibility,computingSubject,READINESS_VERSION} from '../lib/aprajita/access';
import {labAccess,submitReadiness,saveLabFile,listLabFiles} from '../lib/aprajita/service';
import {executeCode,EXECUTION_LIMITS} from '../lib/aprajita/execution';
const degree={...emptyProfile,stage:'undergraduate' as const,education:{...emptyProfile.education!,program:'B.Tech / B.E.'}};
const school={...emptyProfile,stage:'senior' as const,education:{...emptyProfile.education!,className:'Class 11',board:'CBSE',subjects:['Computer Science']}};
test('eligibility uses actual computing subjects and supports every engineering branch',()=>{
 assert.equal(labEligibility(degree).eligible,true);assert.equal(labEligibility(school).requiresAssessment,true);
 for(const subject of ['IT','AI','Computer Applications','Informatics Practices','Advanced Computer Science (custom)'])assert.equal(computingSubject(subject),true);
 assert.equal(labEligibility({...school,education:{...school.education,stream:'Science',subjects:['Physics']}}).eligible,false);
 assert.equal(labEligibility({...school,education:{...school.education,subjects:[]}}).needsProfile,true);
 assert.equal(labEligibility({...school,education:{...school.education,className:'Class 7'}}).eligible,false);
 assert.equal(labEligibility({...degree,education:{...degree.education,program:'B.Sc.'}}).eligible,false);
});
test('readiness is account/version scoped and revoked when computing eligibility changes',async()=>{
 const m=new Memory(),db=m.asDb();await m.collection('profiles').insertOne({...school,userId:'a'});await m.collection('profiles').insertOne({...school,userId:'b'});
 assert.equal((await submitReadiness(db,'a',{version:READINESS_VERSION,answers:['a','b','a','a','a']})).passed,false);
 assert.equal((await labAccess(db,'a')).ready,false);
 assert.equal((await submitReadiness(db,'a',{version:READINESS_VERSION,answers:['a','b','c','a','a']})).passed,true);
 assert.equal((await labAccess(db,'a')).ready,true);assert.equal((await labAccess(db,'b')).ready,false);
 await assert.rejects(submitReadiness(db,'b',{version:'old',answers:['a','b','c','b','d']}));
 await m.collection('profiles').updateOne({userId:'a'},{$set:{'education.subjects':['Physics']}});assert.equal((await labAccess(db,'a')).ready,false);
});
test('files cannot cross account ownership and all file operations enforce access',async()=>{
 const m=new Memory(),db=m.asDb();for(const userId of ['a','b'])await m.collection('profiles').insertOne({...degree,userId});
 const a=await saveLabFile(db,'a',{language:'python',name:'main.py',source:'private a'});const b=await saveLabFile(db,'b',{language:'python',name:'main.py',source:'private b'});
 assert.notEqual(a.id,b.id);assert.deepEqual((await listLabFiles(db,'a')).map(f=>f.source),['private a']);
 await assert.rejects(saveLabFile(db,'b',{language:'python',name:'main.py',source:'attack',userId:'a'}));
 await assert.rejects(listLabFiles(db,'guest'));await assert.rejects(saveLabFile(db,'guest',{language:'c',name:'a.c',source:''}));
});
test('runner forwards only constrained parameters and caps returned output',async()=>{
 let payload:any;const fetcher=(async(_url:unknown,init:RequestInit)=>{payload=JSON.parse(init.body as string);assert.equal(new Headers(init.headers).get('X-Auth-Token'),'server-secret');return new Response(JSON.stringify({status:{id:3},stdout:Buffer.from('x'.repeat(20000)).toString('base64')}));}) as typeof fetch;
 const result=await executeCode({language:'python',source:'print(1)'},{url:'https://runner.example',token:'server-secret'},fetcher);
 assert.equal(payload.enable_network,false);assert.equal(payload.cpu_time_limit,EXECUTION_LIMITS.cpuSeconds);assert.equal(payload.wall_time_limit,EXECUTION_LIMITS.wallSeconds);assert.equal(payload.max_file_size,EXECUTION_LIMITS.fileKB);assert.equal(result.output.length,EXECUTION_LIMITS.outputBytes);assert.equal(result.truncated,true);
 await assert.rejects(executeCode({language:'python',source:'x',enable_network:true},{url:'https://runner.example',token:'secret'},fetcher));
 await assert.rejects(executeCode({language:'c',source:'x'},{}),/not configured/);
 const large=(async()=>new Response('x'.repeat(EXECUTION_LIMITS.responseBytes+1))) as typeof fetch;await assert.rejects(executeCode({language:'java',source:'x'},{url:'https://runner.example',token:'secret'},large),/response limit/);
});
