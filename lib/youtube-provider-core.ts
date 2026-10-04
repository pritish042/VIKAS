import {YoutubeError,providerError,youtubeLanguageCode,type YoutubeLanguage} from './youtube-rules';

const API_ROOT='https://www.googleapis.com/youtube/v3';
const REQUEST_TIMEOUT_MS=8_000;
export interface YoutubeApiVideo {
  id?:unknown;
  snippet?:{title?:unknown;channelTitle?:unknown;description?:unknown;publishedAt?:unknown;liveBroadcastContent?:unknown;thumbnails?:Record<string,{url?:unknown}>};
  contentDetails?:{duration?:unknown};
  status?:{privacyStatus?:unknown;embeddable?:unknown;madeForKids?:unknown;selfDeclaredMadeForKids?:unknown};
}
type YoutubePayload={items?:unknown;error?:{errors?:{reason?:string}[]}};

export async function youtubeJson(path:string,params:Record<string,string>,apiKey:string|undefined,fetcher:typeof fetch=fetch,timeoutMs=REQUEST_TIMEOUT_MS):Promise<YoutubePayload> {
  const key=apiKey?.trim();
  if(!key) throw new YoutubeError(503,'missing_key','Video discovery is not configured yet. Please try again later.');
  const url=new URL(`${API_ROOT}/${path}`);
  for(const [name,value] of Object.entries(params))url.searchParams.set(name,value);
  url.searchParams.set('key',key);
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try {
    const response=await fetcher(url,{signal:controller.signal,cache:'no-store'});
    let payload:YoutubePayload;
    try {
      const parsed:unknown=await response.json();
      if(!parsed||typeof parsed!=='object') throw new Error('Invalid JSON payload');
      payload=parsed as YoutubePayload;
    } catch {
      throw new YoutubeError(503,'provider_error','YouTube returned an unreadable response. Please try again later.');
    }
    if(!response.ok) throw providerError(response.status,payload.error?.errors?.[0]?.reason||'');
    if(!Array.isArray(payload.items)) throw new YoutubeError(503,'provider_error','YouTube returned incomplete video data. Please try again later.');
    return payload;
  } catch(error) {
    if(error instanceof YoutubeError) throw error;
    if(controller.signal.aborted) throw new YoutubeError(503,'timed_out','YouTube took too long to respond. Please try again later.');
    throw new YoutubeError(503,'network_error','YouTube could not be reached. Check the network and try again later.');
  } finally {
    clearTimeout(timeout);
  }
}

function videoIds(items:unknown[]):string[] {
  return [...new Set(items.map(item=>{
    if(!item||typeof item!=='object')return '';
    const id=(item as {id?:{videoId?:unknown}}).id?.videoId;
    return typeof id==='string'&&/^[A-Za-z0-9_-]{11}$/.test(id)?id:'';
  }).filter(Boolean))];
}

export async function searchYoutubeVideos(query:string,language:YoutubeLanguage,apiKey:string|undefined,fetcher:typeof fetch=fetch):Promise<YoutubeApiVideo[]> {
  const search=await youtubeJson('search',{part:'snippet',type:'video',q:query,safeSearch:'strict',videoEmbeddable:'true',videoSyndicated:'true',relevanceLanguage:youtubeLanguageCode(language),regionCode:'IN',maxResults:'8',order:'relevance'},apiKey,fetcher);
  const ids=videoIds(search.items as unknown[]);
  if(!ids.length)return [];
  const metadata=await youtubeJson('videos',{part:'snippet,contentDetails,status',id:ids.join(',')},apiKey,fetcher);
  return metadata.items as YoutubeApiVideo[];
}

export async function getYoutubeVideoMetadata(ids:string[],apiKey:string|undefined,fetcher:typeof fetch=fetch):Promise<YoutubeApiVideo[]> {
  if(!ids.length)return [];
  const metadata=await youtubeJson('videos',{part:'snippet,contentDetails,status',id:ids.join(',')},apiKey,fetcher);
  return metadata.items as YoutubeApiVideo[];
}
