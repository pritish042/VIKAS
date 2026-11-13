'use client';
import {useEffect} from 'react';

// Preserve the lower-page entrance effects; the hero wordmark stays static.
export function LandingMotion(){
 useEffect(()=>{
  const root=document.getElementById('vikas-landing');if(!root)return;
  const visible=()=>{root.dataset.pageVisible=String(!document.hidden);};
  const observer=new IntersectionObserver(entries=>{
   for(const entry of entries){
    const section=entry.target as HTMLElement;
    section.dataset.visible=String(entry.isIntersecting);
    if(entry.isIntersecting&&entry.intersectionRatio>=.25)section.dataset.entered='true';
   }
  },{threshold:[0,.25]});
  root.querySelectorAll('[data-lp-observe]').forEach(el=>observer.observe(el));
  visible();document.addEventListener('visibilitychange',visible);
  return()=>{observer.disconnect();document.removeEventListener('visibilitychange',visible);delete root.dataset.pageVisible;};
 },[]);
 return null;
}
