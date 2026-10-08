import {identity,body,json,throttle} from '@/lib/api';
import {db} from '@/lib/db';
import {requireLab} from '@/lib/aprajita/service';
import {runSchema} from '@/lib/aprajita/contract';
import {executeCode} from '@/lib/aprajita/execution';
import {runnerConfig,labFailure} from '@/lib/aprajita/api';
export const maxDuration=20;
export async function POST(req:Request){try{const user=await identity(req);await throttle(user.id,'aprajita-run',3);await requireLab(await db(),user.id);return json(await executeCode(await body(req,runSchema),runnerConfig()));}catch(e){return labFailure(e);}}
