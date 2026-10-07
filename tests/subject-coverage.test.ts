import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Memory} from './helpers/memory-db';
import {emptyProfile,type Profile} from '../lib/types';
import {emptyEducation,withEducation,changeEducation} from '../lib/education';
import {resourcesForStudent} from '../lib/resource-service';
import {educationCoverageKey} from '../lib/subject-coverage-contract';

const profile:Profile=withEducation({...emptyProfile,stage:'senior'},{...emptyEducation,board:'CBSE',className:'Class 11',stream:'Science — PCM',subjects:['Physics','Applied Mathematics','Local elective']});
const topic={id:'units',resourceId:'units',subject:'Physics',title:'Units',languages:['English'],excludedQuestionIds:[],applicability:{stage:'senior',classes:['Class 11'],boards:['CBSE'],subjects:['Physics']}};
function resource(subject='Physics',overrides={}){return {title:subject,status:'published',active:true,audienceReviewedAt:new Date(),audience:{pathways:['senior'],classes:['Class 11'],boards:['CBSE'],streamIndependent:true,subjects:[subject],topicIds:['units']},...overrides};}
test('coverage separates actual resources, search links and active checks for saved selections',async()=>{
 const m=new Memory(),db=m.asDb();await db.collection('profiles').insertOne({...profile,userId:'a'});
 await db.collection('resources').insertOne(resource('Physics',{catalogue:{topic}}));
 await db.collection('resources').insertOne(resource('Physics',{directory:{board:'CBSE',classLevel:11,subject:'Physics',academicSession:''}}));
 await db.collection('resources').insertOne(resource('Applied Mathematics',{status:'pending'}));
 await db.collection('resources').insertOne(resource('Local elective',{active:false}));
 await db.collection('topic_assessments').insertOne({topic,status:'active',createdAt:new Date(),questions:[{answer:'secret-key'}]});
 const result=await resourcesForStudent(db,'a',false),coverage=result.subjectCoverage!;
 assert.equal(coverage.educationKey,educationCoverageKey(profile));
 assert.deepEqual(coverage.subjects,[
  {subject:'Physics',resources:true,searchLinks:true,assessments:true},
  {subject:'Applied Mathematics',resources:false,searchLinks:false,assessments:false},
  {subject:'Local elective',resources:false,searchLinks:false,assessments:false},
 ]);
 assert.equal(JSON.stringify(coverage).includes('secret-key'),false);
 await db.collection('topic_assessments').updateMany({},{$set:{status:'inactive'}});
 assert.equal((await resourcesForStudent(db,'a',false)).subjectCoverage!.subjects[0].assessments,false);
 assert.equal((await resourcesForStudent(db,'a',false,{view:'mine'})).subjectCoverage,undefined);
 assert.equal((await resourcesForStudent(db,'a',true,{view:'review'})).subjectCoverage,undefined);
});
test('coverage follows owned saved class and board, never unsaved choices or another user',async()=>{
 const m=new Memory(),db=m.asDb();await db.collection('profiles').insertOne({...profile,userId:'a'});
 await db.collection('profiles').insertOne({...changeEducation(profile,'className','Class 12'),userId:'b'});
 await db.collection('resources').insertOne(resource('Physics',{catalogue:{topic}}));
 await db.collection('topic_assessments').insertOne({topic,status:'active',createdAt:new Date()});
 const a=(await resourcesForStudent(db,'a',false)).subjectCoverage!,b=(await resourcesForStudent(db,'b',false)).subjectCoverage!;
 assert.equal(a.subjects[0].resources,true);assert.equal(a.subjects[0].assessments,true);
 assert.equal(b.subjects[0].resources,false);assert.equal(b.subjects[0].assessments,false);assert.notEqual(a.educationKey,b.educationKey);
 assert.notEqual(a.educationKey,educationCoverageKey(changeEducation(profile,'board','ISC')));
 assert.notEqual(a.educationKey,educationCoverageKey({...profile,education:{...profile.education!,subjects:['Physics']}}));
 assert.equal((await resourcesForStudent(db,'missing',false)).subjectCoverage,undefined);
});
test('ISC coverage does not equate Commerce with Business Studies or English papers with each other',async()=>{
 const m=new Memory(),db=m.asDb();const p=withEducation(profile,{...profile.education!,board:'isc',stream:'Commerce',className:'Class 12',subjects:['Commerce','Business Studies','English Language','English Literature']});
 await db.collection('profiles').insertOne({...p,userId:'a'});
 for(const subject of ['Business Studies','English Language'])await db.collection('resources').insertOne({...resource(subject),audience:{pathways:['senior'],classes:['Class 12'],boards:['CISCE / ICSE / ISC'],streamIndependent:true,subjects:[subject]},directory:{board:'ISC',classLevel:12,subject,academicSession:''}});
 const rows=(await resourcesForStudent(db,'a',false)).subjectCoverage!.subjects;
 assert.equal(rows.find(r=>r.subject==='Commerce')!.searchLinks,false);
 assert.equal(rows.find(r=>r.subject==='Business Studies')!.searchLinks,true);
 assert.equal(rows.find(r=>r.subject==='English Language')!.searchLinks,true);
 assert.equal(rows.find(r=>r.subject==='English Literature')!.searchLinks,false);
});
