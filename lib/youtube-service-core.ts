import {createHash} from 'node:crypto';
import {ObjectId,type Db,type Document} from 'mongodb';
import type {Profile} from './types';
import {goalRef} from './progress';
import type {YoutubeApiVideo} from './youtube-provider-core';
import {
  buildYoutubeQuery,discoveryFingerprint,durationSeconds,isClearlyUnrelated,isPromotional,
  recommendationReason,studyContext,YoutubeError,type YoutubeSearchInput,type YoutubeStudyContext,
} from './youtube-rules';

const CACHE_MS=24*60*60*1000;
const MAX_VIDEO_SECONDS=3*60*60;
const MIN_VIDEO_SECONDS=3*60;
const MAX_DISCOVERY_PER_DAY=3;
const MAX_IP_DISCOVERY_PER_DAY=12;
const REVIEW_MAX_AGE_MS=30*24*60*60*1000;
export const YOUTUBE_TERMS_VERSION='2026-10-03';

interface VideoMetadata {
  title:string;channelTitle:string;thumbnailUrl:string;descriptionExcerpt:string;duration:string;durationSeconds:number;
  publishedAt:string;privacyStatus:'public';embeddable:true;liveBroadcastContent:string;madeForKids:boolean|null;selfDeclaredMadeForKids:boolean|null;
}
interface YoutubeCandidate extends Document {
  _id?:ObjectId;youtubeId:string;canonicalUrl:string;metadata:VideoMetadata;
  tags:{pathway:string;subject:string;topic:string;classOrYear:string;board:string;branchOrTrade:string};
  requestedDifficulty:string;intendedLanguage:string;searchQuery:string;whyDiscovered:string;
  reviewStatus:'pending'|'approved'|'rejected'|'inactive';reviewerId?:string;reviewedAt?:Date;
  discoveredFrom:{source:'student_explicit_search';fingerprint:string};fetchedAt:Date;refreshedAt:Date;
  isActive:boolean;availability?:'available'|'unavailable';lastRefreshAttemptAt?:Date;refreshFailure?:string;
}

function stringValue(value:unknown):string { return typeof value==='string'?value:''; }

