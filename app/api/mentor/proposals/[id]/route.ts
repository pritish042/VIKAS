import {identity,body,json,objectId,throttle} from '@/lib/api';
import {db} from '@/lib/db';
import {proposalDecisionSchema} from '@/lib/validation';
import {decideMentorProposal} from '@/lib/mentor-actions';
import {mentorFailure} from '@/lib/mentor-api';
export async function PATCH(req:Request,c:{params:Promise<{id:string}>}){try{const u=await identity(req);await throttle(u.id,'mentor-proposals',15);return json(await decideMentorProposal(await db(),u.id,objectId((await c.params).id),await body(req,proposalDecisionSchema)));}catch(e){return mentorFailure(e);}}
