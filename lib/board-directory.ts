import {z} from 'zod';
import type {Db} from 'mongodb';
import {stableId} from './catalogue-import';
import {resourceAudienceSchema} from './resource-eligibility';
const searchUrl=z.string().url().refine(value=>{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='www.youtube.com'&&u.pathname==='/results'&&!u.username&&!u.password&&!!u.searchParams.get('search_query')&&[...u.searchParams.keys()].every(k=>k==='search_query');},'Expected a YouTube search URL.');
export const boardDirectorySchema=z.object({board:z.enum(['CBSE','ISC']),classLevel:z.union([z.literal(11),z.literal(12)]),academicSession:z.string().refine(v=>v===''||/^\d{4}-\d{2}$/.test(v),'Use a session or leave unspecified.'),sourceFile:z.string().min(1),linkType:z.literal('youtube_search'),limitations:z.string().min(1),entries:z.array(z.object({id:z.string().regex(/^[a-f0-9]{24}$/),subject:z.string().min(1),title:z.string().min(1).max(500),url:searchUrl,sourcePage:z.number().int().positive()}).strict()).min(1).max(1000),rejectedLinks:z.array(z.object({label:z.string(),url:z.string(),y:z.number()}).strict())}).strict();
export function prepareBoardDirectory(input:unknown){
 const source=boardDirectorySchema.parse(input);
 const entries=[...new Map(source.entries.map(e=>[e.id,e])).values()];
 if(entries.some(e=>source.entries.some(other=>other.id===e.id&&(other.url!==e.url||other.subject!==e.subject))))throw new Error('Conflicting directory IDs.');
 return entries.map(e=>({
  _id:stableId(`board-directory:${source.board}:${source.classLevel}:${e.id}`),title:e.title,description:source.limitations,url:e.url,stage:'senior',stream:e.subject,minutes:0,
  audience:resourceAudienceSchema.parse({pathways:['senior'],classes:[`Class ${source.classLevel}`],boards:source.board==='ISC'?['ISC','ICSE','CISCE','CISCE / ICSE / ISC']:['CBSE'],streamIndependent:true,subjects:[e.subject==='English Core'?'English':e.subject]}),
  directory:{board:source.board,linkType:source.linkType,sourceFile:source.sourceFile,sourcePage:e.sourcePage,academicSession:source.academicSession,subject:e.subject,classLevel:source.classLevel},
 }));
}
export async function importBoardDirectory(db:Db,batch:ReturnType<typeof prepareBoardDirectory>){
 let inserted=0;
 for(const entry of batch){const now=new Date();const result=await db.collection('resources').updateOne({_id:entry._id},{$setOnInsert:{...entry,status:'published',active:true,publicationBasis:'operator_requested_no_review',audienceApprovedAt:now,createdAt:now}},{upsert:true});inserted+=result.upsertedCount;}
 return {resourcesInserted:inserted,resourcesExisting:batch.length-inserted};
}
