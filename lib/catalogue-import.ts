import {createHash} from 'node:crypto';
import {ObjectId,type Db} from 'mongodb';
import {z} from 'zod';
import {questionSchema,safeExternalUrl,topicConfigSchema} from './topic-rules';
const value=z.string().trim().min(1).max(2000);
const rawResource=z.object({resource_id:value,title:value,provider_author:value,direct_url:safeExternalUrl,resource_type:value,educational_pathway:value,class_year_suitability:value,board_curriculum_relevance:value,subject_topic:value,language:value,prerequisites:value,topic_difficulty:z.literal('introductory'),learning_objective:value,duration_effort:value,free_access_registration:value,why_suitable:value,limitations:value,date_checked:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),evidence_url:safeExternalUrl,review_status:z.literal('candidate_pending_human_review')}).strict();
const rawQuestion=z.object({q_id:value,question:value,answer:value,explanation:value,maps_to:value}).strict();
const inputSchema=z.object({catalogue:z.object({catalogue_version:value,date_checked:value,resources:z.array(rawResource).min(1).max(100)}).strict(),checks:z.object({diagnostic_questions:z.record(z.string(),z.array(rawQuestion).min(1).max(20)),routing_suggestions_cautious:z.record(z.string(),value)}).strict()}).strict();
export const stableId=(key:string)=>new ObjectId(createHash('sha256').update(key).digest('hex').slice(0,24));
export function prepareCatalogue(input:unknown,routing:unknown) {
 const source=inputSchema.parse(input),topics=z.array(topicConfigSchema).min(1).max(100).parse(routing);
 if(new Set(source.catalogue.resources.map(r=>r.resource_id)).size!==source.catalogue.resources.length||new Set(topics.map(t=>t.id)).size!==topics.length)throw new Error('Duplicate catalogue identifiers.');
 return topics.map(topic=>{
  const raw=source.catalogue.resources.find(r=>r.resource_id===topic.resourceId),drafts=source.checks.diagnostic_questions[topic.id];
  if(!raw||!drafts||topic.excludedQuestionIds.some(id=>!drafts.some(q=>q.q_id===id)))throw new Error('Missing source resource or questions.');
  const allQuestions=drafts.map(q=>{
   const options=[...q.question.matchAll(/\(([a-e])\)\s*([\s\S]*?)(?=\s*\([a-e]\)|$)/g)].map(m=>({id:m[1],label:m[2].trim()}));
   return questionSchema.parse({id:q.q_id,prompt:q.question.split('(a)')[0].trim(),options,answer:q.answer.match(/^\(([a-d])\)/)?.[1],explanation:q.explanation,objective:q.maps_to.replace(/^(Prerequisite|Learning objective):\s*/,''),prerequisite:q.maps_to.startsWith('Prerequisite:')});
  });
  if(new Set(allQuestions.map(q=>q.id)).size!==allQuestions.length)throw new Error('Duplicate questions.');
  const questions=allQuestions.filter(q=>!topic.excludedQuestionIds.includes(q.id));
  if(!questions.length)throw new Error('Topic has no usable questions.');
  const version=createHash('sha256').update(JSON.stringify({topic,questions,raw})).digest('hex');
  return {
   resource:{_id:stableId(`resource:${source.catalogue.catalogue_version}:${raw.resource_id}`),title:raw.title,description:raw.learning_objective,url:raw.direct_url,stage:topic.applicability.stage,stream:topic.subject,minutes:0,status:'published',catalogue:{sourceId:raw.resource_id,sourceVersion:source.catalogue.catalogue_version,topic,provider:raw.provider_author,effort:raw.duration_effort,access:raw.free_access_registration,prerequisites:raw.prerequisites,limitations:`${raw.limitations}. Curriculum relevance: ${raw.board_curriculum_relevance}. Access and duration come from supplied research and have not been independently verified.`,objectives:questions.map(q=>q.objective),prerequisiteObjectives:questions.filter(q=>q.prerequisite).map(q=>q.objective),source:raw,publicationBasis:'operator_requested_no_review'}},
   assessment:{_id:stableId(`assessment:${topic.id}:${version}`),topic,version,status:'active',questions,checkLanguage:'English',publicationBasis:'operator_requested_no_review',validated:false},
  };
 });
}
export async function importCatalogue(d:Db,batch:ReturnType<typeof prepareCatalogue>) {
 await d.collection('resources').createIndex({'catalogue.sourceId':1},{unique:true,partialFilterExpression:{'catalogue.sourceId':{$type:'string'}}});
 await d.collection('topic_assessments').createIndex({version:1},{unique:true});
 let resources=0,assessments=0;
 for(const entry of batch){
  const now=new Date();
  // Link an exact existing title + URL; never silently publish or rewrite a submission.
  const existing=await d.collection('resources').findOne({title:entry.resource.title,url:entry.resource.url});
  if(existing&&!existing.catalogue){
   await d.collection('resources').updateOne({_id:existing._id,catalogue:{$exists:false}},{$set:{catalogue:entry.resource.catalogue,updatedAt:now}});
  }else{
   const { _id,...fields}=entry.resource;
   const {catalogue,...initial}=fields;
   const r=await d.collection('resources').updateOne({'catalogue.sourceId':entry.resource.catalogue.sourceId},{$set:{catalogue},$setOnInsert:{_id,...initial,createdAt:now,updatedAt:now}},{upsert:true});resources+=r.upsertedCount;
  }
  const { _id,...definition}=entry.assessment;
  const a=await d.collection('topic_assessments').updateOne({_id},{$setOnInsert:{...definition,createdAt:now,updatedAt:now}},{upsert:true});assessments+=a.upsertedCount;
 }
 return {resourcesInserted:resources,assessmentVersionsInserted:assessments};
}
