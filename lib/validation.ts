import { z } from 'zod';
import { educationErrors } from './education';
const text = (max: number) => z.string().trim().max(max);
export const stageSchema = z.enum(['school','senior','vocational','undergraduate','postgraduate']);
export const urlSchema = z.union([z.literal(''), z.url().max(1500).refine(v => ['http:','https:'].includes(new URL(v).protocol), 'Use an https:// or http:// link.')]);
export const educationSchema = z.object({board:text(150),className:text(100),program:text(150),discipline:text(150),stream:text(150),subjects:z.array(text(100).min(1)).max(40).refine(values=>new Set(values).size===values.length,'Choose each subject only once.'),period:text(100)}).strict();
export const profileSchema = z.object({stage: stageSchema, level:text(100).min(1), stream:text(150), interests:z.array(text(60).min(1)).max(15), goal:text(500), weeklyHours:z.number().min(0).max(60), bio:text(1000), onboardingComplete:z.boolean(),education:educationSchema.optional()}).strict().superRefine((p,ctx)=>{
 if(!p.education)return;
 for(const [key,message] of Object.entries(educationErrors(p.stage,p.education)))ctx.addIssue({code:"custom",path:["education",key],message});
 const level=p.stage==='school'||p.stage==='senior'?p.education.className:p.education.period;
 const stream=p.stage==='school'?'':p.stage==='senior'?p.education.stream:p.education.discipline;
 if(p.level!==level||p.stream!==stream)ctx.addIssue({code:"custom",path:["education"],message:"Education details must match the profile class, year and field."});
});
export const taskSchema = z.object({title:text(150).min(1),notes:text(2000),minutes:z.number().int().min(5).max(600)}).strict();
export const recordSchema = z.object({type:z.enum(['skill','project','certification','achievement']),title:text(150).min(1),description:text(2000),url:urlSchema}).strict();
export const resourceSchema = z.object({title:text(150).min(1),description:text(1500).min(10),url:urlSchema.refine(v=>!!v,'Add a resource link.'),stage:z.union([stageSchema,z.literal('all')]),stream:text(150),minutes:z.number().int().min(0).max(600)}).strict();
export const statusSchema = z.object({status:z.enum(['todo','done'])}).strict();
export const publicationSchema = z.object({status:z.enum(['published','pending'])}).strict();
export const messageSchema = z.object({message:text(2000).min(1)}).strict();
