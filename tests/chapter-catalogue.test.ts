import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ObjectId} from 'mongodb';
import {Memory,clone} from './helpers/memory-db';
import {prepareChapterCatalogue,youtubeId} from '../lib/chapter-catalogue';
import {chapterImportPlan,importChapterCatalogue,reviewChapterVideo} from '../lib/chapter-import';
import {resourcesForStudent} from '../lib/resource-service';
import {resourceEligible,type AcademicResource} from '../lib/resource-eligibility';
import {acceptChapterResource} from '../lib/resource-acceptance';
import {emptyProfile, type Profile} from '../lib/types';
import {emptyEducation} from '../lib/education';
import {publicationSchema,profileSchema} from '../lib/validation';
const source=JSON.parse(readFileSync(new URL('../data/chapters/cbse-class8-mathematics-2026-27.json',import.meta.url),'utf8'));
const profile:Profile={...emptyProfile,stage:'school',level:'Class 8',goal:'Study my enrolled mathematics chapters',education:{...emptyEducation,board:'CBSE',className:'Class 8',subjects:['Mathematics']}};
async function setup(){const m=new Memory(),d=m.asDb();await d.collection('profiles').insertOne({...profile,userId:'a'});await d.collection('profiles').insertOne({...profile,education:{...profile.education!,className:'Class 9'},level:'Class 9',userId:'b'});await importChapterCatalogue(d,prepareChapterCatalogue(source));return {m,d};}
async function approve(d:ReturnType<Memory['asDb']>){const r=await d.collection('resources').findOne({youtubeId:source.videos[0].youtubeId});assert.ok(r);await reviewChapterVideo(d,r._id,'verified-editor',true,{status:'published',chapterReview:{confirmed:true,versions:[r.chapterMappings[0].version],notes:'Test-only reviewer decision in isolated in-memory database.'}});return r._id as ObjectId;}
test('attachment structure, chapter order and URLs validate without asserting syllabus completeness',()=>{
 const b=prepareChapterCatalogue(source);assert.equal(b.chapters.length,14);assert.equal(b.entries.length,14);assert.equal(b.report.duplicateVideos,0);assert.equal(b.report.rejected.length,0);assert.equal(b.report.unresolvedChapters.length,14);assert.equal(b.report.unresolvedVideos.length,14);assert.equal(b.entries[10].source.channelUrl,null);
 const changed=clone(source);changed.chapters[0].chapterOrder=2;assert.throws(()=>prepareChapterCatalogue(changed));changed.chapters[0].chapterOrder=20;assert.throws(()=>prepareChapterCatalogue(changed));
 const invalid=clone(source);invalid.videos[0].canonicalUrl='https://example.com/watch?v=5gPtLhdco0A';invalid.videos[1].chapterMappings[0].chapterId='foreign';invalid.videos[2].userId='injected';const report=prepareChapterCatalogue(invalid).report;assert.equal(report.rejected.length,3);
 for(const url of ['javascript:alert(1)','https://youtube.com.evil.example/watch?v=5gPtLhdco0A','https://user:password@youtube.com/watch?v=5gPtLhdco0A'])assert.equal(youtubeId(url),null);
 assert.equal(youtubeId('https://youtu.be/5gPtLhdco0A'),'5gPtLhdco0A');
});
test('dry-run inventory is read-only and repeat imports retain approved metadata and merge mappings by video ID',async()=>{
 const {m,d}=await setup(),id=await approve(d),before=m.writes;
 await chapterImportPlan(d,prepareChapterCatalogue(source));assert.equal(m.writes,before);
 await d.collection('resources').updateOne({_id:id},{$set:{title:'Editor-maintained title',active:false}});
 const repeated=await importChapterCatalogue(d,prepareChapterCatalogue(source));assert.equal(repeated.videosInserted,0);assert.equal(repeated.chaptersInserted,0);assert.equal(await d.collection('resources').countDocuments({}),14);
 const duplicate=clone(source);duplicate.videos.push({...clone(duplicate.videos[0]),resourceId:'additional-source',chapterMappings:[{...duplicate.videos[0].chapterMappings[0],chapterId:duplicate.chapters[1].chapterId}]});const batch=prepareChapterCatalogue(duplicate);assert.equal(batch.report.duplicateVideos,1);await importChapterCatalogue(d,batch);await importChapterCatalogue(d,batch);
 const r=await d.collection('resources').findOne({_id:id});assert.equal(r?.title,'Editor-maintained title');assert.equal(r?.status,'published');assert.equal(r?.active,false);assert.equal(r?.chapterMappings.length,2);assert.equal(r?.approvedChapterVersions.length,1);assert.equal(r?.researchSources.length,2);
});
test('pending videos are hidden, chapter empties are available, and only verified reviewers can approve exact mappings',async()=>{
 const {d}=await setup();const pending=await resourcesForStudent(d,'a',false);assert.equal(pending.resources.length,0);assert.equal(pending.chapters.length,14);
 const r=await d.collection('resources').findOne({youtubeId:source.videos[0].youtubeId});assert.ok(r);
 await assert.rejects(reviewChapterVideo(d,r._id,'student',false,{status:'published'}));await assert.rejects(resourcesForStudent(d,'a',false,{view:'review'}));
 await assert.rejects(reviewChapterVideo(d,r._id,'editor',true,{status:'published'}));await assert.rejects(reviewChapterVideo(d,r._id,'editor',true,{status:'published',chapterReview:{confirmed:true,versions:['0'.repeat(64)],notes:'Invalid version'}}));
 assert.equal(publicationSchema.safeParse({status:'published',chapterReview:{versions:[r.chapterMappings[0].version],notes:'checked',confirmed:false}}).success,false);
 const id=await approve(d);assert.equal((await resourcesForStudent(d,'a',false)).resources.length,1);assert.equal((await resourcesForStudent(d,'b',false)).resources.length,0);
 await reviewChapterVideo(d,id,'editor',true,{status:'pending'});assert.equal((await resourcesForStudent(d,'a',false)).resources.length,0);
});
test('class, board, actual subject, session and textbook restrictions use saved profile and preserve older profiles',async()=>{
 const {d}=await setup(),id=await approve(d),r=await d.collection('resources').findOne({_id:id});assert.ok(r);
 assert.equal(resourceEligible(r as AcademicResource,profile),true);
 for(const e of [{board:'ISC'},{className:'Class 10'},{subjects:['Science']},{academicSession:'2025-26'},{textbooks:[{subject:'Mathematics',title:'Ganita Prakash',edition:'2025-26'}]},{textbooks:[{subject:'Mathematics',title:'Different textbook',edition:'2026-27'}]}])assert.equal(resourceEligible(r as AcademicResource,{...profile,education:{...profile.education!,...e}}),false);
 const p={...profile,education:{...profile.education!,academicSession:'2026-27',textbooks:[{subject:'Mathematics',title:'Ganita Prakash Part II',edition:'2026-27'}]}};assert.equal(resourceEligible(r as AcademicResource,p),true);assert.equal(profileSchema.safeParse(p).success,true);
 await d.collection('profiles').updateOne({userId:'a'},{$set:p});assert.equal((await resourcesForStudent(d,'a',false)).resources.length,1);
});
test('new chapter mappings never inherit old approval, even after a video is published',async()=>{
 const {d}=await setup(),id=await approve(d),changed=clone(source);changed.videos[0].chapterMappings.push({...changed.videos[0].chapterMappings[0],chapterId:changed.chapters[1].chapterId});await importChapterCatalogue(d,prepareChapterCatalogue(changed));
 const visible=await resourcesForStudent(d,'a',false);assert.equal(visible.resources[0].chapterMappings?.length,1);assert.equal(visible.resources[0].chapterMappings?.[0].chapterId,source.chapters[0].chapterId);
 const changedChapter=clone(source);changedChapter.chapters[0].textbookEdition='2027-28';changedChapter.chapters.forEach((c:{textbookEdition:string})=>c.textbookEdition='2027-28');await importChapterCatalogue(d,prepareChapterCatalogue(changedChapter));
 const r=await d.collection('resources').findOne({_id:id});assert.ok(r);assert.equal(r.approvedChapterVersions.length,1);
});
test('legacy YouTube URLs deduplicate without overwriting community metadata or publication decisions',async()=>{
 const m=new Memory(),d=m.asDb();const id=new ObjectId();await d.collection('resources').insertOne({_id:id,title:'Existing submission',url:`https://youtu.be/${source.videos[0].youtubeId}`,status:'pending'});
 const report=await importChapterCatalogue(d,prepareChapterCatalogue(source));assert.equal(report.videosInserted,13);assert.equal(await d.collection('resources').countDocuments({}),14);const old=await d.collection('resources').findOne({_id:id});assert.equal(old?.title,'Existing submission');assert.equal(old?.status,'pending');assert.equal(old?.chapterMappings.length,1);
});
test('accepted video creates one owned goal-linked task, preserves progress and never completes on opening',async()=>{
 const {d}=await setup(),id=await approve(d);await assert.rejects(acceptChapterResource(d,'b',id,20));await assert.rejects(acceptChapterResource(d,'a',id,0));
 const first=await acceptChapterResource(d,'a',id,20),second=await acceptChapterResource(d,'a',id,25);assert.equal(first.taskRef,second.taskRef);assert.equal(await d.collection('tasks').countDocuments({userId:'a'}),1);assert.equal(await d.collection('tasks').countDocuments({userId:'b'}),0);
 const task=await d.collection('tasks').findOne({_id:new ObjectId(first.taskRef),userId:'a'});assert.equal(task?.status,'todo');assert.equal(task?.minutes,20);assert.equal(task?.resourceRef,id.toHexString());assert.equal(task?.goalTitle,profile.goal);
 await d.collection('tasks').updateOne({_id:new ObjectId(first.taskRef),userId:'a'},{$set:{status:'done'}});await acceptChapterResource(d,'a',id,20);assert.equal((await d.collection('tasks').findOne({_id:new ObjectId(first.taskRef),userId:'a'}))?.status,'done');
});

test('explicit operator publication exposes this batch without fabricating review or overwriting existing decisions',async()=>{
 const m=new Memory(),d=m.asDb();await d.collection('profiles').insertOne({...profile,userId:'a'});
 await importChapterCatalogue(d,prepareChapterCatalogue(source),{publishNew:true});
 const visible=await resourcesForStudent(d,'a',false);assert.equal(visible.resources.length,14);assert.equal(visible.chapters.length,14);
 const r=await d.collection('resources').findOne({youtubeId:source.videos[0].youtubeId});assert.ok(r);assert.equal(r.publicationBasis,'operator_requested_no_review');assert.equal(r.audienceReviewedAt,undefined);assert.equal(r.reviewedBy,undefined);assert.equal(r.researchSources[0].reviewDepth,'metadata_only');
 await d.collection('resources').updateOne({_id:r._id},{$set:{status:'pending',active:false}});await importChapterCatalogue(d,prepareChapterCatalogue(source),{publishNew:true});assert.equal((await resourcesForStudent(d,'a',false)).resources.length,13);
});
