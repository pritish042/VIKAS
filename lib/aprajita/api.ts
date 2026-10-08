import 'server-only';
import {failure,json} from '../api';
import {LabError} from './service';
export const runnerConfig=()=>({url:process.env.APRAJITA_EXECUTION_URL,token:process.env.APRAJITA_EXECUTION_TOKEN});
export function labFailure(error:unknown){return error instanceof LabError?json({error:error.message},error.status):failure(error);}
