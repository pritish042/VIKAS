import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ObjectId} from 'mongodb';
import {emptyEducation} from '../lib/education';
import {configuredEditor} from '../lib/editor-permissions';
import {
  buildYoutubeQuery,durationSeconds,isClearlyUnrelated,isPromotional,providerError,studyContext,
  youtubeFeedbackSchema,youtubeReviewSchema,youtubeSearchSchema,type YoutubeSearchInput,
} from '../lib/youtube-rules';
import {getYoutubeVideoMetadata,searchYoutubeVideos,youtubeJson} from '../lib/youtube-provider-core';
import {
  addYoutubeVideoToPlan,discoverYoutubeVideos,providerMetadata,refreshStaleYoutubeVideos,
  reviewYoutubeVideo,saveYoutubeConsent,saveYoutubeFeedback,youtubeConsent,youtubeRecommendations,
} from '../lib/youtube-service-core';
import {emptyProfile,type Profile} from '../lib/types';
import {YoutubeError} from '../lib/youtube-rules';
import {Memory} from './helpers/memory-db';

const student:Profile={...emptyProfile,stage:'senior',level:'Class 12',stream:'Science',goal:'Study Physics',education:{...emptyEducation,board:'CBSE',className:'Class 12',stream:'Science',subjects:['Physics']}};
const input:YoutubeSearchInput={subject:'Physics',topic:'Electromagnetic Induction',language:'English',difficulty:'core',availableMinutes:25};
const now=new Date('2026-10-03T12:00:00Z');
const request=new Request('https://vikas.example/api/youtube/discover',{headers:{'x-forwarded-for':'203.0.113.10'}});

function profile(overrides:Partial<Profile>):Profile {return {...student,...overrides};}
function video(overrides:Record<string,unknown>={}) {
  return {
    id:'abc123def45',
    snippet:{title:'Electromagnetic Induction Physics lesson',channelTitle:'Learning Channel',description:'A recorded lesson explaining electromagnetic induction concepts.',publishedAt:'2026-01-02T00:00:00Z',liveBroadcastContent:'none',thumbnails:{high:{url:'https://i.ytimg.com/vi/abc123def45/hqdefault.jpg'}}},
    contentDetails:{duration:'PT12M'},
    status:{privacyStatus:'public',embeddable:true,madeForKids:false,selfDeclaredMadeForKids:true},
    ...overrides,
  };
}
function response(payload:unknown,status=200) {return new Response(JSON.stringify(payload),{status,headers:{'Content-Type':'application/json'}});}
async function setup() {
  const memory=new Memory();
  await memory.collection('profiles').insertOne({...student,userId:'student-a'});
  await memory.collection('profiles').insertOne({...student,userId:'student-b'});
  return memory;
}
async function discover(memory:Memory,userId='student-a',searchInput=input,searcher=async()=>[video()] as never[]) {
  return discoverYoutubeVideos(memory.asDb(),userId,student,searchInput,request,searcher,now);
}

test('builds separate bounded queries for all five supported education pathways',()=>{
  const cases:[Profile,string,string][]=[
    [student,'class-11-12-science','Class 12 Science'],
    [profile({stream:'Commerce',education:{...student.education!,stream:'Commerce'}}),'class-11-12-commerce','Class 12 Commerce'],
    [profile({stream:'Arts/Humanities',education:{...student.education!,stream:'Arts/Humanities'}}),'class-11-12-arts-humanities','Class 12 Arts/Humanities'],
    [profile({stage:'vocational',level:'Semester 2',stream:'Mechanical',education:{...emptyEducation,program:'Diploma in Engineering',discipline:'Mechanical',period:'Semester 2',subjects:['Engineering Physics']}}),'diploma','Diploma Mechanical Semester 2'],
    [profile({stage:'vocational',level:'Year 1',stream:'Electrician',education:{...emptyEducation,program:'ITI',discipline:'Electrician',period:'Year 1',subjects:[]}}),'iti','ITI Electrician Year 1'],
  ];
  for(const [p,pathway,queryPart] of cases) {
    const ctx=studyContext(p,{...input,subject:p.stage==='vocational'&&p.education?.subjects.length?p.education.subjects[0]:p.stage==='vocational'?p.education!.discipline:'Physics'});
    assert.equal(ctx.pathway,pathway);
    assert.ok(buildYoutubeQuery(ctx).includes(queryPart));
    assert.ok(buildYoutubeQuery(ctx).length<=220);
  }
  assert.equal(studyContext(profile({education:{...student.education!,className:'Class 11'}}),input).classOrYear,'Class 11');
});

