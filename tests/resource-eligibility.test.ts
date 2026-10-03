import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Memory} from './helpers/memory-db';
import {emptyProfile,type Profile} from '../lib/types';
import {emptyEducation} from '../lib/education';
import {resourceEligible,resourceProfile,normalizeClass,normalizeCombination,resourceAudienceSchema} from '../lib/resource-eligibility';
import {resourcesForStudent,resourceQueryOptions} from '../lib/resource-service';
import {latestRequest} from '../lib/latest-request';
import {signOutAndClear} from '../lib/auth-flow';
const profile=(stream='Science PCB',subjects=['Physics','Chemistry','Biology'],board='CBSE'):Profile=>({...emptyProfile,stage:'senior',level:'Class 12',stream,education:{...emptyEducation,board,className:'Class 12',stream,subjects}});
const resource=(subject='Biology')=>({title:subject,status:'published',active:true,audienceReviewedAt:new Date(),audience:{pathways:['senior'],classes:['Class 12'],boards:['CBSE'],streams:['Science'],subjects:[subject],topicIds:['cells']}});
test('Class 12 CBSE PCB eligibility uses AND across every audience dimension',()=>{
 for(const subject of ['Physics','Chemistry','Biology'])assert.equal(resourceEligible(resource(subject),profile()),true);
 assert.equal(resourceEligible({...resource(),audience:{...resource().audience,boards:[],boardIndependent:true}},profile()),true);
 assert.equal(resourceEligible({...resource(),audience:{...resource().audience,classes:['11–12']}},profile()),true);
 assert.equal(resourceEligible({...resource(),audience:{...resource().audience,pathways:['school']}},profile()),true);
 for(const subject of ['Mathematics','English','Computer Science','Physical Education','Accountancy','Business Studies','History','Political Science'])assert.equal(resourceEligible(resource(subject),profile()),false);
 for(const change of [{status:'pending'},{status:'rejected'},{active:false},{active:undefined},{expiresAt:'2000-01-01T00:00:00Z'},{audienceReviewedAt:undefined},{audience:undefined}])assert.equal(resourceEligible({...resource(),...change},profile()),false);
 for(const audience of [{...resource().audience,pathways:['Diploma']},{...resource().audience,pathways:['ITI']},{...resource().audience,classes:['Class 11']},{...resource().audience,boards:['ISC']},{...resource().audience,streams:['Commerce']},{...resource().audience,streams:['Arts/Humanities']}])assert.equal(resourceEligible({...resource(),audience},profile()),false);
 assert.equal(resourceEligible(resource(),profile(),'unrelated'),false);assert.equal(resourceEligible({...resource(),audience:{...resource().audience,parentTopicIds:['life']}},profile(),'life'),true);
});
test('PCMB and optional subjects match only explicitly saved subjects',()=>{
 assert.equal(resourceEligible(resource('Mathematics'),profile('Science PCMB',['Physics','Chemistry','Biology','Mathematics'])),true);
 assert.equal(resourceEligible(resource('English'),profile('PCB',['Physics','Chemistry','Biology','English'])),true);
 assert.equal(resourceEligible({...resource(),audience:{...resource().audience,streams:['PCM']}},profile()),false);
});
test('Commerce and Humanities students receive their actual subjects only',()=>{
 for(const [stream,subject] of [['Commerce','Accountancy'],['Arts/Humanities','History']]){
  const p=profile(stream,[subject]);const r={...resource(subject),audience:{...resource(subject).audience,streams:[stream]}};
  assert.equal(resourceEligible(r,p),true);assert.equal(resourceEligible(resource('Physics'),p),false);
  assert.equal(resourceEligible({...r,audience:{...r.audience,subjects:['Political Science']}},p),false);
 }
});
test('board specificity cannot leak and explicitly reviewed independence works',()=>{
 assert.equal(resourceEligible(resource(),profile('PCB',['Biology'],'ISC')),false);
 const shared={...resource(),audience:{...resource().audience,boards:[],boardIndependent:true}};
 assert.equal(resourceEligible(shared,profile('PCB',['Biology'],'ISC')),true);assert.equal(resourceEligible({...shared,audienceReviewedAt:undefined},profile()),false);
});
test('legacy normalization never invents subjects and incomplete profiles fail closed',()=>{
 for(const c of ['12','Class 12','class-12'])assert.equal(normalizeClass(c),'Class 12');
 assert.equal(normalizeCombination('Physics-Chemistry-Biology'),'pcb');
 assert.equal(resourceEligible({...resource('Maths'),audience:{...resource('Maths').audience,boards:['cbse'],streams:['science']}},profile('science',['Mathematics'],'CBSE')),true);
 const legacy={...emptyProfile,stage:'senior' as const,level:'12',stream:'PCB'};assert.ok(resourceProfile(legacy).missing.includes('subjects currently studied'));assert.equal(resourceEligible(resource(),legacy),false);
 assert.equal(resourceAudienceSchema.safeParse({pathways:['senior'],subjects:['Biology']}).success,false);
});
test('server loads owned MongoDB profiles, hides incomplete legacy records and isolates review/submission views',async()=>{
 const m=new Memory(),d=m.asDb();await d.collection('profiles').insertOne({...profile(),userId:'a'});await d.collection('profiles').insertOne({...profile('Commerce',['Accountancy']),userId:'b'});
 await d.collection('resources').insertOne(resource('Biology'));await d.collection('resources').insertOne({...resource('Accountancy'),audience:{...resource('Accountancy').audience,streams:['Commerce']}});
 await d.collection('resources').insertOne({title:'Legacy unclassified',status:'published',stage:'all'});await d.collection('resources').insertOne({...resource('Biology'),title:'Pending submission',status:'pending',userId:'b'});
 assert.deepEqual((await resourcesForStudent(d,'a',false)).resources.map(r=>r.title),['Biology']);assert.deepEqual((await resourcesForStudent(d,'b',false)).resources.map(r=>r.title),['Accountancy']);
 const incomplete=await resourcesForStudent(d,'c',false);assert.equal(incomplete.profileIncomplete,true);assert.equal(incomplete.resources.length,0);assert.ok(incomplete.missingFields.includes('education stage'));
 await assert.rejects(resourcesForStudent(d,'a',false,{view:'review'}));assert.equal((await resourcesForStudent(d,'a',false,{view:'mine'})).resources.length,0);
 assert.equal((await resourcesForStudent(d,'a',true,{view:'review'})).resources.some(r=>r.title==='Pending submission'),true);
 await d.collection('profiles').updateOne({userId:'a'},{$set:profile('Commerce',['Accountancy'])});assert.deepEqual((await resourcesForStudent(d,'a',false)).resources.map(r=>r.title),['Accountancy']);
 for(const parameter of ['userId','board','class','stream','subjects','programme','pathway'])assert.throws(()=>resourceQueryOptions(new URLSearchParams(`${parameter}=other`)));
});
test('logout and newer loads invalidate delayed responses before private state can be restored',async()=>{
 const gate=latestRequest();let resources=['A'];const old=gate.begin();const newer=gate.begin();assert.equal(gate.current(old),false);assert.equal(gate.current(newer),true);
 await signOutAndClear(async()=>({error:null}),()=>{gate.invalidate();resources=[];});assert.equal(gate.current(newer),false);assert.deepEqual(resources,[]);
});
