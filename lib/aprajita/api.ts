import 'server-only';
import {failure,json} from '../api';
import {LabError} from './service';
export {judge0Config as runnerConfig} from './provider-config';
export function labFailure(error:unknown){if(error instanceof LabError){if(error.code)console.warn('APRAJITA execution failure',{code:error.code,status:error.status});return json({error:error.message,...(error.code?{code:error.code}:{})},error.status);}return failure(error);}