test('YouTube terms consent is session-owned, versioned and withdrawable',async()=>{
  const memory=await setup(),db=memory.asDb();
  assert.equal(await youtubeConsent(db,'student-a'),false);
  assert.equal(await saveYoutubeConsent(db,'student-a',true,now),true);
  assert.equal(await youtubeConsent(db,'student-a'),true);
  assert.equal(await youtubeConsent(db,'student-b'),false);
  assert.equal(await saveYoutubeConsent(db,'student-a',false,now),false);
  assert.equal(await youtubeConsent(db,'student-a'),false);
});

test('keeps Class 11–12 separate from Diploma and ITI and requires actual profile subjects',()=>{
  assert.throws(()=>studyContext(profile({education:{...student.education!,className:'Class 10'}}),input),/Class 11/);
  const diploma=profile({stage:'vocational',education:{...emptyEducation,program:'Diploma in Civil Engineering',discipline:'Civil',period:'Year 2',subjects:[]}});
  const iti=profile({stage:'vocational',education:{...emptyEducation,program:'ITI - Fitter',discipline:'Fitter',period:'Year 2',subjects:[]}});
  assert.equal(studyContext(diploma,{...input,subject:'Civil'}).pathway,'diploma');
  assert.equal(studyContext(iti,{...input,subject:'Fitter'}).pathway,'iti');
  assert.throws(()=>studyContext({...student,education:{...student.education!,subjects:[]}},input),/actual subject|listed/i);
  assert.throws(()=>studyContext(profile({stage:'vocational',education:{...emptyEducation,program:'Diploma',discipline:'Electrical',period:'Year 1',subjects:[]}}),{...input,subject:'Mechanical'}),/listed in your profile/i);
});

test('strict inputs reject raw API parameter injection, malicious fields and invalid feedback/review actions',()=>{
  assert.equal(youtubeSearchSchema.safeParse(input).success,true);
  for(const value of [{...input,type:'channel'},{...input,part:'snippet'},{...input,apiKey:'secret'},{...input,availableMinutes:181},{...input,topic:'<script>alert(1)</script>'}]) assert.equal(youtubeSearchSchema.safeParse(value).success,false);
  assert.equal(youtubeSearchSchema.safeParse({...input,topic:'Induction &type=channel'}).success,true);
  assert.equal(youtubeFeedbackSchema.safeParse({feedback:'not_useful',userId:'other'}).success,false);
  assert.equal(youtubeReviewSchema.safeParse({action:'approve',status:'published'}).success,false);
});

test('provider requires a key, distinguishes invalid credentials and quota exhaustion, and never retries',async()=>{
  await assert.rejects(youtubeJson('search',{},'',async()=>response({items:[]})),(error:unknown)=>error instanceof YoutubeError&&error.code==='missing_key');
  assert.equal(providerError(403,'keyInvalid').code,'invalid_key');
  let calls=0;
  await assert.rejects(youtubeJson('search',{},'test-only-key',async()=>{calls++;return response({error:{errors:[{reason:'quotaExceeded'}]}},403);}), (error:unknown)=>error instanceof YoutubeError&&error.code==='quota_exhausted');
  assert.equal(calls,1);
});

