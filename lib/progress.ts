import {createHash} from 'node:crypto';
import {ObjectId} from 'mongodb';
import type {StepFeeling,StepOutcome} from './types';

export function ownedTaskQuery(userId:string,_id:ObjectId){return {userId,_id};}

export function goalRef(userId:string,goal:string) {
 return createHash('sha256').update(userId).update('\0').update(goal.trim()).digest('hex');
}

export function proposeStep(task:{title:string;minutes:number},goal:string,feedback:{outcome:StepOutcome;feeling:StepFeeling;reflection:string}) {
 const minutes=Math.max(5,Math.min(600,task.minutes));
 let title:string;let duration:number;let reason:string;
 if(feedback.outcome==='need_help') {
  title=`Review a prerequisite for: ${task.title}`;duration=Math.max(5,Math.round(minutes/2));
  reason='You said you need help, so a smaller prerequisite may make the step easier to approach. You can also ask DISHA if it is available.';
 } else if(feedback.outcome==='irrelevant') {
  title=`Choose a different small step for: ${goal}`;duration=10;
  reason='You said the previous step is no longer relevant. You can change this step or edit your goal.';
 } else if(feedback.feeling==='easy') {
  title=`Continue with: ${task.title}`;duration=Math.min(600,Math.max(minutes+5,Math.round(minutes*1.25)));
  reason='You completed the step and said it felt easy, so this suggestion gives you a little more time with it.';
 } else if(feedback.feeling==='difficult') {
  title=`Try a smaller part of: ${task.title}`;duration=Math.max(5,Math.round(minutes/2));
  reason='You completed the step and said it felt difficult, so this suggestion starts with a smaller part. Difficulty is useful feedback, not a judgment.';
 } else {
  title=`Continue with: ${task.title}`;duration=minutes;
  reason='You completed the step and said it felt about right, so this suggestion keeps a similar amount of time.';
 }
 const reflection=feedback.reflection.trim();
 const excerpt=reflection.length>120?`${reflection.slice(0,119)}…`:reflection;
 return {title:title.slice(0,150),notes:'',minutes:duration,explanation:reason+(excerpt?` You wrote: “${excerpt}”`:''),status:'pending' as const};
}

export function resolveProposal(proposal:{title:string;notes:string;minutes:number},decision:{decision:'accept'|'reject'}|{decision:'edit';title:string;notes:string;minutes:number},taskRef:string) {
 if(decision.decision==='reject')return {status:'rejected' as const};
 const step=decision.decision==='edit'?{title:decision.title,notes:decision.notes,minutes:decision.minutes}:{title:proposal.title,notes:proposal.notes,minutes:proposal.minutes};
 return {status:'accepted' as const,acceptedStep:{taskRef,...step}};
}
