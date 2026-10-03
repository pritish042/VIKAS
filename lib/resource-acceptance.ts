import {ObjectId,type Db} from 'mongodb';
import {stableId} from './catalogue-import';
import {goalRef} from './progress';
import {resourceEligible,type AcademicResource} from './resource-eligibility';
import {TopicError} from './topic-service';
import type {Profile} from './types';
export async function acceptChapterResource(d:Db,userId:string,id:ObjectId,minutes:number){
 const profile=await d.collection<Profile & import('mongodb').Document>('profiles').findOne({userId});
 if(!profile?.goal?.trim())throw new TopicError(400,'Save a personal goal in your profile first.');
 const r=await d.collection<AcademicResource & import('mongodb').Document>('resources').findOne({_id:id});
 if(!r?.chapterMappings||!resourceEligible(r,profile))throw new TopicError(404,'This approved video is unavailable for your saved profile.');
 if(!Number.isInteger(minutes)||minutes<5||minutes>120)throw new TopicError(400,'Choose a session between 5 and 120 minutes.');
 const reference=goalRef(userId,profile.goal),taskId=stableId(`resource-task:${userId}:${id}:${reference}`);
 if(!await d.collection('tasks').findOne({_id:taskId,userId})&&await d.collection('tasks').countDocuments({userId})>=200)throw new TopicError(400,'Remove an old task before adding another.');
 const now=new Date();
 try{await d.collection('tasks').updateOne({_id:taskId,userId},{$setOnInsert:{userId,title:`Study: ${r.title}`.slice(0,150),notes:'A learning session you chose. Opening the video does not complete this task.',minutes,status:'todo',goalRef:reference,goalTitle:profile.goal,resourceRef:id.toHexString(),resourceUrl:r.url,createdAt:now,updatedAt:now}},{upsert:true});}catch(e){if((e as {code?:number}).code!==11000||!await d.collection('tasks').findOne({_id:taskId,userId}))throw e;}
 return {taskRef:taskId.toHexString()};
}
