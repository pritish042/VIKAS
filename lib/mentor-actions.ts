import {ObjectId,type Db} from 'mongodb';
import {memoryInput,memoryEdit} from './mentor-contract';
import {proposalDecisionSchema} from './validation';
import {MentorError} from './mentor-knowledge';
import {goalRef,resolveProposal} from './progress';
export async function saveMentorMemory(d:Db,userId:string,value:unknown){
 const p=memoryInput.parse(value);
 if(p.messageRef&&!await d.collection('messages').findOne({_id:new ObjectId(p.messageRef),userId,role:'assistant','mentor.memorySuggestion.topicId':p.topicId}))throw new MentorError(404,'Memory suggestion not found.');
 if(await d.collection('mentor_memories').countDocuments({userId})>=50)throw new MentorError(400,'Forget an old memory before adding another.');
 const now=new Date(),match=p.messageRef?{userId,sourceRef:p.messageRef}:{userId,topicId:p.topicId,text:p.text};
 const result=await d.collection('mentor_memories').findOneAndUpdate(match,{$setOnInsert:{userId,topicId:p.topicId,text:p.text,source:p.messageRef?'student_confirmed_conversation':'student_entered',sourceRef:p.messageRef||'student',createdAt:now,updatedAt:now}},{upsert:true,returnDocument:'after'});
 return {memory:{_id:result!._id,topicId:result!.topicId,text:result!.text,source:result!.source,updatedAt:result!.updatedAt}};
}
export async function editMentorMemory(d:Db,userId:string,id:ObjectId,value:unknown){const p=memoryEdit.parse(value);const r=await d.collection('mentor_memories').updateOne({_id:id,userId},{$set:{text:p.text,source:'student_edited',updatedAt:new Date()}});if(!r.matchedCount)throw new MentorError(404,'Memory not found.');return {ok:true};}
export async function forgetMentorMemory(d:Db,userId:string,id:ObjectId){const r=await d.collection('mentor_memories').deleteOne({_id:id,userId});if(!r.deletedCount)throw new MentorError(404,'Memory not found.');return {ok:true};}
export async function decideMentorProposal(d:Db,userId:string,id:ObjectId,value:unknown){
 const decision=proposalDecisionSchema.parse(value),messages=d.collection('messages'),query={_id:id,userId,role:'assistant'};
 let message=await messages.findOne(query);if(!message?.mentor?.proposal)throw new MentorError(404,'Suggestion not found.');
 if(message.mentor.proposal.status==='pending'){
  if(decision.decision==='reject'){const r=await messages.updateOne({...query,'mentor.proposal.status':'pending'},{$set:{'mentor.proposal.status':'rejected',updatedAt:new Date()}});if(!r.matchedCount)throw new MentorError(409,'This suggestion changed. Refresh DISHA.');return {ok:true};}
  const profile=await d.collection('profiles').findOne({userId},{projection:{goal:1}});
  if(!profile?.goal?.trim())throw new MentorError(400,'Save a goal in your profile before accepting a step.');
  if(await d.collection('tasks').countDocuments({userId})>=200)throw new MentorError(400,'Remove an old task before adding another.');
  const resolved=resolveProposal(message.mentor.proposal,decision,new ObjectId().toHexString());if(!resolved.acceptedStep)throw new MentorError(400,'Choose a step.');
  await messages.updateOne({...query,'mentor.proposal.status':'pending'},{$set:{'mentor.proposal.status':'accepted','mentor.proposal.taskRef':resolved.acceptedStep.taskRef,'mentor.proposal.title':resolved.acceptedStep.title,'mentor.proposal.notes':resolved.acceptedStep.notes,'mentor.proposal.minutes':resolved.acceptedStep.minutes,acceptance:{...resolved.acceptedStep,goalRef:goalRef(userId,profile.goal),goalTitle:profile.goal,createdAt:new Date()},updatedAt:new Date()}});
  message=await messages.findOne(query);
 }
 if(message?.mentor?.proposal.status!=='accepted'||decision.decision==='reject')throw new MentorError(409,'This suggestion has already been decided.');
 const step=message.acceptance;
 if(!step?.materialized){
  try{await d.collection('tasks').updateOne({_id:new ObjectId(step.taskRef),userId},{$setOnInsert:{userId,title:step.title,notes:step.notes,minutes:step.minutes,status:'todo',goalRef:step.goalRef,goalTitle:step.goalTitle,topicId:message.mentor.proposal.topicId||'',mentorMessageRef:id.toHexString(),createdAt:step.createdAt,updatedAt:step.createdAt}},{upsert:true});}
  catch(e){if((e as {code?:number}).code!==11000||!await d.collection('tasks').findOne({_id:new ObjectId(step.taskRef),userId,mentorMessageRef:id.toHexString()}))throw e;}
  await messages.updateOne(query,{$set:{'acceptance.materialized':true}});
 }
 return {ok:true,taskRef:step.taskRef};
}
