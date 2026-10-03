// Prevent a response started for a previous session from restoring private state.
export function latestRequest(){let generation=0;return {begin:()=>++generation,current:(id:number)=>id===generation,invalidate:()=>{generation++;}};}
