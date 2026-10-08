import test from 'node:test';
import assert from 'node:assert/strict';
import {assertExecutionConfiguration} from '../lib/aprajita/provider-config';
import {LabError} from '../lib/aprajita/service';
test('provider and missing environment variables yield specific safe diagnostics',()=>{
 const cases:[Record<string,string|undefined>,string][]=[
  [{},'EXECUTION_PROVIDER_MISSING'],[{APRAJITA_EXECUTION_PROVIDER:'none'},'EXECUTION_DISABLED'],[{APRAJITA_EXECUTION_PROVIDER:'JDoodle'},'EXECUTION_PROVIDER_INVALID'],
  [{APRAJITA_EXECUTION_PROVIDER:'jdoodle'},'JDOODLE_CONFIGURATION_MISSING'],
  [{APRAJITA_EXECUTION_PROVIDER:'jdoodle',JDOODLE_CLIENT_ID:'private-id',JDOODLE_CLIENT_SECRET:'private-secret',JDOODLE_DAILY_LIMIT:'200'},'JDOODLE_QUOTA_CONFIGURATION_INVALID'],
  [{APRAJITA_EXECUTION_PROVIDER:'judge0'},'JUDGE0_CONFIGURATION_MISSING'],
  [{APRAJITA_EXECUTION_PROVIDER:'judge0',APRAJITA_EXECUTION_URL:'http://private-host',APRAJITA_EXECUTION_TOKEN:'private-token'},'JUDGE0_CONFIGURATION_INVALID'],
 ];
 for(const [env,code] of cases)assert.throws(()=>assertExecutionConfiguration(env),error=>error instanceof LabError&&error.status===503&&error.code===code&&!/private-id|private-secret|private-host|private-token/.test(error.message));
});
test('explicit JDoodle configuration is independent of Judge0 URL and token',()=>{
 assert.equal(assertExecutionConfiguration({APRAJITA_EXECUTION_PROVIDER:'jdoodle',JDOODLE_CLIENT_ID:'private-id',JDOODLE_CLIENT_SECRET:'private-secret',JDOODLE_DAILY_LIMIT:'20'}),'jdoodle');
 assert.equal(assertExecutionConfiguration({APRAJITA_EXECUTION_PROVIDER:'judge0',APRAJITA_EXECUTION_URL:'https://runner.example',APRAJITA_EXECUTION_TOKEN:'private-token'}),'judge0');
});
