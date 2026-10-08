import {type Db} from 'mongodb';
import {evidenceSchema,recentProgressSchema,studentContextSchema,type MentorEvidence} from './mentor-contract';
import {profileSchema} from './validation';
import type {Profile} from './types';
export const asDate=(v:unknown)=>{const d=v instanceof Date?v:typeof v==='string'?new Date(v):null;return d&&Number.isFinite(d.getTime())?d.toISOString():null;};
export async function readStudentContext(d:Db,userId:string,topicIds:string[],lightweight=false){
 const raw=await d.collection('profiles').findOne({userId},{projection:{stage:1,level:1,stream:1,education:1,goal:1,interests:1,weeklyHours:1,bio:1,onboardingComplete:1,updatedAt:1},maxTimeMS:2000});
 let profile:Profile|null=null;
 if(raw){const parsed=profileSchema.safeParse(Object.fromEntries(Object.keys(profileSchema.shape).filter(k=>raw[k]!==undefined).map(k=>[k,raw[k]])));if(parsed.success)profile=parsed.data;}
 const evidence:MentorEvidence[]=[];
 const education=profile?[profile.stage,profile.level,profile.education?.program,profile.education?.discipline,profile.education?.board,...(profile.education?.subjects||[])].filter(Boolean).join(' · ').slice(0,1000):'';
 if(profile){
  evidence.push({source:'profile_self_report',sourceRef:'profile:education',topicId:'',text:`Onboarding: ${education}`.slice(0,500),at:asDate(raw?.updatedAt)});
  if(profile.goal)evidence.push({source:'profile_self_report',sourceRef:'profile:goal',topicId:'',text:profile.goal,at:asDate(raw?.updatedAt)});
  if(profile.bio)evidence.push({source:'profile_self_report',sourceRef:'profile:experience',topicId:'',text:profile.bio.slice(0,500),at:asDate(raw?.updatedAt)});
  evidence.push({source:'profile_self_report',sourceRef:'profile:preferences',topicId:'',text:`Interests: ${profile.interests.join(', ')}. Time available: ${profile.weeklyHours} hours/week.`.slice(0,500),at:asDate(raw?.updatedAt)});
 }
 if(lightweight)return {profile,context:studentContextSchema.parse({stage:profile?.stage||'',board:profile?.education?.board||'',goal:profile?.goal||'',education,evidence:evidence.slice(0,10),recentProgress:[]})};
 const memories=await d.collection('mentor_memories').find({userId,...(topicIds.length?{topicId:{$in:[...topicIds,'general']}}:{})},{maxTimeMS:2000}).sort({updatedAt:-1}).limit(10).toArray();
 for(const m of memories){const e=evidenceSchema.safeParse({source:'confirmed_self_report',sourceRef:m._id.toString(),topicId:m.topicId,text:m.text,at:asDate(m.updatedAt)});if(e.success)evidence.push(e.data);}
 if(topicIds.length){
  const attempts=await d.collection('topic_attempts').find({userId,topicId:{$in:topicIds}},{projection:{topicId:1,results:1,createdAt:1,version:1},maxTimeMS:2000}).sort({createdAt:-1}).limit(12).toArray();
  for(const a of attempts)for(const r of (a.results||[]).slice(0,8)){if(evidence.length>=30)break;const e=evidenceSchema.safeParse({source:'assessment',sourceRef:a._id.toString(),topicId:a.topicId,objective:r.objective,result:r.result,text:`Unvalidated topic check: ${r.objective} — ${r.result}`.slice(0,500),at:asDate(a.createdAt),version:a.version||undefined});if(e.success)evidence.push(e.data);}
  const tasks=await d.collection('tasks').find({userId,status:'done',$or:[{topicId:{$in:topicIds}},{topicAttemptRef:{$in:attempts.map(a=>a._id.toString())}}]},{projection:{title:1,topicId:1,topicAttemptRef:1,updatedAt:1,createdAt:1},maxTimeMS:2000}).sort({updatedAt:-1}).limit(6).toArray();
  for(const t of tasks)evidence.push({source:'completed_task',sourceRef:t._id.toString(),topicId:t.topicId||attempts.find(a=>a._id.toString()===t.topicAttemptRef)?.topicId||'',text:`Marked complete: ${String(t.title).slice(0,150)}. Completion does not establish mastery.`,at:asDate(t.updatedAt||t.createdAt)});
 }
 // Include recent activity even when no reviewed topic matches. Activity is not mastery evidence.
 const recentTasks=await d.collection('tasks').find({userId},{projection:{title:1,status:1,'feedback.outcome':1,'feedback.feeling':1,'feedback.reflection':1,updatedAt:1,createdAt:1},maxTimeMS:2000}).sort({updatedAt:-1,createdAt:-1}).limit(6).toArray();
 const recentProgress=recentTasks.flatMap(t=>{const parsed=recentProgressSchema.safeParse({title:String(t.title||'').slice(0,150),status:t.status,outcome:t.feedback?.outcome,feeling:t.feedback?.feeling,reflection:typeof t.feedback?.reflection==='string'?t.feedback.reflection.slice(0,500):'',at:asDate(t.updatedAt||t.createdAt)});return parsed.success?[parsed.data]:[];});
 return {profile,context:studentContextSchema.parse({stage:profile?.stage||'',board:profile?.education?.board||'',goal:profile?.goal||'',education,evidence:evidence.slice(0,36),recentProgress})};
}
