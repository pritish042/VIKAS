'use client';
import {useEffect,useId,useRef,useState} from 'react';

export type DishaExpression='idle'|'greeting'|'curious'|'listening'|'thinking'|'speaking'|'encouraging'|'celebration';

/** A layered, theme-aware portrait. Pointer motion updates SVG variables in rAF. */
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
  const scheduleIdleGlance=()=>{idleTimer=setTimeout(()=>{if(!motion.matches&&visible.current&&Date.now()-lastPointerAt>1800){glanceX=(Math.random()-.5)*1.1;glanceY=(Math.random()-.5)*.8;queue();glanceTimer=setTimeout(()=>{glanceX=0;glanceY=0;queue();},700);}scheduleIdleGlance();},3000+Math.random()*3000);};
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
  const observer=new IntersectionObserver(entries=>{visible.current=entries[0]?.isIntersecting??true;});observer.observe(root);
  const onVisiblePointer=(event:PointerEvent)=>{if(visible.current)onPointer(event);};
  window.addEventListener('pointermove',onVisiblePointer,{passive:true});window.addEventListener('blur',reset);document.addEventListener('mouseleave',reset);
  const reduced=()=>{if(motion.matches){pointer.current={x:0,y:0};queue();}};motion.addEventListener('change',reduced);
  return()=>{clearTimeout(idleTimer);clearTimeout(glanceTimer);cancelAnimationFrame(frame.current);observer.disconnect();window.removeEventListener('pointermove',onVisiblePointer);window.removeEventListener('blur',reset);document.removeEventListener('mouseleave',reset);motion.removeEventListener('change',reduced);};
 },[]);
 useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>,blinkTimer:ReturnType<typeof setTimeout>|undefined,alive=true;
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const schedule=()=>{timer=setTimeout(()=>{if(!alive)return;if(!motion.matches){setBlinking(true);blinkTimer=setTimeout(()=>{if(alive)setBlinking(false);},145);}schedule();},2600+Math.random()*3400);};
  if(!motion.matches)schedule();
  const change=()=>{clearTimeout(timer);clearTimeout(blinkTimer);if(!motion.matches)schedule();else setBlinking(false);};motion.addEventListener('change',change);
  return()=>{alive=false;clearTimeout(timer);clearTimeout(blinkTimer);motion.removeEventListener('change',change);};
 },[]);
 return <svg ref={svg} className={`disha-portrait-art ${className}`} data-expression={expression} data-blinking={blinking||undefined} viewBox="0 0 240 320" aria-hidden="true" focusable="false">
  <defs>
   <radialGradient id={`${id}-skin`} cx="40%" cy="28%" r="78%"><stop offset="0" stopColor="#FFE6D3"/><stop offset=".55" stopColor="#F3C9AE"/><stop offset="1" stopColor="#D99579"/></radialGradient>
   <linearGradient id={`${id}-hair`} x1=".1" y1=".08" x2=".9" y2=".9"><stop stopColor="#3B202C"/><stop offset=".38" stopColor="var(--avatar-hair)"/><stop offset=".68" stopColor="#9A5860"/><stop offset="1" stopColor="#4B2633"/></linearGradient>
   <linearGradient id={`${id}-hair-light`} x1="0" y1="0" x2="1" y2=".2"><stop stopColor="#FFE1CA" stopOpacity="0"/><stop offset=".48" stopColor="#F8D6C3" stopOpacity=".55"/><stop offset="1" stopColor="#F8D6C3" stopOpacity="0"/></linearGradient>
   <linearGradient id={`${id}-cloth`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#D2DED0"/><stop offset=".48" stopColor="var(--accent)"/><stop offset="1" stopColor="#697E76"/></linearGradient>
   <radialGradient id={`${id}-iris`} cx="35%" cy="28%"><stop stopColor="#B78561"/><stop offset=".65" stopColor="#76513F"/><stop offset="1" stopColor="#382B30"/></radialGradient>
   <filter id={`${id}-soft-shadow`} x="-.3" y="-.3" width="1.6" height="1.7"><feGaussianBlur stdDeviation="5"/></filter>
   <filter id={`${id}-face-shadow`} x="-.3" y="-.2" width="1.6" height="1.5"><feGaussianBlur stdDeviation="2.8"/></filter>
  </defs>
  <ellipse cx="120" cy="300" rx="78" ry="12" fill="#271A27" opacity=".12" filter={`url(#${id}-soft-shadow)`}/>
  <g className="disha-body">
   <path d="M43 320c2-51 21-78 54-86l23 23 24-23c33 8 52 35 54 86H43Z" fill={`url(#${id}-cloth)`}/>
   <path d="M95 235c5 18 16 30 25 30s21-12 25-30l-25-15-25 15Z" fill="#F4EBDD"/>
   <path d="m106 252 14 17 14-17-14-8-14 8Z" fill="#7E3548" opacity=".86"/>
   <path d="M61 281c15-19 34-29 48-32m70 32c-15-19-34-29-48-32" fill="none" stroke="#F4EBDD" strokeOpacity=".25" strokeWidth="2"/>
  </g>
  <path className="disha-neck" d="M99 207h42v42c-6 12-13 17-21 17s-15-5-21-17v-42Z" fill={`url(#${id}-skin)`}/>
  <g className="disha-head">
   <g className="disha-hair-back">
    <path d="M59 118c-12-59 13-102 62-105 54-3 75 42 61 104l18 68c-10 28-28 43-47 40l-75-8c-27 2-42-20-44-43l25-56Z" fill={`url(#${id}-hair)`}/>
    <path d="M69 110c-6-51 13-82 49-88 36-5 58 22 56 62-15-18-29-23-45-22-11 20-31 35-60 48Z" fill={`url(#${id}-hair-light)`} opacity=".52"/>
    <path d="M62 154c-3 30-1 50 10 66m102-68c5 26 3 47-6 63" fill="none" stroke="#D08A85" strokeOpacity=".34" strokeWidth="4" strokeLinecap="round"/>
   </g>
   <path d="M76 100c0-34 19-58 44-58s44 24 44 58v50c0 39-20 68-44 68s-44-29-44-68v-50Z" fill={`url(#${id}-skin)`}/>
   <ellipse cx="72" cy="133" rx="8" ry="13" fill="#E7B79C"/><ellipse cx="168" cy="133" rx="8" ry="13" fill="#E7B79C"/>
   <path d="M73 121c0-51 25-77 52-77 30 0 48 25 43 67-10-1-17-8-24-22-17 16-43 25-71 32Z" fill={`url(#${id}-hair)`}/>
   <path d="M82 111c6-34 20-50 43-55" fill="none" stroke="#F5C5A8" strokeOpacity=".44" strokeWidth="4" strokeLinecap="round"/>
   <path d="M84 119c8-5 17-5 25-1m22 0c8-4 17-4 25 1" fill="none" stroke="#603642" strokeWidth="3.2" strokeLinecap="round"/>
   <g className="disha-eyes">
    <path d="M85 133c5-9 18-11 27-3-4 10-18 13-27 3Zm43-3c9-8 22-6 27 3-9 10-23 7-27-3Z" fill="#FFF8EE"/>
    <g className="disha-pupils">
     <ellipse cx="99" cy="132.5" rx="5.3" ry="7.1" fill={`url(#${id}-iris)`}/><ellipse cx="141" cy="132.5" rx="5.3" ry="7.1" fill={`url(#${id}-iris)`}/>
     <ellipse cx="99" cy="133.3" rx="2.7" ry="4.2" fill="#241E23"/><ellipse cx="141" cy="133.3" rx="2.7" ry="4.2" fill="#241E23"/>
     <circle cx="100.4" cy="130.4" r="1.7" fill="white"/><circle cx="142.4" cy="130.4" r="1.7" fill="white"/><circle cx="97" cy="135" r=".8" fill="#F5DCCB"/>
    </g>
   </g>
   <path d="M87 126c6-7 17-8 25-2m20 0c8-6 19-5 25 2" fill="none" stroke="#552E38" strokeWidth="2.5" strokeLinecap="round"/>
   <ellipse cx="83" cy="155" rx="10" ry="5.5" fill="#C96F72" opacity=".18"/><ellipse cx="157" cy="155" rx="10" ry="5.5" fill="#C96F72" opacity=".18"/>
   <path d="M119 137c-2 8-5 17-5 20 2 2 6 3 10 1" fill="none" stroke="#C68D77" strokeWidth="2" strokeLinecap="round"/>
   <path className="disha-mouth" d="M108 177c7 7 17 7 24 0" fill="none" stroke="#913F50" strokeWidth="3" strokeLinecap="round"/>
   <path d="M111 176c5 2 13 2 18 0" fill="none" stroke="#FFF4E8" strokeWidth="1.5" strokeLinecap="round"/>
   <path d="M98 188c9 7 34 8 44 0" fill="none" stroke="#E7AC96" strokeOpacity=".55" strokeWidth="1.5"/>
  </g>
 </svg>;
}
