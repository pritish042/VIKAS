import {identity,json} from '@/lib/api';
import {db} from '@/lib/db';
import {labAccess} from '@/lib/aprajita/service';
import {publicQuestions,refresher} from '@/lib/aprajita/assessment';
import {runnerConfigured} from '@/lib/aprajita/execution';
import {executionProvider,jdoodleConfig} from '@/lib/aprajita/provider-config';
import {jdoodleConfigured} from '@/lib/aprajita/jdoodle';
import {runnerConfig,labFailure} from '@/lib/aprajita/api';
export async function GET(req:Request){try{const user=await identity(req),access=await labAccess(await db(),user.id);return json({access,executionConfigured:executionProvider()==='jdoodle'?jdoodleConfigured(jdoodleConfig()):executionProvider()==='judge0'&&runnerConfigured(runnerConfig()),executionProvider:executionProvider(),pythonExecution:'browser',questions:access.eligible&&access.requiresAssessment?publicQuestions():[],refresher:access.eligible?refresher:''});}catch(e){return labFailure(e);}}
