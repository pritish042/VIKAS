import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Profile } from './types';
import {youtubeLanguages,type YoutubeDifficulty,type YoutubeLanguage,type YoutubePathway} from './youtube-contract';
export {youtubeLanguages,youtubePathways} from './youtube-contract';
export type {YoutubeDifficulty,YoutubeLanguage,YoutubePathway} from './youtube-contract';

const plainText = (max: number) => z.string().trim().min(1).max(max).refine(value => !/[\u0000-\u001f<>]/.test(value), 'Use plain text only.');
export const youtubeSearchSchema = z.object({
  subject: plainText(100),
  topic: plainText(120),
  language: z.enum(youtubeLanguages),
  difficulty: z.enum(['foundation','core','advanced']),
  availableMinutes: z.number().int().min(5).max(180),
}).strict();
export type YoutubeSearchInput = z.infer<typeof youtubeSearchSchema>;
export const youtubeFeedbackSchema = z.object({feedback:z.enum(['too_easy','about_right','too_difficult','not_useful'])}).strict();
export const youtubeConsentSchema = z.object({accepted:z.boolean()}).strict();
export const youtubeReviewSchema = z.discriminatedUnion('action',[
  z.object({action:z.literal('approve')}).strict(),
  z.object({action:z.literal('reject')}).strict(),
  z.object({action:z.literal('inactive')}).strict(),
  z.object({action:z.literal('edit'),subject:plainText(100),topic:plainText(120),difficulty:z.enum(['foundation','core','advanced'])}).strict(),
]);

export type YoutubeStudyContext = YoutubeSearchInput & {
  pathway: YoutubePathway;
  classOrYear: string;
  board: string;
  branchOrTrade: string;
  program: string;
};

export class YoutubeError extends Error {
  constructor(public readonly status: number, public readonly code: 'missing_key' | 'invalid_key' | 'quota_exhausted' | 'timed_out' | 'network_error' | 'provider_error', message: string) {
    super(message);
  }
}

export function studyContext(profile: Profile, input: YoutubeSearchInput): YoutubeStudyContext {
  const education = profile.education;
  if (!education) throw new YoutubeError(400, 'provider_error', 'Complete your education details and selected subjects before searching for videos.');

  let pathway: YoutubePathway;
  let classOrYear = '';
  let branchOrTrade = '';
  let program = '';
  if (profile.stage === 'senior') {
    const classMatch = /^(?:class\s+)?(11|12)$/i.exec(education.className.trim());
    if (!classMatch) throw new YoutubeError(400, 'provider_error', 'YouTube discovery is available for Class 11–12 students.');
    if(!education.board.trim()||['other','not sure'].includes(education.board.trim().toLowerCase())) throw new YoutubeError(400,'provider_error','Choose your education board before searching for videos.');
    const stream = education.stream.toLowerCase();
    const combination=stream.replace(/[^a-z]/g,'');
    pathway = stream.includes('science')||['pcm','pcb','pcmb','physicschemistrymathematics','physicschemistrybiology','physicschemistrymathematicsbiology','physicschemistrybiologymathematics'].includes(combination) ? 'class-11-12-science'
      : stream.includes('commerce') ? 'class-11-12-commerce'
      : stream.includes('arts') || stream.includes('humanities') ? 'class-11-12-arts-humanities'
      : (() => { throw new YoutubeError(400, 'provider_error', 'Choose Science, Commerce or Arts/Humanities as your Class 11–12 stream.'); })();
    classOrYear = `Class ${classMatch[1]}`;
  } else if (profile.stage === 'vocational') {
    program = education.program;
    const normalizedProgram = program.toLowerCase();
    if (/\biti\b|industrial\s+training/.test(normalizedProgram)) pathway = 'iti';
    else if (/\bdiploma\b|polytechnic/.test(normalizedProgram)) pathway = 'diploma';
    else throw new YoutubeError(400, 'provider_error', 'Set your education program to Diploma/Polytechnic or ITI before searching.');
    if (!education.discipline.trim() || !education.period.trim()) throw new YoutubeError(400, 'provider_error', 'Add your branch or trade and year/semester to your profile first.');
    classOrYear = education.period;
    branchOrTrade = education.discipline;
  } else {
    throw new YoutubeError(400, 'provider_error', 'Video discovery supports Class 11–12, Diploma and ITI pathways.');
  }

  const actualSubjects = education.subjects.map(value => value.trim()).filter(Boolean);
  const allowedSubjects = actualSubjects.length ? actualSubjects : pathway === 'diploma' || pathway === 'iti' ? [branchOrTrade] : [];
  const subject = allowedSubjects.find(value => value.toLocaleLowerCase() === input.subject.toLocaleLowerCase());
  if (!subject) throw new YoutubeError(400, 'provider_error', 'Choose a subject listed in your profile. No subjects are inferred from your stream or program.');

  return {...input, subject, pathway, classOrYear, board: profile.stage === 'senior' ? education.board : '', branchOrTrade, program};
}

