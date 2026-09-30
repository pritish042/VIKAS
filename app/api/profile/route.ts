import { identity,body,json,failure,editor,throttle } from '@/lib/api';
import { db } from '@/lib/db';
import { profileSchema } from '@/lib/validation';
import { profileUpdate } from '@/lib/profile-update';
export async function GET(req:Request){try{const u=await identity(req);const d=await db();const p=await d.collection('profiles').findOne({userId:u.id},{projection:{_id:0,userId:0,createdAt:0,updatedAt:0}});return json({profile:p,user:{name:u.name,email:u.email},editor:editor(u)});}catch(e){return failure(e);}}
export async function PUT(req:Request){try{const u=await identity(req);await throttle(u.id,'profile');const p=await body(req,profileSchema);const d=await db();await d.collection('profiles').updateOne({userId:u.id},profileUpdate(p),{upsert:true});return json({profile:p});}catch(e){return failure(e);}}
