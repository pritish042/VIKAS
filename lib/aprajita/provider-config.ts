import {LabError} from './service';
import {runnerConfigured} from './execution';
import {dailyLimit} from './jdoodle';
import type {RunnerConfig} from './execution';
import type {JDoodleConfig} from './jdoodle';
export type ExecutionProvider='none'|'judge0'|'jdoodle';
// Only imported by server routes and the explicit operator verification CLI.
export function executionProvider(env:Record<string,string|undefined>=process.env):ExecutionProvider{
 return env.APRAJITA_EXECUTION_PROVIDER==='jdoodle'?'jdoodle':env.APRAJITA_EXECUTION_PROVIDER==='judge0'?'judge0':'none';
}
export const judge0Config=(env:Record<string,string|undefined>=process.env):RunnerConfig=>({url:env.APRAJITA_EXECUTION_URL,token:env.APRAJITA_EXECUTION_TOKEN});
export const jdoodleConfig=(env:Record<string,string|undefined>=process.env):JDoodleConfig=>({clientId:env.JDOODLE_CLIENT_ID,clientSecret:env.JDOODLE_CLIENT_SECRET,dailyLimit:env.JDOODLE_DAILY_LIMIT});

export function assertExecutionConfiguration(env:Record<string,string|undefined>=process.env){
 const selected=env.APRAJITA_EXECUTION_PROVIDER;
 if(!selected)throw new LabError(503,'Execution provider is not configured. Set APRAJITA_EXECUTION_PROVIDER to jdoodle or judge0 in the deployed environment.','EXECUTION_PROVIDER_MISSING');
 if(selected==='none')throw new LabError(503,'External execution is disabled. Browser Python, editing and saving remain available.','EXECUTION_DISABLED');
 if(selected!=='jdoodle'&&selected!=='judge0')throw new LabError(503,'APRAJITA_EXECUTION_PROVIDER must be exactly jdoodle, judge0 or none.','EXECUTION_PROVIDER_INVALID');
 if(selected==='jdoodle'){
  const missing=['JDOODLE_CLIENT_ID','JDOODLE_CLIENT_SECRET'].filter(name=>!env[name]?.trim());
  if(missing.length)throw new LabError(503,`JDoodle execution is not configured: missing ${missing.join(', ')} in the deployed environment.`,'JDOODLE_CONFIGURATION_MISSING');
  if(!dailyLimit(jdoodleConfig(env)))throw new LabError(503,'JDOODLE_DAILY_LIMIT must be an integer from 1 to 20.','JDOODLE_QUOTA_CONFIGURATION_INVALID');
 }else{
  const missing=['APRAJITA_EXECUTION_URL','APRAJITA_EXECUTION_TOKEN'].filter(name=>!env[name]?.trim());
  if(missing.length)throw new LabError(503,`Judge0 execution is not configured: missing ${missing.join(', ')} in the deployed environment.`,'JUDGE0_CONFIGURATION_MISSING');
  if(!runnerConfigured(judge0Config(env)))throw new LabError(503,'APRAJITA_EXECUTION_URL must be a valid HTTPS base URL without embedded credentials, query or fragment.','JUDGE0_CONFIGURATION_INVALID');
 }
 return selected;
}
