import type {Education} from './types';
import {normalizeBoard} from './education-board';

const languages=['Hindi','Sanskrit','Urdu','Bengali','Tamil','Telugu','Marathi','Gujarati','Kannada','Malayalam','Odia','Punjabi','Assamese','French','German','Other language'];
const science=['Physics','Chemistry','Biology','Mathematics','Applied Mathematics'];
const humanities=['History','Geography','Political Science','Psychology','Sociology','Economics'];
const normalize=(s:string)=>s.toLowerCase().trim().replace(/\s+/g,' ');
export function seniorStream(value:string):'science'|'commerce'|'humanities'|'other' {
 const stream=normalize(value);
 return /\bscience\b|\bpcm\b|\bpcb\b|\bpcmb\b/.test(stream)?'science':/\bcommerce\b/.test(stream)?'commerce':/\barts\b|\bhumanities\b/.test(stream)?'humanities':'other';
}
export function seniorSubjectGroups(e:Education):Record<string,string[]> {
 const board=normalizeBoard(e.board);
 return {
  English:board==='isc'?['English','Modern English','Elective English']:board==='cbse'?['English Core','English Elective']:['English'],
  'Science & mathematics':science,
  Commerce:board==='isc'?['Accountancy','Commerce','Business Studies','Economics','Entrepreneurship']:['Accountancy','Business Studies','Economics','Entrepreneurship'],
  Humanities:humanities,
  'Common electives':board==='isc'?['Computer Science','Physical Education','Art','Music','Home Science','Environmental Science','Legal Studies','Biotechnology','Artificial Intelligence','Robotics','Engineering Science','Geometrical & Mechanical Drawing','Geometrical & Building Drawing']:['Computer Science','Informatics Practices','Physical Education','Fine Arts','Music','Home Science','Legal Studies','Biotechnology','Vocational subject'],
  'Other languages':languages,
 };
}
export function seniorSuggestedSubjects(e:Education):string[] {
 const groups=seniorSubjectGroups(e),stream=seniorStream(e.stream);
 const core=stream==='science'?(/\bpcmb\b/i.test(e.stream)?['Physics','Chemistry','Mathematics','Biology']:/\bpcb\b/i.test(e.stream)?['Physics','Chemistry','Biology']:['Physics','Chemistry','Mathematics','Biology']):stream==='commerce'?groups.Commerce:stream==='humanities'?humanities:[];
 const maths=stream==='commerce'||stream==='humanities'?['Applied Mathematics','Mathematics']:[];
 return [...new Set([...groups.English,...core,...maths,'Computer Science','Physical Education'])];
}
export function seniorCombinationNames(e:Education):string[] {
 return seniorStream(e.stream)==='science'?['PCM','PCB','PCMB']:[];
}
// Picker checks only. Stored profiles and the existing flexible profile API stay compatible.
export function seniorSubjectIssues(e:Education):string[] {
 const board=normalizeBoard(e.board),selected=new Set(e.subjects.map(normalize)),issues:string[]=[];
 const has=(s:string)=>selected.has(normalize(s));
 const pairs: [string,string][] = board==='isc'?[
  ['Mathematics','Applied Mathematics'],['English','Modern English'],['Physics','Engineering Science'],['Robotics','Artificial Intelligence'],['Geometrical & Mechanical Drawing','Geometrical & Building Drawing'],
 ]:board==='cbse'?[
  ['Mathematics','Applied Mathematics'],['English Core','English Elective'],['Computer Science','Informatics Practices'],
 ]:[];
 for(const [a,b] of pairs)if(has(a)&&has(b))issues.push(`${e.board}: choose either ${a} or ${b}, not both. Remove the one you do not study.`);
 if(['cbse','isc'].includes(board)){
  const junior=e.subjects.filter(s=>['mathematics (basic)','mathematics (standard)','science','social science','social studies','history & civics'].includes(normalize(s)));
  if(junior.length)issues.push(`Review these Class 8–10 names: ${junior.join(', ')}. Select your separate senior subjects from your timetable.`);
 }
 if(board==='isc'&&(has('English')||has('Modern English'))&&(has('English Language')||has('English Literature')||has('Literature in English')))issues.push('English and Modern English each include a language paper and a literature paper. Select the whole subject or list its papers, without duplicating them.');
 if(board==='cbse'&&has('English')&&(has('English Core')||has('English Elective')))issues.push('English is your general saved name. Choose your registered English Core or English Elective option, or keep English alone.');
 return issues;
}
export function seniorSelectionIssues(e:Education,subjects:string[]):string[] {
 // Removal must remain possible even when several retained choices need correction.
 if(subjects.every(s=>e.subjects.includes(s)))return [];
 const existing=seniorSubjectIssues(e);
 return seniorSubjectIssues({...e,subjects}).filter(issue=>!existing.includes(issue));
}
export function seniorSubjectHint(boardName:string,subject:string):string {
 const board=normalizeBoard(boardName);
 if(board==='isc'&&['English','Modern English'].includes(subject))return 'Includes English Language (Paper 1) and Literature in English (Paper 2). Choose your registered course.';
 if(board==='isc'&&['English Language','English Literature','Literature in English'].includes(subject))return 'A paper within English, not an additional whole subject. Existing paper selections are kept for review.';
 if(board==='cbse'&&['English Core','English Elective'].includes(subject))return 'Alternative English courses; choose the one registered by your school.';
 if(board==='isc'&&subject==='Commerce')return 'ISC 2027: Commerce (857), distinct from Business Studies (859). ISC 2028 calls subject 857 Business Studies; confirm your registered name.';
 if(board==='isc'&&subject==='Business Studies')return 'Check your examination year: ISC 2027 uses code 859; ISC 2028 uses code 857. VIKAS keeps your saved names separate.';
 if(subject==='Mathematics'||subject==='Applied Mathematics')return 'Different courses. For CBSE and ISC, choose one; confirm school and university requirements.';
 return '';
}
