import {test} from 'node:test';
import assert from 'node:assert/strict';
import {refreshAuxiliary,shouldReplaceProfileDraft} from '../lib/profile-refresh';
import {latestRequest} from '../lib/latest-request';
import {emptyProfile} from '../lib/types';

test('background refresh preserves academic edits and replaces drafts on account change',()=>{
 const saved={...emptyProfile,goal:'Saved goal'};
 const draft={...saved,education:{board:'CBSE',className:'Class 8',program:'',discipline:'',stream:'',subjects:['Hindi'],period:''}};
 assert.equal(shouldReplaceProfileDraft(false,draft,saved),false);
 assert.equal(shouldReplaceProfileDraft(false,saved,saved),true);
 assert.equal(shouldReplaceProfileDraft(true,draft,saved),true);
});

test('a delayed journal and failed mentor do not block other results',async()=>{
 let release!:()=>void;
 const delayed=new Promise<void>(resolve=>{release=resolve;});
 let tasks=false;let journal=false;let error:unknown;
 const pending=refreshAuxiliary([
  async()=>{tasks=true;},
  async()=>{await delayed;journal=true;},
  async()=>{throw new Error('Mentor unavailable');},
 ],()=>true,value=>{error=value;});
 assert.equal(tasks,true);
 assert.equal(journal,false);
 release();await pending;
 assert.equal(journal,true);
 assert.match(String(error),/Mentor unavailable/);
});

test('late responses and errors are ignored after logout or account switching',async()=>{
 const requests=latestRequest();const id=requests.begin();
 let release!:(value:string)=>void;
 const response=new Promise<string>(resolve=>{release=resolve;});
 let privateData='';let reported=false;
 const current=()=>requests.current(id);
 const pending=refreshAuxiliary([async()=>{const value=await response;if(current())privateData=value;throw new Error('Late failure');}],current,()=>{reported=true;});
 requests.invalidate();requests.begin();release('Previous account');await pending;
 assert.equal(privateData,'');assert.equal(reported,false);
});
