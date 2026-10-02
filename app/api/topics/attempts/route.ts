import {identity,json,body,throttle} from '@/lib/api';
import {db} from '@/lib/db';
import {createAttempt,listAttempts} from '@/lib/topic-service';
import {attemptInput} from '@/lib/topic-rules';
import {topicFailure} from '@/lib/topic-api';
export async function GET(req:Request){try{const u=await identity(req);return json({attempts:await listAttempts(await db(),u.id)});}catch(e){return topicFailure(e);}}
export async function POST(req:Request){try{const u=await identity(req);await throttle(u.id,'topic-checks',10);return json({attempt:await createAttempt(await db(),u.id,await body(req,attemptInput))},201);}catch(e){return topicFailure(e);}}
