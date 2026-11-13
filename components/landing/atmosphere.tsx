'use client';
import {useEffect} from 'react';

/** Optional enhancement: content is always visible before this effect runs. */
export function LandingAtmosphere(){
 useEffect(()=>{
  const hero=document.querySelector<HTMLElement>('.landing-hero');if(!hero)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover:hover) and (pointer:fine)');
  let frame=0;
  const reset=()=>{cancelAnimationFrame(frame);frame=0;hero.style.removeProperty('--atmosphere-x');hero.style.removeProperty('--atmosphere-y');};
  const move=(e:PointerEvent)=>{if(reduced.matches||!fine.matches||document.hidden||frame)return;const box=hero.getBoundingClientRect();const x=Math.max(-1,Math.min(1,(e.clientX-box.left)/box.width*2-1)),y=Math.max(-1,Math.min(1,(e.clientY-box.top)/box.height*2-1));frame=requestAnimationFrame(()=>{frame=0;hero.style.setProperty('--atmosphere-x',`${x*7}px`);hero.style.setProperty('--atmosphere-y',`${y*5}px`);});};
  const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.setAttribute('data-arrived','true');observer.unobserve(entry.target);}},{threshold:.12});
  document.querySelectorAll('.landing-benefits,.landing-tools,.landing-pathways,.landing-final').forEach(el=>observer.observe(el));
  hero.addEventListener('pointermove',move,{passive:true});hero.addEventListener('pointerleave',reset);document.addEventListener('visibilitychange',reset);reduced.addEventListener('change',reset);fine.addEventListener('change',reset);
  return()=>{reset();observer.disconnect();hero.removeEventListener('pointermove',move);hero.removeEventListener('pointerleave',reset);document.removeEventListener('visibilitychange',reset);reduced.removeEventListener('change',reset);fine.removeEventListener('change',reset);};
 },[]);
 return null;
}
