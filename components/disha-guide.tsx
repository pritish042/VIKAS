'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {DishaAvatar} from './disha-avatar';
import {guideActionSchema,guideSteps,guidePlacement,type GuideTour} from '@/lib/guide-actions';
import {pageForPath} from '@/lib/navigation';
export function DishaGuide({owner}:{owner:string}){
 const router=useRouter(),path=usePathname();
 const [tour,setTour]=useState<GuideTour|null>(null),[index,setIndex]=useState(0),[position,setPosition]=useState<CSSProperties>({}),[missing,setMissing]=useState(false),[waiting,setWaiting]=useState(false);
 const previousFocus=useRef<HTMLElement|null>(null),heading=useRef<HTMLHeadingElement>(null),panel=useRef<HTMLElement>(null);
 const step=tour?guideSteps[tour][index]:null;
 function finish(){setTour(null);try{localStorage.setItem('vikas-guide-dismissed','1');}catch{}const before=previousFocus.current;if(before?.isConnected)before.focus();else document.querySelector<HTMLButtonElement>('.disha-launcher,.mentor-guide-button')?.focus();}
 useEffect(()=>{
  const start=(event:Event)=>{const action=guideActionSchema.safeParse((event as CustomEvent).detail);if(!action.success)return;previousFocus.current=document.activeElement as HTMLElement;setIndex(0);setTour(action.data.tour);};
  const stop=()=>setTour(null);
  window.addEventListener('vikas:guide-start',start);window.addEventListener('vikas:signed-out',stop);
  return()=>{window.removeEventListener('vikas:guide-start',start);window.removeEventListener('vikas:signed-out',stop);};
 },[]);
 useEffect(()=>{setTour(null);},[owner]);
 useEffect(()=>{
  if(!step)return;
  let cancelled=false,target:HTMLElement|null=null,resize:ResizeObserver|undefined;
  const place=()=>{const view=window.visualViewport,width=view?.width||window.innerWidth,height=view?.height||window.innerHeight,offset=view?.offsetTop||0;setPosition(guidePlacement(width,height,offset,Math.max(0,window.innerHeight-height-offset),target?.getBoundingClientRect(),panel.current?.offsetHeight) as CSSProperties);};
  setWaiting(true);setMissing(false);place();
  if(pageForPath(path)!==pageForPath(step.route)){
   // Respect the lab's existing unsaved-file navigation guard.
   if(!window.dispatchEvent(new Event('aprajita:leave',{cancelable:true}))){setWaiting(false);setMissing(true);return;}
   router.push(step.route);return;
  }
  const observer=new MutationObserver(find);
  const timeout=setTimeout(()=>{if(!target&&!cancelled){setWaiting(false);setMissing(true);place();heading.current?.focus();observer.disconnect();}},3000);
  function find(){
   if(cancelled||target)return;
   target=document.querySelector<HTMLElement>(`[data-guide-id="${step!.target}"]`);
   if(!target)return;
   clearTimeout(timeout);observer.disconnect();target.dataset.guided='true';
   // Tours are explicitly requested; ordinary page visits never scroll.
   target.scrollIntoView({block:'center',behavior:'auto'});
   setWaiting(false);place();resize=new ResizeObserver(place);resize.observe(target);if(panel.current)resize.observe(panel.current);heading.current?.focus();
  }
  observer.observe(document.body,{childList:true,subtree:true});find();
  window.addEventListener('resize',place);window.addEventListener('scroll',place,{passive:true});window.visualViewport?.addEventListener('resize',place);window.visualViewport?.addEventListener('scroll',place);
  return()=>{cancelled=true;clearTimeout(timeout);observer.disconnect();resize?.disconnect();if(target)delete target.dataset.guided;window.removeEventListener('resize',place);window.removeEventListener('scroll',place);window.visualViewport?.removeEventListener('resize',place);window.visualViewport?.removeEventListener('scroll',place);};
 },[step,path,router]);
 useEffect(()=>{if(!tour)return;const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();finish();}};document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);},[tour]);
 if(!tour||!step)return null;
 return <aside ref={panel} className="disha-guide" style={position} role="dialog" aria-modal="false" aria-labelledby="guide-heading"><div className="guide-heading"><span className="disha-portrait"><DishaAvatar/></span><div><small>DISHA · {index+1}/{guideSteps[tour].length}</small><h2 id="guide-heading" tabIndex={-1} ref={heading}>{step.title}</h2></div><button className="icon-button" aria-label="Skip guide" onClick={finish}>×</button></div><p role="status">{waiting?'Finding this section…':missing?'This section is not available here. Continue the tour or finish; your work stays unchanged.':step.text}</p><div className="topic-actions"><button className="secondary" disabled={index===0} onClick={()=>setIndex(index-1)}>Back</button>{index<guideSteps[tour].length-1?<button className="primary" onClick={()=>setIndex(index+1)}>Next</button>:<button className="primary" onClick={finish}>Finish</button>}<button className="text-button" onClick={finish}>Skip</button></div></aside>;
}
