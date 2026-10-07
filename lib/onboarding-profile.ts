import {createHash} from 'node:crypto';
import type {Db,Document} from 'mongodb';
import {z} from 'zod';
import {profileSchema} from './validation';
import {emptyProfile,type Profile} from './types';
import {seniorSubjectIssues} from './senior-subjects';

export const onboardingSaveSchema=z.object({profile:profileSchema.refine(p=>!!p.education,'Complete your education details.').refine(p=>p.onboardingComplete,'Confirm your completed setup.').refine(p=>p.stage!=='senior'||!!p.education&&!seniorSubjectIssues(p.education).length,'Review your subject combination.'),expectedRevision:z.string().regex(/^[a-f0-9]{64}$/),confirmed:z.literal(true)}).strict();
export class OnboardingConflict extends Error {}
function publicProfile(row:Document|null):Profile|null{
 if(!row)return null;
 return Object.fromEntries([...Object.keys(emptyProfile),'education'].filter(k=>row[k]!==undefined).map(k=>[k,row[k]])) as unknown as Profile;
}
function revision(userId:string,row:Document|null){return createHash('sha256').update(JSON.stringify([userId,publicProfile(row),row?.updatedAt||null])).digest('hex');}
export async function readOnboardingProfile(d:Db,userId:string){const row=await d.collection('profiles').findOne({userId});return {profile:publicProfile(row),revision:revision(userId,row),accountId:userId};}
export async function saveOnboardingProfile(d:Db,userId:string,input:unknown){
 const parsed=onboardingSaveSchema.parse(input);const col=d.collection('profiles');const row=await col.findOne({userId});
 if(revision(userId,row)!==parsed.expectedRevision)throw new OnboardingConflict('Your saved profile changed. Review the latest version before saving.');
 // The entire previous document participates in the comparison, including legacy fields.
 const filter=row?{userId,$and:Object.entries(row).filter(([key])=>key!=='userId').map(([key,value])=>({[key]:value}))}:{userId};
 const now=new Date();const result=await col.updateOne(filter,row?{$set:{...parsed.profile,updatedAt:now}}:{$setOnInsert:{...parsed.profile,createdAt:now,updatedAt:now}},{upsert:!row});
 if(row?!result.matchedCount:!result.upsertedCount)throw new OnboardingConflict('Your saved profile changed. Review it before saving.');
 return readOnboardingProfile(d,userId);
}
