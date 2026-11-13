'use client';
import {useEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import {ArrowUpRight,BookOpen,Minus,Volume2,VolumeX,X} from 'lucide-react';
import {DishaAvatar,type DishaExpression} from './disha-avatar';
import {pageForPath} from '@/lib/navigation';
import {acceptCompanionEvent,COMPANION_EVENT,companionPlacement,companionResponses,navigationCompanionEvent,notifyCompanion,type CompanionEvent,type CompanionPolicy} from '@/lib/companion-events';

export function DishaCompanion({expression='idle',suspended=false,onOpenTutor,onOpenSetup}:{expression?:DishaExpression;suspended?:boolean;onOpenTutor:()=>void;onOpenSetup:()=>void}){
 const path=usePathname(),root=useRef<HTMLDivElement>(null),locked=useRef(false),target=useRef<number|undefined>(undefined),dimensions=useRef({width:0,height:0});
 const policy=useRef<CompanionPolicy>({lastRoutine:-Infinity,seen:{}});
 const [message,setMessage]=useState<CompanionEvent|null>(null),[leaving,setLeaving]=useState(false),[muted,setMuted]=useState(false),[minimized,setMinimized]=useState(false),[compact,setCompact]=useState(false),[quiet,setQuiet]=useState(false);
 useEffect(()=>{try{setMuted(localStorage.getItem('vikas-companion-muted')==='1');setMinimized(localStorage.getItem('vikas-companion-minimized')==='1');}catch{}},[]);
 useEffect(()=>{
  const receive=(event:Event)=>{const detail=(event as CustomEvent<CompanionEvent>).detail;if(!detail||!Object.hasOwn(companionResponses,detail.type)||muted||minimized||suspended||document.hidden||document.fullscreenElement)return;
   if(document.activeElement?.matches('input,textarea,select,[contenteditable=true]'))return;
   if(!acceptCompanionEvent(policy.current,detail.type,Date.now()))return;
   target.current=Number.isFinite(detail.targetY)?detail.targetY:undefined;setLeaving(false);setMessage(detail);
  };
  const clear=()=>{setMessage(null);policy.current={lastRoutine:-Infinity,seen:{}};};
  window.addEventListener(COMPANION_EVENT,receive);window.addEventListener('vikas:signed-out',clear);window.addEventListener('vikas:auth-changed',clear);
  return()=>{window.removeEventListener(COMPANION_EVENT,receive);window.removeEventListener('vikas:signed-out',clear);window.removeEventListener('vikas:auth-changed',clear);};
 },[muted,minimized,suspended]);
 useEffect(()=>{setMessage(null);const type=navigationCompanionEvent(pageForPath(path));if(type)notifyCompanion(type);},[path]);
 useEffect(()=>{if(!message)return;const fade=setTimeout(()=>setLeaving(true),companionResponses[message.type].duration-220);const close=setTimeout(()=>setMessage(null),companionResponses[message.type].duration);return()=>{clearTimeout(fade);clearTimeout(close);};},[message]);
 useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>;const el=root.current;if(!el)return;
  function place(){
   if(!el)return;
   const typing=!!document.activeElement?.matches('input,textarea,select,[contenteditable=true],.cm-content');
   const hidden=document.hidden||!!document.fullscreenElement||!!document.querySelector('[aria-modal=true],dialog[open],.disha-guide');
   el.hidden=hidden;setQuiet(typing||hidden);if(typing||hidden)setMessage(null);
   const view=window.visualViewport,height=view?.height||innerHeight,offset=view?.offsetTop||0;
   const resized=dimensions.current.width!==innerWidth||dimensions.current.height!==height;dimensions.current={width:innerWidth,height};
   if(height<360)setMessage(null);
   if(height<220){el.hidden=true;return;}
   if((locked.current&&!resized&&el.getBoundingClientRect().bottom<=offset+height-16)||suspended)return;
   const mobile=innerWidth<900||height<600;
   const obstacles=Array.from(document.querySelectorAll<HTMLElement>('main button,main a,main input,main textarea,main select,main article,main p,main h1,main h2,main video,main iframe,main pre,footer,.mobile-nav')).filter(n=>!el.contains(n)).map(n=>n.getBoundingClientRect()).filter(r=>r.width&&r.height&&r.right>innerWidth-280&&r.left<innerWidth&&r.bottom>0&&r.top<height).map(r=>({top:r.top-offset,bottom:r.bottom-offset}));
   const preferred=target.current??height*.53+Math.min(60,window.scrollY*.04);const tall=message?540:400;
   const y=mobile||minimized?null:companionPlacement(height,tall,preferred,obstacles);
   setCompact(mobile||y===null);
   const nav=document.querySelector('.mobile-nav')?.getBoundingClientRect();const clearance=nav&&nav.height?innerHeight-nav.top+16:32;
   el.style.setProperty('--companion-y',`${offset+(y??Math.max(8,height-clearance-(message?260:124)))}px`);
   // Full portrait placement requires an unobstructed vertical interval.
  }
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(place,150);};place();
  const observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);document.addEventListener('focusin',schedule);document.addEventListener('focusout',schedule);document.addEventListener('visibilitychange',schedule);document.addEventListener('fullscreenchange',schedule);window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);
  return()=>{clearTimeout(timer);observer.disconnect();window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);document.removeEventListener('focusin',schedule);document.removeEventListener('focusout',schedule);document.removeEventListener('visibilitychange',schedule);document.removeEventListener('fullscreenchange',schedule);window.visualViewport?.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('scroll',schedule);};
 },[minimized,message,suspended]);
 function preference(kind:'muted'|'minimized',value:boolean){if(kind==='muted')setMuted(value);else setMinimized(value);setMessage(null);try{localStorage.setItem(`vikas-companion-${kind}`,value?'1':'0');}catch{}}
 const small=minimized||compact;
 return <div ref={root} className="disha-companion-wrap disha-living" data-compact={small||undefined} data-quiet={quiet||undefined} data-suspended={suspended||undefined} onPointerEnter={()=>{locked.current=true;}} onPointerLeave={()=>{locked.current=false;}} onFocus={()=>{locked.current=true;}} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))locked.current=false;}}>
  {message&&!muted&&!minimized&&!quiet&&<div className="disha-speech" data-leaving={leaving||undefined}><small>DISHA</small><p aria-live="polite" aria-atomic="true">{companionResponses[message.type].text}</p><button type="button" aria-label="Dismiss DISHA message" onClick={()=>setMessage(null)}><X size={16}/></button></div>}
  <button type="button" className="disha-companion" aria-label="Talk with DISHA, your learning mentor" onClick={onOpenTutor}>
   <span className="disha-companion-glow" aria-hidden="true"/><span className="disha-companion-orbit" aria-hidden="true"/>
   <DishaAvatar expression={message&&!quiet?companionResponses[message.type].expression:expression} className="disha-companion-art"/>
   <span className="disha-companion-caption"><strong>DISHA</strong><small>Your learning mentor</small><span>Talk with me <ArrowUpRight size={15} aria-hidden="true"/></span></span>
  </button>
  <div className="disha-companion-tools"><button type="button" aria-label={muted?'Enable DISHA messages':'Silence DISHA messages'} aria-pressed={muted} onClick={()=>preference('muted',!muted)}>{muted?<VolumeX size={16}/>:<Volume2 size={16}/>}</button><button type="button" aria-label={minimized?'Restore DISHA':'Minimize DISHA'} aria-pressed={minimized} onClick={()=>preference('minimized',!minimized)}>{minimized?<ArrowUpRight size={16}/>:<Minus size={16}/>}</button><button type="button" aria-label="Open study setup" onClick={onOpenSetup}><BookOpen size={16}/></button></div>
 </div>;
}
