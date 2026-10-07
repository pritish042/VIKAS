import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareBoardDirectory} from '../lib/board-directory';
import {resourceEligible} from '../lib/resource-eligibility';
import type {Profile} from '../lib/types';
const source=JSON.parse(readFileSync('data/directories/cbse-class12-2026-27.json','utf8'));
const profile={stage:'senior',level:'Class 12',stream:'Science',education:{board:'CBSE',className:'Class 12',stream:'Science',subjects:['Physics'],program:'',discipline:'',period:''}} as Partial<Profile>;
test('shared Physics subject keeps chapter search lists and resource identities separate by class and board',()=>{
 const ids=new Set<string>();
 for(const board of ['CBSE','ISC'])for(const level of [11,12]){
  const file=board==='CBSE'?`data/directories/cbse-class${level}-2026-27.json`:`data/directories/isc-class${level}.json`;
  const entries=prepareBoardDirectory(JSON.parse(readFileSync(file,'utf8'))).filter(r=>r.stream==='Physics');
  assert.ok(entries.length>0);
  for(const entry of entries){
   assert.equal(ids.has(entry._id.toString()),false);ids.add(entry._id.toString());
   const resource={...entry,status:'published',active:true,publicationBasis:'operator_requested_no_review',audienceApprovedAt:new Date()};
   for(const selectedBoard of ['CBSE','ISC'])for(const selectedLevel of [11,12]){
    assert.equal(resourceEligible(resource,{...profile,level:`Class ${selectedLevel}`,education:{...profile.education!,board:selectedBoard,className:`Class ${selectedLevel}`}}),board===selectedBoard&&level===selectedLevel);
   }
  }
 }
});
test('supplied directories validate and deduplicate without manufacturing video IDs',()=>{
 for(const level of [11,12]){const batch=prepareBoardDirectory(JSON.parse(readFileSync(`data/directories/cbse-class${level}-2026-27.json`,'utf8')));assert.ok(batch.length>600);assert.equal(new Set(batch.map(r=>r._id.toString())).size,batch.length);assert.ok(batch.every(r=>new URL(r.url).pathname==='/results'));}
});
test('search resources are scoped to board, class, enrolled subject and optional session',()=>{
 const entry=prepareBoardDirectory(source).find(r=>r.stream==='Physics')!;
 const resource={...entry,status:'published',active:true,publicationBasis:'operator_requested_no_review',audienceApprovedAt:new Date()};
 assert.equal(resourceEligible(resource,profile),true);
 for(const education of [{...profile.education!,board:'ISC'},{...profile.education!,className:'Class 11'},{...profile.education!,subjects:['Chemistry']},{...profile.education!,academicSession:'2025-26'}])assert.equal(resourceEligible(resource,{...profile,education}),false);
 assert.equal(resourceEligible({...resource,status:'pending'},profile),false);
});
test('malformed search URLs are rejected',()=>{
 const bad=structuredClone(source);bad.entries[0].url='https://.youtube.com/results?search_query=physics';assert.throws(()=>prepareBoardDirectory(bad));
});

test('ISC sources preserve unspecified sessions and exact unique counts',()=>{
 for(const [level,count] of [[11,370],[12,360]]){
  const batch=prepareBoardDirectory(JSON.parse(readFileSync(`data/directories/isc-class${level}.json`,'utf8')));
  assert.equal(batch.length,count);assert.ok(batch.every(r=>r.directory.board==='ISC'&&r.directory.academicSession===''));
 }
});
test('ISC aliases support senior students while CBSE, wrong class and subjects stay excluded',()=>{
 const entry=prepareBoardDirectory(JSON.parse(readFileSync('data/directories/isc-class12.json','utf8'))).find(r=>r.stream==='Physics')!;
 const resource={...entry,status:'published',active:true,publicationBasis:'operator_requested_no_review',audienceApprovedAt:new Date()};
 for(const board of ['ISC','ICSE','CISCE','CISCE / ICSE / ISC'])assert.equal(resourceEligible(resource,{...profile,education:{...profile.education!,board,academicSession:'2026-27'}}),true);
 assert.equal(resourceEligible(resource,profile),false);
 assert.equal(resourceEligible(resource,{...profile,education:{...profile.education!,board:'ISC',className:'Class 11'}}),false);
 assert.equal(resourceEligible(resource,{...profile,education:{...profile.education!,board:'ISC',subjects:['Chemistry']}}),false);
});
test('ISC English components require the actual enrolled component or general English',()=>{
 const batch=prepareBoardDirectory(JSON.parse(readFileSync('data/directories/isc-class12.json','utf8')));
 for(const component of ['English Language','English Literature']){
  const entry=batch.find(r=>r.stream===component)!;
  const resource={...entry,status:'published',active:true,publicationBasis:'operator_requested_no_review',audienceApprovedAt:new Date()};
  for(const subject of ['English',component])assert.equal(resourceEligible(resource,{...profile,education:{...profile.education!,board:'ISC',subjects:[subject]}}),true);
  const other=component==='English Language'?'English Literature':'English Language';
  assert.equal(resourceEligible(resource,{...profile,education:{...profile.education!,board:'ISC',subjects:[other]}}),false);
 }
});

test('MongoDB resource retrieval retains both boards and old CBSE directory records',async()=>{
 const {Memory}=await import('./helpers/memory-db');const {resourcesForStudent}=await import('../lib/resource-service');const {importBoardDirectory}=await import('../lib/board-directory');
 const memory=new Memory(),db=memory.asDb();
 const isc=prepareBoardDirectory(JSON.parse(readFileSync('data/directories/isc-class12.json','utf8'))).filter(r=>r.stream==='Physics');
 const cbse=prepareBoardDirectory(source).filter(r=>r.stream==='Physics');
 await importBoardDirectory(db,isc);await importBoardDirectory(db,cbse);
 await db.collection('profiles').insertOne({...profile,userId:'cbse'});
 await db.collection('profiles').insertOne({...profile,userId:'isc',education:{...profile.education!,board:'CISCE / ICSE / ISC'}});
 const cbseRows=await resourcesForStudent(db,'cbse',false),iscRows=await resourcesForStudent(db,'isc',false);
 assert.equal(cbseRows.resources.length,cbse.length);assert.equal(iscRows.resources.length,isc.length);
 assert.ok(iscRows.resources.every(r=>r.directory?.board==='ISC'));
 // Existing CBSE imports predate the additive board field.
 const stored=memory.rows.get('resources')!.find(r=>r.directory.board==='CBSE')!;delete stored.directory.board;
 assert.equal((await resourcesForStudent(db,'cbse',false)).resources.length,cbse.length);
 await db.collection('resources').updateOne({_id:isc[0]._id},{$set:{status:'pending',active:false}});
 const repeat=await importBoardDirectory(db,isc);assert.equal(repeat.resourcesInserted,0);
 assert.equal((await resourcesForStudent(db,'isc',false)).resources.length,isc.length-1);
});