export function providerMetadata(video:YoutubeApiVideo):VideoMetadata|null {
  const id=stringValue(video.id),snippet=video.snippet,status=video.status;
  if(!/^[A-Za-z0-9_-]{11}$/.test(id)||!snippet||!status||status.privacyStatus!=='public'||status.embeddable!==true) return null;
  if(typeof snippet.title!=='string'||!snippet.title.trim()||typeof snippet.channelTitle!=='string'||!snippet.channelTitle.trim()||
    typeof snippet.description!=='string'||typeof snippet.publishedAt!=='string'||!Number.isFinite(Date.parse(snippet.publishedAt))||
    typeof snippet.liveBroadcastContent!=='string'||snippet.liveBroadcastContent!=='none') return null;
  const seconds=durationSeconds(stringValue(video.contentDetails?.duration));
  if(!seconds||seconds<MIN_VIDEO_SECONDS||seconds>MAX_VIDEO_SECONDS) return null;
  const thumbnails=snippet.thumbnails||{};
  const thumbnailUrl=['maxres','standard','high','medium','default'].map(name=>thumbnails[name]?.url).find(url=>typeof url==='string'&&/^https:\/\/i\.ytimg\.com\//.test(url));
  if(typeof thumbnailUrl!=='string') return null;
  return {
    title:snippet.title.trim().slice(0,300),channelTitle:snippet.channelTitle.trim().slice(0,200),thumbnailUrl,
    descriptionExcerpt:snippet.description.trim().slice(0,500),duration:stringValue(video.contentDetails?.duration),
    durationSeconds:seconds,publishedAt:snippet.publishedAt,privacyStatus:'public',embeddable:true,
    liveBroadcastContent:snippet.liveBroadcastContent,madeForKids:typeof status.madeForKids==='boolean'?status.madeForKids:null,
    selfDeclaredMadeForKids:typeof status.selfDeclaredMadeForKids==='boolean'?status.selfDeclaredMadeForKids:null,
  };
}

function candidateTags(context:YoutubeStudyContext) {
  return {pathway:context.pathway,subject:context.subject,topic:context.topic,classOrYear:context.classOrYear,board:context.board,branchOrTrade:context.branchOrTrade};
}
function candidateFor(video:YoutubeApiVideo,context:YoutubeStudyContext,query:string,fingerprint:string,now:Date):Omit<YoutubeCandidate,'_id'>|null {
  const metadata=providerMetadata(video);
  if(!metadata||isClearlyUnrelated(metadata.title,metadata.descriptionExcerpt,context.subject,context.topic)||isPromotional(metadata.title,metadata.descriptionExcerpt)) return null;
  return {
    youtubeId:stringValue(video.id),canonicalUrl:`https://www.youtube.com/watch?v=${stringValue(video.id)}`,metadata,
    tags:candidateTags(context),requestedDifficulty:context.difficulty,intendedLanguage:context.language,searchQuery:query,
    whyDiscovered:`YouTube returned a public, embeddable recording for the bounded ${context.pathway} ${context.subject} ${context.topic} lesson query. VIKAS checked the returned title and description for topic relevance.`,
    reviewStatus:'pending',discoveredFrom:{source:'student_explicit_search',fingerprint},
    fetchedAt:now,refreshedAt:now,isActive:false,availability:'available',
  };
}

async function incrementLimit(db:Db,id:string,expiresAt:Date):Promise<number> {
  const result=await db.collection<{_id:string;count:number}>('app_limits').findOneAndUpdate(
    {_id:id},{$inc:{count:1},$setOnInsert:{expiresAt}}, {upsert:true,returnDocument:'after'},
  );
  return result?.count||0;
}

function clientIpHash(req:Request):string {
  const forwarded=req.headers.get('x-real-ip')?.trim()||req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim();
  return forwarded?createHash('sha256').update(forwarded).digest('hex'):'';
}

async function topicEvidence(db:Db,userId:string,topic:string):Promise<{revisit:number;uncertain:number}|undefined> {
  const attempts=await db.collection<{topicId:string;topicTitle:string;results:{result:string}[];createdAt:Date}>('topic_attempts')
    .find({userId}).sort({createdAt:-1}).limit(20).toArray();
  const normalize=(value:string)=>value.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g,' ');
  const attempt=attempts.find(item=>normalize(item.topicTitle)===normalize(topic)||normalize(item.topicId)===normalize(topic));
  if(!attempt?.results?.length) return undefined;
  return {revisit:attempt.results.filter(result=>result.result==='revisit').length,uncertain:attempt.results.filter(result=>result.result==='not_sure').length};
}

async function cachedCandidates(db:Db,fingerprint:string,now:Date):Promise<YoutubeCandidate[]|null> {
  const cache=await db.collection<{_id:string;cachedAt:Date;youtubeIds:string[]}>('youtube_search_cache').findOne({_id:fingerprint});
  if(!cache||now.getTime()-new Date(cache.cachedAt).getTime()>CACHE_MS) return null;
  if(!cache.youtubeIds.length) return [];
  return db.collection<YoutubeCandidate>('youtube_videos').find({youtubeId:{$in:cache.youtubeIds}}).limit(50).toArray();
}

