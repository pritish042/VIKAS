import {identity,body,json,editor,throttle} from '@/lib/api';
import {db} from '@/lib/db';
import {knowledgeInput} from '@/lib/mentor-contract';
import {requireReviewer,submitKnowledge} from '@/lib/mentor-knowledge';
import {mentorFailure} from '@/lib/mentor-api';
export async function GET(req:Request){try{const u=await identity(req);requireReviewer(editor(u));const d=await db();const knowledge=await d.collection('mentor_knowledge').find({},{projection:{createdBy:0,reviewedBy:0}}).sort({createdAt:-1}).limit(100).toArray();const definitions=await d.collection('topic_assessments').find({status:'active'},{projection:{topic:1,questions:1}}).limit(100).toArray();return json({knowledge,assessmentMappings:definitions.map(a=>({topicId:a.topic.id,title:a.topic.title,objectives:a.questions.map((q:{objective:string})=>q.objective)}))});}catch(e){return mentorFailure(e);}}
export async function POST(req:Request){try{const u=await identity(req);requireReviewer(editor(u));await throttle(u.id,'mentor-knowledge',10);return json(await submitKnowledge(await db(),editor(u),u.id,await body(req,knowledgeInput)),201);}catch(e){return mentorFailure(e);}}
