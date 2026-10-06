import {identity,body,json,HttpError} from '@/lib/api';
import {db} from '@/lib/db';
import {youtubeFailure,requireYoutubeConsent} from '@/lib/youtube-api';
import {youtubeSearchSchema} from '@/lib/youtube-rules';
import {discoverYoutubeVideos} from '@/lib/youtube-service';
import type {Profile} from '@/lib/types';

export async function POST(req:Request) {
  try {
    const u=await identity(req);
    const input=await body(req,youtubeSearchSchema);
    const d=await db();
    await requireYoutubeConsent(d,u.id);
    const profile=await d.collection<Profile>('profiles').findOne({userId:u.id},{projection:{userId:0}});
    if(!profile) throw new HttpError(400,'Save your education profile before searching for videos.');
    const result=await discoverYoutubeVideos(d,u.id,profile,input,req);
    return json({...result,message:result.candidateCount?`${result.candidateCount} candidate${result.candidateCount===1?'':'s'} require reviewer approval before students can see them.`:'No reviewable candidates were found. Try a more specific topic.'});
  } catch(error) {
    return youtubeFailure(error);
  }
}
