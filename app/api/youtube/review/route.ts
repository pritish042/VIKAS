import {identity,editor,HttpError,json} from '@/lib/api';
import {db} from '@/lib/db';
import {youtubeFailure,requireYoutubeConsent} from '@/lib/youtube-api';
import {listYoutubeReviewQueue} from '@/lib/youtube-service';

export async function GET(req:Request) {
  try {
    const user=await identity(req);
    if(!editor(user)) throw new HttpError(403,'Only a verified content editor can review YouTube videos.');
    const d=await db();
    await requireYoutubeConsent(d,user.id);
    return json({videos:await listYoutubeReviewQueue(d)});
  } catch(error) {
    return youtubeFailure(error);
  }
}
