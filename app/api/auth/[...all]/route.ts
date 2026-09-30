import { getAuth } from '@/lib/auth';
import { configured } from '@/lib/db';
import { failure, json } from '@/lib/api';
export const runtime='nodejs';
async function handle(request:Request) {
 if(!configured())return json({error:'Accounts are not available yet. Please try again later.'},503);
 try{return await getAuth().handler(request);}catch(e){return failure(e);}
}
export const GET=handle; export const POST=handle;
