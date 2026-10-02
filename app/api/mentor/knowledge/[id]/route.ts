import {identity,body,json,objectId,editor,throttle} from '@/lib/api';
import {db} from '@/lib/db';
import {reviewInput} from '@/lib/mentor-contract';
import {requireReviewer,reviewKnowledge} from '@/lib/mentor-knowledge';
import {mentorFailure} from '@/lib/mentor-api';
export async function PATCH(req:Request,c:{params:Promise<{id:string}>}){try{const u=await identity(req);requireReviewer(editor(u));await throttle(u.id,'mentor-review',10);const p=await body(req,reviewInput);return json(await reviewKnowledge(await db(),editor(u),u.id,objectId((await c.params).id),p.decision,p.version));}catch(e){return mentorFailure(e);}}
