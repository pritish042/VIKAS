// Server routing and import rules. Client components import topic-types only.
import {z} from 'zod';
import type {ObjectId} from 'mongodb';
import type {Profile} from './types';
import type {ConceptResult,Recommendation,ResourceFeeling} from './topic-types';
import {resourceEligible,normalizeClass,key,normalizeSubject,type AcademicResource} from './resource-eligibility';
const text=(n:number)=>z.string().trim().min(1).max(n);
export const safeExternalUrl=z.url().max(1500).refine(value=>{
 const u=new URL(value), h=u.hostname.toLowerCase();
 return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&h.includes('.')&&
  !/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)&&!h.endsWith('.local')&&!h.includes(':');
},'Use a public HTTPS URL without credentials.');
export const applicabilitySchema=z.discriminatedUnion('stage',[
 z.object({stage:z.literal('senior'),classes:z.array(text(100)).min(1).max(2),boards:z.array(text(150)).min(1).max(40),subjects:z.array(text(100)).min(1).max(40)}).strict(),
 z.object({stage:z.literal('undergraduate'),programmes:z.array(z.object({program:text(150),disciplines:z.array(text(150)).min(1).max(40)}).strict()).min(1).max(30),periods:z.array(text(100)).max(20)}).strict(),
]);
export const topicConfigSchema=z.object({
 id:text(100),resourceId:text(100),subject:text(100),title:text(150),applicability:applicabilitySchema,
 languages:z.array(text(60)).min(1).max(10),excludedQuestionIds:z.array(text(100)).max(20),
}).strict();
export type TopicConfig=z.infer<typeof topicConfigSchema>;
export const questionSchema=z.object({id:text(100),prompt:text(1500),options:z.array(z.object({id:z.enum(['a','b','c','d','e']),label:text(500)}).strict()).length(5),answer:z.enum(['a','b','c','d']),explanation:text(2000),objective:text(500),prerequisite:z.boolean()}).strict().refine(q=>new Set(q.options.map(o=>o.id)).size===5&&q.options.find(o=>o.id==='e')?.label==='Not sure','Invalid options');
export type Question=z.infer<typeof questionSchema>;
export const attemptInput=z.discriminatedUnion('skipped',[
 z.object({topicId:text(100),skipped:z.literal(true),language:text(60),minutes:z.number().int().min(5).max(120)}).strict(),
 z.object({topicId:text(100),skipped:z.literal(false),assessmentId:z.string().regex(/^[a-f\d]{24}$/i),language:text(60),minutes:z.number().int().min(5).max(120),answers:z.array(z.object({questionId:text(100),answer:z.enum(['a','b','c','d','e'])}).strict()).min(1).max(20)}).strict(),
]);
export const acceptanceInput=z.object({resourceId:z.string().regex(/^[a-f\d]{24}$/i)}).strict();
export const resourceFeedbackInput=z.object({feeling:z.enum(['too_easy','about_right','too_difficult'])}).strict();
export function matchesProfile(profile:Partial<Profile>|null,app:TopicConfig['applicability']) {
 const e=profile?.education;if(!e||profile?.stage!==app.stage)return false;
 if(app.stage==='senior')return app.classes.map(normalizeClass).includes(normalizeClass(e.className))&&!!normalizeClass(e.className)&&app.boards.map(key).includes(key(e.board))&&app.subjects.some(s=>e.subjects.map(normalizeSubject).includes(normalizeSubject(s)));
 return app.programmes.some(p=>p.program===e.program&&p.disciplines.includes(e.discipline))&&(!app.periods.length||app.periods.includes(e.period));
}
export function assess(questions:Question[],answers:{questionId:string;answer:string}[]):ConceptResult[] {
 if(answers.length!==questions.length||new Set(answers.map(a=>a.questionId)).size!==questions.length||answers.some(a=>!questions.some(q=>q.id===a.questionId&&q.options.some(o=>o.id===a.answer))))throw new Error('Answer each question in this version once, or choose Not sure.');
 return questions.map(q=>{const a=answers.find(a=>a.questionId===q.id)!;return {questionId:q.id,objective:q.objective,prerequisite:q.prerequisite,result:a.answer==='e'?'not_sure':a.answer===q.answer?'understood':'revisit',explanation:q.explanation,answer:q.options.find(o=>o.id===q.answer)!.label};});
}
export function publicQuestions(questions:Question[]){return questions.map(({id,prompt,options})=>({id,prompt,options}));}
export interface CatalogueResource extends AcademicResource {
 _id:ObjectId; title:string;url:string;status:string;
 catalogue:{topic:TopicConfig;provider:string;effort:string;access:string;prerequisites:string;limitations:string;objectives:string[];prerequisiteObjectives:string[]};
}
export function recommend(resources:CatalogueResource[],profile:Partial<Profile>|null,topicId:string,results:ConceptResult[],language:string,minutes:number,feeling?:ResourceFeeling):Recommendation[] {
 const revisit=results.filter(r=>r.result!=='understood');
 const prerequisite=revisit.filter(r=>r.prerequisite);
 return resources.filter(r=>resourceEligible(r,profile,topicId)&&r.catalogue.topic.id===topicId&&matchesProfile(profile,r.catalogue.topic.applicability)&&r.catalogue.topic.languages.includes(language))
 .map(r=>{
  const c=r.catalogue, matched=revisit.filter(v=>c.objectives.includes(v.objective)),missing=prerequisite.filter(v=>c.prerequisiteObjectives.includes(v.objective));
  // Prerequisites and individual objective coverage precede any practice preference.
  const smaller=feeling==='too_difficult'||revisit.length>0;
  const sessionMinutes=smaller?Math.max(5,Math.floor(minutes/2)):minutes;
  const approach=missing.length?'Start with the prerequisite explanation.':smaller?'Read one small part and pause to explain it in your own words.':feeling==='too_easy'?'Use your time for practice in the topic, where the resource includes exercises.':'Start with the topic explanation, then try an example.';
  const reasons=[`Matches your saved ${c.topic.applicability.stage==='senior'?'class, board and selected subject':'programme and discipline'}.`,`${language} is listed in the supplied catalogue.`,results.length?(matched.length?`Your answers suggest revisiting: ${matched.map(v=>v.objective).join('; ')}.`:'Your answers matched the supplied keys; this introductory resource remains an option. No more advanced resource is in this batch.'):'You skipped the check. This is an introductory option; no understanding is inferred.',
   `Try a ${sessionMinutes}-minute session within your ${minutes} available minutes. This is a study session, not the full resource duration.`];
  if(feeling)reasons.push(feeling==='too_difficult'?'You said the previous resource was too difficult, so try a smaller segment.':feeling==='too_easy'?'You said the previous resource was too easy, so focus on practice if available.':'You said the previous resource was about right, so keep a similar approach.');
  return {resourceId:r._id.toString(),title:r.title,url:r.url,provider:c.provider,language,effort:c.effort,access:c.access,prerequisites:c.prerequisites,limitations:c.limitations,reasons,minutes:sessionMinutes,approach,priority:missing.length*100+matched.length};
 }).sort((a,b)=>b.priority-a.priority||a.resourceId.localeCompare(b.resourceId)).slice(0,3).map(({priority:_,...r})=>r);
}