export async function discoverYoutubeVideos(db:Db,userId:string,profile:Profile,input:YoutubeSearchInput,req:Request,searchVideos:(query:string,language:YoutubeStudyContext['language'])=>Promise<YoutubeApiVideo[]>,now=new Date()) {
  const context=studyContext(profile,input);
  const evidence=await topicEvidence(db,userId,context.topic);
  const useStepByStepIntent=context.difficulty==='foundation'&&Boolean(evidence&&(evidence.revisit||evidence.uncertain));
  const query=buildYoutubeQuery(context,useStepByStepIntent);
  const fingerprint=discoveryFingerprint(context);
  const ipHash=clientIpHash(req);
  const minute=Math.floor(now.getTime()/60_000);
  const userMinute=await incrementLimit(db,`youtube-search-user:${userId}:${minute}`,new Date(now.getTime()+2*60_000));
  if(userMinute>3) throw new YoutubeError(429,'quota_exhausted','You have searched for videos too often. Please wait a minute.');
  if(ipHash) {
    const ipMinute=await incrementLimit(db,`youtube-search-ip:${ipHash}:${minute}`,new Date(now.getTime()+2*60_000));
    if(ipMinute>10) throw new YoutubeError(429,'quota_exhausted','Video discovery is temporarily rate limited for this network.');
  }
  const cached=await cachedCandidates(db,fingerprint,now);
  if(cached) return {candidateCount:cached.filter(video=>video.reviewStatus==='pending').length,cached:true};

  const day=now.toISOString().slice(0,10);
  const userDaily=await incrementLimit(db,`youtube-search-daily-user:${userId}:${day}`,new Date(now.getTime()+48*60*60*1000));
  if(userDaily>MAX_DISCOVERY_PER_DAY) throw new YoutubeError(429,'quota_exhausted','Your daily video-search limit has been reached. Try again tomorrow.');
  if(ipHash) {
    const ipDaily=await incrementLimit(db,`youtube-search-daily-ip:${ipHash}:${day}`,new Date(now.getTime()+48*60*60*1000));
    if(ipDaily>MAX_IP_DISCOVERY_PER_DAY) throw new YoutubeError(429,'quota_exhausted','The daily video-search limit for this network has been reached.');
  }

  let videos:YoutubeApiVideo[];
  try { videos=await searchVideos(query,context.language); }
  catch(error) {
    if(error instanceof YoutubeError) {
      await db.collection('youtube_discovery_events').insertOne({fingerprint,failureCategory:error.code,createdAt:now});
    }
    throw error;
  }
  const collection=db.collection<Document>('youtube_videos');
  const candidateIds:string[]=[];
  for(const video of videos) {
    const candidate=candidateFor(video,context,query,fingerprint,now);
    if(!candidate) continue;
    let existing=await collection.findOne({youtubeId:candidate.youtubeId});
    if(!existing) {
      try {
        await collection.insertOne(candidate);
        existing=await collection.findOne({youtubeId:candidate.youtubeId});
      } catch(error) {
        if((error as {code?:number}).code!==11000) throw error;
        existing=await collection.findOne({youtubeId:candidate.youtubeId});
        if(!existing) throw error;
      }
    }
    if(existing) candidateIds.push(candidate.youtubeId);
  }
  const uniqueIds=[...new Set(candidateIds)];
  await db.collection<{_id:string;youtubeIds:string[];cachedAt:Date;query:string}>('youtube_search_cache').updateOne(
    {_id:fingerprint},{$set:{youtubeIds:uniqueIds,cachedAt:now,query}}, {upsert:true},
  );
  const saved=uniqueIds.length?await collection.find({youtubeId:{$in:uniqueIds}}).limit(50).toArray():[];
  return {candidateCount:saved.filter(video=>video.reviewStatus==='pending').length,cached:false};
}

function normalized(value:string) { return value.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g,' '); }

function matchesRequestedContext(video:YoutubeCandidate,context:YoutubeStudyContext,now:Date):boolean {
  if(video.reviewStatus!=='approved'||!video.isActive||video.availability==='unavailable') return false;
  const refreshedAt=video.refreshedAt?new Date(video.refreshedAt).getTime():NaN;
  if(!Number.isFinite(refreshedAt)||now.getTime()-refreshedAt>=REVIEW_MAX_AGE_MS) return false;
  if(video.tags.pathway!==context.pathway||normalized(video.tags.subject)!==normalized(context.subject)||normalized(video.tags.topic)!==normalized(context.topic)) return false;
  if(normalized(video.tags.classOrYear)!==normalized(context.classOrYear)) return false;
  if(video.tags.board&&normalized(video.tags.board)!==normalized(context.board)) return false;
  if(video.tags.branchOrTrade&&normalized(video.tags.branchOrTrade)!==normalized(context.branchOrTrade)) return false;
  if(video.intendedLanguage!==context.language||video.metadata.durationSeconds>context.availableMinutes*60) return false;
  return true;
}

