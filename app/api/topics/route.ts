import {identity,json,failure} from '@/lib/api';
import {db} from '@/lib/db';
import {listTopics} from '@/lib/topic-service';
export async function GET(req:Request){try{const u=await identity(req);return json({topics:await listTopics(await db(),u.id)});}catch(e){return failure(e);}}
