import type {Profile} from '../types';
import type {LabAccess} from './contract';
export const READINESS_VERSION='aprajita-basics-v1';
const key=(s:string)=>s.toLowerCase().trim().replace(/[._/-]/g,' ').replace(/\s+/g,' ');
export function computingSubject(subject:string){
 const s=key(subject);
 if(['cs','csc','cse','ca','it','ict','ai','ip'].includes(s.replace(/\s/g,'')))return true;
 return ['cs','csc','cse','ca','it','ict','ai','ip','information technology','information and communication technology','artificial intelligence','informatics practices','computer science','computer applications','computing','coding','programming'].includes(s)||/\b(computer science|computer applications?|information technology|artificial intelligence|informatics practices|computer programming|software programming|computing)\b/.test(s);
}
export function labEligibility(profile:Partial<Profile>|null):Omit<LabAccess,'ready'|'version'> {
 const no=(reason:string,needsProfile=false)=>({eligible:false,requiresAssessment:false,reason,needsProfile});
 if(!profile?.stage||!profile.education)return no('Add your education details in Profile to check APRAJITA access.',true);
 const e=profile.education;
 if(profile.stage==='undergraduate'){
  if(!e.program.trim()||['other','not sure'].includes(key(e.program)))return no('Choose your degree in Profile to check access.',true);
  const program=e.program.toLowerCase().replace(/[^a-z]/g,'');
  if(/^(btech|btechnology|bacheloroftechnology|be|bachelorofengineering)(btech|be)?$/.test(program))return {eligible:true,requiresAssessment:false,needsProfile:false,reason:'Available to B.Tech/B.E. students across all branches.'};
  return no('APRAJITA currently supports B.Tech/B.E. and Classes 8–12 with enrolled computing subjects.');
 }
 if(profile.stage!=='school'&&profile.stage!=='senior')return no('APRAJITA currently supports B.Tech/B.E. and Classes 8–12 with enrolled computing subjects.');
 const cls=/^(?:class\s*)?(8|9|10|11|12)$/i.exec(e.className.trim());
 if(!cls||!e.board.trim()||['other','not sure'].includes(key(e.board))||!e.subjects.length||e.subjects.every(s=>['other','not sure'].includes(key(s))))return no('Confirm your class, board and actual subjects in Profile.',true);
 if((profile.stage==='school'&&Number(cls[1])>10)||(profile.stage==='senior'&&Number(cls[1])<11))return no('Confirm your education stage and class in Profile.',true);
 if(!e.subjects.some(computingSubject))return no('School access requires an enrolled computing subject such as Computer Science, Computer Applications, IT or AI. Update Profile if your timetable includes one.',true);
 return {eligible:true,requiresAssessment:true,needsProfile:false,reason:'Complete the five-question computer-science check. Get at least 3 correct; retries are unlimited.'};
}
