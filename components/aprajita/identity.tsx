'use client';
import Image from 'next/image';
import {useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';

export function AprajitaIcon({header=false}:{header?:boolean}){
 const size=header?40:28;
 return <span className={`aprajita-flower${header?' aprajita-flower-header':''}`} aria-hidden="true"><Image src="/images/aprajita.png" alt="" width={size} height={size} sizes={`${size}px`}/></span>;
}

export function AprajitaWelcome(){
 const [visible,setVisible]=useState(false);
 const checked=useRef(false);
 useEffect(()=>{
  if(checked.current)return;checked.current=true;
  // Appearance preference only; account data and saved code remain server-owned.
  try{if(localStorage.getItem('vikas-aprajita-welcome-seen')==='1')return;localStorage.setItem('vikas-aprajita-welcome-seen','1');}catch{/* Still show the welcome when preferences cannot be stored. */}
  setVisible(true);
 },[]);
 if(!visible)return null;
 return <div className="aprajita-welcome" role="status"><p>Welcome to APRAJITA. Choose a language and start building.</p><button className="icon-button" aria-label="Dismiss APRAJITA welcome" onClick={()=>setVisible(false)}><X size={18}/></button></div>;
}
