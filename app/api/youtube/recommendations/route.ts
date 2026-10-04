import {identity,json,HttpError} from '@/lib/api';
import {db} from '@/lib/db';
import {youtubeFailure,requireYoutubeConsent} from '@/lib/youtube-api';
import {youtubeSearchSchema} from '@/lib/youtube-rules';
import {youtubeRecommendations} from '@/lib/youtube-service';
import type {Profile} from '@/lib/types';

export async function GET(req:Request) {
  try {
    const u=await identity(req);
    const params=new URL(req.url).searchParams;
    const keys=['subject','topic','language','difficulty','availableMinutes'];
    if([...params.keys()].some(key=>!keys.includes(key))||keys.some(key=>params.getAll(key).length!==1)) throw new HttpError(400,'Use all required video-search filters once.');
    const input=youtubeSearchSchema.parse({
      subject:params.get('subject'),topic:params.get('topic'),language:params.get('language'),
      difficulty:params.get('difficulty'),availableMinutes:Number(params.get('availableMinutes')),
    });
    const d=await db();
    await requireYoutubeConsent(d,u.id);
    const profile=await d.collection<Profile>('profiles').findOne({userId:u.id},{projection:{userId:0}});
    if(!profile) return json({error:'Save your education profile before searching for videos.'},400);
    return json(await youtubeRecommendations(d,u.id,profile,input));
  } catch(error) {
    return youtubeFailure(error);
  }
}
