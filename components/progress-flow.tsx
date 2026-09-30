'use client';
import {useState,type FormEvent} from 'react';
import type {StepFeeling,StepOutcome,Task} from '@/lib/types';

type Decision={decision:'accept'|'reject'}|{decision:'edit';title:string;notes:string;minutes:number};
export function ProgressFlow({task,busy,onFeedback,onDecision,onChangeGoal,onAskDisha}:{task:Task;busy:boolean;onFeedback:(value:{outcome:StepOutcome;feeling:StepFeeling;reflection:string})=>Promise<void>;onDecision:(value:Decision)=>Promise<void>;onChangeGoal:()=>void;onAskDisha:()=>void}){
 const [outcome,setOutcome]=useState<StepOutcome>('completed');
 const [feeling,setFeeling]=useState<StepFeeling>('about_right');
 const [reflection,setReflection]=useState('');
 const [editing,setEditing]=useState(false);
 const proposal=task.feedback?.proposal;
 async function sendFeedback(e:FormEvent<HTMLFormElement>){e.preventDefault();await onFeedback({outcome,feeling,reflection});}
 async function sendEdit(e:FormEvent<HTMLFormElement>){e.preventDefault();const values=new FormData(e.currentTarget);await onDecision({decision:'edit',title:String(values.get('title')||''),notes:String(values.get('notes')||''),minutes:Number(values.get('minutes'))});}
 if(proposal?.status==='pending')return <div className="progress-flow" aria-labelledby="proposal-title">
  <span className="section-label">A suggestion for you to review</span><h3 id="proposal-title">{proposal.title}</h3>
  {task.feedback?.goalTitle&&<p className="proposal-goal">For your goal: {task.feedback.goalTitle}</p>}
  <p className="proposal-time">About {proposal.minutes} minutes</p>
  <p><strong>Why this step?</strong> {proposal.explanation}</p>
  {task.feedback?.outcome==='irrelevant'&&<p>Your step may have changed, or your goal may have changed. You decide which to update.</p>}
  {editing?<form onSubmit={sendEdit} className="progress-fields"><label className="field"><span>Next step</span><input name="title" defaultValue={proposal.title} required maxLength={150}/></label><label className="field"><span>Notes (optional)</span><textarea name="notes" defaultValue={proposal.notes} maxLength={2000} rows={2}/></label><label className="field"><span>Estimated minutes</span><input name="minutes" type="number" min={5} max={600} defaultValue={proposal.minutes} required/></label><div className="progress-actions"><button className="primary" disabled={busy}>Save my step</button><button className="text-button" type="button" onClick={()=>setEditing(false)}>Cancel edit</button></div></form>:<div className="progress-actions"><button className="primary" disabled={busy} onClick={()=>void onDecision({decision:'accept'})}>Accept step</button><button className="secondary" disabled={busy} onClick={()=>setEditing(true)}>Edit step</button><button className="text-button" disabled={busy} onClick={()=>void onDecision({decision:'reject'})}>Reject</button></div>}
  {task.feedback?.outcome==='irrelevant'&&<button className="text-button" onClick={onChangeGoal}>Change my goal</button>}
  {task.feedback?.outcome==='need_help'&&<button className="text-button" onClick={onAskDisha}>Ask DISHA</button>}
 </div>;
 return <form className="progress-flow progress-fields" onSubmit={sendFeedback} aria-labelledby="feedback-title">
  <span className="section-label">Reflect on this step</span><h3 id="feedback-title">{task.title}</h3>
  <fieldset><legend>What happened with this step?</legend><div className="feedback-choices">{([['completed','Completed'],['need_help','Need help'],['irrelevant','No longer relevant']] as const).map(([value,label])=><label key={value}><input type="radio" name="outcome" checked={outcome===value} onChange={()=>setOutcome(value)}/>{label}</label>)}</div></fieldset>
  <fieldset><legend>How did this step feel?</legend><div className="feedback-choices">{([['easy','Easy'],['about_right','About right'],['difficult','Difficult']] as const).map(([value,label])=><label key={value}><input type="radio" name="feeling" checked={feeling===value} onChange={()=>setFeeling(value)}/>{label}</label>)}</div></fieldset>
  <label className="field"><span>What happened? (optional)</span><textarea value={reflection} onChange={e=>setReflection(e.target.value)} maxLength={500} rows={2}/></label>
  <p className="muted">Your answer helps suggest one next step. You choose whether to add it.</p>
  <button className="primary" disabled={busy}>See a suggestion</button>
 </form>;
}
