'use client';
import {useEffect,useMemo,useState} from 'react';
import {ExternalLink,MessageCircle,Plus,Search,ShieldCheck} from 'lucide-react';
import type {Profile} from '@/lib/types';
import {youtubeLanguages,type YoutubeDifficulty,type YoutubeLanguage} from '@/lib/youtube-contract';

type Feedback='too_easy'|'about_right'|'too_difficult'|'not_useful';
type SearchValues={subject:string;topic:string;language:YoutubeLanguage|'';difficulty:YoutubeDifficulty|'';availableMinutes:string};
type Video={_id:string;youtubeId:string;canonicalUrl:string;title:string;channel:string;thumbnailUrl:string;descriptionExcerpt:string;durationSeconds:number;publishedAt:string;language:string;difficulty:YoutubeDifficulty;subject:string;topic:string;reason:string;feedback:Feedback|null};
type ReviewVideo={_id:string;youtubeId:string;canonicalUrl:string;title:string;channel:string;thumbnailUrl:string;descriptionExcerpt:string;durationSeconds:number;publishedAt:string;requestedPathway:string;subject:string;topic:string;intendedLanguage:string;difficulty:YoutubeDifficulty;searchQuery:string;whyDiscovered:string;fetchedAt:string;refreshedAt:string;reviewStatus:string;isActive:boolean;madeForKids:boolean|null;selfDeclaredMadeForKids:boolean|null};

async function request(path:string,method='GET',value?:unknown) {
  const response=await fetch(path,{method,headers:value?{'Content-Type':'application/json'}:undefined,body:value?JSON.stringify(value):undefined,cache:'no-store'});
  const data=await response.json();
  if(!response.ok) throw new Error(data.error||'Please try again later.');
  return data;
}
function duration(seconds:number) {const minutes=Math.ceil(seconds/60);return `${Math.floor(minutes/60)?`${Math.floor(minutes/60)} hr `:''}${minutes%60?`${minutes%60} min`:''}`.trim();}
function dateLabel(value:string) {const parsed=new Date(value);return Number.isNaN(parsed.getTime())?'Not provided':parsed.toLocaleDateString();}
const emptySearch:SearchValues={subject:'',topic:'',language:'',difficulty:'',availableMinutes:''};

