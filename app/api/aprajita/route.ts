import {identity,json} from '@/lib/api';
import {db} from '@/lib/db';
import {labAccess} from '@/lib/aprajita/service';
import {publicQuestions,refresher} from '@/lib/aprajita/assessment';
import {runnerConfigured} from '@/lib/aprajita/execution';
import {runnerConfig,labFailure} from '@/lib/aprajita/api';
export async function GET(req:Request){try{const user=await identity(req),access=await labAccess(await db(),user.id);return json({access,executionConfigured:runnerConfigured(runnerConfig()),questions:access.eligible&&access.requiresAssessment?publicQuestions():[],refresher:access.eligible?refresher:''});}catch(e){return labFailure(e);}}
