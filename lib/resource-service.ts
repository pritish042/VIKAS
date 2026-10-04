import type {Db,Document} from 'mongodb';
import {chapterMatchesProfile,chapterSchema} from './chapter-catalogue';
import type {Profile} from './types';
import {type AcademicResource,resourceEligible,resourceProfile,resourceAudienceSchema,approvedChapterMapping} from './resource-eligibility';
export function resourceQueryOptions(params:URLSearchParams){
 for(const k of params.keys())if(!['view','topicId'].includes(k))throw new Error('Use your saved profile for recommendations.');
 const view=params.get('view')||'personalized',topicId=params.get('topicId')||undefined;
 if(!['personalized','mine','review'].includes(view)||topicId&&(!/^[A-Za-z0-9_-]{1,100}$/.test(topicId)))throw new Error('Invalid resource filter.');
 return {view,topicId};
}
export async function resourcesForStudent(d:Db,userId:string,isEditor:boolean,options:{view?:string;topicId?:string}={}){
 const profile=await d.collection<Profile & Document>('profiles').findOne({userId}),missing=resourceProfile(profile).missing;
 const administrative=options.view==='review'||options.view==='mine';
 if(options.view==='review'&&!isEditor)throw new Error('Only verified editors can read the review queue.');
 const query=options.view==='mine'?{userId}:options.view==='review'?{}:{status:'published',active:true,audience:{$exists:true},$or:[{audienceReviewedAt:{$exists:true}},{publicationBasis:'operator_requested_no_review',audienceApprovedAt:{$exists:true}}]};
 const rows=(!administrative&&missing.length)?[]:await d.collection<AcademicResource & Document>('resources').find(query).sort({createdAt:-1}).limit(2000).toArray();
 const chapters=administrative||missing.length?[]:(await d.collection<Document>('curriculum_chapters').find({board:resourceProfile(profile).board.toUpperCase(),classLevel:Number(resourceProfile(profile).className.replace('Class ',''))}).limit(300).toArray()).flatMap(c=>{const p=chapterSchema.strip().safeParse(c);return p.success?[p.data]:[];}).filter(c=>chapterMatchesProfile(c,profile)).sort((a,b)=>a.chapterOrder-b.chapterOrder);
 const uniqueChapters=[...new Map(chapters.filter(c=>!options.topicId||c.chapterId===options.topicId).map(c=>[`${c.chapterId}|${c.textbookTitle}|${c.textbookEdition}|${c.academicSession}`,c])).values()];
 const resources=rows.filter(r=>administrative||resourceEligible(r,profile,options.topicId)).map(r=>({
  ...(r.directory?{directory:r.directory}:{}),_id:r._id,title:r.title,description:r.description,url:r.url,stage:r.stage,stream:r.stream,minutes:r.minutes,status:r.status,owned:r.userId===userId,
  ...((r.videoMetadata||r.researchSources?.[0])?{video:{youtubeId:r.videoMetadata?.youtubeId||r.researchSources?.[0]?.youtubeId,channelName:r.videoMetadata?.channelName||r.researchSources?.[0]?.channelName,channelUrl:r.videoMetadata?.channelUrl??r.researchSources?.[0]?.channelUrl??null,durationMinutes:r.videoMetadata?.durationMinutes??r.researchSources?.[0]?.durationMinutes??null,language:r.videoMetadata?.language||r.researchSources?.[0]?.instructionalLanguage||'unverified',reviewDepth:r.researchSources?.[0]?.reviewDepth||'metadata_only',publicationBasis:r.publicationBasis,reviewLimitations:r.researchSources?.[0]?.reviewLimitations||r.description}}:{}),
  ...(r.chapterMappings?{chapterMappings:administrative?r.chapterMappings:r.chapterMappings.filter(m=>approvedChapterMapping(m,r.approvedChapterVersions||[],profile,options.topicId)),...(administrative?{approvedChapterVersions:r.approvedChapterVersions||[]}: {})}:{}),
  ...(administrative?{classificationRequired:!resourceAudienceSchema.safeParse(r.audience).success||(!r.audienceReviewedAt&&!(r.publicationBasis==='operator_requested_no_review'&&r.audienceApprovedAt))||r.active!==true||!!r.chapterMappings?.some(m=>!r.approvedChapterVersions?.includes(m.version))}:{}),
 }));
 return {resources,chapters:uniqueChapters,missingFields:administrative?[]:missing,profileIncomplete:!administrative&&missing.length>0};
}
