import {identity,json,objectId} from '@/lib/api';
import {db} from '@/lib/db';
import {getCheck} from '@/lib/topic-service';
import {topicFailure} from '@/lib/topic-api';
export async function GET(req:Request,c:{params:Promise<{id:string}>}){try{const u=await identity(req);return json(await getCheck(await db(),u.id,objectId((await c.params).id)));}catch(e){return topicFailure(e);}}