test('provider applies fixed official search parameters and fetches metadata authoritatively',async()=>{
  const urls:URL[]=[];
  const fetcher=async(url:RequestInfo|URL)=> {
    const parsed=new URL(String(url));urls.push(parsed);
    return urls.length===1?response({items:[{id:{videoId:'abc123def45'}},{id:{videoId:'abc123def45'}},{id:{channelId:'ignored'}}]}):response({items:[video()]});
  };
  const result=await searchYoutubeVideos('Class 12 Physics induction','Hindi','test-only-key',fetcher as typeof fetch);
  assert.equal(result.length,1);
  const search=urls[0].searchParams;
  assert.deepEqual({
    type:search.get('type'),safeSearch:search.get('safeSearch'),embeddable:search.get('videoEmbeddable'),
    syndicated:search.get('videoSyndicated'),language:search.get('relevanceLanguage'),region:search.get('regionCode'),limit:search.get('maxResults'),
  },{type:'video',safeSearch:'strict',embeddable:'true',syndicated:'true',language:'hi',region:'IN',limit:'8'});
  assert.equal(search.get('q'),'Class 12 Physics induction');
  assert.equal(search.get('type=channel'),null);
  assert.equal(urls[1].searchParams.get('part'),'snippet,contentDetails,status');
  assert.equal(urls[1].searchParams.get('id'),'abc123def45');
});

test('provider reports timeout and network failures explicitly',async()=>{
  const timeoutFetch=(async(_url:RequestInfo|URL,init?:RequestInit)=>new Promise<Response>((_resolve,reject)=>{
    init?.signal?.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});
  })) as typeof fetch;
  await assert.rejects(youtubeJson('search',{},'test-only-key',timeoutFetch,2),(error:unknown)=>error instanceof YoutubeError&&error.code==='timed_out');
  await assert.rejects(youtubeJson('search',{},'test-only-key',async()=>{throw new Error('offline');}),(error:unknown)=>error instanceof YoutubeError&&error.code==='network_error');
  await assert.rejects(youtubeJson('search',{},'test-only-key',async()=>response({error:{errors:[{reason:'keyInvalid'}]}},403)),(error:unknown)=>error instanceof YoutubeError&&error.code==='invalid_key');
});

test('metadata validation rejects private, unembeddable, livestream, irrelevant, promotional and out-of-range candidates',()=>{
  assert.equal(providerMetadata(video())?.madeForKids,false);
  assert.equal(providerMetadata(video())?.selfDeclaredMadeForKids,true);
  assert.equal(providerMetadata(video({status:{privacyStatus:'private',embeddable:true}})),null);
  assert.equal(providerMetadata(video({status:{privacyStatus:'public',embeddable:false}})),null);
  assert.equal(providerMetadata(video({snippet:{...video().snippet,liveBroadcastContent:'live'}})),null);
  assert.equal(providerMetadata(video({contentDetails:{duration:'PT4H'}})),null);
  assert.equal(providerMetadata(video({contentDetails:{duration:'PT2M'}})),null);
  assert.equal(isClearlyUnrelated('Algebraic equations tutorial','Solving equations','Physics','Electromagnetic Induction'),true);
  assert.equal(isPromotional('Buy now - Join our paid course','Get admission today.'),true);
  assert.equal(durationSeconds('PT1H2M3S'),3723);
});

test('discovery caches normalized requests, deduplicates IDs, and never exposes pending candidates as recommendations',async()=>{
  const memory=await setup();
  let searchCount=0;
  const searcher=async()=>{searchCount++;return [video(),video()] as never[];};
  const first=await discover(memory,'student-a',input,searcher);
  assert.equal(first.candidateCount,1);
  const cached=await discover(memory,'student-b',{...input,topic:'electromagnetic induction'},searcher);
  assert.equal(cached.cached,true);
  assert.equal(searchCount,1);
  assert.equal(memory.rows.get('youtube_videos')?.length,1);
  const hidden=await youtubeRecommendations(memory.asDb(),'student-a',student,input,now);
  assert.equal(hidden.videos.length,0);
  assert.equal(hidden.canSearch,true);
});

