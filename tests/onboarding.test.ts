import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Memory} from './helpers/memory-db';
import {emptyProfile,type Profile} from '../lib/types';
import {withEducation,educationFor,changeEducation} from '../lib/education';
import {boundedOnboardingHelp,containsCredential,mergeOnboardingDraft,onboardingContext,onboardingHelpSchema,sessionDraftAction,studyStepsFor} from '../lib/onboarding-contract';
import {onboardingWithGemini} from '../lib/mentor-provider';
import {readOnboardingProfile,saveOnboardingProfile,OnboardingConflict} from '../lib/onboarding-profile';
import {restoreAfterAuthentication} from '../lib/auth-flow';
import {beginDishaAuthHandoff,hasDishaAuthHandoff,clearDishaAuthHandoff} from '../lib/onboarding-handoff';

function profile():Profile{return withEducation({...emptyProfile,stage:'senior',onboardingComplete:true},{...educationFor(emptyProfile),board:'ISC',className:'Class 11',stream:'Commerce',subjects:['English','Commerce','Accounts']});}
test('expired sessions retain unfinished setup, while a different account clears private drafts',()=>{
 assert.equal(sessionDraftAction('one',null,true),'await_auth');
 assert.equal(sessionDraftAction('one','one',true),'keep');
 assert.equal(sessionDraftAction('one','two',true),'clear');
 assert.equal(sessionDraftAction(null,'two',true),'keep');
});
test('the shared controlled workflow includes relevant school and programme branches and ends with review',()=>{
 for(const stage of ['school','senior','vocational','undergraduate','postgraduate'] as const){
  const path=studyStepsFor({...emptyProfile,stage});assert.equal(path[0],'stage');assert.equal(path.at(-1),'review');
  assert.equal(path.includes('stream'),stage==='senior');assert.equal(path.includes('board'),stage==='school'||stage==='senior');
  assert.equal(path.includes('period'),!['school','senior'].includes(stage));assert.ok(path.includes('subjects'));assert.ok(path.includes('weeklyHours'));
 }
});
test('onboarding saves only confirmed validated structured profiles belonging to the session owner',async()=>{
 const m=new Memory(),p=profile();const first=await readOnboardingProfile(m.asDb(),'one');
 await assert.rejects(saveOnboardingProfile(m.asDb(),'one',{profile:p,expectedRevision:first.revision,confirmed:false}));
 await assert.rejects(saveOnboardingProfile(m.asDb(),'one',{profile:p,expectedRevision:first.revision,confirmed:true,userId:'two'}));
 const saved=await saveOnboardingProfile(m.asDb(),'one',{profile:p,expectedRevision:first.revision,confirmed:true});
 assert.deepEqual(saved.profile,p);assert.equal((await readOnboardingProfile(m.asDb(),'two')).profile,null);
 assert.notEqual(saved.revision,first.revision);
 await assert.rejects(saveOnboardingProfile(m.asDb(),'two',{profile:p,expectedRevision:saved.revision,confirmed:true}),OnboardingConflict);
});
test('stale snapshots and duplicate submissions cannot silently overwrite a profile',async()=>{
 const m=new Memory();const initial=await readOnboardingProfile(m.asDb(),'a');const payload={profile:profile(),expectedRevision:initial.revision,confirmed:true};
 const saved=await saveOnboardingProfile(m.asDb(),'a',payload);
 await assert.rejects(saveOnboardingProfile(m.asDb(),'a',payload),OnboardingConflict);
 await m.collection('profiles').updateOne({userId:'a'},{$set:{goal:'Updated in another tab'}});
 await assert.rejects(saveOnboardingProfile(m.asDb(),'a',{...payload,expectedRevision:saved.revision}),OnboardingConflict);
 assert.equal((await readOnboardingProfile(m.asDb(),'a')).profile?.goal,'Updated in another tab');
});
test('a concurrent change between reading and writing fails the atomic comparison',async()=>{
 const m=new Memory();const original=await readOnboardingProfile(m.asDb(),'a');const saved=await saveOnboardingProfile(m.asDb(),'a',{profile:profile(),expectedRevision:original.revision,confirmed:true});
 const collection=m.asDb().collection.bind(m);const d={collection:(name:string)=>{
  const col=collection(name);const update=col.updateOne.bind(col);
  col.updateOne=(async(...args:Parameters<typeof update>)=>{await m.collection('profiles').updateOne({userId:'a'},{$set:{goal:'Concurrent change'}});return update(...args);}) as typeof col.updateOne;
  return col;
 }} as unknown as ReturnType<Memory['asDb']>;
 await assert.rejects(saveOnboardingProfile(d,'a',{profile:{...profile(),goal:'My edit'},expectedRevision:saved.revision,confirmed:true}),OnboardingConflict);
 assert.equal((await readOnboardingProfile(m.asDb(),'a')).profile?.goal,'Concurrent change');
});
test('invalid senior combinations are rejected on the assistant save path',async()=>{
 const m=new Memory(),p=profile();p.education!.subjects=['English','Mathematics','Applied Mathematics'];
 const current=await readOnboardingProfile(m.asDb(),'a');
 await assert.rejects(saveOnboardingProfile(m.asDb(),'a',{profile:p,expectedRevision:current.revision,confirmed:true}));assert.equal(m.writes,0);
});
test('guest handoff loads an existing account without automatically saving the assistant draft',async()=>{
 beginDishaAuthHandoff();let saves=0,loads=0;await restoreAfterAuthentication(hasDishaAuthHandoff()?'login':'signup',profile(),async()=>{loads++;},async()=>{saves++;});assert.equal(loads,1);assert.equal(saves,0);clearDishaAuthHandoff();assert.equal(hasDishaAuthHandoff(),false);
});
test('draft merge preserves returning user optional details unless explicitly edited',()=>{
 const saved={...profile(),goal:'Existing goal',bio:'Existing bio',weeklyHours:6,interests:['Music']};const draft={...profile(),goal:'Draft goal',bio:'',weeklyHours:0,interests:[]};
 const result=mergeOnboardingDraft(saved,draft,new Set(['goal']));assert.equal(result.goal,'Draft goal');assert.equal(result.bio,saved.bio);assert.equal(result.weeklyHours,6);assert.deepEqual(result.interests,['Music']);
 const changed=changeEducation(saved,'board','CBSE');assert.deepEqual(changed.education?.subjects,saved.education?.subjects);
});
test('guest draft merging retains saved session and textbook selections for applicability review',()=>{
 const saved=profile();saved.education!.academicSession='2026-27';saved.education!.textbooks=[{subject:'English',title:'School textbook',edition:'School edition'}];
 const draft=changeEducation(profile(),'className','Class 12');const result=mergeOnboardingDraft(saved,draft,new Set());
 assert.equal(result.education?.className,'Class 12');assert.equal(result.education?.academicSession,'2026-27');assert.deepEqual(result.education?.textbooks,saved.education!.textbooks);
});
test('step context omits goals, biography, selected subjects and irrelevant academic fields',()=>{
 const p=profile();p.goal='Private goal';p.bio='Private biography';assert.deepEqual(onboardingContext('stage',p),{});assert.deepEqual(onboardingContext('goal',p),{stage:'senior'});
 const input=boundedOnboardingHelp({step:'board',message:'Help',context:{stage:'senior',board:'ISC',program:'Private programme'}});assert.deepEqual(input.context,{stage:'senior'});
 assert.equal(JSON.stringify(onboardingContext('subjects',p)).includes('Private'),false);
 assert.equal(onboardingHelpSchema.safeParse({...input,context:{password:'secret'}}).success,false);
});
test('recognizable credentials are rejected before provider invocation',async()=>{
 for(const value of ['password: example','otp=123456','123456','https://example.test/reset?token=abc','Bearer abc','mongodb+srv://test']){
  assert.equal(containsCredential(value),true);let called=false;
  await assert.rejects(onboardingWithGemini({step:'board',message:value,context:{}},{key:'server-only',model:'test',fetcher:async()=>{called=true;return new Response();}}));assert.equal(called,false);
 }
 assert.equal(containsCredential('What does ISC Commerce mean?'),false);
});
test('onboarding uses existing Gemini with bounded context and returns honest failures',async()=>{
 const input={step:'board' as const,message:'Explain the board question',context:{stage:'senior',program:'unnecessary'}};
 assert.equal((await onboardingWithGemini(input)).status,'missing_key');
 let body='';const result=await onboardingWithGemini(input,{key:'server-only',model:'test',fetcher:async(_url,init)=>{body=String(init?.body);return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({answer:'Choose the board used by your school. You can use the searchable list.'})}]}}]});}});
 assert.equal(result.status,'used');assert.equal(body.includes('unnecessary'),false);assert.equal(body.includes('server-only'),false);
 assert.equal((await onboardingWithGemini(input,{key:'test',model:'test',fetcher:async()=>new Response('',{status:429})})).status,'rate_limited');
 assert.equal((await onboardingWithGemini(input,{key:'test',model:'test',timeoutMs:10,fetcher:async()=>new Promise<Response>(()=>{})})).status,'timed_out');
 for(const answer of ['I saved your profile','Please enter your password','Visit https://example.com'])assert.equal((await onboardingWithGemini(input,{key:'test',model:'test',fetcher:async()=>Response.json({candidates:[{content:{parts:[{text:JSON.stringify({answer})}]}}]})})).status,'unavailable');
});
