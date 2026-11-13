'use client';
import {useEffect} from 'react';
import {landingMotion} from '@/lib/landing-motion';

/** CSS renders both worlds immediately; observers only enhance motion and visibility. */
export function LandingAtmosphere(){
 useEffect(()=>{
  const root=document.querySelector<HTMLElement>('.neural-landing'),hero=root?.querySelector<HTMLElement>('.landing-hero');if(!root||!hero)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover:hover) and (pointer:fine)');
  let frame=0,last=0,active=true,x=0,y=0,targetX=0,targetY=0;
  const paint=()=>{
   const heroProgress=Math.min(1,Math.max(0,-hero.getBoundingClientRect().top/Math.max(1,hero.offsetHeight)));
   root.style.setProperty('--hero-progress',String(reduced.matches?0:heroProgress));
   root.style.setProperty('--story-progress',String(reduced.matches?0:Math.min(1,scrollY/Math.max(1,root.offsetHeight-innerHeight))));
   root.style.setProperty('--atmosphere-x',`${x}px`);root.style.setProperty('--atmosphere-y',`${y}px`);
  };
  const tick=(now:number)=>{frame=0;if(document.hidden)return;const delta=last?Math.min((now-last)/1000,.05):1/60;last=now;const ease=1-Math.exp(-delta*landingMotion.springResponse);x+=(targetX-x)*ease;y+=(targetY-y)*ease;paint();if(active&&!reduced.matches&&(Math.abs(x-targetX)>.02||Math.abs(y-targetY)>.02))frame=requestAnimationFrame(tick);else last=0;};
  const queue=()=>{if(!frame&&!document.hidden)frame=requestAnimationFrame(tick);};
  const reset=()=>{targetX=0;targetY=0;queue();};
  const move=(event:PointerEvent)=>{if(!active||reduced.matches||!fine.matches||document.hidden||event.pointerType==='touch')return;const box=hero.getBoundingClientRect();targetX=Math.max(-1,Math.min(1,(event.clientX-box.left)/box.width*2-1))*10;targetY=Math.max(-1,Math.min(1,(event.clientY-box.top)/box.height*2-1))*7;queue();};
  const visibility=()=>{root.dataset.pageVisible=String(!document.hidden);if(document.hidden){cancelAnimationFrame(frame);frame=0;last=0;}else queue();};
  const mode=()=>{if(reduced.matches||!fine.matches){cancelAnimationFrame(frame);frame=0;x=y=targetX=targetY=0;paint();}else queue();};
  const heroObserver=new IntersectionObserver(entries=>{active=entries[0]?.isIntersecting??false;root.dataset.heroActive=String(active);if(!active){targetX=targetY=x=y=0;cancelAnimationFrame(frame);frame=0;last=0;paint();}else queue();});heroObserver.observe(hero);
  const sections=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.setAttribute('data-arrived','true');sections.unobserve(entry.target);}},{threshold:.12});
  root.querySelectorAll('.landing-benefits,.landing-tools,.landing-pathways,.landing-final').forEach(el=>sections.observe(el));
  visibility();mode();
  hero.addEventListener('pointermove',move,{passive:true});hero.addEventListener('pointerleave',reset);window.addEventListener('scroll',queue,{passive:true});window.addEventListener('resize',queue);document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',mode);fine.addEventListener('change',mode);
  return()=>{cancelAnimationFrame(frame);heroObserver.disconnect();sections.disconnect();hero.removeEventListener('pointermove',move);hero.removeEventListener('pointerleave',reset);window.removeEventListener('scroll',queue);window.removeEventListener('resize',queue);document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',mode);fine.removeEventListener('change',mode);};
 },[]);
 return <div className="landing-atmosphere" aria-hidden="true"><div className="landing-world landing-world-cosmos"><div className="landing-world-field"/></div><div className="landing-world landing-world-dawn"><div className="landing-world-field"/></div><div className="landing-atmosphere-grid"/></div>;
}
