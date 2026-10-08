import {identity,body,json,throttle} from '@/lib/api';
import {db} from '@/lib/db';
import {requireLab} from '@/lib/aprajita/service';
import {runSchema} from '@/lib/aprajita/contract';
import {executeJDoodle} from '@/lib/aprajita/jdoodle';
import {assertExecutionConfiguration,jdoodleConfig} from '@/lib/aprajita/provider-config';
import {LabError} from '@/lib/aprajita/service';
import {executeCode} from '@/lib/aprajita/execution';
import {runnerConfig,labFailure} from '@/lib/aprajita/api';
export const runtime='nodejs';
export const maxDuration=20;
export async function POST(req:Request){try{const user=await identity(req);await throttle(user.id,'aprajita-run',3);const database=await db();await requireLab(database,user.id);const input=await body(req,runSchema);const provider=assertExecutionConfiguration();if(provider==='jdoodle')return json(await executeJDoodle(database,input,jdoodleConfig()));if(provider==='judge0')return json(await executeCode(input,runnerConfig()));throw new LabError(503,'Execution is not configured. Python can run in your browser; editing and saving remain available.');}catch(e){return labFailure(e);}}
