import {identity,body,json,failure,objectId,HttpError,throttle} from '@/lib/api';
import {db} from '@/lib/db';import {statusSchema} from '@/lib/validation';
type Context={params:Promise<{id:string}>};
export async function PATCH(req:Request,c:Context){try{const u=await identity(req);await throttle(u.id,'tasks');const p=await body(req,statusSchema);const d=await db();const result=await d.collection('tasks').updateOne({_id:objectId((await c.params).id),userId:u.id},{$set:{...p,updatedAt:new Date()}});if(!result.matchedCount)throw new HttpError(404,'Task not found.');return json({ok:true});}catch(e){return failure(e);}}
export async function DELETE(req:Request,c:Context){try{const u=await identity(req);const d=await db();const r=await d.collection('tasks').deleteOne({_id:objectId((await c.params).id),userId:u.id});if(!r.deletedCount)throw new HttpError(404,'Task not found.');return json({ok:true});}catch(e){return failure(e);}}
