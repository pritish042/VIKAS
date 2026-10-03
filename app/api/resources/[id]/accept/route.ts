import {z} from 'zod';
import {identity,body,json,failure,objectId,throttle,HttpError} from '@/lib/api';
import {db} from '@/lib/db';
import {acceptChapterResource} from '@/lib/resource-acceptance';
import {TopicError} from '@/lib/topic-service';
const input=z.object({minutes:z.number().int().min(5).max(120)}).strict();
export async function POST(req:Request,c:{params:Promise<{id:string}>}){try{const u=await identity(req);await throttle(u.id,'resource_accept',10);const p=await body(req,input);return json(await acceptChapterResource(await db(),u.id,objectId((await c.params).id),p.minutes));}catch(e){return failure(e instanceof TopicError?new HttpError(e.status,e.message):e);}}
