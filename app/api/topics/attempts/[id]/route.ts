import {identity,json,body,objectId,throttle} from '@/lib/api';
import {db} from '@/lib/db';
import {acceptResource,saveResourceFeedback} from '@/lib/topic-service';
import {acceptanceInput,resourceFeedbackInput} from '@/lib/topic-rules';
import {topicFailure} from '@/lib/topic-api';
type Context={params:Promise<{id:string}>};
export async function POST(req:Request,c:Context){try{const u=await identity(req);await throttle(u.id,'resource-accept');const p=await body(req,acceptanceInput);return json(await acceptResource(await db(),u.id,objectId((await c.params).id),p.resourceId));}catch(e){return topicFailure(e);}}
export async function PATCH(req:Request,c:Context){try{const u=await identity(req);await throttle(u.id,'resource-feedback');const p=await body(req,resourceFeedbackInput);return json(await saveResourceFeedback(await db(),u.id,objectId((await c.params).id),p.feeling));}catch(e){return topicFailure(e);}}
