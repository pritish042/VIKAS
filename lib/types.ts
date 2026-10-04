export type Stage = 'school' | 'senior' | 'vocational' | 'undergraduate' | 'postgraduate';
export interface Education { board: string; className: string; program: string; discipline: string; stream: string; subjects: string[]; period: string }
export interface Profile { education?: Education; stage: Stage | ''; level: string; stream: string; interests: string[]; goal: string; weeklyHours: number; bio: string; onboardingComplete: boolean }
export const emptyProfile: Profile = { stage: '', level: '', stream: '', interests: [], goal: '', weeklyHours: 3, bio: '', onboardingComplete: false };
export type StepOutcome = 'completed' | 'need_help' | 'irrelevant';
export type StepFeeling = 'easy' | 'about_right' | 'difficult';
export interface StepFeedback {
 taskRef: string; goalRef: string; goalTitle: string; outcome: StepOutcome; feeling: StepFeeling;
 reflection: string; createdAt: string; updatedAt: string;
 proposal: { title: string; notes: string; minutes: number; explanation: string; status: 'pending' | 'accepted' | 'rejected'; acceptedStep?: { taskRef: string; title: string; notes: string; minutes: number }; updatedAt: string };
}
export interface Task { _id: string; title: string; notes: string; minutes: number; status: 'todo' | 'done' | 'needs_help' | 'irrelevant'; goalRef?: string; goalTitle?: string; feedback?: StepFeedback; createdAt: string; resourceRef?:string; resourceUrl?:string; topicAttemptRef?:string; youtubeVideoRef?:string; youtubeVideoId?:string; youtubeVideoUrl?:string }
export interface RecordItem { _id: string; type: 'skill' | 'project' | 'certification' | 'achievement'; title: string; description: string; url: string; createdAt: string }
export interface Resource { _id: string; title: string; description: string; url: string; stage: Stage | 'all'; stream: string; minutes: number; status: 'pending' | 'published'; owned?: boolean }
export interface ChatMessage { _id: string; role: 'user' | 'assistant'; content: string }
export const stages: {id: Stage; title: string; description: string; short: string}[] = [
 {id:'school',title:'Class 8–10',description:'Explore subjects and discover what you enjoy.',short:'School'},
 {id:'senior',title:'Class 11–12',description:'Explore your stream and your next steps.',short:'Senior secondary'},
 {id:'vocational',title:'Diploma / ITI / Polytechnic',description:'Develop practical skills in your field.',short:'Vocational'},
 {id:'undergraduate',title:'Undergraduate',description:'Find your direction. Learn and build.',short:'Undergraduate'},
 {id:'postgraduate',title:'Postgraduate & beyond',description:'Deepen your knowledge and explore opportunities.',short:'Postgraduate'},
];
export function stageLabel(p: Profile) { return (p.education ? [p.education.className||p.education.program,p.education.period,p.education.stream||p.education.discipline] : [p.level,p.stream]).filter(Boolean).join(' · ') || stages.find(s=>s.id===p.stage)?.short || 'Choose your stage'; }