export function buildYoutubeQuery(context: YoutubeStudyContext, includeStepByStepIntent = false): string {
  const pathLabel = context.pathway === 'diploma' ? `Diploma ${context.branchOrTrade} ${context.classOrYear}`
    : context.pathway === 'iti' ? `ITI ${context.branchOrTrade} ${context.classOrYear}`
    : `${context.classOrYear} ${context.pathway==='class-11-12-science'?'Science':context.pathway==='class-11-12-commerce'?'Commerce':'Arts/Humanities'} ${context.board}`;
  return `${pathLabel.slice(0,35)} ${context.subject.slice(0,40)} ${context.topic.slice(0,75)} ${context.language} ${includeStepByStepIntent?'step-by-step explanation':'lesson'} ${context.difficulty}`.replace(/\s+/g, ' ').trim().slice(0, 200);
}

export function youtubeLanguageCode(language: YoutubeLanguage): string {
  return ({English:'en',Hindi:'hi',Bengali:'bn',Gujarati:'gu',Kannada:'kn',Malayalam:'ml',Marathi:'mr',Punjabi:'pa',Tamil:'ta',Telugu:'te',Urdu:'ur'} as const)[language];
}

export function discoveryFingerprint(context: YoutubeStudyContext): string {
  const normalized = [context.pathway,context.subject,context.topic,context.difficulty,context.language,context.classOrYear,context.board,context.branchOrTrade]
    .map(value => value.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' '));
  return createHash('sha256').update(normalized.join('\u001f')).digest('hex');
}

export function durationSeconds(value: string): number | null {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
  if (!match) return null;
  const seconds = Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
  return seconds > 0 ? seconds : null;
}

const stopWords = new Set(['and','the','for','with','from','class','year','semester','topic','lesson','basics','basic','introduction','intro','chapter','part','unit','of','in','to','a','an']);
function meaningfulTerms(value: string): string[] {
  return value.toLocaleLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]{3,}/gu)?.filter(term => !stopWords.has(term)) || [];
}

export function isClearlyUnrelated(title: string, description: string, subject: string, topic: string): boolean {
  const searchable = ` ${`${title} ${description}`.toLocaleLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
  const topicTerms = meaningfulTerms(topic);
  const subjectTerms = meaningfulTerms(subject);
  const topicMatches = topicTerms.filter(term => searchable.includes(` ${term} `)).length;
  const subjectMatches = subjectTerms.filter(term => searchable.includes(` ${term} `)).length;
  return topicTerms.length ? topicMatches === 0 && subjectMatches === 0 : subjectMatches === 0;
}

const promotionalTitle = /\b(buy now|join our paid|enrol now|enroll now|admission open|course fees|download our app|sponsored video|promotional video)\b/i;
const instructionCues = /\b(lesson|lecture|tutorial|explained|class|chapter|concept|revision|solved|problems|how to|fundamentals|learn|teaching)\b/i;
export function isPromotional(title: string, description: string): boolean {
  return promotionalTitle.test(title) && !instructionCues.test(`${title} ${description.slice(0, 600)}`);
}

export function providerError(status: number, reason: string): YoutubeError {
  const normalized = reason.toLowerCase();
  if ((status === 400||status===403) && /keyinvalid|invalidcredentials|apikeynotvalid/.test(normalized)) return new YoutubeError(503, 'invalid_key', 'The YouTube API key is invalid. Check YOUTUBE_API_KEY in the server environment.');
  if ((status === 403 || status === 429) && /quotaexceeded|dailylimitexceeded|ratelimitexceeded|userratelimitexceeded/.test(normalized)) return new YoutubeError(503, 'quota_exhausted', 'YouTube API quota is exhausted. Discovery is paused until the quota resets.');
  return new YoutubeError(503, 'provider_error', 'YouTube could not complete this request. Please try again later.');
}

export function recommendationReason(context: YoutubeStudyContext, feedback?: string, assessment?: {revisit:number;uncertain:number}): string {
  const time = `Matches your ${context.pathway.startsWith('class-') ? context.classOrYear : `${context.program} ${context.classOrYear}`} ${context.subject} topic and fits your available ${context.availableMinutes} minutes.`;
  const evidence = assessment && (assessment.revisit || assessment.uncertain)
    ? ` Your recent VIKAS topic check marked ${assessment.revisit} concept${assessment.revisit===1?'':'s'} to revisit and ${assessment.uncertain} as not sure.`
    : '';
  if (feedback === 'too_difficult') return `VIKAS guidance: ${time} You previously found a similar video too difficult, so a foundation-level option is prioritized.${evidence}`;
  if (feedback === 'too_easy') return `VIKAS guidance: ${time} You previously found a similar video too easy, so a more advanced option is prioritized.${evidence}`;
  if (feedback === 'not_useful') return `VIKAS guidance: ${time} Your previous feedback is considered when ordering results.${evidence}`;
  return `VIKAS guidance: ${time}${evidence} This is a VIKAS recommendation reason, not YouTube metadata.`;
}