test('search failure categories are recorded once without retrying the provider',async()=>{
  const memory=await setup();
  let calls=0;
  await assert.rejects(discoverYoutubeVideos(memory.asDb(),'student-a',student,input,request,async()=>{calls++;throw new YoutubeError(503,'quota_exhausted','quota');},now),
    (error:unknown)=>error instanceof YoutubeError&&error.code==='quota_exhausted');
  assert.equal(calls,1);
  assert.equal(memory.rows.get('youtube_discovery_events')?.[0].failureCategory,'quota_exhausted');
  assert.equal('apiKey' in (memory.rows.get('youtube_discovery_events')?.[0]||{}),false);
  assert.equal('userId' in (memory.rows.get('youtube_discovery_events')?.[0]||{}),false);
});

test('only configured verified reviewers pass the shared editor permission rule',()=>{
  const configured='reviewer@example.test,other@example.test';
  assert.equal(configuredEditor({email:'REVIEWER@example.test',emailVerified:true},configured),true);
  assert.equal(configuredEditor({email:'reviewer@example.test',emailVerified:false},configured),false);
  assert.equal(configuredEditor({email:'student@example.test',emailVerified:true},configured),false);
});

test('approval, feedback and plan creation preserve pending visibility and two-user task isolation',async()=>{
  const memory=await setup();
  await discover(memory);
  const row=memory.rows.get('youtube_videos')![0];
  const id=row._id as ObjectId;
  assert.equal(await saveYoutubeFeedback(memory.asDb(),'student-a',id,'about_right',now),false);
  await reviewYoutubeVideo(memory.asDb(),id,'reviewer',{action:'approve'},now);
  assert.equal(await saveYoutubeFeedback(memory.asDb(),'student-a',id,'too_difficult',now),true);
  const mine=await youtubeRecommendations(memory.asDb(),'student-a',student,input,now);
  const theirs=await youtubeRecommendations(memory.asDb(),'student-b',student,input,now);
  assert.equal(mine.videos.length,1);
  assert.equal(mine.videos[0].feedback,'too_difficult');
  assert.match(mine.videos[0].reason,/too difficult/);
  assert.equal(theirs.videos[0].feedback,null);
  const first=await addYoutubeVideoToPlan(memory.asDb(),'student-a',id,student,now);
  const duplicate=await addYoutubeVideoToPlan(memory.asDb(),'student-a',id,student,now);
  const otherUser=await addYoutubeVideoToPlan(memory.asDb(),'student-b',id,student,now);
  assert.equal(String(first),String(duplicate));
  assert.notEqual(String(first),String(otherUser));
  const tasks=memory.rows.get('tasks')!;
  assert.equal(tasks.length,2);
  assert.equal(tasks.filter(task=>task.userId==='student-a').length,1);
  assert.equal(tasks.every(task=>task.status==='todo'&&task.youtubeVideoUrl===row.canonicalUrl),true);
});

test('recommendations match board, class, language and available time and never exceed three',async()=>{
  const memory=await setup();
  const videoIds=['abc123def45','bbc123def45','cbc123def45','dbc123def45'];
  await discover(memory,'student-a',input,async()=>videoIds.map(id=>video({id})) as never[]);
  for(const row of memory.rows.get('youtube_videos')!) await reviewYoutubeVideo(memory.asDb(),row._id as ObjectId,'reviewer',{action:'approve'},now);
  assert.equal((await youtubeRecommendations(memory.asDb(),'student-a',student,{...input,availableMinutes:5},now)).videos.length,0);
  assert.equal((await youtubeRecommendations(memory.asDb(),'student-a',profile({education:{...student.education!,board:'CISCE'}}),input,now)).videos.length,0);
  assert.equal((await youtubeRecommendations(memory.asDb(),'student-a',profile({education:{...student.education!,className:'Class 11'}}),input,now)).videos.length,0);
  assert.equal((await youtubeRecommendations(memory.asDb(),'student-a',student,{...input,language:'Hindi'},now)).videos.length,0);
  const matched=await youtubeRecommendations(memory.asDb(),'student-a',student,input,now);
  assert.equal(matched.videos.length,3);
  assert.ok(matched.videos.every(item=>item.reason.startsWith('VIKAS guidance:')));
});

