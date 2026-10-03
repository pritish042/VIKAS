import {createHash} from 'node:crypto';
import {z} from 'zod';
import type {Profile} from './types';
import {key,normalizeSubject,resourceEligible} from './resource-eligibility';
const text=(max:number)=>z.string().trim().min(1).max(max);
const texts=z.array(text(500)).max(100);
const date=text(40).refine(v=>/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v.slice(0,10),'Use a valid date or UTC timestamp.');
const https=text(1500).refine(v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}},'Use a safe HTTPS URL.');
export function youtubeId(url:string){try{const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)return null;const host=u.hostname.toLowerCase();const id=host==='youtu.be'?u.pathname.slice(1):['youtube.com','www.youtube.com','m.youtube.com'].includes(host)?u.pathname==='/watch'?u.searchParams.get('v'):u.pathname.match(/^\/(shorts|embed)\/([\w-]{11})$/)?.[2]:null;return id&&/^[\w-]{11}$/.test(id)?id:null;}catch{return null;}}
export const chapterSchema=z.object({chapterId:text(100).regex(/^[A-Za-z0-9_-]+$/),board:z.literal('CBSE'),classLevel:z.literal(8),academicSession:text(20).regex(/^\d{4}-\d{2}$/),examinationYear:z.number().int().min(2000).max(2100).nullable(),curriculumVersion:text(150),subjectId:text(100),officialSubjectName:z.enum(['Mathematics','Science','Social Science','English']),subjectVariant:text(150).nullable(),textbookTitle:text(150),textbookEdition:text(100),chapterOrder:z.number().int().min(1).max(100),chapterTitle:text(200),requiredSubtopics:texts,officialSourceUrl:https,theme:text(200).optional(),unitOrder:z.number().int().min(1).max(100).optional(),unitTitle:text(200).optional(),coverageStatus:z.enum(['partial_unverified','unresolved','partial_verified','complete_verified','unverified','partial','no_suitable_candidate_found']),unresolvedNotes:z.string().max(2000)}).strict();
export const mappingSchema=z.object({chapterId:text(100),sequencePosition:z.number().int().min(1).max(1000),learningRole:z.enum(['explanation','worked_example','practice','revision','optional_deeper','primary_explanation','primary_explanation_part_1','primary_explanation_part_2','additional_explanation']),coveredSubtopics:texts,missingSubtopics:texts,mappingEvidence:text(2000)}).strict();
export const videoSchema=z.object({resourceId:text(100),youtubeId:text(11).regex(/^[\w-]{11}$/),canonicalUrl:https,title:text(300),channelName:text(150).nullable(),channelUrl:https.nullable().refine(v=>v===null||['youtube.com','www.youtube.com'].includes(new URL(v).hostname),'Use a YouTube channel URL.'),durationMinutes:z.number().positive().max(1440).nullable(),instructionalLanguage:text(80),fetchedAt:date,reviewDepth:z.enum(['metadata_only','content_inspected','human_reviewed']),reviewLimitations:text(2000),publicationStatus:z.literal('pending'),chapterMappings:z.array(mappingSchema).min(1).max(100)}).strict().refine(v=>youtubeId(v.canonicalUrl)===v.youtubeId,'YouTube URL and ID must agree.');
export type Chapter=z.infer<typeof chapterSchema>;
export type ChapterMapping=z.infer<typeof mappingSchema>&{version:string;chapter:Chapter};
export type VideoSource=z.infer<typeof videoSchema>;
export const chapterHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function prepareChapterCatalogue(input:unknown){
 const root=z.object({schemaVersion:z.literal('1.0').optional(),catalogue:z.object({board:z.literal('CBSE'),classLevel:z.literal(8),academicSession:text(20),subject:z.enum(['Mathematics','Science','Social Science','English']),textbookTitle:text(150),textbookEdition:text(100),chapterCount:z.number().int().min(1).max(100)}).passthrough().optional(),chapters:z.array(chapterSchema).min(1).max(100),videos:z.array(z.unknown()).max(300)}).strict().parse(input);
 if(new Set(root.chapters.map(c=>c.chapterId)).size!==root.chapters.length||new Set(root.chapters.map(c=>c.chapterOrder)).size!==root.chapters.length)throw new Error('Chapter IDs and orders must be unique.');
 const chapters=[...root.chapters].sort((a,b)=>a.chapterOrder-b.chapterOrder);
 if(chapters.some((c,i)=>c.chapterOrder!==i+1))throw new Error('Chapter order has gaps. Supply the ordered chapter checklist.');
 if(new Set(chapters.map(c=>`${c.academicSession}|${c.curriculumVersion}|${c.textbookEdition}`)).size!==1)throw new Error('Conflicting curriculum sessions or editions.');
 if(new Set(chapters.map(c=>c.officialSubjectName)).size!==1)throw new Error('A catalogue must contain one subject.');
 if(root.catalogue&&(root.catalogue.chapterCount!==chapters.length||chapters.some(c=>c.board!==root.catalogue!.board||c.classLevel!==root.catalogue!.classLevel||c.academicSession!==root.catalogue!.academicSession||c.officialSubjectName!==root.catalogue!.subject||c.textbookTitle!==root.catalogue!.textbookTitle||c.textbookEdition!==root.catalogue!.textbookEdition)))throw new Error('Catalogue metadata and chapters must agree.');
 const videos=new Map<string,{source:VideoSource;sources:VideoSource[];mappings:ChapterMapping[]}>(),rejected:{index:number;reason:string}[]=[];let duplicates=0;
 root.videos.forEach((raw,index)=>{const parsed=videoSchema.safeParse(raw);if(!parsed.success){rejected.push({index,reason:parsed.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')});return;}
  const source=parsed.data;const mappings:ChapterMapping[]=[];
  for(const m of source.chapterMappings){const chapter=chapters.find(c=>c.chapterId===m.chapterId);if(!chapter){rejected.push({index,reason:'Mapping references a chapter outside this checklist.'});return;}const definition={...m,chapter};mappings.push({...definition,version:chapterHash(definition)});}
  const old=videos.get(source.youtubeId);if(old){duplicates++;old.sources.push(source);for(const m of mappings)if(!old.mappings.some(x=>x.version===m.version))old.mappings.push(m);}else videos.set(source.youtubeId,{source,sources:[source],mappings});
 });
 const entries=[...videos.values()];
 return {catalogue:root.catalogue,chapters,entries,report:{chaptersFound:chapters.length,videosFound:root.videos.length,validVideos:root.videos.length-rejected.length,uniqueVideos:entries.length,duplicateVideos:duplicates,rejected,unresolvedChapters:chapters.filter(c=>c.coverageStatus!=='complete_verified'||!c.requiredSubtopics.length||!!c.unresolvedNotes).map(c=>({chapterId:c.chapterId,title:c.chapterTitle,notes:c.unresolvedNotes,checklistMissing:!c.requiredSubtopics.length})),unresolvedVideos:entries.filter(e=>e.source.instructionalLanguage==='unverified'||e.source.durationMinutes===null||e.source.reviewDepth==='metadata_only'||!e.source.channelUrl).map(e=>e.source.youtubeId),coverage:'Supplied checklist only; completeness and curriculum source applicability require human verification.'}};
}
export const chapterAudience=(chapters:Chapter[])=>({pathways:['school'],classes:[...new Set(chapters.map(c=>`Class ${c.classLevel}`))],boards:[...new Set(chapters.map(c=>c.board))],subjects:[...new Set(chapters.map(c=>c.officialSubjectName))],topicIds:chapters.map(c=>c.chapterId)});
export function chapterMatchesProfile(chapter:Chapter,profile:Partial<Profile>|null){
 if(!resourceEligible({status:'published',active:true,audienceReviewedAt:new Date(),audience:chapterAudience([chapter])},profile))return false;
 const e=profile?.education;if(e?.academicSession&&key(e.academicSession)!==key(chapter.academicSession))return false;
 const book=e?.textbooks?.find(b=>normalizeSubject(b.subject)===normalizeSubject(chapter.officialSubjectName));
 if(book?.edition&&key(book.edition)!==key(chapter.textbookEdition))return false;
 // Part I and II of the same explicitly selected title are allowed; unrelated titles are not.
 const title=(s:string)=>key(s).replace(/\s+part\s+(i|ii|1|2)$/,'');
 return !book?.title||title(book.title)===title(chapter.textbookTitle);
}
