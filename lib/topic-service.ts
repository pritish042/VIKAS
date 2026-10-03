// Called only by authenticated route handlers. Injecting Db also permits isolated DB tests.
import {ObjectId,type Db,type Document} from 'mongodb';
import {assess,matchesProfile,publicQuestions,recommend,type Question,type TopicConfig,type CatalogueResource} from './topic-rules';
import {goalRef} from './progress';
import type {Profile} from './types';
import type {ConceptResult,Recommendation,ResourceFeeling} from './topic-types';
import {resourceEligible} from './resource-eligibility';
export class TopicError extends Error {constructor(public status:number,message:string){super(message);}}
export interface Definition extends Document {_id:ObjectId;topic:TopicConfig;version:string;status:string;questions:Question[];createdAt:Date}
export interface Attempt extends Document {
 _id:ObjectId;userId:string;topicId:string;topicTitle:string;assessmentId:string|null;version:string|null;skipped:boolean;
 results:ConceptResult[];recommendations:Recommendation[];language:string;minutes:number;createdAt:Date;updatedAt:Date;
 acceptance?:{resourceId:string;taskRef:string;goalRef:string;goalTitle:string;createdAt:Date;materialized?:boolean};
 feedback?:{feeling:ResourceFeeling;createdAt:Date};
}
export const ownedAttempt=(userId:string,_id:ObjectId)=>({userId,_id});
async function profileFor(d:Db,userId:string){return d.collection<Profile & Document>('profiles').findOne({userId});}
async function resourcesFor(d:Db){return d.collection<CatalogueResource & Document>('resources').find({status:'published',catalogue:{$exists:true}}).limit(300).toArray();}
export async function listTopics(d:Db,userId:string){
 const profile=await profileFor(d,userId),resources=await resourcesFor(d);
 const definitions=await d.collection<Definition>('topic_assessments').find({status:'active'}).sort({createdAt:-1,_id:-1}).limit(300).toArray();
 const topics=new Map<string,{id:string;subject:string;title:string;languages:string[];assessmentId:string|null}>();
 for(const r of resources){const t=r.catalogue.topic;if(!resourceEligible(r,profile,t.id)||!matchesProfile(profile,t.applicability))continue;
  const existing=topics.get(t.id),definition=definitions.find(a=>a.topic.id===t.id&&matchesProfile(profile,a.topic.applicability));
  topics.set(t.id,{id:t.id,subject:t.subject,title:t.title,languages:[...new Set([...(existing?.languages||[]),...t.languages])],assessmentId:definition?definition._id.toHexString():null});
 }
 return [...topics.values()];
}
export async function getCheck(d:Db,userId:string,id:ObjectId){
 const definition=await d.collection<Definition>('topic_assessments').findOne({_id:id,status:'active'});
 if(!definition||!matchesProfile(await profileFor(d,userId),definition.topic.applicability))throw new TopicError(404,'No topic check is available for these profile details.');
 if(!(await listTopics(d,userId)).some(t=>t.id===definition.topic.id))throw new TopicError(404,'This topic is no longer available.');
 return {id:definition._id,version:definition.version,title:definition.topic.title,language:'English',questions:publicQuestions(definition.questions)};
}
export function publicAttempt(a:Attempt){
 return {_id:a._id,topicId:a.topicId,topicTitle:a.topicTitle,assessmentId:a.assessmentId,version:a.version,skipped:a.skipped,results:a.results,recommendations:a.recommendations,createdAt:a.createdAt,
  ...(a.acceptance?{acceptance:{resourceId:a.acceptance.resourceId,taskRef:a.acceptance.taskRef,goalTitle:a.acceptance.goalTitle}}:{}),...(a.feedback?{feedback:a.feedback}:{})};
}
export async function listAttempts(d:Db,userId:string){
 const profile=await profileFor(d,userId),published=new Set((await resourcesFor(d)).filter(r=>resourceEligible(r,profile,r.catalogue.topic.id)).map(r=>r._id.toString()));
 return (await d.collection<Attempt>('topic_attempts').find({userId}).sort({createdAt:-1}).limit(20).toArray()).map(a=>publicAttempt({...a,recommendations:a.recommendations.filter(r=>published.has(r.resourceId))}));
}
export async function createAttempt(d:Db,userId:string,input:{topicId:string;skipped:boolean;assessmentId?:string;answers?:{questionId:string;answer:string}[];language:string;minutes:number}){
 const profile=await profileFor(d,userId),topics=await listTopics(d,userId),topic=topics.find(t=>t.id===input.topicId);
 if(!topic)throw new TopicError(404,'No resources are available for this topic and your saved profile.');
 if(!topic.languages.includes(input.language))throw new TopicError(400,'Choose an available resource language.');
 let definition:Definition|null=null;let results:ConceptResult[]=[];
 if(!input.skipped){
  definition=await d.collection<Definition>('topic_assessments').findOne({_id:new ObjectId(input.assessmentId),status:'active','topic.id':topic.id});
  if(!definition||!matchesProfile(profile,definition.topic.applicability))throw new TopicError(404,'This topic-check version is not available.');
  try{results=assess(definition.questions,input.answers||[]);}catch{throw new TopicError(400,'Answer each question in this version once, or choose Not sure.');}
 }
 const last=await d.collection<Attempt>('topic_attempts').findOne({userId,topicId:topic.id,feedback:{$exists:true}},{sort:{'feedback.createdAt':-1}});
 const recommendations=recommend(await resourcesFor(d),profile,topic.id,results,input.language,input.minutes,last?.feedback?.feeling);
 const now=new Date();const attempt:Attempt={_id:new ObjectId(),userId,topicId:topic.id,topicTitle:topic.title,assessmentId:definition?definition._id.toHexString():null,version:definition?.version||null,skipped:input.skipped,results,recommendations,language:input.language,minutes:input.minutes,createdAt:now,updatedAt:now,
  // Immutable snapshot is server-only. Later imports cannot change historical interpretations.
  definition:definition?{version:definition.version,questions:definition.questions}:null,answers:input.skipped?[]:input.answers};
 await d.collection<Attempt>('topic_attempts').insertOne(attempt);return publicAttempt(attempt);
}
export async function acceptResource(d:Db,userId:string,id:ObjectId,resourceId:string){
 const collection=d.collection<Attempt>('topic_attempts');const query=ownedAttempt(userId,id);
 let attempt=await collection.findOne(query);if(!attempt)throw new TopicError(404,'Topic check not found.');
 const suggestion=attempt.recommendations.find(r=>r.resourceId===resourceId);if(!suggestion)throw new TopicError(400,'Choose a suggested resource.');
 if(!attempt.acceptance){
  const profile=await profileFor(d,userId);if(!profile?.goal?.trim())throw new TopicError(400,'Save a personal goal in your profile first.');
  const resource=await d.collection<CatalogueResource & Document>('resources').findOne({_id:new ObjectId(resourceId),status:'published'});
  if(!resource?.catalogue||!resourceEligible(resource,profile,attempt.topicId)||!matchesProfile(profile,resource.catalogue.topic.applicability))throw new TopicError(409,'This resource no longer matches your saved profile or is unavailable.');
  if(await d.collection('tasks').countDocuments({userId})>=200)throw new TopicError(400,'Remove an old task before adding another.');
  const now=new Date();
  const acceptance={resourceId,taskRef:new ObjectId().toHexString(),goalRef:goalRef(userId,profile.goal),goalTitle:profile.goal,createdAt:now};
  await collection.updateOne({...query,acceptance:{$exists:false}},{$set:{acceptance,updatedAt:now}});
  attempt=await collection.findOne(query);
 }
 const accepted=attempt?.acceptance;
 if(!accepted||accepted.resourceId!==resourceId)throw new TopicError(409,'Another resource was already chosen for this check.');
 if(!accepted.materialized){
  // A single stored task ID makes double-clicks and interrupted-request retries idempotent.
  try{
   await d.collection('tasks').updateOne({userId,_id:new ObjectId(accepted.taskRef)},{$setOnInsert:{userId,title:`Study: ${suggestion.title}`.slice(0,150),notes:suggestion.approach,minutes:suggestion.minutes,status:'todo',goalRef:accepted.goalRef,goalTitle:accepted.goalTitle,topicAttemptRef:id.toHexString(),resourceRef:resourceId,resourceUrl:suggestion.url,createdAt:accepted.createdAt,updatedAt:accepted.createdAt}},{upsert:true});
  }catch(e){
   if((e as {code?:number}).code!==11000||!await d.collection('tasks').findOne({userId,_id:new ObjectId(accepted.taskRef),topicAttemptRef:id.toHexString()}))throw e;
  }
  await collection.updateOne(query,{$set:{'acceptance.materialized':true,updatedAt:new Date()}});
 }
 return {taskRef:accepted.taskRef};
}
export async function saveResourceFeedback(d:Db,userId:string,id:ObjectId,feeling:ResourceFeeling){
 const now=new Date();const result=await d.collection<Attempt>('topic_attempts').updateOne({...ownedAttempt(userId,id),acceptance:{$exists:true}},{$set:{feedback:{feeling,createdAt:now},updatedAt:now}});
 if(!result.matchedCount)throw new TopicError(404,'Choose a resource from this check before giving feedback.');
 return {ok:true};
}
