import {identity,body,json,throttle} from '@/lib/api';
import {db} from '@/lib/db';
import {listLabFiles,saveLabFile} from '@/lib/aprajita/service';
import {fileSchema} from '@/lib/aprajita/contract';
import {labFailure} from '@/lib/aprajita/api';
export async function GET(req:Request){try{const user=await identity(req);return json({files:await listLabFiles(await db(),user.id)});}catch(e){return labFailure(e);}}
export async function POST(req:Request){try{const user=await identity(req);await throttle(user.id,'aprajita-save',20);return json({file:await saveLabFile(await db(),user.id,await body(req,fileSchema))});}catch(e){return labFailure(e);}}
