import {identity,body,json,throttle} from '@/lib/api';
import {db} from '@/lib/db';
import {submitReadiness} from '@/lib/aprajita/service';
import {readinessSchema} from '@/lib/aprajita/contract';
import {labFailure} from '@/lib/aprajita/api';
export async function POST(req:Request){try{const user=await identity(req);await throttle(user.id,'aprajita-readiness',30);return json(await submitReadiness(await db(),user.id,await body(req,readinessSchema)));}catch(e){return labFailure(e);}}
