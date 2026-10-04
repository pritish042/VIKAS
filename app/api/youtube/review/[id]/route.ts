import {identity,editor,body,json,HttpError,objectId} from '@/lib/api';
import {db} from '@/lib/db';
import {youtubeFailure,requireYoutubeConsent} from '@/lib/youtube-api';
import {youtubeReviewSchema} from '@/lib/youtube-rules';
import {reviewYoutubeVideo} from '@/lib/youtube-service';
type Context={params:Promise<{id:string}>};

export async function PATCH(req:Request,context:Context) {
  try {
    const user=await identity(req);
    if(!editor(user)) throw new HttpError(403,'Only a verified content editor can review YouTube videos.');
    const action=await body(req,youtubeReviewSchema);
    const d=await db();
    await requireYoutubeConsent(d,user.id);
    const ok=await reviewYoutubeVideo(d,objectId((await context.params).id),user.id,action);
    if(!ok) throw new HttpError(404,'YouTube candidate not found.');
    return json({ok:true});
  } catch(error) {
    return youtubeFailure(error);
  }
}
