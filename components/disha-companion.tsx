'use client';
import {useState} from 'react';
import {ArrowUpRight,BookOpen} from 'lucide-react';
import {DishaAvatar,type DishaExpression} from './disha-avatar';

export function DishaCompanion({expression='idle',onOpenTutor,onOpenSetup}:{expression?:DishaExpression;onOpenTutor:()=>void;onOpenSetup:()=>void}){
 const [curious,setCurious]=useState(false);
 return <div className="disha-companion-wrap">
  <button type="button" className="disha-companion" aria-label="Talk with DISHA, your learning mentor" onPointerEnter={()=>setCurious(true)} onPointerLeave={()=>setCurious(false)} onFocus={()=>setCurious(true)} onBlur={()=>setCurious(false)} onClick={onOpenTutor}>
   <span className="disha-companion-glow" aria-hidden="true"/><span className="disha-companion-orbit" aria-hidden="true"/>
   <DishaAvatar expression={curious&&expression==='idle'?'curious':expression} className="disha-companion-art"/>
   <span className="disha-companion-caption"><strong>DISHA</strong><small>Your learning mentor</small><span>Talk with me <ArrowUpRight size={15} aria-hidden="true"/></span></span>
  </button>
  <button type="button" className="disha-setup-link" onClick={onOpenSetup}><BookOpen size={14} aria-hidden="true"/> Study setup</button>
 </div>;
}
