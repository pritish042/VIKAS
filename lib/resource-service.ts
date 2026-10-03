import type {Db,Document} from 'mongodb';
import type {Profile} from './types';
import {type AcademicResource,resourceEligible,resourceProfile,resourceAudienceSchema} from './resource-eligibility';
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
 const query=options.view==='mine'?{userId}:options.view==='review'?{}:{status:'published',active:true,audience:{$exists:true},audienceReviewedAt:{$exists:true}};
 const rows=(!administrative&&missing.length)?[]:await d.collection<AcademicResource & Document>('resources').find(query).sort({createdAt:-1}).limit(300).toArray();
 const resources=rows.filter(r=>administrative||resourceEligible(r,profile,options.topicId)).map(r=>({
  _id:r._id,title:r.title,description:r.description,url:r.url,stage:r.stage,stream:r.stream,minutes:r.minutes,status:r.status,owned:r.userId===userId,
  ...(administrative?{classificationRequired:!resourceAudienceSchema.safeParse(r.audience).success||!r.audienceReviewedAt||r.active!==true}:{}),
 }));
 return {resources,missingFields:administrative?[]:missing,profileIncomplete:!administrative&&missing.length>0};
}
