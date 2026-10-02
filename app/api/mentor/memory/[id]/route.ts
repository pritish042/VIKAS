import {identity,body,json,objectId,throttle} from '@/lib/api';
import {db} from '@/lib/db';
import {memoryEdit} from '@/lib/mentor-contract';
import {editMentorMemory,forgetMentorMemory} from '@/lib/mentor-actions';
import {mentorFailure} from '@/lib/mentor-api';
type Context={params:Promise<{id:string}>};
export async function PATCH(req:Request,c:Context){try{const u=await identity(req);await throttle(u.id,'mentor-memory',15);return json(await editMentorMemory(await db(),u.id,objectId((await c.params).id),await body(req,memoryEdit)));}catch(e){return mentorFailure(e);}}
export async function DELETE(req:Request,c:Context){try{const u=await identity(req);return json(await forgetMentorMemory(await db(),u.id,objectId((await c.params).id)));}catch(e){return mentorFailure(e);}}
