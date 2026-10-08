import type {Db} from 'mongodb';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {beginnerPack,packLanguage,lessonText,type BeginnerLanguage} from './mentor-beginner-pack';
export const learningStateSchema=z.object({topicId:z.string().min(1).max(100),title:z.string().min(1).max(150),step:z.number().int().min(0).max(100),pendingQuestion:z.string().max(500),packVersion:z.literal(1).optional()}).strict();
export type LearningState=z.infer<typeof learningStateSchema>;
export type HistoryTurn={role:'user'|'assistant';content:string};
export async function readConversation(d:Db,userId:string){
 const rows=await d.collection('messages').find({userId},{projection:{role:1,content:1,createdAt:1,'mentor.learning':1},maxTimeMS:2000}).sort({createdAt:-1,_id:-1}).limit(8).toArray();
 // Exactly eight messages, at most 6,000 characters total; no account IDs or metadata enter AI input.
 let remaining=6000;const history:HistoryTurn[]=[];
 for(const row of rows){if((row.role!=='user'&&row.role!=='assistant')||typeof row.content!=='string')continue;const content=row.content.slice(0,Math.min(1200,remaining));if(!content)break;remaining-=content.length;history.unshift({role:row.role,content});}
 const latest=rows.find(row=>row.role==='assistant');
 const parsedState=learningStateSchema.safeParse(latest?.mentor?.learning);
 let state=parsedState.success?parsedState.data:undefined;
 // Migrate old chats from explicit student requests, never an assistant's profile-based suggestion.
 if(!state)for(const row of rows){if(row.role!=='user'||typeof row.content!=='string'||!(/\b(?:teach|learn|basics?|bacis|basis)\b/i.test(row.content)))continue;const inferred=resolveLearning(row.content,undefined,undefined);if(inferred.pack&&inferred.state){state={...inferred.state,packVersion:undefined};break;}}
 return {history,state,latestAt:rows[0]?.createdAt instanceof Date?rows[0].createdAt.getTime():0};
}
function languagesIn(message:string){const text=message.toLowerCase(),found:BeginnerLanguage[]=[];if(/\bc\+\+|\bcpp\b|\bcplusplus\b/.test(text))found.push('cpp');if(/\bc\b(?!\s*\+\+)/.test(text))found.push('c');if(/\bpython\b/.test(text))found.push('python');return found;}
export function resolveLearning(message:string,selected:string|undefined,previous:LearningState|undefined){
 const text=message.trim().toLowerCase().replace(/[.!?]+$/,''),found=languagesIn(message);
 const next=/^(?:(?:ok|okay|yes)\s+)?(?:next|continue)(?:\s+(?:please|step))?$/.test(text);
 const yes=/^(?:yes|yeah|yep|ok|okay|sure)$/.test(text);
 const basics=/\b(?:basics?|bacis|basis|beginner)\b/.test(text);
 const help=/^(?:how (?:can|could) you help me|help me)$/.test(text);
 const numeric=/^(?:(?:i think(?: it is)?|it (?:prints?|outputs?|is)|prints?|outputs?|the answer is)\s+)?(-?\d+)[.!]?$/.exec(text);
 const language=found.length===2&&found.includes('c')&&found.includes('cpp')?'c-cpp':found.length===1?found[0]:undefined;
 const selectedLanguage=selected?packLanguage(selected):undefined;
 const topicSwitch=/\b(?:teach|learn|study)\b|\b(?:switch|change|move) (?:to|topic)\b|^explain\s+(?!this\b|that\b|it\b)/.test(text);
 const inherit=!found.length&&(next||yes||basics||help||!!numeric||!!previous&&!topicSwitch);
 const topicId=language?`${language}-basics`:found.length>1?undefined:inherit?selected||previous?.topicId:selected;
 let active=topicId===previous?.topicId?previous:undefined;
 if(!active&&!language&&topicId)active={topicId,title:topicId,step:0,pendingQuestion:''};
 if(!topicId&&topicSwitch&&!found.length){const requested=text.replace(/^.*?\b(?:teach(?: me)?|learn|study|explain|switch to)\s+/, '').slice(0,150);if(requested)active={topicId:`requested-${createHash('sha256').update(requested).digest('hex').slice(0,16)}`,title:requested,step:0,pendingQuestion:''};}
 const pack=topicId?packLanguage(topicId):undefined;
 if(found.length>1&&!language)return {intent:'clarify',clarification:'Which language should we start with: C, C++, or Python?',state:undefined};
 if(!topicId&&(yes||next||basics))return {intent:'clarify',clarification:'Which topic would you like the basics or next step for?',state:undefined};
 if(pack){
  const isStart=!!language&&(basics||/\b(?:teach|learn|start)\b/.test(text))||basics||!!selectedLanguage&&!active;
  let step=active?.step||0;
  if(isStart)step=0;else if(next||yes&&!active?.pendingQuestion)step=Math.min(step+1,beginnerPack[pack].lessons.length-1);
  step=Math.min(step,beginnerPack[pack].lessons.length-1);
  const lesson=beginnerPack[pack].lessons[step];
  const state:LearningState={topicId:topicId!,title:beginnerPack[pack].title,step,pendingQuestion:lesson.question,packVersion:1};
  if(numeric&&active?.packVersion===1&&active.pendingQuestion&&!isStart&&!next){
   const correct=numeric[1]===lesson.expected;if(correct)state.pendingQuestion='';
   return {intent:'answer',state,pack,feedback:correct?`Correct for this practice question: ${lesson.reason} Say “next” to continue.`:`Not quite: ${lesson.reason} Try the practice question again.`,resolvedMessage:`Check this attempted answer to the pending question: ${message}. Question: ${active.pendingQuestion}`};
  }
  if(isStart||next||yes||help)return {intent:'lesson',state,pack,lesson:lessonText(pack,step),resolvedMessage:`Teach ${state.title}, step ${step+1}. Explain directly with the supplied runnable example and practice question. Student said: ${message}`};
  return {intent:'conversation',state:active||state,pack,resolvedMessage:message};
 }
 return {intent:'conversation',state:active?{...active,step:next?Math.min(active.step+1,100):active.step}:undefined,resolvedMessage:active&&(yes||next)?`Continue ${active.title}, step ${next?active.step+2:active.step+1}. Pending question: ${active.pendingQuestion||'none'}. Student said: ${message}`:message};
}
