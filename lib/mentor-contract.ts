import {z} from 'zod';
import {stageSchema,taskSchema} from './validation';
import {safeExternalUrl} from './topic-rules';
const text=(n:number)=>z.string().trim().min(1).max(n);
export const topicKey=text(100).regex(/^[A-Za-z0-9_-]+$/);
export const mentorRequest=z.object({message:text(2000),topicId:topicKey.optional(),language:text(40).default('English'),choice:z.enum(['consider','refresher','continue']).default('consider')}).strict();
export const knowledgeInput=z.object({
 topicId:topicKey,title:text(150),subject:text(100),stage:stageSchema,language:text(40),
 boardMode:z.enum(['general','specific']),boards:z.array(text(150)).max(40),
 sourceUrl:safeExternalUrl,license:text(300),rightsConfirmed:z.literal(true),
 sections:z.array(z.object({heading:text(150),text:text(1800)}).strict()).min(1).max(6),
 prerequisites:z.array(z.object({topicId:topicKey,title:text(150),reason:text(500),objectives:z.array(text(500)).min(1).max(8),evidenceMaxAgeDays:z.number().int().min(1).max(365).default(90)}).strict()).max(6),
}).strict().superRefine((v,c)=>{
 if((v.boardMode==='specific'&&!v.boards.length)||(v.boardMode==='general'&&v.boards.length))c.addIssue({code:'custom',path:['boards'],message:'Specific content needs boards; general content must leave boards empty.'});
 if(new Set(v.prerequisites.map(p=>p.topicId)).size!==v.prerequisites.length||v.prerequisites.some(p=>p.topicId===v.topicId))c.addIssue({code:'custom',path:['prerequisites'],message:'Use unique prerequisites distinct from the target topic.'});
 if(v.sections.reduce((n,s)=>n+s.text.length,0)>7000)c.addIssue({code:'custom',path:['sections'],message:'Keep the combined text under 7,000 characters.'});
});
export type KnowledgeInput=z.infer<typeof knowledgeInput>;
export const reviewInput=z.object({decision:z.enum(['approve','withdraw']),version:text(64)}).strict();
export const memoryInput=z.object({topicId:topicKey,text:text(300),confirmed:z.literal(true),messageRef:z.string().regex(/^[a-f\d]{24}$/i).optional()}).strict();
export const memoryEdit=z.object({text:text(300),confirmed:z.literal(true)}).strict();
export const evidenceSchema=z.object({source:z.enum(['profile_self_report','confirmed_self_report','assessment','completed_task']),sourceRef:text(100),topicId:z.string().max(100),text:text(500),at:z.string().datetime().nullable(),objective:z.string().max(500).optional(),result:z.enum(['understood','revisit','not_sure']).optional(),version:z.string().max(100).optional()}).strict();
export type MentorEvidence=z.infer<typeof evidenceSchema>;
export const studentContextSchema=z.object({stage:z.string().max(30),board:z.string().max(150),goal:z.string().max(500),education:z.string().max(1000),evidence:z.array(evidenceSchema).max(36)}).strict();
export type StudentContext=z.infer<typeof studentContextSchema>;
export const prerequisiteResultSchema=z.object({topicId:topicKey,title:text(150),reason:text(500),status:z.enum(['supported','revisit','not_checked']),explanation:text(1000),evidence:z.array(evidenceSchema).max(12)}).strict();
export type PrerequisiteResult=z.infer<typeof prerequisiteResultSchema>;
export const passageSchema=z.object({id:text(100),knowledgeRef:text(24),title:text(150),heading:text(150),text:text(1800),sourceUrl:safeExternalUrl,version:text(64),reviewedAt:z.string().datetime(),topicId:topicKey}).strict();
export type Passage=z.infer<typeof passageSchema>;
export const linkSchema=z.object({id:text(24),title:text(150),url:safeExternalUrl,topicId:topicKey}).strict();
export const retrievalSchema=z.object({passages:z.array(passageSchema).max(4),resources:z.array(linkSchema).max(3),notice:z.string().max(500)}).strict();
export const mentorProposalSchema=taskSchema.extend({topicId:z.string().max(100),explanation:text(1000),status:z.literal('pending')}).strict();
export const modelAnswerSchema=z.object({sentences:z.array(z.object({text:text(800),citations:z.array(text(100)).min(1).max(4)}).strict()).min(1).max(4),memorySuggestion:z.object({topicId:topicKey,text:text(300)}).strict().optional()}).strict();
export interface MentorResponse {
 prerequisiteSource?:{title:string;url:string;version:string;reviewedAt:string};
 topic:{id:string;title:string}|null;prerequisites:PrerequisiteResult[];evidence:MentorEvidence[];uncertainty:string[];
 passages:Passage[];resources:z.infer<typeof linkSchema>[];providerStatus:'used'|'missing_key'|'unavailable'|'insufficient_knowledge';
 proposal:z.infer<typeof mentorProposalSchema>|{title:string;notes:string;minutes:number;explanation:string;status:'accepted'|'rejected';taskRef?:string};
 memorySuggestion?:{topicId:string;text:string};
}
