import {createHash} from 'node:crypto';
import type {Db,Document} from 'mongodb';
import type {Profile} from '../types';
import {labEligibility,READINESS_VERSION} from './access';
import {gradeReadiness} from './assessment';
import {fileSchema,readinessSchema,type LabFile} from './contract';
export class LabError extends Error {constructor(public status:number,message:string){super(message);}}
export async function labAccess(db:Db,userId:string){
 const profile=await db.collection<Profile & Document>('profiles').findOne({userId});
 const eligibility=labEligibility(profile);
 const readiness=eligibility.eligible&&eligibility.requiresAssessment?await db.collection<Document & {_id:string}>('aprajita_readiness').findOne({_id:userId,userId,version:READINESS_VERSION,passed:true}):null;
 return {...eligibility,version:READINESS_VERSION,ready:eligibility.eligible&&(!eligibility.requiresAssessment||!!readiness)};
}
export async function requireLab(db:Db,userId:string){const access=await labAccess(db,userId);if(!access.ready)throw new LabError(403,access.reason);return access;}
export async function submitReadiness(db:Db,userId:string,value:unknown){
 const access=await labAccess(db,userId);if(!access.eligible||!access.requiresAssessment)throw new LabError(403,access.reason);
 const input=readinessSchema.parse(value);if(input.version!==READINESS_VERSION)throw new LabError(409,'The questions changed. Reload the check.');
 const result=gradeReadiness(input.answers);
 // A successful pass for this version remains valid on later practice attempts.
 if(result.passed)await db.collection<Document & {_id:string}>('aprajita_readiness').updateOne({_id:userId,userId},{$set:{userId,version:READINESS_VERSION,passed:true,score:result.score,passedAt:new Date()}},{upsert:true});
 return result;
}
export async function listLabFiles(db:Db,userId:string){
 await requireLab(db,userId);const rows=await db.collection('aprajita_files').find({userId}).sort({updatedAt:-1}).limit(30).toArray();
 return rows.map(r=>({id:String(r._id),language:r.language,name:r.name,source:r.source,updatedAt:new Date(r.updatedAt).toISOString()})) as LabFile[];
}
export async function saveLabFile(db:Db,userId:string,value:unknown){
 await requireLab(db,userId);const input=fileSchema.parse(value);
 const id=createHash('sha256').update(JSON.stringify([userId,input.language,input.name])).digest('hex');
 const files=db.collection<Document & {_id:string}>('aprajita_files');
 if(!await files.findOne({_id:id,userId})&&await files.countDocuments({userId})>=20)throw new LabError(400,'You have 20 files. Reuse an existing name to save your changes.');
 const now=new Date();await files.updateOne({_id:id,userId},{$set:{...input,updatedAt:now},$setOnInsert:{userId,createdAt:now}},{upsert:true});
 return {id,...input,updatedAt:now.toISOString()};
}
