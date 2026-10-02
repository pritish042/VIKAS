import {z} from 'zod';
import {identity,json} from '@/lib/api';
import {db} from '@/lib/db';
import {readStudentContext} from '@/lib/mentor-context';
import {approvedTopics} from '@/lib/mentor-knowledge';
import {mentorFailure} from '@/lib/mentor-api';
export async function GET(req:Request){try{
 const u=await identity(req),d=await db(),language=z.string().min(1).max(40).parse(new URL(req.url).searchParams.get('language')||'English');
 const {context}=await readStudentContext(d,u.id,[]);
 const memories=await d.collection('mentor_memories').find({userId:u.id},{projection:{userId:0}}).sort({updatedAt:-1}).limit(50).toArray();
 const seen=new Set<string>(),topics=(await approvedTopics(d,context,language)).filter(t=>{if(seen.has(t.topicId))return false;seen.add(t.topicId);return true;}).map(t=>({id:t.topicId,title:t.title}));
 return json({context,memories,topics});
}catch(e){return mentorFailure(e);}}