export async function youtubeRecommendations(db:Db,userId:string,profile:Profile,input:YoutubeSearchInput,now=new Date()) {
  const context=studyContext(profile,input);
  const [all,evidence]=await Promise.all([
    db.collection<YoutubeCandidate>('youtube_videos').find({reviewStatus:'approved',isActive:true,'tags.pathway':context.pathway,'tags.subject':context.subject,'tags.topic':context.topic}).limit(300).toArray(),
    topicEvidence(db,userId,context.topic),
  ]);
  const videos=all.filter(video=>matchesRequestedContext(video,context,now));
  if(!videos.length) return {videos:[],canSearch:true};
  const feedback=await db.collection<{youtubeId:string;feedback:string}>('youtube_video_feedback')
    .find({userId,pathway:context.pathway,subject:context.subject,topic:context.topic}).toArray();
  const feedbackById=new Map(feedback.map(item=>[item.youtubeId,item.feedback]));
  const assessmentBoost=(video:YoutubeCandidate) => evidence&&(evidence.revisit||evidence.uncertain)
    ? (video.requestedDifficulty==='foundation'?0:1) : 0;
  videos.sort((a,b)=>{
    const rank=(video:YoutubeCandidate)=>{
      const savedFeedback=feedbackById.get(video.youtubeId);
      const feedbackFit=savedFeedback==='too_difficult'?(video.requestedDifficulty==='foundation'?0:1)
        :savedFeedback==='too_easy'?(video.requestedDifficulty==='advanced'?0:1)
        :savedFeedback==='about_right'?(video.requestedDifficulty===context.difficulty?0:1):0;
      return [savedFeedback==='not_useful'?1:0,feedbackFit,assessmentBoost(video),video.requestedDifficulty===context.difficulty?0:1];
    };
    const ar=rank(a),br=rank(b);
    for(let i=0;i<ar.length;i++)if(ar[i]!==br[i])return ar[i]-br[i];
    return b.metadata.publishedAt.localeCompare(a.metadata.publishedAt);
  });
  return {
    canSearch:false,
    videos:videos.slice(0,3).map(video=>({
      _id:video._id.toHexString(),youtubeId:video.youtubeId,canonicalUrl:video.canonicalUrl,title:video.metadata.title,
      channel:video.metadata.channelTitle,thumbnailUrl:video.metadata.thumbnailUrl,descriptionExcerpt:video.metadata.descriptionExcerpt,
      durationSeconds:video.metadata.durationSeconds,publishedAt:video.metadata.publishedAt,language:video.intendedLanguage,
      difficulty:video.requestedDifficulty,subject:video.tags.subject,topic:video.tags.topic,
      reason:recommendationReason(context,feedbackById.get(video.youtubeId),evidence),feedback:feedbackById.get(video.youtubeId)||null,
    })),
  };
}

export async function listYoutubeReviewQueue(db:Db) {
  const rows=await db.collection<YoutubeCandidate>('youtube_videos').find({}).sort({fetchedAt:-1}).limit(200).toArray();
  return rows.map(video=>({
    _id:video._id.toHexString(),youtubeId:video.youtubeId,canonicalUrl:video.canonicalUrl,
    title:video.metadata.title,channel:video.metadata.channelTitle,thumbnailUrl:video.metadata.thumbnailUrl,
    descriptionExcerpt:video.metadata.descriptionExcerpt,durationSeconds:video.metadata.durationSeconds,
    publishedAt:video.metadata.publishedAt,requestedPathway:video.tags.pathway,subject:video.tags.subject,
    topic:video.tags.topic,intendedLanguage:video.intendedLanguage,difficulty:video.requestedDifficulty,
    searchQuery:video.searchQuery,whyDiscovered:video.whyDiscovered,fetchedAt:video.fetchedAt,
    refreshedAt:video.refreshedAt,reviewStatus:video.reviewStatus,isActive:video.isActive,
    madeForKids:video.metadata.madeForKids,selfDeclaredMadeForKids:video.metadata.selfDeclaredMadeForKids,
  }));
}

