import 'server-only';
import {getYoutubeVideoMetadata as loadMetadata,searchYoutubeVideos as searchVideos,type YoutubeApiVideo} from './youtube-provider-core';
import type {YoutubeLanguage} from './youtube-contract';

export type {YoutubeApiVideo} from './youtube-provider-core';

export function searchYoutubeVideos(query:string,language:YoutubeLanguage):Promise<YoutubeApiVideo[]> {
  return searchVideos(query,language,process.env.YOUTUBE_API_KEY);
}

export function getYoutubeVideoMetadata(ids:string[]):Promise<YoutubeApiVideo[]> {
  return loadMetadata(ids,process.env.YOUTUBE_API_KEY);
}
