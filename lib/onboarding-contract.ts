import {z} from 'zod';
import {educationFor,isSchool} from './education';
import type {Profile} from './types';

export const onboardingSteps=['stage','board','className','program','discipline','stream','subjects','period','interests','goal','weeklyHours','bio','review'] as const;
export type OnboardingStep=typeof onboardingSteps[number];
export function studyStepsFor(p:Profile):OnboardingStep[]{
 return ['stage',...(isSchool(p.stage)?['board','className',...(p.stage==='senior'?['stream']:[]),'subjects']:['program','discipline','subjects','period']),'interests','goal','weeklyHours','bio','review'] as OnboardingStep[];
}
// Reject recognizable secrets before sending or rendering a conversational entry.
export function containsCredential(value:string){return /\b(?:password|passwd|passcode|otp|reset[ _-]?token|api[ _-]?key)\b|secret\s*[:=]|\b\d{4,8}\b|Bearer\s+\S+|eyJ[\w-]+\.[\w-]+|(?:token|code)=|mongodb(?:\+srv)?:\/\/|[A-Za-z0-9_-]{32,}/i.test(value);}
const safeText=z.string().trim().max(150).refine(v=>!containsCredential(v),'Use the secure account forms for credentials.');
export const onboardingHelpSchema=z.object({step:z.enum(onboardingSteps),message:z.string().trim().min(1).max(1000).refine(v=>!containsCredential(v),'Use the secure account forms for credentials.'),context:z.object({stage:safeText.optional(),board:safeText.optional(),className:safeText.optional(),program:safeText.optional(),discipline:safeText.optional(),stream:safeText.optional()}).strict()}).strict();
export type OnboardingHelp=z.infer<typeof onboardingHelpSchema>;
export function onboardingContext(step:OnboardingStep,p:Profile):OnboardingHelp['context']{
 const e=educationFor(p);const context:OnboardingHelp['context']={};
 if(step!=='stage')context.stage=p.stage;
 if(['className','stream','subjects'].includes(step)){context.board=e.board;context.className=e.className;}
 if(step==='subjects')context.stream=e.stream;
 if(['discipline','subjects','period'].includes(step)){context.program=e.program;context.discipline=e.discipline;}
 return context;
}
export function boundedOnboardingHelp(input:OnboardingHelp):OnboardingHelp{
 const allowed:Record<string,string[]>={stage:[],board:['stage'],className:['stage','board','className'],stream:['stage','board','className'],subjects:['stage','board','className','stream','program','discipline'],discipline:['stage','program','discipline'],period:['stage','program','discipline']};
 const keys=allowed[input.step]||['stage'];
 return {...input,context:Object.fromEntries(Object.entries(input.context).filter(([key])=>keys.includes(key)))};
}
export function mergeOnboardingDraft(saved:Profile,draft:Profile,touched:Set<string>):Profile{
 return {...saved,stage:draft.stage,level:draft.level,stream:draft.stream,education:draft.education?{...saved.education,...draft.education}:draft.education,...Object.fromEntries(['interests','goal','weeklyHours','bio'].filter(k=>touched.has(k)).map(k=>[k,draft[k as keyof Profile]]))};
}
export function sessionDraftAction(owner:string|null,nextUser:string|null,hasDraft:boolean){
 if(owner&&nextUser&&owner!==nextUser)return 'clear' as const;
 if(owner&&!nextUser&&hasDraft)return 'await_auth' as const;
 return 'keep' as const;
}
