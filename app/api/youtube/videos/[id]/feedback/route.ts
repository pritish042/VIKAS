import {identity,body,json,HttpError,objectId} from '@/lib/api';
import {db} from '@/lib/db';
import {youtubeFailure,requireYoutubeConsent} from '@/lib/youtube-api';
import {youtubeFeedbackSchema} from '@/lib/youtube-rules';
import {saveYoutubeFeedback} from '@/lib/youtube-service';
type Context={params:Promise<{id:string}>};

export async function POST(req:Request,context:Context) {
  try {
    const user=await identity(req);
    const {feedback}=await body(req,youtubeFeedbackSchema);
    const d=await db();
    await requireYoutubeConsent(d,user.id);
    const ok=await saveYoutubeFeedback(d,user.id,objectId((await context.params).id),feedback);
    if(!ok) throw new HttpError(404,'Approved video not found.');
    return json({ok:true});
  } catch(error) {
    return youtubeFailure(error);
  }
}
