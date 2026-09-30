import {identity,body,json,failure,objectId,HttpError,throttle} from '@/lib/api';
import {db} from '@/lib/db';
import {feedbackSchema} from '@/lib/validation';
import {goalRef,ownedTaskQuery,proposeStep} from '@/lib/progress';
type Context={params:Promise<{id:string}>};

export async function POST(req:Request,c:Context){try{
 const u=await identity(req);await throttle(u.id,'feedback');const input=await body(req,feedbackSchema);
 const d=await db();const _id=objectId((await c.params).id);
 const task=await d.collection('tasks').findOne(ownedTaskQuery(u.id,_id),{projection:{title:1,minutes:1,status:1,goalRef:1,goalTitle:1,feedback:1}});
 if(!task)throw new HttpError(404,'Step not found.');
 if(task.status!=='todo'||task.feedback)throw new HttpError(409,'This step already has feedback. Refresh your plan.');
 const profile=await d.collection<{userId:string;goal?:string}>('profiles').findOne({userId:u.id},{projection:{goal:1}});
 const currentGoal=profile?.goal?.trim()||'';
 const goal=typeof task.goalTitle==='string'&&task.goalTitle.trim()?task.goalTitle.trim():currentGoal;
 if(!goal)throw new HttpError(400,'Set a personal goal before reviewing this step.');
 const ref=typeof task.goalRef==='string'&&task.goalRef?task.goalRef:goalRef(u.id,goal);
 const now=new Date();const feedback={taskRef:_id.toHexString(),goalRef:ref,goalTitle:goal,...input,createdAt:now,updatedAt:now,proposal:{...proposeStep({title:String(task.title),minutes:Number(task.minutes)},goal,input),updatedAt:now}};
 const status=input.outcome==='completed'?'done':input.outcome==='need_help'?'needs_help':'irrelevant';
 const result=await d.collection('tasks').updateOne({...ownedTaskQuery(u.id,_id),status:'todo',feedback:{$exists:false}},{$set:{status,goalRef:ref,goalTitle:goal,feedback,updatedAt:now}});
 if(!result.matchedCount)throw new HttpError(409,'This step changed. Refresh your plan.');
 return json({feedback});
}catch(e){return failure(e);}}
