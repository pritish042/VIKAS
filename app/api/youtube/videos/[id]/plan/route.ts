import {identity,json,HttpError,objectId,throttle} from '@/lib/api';
import {db} from '@/lib/db';
import {youtubeFailure,requireYoutubeConsent} from '@/lib/youtube-api';
import {addYoutubeVideoToPlan} from '@/lib/youtube-service';
import type {Profile} from '@/lib/types';
type Context={params:Promise<{id:string}>};

export async function POST(req:Request,context:Context) {
  try {
    const user=await identity(req);
    await throttle(user.id,'tasks');
    const d=await db();
    await requireYoutubeConsent(d,user.id);
    const profile=await d.collection<Profile>('profiles').findOne({userId:user.id},{projection:{userId:0}});
    if(!profile) throw new HttpError(400,'Save your education profile before adding a video to your plan.');
    const taskId=await addYoutubeVideoToPlan(d,user.id,objectId((await context.params).id),profile);
    if(!taskId) throw new HttpError(404,'This video is not currently available for your saved study profile.');
    return json({taskId:String(taskId),message:'Added to your plan. Opening a YouTube video will not mark this task complete.'},201);
  } catch(error) {
    return youtubeFailure(error);
  }
}
