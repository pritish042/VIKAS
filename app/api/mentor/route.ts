import {identity,body,json,failure,throttle} from '@/lib/api';
import {db} from '@/lib/db';
import {mentorRequest} from '@/lib/mentor-contract';
import {runMentor} from '@/lib/mentor-workflow';
import {mentorFailure} from '@/lib/mentor-api';
export const maxDuration=35;
export async function GET(req:Request){try{const u=await identity(req);const d=await db();const rows=await d.collection('messages').find({userId:u.id},{projection:{userId:0,acceptance:0,toolCalls:0}}).sort({createdAt:-1}).limit(30).toArray();return json({messages:rows.reverse()});}catch(e){return failure(e);}}
export async function DELETE(req:Request){try{const u=await identity(req);const d=await db();await d.collection('messages').deleteMany({userId:u.id});return json({ok:true});}catch(e){return failure(e);}}
export async function POST(req:Request){try{
 const u=await identity(req);await throttle(u.id,'mentor',5);const p=await body(req,mentorRequest),d=await db();
 const result=await runMentor(d,u.id,p,{key:process.env.GEMINI_API_KEY,model:process.env.GEMINI_MODEL});
 const now=new Date();await d.collection('messages').insertOne({userId:u.id,role:'user',content:p.message,createdAt:now});
 const saved=await d.collection('messages').insertOne({userId:u.id,role:'assistant',content:result.answer,mentor:result.mentor,toolCalls:result.toolCalls,createdAt:new Date(now.getTime()+1)});
 return json({answer:result.answer,mentor:result.mentor,id:saved.insertedId});
}catch(e){return mentorFailure(e);}}
