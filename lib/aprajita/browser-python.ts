import {MAX_SOURCE,type RunResult} from './contract';
import {PYTHON_FRAME_HTML,PYTHON_LIMITS} from './python-frame';
export type PythonPhase='loading'|'running'|'idle';
// The module is dynamically imported at first Run. The worker is created in an opaque-origin iframe.
export class BrowserPython {
 private cleanup:(()=>void)|null=null;
 private stopRun:((status:string,id:number)=>void)|null=null;
 run(source:string,stdin:string,onPhase:(phase:PythonPhase)=>void,onOutput?:(value:{stdout:string;stderr:string})=>void):Promise<RunResult>{
  if(this.cleanup)throw new Error('A Python run is already active.');
  if(!source.trim()||source.length>MAX_SOURCE||stdin.length>1000)throw new Error('Check your code and input lengths.');
  return new Promise(resolve=>{
   let stdout='',stderr='',used=0,finished=false,running=false,timer:ReturnType<typeof setTimeout>;
   const iframe=document.createElement('iframe');iframe.hidden=true;iframe.setAttribute('sandbox','allow-scripts');iframe.setAttribute('aria-hidden','true');iframe.referrerPolicy='no-referrer';iframe.srcdoc=PYTHON_FRAME_HTML;
   const channel=new MessageChannel();
   const cleanup=()=>{clearTimeout(timer);channel.port1.close();channel.port2.close();iframe.remove();this.cleanup=null;this.stopRun=null;};
   const finish=(status:string,statusId:number,success=false,truncated=false)=>{if(finished)return;finished=true;cleanup();onPhase('idle');resolve({status,statusId,success,stdout,stderr,compilationErrors:'',output:stdout,error:stderr,truncated});};
   const stop=(status:string,id:number)=>{channel.port1.postMessage({type:'stop'});finish(status,id);};
   this.cleanup=cleanup;this.stopRun=stop;
   timer=setTimeout(()=>stop('Python runtime loading timed out. Check your connection and retry.',0),PYTHON_LIMITS.loadMs);
   channel.port1.onmessage=({data})=>{
    if(finished||!data||typeof data.type!=='string')return;
    if(data.type==='connected'){channel.port1.postMessage({type:'run',source,stdin});return;}
    if(data.type==='running'&&!running){running=true;clearTimeout(timer);timer=setTimeout(()=>stop('Time limit exceeded (10 seconds)',5),PYTHON_LIMITS.runMs);onPhase('running');return;}
    if(data.type==='stdout'||data.type==='stderr'){
     if(typeof data.text!=='string')return;
     const bytes=new TextEncoder().encode(data.text.slice(0,PYTHON_LIMITS.outputBytes));const budget=Math.max(0,PYTHON_LIMITS.outputBytes-used);
     const text=new TextDecoder().decode(bytes.subarray(0,budget),{stream:bytes.length>budget});used+=bytes.length;
     if(data.type==='stdout')stdout+=text;else stderr+=text;onOutput?.({stdout,stderr});
     if(used>PYTHON_LIMITS.outputBytes)finish('Output limit reached',14,false,true);
     return;
    }
    if(data.type==='limit')finish('Output limit reached',14,false,true);
    else if(data.type==='done')finish(data.success===true?'Finished':'Python error',data.success===true?3:11,data.success===true);
    else if(data.type==='unavailable')finish('Python runtime unavailable. Check your connection and retry.',0);
   };
   iframe.onload=()=>iframe.contentWindow?.postMessage({type:'aprajita-connect'},'*',[channel.port2]);
   onPhase('loading');document.body.appendChild(iframe);
  });
 }
 stop(){this.stopRun?.('Stopped. Run again to start a fresh worker.',0);}
 dispose(){this.stop();this.cleanup?.();}
}
