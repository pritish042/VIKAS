'use client';
import {useCallback,useEffect,useRef,useState,type CSSProperties} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {Minus,X} from 'lucide-react';
import {verifiedSession} from '@/lib/verified-session';
import {emptyProfile,type Profile} from '@/lib/types';
import {normalizeProfile} from '@/lib/education';
import {containsCredential,mergeOnboardingDraft,onboardingContext,sessionDraftAction,type OnboardingStep} from '@/lib/onboarding-contract';
import {StudyForm} from './study-form';
import {DishaGuide} from './disha-guide';
import {startGuide,type GuideTour} from '@/lib/guide-actions';
import {DishaAvatar} from './disha-avatar';
import {beginDishaAuthHandoff,clearDishaAuthHandoff} from '@/lib/onboarding-handoff';

type Phase='menu'|'editing'|'authentication'|'existing'|'complete';
type Snapshot={profile:Profile|null;revision:string;accountId:string};
async function request(path:string,data?:unknown){
 let r:Response;
 try{r=await fetch(`/api/onboarding/${path}`,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:undefined,body:data?JSON.stringify(data):undefined,cache:'no-store',signal:AbortSignal.timeout(25000)});}
 catch{throw new Error('The connection failed or took too long. Your draft is kept. Check your connection and try again.');}
 const result=await r.json().catch(()=>({error:'The server could not respond. Your draft is kept. Please try again.'}));
 if(!r.ok||result.error)throw Object.assign(new Error(result.error||'Please try again.'),{status:r.status});return result;
}
export function DishaOnboarding(){
 const router=useRouter(),pathname=usePathname();
 const [open,setOpen]=useState(false),[welcome,setWelcome]=useState(false),[phase,setPhase]=useState<Phase>('menu');
 const [viewport,setViewport]=useState({height:0,inset:0});
 const [draft,setDraft]=useState<Profile>({...emptyProfile,weeklyHours:0}),[step,setStep]=useState<OnboardingStep>('stage');
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[userId,setUserId]=useState<string|null>(null),[checked,setChecked]=useState(false);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[question,setQuestion]=useState(''),[answer,setAnswer]=useState(''),[aiBusy,setAiBusy]=useState(false),[retry,setRetry]=useState('');
 const launcher=useRef<HTMLButtonElement>(null),heading=useRef<HTMLHeadingElement>(null),touched=useRef(new Set<string>()),saving=useRef(false),handoff=useRef(false),bound=useRef<string|null>(null),draftOwner=useRef<string|null>(null),refreshId=useRef(0),aiRequest=useRef<AbortController|null>(null),seen=useRef(false);
 const phaseRef=useRef(phase);phaseRef.current=phase;
 const draftRef=useRef(draft);draftRef.current=draft;
 const dismiss=useCallback(()=>{setWelcome(false);try{localStorage.setItem('vikas-disha-welcome-seen','1');}catch{/* Only an appearance preference; setup stays in memory. */}},[]);
 const close=useCallback(()=>{setOpen(false);aiRequest.current?.abort();setAiBusy(false);dismiss();launcher.current?.focus();},[dismiss]);
 const refresh=useCallback(async(force=false)=>{
  const id=++refreshId.current;
  try{
   const session=await verifiedSession();if(session.error)throw new Error('Account status could not be checked. You can explore or try again.');
   const nextUser=session.data?.user.id||null;
   const next=nextUser?await request('profile') as Snapshot:null;
   if(next&&next.accountId!==nextUser)throw new Error('Account changed while loading.');
   if(id!==refreshId.current)return;
   setError(current=>current.startsWith('Account status')?'':current);
   const previous=draftOwner.current;
   const action=sessionDraftAction(previous,nextUser,!!draftRef.current.stage);
   if(action==='clear'){aiRequest.current?.abort();setAiBusy(false);setDraft({...emptyProfile,weeklyHours:0});touched.current.clear();setStep('stage');setPhase('menu');setAnswer('');setQuestion('');handoff.current=false;}
   if(action==='await_auth'){setPhase('authentication');setError('Your session expired. Your draft is kept in this tab. Sign in and review it before saving.');}
   bound.current=nextUser;draftOwner.current=nextUser||previous;setUserId(nextUser);if(force||previous!==nextUser||!['editing','existing'].includes(phaseRef.current)||handoff.current)setSnapshot(next);setChecked(true);
   if(next?.profile&&previous!==nextUser&&phaseRef.current==='editing')setPhase('existing');
   if(nextUser&&handoff.current){
    handoff.current=false;setOpen(true);setError('');setStep('review');setPhase(next?.profile?'existing':'editing');
   }
  }catch{if(id===refreshId.current){setChecked(true);setError('Account status is unavailable. Your draft is not saved. Use the secure sign-in form, then retry checking your account.');}}
 },[]);
 useEffect(()=>{void refresh();const update=()=>void refresh();window.addEventListener('focus',update);const signedOut=()=>{clearDishaAuthHandoff();draftOwner.current=null;bound.current=null;handoff.current=false;setUserId(null);setSnapshot(null);setDraft({...emptyProfile,weeklyHours:0});touched.current.clear();setStep('stage');setPhase('menu');setQuestion('');setAnswer('');aiRequest.current?.abort();setAiBusy(false);void refresh();};window.addEventListener('vikas:signed-out',signedOut);window.addEventListener('vikas:auth-changed',update);window.addEventListener('vikas:profile-changed',update);return()=>{++refreshId.current;window.removeEventListener('focus',update);window.removeEventListener('vikas:signed-out',signedOut);window.removeEventListener('vikas:auth-changed',update);window.removeEventListener('vikas:profile-changed',update);};},[refresh]);
 useEffect(()=>{if(phase!=='authentication')return;const timer=setInterval(()=>void refresh(),5000);return()=>clearInterval(timer);},[phase,refresh]);
 useEffect(()=>{const view=window.visualViewport;if(!view)return;const update=()=>setViewport({height:view.height,inset:Math.max(0,window.innerHeight-view.height-view.offsetTop)});update();view.addEventListener('resize',update);view.addEventListener('scroll',update);return()=>{view.removeEventListener('resize',update);view.removeEventListener('scroll',update);};},[]);
 useEffect(()=>{if(seen.current)return;seen.current=true;try{if(localStorage.getItem('vikas-disha-welcome-seen')||localStorage.getItem('vikas-guide-dismissed'))return;localStorage.setItem('vikas-disha-welcome-seen','1');}catch{}setWelcome(true);},[]);
 useEffect(()=>{if(open){heading.current?.focus();const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();close();}};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);}},[open,close]);
 useEffect(()=>{aiRequest.current?.abort();setAiBusy(false);setAnswer('');setRetry('');},[step,draft]);
 function change(next:Profile){for(const key of ['interests','goal','weeklyHours','bio'] as const)if(JSON.stringify(next[key])!==JSON.stringify(draft[key]))touched.current.add(key);setDraft(next);setError('');}
 function start(){dismiss();setError('');if(snapshot?.profile){setPhase('existing');return;}setPhase('editing');}
 function authenticate(path:'signup'|'login'){
  beginDishaAuthHandoff();handoff.current=true;setPhase('authentication');setOpen(false);dismiss();router.push(`/${path}`);
 }
 async function finish(candidate:Profile){
  if(saving.current)return;
  const profile={...candidate,interests:candidate.interests.map(s=>s.trim()).filter(Boolean),onboardingComplete:true};setDraft(profile);
  if(!userId||!snapshot){setPhase('authentication');return;}
  saving.current=true;setBusy(true);setError('');
  try{
   const session=await verifiedSession();if(session.error||!session.data)throw Object.assign(new Error('Your session expired. Sign in, then review and confirm again.'),{status:401});
   if(session.data.user.id!==userId){await refresh();throw new Error('Your account changed. Start setup again for this account.');}
   const result=await request('profile',{profile,expectedRevision:snapshot.revision,confirmed:true}) as Snapshot;
   if(bound.current!==userId||result.accountId!==userId)return;
   setSnapshot(result);setPhase('complete');window.dispatchEvent(new Event('vikas:profile-changed'));
  }catch(e){const failure=e as Error&{status?:number};setError(failure.message);if(failure.status===401)setPhase('authentication');if(failure.status===409){await refresh(true);setPhase('existing');}}
  finally{saving.current=false;setBusy(false);}
 }
 async function help(message:string){
  if(aiBusy||!message.trim())return;
  if(containsCredential(message)){setQuestion('');setAnswer('Use the secure account forms for passwords and codes. Ask only about your study setup here.');setRetry('');return;}
  const controller=new AbortController();aiRequest.current?.abort();aiRequest.current=controller;setAiBusy(true);setAnswer('');setRetry(message);setQuestion('');
  const timer=setTimeout(()=>{if(aiRequest.current===controller&&!controller.signal.aborted){setAnswer('AI help took too long. Continue with the guided questions or retry.');setAiBusy(false);controller.abort();}},25000);
  try{const r=await fetch('/api/onboarding/help',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,step,context:onboardingContext(step,draft)}),signal:controller.signal});const result=await r.json();if(controller.signal.aborted)return;if(!r.ok)throw new Error(result.error||'AI help is unavailable.');setAnswer(result.status==='used'?result.answer.answer:'AI help is unavailable right now. The guided questions still work. You can continue or retry shortly.');if(result.status==='used')setRetry('');}
  catch(e){if(!controller.signal.aborted)setAnswer(`${(e as Error).message} The guided questions still work.`);}
  finally{clearTimeout(timer);if(aiRequest.current===controller)setAiBusy(false);}
 }
 const inChat=/^\/(?:disha|mentor)\/?$/.test(pathname);
 return <><DishaGuide owner={userId||'guest'}/>{!inChat&&<aside className="disha-floating" data-keyboard={viewport.inset>120?'true':undefined} style={viewport.height?{'--disha-viewport-height':`${viewport.height}px`,'--disha-keyboard-inset':`${viewport.inset}px`} as CSSProperties:undefined} aria-label="DISHA onboarding assistant">
  {welcome&&!open&&!/^\/(?:login|signup|reset|forgot)\/?$/.test(pathname)&&<div className="disha-welcome" role="status"><button className="icon-button" aria-label="Dismiss DISHA welcome" onClick={dismiss}><X size={16}/></button><p>Hi, I’m DISHA. Would you like help getting started?</p><button className="text-button" onClick={()=>{dismiss();setOpen(true);}}>Get started</button></div>}
  {open&&<section id="disha-onboarding-panel" className="disha-panel" role="dialog" aria-modal="false" aria-labelledby="disha-heading">
   <header><span className="disha-portrait"><DishaAvatar/></span><div><h2 id="disha-heading" ref={heading} tabIndex={-1}>DISHA</h2><small>Your guide & setup helper</small></div><button className="icon-button" aria-label="Minimise DISHA" onClick={close}><Minus size={18}/></button><button className="icon-button" aria-label="Close DISHA" onClick={close}><X size={18}/></button></header>
   <div className="disha-content">
    <p className="field-hint">{userId?'Nothing changes until you review and confirm saving.':'Guest mode: explore and draft freely. Sign in and confirm before saving.'} Drafts stay in this tab’s memory; refreshing or closing the tab clears them.</p>
    {error&&<div role="alert" className="inline-note">{error}<button className="text-button" onClick={()=>void refresh()}>Check account again</button></div>}
    {phase==='menu'&&<div className="disha-menu"><div className="guide-tour-menu"><h3>Show me around</h3>{([['home','Home & all features'],['learn','Learning & resources'],['labs','APRAJITA Code Lab'],['journey','My Journey']] as [GuideTour,string][]).map(([tour,label])=><button key={tour} className="secondary" onClick={()=>{close();startGuide(tour);}}>{label}</button>)}</div><p>I can help you choose your study details, one question at a time.</p><button className="secondary" onClick={()=>authenticate('signup')}>Create an account</button><button className="secondary" onClick={()=>authenticate('login')}>Sign in</button><button className="primary" disabled={!checked} onClick={start}>Set up my studies</button><button className="text-button" onClick={()=>{close();router.push('/learn');}}>Explore first</button></div>}
    {phase==='existing'&&<div className="disha-menu"><h3>You already have a saved profile.</h3><p>{snapshot?.profile?.level} · {snapshot?.profile?.stream}</p><p>Your saved studies will stay as they are unless you choose to review and explicitly save changes.</p><button className="secondary" onClick={()=>{if(snapshot?.profile)setDraft(normalizeProfile(snapshot.profile));setStep('review');setPhase('editing');}}>Review my saved studies</button>{draft.stage&&<button className="secondary" onClick={()=>{if(snapshot?.profile)setDraft(mergeOnboardingDraft(normalizeProfile(snapshot.profile),draft,touched.current));setStep('review');setPhase('editing');}}>Review my draft changes</button>}<button className="text-button" onClick={()=>setPhase('menu')}>Keep my saved profile</button></div>}
    {phase==='editing'&&<><StudyForm profile={draft} savedProfile={snapshot?.profile?normalizeProfile(snapshot.profile):undefined} onChange={change} onFinish={p=>void finish(p)} step={step} onStepChange={setStep} busy={busy} canSave={!!userId} optionalTime finishLabel={userId?'Confirm and save my studies':'Review complete — sign in to save'} onExplore={()=>{close();router.push('/learn');}}/>
     <div className="disha-help"><p className="field-hint">AI help uses Google Gemini with only your question and relevant details for this step. Do not enter passwords, codes or reset links.</p><button className="text-button" disabled={aiBusy} onClick={()=>void help('Explain this setup question and how I can answer it.')}>Explain this question</button><form onSubmit={e=>{e.preventDefault();void help(question);}}><label htmlFor="disha-question">Ask about this step</label><textarea id="disha-question" rows={2} maxLength={1000} value={question} onChange={e=>{if(containsCredential(e.target.value)){setQuestion('');setAnswer('Keep passwords and codes in the secure account forms.');}else setQuestion(e.target.value);}}/><button className="secondary" disabled={aiBusy||!question.trim()}>Ask DISHA</button></form><div role="status" aria-live="polite">{aiBusy?'DISHA is thinking…':answer}</div>{retry&&!aiBusy&&<button className="text-button" onClick={()=>void help(retry)}>Retry AI help</button>}</div></>}
    {phase==='authentication'&&<div className="disha-menu"><h3>Save after secure sign-in</h3><p>Use the account form for credentials. I’ll resume your unfinished studies after the app verifies your session. You’ll review and confirm again before saving.</p><button className="secondary" onClick={()=>authenticate('signup')}>Create an account</button><button className="secondary" onClick={()=>authenticate('login')}>Sign in</button><button className="text-button" onClick={()=>{handoff.current=true;void refresh();}}>I’ve signed in — check and resume</button><button className="text-button" onClick={()=>{setStep('review');setPhase('editing');}}>Back to my draft</button></div>}
    {phase==='complete'&&<div className="disha-menu"><h3>Your studies are saved.</h3><p>Your existing learning records remain attached to your account.</p><button className="primary" onClick={()=>{close();router.push('/today');}}>Open my space</button><button className="text-button" onClick={()=>setPhase('menu')}>Back to DISHA</button></div>}
   </div>
  </section>}
  <button ref={launcher} className="disha-launcher" aria-label={open?'Minimise DISHA onboarding assistant':'Open DISHA guide and setup helper'} aria-expanded={open} aria-controls="disha-onboarding-panel" onClick={()=>{if(open)close();else{dismiss();setOpen(true);}}}><DishaAvatar/><span>DISHA</span></button>
 </aside>}</>;
}
