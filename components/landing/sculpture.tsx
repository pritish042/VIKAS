'use client';
import {useEffect,useId,useRef,useState} from 'react';
import Link from 'next/link';
import {ArrowUpRight} from 'lucide-react';
import Image from 'next/image';

export function InteractiveSculpture(){
 const host=useRef<HTMLDivElement>(null),id=useId();
 const [expanded,setExpanded]=useState(false);
 useEffect(()=>{const el=host.current;if(!el)return;
  let cancelled=false,started=false,idle=0,beforePaint=0,afterPaint=0,observer:PerformanceObserver|undefined,dispose:(()=>void)|undefined;
  const enhance=()=>{if(cancelled)return;performance.mark('vikas-brain-initialization');
   void import('./sculpture-scene').then(({mountSculpture})=>{if(!cancelled)dispose=mountSculpture(el);}).catch(()=>{});
  };
  const ready=()=>{if(started||cancelled)return;started=true;observer?.disconnect();
   // Enhancement gets idle time after useful content has painted; no timed splash or gate.
   if('requestIdleCallback' in window)idle=window.requestIdleCallback(enhance);
   else afterPaint=requestAnimationFrame(enhance);
  };
  if(performance.getEntriesByName('first-contentful-paint').length)ready();
  else if(typeof PerformanceObserver!=='undefined'&&PerformanceObserver.supportedEntryTypes.includes('paint')){
   observer=new PerformanceObserver(list=>{if(list.getEntries().some(entry=>entry.name==='first-contentful-paint'))ready();});observer.observe({type:'paint',buffered:true});
  }else beforePaint=requestAnimationFrame(()=>{afterPaint=requestAnimationFrame(ready);});
  return()=>{cancelled=true;observer?.disconnect();if(idle)window.cancelIdleCallback(idle);cancelAnimationFrame(beforePaint);cancelAnimationFrame(afterPaint);dispose?.();};
 },[]);
 useEffect(()=>{host.current?.dispatchEvent(new Event('sculpture:expand'));},[expanded]);
 return <figure className="stitch-sculpture neural-sculpture" aria-label="Interactive neural learning network" onKeyDown={e=>{if(e.key==='Escape')setExpanded(false);}} onPointerEnter={e=>{if(e.pointerType==='mouse')setExpanded(true);}} onPointerLeave={e=>{if(e.pointerType==='mouse'&&!e.currentTarget.contains(document.activeElement))setExpanded(false);}} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setExpanded(false);}}>
  <div ref={host} className="sculpture-stage" data-expanded={expanded}>
   <div className="neural-fallback" aria-hidden="true"><Image src="/stitch/brain-preview.webp" alt="" width={615} height={560} sizes="(max-width:700px) 90vw,45vw" priority/></div>
   <nav id={id} className="neural-destinations" aria-label="Explore the learning network" hidden={!expanded} onFocus={()=>setExpanded(true)}>
    {[{title:'Learn',note:'Find your next lesson',href:'/learn'},{title:'Build',note:'Create in APRAJITA',href:'/labs'},{title:'Explore',note:'Think with DISHA',href:'/disha'},{title:'My Journey',note:'Connect your next steps',href:'/journey'}].map((item,i)=><Link href={item.href} key={item.title} className={`neural-link neural-link-${i}`}><span>{item.title}<ArrowUpRight size={14}/></span><small>{item.note}</small></Link>)}
   </nav>
  </div>
  <figcaption><button type="button" className="neural-toggle" aria-expanded={expanded} aria-controls={id} onClick={()=>setExpanded(!expanded)}>{expanded?'Close neural network':'Explore the neural network'}<span aria-hidden="true"> {expanded?'−':'+'}</span></button><small>Hover, tap or press Enter to explore</small><a className="brain-credit" href="/stitch/brain-CREDITS.txt" target="_blank" rel="noopener noreferrer">Brain geometry · Z-Anatomy / DBCLS · CC BY-SA</a></figcaption>
 </figure>;
}
