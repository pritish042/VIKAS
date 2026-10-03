import {z} from 'zod';
import type {Profile} from './types';
const values=z.array(z.string().trim().min(1).max(150)).max(40).default([]);
export const resourceAudienceSchema=z.object({pathways:values,classes:values,boards:values,boardIndependent:z.boolean().default(false),streams:values,streamIndependent:z.boolean().default(false),subjects:values,programmes:values,disciplines:values,periods:values,topicIds:values,parentTopicIds:values,generalStudySkill:z.boolean().default(false)}).strict().superRefine((v,c)=>{
 if(!v.pathways.length)c.addIssue({code:'custom',message:'Specify the educational pathways.'});
 if(!v.generalStudySkill&&!v.subjects.length)c.addIssue({code:'custom',message:'Specify the actual subjects covered.'});
 if(v.pathways.some(p=>['school','senior'].includes(normalizePathway(p)))){
  if(!v.classes.length||(!v.boards.length&&!v.boardIndependent))c.addIssue({code:'custom',message:'School resources need classes and boards or explicit board independence.'});
  if(v.pathways.some(p=>normalizePathway(p)==='senior')&&!v.streams.length&&!v.streamIndependent)c.addIssue({code:'custom',message:'Senior resources need streams or explicit stream independence.'});
 }
 if(v.pathways.some(p=>['undergraduate','postgraduate','vocational'].includes(normalizePathway(p)))&&(!v.programmes.length||!v.disciplines.length||!v.periods.length))c.addIssue({code:'custom',message:'Programme resources need programmes, disciplines and periods.'});
});
export type ResourceAudience=z.infer<typeof resourceAudienceSchema>;
export const key=(s:unknown)=>typeof s==='string'?s.toLowerCase().trim().replace(/[–—_-]/g,' ').replace(/\s+/g,' '):'';
export function normalizePathway(s:unknown){const k=key(s);return ['class 11 12','11 12','senior secondary'].includes(k)?'senior':['diploma','iti','polytechnic'].includes(k)?'vocational':['bachelor','bachelors','bachelor’s'].includes(k)?'undergraduate':k;}
export function normalizeClass(s:unknown){const k=key(s).replace(/^class\s*/,'');return /^(8|9|10|11|12)$/.test(k)?`Class ${k}`:'';}
export function classes(s:unknown){const k=key(s).replace(/^classes?\s*/,'');return k==='11 12'?['Class 11','Class 12']:k==='8 10'?['Class 8','Class 9','Class 10']:normalizeClass(s)?[normalizeClass(s)]:[];}
export function normalizeCombination(s:unknown){const k=key(s).replace(/[^a-z]/g,'');return /pcmb|physicschemistrymathematicsbiology|physicschemistrybiologymathematics/.test(k)?'pcmb':/pcb|physicschemistrybiology/.test(k)?'pcb':/pcm|physicschemistrymathematics/.test(k)?'pcm':'';}
export function normalizeStream(s:unknown){const k=key(s);return normalizeCombination(k)||/\bscience\b/.test(k)?'science':/commerce/.test(k)?'commerce':/arts|humanities/.test(k)?'humanities':k;}
export function normalizeSubject(s:unknown){const k=key(s);return ({math:'mathematics',maths:'mathematics',bio:'biology',physics:'physics',chem:'chemistry',cs:'computer science',informatics:'informatics practices',pe:'physical education',accounts:'accountancy',accounting:'accountancy',politics:'political science',english:'english'} as Record<string,string>)[k]||k;}
const unknown=(s:unknown)=>!key(s)||['not sure','other'].includes(key(s));
export function resourceProfile(p:Partial<Profile>|null){
 const e=p?.education,stage=normalizePathway(p?.stage),className=normalizeClass(e?.className||p?.level),board=unknown(e?.board)?'':key(e?.board),rawStream=e?.stream||p?.stream,stream=unknown(rawStream)?'':normalizeStream(rawStream),subjects=(e?.subjects||[]).filter(s=>!unknown(s)).map(normalizeSubject);
 const missing:string[]=[];
 if(!['school','senior','vocational','undergraduate','postgraduate'].includes(stage))missing.push('education stage');
 if(['school','senior'].includes(stage)){if(!className)missing.push('class');if(!board)missing.push('education board');if(stage==='senior'&&!stream)missing.push('stream or subject combination');if(!subjects.length)missing.push('subjects currently studied');}
 else if(['vocational','undergraduate','postgraduate'].includes(stage)){if(unknown(e?.program))missing.push('programme');if(unknown(e?.discipline))missing.push('discipline or specialization');if(unknown(e?.period||p?.level))missing.push('year or semester');if(!subjects.length)missing.push('subjects currently studied');}
 return {stage,className,board,stream,combination:normalizeCombination(rawStream),subjects,program:key(e?.program),discipline:key(e?.discipline),period:key(e?.period||p?.level),missing};
}
export interface AcademicResource {status?:string;active?:boolean;expiresAt?:Date|string|null;audience?:unknown;audienceReviewedAt?:Date|string;}
export function resourceEligible(resource:AcademicResource,profile:Partial<Profile>|null,topicId?:string,now=new Date()){
 if(resource.status!=='published'||resource.active!==true)return false;
 if(resource.expiresAt){const time=new Date(resource.expiresAt).getTime();if(!Number.isFinite(time)||time<=now.getTime())return false;}
 if(!resource.audienceReviewedAt||!Number.isFinite(new Date(resource.audienceReviewedAt).getTime()))return false;
 const parsed=resourceAudienceSchema.safeParse(resource.audience);if(!parsed.success)return false;
 const a=parsed.data,p=resourceProfile(profile);if(p.missing.length||a.generalStudySkill)return false;
 const pathways=a.pathways.map(normalizePathway);
 if(!pathways.includes(p.stage)&&!(p.stage==='senior'&&pathways.includes('school')))return false;
 if(['school','senior'].includes(p.stage)){
  if(!a.classes.flatMap(classes).includes(p.className))return false;
  if(!a.boardIndependent&&!a.boards.map(key).includes(p.board))return false;
  if(p.stage==='senior'&&!a.streamIndependent&&!a.streams.some(s=>normalizeCombination(s)?normalizeCombination(s)===p.combination:normalizeStream(s)===p.stream))return false;
 }else if(!a.programmes.map(key).includes(p.program)||!a.disciplines.map(key).includes(p.discipline)||!a.periods.map(key).includes(p.period))return false;
 if(!a.subjects.every(s=>p.subjects.includes(normalizeSubject(s))))return false;
 return !topicId||[...a.topicIds,...a.parentTopicIds].includes(topicId);
}
