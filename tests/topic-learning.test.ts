import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ObjectId,type Db,type Document} from 'mongodb';
import research from '../data/catalogue/research.json';
import routing from '../data/catalogue/routing.json';
import {prepareCatalogue,importCatalogue} from '../lib/catalogue-import';
import {assess,attemptInput,acceptanceInput,resourceFeedbackInput,matchesProfile,publicQuestions,recommend,safeExternalUrl} from '../lib/topic-rules';
import {acceptResource,createAttempt,getCheck,listAttempts,listTopics,saveResourceFeedback,TopicError} from '../lib/topic-service';
import {emptyProfile,type Profile} from '../lib/types';
import {emptyEducation} from '../lib/education';

import {Memory,clone} from './helpers/memory-db';
const batch=prepareCatalogue(research,routing);
const profile:Profile={...emptyProfile,goal:'Understand units',stage:'senior',education:{...emptyEducation,board:'CBSE',className:'Class 11',subjects:['Physics'],stream:'Custom combination'}};
async function setup(){const m=new Memory();await importCatalogue(m.asDb(),batch);await m.collection('profiles').insertOne({...profile,userId:'a'});await m.collection('profiles').insertOne({...profile,userId:'b'});return m;}
const skipped={topicId:'Physics_Units_Measurements',skipped:true,language:'English',minutes:20};

