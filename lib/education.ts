import { emptyProfile, type Education, type Profile, type Stage } from './types';

export const emptyEducation: Education = { board:'', className:'', program:'', discipline:'', stream:'', subjects:[], period:'' };
export const uncertain = ['Other', 'Not sure'];
export const boards = ['CBSE', 'CISCE / ICSE / ISC', 'NIOS', 'Andhra Pradesh State Board', 'Assam State Board', 'Bihar State Board', 'Chhattisgarh State Board', 'Goa State Board', 'Gujarat State Board', 'Haryana State Board', 'Himachal Pradesh State Board', 'Jharkhand State Board', 'Karnataka State Board', 'Kerala State Board', 'Madhya Pradesh State Board', 'Maharashtra State Board', 'Odisha State Board', 'Punjab State Board', 'Rajasthan State Board', 'Tamil Nadu State Board', 'Telangana State Board', 'Uttar Pradesh State Board', 'Uttarakhand State Board', 'West Bengal State Board', 'State board (specify)', 'Cambridge / IGCSE', 'International Baccalaureate', ...uncertain];
// Suggestions, not admissions rules. Institutions may use different names and durations.
const engineering = ['Computer Science', 'Information Technology', 'Electronics & Communication', 'Electrical Engineering', 'Mechanical Engineering', 'Civil Engineering', 'Chemical Engineering', 'Biotechnology', 'Aerospace Engineering'];
const sciences = ['Physics', 'Chemistry', 'Mathematics', 'Computer Science', 'Statistics', 'Biology', 'Botany', 'Zoology', 'Environmental Science'];
const humanities = ['English', 'Hindi', 'History', 'Geography', 'Political Science', 'Economics', 'Psychology', 'Sociology', 'Philosophy'];
type Program = { disciplines:string[]; years:number };
export const programs: Record<'undergraduate'|'vocational'|'postgraduate', Record<string,Program>> = {
 undergraduate: {
  'B.Tech / B.E.':{disciplines:engineering,years:4}, 'B.Sc.':{disciplines:sciences,years:4},
  'B.A.':{disciplines:humanities,years:4}, 'B.Com.':{disciplines:['General Commerce','Accounting & Finance','Banking & Insurance','Taxation'],years:4},
  'BBA / BBM':{disciplines:['Business Administration','Finance','Marketing','Human Resources','International Business'],years:4},
  'BCA':{disciplines:['Computer Applications','Data Science','Cybersecurity'],years:4},
  'MBBS':{disciplines:['Medicine'],years:5}, 'BDS':{disciplines:['Dentistry'],years:5},
  'B.Sc. Nursing':{disciplines:['Nursing'],years:4}, 'B.Pharm.':{disciplines:['Pharmacy'],years:4},
  'B.Arch.':{disciplines:['Architecture'],years:5}, 'B.Des.':{disciplines:['Communication Design','Product Design','Fashion Design','Interaction Design'],years:4},
  'LL.B.':{disciplines:['Law'],years:3}, 'Integrated law (BA/BBA LL.B.)':{disciplines:['Law'],years:5},
  'B.Ed.':{disciplines:['Education'],years:2}, 'B.Sc. Agriculture':{disciplines:['Agriculture'],years:4},
 },
 vocational: {
  'Polytechnic diploma':{disciplines:engineering,years:3}, 'Diploma':{disciplines:[...engineering,'Hospitality','Design','Healthcare','Business'],years:3},
  'ITI':{disciplines:['Electrician','Fitter','Welder','Mechanic (Motor Vehicle)','Computer Operator & Programming Assistant','Draughtsman','Electronics Mechanic','Sewing Technology'],years:2},
  'D.Pharm.':{disciplines:['Pharmacy'],years:2}, 'Vocational certificate':{disciplines:['Retail','Hospitality','Healthcare','IT & IT-enabled Services','Automotive','Beauty & Wellness'],years:2},
 },
 postgraduate: {
  'M.Tech / M.E.':{disciplines:engineering,years:2}, 'M.Sc.':{disciplines:sciences,years:2}, 'M.A.':{disciplines:humanities,years:2},
  'M.Com.':{disciplines:['Commerce','Accounting & Finance','Taxation'],years:2}, 'MBA / PGDM':{disciplines:['General Management','Finance','Marketing','Human Resources','Operations','Business Analytics'],years:2},
  'MCA':{disciplines:['Computer Applications','Data Science','Cybersecurity'],years:2}, 'LL.M.':{disciplines:['Law','Constitutional Law','Corporate Law','International Law'],years:2},
  'M.Ed.':{disciplines:['Education'],years:2}, 'M.Des.':{disciplines:['Design','Interaction Design','Product Design'],years:2},
  'MD / MS':{disciplines:['Medicine','Surgery','Paediatrics','Other clinical specialty'],years:3},
  'Postgraduate diploma':{disciplines:['Management','Computing','Education','Healthcare'],years:2},
  'Ph.D. / Research':{disciplines:[...sciences,...humanities,...engineering],years:6},
 },
};
export const streams = ['Science — PCM', 'Science — PCB', 'Science — PCMB', 'Science — custom combination', 'Commerce', 'Humanities / Arts', 'Vocational', 'Custom combination', ...uncertain];
export const combinations: Record<string,string[]> = {'PCM':['Physics','Chemistry','Mathematics'], 'PCB':['Physics','Chemistry','Biology'], 'PCMB':['Physics','Chemistry','Mathematics','Biology']};
export function isSchool(stage:Profile['stage']) { return stage==='school'||stage==='senior'; }
export function classChoices(stage:Profile['stage']) { return stage==='school'?['Class 8','Class 9','Class 10',...uncertain]:['Class 11','Class 12',...uncertain]; }
export function programChoices(stage:Profile['stage']) { return [...Object.keys(programs[stage as keyof typeof programs]||{}),...uncertain]; }
export function disciplineChoices(stage:Profile['stage'], program:string) { return [...(programs[stage as keyof typeof programs]?.[program]?.disciplines||[]),...uncertain]; }
export function periodChoices(stage:Profile['stage'], program:string) {
 const years=programs[stage as keyof typeof programs]?.[program]?.years||6;
 return [...Array.from({length:years},(_,i)=>`Year ${i+1}`),...Array.from({length:years*2},(_,i)=>`Semester ${i+1}`),'Internship','Completed',...uncertain];
}
export function subjectGroups(stage:Profile['stage'], e:Education):Record<string,string[]> {
 const languages=['English','Hindi','Sanskrit','Urdu','Bengali','Tamil','Telugu','Marathi','Gujarati','Kannada','Malayalam','Odia','Punjabi','Assamese','French','German','Other language'];
 if(!isSchool(stage)) {
  const field=e.discipline.toLowerCase();
  const modules=/computer|information|data|cyber/.test(field)?['Programming','Data Structures','Databases','Computer Networks','Mathematics']:
   /finance|commerce|account|business|management|marketing/.test(field)?['Accounting','Economics','Business Statistics','Management','Business Law']:
   /medicine|nursing|dentistry|pharmacy|clinical|surgery/.test(field)?['Anatomy','Physiology','Biochemistry','Pharmacology','Clinical Practice']:
   /engineering|electrician|fitter|welder|mechanic/.test(field)?['Engineering Mathematics','Applied Physics','Workshop Practice','Technical Drawing','Trade Theory']:
   ['Research Methods','Statistics','Fieldwork','Practical / Laboratory','Dissertation / Project'];
  return {'Your field':e.discipline&&!uncertain.includes(e.discipline)?[e.discipline]:[], 'Subjects / modules':modules,'Languages & electives':['English','Hindi','Communication Skills','Environmental Studies','Other language']};
 }
 const separate=e.board==='CISCE / ICSE / ISC';
 const science=separate?['Physics','Chemistry','Biology','Science']:['Science','Physics','Chemistry','Biology'];
 return {
  Languages:languages,
  Mathematics:['Mathematics','Mathematics (Basic)','Mathematics (Standard)','Applied Mathematics'],
  Science:science,
  'Social studies':separate?['History & Civics','Geography','Social Studies','Social Science']:['Social Science','Social Studies','History','Civics','Geography','History & Civics'],
  'Computing & electives':['Computer Applications','Computer Science','Information Technology','Artificial Intelligence','Environmental Studies','Physical Education','Art','Music','Home Science','Vocational subject'],
  ...((stage==='senior'||!isSchool(stage))?{'Commerce & humanities':['Accountancy','Business Studies','Economics','Political Science','Psychology','Sociology','Entrepreneurship']}:{}),
 };
}
export function educationFor(p:Profile):Education {
 if(p.education)return {...emptyEducation,...p.education,subjects:[...p.education.subjects]};
 // Only copy information actually present in legacy records. Never infer a board or subjects.
 return {...emptyEducation,subjects:[],className:isSchool(p.stage)&&classChoices(p.stage).includes(p.level)?p.level:'',
  stream:p.stage==='senior'?p.stream:'',discipline:!isSchool(p.stage)?p.stream:'',period:!isSchool(p.stage)?p.level:''};
}
export function normalizeProfile(p:Partial<Profile>|null):Profile {
 const profile={...emptyProfile,...p};
 return {...profile,education:educationFor(profile)};
}
export function withEducation(p:Profile,e:Education):Profile {
 return {...p,education:e,level:isSchool(p.stage)?e.className:e.period,
  stream:p.stage==='senior'?e.stream:isSchool(p.stage)?'':e.discipline};
}
export function changeStage(p:Profile,stage:Stage):Profile {
 if(stage===p.stage)return p;
 const e=educationFor(p), schoolToSchool=isSchool(p.stage)&&isSchool(stage);
 return withEducation({...p,stage}, {...emptyEducation,subjects:[],...(schoolToSchool?{board:e.board,className:classChoices(stage).includes(e.className)?e.className:'',subjects:[...e.subjects]}:{})});
}
export function changeEducation(p:Profile,key:Exclude<keyof Education,'subjects'>,value:string):Profile {
 const e=educationFor(p);if(e[key]===value)return p;
 const next={...e,[key]:value};
 if(key==='program') {
  // Common branches and in-range periods remain valid; incompatible branches/years are cleared.
  if(!disciplineChoices(p.stage,value).includes(e.discipline))next.discipline='';
  if(!periodChoices(p.stage,value).includes(e.period))next.period='';
  if(next.discipline!==e.discipline)next.subjects=[];
 }
 // Board/class/stream changes retain explicitly selected subjects: custom combinations are allowed.
 return withEducation(p,next);
}
export function educationErrors(stage:Profile['stage'],e:Education):Partial<Record<keyof Education|'stage',string>> {
 const errors:Partial<Record<keyof Education|'stage',string>>={};
 if(!stage){errors.stage='Choose your education stage.';return errors;}
 if(isSchool(stage)) {
  if(!e.board.trim())errors.board='Choose your board, or select Not sure.';
  if(!classChoices(stage).includes(e.className))errors.className='Choose a class for your education stage.';
  if(stage==='senior'&&!e.stream.trim())errors.stream='Choose a stream or custom combination.';
  if(stage==='school'&&e.stream)errors.stream='Class 8–10 uses subjects, not a stream.';
  if(e.program||e.discipline||e.period)errors.program='School profiles cannot include degree or semester fields.';
 } else {
  if(!e.program.trim())errors.program='Choose your program, or select Not sure.';
  if(!e.discipline.trim())errors.discipline='Choose your branch or specialization.';
  if(!e.period.trim())errors.period='Choose your year or semester.';
  const standard=/^(Year|Semester) (\d+)$/.test(e.period);
  if(standard&&!periodChoices(stage,e.program).includes(e.period))errors.period='Choose a year or semester appropriate to your program.';
  if(e.board||e.className||e.stream)errors.board='This program cannot include school-only fields.';
 }
 if(isSchool(stage)&&!e.subjects.length)errors.subjects='Choose your subjects, or select Not sure.';
 if(e.subjects.includes('Not sure')&&e.subjects.length>1)errors.subjects='Remove Not sure when selecting subjects.';
 return errors;
}
