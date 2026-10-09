'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
// Closing state/focus/navigation update immediately. Only an inert visual shell lingers.
export function MotionPresence({children}:{children:ReactNode}){
 const snapshot=useRef<ReactNode>(null),active=!!children;
 const [retained,setRetained]=useState(false);
 if(active)snapshot.current=children;
 useEffect(()=>{if(active){setRetained(true);return;}if(!retained)return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){snapshot.current=null;setRetained(false);return;}
  const timer=setTimeout(()=>{snapshot.current=null;setRetained(false);},200);return()=>clearTimeout(timer);
 },[active,retained]);
 if(!active&&!retained)return null;
 return <div className="motion-presence" data-exiting={!active||undefined} inert={!active} aria-hidden={!active||undefined}>{active?children:snapshot.current}</div>;
}
