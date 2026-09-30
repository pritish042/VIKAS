import {identity,body,json,failure,throttle,HttpError} from '@/lib/api';
import {db} from '@/lib/db';
import {taskSchema} from '@/lib/validation';
export async function GET(req:Request){try{const u=await identity(req);const d=await db();return json({tasks:await d.collection('tasks').find({userId:u.id},{projection:{userId:0}}).sort({createdAt:-1}).limit(200).toArray()});}catch(e){return failure(e);}}
export async function POST(req:Request){try{const u=await identity(req);await throttle(u.id,'tasks');const p=await body(req,taskSchema);const d=await db();if(await d.collection('tasks').countDocuments({userId:u.id})>=200)throw new HttpError(400,'Your plan has reached 200 tasks. Remove old tasks first.');const task={...p,userId:u.id,status:'todo',createdAt:new Date()};const r=await d.collection('tasks').insertOne(task);return json({task:{...task,userId:undefined,_id:r.insertedId}},201);}catch(e){return failure(e);}}