export async function youtubeConsent(db:Db,userId:string) {
  const record=await db.collection<{userId:string;termsVersion:string;acceptedAt:Date}>('youtube_consents')
    .findOne({userId,termsVersion:YOUTUBE_TERMS_VERSION},{projection:{_id:0,userId:0}});
  return Boolean(record);
}

export async function saveYoutubeConsent(db:Db,userId:string,accepted:boolean,now=new Date()) {
  const collection=db.collection('youtube_consents');
  if(!accepted) {
    await collection.deleteOne({userId});
    return false;
  }
  await collection.updateOne({userId},{$set:{userId,termsVersion:YOUTUBE_TERMS_VERSION,acceptedAt:now}},{upsert:true});
  return true;
}

export async function reviewYoutubeVideo(db:Db,id:ObjectId,reviewerId:string,action:{action:'approve'|'reject'|'inactive'}|{action:'edit';subject:string;topic:string;difficulty:'foundation'|'core'|'advanced'},now=new Date()) {
  const collection=db.collection<YoutubeCandidate>('youtube_videos');
  const video=await collection.findOne({_id:id});
  if(!video) return false;
  const set:Document={reviewerId,reviewedAt:now};
  if(action.action==='approve') Object.assign(set,{reviewStatus:'approved',isActive:true});
  if(action.action==='reject') Object.assign(set,{reviewStatus:'rejected',isActive:false});
  if(action.action==='inactive') Object.assign(set,{reviewStatus:'inactive',isActive:false});
  if(action.action==='edit') {
    Object.assign(set,{requestedDifficulty:action.difficulty,'tags.subject':action.subject,'tags.topic':action.topic});
  }
  await collection.updateOne({_id:id},{$set:set});
  return true;
}

export async function saveYoutubeFeedback(db:Db,userId:string,id:ObjectId,feedback:'too_easy'|'about_right'|'too_difficult'|'not_useful',now=new Date()) {
  const video=await db.collection<YoutubeCandidate>('youtube_videos').findOne({_id:id,reviewStatus:'approved',isActive:true});
  if(!video) return false;
  const profile=await db.collection<Profile & Document>('profiles').findOne({userId});
  if(!profile) return false;
  try {
    const context=studyContext(profile,{subject:video.tags.subject,topic:video.tags.topic,language:video.intendedLanguage as YoutubeStudyContext['language'],difficulty:video.requestedDifficulty as YoutubeStudyContext['difficulty'],availableMinutes:180});
    if(!matchesRequestedContext(video,context,now)) return false;
  } catch(error) {
    if(error instanceof YoutubeError&&error.status===400) return false;
    throw error;
  }
  await db.collection('youtube_video_feedback').updateOne(
    {userId,youtubeId:video.youtubeId},
    {$set:{userId,youtubeId:video.youtubeId,pathway:video.tags.pathway,subject:video.tags.subject,topic:video.tags.topic,feedback,updatedAt:now},$setOnInsert:{createdAt:now}},
    {upsert:true},
  );
  return true;
}