test('catalogue validates eight entries and excludes five unsuitable draft questions',()=>{
 assert.equal(batch.length,8);assert.equal(batch.reduce((n,b)=>n+b.assessment.questions.length,0),35);
 assert.equal(batch.every(b=>b.resource.status==='published'&&b.assessment.status==='active'&&!b.assessment.validated),true);
 const changed=clone(research);changed.catalogue.resources[0].direct_url='javascript:alert(1)';assert.throws(()=>prepareCatalogue(changed,routing));
 for(const url of ['http://example.com','https://user:password@example.com','https://127.0.0.1/','https://192.168.0.1/','https://site.local/'])assert.equal(safeExternalUrl.safeParse(url).success,false);
});
test('school matching requires board, class and actual subject; no stream assumptions',()=>{
 const app=batch[0].assessment.topic.applicability;
 assert.equal(matchesProfile(profile,app),true);
 for(const education of [{...profile.education!,subjects:['Chemistry']},{...profile.education!,board:'NIOS'},{...profile.education!,className:'Class 12'}])assert.equal(matchesProfile({...profile,education},app),false);
 assert.equal(matchesProfile({...emptyProfile,stage:'senior',level:'Class 11',stream:'Science — PCM'},app),false);
});
test('degree matches require programme, discipline and known first-year applicability',()=>{
 const app=batch[4].assessment.topic.applicability;
 const p={...emptyProfile,stage:'undergraduate' as const,education:{...emptyEducation,program:'B.Sc.',discipline:'Computer Science',period:'Year 1'}};
 assert.equal(matchesProfile(p,app),true);
 assert.equal(matchesProfile({...p,education:{...p.education,discipline:'Physics'}},app),false);
 assert.equal(matchesProfile({...p,education:{...p.education,program:'BCA'}},app),false);
 assert.equal(matchesProfile({...p,education:{...p.education,period:'Year 3'}},app),false);
});
test('scoring is per objective, preserves Not sure and rejects duplicate or foreign questions',()=>{
 const qs=batch[0].assessment.questions;
 const answers=qs.map(q=>({questionId:q.id,answer:q.answer}));answers[1].answer='a';
 const results=assess(qs,answers);assert.equal(results[0].result,'understood');assert.equal(results[1].result,'revisit');
 assert.equal(assess(qs,qs.map(q=>({questionId:q.id,answer:'e'}))).every(r=>r.result==='not_sure'),true);
 assert.throws(()=>assess(qs,[...answers.slice(1),answers[1]]));assert.throws(()=>assess(qs,[{questionId:'foreign',answer:'a'},...answers.slice(1)]));
 const publicData=JSON.stringify(publicQuestions(qs));assert.equal(publicData.includes('answer'),false);assert.equal(publicData.includes('explanation'),false);assert.equal(publicData.includes('objective'),false);
});
test('strict bounded inputs reject client scores, identity, version tampering and invalid feedback',()=>{
 assert.equal(attemptInput.safeParse(skipped).success,true);
 for(const addition of [{userId:'b'},{score:100},{answers:[]},{version:'fake'},{minutes:0},{language:'a'.repeat(61)}])assert.equal(attemptInput.safeParse({...skipped,...addition}).success,false);
 assert.equal(acceptanceInput.safeParse({resourceId:batch[0].resource._id.toString(),userId:'b'}).success,false);
 assert.equal(resourceFeedbackInput.safeParse({feeling:'weak'}).success,false);
 assert.equal(resourceFeedbackInput.safeParse({feeling:'too_easy',score:9}).success,false);
});
test('routing uses prerequisites, objectives, language, time and each saved feedback choice',()=>{
 const entry=batch[0],qs=entry.assessment.questions,uncertain=assess(qs,qs.map(q=>({questionId:q.id,answer:'e'})));
 const rec=(feeling?:'too_easy'|'about_right'|'too_difficult')=>recommend([entry.resource],profile,skipped.topicId,[], 'English',20,feeling)[0];
 assert.match(rec().reasons.join(' '),/skipped/);assert.equal(rec('too_difficult').minutes,10);assert.match(rec('too_easy').approach,/practice/);assert.equal(rec('about_right').minutes,20);
 assert.match(recommend([entry.resource],profile,skipped.topicId,uncertain,'English',20)[0].approach,/prerequisite/);
 assert.equal(recommend([entry.resource],profile,skipped.topicId,[],'Hindi',20).length,0);
 assert.equal(recommend([{...entry.resource,status:'pending'}],profile,skipped.topicId,[],'English',20).length,0);
 assert.equal(recommend(Array.from({length:5},()=>({...entry.resource,_id:new ObjectId()})),profile,skipped.topicId,[],'English',20).length,3);
});
test('import is repeatable, preserves publication decisions and avoids exact legacy duplicates',async()=>{
 const m=await setup();assert.deepEqual(await importCatalogue(m.asDb(),batch),{resourcesInserted:0,assessmentVersionsInserted:0});
 await m.collection('resources').updateOne({_id:batch[0].resource._id},{$set:{status:'pending'}});await importCatalogue(m.asDb(),batch);
 assert.equal((await m.collection('resources').findOne({_id:batch[0].resource._id})).status,'pending');
 const legacy=new Memory();await legacy.collection('resources').insertOne({_id:new ObjectId(),title:batch[0].resource.title,url:batch[0].resource.url,status:'pending',userId:'owner'});
 await importCatalogue(legacy.asDb(),batch);assert.equal(legacy.rows.get('resources')!.length,8);assert.equal(legacy.rows.get('resources')![0].status,'pending');
});
test('inactive definitions are hidden but published resources remain selectable by skipping',async()=>{
 const m=await setup(),id=batch[0].assessment._id;
 await m.collection('topic_assessments').updateOne({_id:id},{$set:{status:'draft'}});
 assert.equal((await listTopics(m.asDb(),'a'))[0].assessmentId,null);
 await assert.rejects(getCheck(m.asDb(),'a',id),e=>e instanceof TopicError&&e.status===404);
 const a=await createAttempt(m.asDb(),'a',skipped);assert.equal(a.recommendations.length,1);
 await m.collection('resources').updateOne({_id:batch[0].resource._id},{$set:{status:'pending'}});
 assert.equal((await listTopics(m.asDb(),'a')).length,0);assert.equal((await listAttempts(m.asDb(),'a'))[0].recommendations.length,0);
});
test('two-user isolation covers attempts, acceptance, feedback and historical results',async()=>{
 const m=await setup(),d=m.asDb(),a=await createAttempt(d,'a',skipped);
 assert.equal((await listAttempts(d,'b')).length,0);
 await assert.rejects(acceptResource(d,'b',a._id,batch[0].resource._id.toString()),e=>e instanceof TopicError&&e.status===404);
 await assert.rejects(saveResourceFeedback(d,'b',a._id,'too_easy'),e=>e instanceof TopicError&&e.status===404);
 assert.equal(m.rows.get('tasks')?.length||0,0);
 const publicData=JSON.stringify(await listAttempts(d,'a'));assert.equal(publicData.includes('userId'),false);assert.equal(publicData.includes('definition'),false);
});
test('double acceptance creates one goal-linked todo task and does not resurrect deleted tasks',async()=>{
 const m=await setup(),d=m.asDb(),a=await createAttempt(d,'a',skipped),resourceId=batch[0].resource._id.toString();
 const results=await Promise.all([acceptResource(d,'a',a._id,resourceId),acceptResource(d,'a',a._id,resourceId)]);
 assert.equal(results[0].taskRef,results[1].taskRef);assert.equal(m.rows.get('tasks')!.length,1);
 const task=m.rows.get('tasks')![0];assert.equal(task.userId,'a');assert.equal(task.status,'todo');assert.equal(task.goalTitle,profile.goal);assert.equal(task.topicAttemptRef,String(a._id));
 m.rows.get('tasks')!.length=0;await acceptResource(d,'a',a._id,resourceId);assert.equal(m.rows.get('tasks')!.length,0);
});
test('acceptance retries recover an interrupted task insertion without another task ID',async()=>{
 const m=await setup(),d=m.asDb(),a=await createAttempt(d,'a',skipped),rid=batch[0].resource._id.toString();m.failNextTaskWrite=true;
 await assert.rejects(acceptResource(d,'a',a._id,rid));const ref=m.rows.get('topic_attempts')![0].acceptance.taskRef;
 assert.equal((await acceptResource(d,'a',a._id,rid)).taskRef,ref);assert.equal(m.rows.get('tasks')!.length,1);
});
test('saved feedback adjusts the next attempt without changing historical results',async()=>{
 const m=await setup(),d=m.asDb(),a=await createAttempt(d,'a',skipped);
 await acceptResource(d,'a',a._id,batch[0].resource._id.toString());await saveResourceFeedback(d,'a',a._id,'too_difficult');
 const next=await createAttempt(d,'a',skipped);assert.equal(next.recommendations[0].minutes,10);assert.equal(a.recommendations[0].minutes,20);
});
test('assessment edits create a new immutable version and preserve previous attempts',async()=>{
 const m=await setup(),d=m.asDb(),definition=batch[0].assessment;
 const a=await createAttempt(d,'a',{...skipped,skipped:false,assessmentId:definition._id.toString(),answers:definition.questions.map(q=>({questionId:q.id,answer:q.answer}))});
 const edited=clone(research);edited.checks.diagnostic_questions.Physics_Units_Measurements[0].explanation+=' Updated wording.';
 const revised=prepareCatalogue(edited,routing);await importCatalogue(d,revised);
 assert.notEqual(revised[0].assessment.version,a.version);assert.equal(m.rows.get('topic_assessments')!.length,9);
 const historical=(await listAttempts(d,'a'))[0];assert.equal(historical.version,a.version);assert.equal(historical.results[0].explanation,a.results[0].explanation);
});
