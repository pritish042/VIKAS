// Executes only via the external adapter; never starts a local compiler/interpreter.
import {executeCode,runnerConfigured} from '../lib/aprajita/execution';
import type {LabLanguage} from '../lib/aprajita/contract';
async function verify(){
if(!process.argv.includes('--allow-external-execution')){console.log('SKIPPED external verification: browser Python is the zero-budget default. Explicit --allow-external-execution is required to consume provider credits.');return;}
const config={url:process.env.APRAJITA_EXECUTION_URL,token:process.env.APRAJITA_EXECUTION_TOKEN};
if(!runnerConfigured(config)){
 console.log('SKIPPED live C/Python/Java verification: configure APRAJITA_EXECUTION_URL and APRAJITA_EXECUTION_TOKEN.');
}else{
 const programs:{language:Exclude<LabLanguage,'html'>;source:string}[]=[
  {language:'c',source:'#include <stdio.h>\nint main(void) { int n; if(scanf("%d", &n)!=1) return 1; printf("%d\\n",n); return 0; }'},
  {language:'python',source:'print(int(input()))'},
  {language:'java',source:'import java.util.Scanner;\npublic class Main { public static void main(String[] args) { Scanner s = new Scanner(System.in); System.out.println(s.nextInt()); } }'},
 ];
 for(const program of programs){try{const answer=await executeCode({...program,stdin:'42\n'},config);if(!answer.success||answer.stdout.trim()!=='42'||answer.stderr||answer.compilationErrors||answer.truncated){console.error(`${program.language}: FAILED (${answer.status}). Check runner language versions/limits; diagnostics deliberately omitted.`);process.exitCode=1;}else console.log(`${program.language}: PASS (external runner returned expected stdout from stdin).`);}catch(error){console.error(`${program.language}: FAILED: ${error instanceof Error?error.message:'Runner unavailable'}`);process.exitCode=1;}}
}

}
void verify();
