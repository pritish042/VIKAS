'use client';
import {useEffect,useId,useState} from 'react';
import type {Profile} from '@/lib/types';
import {combinations,educationFor,subjectGroups,withEducation} from '@/lib/education';
import {seniorCombinationNames,seniorSelectionIssues,seniorSubjectHint,seniorSubjectIssues,seniorSuggestedSubjects} from '@/lib/senior-subjects';
import {educationCoverageKey,type SubjectCoverage} from '@/lib/subject-coverage-contract';

export function SubjectPicker({profile,onChange,signedIn}:{profile:Profile;onChange:(p:Profile)=>void;signedIn:boolean}) {
 const e=educationFor(profile),senior=profile.stage==='senior',id=useId();
 const [search,setSearch]=useState(''),[custom,setCustom]=useState(''),[error,setError]=useState('');
 const [coverage,setCoverage]=useState<SubjectCoverage|null>(null),[coverageState,setCoverageState]=useState('');
 useEffect(()=>{
  let cancelled=false;setCoverage(null);
  if(!signedIn)return;
  setCoverageState('Checking saved-subject coverage…');
  fetch('/api/resources?view=personalized',{cache:'no-store'}).then(async response=>{
   if(!response.ok)throw new Error('Coverage could not be checked.');
   const result=await response.json();if(cancelled)return;
   setCoverage(result.subjectCoverage||null);setCoverageState(result.profileIncomplete?'Complete and save your education details to check coverage.':'');
  }).catch(()=>{if(!cancelled)setCoverageState('Coverage is unavailable right now. No availability is assumed.');});
  return()=>{cancelled=true;};
 },[signedIn]);
 const checked=coverage?.educationKey===educationCoverageKey(profile)?coverage:null;
 const groups=subjectGroups(profile.stage,e),known=[...new Set(Object.values(groups).flat())];
 const suggested=senior?seniorSuggestedSubjects(e):known;
 const selected=e.subjects.filter(s=>!['Other','Not sure'].includes(s));
 const recommended=suggested.filter(s=>!selected.includes(s));
 const seen=new Set([...selected,...suggested]);
 const other:Record<string,string[]>=Object.fromEntries(Object.entries(groups).map(([name,values]):[string,string[]]=>[name,values.filter(s=>{if(seen.has(s))return false;seen.add(s);return true;})]).filter(([,values])=>values.length));
 const allGroups={'Your selected subjects':selected,...(senior?{'Suggested for your stream':recommended}:groups),...other,'Other options':['Other','Not sure']};
 const currentIssues=senior?seniorSubjectIssues(e):[];
 function select(values:string[]){
  const unique=values.filter((v,i)=>values.findIndex(s=>s.toLowerCase()===v.toLowerCase())===i);
  if(unique.length>40){setError('You can select up to 40 subjects.');return false;}
  const introduced=senior?seniorSelectionIssues(e,unique):[];
  if(introduced.length){setError(introduced.join(' '));return false;}
  setError('');onChange(withEducation(profile,{...e,subjects:unique}));return true;
 }
 function toggle(value:string){select(e.subjects.includes(value)?e.subjects.filter(s=>s!==value):value==='Not sure'?['Not sure']:[...e.subjects.filter(s=>s!=='Not sure'),value]);}
 function addCustom(){const value=custom.trim();if(!value)return;if(select(value==='Not sure'?['Not sure']:[...e.subjects.filter(s=>s!=='Not sure'),value]))setCustom('');}
 function coverageLabel(subject:string){
  const row=checked?.subjects.find(s=>s.subject===subject);
  if(!row)return e.subjects.includes(subject)?'Coverage not checked for these details':'';
  return `${row.resources?'Resources available':'No resources found'} · ${row.searchLinks?'YouTube search links available':'No search links found'} · ${row.assessments?'Topic checks available (unvalidated)':'No topic checks found'}`;
 }
 function renderGroups(values:Record<string,string[]>,filter=''){
  return Object.entries(values).map(([group,options])=>{
   const matches=[...new Set(options)].filter(option=>option.toLowerCase().includes(filter.toLowerCase()));
   return matches.length?<fieldset key={group}><legend>{group}</legend><div className="checkbox-grid">{matches.map(option=>{
    const hint=senior?seniorSubjectHint(e.board,option):'',coverageText=coverageLabel(option);
    return <label key={option} className={`subject-option ${e.subjects.includes(option)?'selected':''}`}><input type="checkbox" checked={e.subjects.includes(option)} disabled={e.subjects.length>=40&&!e.subjects.includes(option)&&option!=='Not sure'} onChange={()=>toggle(option)}/><span>{option}{hint&&<small className="subject-detail">{hint}</small>}{!['Other','Not sure'].includes(option)&&coverageText&&<small className="subject-detail">{coverageText}</small>}</span></label>;
   })}</div></fieldset>:null;
  });
 }
 return <div className="subject-picker">
  <p className="field-hint">Select subjects from your actual timetable. Suggestions prioritise your board and stream; other electives and custom subjects remain available.</p>
  {senior&&<p className="field-hint">Classes 11 and 12 share subject names. Chapters and recommendations match your saved class, board, session and subjects separately.</p>}
  <p className="field-hint">Choosing a subject does not promise learning coverage. Availability is checked for your saved selections; YouTube search links are not reviewed lessons, and topic checks are unvalidated.{!signedIn?' Sign in and save your profile to check coverage.':!checked?' Save changes and reopen this picker to check their coverage.':''}</p>
  {coverageState&&<p className="field-hint" role="status">{coverageState}</p>}
  {senior&&seniorCombinationNames(e).length>0&&<div className="subject-presets"><span>Add a science combination:</span>{seniorCombinationNames(e).map(name=><button className="small-button" type="button" key={name} onClick={()=>select([...e.subjects.filter(s=>s!=='Not sure'),...combinations[name]])}>Add {name}</button>)}<p className="field-hint">Adds subjects without removing existing choices. Then choose your English course, languages and electives.</p></div>}
  <label className="field" htmlFor={id}><span>Find a subject across all suggestions</span><input id={id} type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search subjects"/></label>
  <p className="selection-count" role="status">{e.subjects.length} selected{search?' · Searching all suggestions':''}</p>
  {error&&<p className="inline-note" role="alert">{error}</p>}
  {currentIssues.length>0&&<div className="inline-note" role="alert">{currentIssues.map(issue=><p key={issue}>{issue}</p>)}</div>}
  <div className="subject-groups" role="region" aria-label="Available subjects" tabIndex={0}>
   {search?renderGroups(allGroups,search):<>{renderGroups({'Your selected subjects':senior?selected:selected.filter(s=>!known.includes(s))})}{senior?<>{renderGroups({'Suggested for your stream':recommended})}<details className="subject-more"><summary>Other electives and languages</summary>{renderGroups(other)}</details></>:renderGroups(groups)}{renderGroups({'Other options':['Other','Not sure']})}</>}
  </div>
  {!Object.values(allGroups).flat().some(option=>option.toLowerCase().includes(search.toLowerCase()))&&<p className="field-hint">No matching suggestions. Add your subject below.</p>}
  <div className="custom-subject"><label htmlFor={`${id}-custom`}>Another subject or elective</label><div><input id={`${id}-custom`} value={custom} maxLength={100} onChange={event=>setCustom(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();addCustom();}}} placeholder="Use the name from your timetable"/><button type="button" className="secondary" onClick={addCustom} disabled={!custom.trim()||e.subjects.length>=40}>Add</button></div></div>
 </div>;
}
