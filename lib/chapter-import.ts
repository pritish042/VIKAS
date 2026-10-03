import type {Db,Document} from 'mongodb';
import {stableId} from './catalogue-import';
import {chapterHash,chapterAudience,youtubeId,type ChapterMapping,type VideoSource,prepareChapterCatalogue} from './chapter-catalogue';
export type ChapterBatch=ReturnType<typeof prepareChapterCatalogue>;
export async function chapterImportPlan(d:Db,batch:ChapterBatch){
 const rows=await d.collection('resources').find({}).limit(10000).toArray();
 const matches=batch.entries.map(e=>({entry:e,existing:rows.filter(r=>r.youtubeId===e.source.youtubeId||typeof r.url==='string'&&youtubeId(r.url)===e.source.youtubeId)}));
 const conflicts=matches.filter(m=>m.existing.length>1).map(m=>m.entry.source.youtubeId);
 return {matches,report:{database:d.databaseName,...batch.report,existingVideos:matches.filter(m=>m.existing.length===1).length,newVideos:matches.filter(m=>!m.existing.length).length,conflicts}};
}
export async function importChapterCatalogue(d:Db,batch:ChapterBatch,options:{publishNew?:boolean}={}){
 if(batch.report.rejected.length)throw new Error('Correct rejected records before applying.');
 const plan=await chapterImportPlan(d,batch);if(plan.report.conflicts.length)throw new Error('Multiple existing records share a video ID. Resolve duplicates before applying.');
 await d.collection('resources').createIndex({youtubeId:1},{unique:true,partialFilterExpression:{youtubeId:{$type:'string'}}});
 let chaptersInserted=0,videosInserted=0;
 for(const c of batch.chapters){const result=await d.collection('curriculum_chapters').updateOne({_id:stableId(`chapter:${chapterHash(c)}`)},{$setOnInsert:{...c,version:chapterHash(c),sourceBasis:'supplied_unverified_research',createdAt:new Date()}},{upsert:true});chaptersInserted+=result.upsertedCount;}
 for(const {entry:e,existing} of plan.matches){
  const now=new Date(),source=e.source;
  // Only a new resource gets initial metadata/status. Repeat imports never overwrite editor decisions.
  const result=await d.collection('resources').updateOne(existing[0]?{_id:existing[0]._id}:{youtubeId:source.youtubeId},{$setOnInsert:{_id:stableId(`youtube:${source.youtubeId}`),youtubeId:source.youtubeId,title:source.title,description:source.reviewLimitations,url:`https://www.youtube.com/watch?v=${source.youtubeId}`,stage:'school',stream:'Mathematics',minutes:source.durationMinutes===null?0:Math.ceil(source.durationMinutes),videoMetadata:{youtubeId:source.youtubeId,title:source.title,channelName:source.channelName,channelUrl:source.channelUrl,durationMinutes:source.durationMinutes,language:source.instructionalLanguage,fetchedAt:source.fetchedAt},status:options.publishNew?'published':'pending',active:!!options.publishNew,audience:chapterAudience(e.mappings.map(m=>m.chapter)),...(options.publishNew?{publicationBasis:'operator_requested_no_review',audienceApprovedAt:now,approvedChapterVersions:e.mappings.map(m=>m.version)}:{}),createdAt:now},$addToSet:{chapterMappings:{$each:e.mappings},researchSources:{$each:e.sources}}},{upsert:true});videosInserted+=result.upsertedCount;
 }
 return {...plan.report,chaptersInserted,videosInserted};
}
export interface ChapterResource extends Document {chapterMappings?:ChapterMapping[];researchSources?:VideoSource[];approvedChapterVersions?:string[];}
export async function reviewChapterVideo(d:Db,id:import('mongodb').ObjectId,reviewerId:string,isEditor:boolean,input:{status:'published'|'pending';chapterReview?:{versions:string[];notes:string;confirmed:true};active?:boolean}){
 if(!isEditor)throw new Error('Only verified editors can approve videos.');
 const r=await d.collection<ChapterResource>('resources').findOne({_id:id});if(!r?.chapterMappings)throw new Error('Chapter video not found.');
 const review=input.chapterReview;
 if(input.status==='published'&&(!review||!review.versions.length))throw new Error('Confirm the chapter mappings and review notes before publishing.');
 if(review&&(new Set(review.versions).size!==review.versions.length||review.versions.some(v=>!r.chapterMappings!.some(m=>m.version===v))))throw new Error('Only mappings from the current resource may be approved.');
 const mappings=review?r.chapterMappings.filter(m=>review.versions.includes(m.version)):[];
 const now=new Date();
 const result=await d.collection('resources').updateOne({_id:id,chapterMappings:r.chapterMappings},{$set:{status:input.status,active:input.status==='published'&&input.active!==false,reviewedAt:now,reviewedBy:reviewerId,...(review?{approvedChapterVersions:review.versions,audience:chapterAudience(mappings.map(m=>m.chapter)),audienceReviewedAt:now,audienceReviewedBy:reviewerId,chapterReview:{...review,reviewerId,reviewedAt:now}}:{})}});
 if(!result.matchedCount)throw new Error('The mappings changed. Reload and review the current versions.');
 return {ok:true};
}