export async function addYoutubeVideoToPlan(db:Db,userId:string,id:ObjectId,profile:Profile,now=new Date()) {
  const video=await db.collection<YoutubeCandidate>('youtube_videos').findOne({_id:id,reviewStatus:'approved',isActive:true});
  if(!video) return null;
  const contextInput:YoutubeSearchInput={subject:video.tags.subject,topic:video.tags.topic,language:video.intendedLanguage as YoutubeStudyContext['language'],difficulty:video.requestedDifficulty as YoutubeStudyContext['difficulty'],availableMinutes:180};
  const context=studyContext(profile,contextInput);
  if(!matchesRequestedContext(video,context,now)) return null;
  const tasks=db.collection<Document>('tasks');
  const youtubeVideoRef=video._id.toHexString();
  const existing=await tasks.findOne({userId,youtubeVideoRef},{projection:{_id:1}});
  if(existing) return existing._id;
  if(await tasks.countDocuments({userId})>=200) throw new YoutubeError(400,'provider_error','Your plan has reached 200 tasks. Remove old tasks first.');
  const savedProfile=await db.collection<{goal?:string}>('profiles').findOne({userId},{projection:{goal:1}});
  const goal=savedProfile?.goal?.trim()||'';
  const task:Document={
    userId,title:`Watch: ${video.metadata.title}`.slice(0,150),
    notes:`Open this reviewed lesson on YouTube: ${video.canonicalUrl}\nVIKAS topic: ${video.tags.subject} · ${video.tags.topic}`,
    minutes:Math.max(5,Math.ceil(video.metadata.durationSeconds/60)),status:'todo',
    youtubeVideoRef,youtubeVideoId:video.youtubeId,youtubeVideoUrl:video.canonicalUrl,
    ...(goal?{goalRef:goalRef(userId,goal),goalTitle:goal}:{}),createdAt:now,updatedAt:now,
  };
  try {
    const result=await tasks.insertOne(task);
    return result.insertedId;
  } catch(error) {
    if((error as {code?:number}).code!==11000) throw error;
    const duplicate=await tasks.findOne({userId,youtubeVideoRef},{projection:{_id:1}});
    if(!duplicate) throw error;
    return duplicate._id;
  }
}

function metadataUpdate(video:YoutubeApiVideo) {
  const metadata=providerMetadata(video);
  if(!metadata) return null;
  return metadata;
}

export async function refreshStaleYoutubeVideos(db:Db,loadMetadata:(ids:string[])=>Promise<YoutubeApiVideo[]>,now=new Date()) {
  const all=await db.collection<YoutubeCandidate>('youtube_videos').find({}).toArray();
  const cutoff=now.getTime()-REVIEW_MAX_AGE_MS;
  const stale=all.filter(video=>!video.refreshedAt||new Date(video.refreshedAt).getTime()<=cutoff);
  let refreshed=0,unavailable=0,failed=0;
  for(let start=0;start<stale.length;start+=50) {
    const batch=stale.slice(start,start+50);
    try {
      const metadata=await loadMetadata(batch.map(video=>video.youtubeId));
      const byId=new Map(metadata.map(video=>[stringValue(video.id),video]));
      for(const previous of batch) {
        const latest=byId.get(previous.youtubeId);
        const update=latest&&metadataUpdate(latest);
        if(!update) {
          await db.collection('youtube_videos').updateOne({_id:previous._id},{$set:{isActive:false,availability:'unavailable',refreshedAt:now,lastRefreshAttemptAt:now},$unset:{refreshFailure:''}});
          unavailable++;
          continue;
        }
        await db.collection('youtube_videos').updateOne({_id:previous._id,reviewStatus:'approved',availability:'unavailable',isActive:false},{$set:{isActive:true}});
        await db.collection('youtube_videos').updateOne({_id:previous._id},{$set:{
          metadata:update,refreshedAt:now,lastRefreshAttemptAt:now,availability:'available',
        },$unset:{refreshFailure:''}});
        refreshed++;
      }
    } catch(error) {
      const category=error instanceof YoutubeError?error.code:'provider_error';
      await db.collection('youtube_videos').updateMany(
        {_id:{$in:batch.map(video=>video._id)}},{$set:{lastRefreshAttemptAt:now,refreshFailure:category}},
      );
      await db.collection('youtube_discovery_events').insertOne({action:'refresh',failureCategory:category,count:batch.length,createdAt:now});
      failed+=batch.length;
      throw error;
    }
  }
  return {checked:stale.length,refreshed,unavailable,failed};
}
