import {identity,body,json} from '@/lib/api';
import {db} from '@/lib/db';
import {youtubeFailure} from '@/lib/youtube-api';
import {youtubeConsentSchema} from '@/lib/youtube-rules';
import {saveYoutubeConsent,youtubeConsent} from '@/lib/youtube-service';

export async function GET(req:Request) {
  try {
    const user=await identity(req);
    return json({accepted:await youtubeConsent(await db(),user.id)});
  } catch(error) {
    return youtubeFailure(error);
  }
}

export async function POST(req:Request) {
  try {
    const user=await identity(req);
    const {accepted}=await body(req,youtubeConsentSchema);
    return json({accepted:await saveYoutubeConsent(await db(),user.id,accepted)});
  } catch(error) {
    return youtubeFailure(error);
  }
}
