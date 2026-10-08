import type {Profile} from './types';

export function shouldReplaceProfileDraft(accountChanged:boolean,draft:Profile,saved:Profile){
 return accountChanged||JSON.stringify(draft)===JSON.stringify(saved);
}

// Start independent reads after publishing the profile. Each result remains
// bound to the generation that requested it, including failure notices.
export async function refreshAuxiliary(
 reads:Array<()=>Promise<void>>,
 current:()=>boolean,
 onError:(error:unknown)=>void,
){
 const results=await Promise.allSettled(reads.map(read=>read()));
 if(!current())return;
 const failed=results.find(result=>result.status==='rejected');
 if(failed?.status==='rejected')onError(failed.reason);
}
