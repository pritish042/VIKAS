import {identity,body,json,throttle} from '@/lib/api';
import {db} from '@/lib/db';
import {memoryInput} from '@/lib/mentor-contract';
import {saveMentorMemory} from '@/lib/mentor-actions';
import {mentorFailure} from '@/lib/mentor-api';
export async function POST(req:Request){try{const u=await identity(req);await throttle(u.id,'mentor-memory',15);return json(await saveMentorMemory(await db(),u.id,await body(req,memoryInput)),201);}catch(e){return mentorFailure(e);}}
