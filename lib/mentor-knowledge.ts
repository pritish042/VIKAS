import {createHash} from 'node:crypto';
import {ObjectId,type Db,type Document} from 'mongodb';
import {knowledgeInput,passageSchema,retrievalSchema,type KnowledgeInput,type StudentContext} from './mentor-contract';
import {type AcademicResource,resourceEligible} from './resource-eligibility';
import {applicableKnowledge,searchTerms} from './mentor-rules';
import {matchesProfile,safeExternalUrl} from './topic-rules';
import type {Profile} from './types';
import {stageSchema} from './validation';
export class MentorError extends Error {constructor(public status:number,message:string){super(message);}}
export interface KnowledgeDoc extends KnowledgeInput,Document {_id:ObjectId;version:string;status:'draft'|'approved'|'withdrawn';createdBy:string;createdAt:Date;reviewedAt?:Date;reviewedBy?:string}
export function requireReviewer(reviewer:boolean){if(!reviewer)throw new MentorError(403,'Only a verified content editor can manage DISHA knowledge.');}
export async function submitKnowledge(d:Db,reviewer:boolean,userId:string,value:unknown){
 requireReviewer(reviewer);const content=knowledgeInput.parse(value);const version=createHash('sha256').update(JSON.stringify(content)).digest('hex');
 const _id=new ObjectId(version.slice(0,24));await d.collection<KnowledgeDoc>('mentor_knowledge').updateOne({_id},{$setOnInsert:{...content,version,status:'draft',createdBy:userId,createdAt:new Date()}},{upsert:true});return {id:_id,version};
}
export async function reviewKnowledge(d:Db,reviewer:boolean,userId:string,id:ObjectId,decision:'approve'|'withdraw',version:string){
 requireReviewer(reviewer);const docs=d.collection<KnowledgeDoc>('mentor_knowledge');const record=await docs.findOne({_id:id,version});if(!record)throw new MentorError(404,'Knowledge version not found.');
 // Content is immutable. Corrections are submitted as a new draft version.
 const now=new Date();
 if(decision==='approve'){
  const {topicId,title,subject,stage,language,boardMode,boards,sourceUrl}=knowledgeInput.parse(Object.fromEntries(Object.keys(knowledgeInput.shape).map(k=>[k,record[k]])));
  for(const [index,section] of record.sections.entries()){
   const _id=new ObjectId(createHash('sha256').update(`${id}:${version}:${index}`).digest('hex').slice(0,24));
   await d.collection('mentor_chunks').updateOne({_id},{$set:{knowledgeRef:id,topicId,title,subject,stage,language,boardMode,boards,sourceUrl,version,heading:section.heading,text:section.text,status:'approved',reviewedAt:now}},{upsert:true});
  }
 }
 await docs.updateOne({_id:id,version},{$set:{status:decision==='approve'?'approved':'withdrawn',reviewedAt:now,reviewedBy:userId}});
 if(decision==='withdraw')await d.collection('mentor_chunks').updateMany({knowledgeRef:id},{$set:{status:'withdrawn'}});
 return {ok:true};
}
export async function approvedTopics(d:Db,context:{stage:string;board:string},language:string){
 const stage=stageSchema.safeParse(context.stage);if(!stage.success)return [];
 const docs=await d.collection<KnowledgeDoc>('mentor_knowledge').find({status:'approved',stage:stage.data,language,reviewedAt:{$exists:true},reviewedBy:{$exists:true}},{maxTimeMS:2000}).sort({reviewedAt:-1,_id:-1}).limit(100).toArray();
 return docs.filter(v=>applicableKnowledge(v,context,language));
}
export interface KnowledgeRetriever {retrieve(query:{topicIds:string[];query:string;language:string},context:StudentContext,profile:Partial<Profile>|null):Promise<ReturnType<typeof retrievalSchema.parse>>}
export function mongoKnowledgeRetriever(d:Db):KnowledgeRetriever{return {async retrieve(input,context,profile){
 const terms=searchTerms(input.query);let notice='';let chunks:Document[]=[];
 if(terms&&input.topicIds.length){try{
  chunks=await d.collection('mentor_chunks').find({status:'approved',topicId:{$in:input.topicIds},stage:context.stage,language:input.language,$or:[{boardMode:'general'},{boardMode:'specific',boards:context.board||'__missing_board__'}],$text:{$search:terms,$language:'none'}},{projection:{score:{$meta:'textScore'}},maxTimeMS:2000}).sort({score:{$meta:'textScore'}}).limit(8).toArray();
 }catch{notice='Knowledge search is temporarily unavailable. No lesson content was retrieved.';}}
 const passages=[];
 // Re-check parents so withdrawn material is never returned from stale chunks.
 for(const c of chunks){
  const parent=await d.collection<KnowledgeDoc>('mentor_knowledge').findOne({_id:c.knowledgeRef,status:'approved',version:c.version,reviewedBy:{$exists:true}},{maxTimeMS:1000});
  if(!parent?.reviewedAt||!applicableKnowledge(parent,context,input.language))continue;
  const p=passageSchema.safeParse({id:c._id.toString(),knowledgeRef:parent._id.toHexString(),title:parent.title,heading:c.heading,text:c.text,sourceUrl:parent.sourceUrl,version:parent.version,reviewedAt:parent.reviewedAt.toISOString(),topicId:parent.topicId});
  if(p.success)passages.push(p.data);if(passages.length===4)break;
 }
 const rows=await d.collection<AcademicResource & Document>('resources').find({status:'published',reviewedAt:{$exists:true},reviewedBy:{$exists:true},'catalogue.topic.id':{$in:input.topicIds}},{maxTimeMS:2000}).limit(30).toArray();
 const resources=rows.filter(r=>r.catalogue?.topic&&resourceEligible(r,profile,r.catalogue.topic.id)&&matchesProfile(profile,r.catalogue.topic.applicability)&&r.catalogue.topic.languages.includes(input.language)&&safeExternalUrl.safeParse(r.url).success).slice(0,3).map(r=>({id:r._id.toString(),title:String(r.title).slice(0,150),url:r.url,topicId:r.catalogue.topic.id}));
 return retrievalSchema.parse({passages,resources,notice});
}};}