export function YoutubeDiscovery({profile,signedIn,isReviewer,onAskDisha,onPlanAdded}:{profile:Profile;signedIn:boolean;isReviewer:boolean;onAskDisha:(title:string)=>void;onPlanAdded:()=>Promise<void>}) {
  const subjects=useMemo(()=>{
    const values=profile.education?.subjects.map(value=>value.trim()).filter(Boolean)||[];
    if(!values.length&&profile.stage==='vocational'&&profile.education?.discipline.trim()) return [profile.education.discipline.trim()];
    return values;
  },[profile]);
  const [search,setSearch]=useState(emptySearch),[videos,setVideos]=useState<Video[]>([]),[review,setReview]=useState<ReviewVideo[]>([]);
  const [canSearch,setCanSearch]=useState(false),[busy,setBusy]=useState(false),[reviewBusy,setReviewBusy]=useState(false);
  const [consented,setConsented]=useState(false),[consentChecked,setConsentChecked]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[discoveryMessage,setDiscoveryMessage]=useState('');
  const [tagEdits,setTagEdits]=useState<Record<string,{subject:string;topic:string;difficulty:YoutubeDifficulty}>>({});

  useEffect(()=>{setSearch(current=>({...current,subject:subjects.includes(current.subject)?current.subject:subjects[0]||''}));},[subjects]);
  async function loadRecommendations(values=search) {
    const params=new URLSearchParams({
      subject:values.subject,topic:values.topic,language:values.language,difficulty:values.difficulty,
      availableMinutes:values.availableMinutes,
    });
    const result=await request(`/api/youtube/recommendations?${params}`);
    setVideos(result.videos);setCanSearch(result.canSearch);
  }
  async function loadReview() {
    const result=await request('/api/youtube/review');
    setReview(result.videos);
    setTagEdits(Object.fromEntries(result.videos.map((video:ReviewVideo)=>[video._id,{subject:video.subject,topic:video.topic,difficulty:video.difficulty}])));
  }
  useEffect(()=>{if(signedIn)void request('/api/youtube/consent').then(result=>setConsented(result.accepted)).catch(e=>setError((e as Error).message));},[signedIn]);
  useEffect(()=>{if(isReviewer&&consented)void loadReview().catch(e=>setError((e as Error).message));},[isReviewer,consented]);

  function validateSearch() {
    if(!signedIn) throw new Error('Sign in to find learning videos.');
    if(!consented&&!consentChecked) throw new Error('Review and accept the YouTube terms before using video discovery.');
    if(!subjects.includes(search.subject)) throw new Error('Choose a subject saved in your education profile.');
    if(!search.topic.trim()) throw new Error('Enter the topic you want to learn.');
    if(!search.language) throw new Error('Choose your preferred language.');
    if(!search.difficulty) throw new Error('Choose a topic level.');
    const availableMinutes=Number(search.availableMinutes);
    if(!Number.isInteger(availableMinutes)||availableMinutes<5||availableMinutes>180) throw new Error('Enter available time from 5 to 180 minutes.');
    return {...search,topic:search.topic.trim(),availableMinutes};
  }
  async function acceptTerms() {
    if(consented) return;
    const result=await request('/api/youtube/consent','POST',{accepted:true});
    setConsented(result.accepted);setConsentChecked(false);
  }
  async function runSearch() {
    setBusy(true);setError('');setNotice('');setDiscoveryMessage('');
    try {const values=validateSearch();await acceptTerms();await loadRecommendations({...values,availableMinutes:String(search.availableMinutes)});}
    catch(e) {setError((e as Error).message);}
    finally {setBusy(false);}
  }
  async function discover() {
    setBusy(true);setError('');setNotice('');
    try {
      const values=validateSearch();
      await acceptTerms();
      const result=await request('/api/youtube/discover','POST',values);
      setDiscoveryMessage(result.message);
      await loadRecommendations({...values,availableMinutes:String(values.availableMinutes)});
    } catch(e) {setError((e as Error).message);}
    finally {setBusy(false);}
  }
  async function withdrawConsent() {
    setBusy(true);setError('');setNotice('');
    try {
      await request('/api/youtube/consent','POST',{accepted:false});
      setConsented(false);setConsentChecked(false);setVideos([]);setReview([]);setCanSearch(false);
      setNotice('YouTube feature consent withdrawn. You can accept again before using video discovery.');
    } catch(e) {setError((e as Error).message);}
    finally {setBusy(false);}
  }
  async function saveFeedback(video:Video,value:Feedback) {
    setBusy(true);setError('');setNotice('');
    try {
      await request(`/api/youtube/videos/${video._id}/feedback`,'POST',{feedback:value});
      setNotice('Feedback saved. VIKAS will use it to order future suggestions.');
      await loadRecommendations();
    } catch(e) {setError((e as Error).message);}
    finally {setBusy(false);}
  }
  async function addToPlan(video:Video) {
    setBusy(true);setError('');setNotice('');
    try {
      const result=await request(`/api/youtube/videos/${video._id}/plan`,'POST',{});
      await onPlanAdded();
      setNotice(result.message);
    } catch(e) {setError((e as Error).message);}
    finally {setBusy(false);}
  }
  async function reviewAction(video:ReviewVideo,value:Record<string,unknown>) {
    setReviewBusy(true);setError('');setNotice('');
    try {
      await request(`/api/youtube/review/${video._id}`,'PATCH',value);
      await loadReview();
      setNotice('YouTube review decision saved.');
    } catch(e) {setError((e as Error).message);}
    finally {setReviewBusy(false);}
  }

  return <section className="youtube-discovery">
    <div className="section-heading"><div><span className="eyebrow">VIDEO LEARNING</span><h2>Reviewed YouTube lessons</h2></div><span className="pill">VIKAS-reviewed</span></div>
    <p>Search using your saved study pathway and actual subjects. Videos are external YouTube links; VIKAS never sends your name, email or profile text to YouTube.</p>
    {(error||notice)&&<p role={error?'alert':'status'} className={`inline-note ${error?'error':''}`}>{error||notice}</p>}
    <form className="youtube-search-form" onSubmit={event=>{event.preventDefault();void runSearch();}}>
      <label className="field"><span>Subject from your profile</span><select required disabled={!subjects.length} value={search.subject} onChange={event=>setSearch({...search,subject:event.target.value})}><option value="">Choose a saved subject</option>{subjects.map(subject=><option key={subject} value={subject}>{subject}</option>)}</select></label>
      <label className="field"><span>Topic</span><input required maxLength={120} value={search.topic} onChange={event=>setSearch({...search,topic:event.target.value})} placeholder="For example, electromagnetic induction"/></label>
      <label className="field"><span>Preferred video language</span><select required value={search.language} onChange={event=>setSearch({...search,language:event.target.value as YoutubeLanguage|''})}><option value="">Choose a language</option>{youtubeLanguages.map(language=><option key={language}>{language}</option>)}</select></label>
      <label className="field"><span>Topic level</span><select required value={search.difficulty} onChange={event=>setSearch({...search,difficulty:event.target.value as YoutubeDifficulty|''})}><option value="">Choose a level</option><option value="foundation">Foundation</option><option value="core">Core</option><option value="advanced">Advanced</option></select></label>
      <label className="field"><span>Available time (minutes)</span><input type="number" required min={5} max={180} step={1} value={search.availableMinutes} onChange={event=>setSearch({...search,availableMinutes:event.target.value})} placeholder="25"/></label>
      <label className="check-label youtube-consent"><input type="checkbox" checked={consented||consentChecked} disabled={consented||busy} onChange={event=>setConsentChecked(event.target.checked)}/><span>I agree to the <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube Terms of Service</a> and understand the <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a> and VIKAS data-use notice below.</span></label>
      <button className="primary" disabled={busy||!subjects.length}><Search size={16}/>Find approved videos</button>
    </form>
    {!subjects.length&&<p className="inline-note">Add actual subjects in your profile before searching. VIKAS does not infer subjects from a stream, branch or trade.</p>}
    {canSearch&&<div className="youtube-empty"><h3>No approved video matches this topic yet.</h3><p>Only reviewed, approved and active videos are recommended to students.</p><button className="secondary" disabled={busy||!signedIn} onClick={()=>void discover()}><Search size={16}/>Search for reviewed videos</button></div>}
    {discoveryMessage&&<p role="status" className="inline-note">{discoveryMessage}</p>}
    {videos.length>0&&<div className="youtube-results">{videos.map(video=><article className="youtube-card" key={video._id}>
      <img src={video.thumbnailUrl} alt="" width={320} height={180} loading="lazy"/>
      <div className="youtube-video-content"><span className="pill">{video.difficulty} · {video.language} · {duration(video.durationSeconds)}</span><h3>{video.title}</h3><p>{video.channel} · Published {dateLabel(video.publishedAt)}</p><p>{video.descriptionExcerpt}</p><p className="youtube-reason">{video.reason}</p>
        <div className="topic-actions"><a className="small-button" href={video.canonicalUrl} target="_blank" rel="noopener noreferrer">Open on YouTube <ExternalLink size={14}/></a><button className="secondary" disabled={busy||!signedIn} onClick={()=>void addToPlan(video)}><Plus size={15}/>Add to my plan</button><button className="text-button" onClick={()=>onAskDisha(video.title)}><MessageCircle size={15}/>Ask DISHA about this</button></div>
        <div className="youtube-feedback" aria-label="How did this video fit?">{([['too_easy','Too easy'],['about_right','About right'],['too_difficult','Too difficult'],['not_useful','Not useful']] as const).map(([value,label])=><button type="button" key={value} className="text-button" aria-pressed={video.feedback===value} disabled={busy||!signedIn} onClick={()=>void saveFeedback(video,value)}>{label}</button>)}</div>
      </div>
    </article>)}</div>}
    {consented&&<button className="text-button youtube-withdraw" disabled={busy} onClick={()=>void withdrawConsent()}>Withdraw YouTube feature consent</button>}
    {isReviewer&&consented&&<div className="youtube-review"><div className="section-heading"><div><ShieldCheck size={18}/><h2>Reviewer queue</h2></div><button className="text-button" onClick={()=>void loadReview().catch(e=>setError((e as Error).message))}>Refresh queue</button></div>
      {!review.length?<p>No YouTube candidates are waiting in the queue.</p>:review.map(video=>{
        const edit=tagEdits[video._id]||{subject:video.subject,topic:video.topic,difficulty:video.difficulty};
        return <article className="youtube-review-item" key={video._id}>
          <img src={video.thumbnailUrl} alt="" width={240} height={135} loading="lazy"/>
          <div><span className="pill">{video.reviewStatus}{video.isActive?' · active':''}</span><h3>{video.title}</h3><p>{video.channel} · {duration(video.durationSeconds)} · Published {dateLabel(video.publishedAt)}</p><p>{video.descriptionExcerpt}</p>
            <p>VIKAS tags: {video.requestedPathway} · {video.subject} · {video.topic} · {video.difficulty} · {video.intendedLanguage}</p><p>Made for Kids status: {video.madeForKids===null?'Not provided':video.madeForKids?'Yes':'No'} · Creator self-declaration: {video.selfDeclaredMadeForKids===null?'Not provided':video.selfDeclaredMadeForKids?'Yes':'No'}</p>
            <p>Search query: {video.searchQuery}</p><p>{video.whyDiscovered}</p><p>Fetched {dateLabel(video.fetchedAt)} · Last refreshed {dateLabel(video.refreshedAt)}</p>
            <p>YouTube ID: <code>{video.youtubeId}</code></p><a href={video.canonicalUrl} target="_blank" rel="noopener noreferrer">Open direct YouTube link ↗</a>
            <div className="youtube-tag-edit"><label className="field"><span>VIKAS subject tag</span><input value={edit.subject} maxLength={100} onChange={event=>setTagEdits({...tagEdits,[video._id]:{...edit,subject:event.target.value}})}/></label><label className="field"><span>VIKAS topic tag</span><input value={edit.topic} maxLength={120} onChange={event=>setTagEdits({...tagEdits,[video._id]:{...edit,topic:event.target.value}})}/></label><label className="field"><span>Intended difficulty</span><select value={edit.difficulty} onChange={event=>setTagEdits({...tagEdits,[video._id]:{...edit,difficulty:event.target.value as YoutubeDifficulty}})}><option value="foundation">Foundation</option><option value="core">Core</option><option value="advanced">Advanced</option></select></label></div>
            <div className="topic-actions"><button className="secondary" disabled={reviewBusy} onClick={()=>void reviewAction(video,{action:'edit',...edit})}>Save VIKAS tags</button><button className="primary" disabled={reviewBusy} onClick={()=>void reviewAction(video,{action:'approve'})}>Approve</button><button className="secondary" disabled={reviewBusy} onClick={()=>void reviewAction(video,{action:'reject'})}>Reject</button><button className="text-button" disabled={reviewBusy} onClick={()=>void reviewAction(video,{action:'inactive'})}>Mark inactive</button></div>
          </div>
        </article>;
      })}
    </div>}
    <p className="youtube-policy">VIKAS uses the YouTube Data API v3. Searches send only the minimum education query (pathway, subject, topic, chosen language and difficulty); available time is applied inside VIKAS. VIKAS does not send your name, email, reflections or profile text. VIKAS stores returned video metadata for review and refreshes it regularly. Displaying YouTube-hosted thumbnails or opening an external link may contact YouTube and disclose standard connection information; YouTube applies its own privacy settings. Videos are not embedded and autoplay is not used. Your consent is recorded before this feature accesses YouTube API data and can be withdrawn here. Read the <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube Terms of Service</a> and <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>.</p>
  </section>;
}
