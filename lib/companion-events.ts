import type {AppPage} from './navigation';

export type CompanionExpression = 'idle'|'greeting'|'curious'|'listening'|'thinking'|'speaking'|'encouraging'|'celebration'|'concerned';
type Response = {text:string; expression:CompanionExpression; priority:number; duration:number};
export const companionResponses = {
 'navigation:home': {text:'What would you like to work on today?',expression:'greeting',priority:0,duration:4800},
 'navigation:learn': {text:'Let’s discover something new today.',expression:'curious',priority:0,duration:4800},
 'navigation:labs': {text:'Ready to turn an idea into code?',expression:'curious',priority:0,duration:4800},
 'navigation:journey': {text:'Let’s look at your journey, one step at a time.',expression:'greeting',priority:0,duration:4800},
 'profile:opened': {text:'Your study details help me guide you.',expression:'listening',priority:0,duration:4800},
 'lesson:opened': {text:'Take your time. I’m here if you need help.',expression:'listening',priority:0,duration:4800},
 'quiz:started': {text:'You’ve got this. Take your time with each question.',expression:'encouraging',priority:1,duration:5000},
 'quiz:submitted': {text:'Your answers are in. Let’s review the feedback.',expression:'listening',priority:1,duration:5000},
 'progress:saved': {text:'Your changes are saved.',expression:'celebration',priority:1,duration:4500},
 'progress:save-failed': {text:'That didn’t go through. Check the message and try again when you’re ready.',expression:'concerned',priority:2,duration:6500},
 'action:failed': {text:'Something didn’t work. The page has details to help you try again.',expression:'concerned',priority:2,duration:6500},
 'chat:opened': {text:'I’m here. What would you like to explore?',expression:'greeting',priority:1,duration:4800},
 'auth:required': {text:'Sign in to keep your work connected to your account.',expression:'listening',priority:1,duration:5000},
} as const satisfies Record<string,Response>;
export type CompanionEventType = keyof typeof companionResponses;
// Never put student text, credentials, or server errors in companion metadata.
export type CompanionEvent = {type:CompanionEventType; metadata?:{source?:'profile'|'topic'|'lab'|'task'|'resource'}; targetY?:number};
export const COMPANION_EVENT='vikas:companion';
export function notifyCompanion(type:CompanionEventType,options:Omit<CompanionEvent,'type'>={}) {
 if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent<CompanionEvent>(COMPANION_EVENT,{detail:{type,...options}}));
}
export function navigationCompanionEvent(page:AppPage):CompanionEventType|undefined {
 return ({home:'navigation:home',explore:'navigation:learn',aprajita:'navigation:labs',plan:'navigation:journey',profile:'profile:opened',mentor:'chat:opened',login:'auth:required',signup:'auth:required'} as Partial<Record<AppPage,CompanionEventType>>)[page];
}
export type CompanionPolicy = {lastRoutine:number; seen:Partial<Record<CompanionEventType,number>>; active?:{priority:number;until:number}};
export function acceptCompanionEvent(state:CompanionPolicy,type:CompanionEventType,now:number):boolean {
 const response=companionResponses[type];
 if(state.seen[type]!==undefined&&now-state.seen[type]!<20000)return false;
 if(state.active&&state.active.until>now&&state.active.priority>response.priority)return false;
 if(response.priority===0&&now-state.lastRoutine<10000)return false;
 state.seen[type]=now;if(response.priority===0)state.lastRoutine=now;
 state.active={priority:response.priority,until:now+response.duration};return true;
}
export type VerticalObstacle={top:number;bottom:number};
export function companionPlacement(height:number,characterHeight:number,preferred:number,obstacles:VerticalObstacle[],top=88,bottom=24):number|null {
 const max=height-bottom-characterHeight;if(max<top)return null;
 const candidates=[Math.max(top,Math.min(max,preferred)),top,max,...obstacles.flatMap(o=>[o.top-characterHeight-16,o.bottom+16])];
 return candidates.filter(y=>y>=top&&y<=max&&!obstacles.some(o=>y<o.bottom+12&&y+characterHeight>o.top-12)).sort((a,b)=>Math.abs(a-preferred)-Math.abs(b-preferred))[0]??null;
}
