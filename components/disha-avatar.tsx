'use client';
import {useEffect,useId,useRef,useState} from 'react';

export type {CompanionExpression as DishaExpression} from '@/lib/companion-events';
import type {CompanionExpression as DishaExpression} from '@/lib/companion-events';

/** Rendered character artwork with independent torso, head, iris and eyelid layers. */
export function DishaAvatar({expression='idle',className=''}:{expression?:DishaExpression;className?:string}){
 const svg=useRef<SVGSVGElement>(null),pointer=useRef({x:0,y:0}),frame=useRef(0),visible=useRef(true),scale=useRef(1);
 const id=useId().replaceAll(':','');
 const [blinking,setBlinking]=useState(false);
 useEffect(()=>{
  const root=svg.current;if(!root)return;
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  let x=0,y=0,tilt=0,glanceX=0,glanceY=0,lastPointerAt=0,idleTimer:ReturnType<typeof setTimeout>,glanceTimer:ReturnType<typeof setTimeout>|undefined;
  const render=()=>{
   frame.current=0;
   const ease=motion.matches?1:0.115;
   x+=(pointer.current.x-x)*ease;y+=(pointer.current.y-y)*ease;tilt+=(pointer.current.x*1.7-tilt)*ease;
   const size=scale.current;
   root.style.setProperty('--disha-head-x',`${x*1.8*size}px`);
   root.style.setProperty('--disha-head-y',`${y*1.2*size}px`);
   root.style.setProperty('--disha-head-tilt',`${tilt*size}deg`);
   root.style.setProperty('--disha-eye-x',`${x*2.5*size+glanceX*size}px`);
   root.style.setProperty('--disha-eye-y',`${y*1.8*size+glanceY*size}px`);
   if(!motion.matches&&(Math.abs(x-pointer.current.x)>.015||Math.abs(y-pointer.current.y)>.015||Math.abs(tilt-pointer.current.x*1.7)>.015))frame.current=requestAnimationFrame(render);
  };
  const queue=()=>{if(!frame.current)frame.current=requestAnimationFrame(render);};
  const scheduleIdleGlance=()=>{idleTimer=setTimeout(()=>{if(!motion.matches&&visible.current&&!document.hidden&&Date.now()-lastPointerAt>1800){glanceX=(Math.random()-.5)*1.1;glanceY=(Math.random()-.5)*.8;queue();glanceTimer=setTimeout(()=>{glanceX=0;glanceY=0;queue();},700);}scheduleIdleGlance();},3000+Math.random()*3000);};
  scheduleIdleGlance();
  const onPointer=(event:PointerEvent)=>{
   if(event.pointerType==='touch'||motion.matches)return;
   const box=root.getBoundingClientRect();if(!box.width||!box.height)return;
   scale.current=Math.min(1.25,Math.max(.2,box.width/180));
   const cx=box.left+box.width*.5,cy=box.top+box.height*.37;
   lastPointerAt=Date.now();glanceX=0;glanceY=0;
   pointer.current={x:Math.max(-1,Math.min(1,(event.clientX-cx)/(box.width*.72))),y:Math.max(-1,Math.min(1,(event.clientY-cy)/(box.height*.72)))};queue();
  };
  const reset=()=>{pointer.current={x:0,y:0};queue();};
  const pause=()=>{root.dataset.paused=String(document.hidden||!visible.current);if(document.hidden){cancelAnimationFrame(frame.current);frame.current=0;}};
  const observer=new IntersectionObserver(entries=>{visible.current=entries[0]?.isIntersecting??true;pause();});observer.observe(root);document.addEventListener('visibilitychange',pause);
  const onVisiblePointer=(event:PointerEvent)=>{if(visible.current&&!document.hidden&&!document.activeElement?.matches('input,textarea,select,[contenteditable=true]'))onPointer(event);};
  window.addEventListener('pointermove',onVisiblePointer,{passive:true});window.addEventListener('blur',reset);document.addEventListener('mouseleave',reset);
  const reduced=()=>{if(motion.matches){pointer.current={x:0,y:0};queue();}};motion.addEventListener('change',reduced);
  return()=>{clearTimeout(idleTimer);clearTimeout(glanceTimer);cancelAnimationFrame(frame.current);observer.disconnect();document.removeEventListener('visibilitychange',pause);window.removeEventListener('pointermove',onVisiblePointer);window.removeEventListener('blur',reset);document.removeEventListener('mouseleave',reset);motion.removeEventListener('change',reduced);};
 },[]);
 useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>,blinkTimer:ReturnType<typeof setTimeout>|undefined,alive=true;
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const schedule=()=>{timer=setTimeout(()=>{if(!alive)return;if(!motion.matches&&visible.current&&!document.hidden){setBlinking(true);blinkTimer=setTimeout(()=>{if(alive)setBlinking(false);},145);}schedule();},2600+Math.random()*3400);};
  if(!motion.matches)schedule();
  const change=()=>{clearTimeout(timer);clearTimeout(blinkTimer);if(!motion.matches)schedule();else setBlinking(false);};motion.addEventListener('change',change);
  return()=>{alive=false;clearTimeout(timer);clearTimeout(blinkTimer);motion.removeEventListener('change',change);};
 },[]);
 return <svg ref={svg} className={`disha-portrait-art disha-rendered-art ${className}`} data-expression={expression} data-blinking={blinking||undefined} viewBox="0 0 240 320" aria-hidden="true" focusable="false">
  <defs>
   <linearGradient id={`${id}-body-mask`} x1="0" y1="0" x2="0" y2="1"><stop offset="0.57" stopColor="black"/><stop offset="0.66" stopColor="white"/></linearGradient>
   <linearGradient id={`${id}-head-mask`} x1="0" y1="0" x2="0" y2="1"><stop offset="0.64" stopColor="white"/><stop offset="0.70" stopColor="black"/></linearGradient>
   <mask id={`${id}-body`}><rect width="240" height="320" fill={`url(#${id}-body-mask)`}/></mask>
   <mask id={`${id}-head`}><rect width="240" height="320" fill={`url(#${id}-head-mask)`}/></mask>
   <path id={`${id}-eye-left`} d="M84.9 115.8Q95.9 107.7 106.1 115.7L109 118Q96.6 122 84.9 115.8Z"/>
   <path id={`${id}-eye-right`} d="M135.4 117.8Q145.4 107.8 157.4 113.1L160.1 115.3Q148.7 121.8 135.4 117.8Z"/>
   <clipPath id={`${id}-eye-clip`}><use href={`#${id}-eye-left`}/><use href={`#${id}-eye-right`}/></clipPath>
   <radialGradient id={`${id}-sclera`} cx="50%" cy="65%" r="65%"><stop stopColor="#F3E4D7"/><stop offset=".65" stopColor="#DFCCBF"/><stop offset="1" stopColor="#AF8C7D"/></radialGradient>
   <radialGradient id={`${id}-iris`} cx="42%" cy="38%"><stop stopColor="#9C6C40"/><stop offset=".52" stopColor="#805331"/><stop offset=".82" stopColor="#674127"/><stop offset="1" stopColor="#35281F"/></radialGradient>
   <linearGradient id={`${id}-lid`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#C78F70"/><stop offset=".5" stopColor="#D9A184"/><stop offset="1" stopColor="#BF836B"/></linearGradient>
  </defs>
  {/* Shared transparent artwork; overlapping neck masks keep the torso stationary. */}
  <image href="/disha/disha-portrait-v2.webp" width="240" height="320" mask={`url(#${id}-body)`}/>
  <g className="disha-head">
   <image href="/disha/disha-portrait-v2.webp" width="240" height="320" mask={`url(#${id}-head)`}/>
   {/* Replace only the eye aperture, preserving the rendered lids, lashes and brows. */}
   <g className="disha-rendered-eyes">
    <use href={`#${id}-eye-left`} fill={`url(#${id}-sclera)`}/><use href={`#${id}-eye-right`} fill={`url(#${id}-sclera)`}/>
    <g clipPath={`url(#${id}-eye-clip)`}><g className="disha-pupils">
     {[96.4,147.8].map((cx)=><g key={cx}>
      <circle cx={cx} cy="114.7" r="5.35" fill={`url(#${id}-iris)`}/>
      {Array.from({length:20},(_,i)=><path key={i} d={`M${cx} 109.9v1.7`} stroke={i%2?'#C09358':'#3E2B1F'} strokeWidth=".28" opacity=".45" transform={`rotate(${i*18} ${cx} 114.7)`}/>)}
      <circle cx={cx} cy="114.7" r="2.5" fill="#201B18"/>
      <ellipse cx={cx-.9} cy="112.4" rx="1.15" ry=".8" fill="#FFF5E8" opacity=".88"/>
      <circle cx={cx+1} cy="113" r=".48" fill="#D3E7EF"/>
     </g>)}
    </g></g>
   </g>
   <g className="disha-rendered-blink">
    <use href={`#${id}-eye-left`} fill={`url(#${id}-lid)`}/><use href={`#${id}-eye-right`} fill={`url(#${id}-lid)`}/>
    <path d="M84.9 115.8Q96 120.2 109 118M135.4 117.8Q148 120.4 160.1 115.3" fill="none" stroke="#493028" strokeWidth=".7" strokeLinecap="round"/>
   </g>
  </g>
 </svg>;
}
