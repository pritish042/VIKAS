import type {KnowledgeInput,MentorEvidence,PrerequisiteResult,StudentContext} from './mentor-contract';
import {mentorProposalSchema} from './mentor-contract';

export function applicableKnowledge(item:{stage:string;language:string;boardMode:string;boards:string[]},context:{stage:string;board:string},language:string){
 return item.stage===context.stage&&item.language===language&&(item.boardMode==='general'||(!!context.board&&item.boards.includes(context.board)));
}
export function checkPrerequisites(prerequisites:KnowledgeInput['prerequisites'],evidence:MentorEvidence[],now=new Date()):PrerequisiteResult[]{
 return prerequisites.map(p=>{
  const relevant=evidence.filter(e=>e.topicId===p.topicId).slice(0,12);
  const latest=p.objectives.map(objective=>evidence.filter(e=>e.topicId===p.topicId&&e.source==='assessment'&&e.objective===objective).sort((a,b)=>(Date.parse(b.at||'')||0)-(Date.parse(a.at||'')||0))[0]);
  const recent=latest.map(e=>e&&e.at&&Date.parse(e.at)<=now.getTime()&&now.getTime()-Date.parse(e.at)<=p.evidenceMaxAgeDays*86400000?e:undefined);
  const stale=latest.some((e,i)=>e&&!recent[i]);
  const status=recent.some(e=>e?.result==='revisit')?'revisit':recent.every(e=>e?.result==='understood')?'supported':'not_checked';
  const explanation=(status==='supported'?'Recent topic-check answers matched the supplied keys for these concepts. This is limited evidence, not proof of mastery.':status==='revisit'?'A recent answer suggests revisiting a prerequisite concept. This says nothing about your overall ability.':'There is not enough recent topic-check evidence for these concepts.')+(stale?' Some evidence is dated or has no reliable date.':'')+(relevant.some(e=>e.source==='completed_task')?' A completed task records activity, not mastery.':'')+(relevant.some(e=>e.source==='confirmed_self_report')?' Your confirmed experience is self-reported, not an assessment result.':'');
  return {topicId:p.topicId,title:p.title,reason:p.reason,status,explanation,evidence:relevant};
 });
}
export function proposeMentorStep(topic:{id:string;title:string}|null,prerequisites:PrerequisiteResult[],context:StudentContext,choice:'consider'|'refresher'|'continue'){
 const gap=prerequisites.find(p=>p.status!=='supported');
 const refresh=choice!=='continue'&&gap;
 return mentorProposalSchema.parse({topicId:refresh?gap.topicId:topic?.id||'',title:(refresh?`Revisit: ${gap.title}`:topic?`Explore: ${topic.title}`:'Choose one learning question').slice(0,150),notes:refresh?'Read a short prerequisite explanation and write down one question.':'Work on one small part of the topic and note what you want to understand next.',minutes:refresh?15:20,status:'pending',explanation:choice==='continue'?'You chose to continue to the topic. Prerequisites are guidance, not a barrier.':gap?`A short refresher is an option because ${gap.title} has ${gap.status==='revisit'?'a recent answer worth revisiting':'limited recent evidence'}. You can still continue independently.`:topic?'A small session lets you explore the topic without assuming mastery.':'No reviewed topic match was found. Choose the question you want to work on; your goal stays unchanged.'});
}
export const searchTerms=(query:string)=>query.match(/[\p{L}\p{N}]{2,}/gu)?.slice(0,12).join(' ')||'';
