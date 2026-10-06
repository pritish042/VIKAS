import 'server-only';
import type {Db} from 'mongodb';
import type {Profile} from './types';
import {getYoutubeVideoMetadata,searchYoutubeVideos} from './youtube-provider';
import {
  addYoutubeVideoToPlan,discoverYoutubeVideos as discover,reviewYoutubeVideo,listYoutubeReviewQueue,
  saveYoutubeFeedback,youtubeRecommendations,youtubeConsent,saveYoutubeConsent,refreshStaleYoutubeVideos as refresh,
  providerMetadata,
} from './youtube-service-core';

export {addYoutubeVideoToPlan,listYoutubeReviewQueue,reviewYoutubeVideo,saveYoutubeFeedback,youtubeRecommendations,youtubeConsent,saveYoutubeConsent,providerMetadata};
export function discoverYoutubeVideos(db:Db,userId:string,profile:Profile,input:Parameters<typeof discover>[3],req:Request) {
  return discover(db,userId,profile,input,req,searchYoutubeVideos);
}
export function refreshStaleYoutubeVideos(db:Db,now=new Date()) {
  return refresh(db,getYoutubeVideoMetadata,now);
}
