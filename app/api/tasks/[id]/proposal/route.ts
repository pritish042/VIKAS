import {ObjectId} from 'mongodb';
import {identity,body,json,failure,objectId,HttpError,throttle} from '@/lib/api';
import {db} from '@/lib/db';
import {proposalDecisionSchema} from '@/lib/validation';
import {ownedTaskQuery,resolveProposal} from '@/lib/progress';
type Context={params:Promise<{id:string}>};

export async function PATCH(req:Request,c:Context){try{
 const u=await identity(req);await throttle(u.id,'proposals');const decision=await body(req,proposalDecisionSchema);
 const d=await db();const _id=objectId((await c.params).id);
 const task=await d.collection('tasks').findOne(ownedTaskQuery(u.id,_id),{projection:{feedback:1,goalRef:1,goalTitle:1}});
 if(!task)throw new HttpError(404,'Step not found.');
 const proposal=task.feedback?.proposal;
 if(proposal?.status==='accepted'&&decision.decision!=='reject'&&proposal.acceptedStep){
  const {taskRef,...step}=proposal.acceptedStep;const createdAt=proposal.updatedAt||new Date();await d.collection('tasks').updateOne(ownedTaskQuery(u.id,objectId(taskRef)),{$setOnInsert:{...step,userId:u.id,status:'todo',goalRef:task.goalRef,goalTitle:task.goalTitle,sourceTaskRef:_id.toHexString(),createdAt,updatedAt:createdAt}},{upsert:true});
  return json({ok:true,taskRef});
 }
 if(!proposal||proposal.status!=='pending')throw new HttpError(409,'This proposal has already been reviewed. Refresh your plan.');
 const now=new Date();
 if(decision.decision==='reject'){
  const result=await d.collection('tasks').updateOne({...ownedTaskQuery(u.id,_id),'feedback.proposal.status':'pending'},{$set:{'feedback.proposal.status':'rejected','feedback.proposal.updatedAt':now,'feedback.updatedAt':now,updatedAt:now}});
  if(!result.matchedCount)throw new HttpError(409,'This proposal changed. Refresh your plan.');
  return json({ok:true});
 }
 if(await d.collection('tasks').countDocuments({userId:u.id})>=200)throw new HttpError(400,'Your plan has reached 200 tasks. Remove old tasks first.');
 const acceptedId=new ObjectId();const resolved=resolveProposal({title:String(proposal.title),notes:String(proposal.notes),minutes:Number(proposal.minutes)},decision,acceptedId.toHexString());
 if(!resolved.acceptedStep)throw new HttpError(400,'Choose a step to accept.');
 const acceptedStep=resolved.acceptedStep;const {taskRef,...step}=acceptedStep;
 const result=await d.collection('tasks').updateOne({...ownedTaskQuery(u.id,_id),'feedback.proposal.status':'pending'},{$set:{'feedback.proposal.status':'accepted','feedback.proposal.acceptedStep':acceptedStep,'feedback.proposal.updatedAt':now,'feedback.updatedAt':now,updatedAt:now}});
 if(!result.matchedCount)throw new HttpError(409,'This proposal changed. Refresh your plan.');
 await d.collection('tasks').updateOne(ownedTaskQuery(u.id,acceptedId),{$setOnInsert:{...step,userId:u.id,status:'todo',goalRef:task.goalRef,goalTitle:task.goalTitle,sourceTaskRef:_id.toHexString(),createdAt:now,updatedAt:now}},{upsert:true});
 return json({ok:true,taskRef:acceptedStep.taskRef});
}catch(e){return failure(e);}}
