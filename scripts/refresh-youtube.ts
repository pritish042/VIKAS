import {db,mongoClient} from '../lib/db';
import {refreshStaleYoutubeVideos} from '../lib/youtube-service';

try {
  const result=await refreshStaleYoutubeVideos(await db());
  console.log(`YouTube refresh finished: ${result.checked} checked, ${result.refreshed} refreshed, ${result.unavailable} unavailable.`);
} catch(error) {
  console.error('YouTube metadata refresh failed:',error instanceof Error?error.name:'UnknownError');
  process.exitCode=1;
} finally {
  await mongoClient().close();
}
