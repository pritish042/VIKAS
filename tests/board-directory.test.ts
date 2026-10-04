import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareBoardDirectory} from '../lib/board-directory';
import {resourceEligible} from '../lib/resource-eligibility';
import type {Profile} from '../lib/types';
const source=JSON.parse(readFileSync('data/directories/cbse-class12-2026-27.json','utf8'));
const profile={stage:'senior',level:'Class 12',stream:'Science',education:{board:'CBSE',className:'Class 12',stream:'Science',subjects:['Physics'],program:'',discipline:'',period:''}} as Partial<Profile>;
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