test('refresh updates YouTube fields, preserves VIKAS review tags, and deactivates unavailable videos',async()=>{
  const memory=await setup();
  await discover(memory);
  const row=memory.rows.get('youtube_videos')![0],id=row._id as ObjectId;
  await reviewYoutubeVideo(memory.asDb(),id,'reviewer',{action:'edit',subject:'Physics',topic:'Induction',difficulty:'foundation'},now);
  await reviewYoutubeVideo(memory.asDb(),id,'reviewer',{action:'approve'},now);
  await memory.collection('youtube_videos').updateOne({_id:id},{$set:{refreshedAt:new Date(now.getTime()-31*24*60*60*1000)}});
  const changed=video({snippet:{...video().snippet,title:'Electromagnetic induction lesson updated'}});
  const refreshed=await refreshStaleYoutubeVideos(memory.asDb(),async()=>[changed],now);
  assert.deepEqual(refreshed,{checked:1,refreshed:1,unavailable:0,failed:0});
  let saved=memory.rows.get('youtube_videos')![0];
  assert.equal((saved.metadata as {title:string}).title,'Electromagnetic induction lesson updated');
  assert.equal((saved.tags as {topic:string}).topic,'Induction');
  await memory.collection('youtube_videos').updateOne({_id:id},{$set:{refreshedAt:new Date(now.getTime()-31*24*60*60*1000)}});
  const unavailable=await refreshStaleYoutubeVideos(memory.asDb(),async()=>[],now);
  saved=memory.rows.get('youtube_videos')![0];
  assert.equal(unavailable.unavailable,1);
  assert.equal(saved.isActive,false);
  assert.equal((saved.tags as {topic:string}).topic,'Induction');
  assert.equal((await youtubeRecommendations(memory.asDb(),'student-a',student,{...input,topic:'Induction',difficulty:'foundation'},now)).videos.length,0);
});

test('refresh failures are recorded without discarding reviewed tags',async()=>{
  const memory=await setup();
  await discover(memory);
  const row=memory.rows.get('youtube_videos')![0],id=row._id as ObjectId;
  await reviewYoutubeVideo(memory.asDb(),id,'reviewer',{action:'approve'},now);
  await memory.collection('youtube_videos').updateOne({_id:id},{$set:{refreshedAt:new Date(now.getTime()-31*24*60*60*1000)}});
  await assert.rejects(refreshStaleYoutubeVideos(memory.asDb(),async()=>{throw new YoutubeError(503,'timed_out','timeout');},now));
  assert.equal(memory.rows.get('youtube_videos')![0].refreshFailure,'timed_out');
  assert.equal((memory.rows.get('youtube_videos')![0].tags as {topic:string}).topic,input.topic);
  assert.equal(memory.rows.get('youtube_discovery_events')?.at(-1)?.failureCategory,'timed_out');
});

test('review editing rejects client ownership/status injection',async()=>{
  const memory=await setup();
  await discover(memory);
  const row=memory.rows.get('youtube_videos')![0],id=row._id as ObjectId;
  assert.equal(youtubeReviewSchema.safeParse({action:'edit',subject:'Physics',topic:'Induction',difficulty:'core',userId:'student-b'}).success,false);
  assert.equal(await reviewYoutubeVideo(memory.asDb(),new ObjectId(),'reviewer',{action:'approve'},now),false);
  await reviewYoutubeVideo(memory.asDb(),id,'reviewer',{action:'inactive'},now);
  assert.equal((memory.rows.get('youtube_videos')![0]).isActive,false);
});

