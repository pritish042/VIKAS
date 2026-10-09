'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Pencil, Search } from 'lucide-react';
import { stages, type Education, type Profile } from '@/lib/types';
import { boards, changeEducation, changeStage, classChoices, disciplineChoices, educationErrors, educationFor, educationReviewRequired, isSchool, periodChoices, programChoices, streams, withEducation } from '@/lib/education';

import {SubjectPicker} from '@/components/subject-picker';
import {seniorSubjectIssues} from '@/lib/senior-subjects';
import {studyStepsFor,type OnboardingStep} from '@/lib/onboarding-contract';

export type StudyStep = OnboardingStep;
export const stepsFor=studyStepsFor;
function SearchChoice({label,value,options,onChange,maxLength=150}:{label:string;value:string;options:string[];onChange:(value:string)=>void;maxLength?:number}) {
 const id=useId();const [query,setQuery]=useState(value);const [open,setOpen]=useState(false);const [active,setActive]=useState(0);const input=useRef<HTMLInputElement>(null);
 useEffect(()=>{setQuery(value);},[value]);
 const matches=[...new Set(options)].filter(option=>option.toLowerCase().includes(query.toLowerCase()));
 const choices=[...matches,...(query.trim()&&!options.includes(query.trim())?[query.trim()]:[])];
 function choose(answer:string){setQuery(answer);onChange(answer);setOpen(false);input.current?.setCustomValidity('');input.current?.focus();}
 return <div className="choice-field"><label htmlFor={id}>{label}</label><div className="search-choice"><Search size={18} aria-hidden="true"/><input ref={input} id={id} role="combobox" aria-expanded={open} aria-controls={`${id}-options`} aria-autocomplete="list" aria-activedescendant={open&&choices.length?`${id}-option-${Math.min(active,choices.length-1)}`:undefined} autoComplete="off" value={query} maxLength={maxLength} onFocus={()=>{setOpen(true);setActive(0);}} onBlur={()=>{setOpen(false);if(query!==value){setQuery(value);input.current?.setCustomValidity('');}}} onChange={event=>{setQuery(event.target.value);setOpen(true);setActive(0);event.target.setCustomValidity('Choose an answer from the suggestions below.');}} onKeyDown={event=>{if(event.key==='Escape'){setQuery(value);setOpen(false);input.current?.setCustomValidity('');}if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setOpen(true);setActive(n=>Math.max(0,Math.min(choices.length-1,n+(event.key==='ArrowDown'?1:-1))));}if(event.key==='Enter'&&open){event.preventDefault();if(choices.length)choose(choices[Math.min(active,choices.length-1)]);}}} placeholder="Search or type your answer"/><button type="button" className="choice-toggle" aria-label={`Show all ${label.toLowerCase()} choices`} onMouseDown={event=>event.preventDefault()} onClick={()=>{setQuery('');setOpen(true);setActive(0);input.current?.focus();}}>⌄</button></div>
 {open&&<div id={`${id}-options`} role="listbox" aria-label={label} className="choice-options">{choices.map((option,index)=><button id={`${id}-option-${index}`} key={option} type="button" role="option" tabIndex={-1} aria-selected={value===option} className={index===active?'highlighted':''} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(option)}>{options.includes(option)?option:`Use “${option}”`}</button>)}{!choices.length&&<p>No matches. Type your own answer.</p>}</div>}
 <p className="field-hint">Choose a suggestion, use your own answer, or select “Not sure.”</p></div>;
}
export function StudyForm({profile,savedProfile,onChange,onFinish,onExplore,mode='onboarding',busy=false,canSave=true,step:controlledStep,onStepChange,finishLabel,optionalTime=false}:{profile:Profile;savedProfile?:Profile;onChange:(p:Profile)=>void;onFinish:(p:Profile)=>void;onExplore?:()=>void;mode?:'onboarding'|'profile';busy?:boolean;canSave?:boolean;step?:StudyStep;onStepChange?:(step:StudyStep)=>void;finishLabel?:string;optionalTime?:boolean}) {
 const [ownStep,setOwnStep]=useState<StudyStep>(mode==='profile'?'review':'stage');
 const step=controlledStep??ownStep;const setStep=(next:StudyStep)=>{setOwnStep(next);onStepChange?.(next);};
 const [reviewRequested,setReviewRequested]=useState(false);
 const [reviewedEducationKey,setReviewedEducationKey]=useState('');
 const heading=useRef<HTMLHeadingElement>(null);const e=educationFor(profile);const path=stepsFor(profile);const index=path.indexOf(step);const errors=educationErrors(profile.stage,e);
 const educationPathKey=JSON.stringify([profile.stage,e.board,e.className,e.stream]);
 const needsEducationReview=(reviewRequested||!!savedProfile&&educationReviewRequired(savedProfile,profile))&&reviewedEducationKey!==educationPathKey;
 const subjectIssues=profile.stage==='senior'?seniorSubjectIssues(e):[];
 if(subjectIssues.length)errors.subjects=subjectIssues.join(' ');
 const requiredError=errors[step as keyof typeof errors];
 const school=isSchool(profile.stage);
 useEffect(()=>{heading.current?.focus();},[step]);
 const titles:Record<StudyStep,string>={stage:'Where are you in your journey?',board:'Which education board do you follow?',className:'Which class are you in?',program:profile.stage==='undergraduate'?'Which degree are you pursuing?':profile.stage==='vocational'?'Which training program are you taking?':'Which postgraduate or research program?',discipline:profile.stage==='vocational'?'What is your trade or specialization?':'What is your discipline or branch?',stream:'Which stream or combination do you study?',subjects:'Which subjects are you studying?',period:'Which year or semester are you in?',interests:'What are you curious about?',goal:'What would you like to work towards?',weeklyHours:'How much time can you make each week?',bio:'Anything else you would like to share?',review:mode==='profile'?'Your profile, at a glance.':'Does this look like you?'};
 const optional=(optionalTime&&step==='weeklyHours')||['interests','goal','bio'].includes(step)||(step==='subjects'&&!school);
 const ready=step==='stage'?!!profile.stage:step==='interests'?profile.interests.every(value=>value.trim().length<=60):!requiredError;
 function update(key:Exclude<keyof Education,'subjects'>,value:string){const next=changeEducation(profile,key,value);if(educationReviewRequired(profile,next))setReviewRequested(true);onChange(next);}
 function advance(){if(busy)return;if(step==='review'){if(Object.keys(errors).length){setStep(Object.keys(errors)[0] as StudyStep);return;}if(needsEducationReview)return;onFinish(withEducation(profile,e));}else if(ready)setStep(path[index+1]||'review');}
 const summary:Array<{label:string;value:string;step:StudyStep}>=[
  {label:'Education stage',value:stages.find(s=>s.id===profile.stage)?.title||'',step:'stage'},
  ...(school?[{label:'Board',value:e.board,step:'board' as StudyStep},{label:'Class',value:e.className||profile.level,step:'className' as StudyStep},...(profile.stage==='senior'?[{label:'Stream',value:e.stream,step:'stream' as StudyStep}]:[])]:[{label:'Program',value:e.program,step:'program' as StudyStep},{label:'Discipline / trade',value:e.discipline,step:'discipline' as StudyStep}]),
  {label:'Subjects',value:e.subjects.join(', '),step:'subjects'},
  ...(!school?[{label:'Year / semester',value:e.period,step:'period' as StudyStep}]:[]),
  {label:'Interests',value:profile.interests.filter(Boolean).join(', '),step:'interests'},
  {label:'Current goal',value:profile.goal,step:'goal'},
  {label:'Weekly time',value:`${profile.weeklyHours} hours`,step:'weeklyHours'},
  {label:'About you',value:profile.bio,step:'bio'},
 ];
 return <form data-guide-id="profile-questions" className={`study-form ${step==='review'?'study-review':''}`} aria-busy={busy} onSubmit={event=>{event.preventDefault();advance();}}><fieldset className="study-fields" disabled={busy}>
  <div className="study-progress"><span>{step==='review'?'READY WHEN YOU ARE':index===0?'YOUR JOURNEY':index<path.indexOf('interests')?'YOUR STUDIES':'YOUR DIRECTION'}</span><span>{step==='review'?'Review':`${index+1} of ${path.length-1}`}</span></div>
  <progress className="question-progress" value={index+1} max={path.length} aria-label="Profile questions completed"/>
  <div className="question-heading"><h2 ref={heading} tabIndex={-1}>{titles[step]}</h2><p>{step==='review'?'Edit any answer before saving. You can change your profile anytime.':step==='stage'?'Start with your current education stage. We’ll take it one question at a time.':optional?'Optional. You can leave this blank and come back later.':'Choose the answer that fits your studies.'}</p></div>
  {needsEducationReview&&<div className="inline-note" role="status"><p>Your board, class or stream changed. Your subject selections are kept. Review your subjects, textbooks and academic session, and check whether your current goal and saved tasks still apply. Chapter lists and resources will follow your new details after saving.</p><button type="button" className="text-button" onClick={()=>setStep('subjects')}>Review subjects</button>{step==='review'&&<label className="subject-option"><input type="checkbox" checked={false} onChange={()=>setReviewedEducationKey(educationPathKey)}/><span>I’ve reviewed my selections and want to keep these details.</span></label>}</div>}
  <div className="question-body question-transition" key={step}>
   {step==='stage'&&<div className="education-stages" role="group" aria-label="Education stage">{stages.map(stage=><button type="button" key={stage.id} className={`education-stage ${profile.stage===stage.id?'selected':''}`} aria-pressed={profile.stage===stage.id} onClick={()=>{const next=changeStage(profile,stage.id);if(educationReviewRequired(profile,next))setReviewRequested(true);onChange(next);}}><span><strong>{stage.title}</strong><small>{stage.description}</small></span><span className="stage-check" aria-hidden="true">{profile.stage===stage.id&&<Check size={17}/>}</span></button>)}</div>}
   {step==='board'&&<SearchChoice label="Education board" value={e.board} options={boards} onChange={value=>update('board',value)}/>}
   {step==='className'&&<label className="field"><span>Current class</span><select value={e.className} onChange={event=>update('className',event.target.value)}><option value="">Choose a class</option>{classChoices(profile.stage).map(value=><option key={value}>{value}</option>)}</select></label>}
   {step==='program'&&<SearchChoice label={profile.stage==='undergraduate'?'Degree':'Program'} value={e.program} options={programChoices(profile.stage)} onChange={value=>update('program',value)}/>}
   {step==='discipline'&&<SearchChoice label={profile.stage==='vocational'?'Trade / specialization':'Discipline / branch'} value={e.discipline} options={disciplineChoices(profile.stage,e.program)} onChange={value=>update('discipline',value)}/>}
   {step==='stream'&&<SearchChoice label="Stream / combination" value={e.stream} options={streams} onChange={value=>update('stream',value)}/>}
   {step==='subjects'&&<SubjectPicker profile={profile} onChange={onChange} signedIn={canSave}/>}
   {step==='period'&&<><SearchChoice label="Current year or semester" value={e.period} maxLength={100} options={periodChoices(profile.stage,e.program)} onChange={value=>update('period',value)}/><p className="field-hint">Program structures vary. Use your institution’s year, semester, phase or internship label.</p></>}
   {step==='interests'&&<label className="field"><span>Your interests, separated by commas</span><input value={profile.interests.join(',')} maxLength={900} onChange={event=>onChange({...profile,interests:event.target.value.split(',').slice(0,15)})} placeholder="What do you enjoy learning or doing?"/><span className="field-hint">Up to 15 interests, 60 characters each.</span></label>}
   {step==='goal'&&<label className="field"><span>Your current goal</span><textarea rows={4} maxLength={500} value={profile.goal} onChange={event=>onChange({...profile,goal:event.target.value})} placeholder="A small step is a good place to start."/></label>}
   {step==='weeklyHours'&&<label className="field"><span>Hours per week</span><input type="number" required min={0} max={60} step={0.5} value={profile.weeklyHours} onChange={event=>onChange({...profile,weeklyHours:Number(event.target.value)})}/><span className="field-hint">An estimate is enough. There’s no minimum.</span></label>}
   {step==='bio'&&<label className="field"><span>Anything else about you</span><textarea rows={4} maxLength={1000} value={profile.bio} onChange={event=>onChange({...profile,bio:event.target.value})} placeholder="Only share what you are comfortable with."/></label>}
   {step==='review'&&<><dl className="profile-summary">{summary.map(item=><div key={item.step}><div><dt>{item.label}</dt><dd>{item.value||'Not added yet'}</dd></div><button type="button" className="summary-edit" aria-label={`Edit ${item.label.toLowerCase()}`} onClick={()=>setStep(item.step)}><Pencil size={15}/><span>Edit</span></button></div>)}</dl>{Object.keys(errors).length>0&&<p className="inline-note">A few education details still need your input. Your previously saved information is kept until you save.</p>}</>}
  </div>
  {step==='interests'&&!ready&&<p className="field-hint">Keep each interest to 60 characters or fewer.</p>}
  {step!=='review'&&requiredError&&<p className="field-hint">{requiredError}</p>}
  <div className="question-actions">
   <div>{index>0&&step!=='review'&&<button className="text-button" type="button" onClick={()=>setStep(path[index-1])}><ArrowLeft size={16}/>Back</button>}{mode==='profile'&&step!=='review'&&<button type="button" className="text-button" onClick={()=>setStep('review')}>Review answers</button>}</div>
   <button className="primary" disabled={busy||!ready||(step==='review'&&((needsEducationReview&&!Object.keys(errors).length)||(mode==='profile'&&!canSave)))}>{busy?'Saving…':step==='review'?Object.keys(errors).length?'Complete education details':finishLabel|| (mode==='profile'?'Save profile':canSave?'Save and open my space':'Create my account'):optional?'Continue / skip':'Continue'}{!busy&&step!=='review'&&<ArrowRight size={16}/>}</button>
  </div>
  {step==='review'&&mode==='profile'&&!canSave&&<p className="field-hint">Sign in to save your profile.</p>}
  {onExplore&&<button type="button" className="text-button explore-link" onClick={onExplore}>Explore VIKAS first</button>}
 </fieldset></form>;
}
