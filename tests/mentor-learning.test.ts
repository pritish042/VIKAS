import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Memory} from './helpers/memory-db';
import {emptyProfile} from '../lib/types';
import {runMentor,saveMentorTurn} from '../lib/mentor-workflow';
import {readConversation,resolveLearning} from '../lib/mentor-learning';
import {beginnerPack,beginnerPassages} from '../lib/mentor-beginner-pack';
const profile={...emptyProfile,goal:'Learn programming',interests:['Python'],stage:'undergrad',level:'Year 1'};
const response=(answer:unknown)=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(answer)}]}}]});
async function setup(){const m=new Memory();await m.collection('profiles').insertOne({...profile,userId:'a'});return m;}
function provider(inspect?:(input:any,request:any)=>void){return {key:'test-only-secret',model:'test',fetcher:async(_url:unknown,init?:RequestInit)=>{const request=JSON.parse(String(init?.body)),input=JSON.parse(request.contents[0].parts[0].text);inspect?.(input,request);return input.passages?.length?response({sentences:[{text:'A short explanation from the supplied passage.',citations:[input.passages[0].id]}]}):response({answer:'Here is general guidance about your requested topic.'});}};}
test('Python basics → yes → next → attempted answer persists an owned lesson and sends recent history',async()=>{
 const m=await setup(),before=JSON.stringify(m.rows.get('profiles'));let calls=0;
 const p=provider((input)=>{assert.equal(input.learning.topicId,'python-basics');assert.equal(input.learningIntent,calls>=3?'answer':'lesson');assert.equal(input.history.length,calls*2);assert.ok(input.context.education.includes('undergrad'));calls++;});
 const first=await saveMentorTurn(m.asDb(),'a',{message:'Teach Python basics'},p);assert.match(first.answer,/print\(2 \+ 3\)/);assert.match(first.answer,/Practice:/);assert.doesNotMatch(first.answer,/Hello|Would you like/);assert.equal(first.mentor.learning?.step,0);
 const yes=await saveMentorTurn(m.asDb(),'a',{message:'yes'},p);assert.equal(yes.mentor.learning?.step,0);assert.equal(yes.mentor.learning?.pendingQuestion,first.mentor.learning?.pendingQuestion);
 const next=await saveMentorTurn(m.asDb(),'a',{message:'next'},p);assert.equal(next.mentor.learning?.step,1);assert.match(next.answer,/score = 7/);
 const wrong=await saveMentorTurn(m.asDb(),'a',{message:'8'},p);assert.match(wrong.answer,/Not quite/);assert.ok(wrong.mentor.learning?.pendingQuestion);
 const attempt=await saveMentorTurn(m.asDb(),'a',{message:'9'},p);assert.match(attempt.answer,/Correct for this practice question/);assert.equal(attempt.mentor.learning?.pendingQuestion,'');assert.equal(attempt.mentor.labLanguage,'python');
 assert.equal(JSON.stringify(m.rows.get('profiles')),before);assert.equal((await readConversation(m.asDb(),'b')).history.length,0);
});
test('explicit C/C++ wins over saved Python interests and stale topic selection; basics typos and ambiguity work',async()=>{
 const m=await setup();await saveMentorTurn(m.asDb(),'a',{message:'Teach Python basics'},provider());
 const c=await saveMentorTurn(m.asDb(),'a',{message:'I want learn basis of c',topicId:'python-basics'},provider((input,request)=>{assert.equal(input.learning.topicId,'c-basics');assert.match(request.systemInstruction.parts[0].text,/never redirect C or C\+\+ to Python/);}));assert.match(c.answer,/#include <stdio.h>/);assert.equal(c.mentor.labLanguage,'c');
 const cpp=await saveMentorTurn(m.asDb(),'a',{message:'give me c++ bacis'},provider());assert.match(cpp.answer,/std::cout/);assert.equal(cpp.mentor.labLanguage,undefined);
 const both=await saveMentorTurn(m.asDb(),'a',{message:'I want learn basis of c and c++'},provider());assert.equal(both.mentor.learning?.topicId,'c-cpp-basics');assert.match(both.answer,/distinct languages/);
 const next=await saveMentorTurn(m.asDb(),'a',{message:'next'},provider());assert.match(next.answer,/std::cout/);assert.equal(next.mentor.labLanguage,undefined);
 const legacy=new Memory();await legacy.collection('messages').insertOne({userId:'a',role:'user',content:'give me python bacis',createdAt:new Date()});await legacy.collection('messages').insertOne({userId:'a',role:'assistant',content:'Would you like a program?',createdAt:new Date()});assert.equal((await readConversation(legacy.asDb(),'a')).state?.topicId,'python-basics');
 assert.equal(resolveLearning('yes',undefined,undefined).intent,'clarify');assert.equal(resolveLearning('Teach C or Python basics',undefined,undefined).intent,'clarify');
});
test('new replies read current profile; history and learning never cross accounts or rewrite earlier replies',async()=>{
 const m=await setup();const first=await saveMentorTurn(m.asDb(),'a',{message:'Teach Python basics'},provider());const old=JSON.stringify(m.rows.get('messages'));
 await m.collection('profiles').updateOne({userId:'a'},{$set:{goal:'Updated goal',stage:'school',level:'Class 8'}});
 await saveMentorTurn(m.asDb(),'a',{message:'next'},provider(input=>{assert.equal(input.context.goal,'Updated goal');assert.match(input.context.education,/school/);assert.equal(input.history[1].content,first.answer.slice(0,1200));}));
 assert.equal(JSON.stringify(m.rows.get('messages')!.slice(0,2)),old);
 await m.collection('profiles').insertOne({...profile,userId:'b',goal:'Other account'});
 await saveMentorTurn(m.asDb(),'b',{message:'Teach C basics'},provider(input=>{assert.equal(input.context.goal,'Other account');assert.deepEqual(input.history,[]);assert.equal(input.learning.step,0);}));
 const own=(await readConversation(m.asDb(),'a')).history;assert.equal(own.some(turn=>turn.content.includes('#include <stdio.h>')),false);
});
test('retrieval gaps allow labelled general guidance; provider failures retain reviewed practice and safe retry status',async()=>{
 const m=await setup();const general=await runMentor(m.asDb(),'a',{message:'Explain recursion'},provider());assert.equal(general.mentor.providerStatus,'used');assert.match(general.mentor.sourceLabel||'',/General AI guidance/);assert.equal(general.mentor.passages.length,0);assert.equal(general.mentor.retryable,false);assert.doesNotMatch(general.answer,/cannot provide|No approved lesson passages/);
 const events:unknown[][]=[];const warn=console.warn;console.warn=(...args)=>events.push(args);
 try{const failed=await saveMentorTurn(m.asDb(),'a',{message:'Teach C basics'},{key:'never-log-this',model:'test',fetcher:async()=>new Response('never-log-this: sensitive upstream error',{status:503})});assert.equal(failed.mentor.providerStatus,'unavailable');assert.equal(failed.mentor.retryable,true);assert.match(failed.answer,/#include <stdio.h>/);assert.equal(failed.mentor.passages.length,1);assert.equal(failed.mentor.uncertainty.some(text=>text.includes('No approved lesson passages')),false);assert.equal(JSON.stringify(events).includes('never-log-this'),false);assert.ok(events.some(event=>JSON.stringify(event).includes('provider failure')));}finally{console.warn=warn;}
});
test('history is chronological and bounded; beginner source references and examples remain separate from metadata',async()=>{
 const m=new Memory();for(let i=0;i<20;i++)await m.collection('messages').insertOne({userId:'a',role:i%2?'assistant':'user',content:`turn ${i}: `+'x'.repeat(2000),createdAt:new Date(i*1000),email:'never-forward',toolCalls:'never-forward'});
 await m.collection('messages').insertOne({userId:'b',role:'assistant',content:'private b',createdAt:new Date()});
 const {history}=await readConversation(m.asDb(),'a');assert.ok(history.length<=8);assert.ok(history.reduce((size,turn)=>size+turn.content.length,0)<=6000);assert.ok(history[0].content.startsWith('turn 15:'));assert.ok(history.at(-1)?.content.startsWith('turn 19:'));assert.equal(JSON.stringify(history).includes('never-forward'),false);assert.equal(JSON.stringify(history).includes('private b'),false);
 for(const language of ['c','cpp','python'] as const)for(const [step,lesson] of beginnerPack[language].lessons.entries()){const passage=beginnerPassages(language,step)[0];assert.match(passage.sourceUrl,/^https:\/\//);assert.match(passage.version,/^[a-f0-9]{64}$/);assert.match(passage.text,/Example:/);assert.equal(lesson.code.includes('youtube'),false);}
});