test('metadata refresh batches at fifty IDs and does not call the provider when data is fresh',async()=>{
  const memory=await setup();
  await discover(memory);
  let calls=0;
  const fresh=await refreshStaleYoutubeVideos(memory.asDb(),async()=>{calls++;return [];},now);
  assert.deepEqual(fresh,{checked:0,refreshed:0,unavailable:0,failed:0});
  assert.equal(calls,0);
  const details=await getYoutubeVideoMetadata(['abc123def45'],'test-only-key',async()=>response({items:[video()]}));
  assert.equal(details.length,1);
});

test('senior context accepts saved science combinations and rejects ambiguous classes and boards',()=>{
  for(const stream of ['PCM','PCB','PCMB','Physics-Chemistry-Biology','Physics Chemistry Mathematics']){
    const p=profile({education:{...student.education!,stream}});
    assert.equal(studyContext(p,input).pathway,'class-11-12-science');
  }
  for(const className of ['Class 11 or 12','Class 112','Not sure'])assert.throws(()=>studyContext(profile({education:{...student.education!,className}}),input));
  for(const board of ['','Not sure','Other'])assert.throws(()=>studyContext(profile({education:{...student.education!,board}}),input));
});

test('feedback requires the session-owned profile to match the video and fresh availability',async()=>{
  const memory=await setup();await discover(memory);
  const row=memory.rows.get('youtube_videos')![0],id=row._id as ObjectId;
  await reviewYoutubeVideo(memory.asDb(),id,'reviewer',{action:'approve'},now);
  await memory.collection('profiles').updateOne({userId:'student-b'},{$set:{'education.board':'ISC'}});
  assert.equal(await saveYoutubeFeedback(memory.asDb(),'student-b',id,'about_right',now),false);
  assert.equal(await saveYoutubeFeedback(memory.asDb(),'missing-user',id,'about_right',now),false);
  assert.equal(memory.rows.get('youtube_video_feedback')?.length||0,0);
  assert.equal(await saveYoutubeFeedback(memory.asDb(),'student-a',id,'about_right',now),true);
  await memory.collection('youtube_videos').updateOne({_id:id},{$set:{refreshedAt:new Date(now.getTime()-31*24*60*60*1000)}});
  assert.equal(await saveYoutubeFeedback(memory.asDb(),'student-a',id,'too_easy',now),false);
});

test('provider enforces the deadline on response bodies even when body reads ignore abort',async()=>{
  const fetcher:typeof fetch=async()=>{const result=response({items:[]});result.json=()=>new Promise(()=>{});return result;};
  await assert.rejects(youtubeJson('search',{},'test-only-key',fetcher,5),(error:unknown)=>error instanceof YoutubeError&&error.code==='timed_out');
});

test('refresh cannot reactivate a video withdrawn during the provider request',async()=>{
  const memory=await setup();await discover(memory);
  const row=memory.rows.get('youtube_videos')![0],id=row._id as ObjectId;
  await reviewYoutubeVideo(memory.asDb(),id,'reviewer',{action:'approve'},now);
  await memory.collection('youtube_videos').updateOne({_id:id},{$set:{isActive:false,availability:'unavailable',refreshedAt:new Date(now.getTime()-31*24*60*60*1000)}});
  await refreshStaleYoutubeVideos(memory.asDb(),async()=>{
    await reviewYoutubeVideo(memory.asDb(),id,'reviewer',{action:'inactive'},now);return [video()];
  },now);
  const saved=memory.rows.get('youtube_videos')![0];assert.equal(saved.reviewStatus,'inactive');assert.equal(saved.isActive,false);
});
