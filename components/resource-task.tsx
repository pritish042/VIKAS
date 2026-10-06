'use client';
import {useState} from 'react';
import type {Task} from '@/lib/types';
import type {ResourceFeeling} from '@/lib/topic-types';
export function ResourceTask({task}:{task:Task}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 if(task.youtubeVideoUrl)return <div className="resource-task"><a href={task.youtubeVideoUrl} target="_blank" rel="noopener noreferrer">Open video on YouTube ↗</a><p>Opening a video does not mark this plan step complete.</p></div>;
 if(!task.resourceUrl)return null;
 async function feedback(feeling:ResourceFeeling){setBusy(true);setMessage('');try{const r=await fetch(`/api/topics/attempts/${task.topicAttemptRef}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({feeling})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Please try again.');setMessage('Saved. Future topic suggestions will use this feedback.');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 return <div className="resource-task"><a href={task.resourceUrl} target="_blank" rel="noopener noreferrer">Open learning resource ↗</a>{task.topicAttemptRef&&<details><summary>How did the resource feel?</summary><p>This feedback adjusts future suggestions. It does not complete the task.</p><div className="topic-actions">{([['too_easy','Too easy'],['about_right','About right'],['too_difficult','Too difficult']] as const).map(([value,label])=><button key={value} className="secondary" disabled={busy} onClick={()=>void feedback(value)}>{label}</button>)}</div><p role="status">{message}</p></details>}</div>;
}
