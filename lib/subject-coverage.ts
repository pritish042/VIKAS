import type {Db} from 'mongodb';
import type {Profile} from './types';
import {educationCoverageKey,type SubjectCoverage} from './subject-coverage-contract';
import {key,normalizeSubject,resourceAudienceSchema,type AcademicResource} from './resource-eligibility';
import {listTopics} from './topic-service';

// Rows must already have passed the central saved-profile eligibility gate.
export async function subjectCoverage(d:Db,userId:string,profile:Profile,rows:AcademicResource[]):Promise<SubjectCoverage> {
 const topics=await listTopics(d,userId);
 return {educationKey:educationCoverageKey(profile),subjects:(profile.education?.subjects||[]).map(subject=>{
  const matches=rows.filter(r=>{
   if(r.directory?.board==='ISC'&&['English Language','English Literature'].includes(r.directory.subject||''))return key(subject)==='english'||key(subject)===key(r.directory.subject);
   const audience=resourceAudienceSchema.safeParse(r.audience);
   return audience.success&&audience.data.subjects.some(s=>normalizeSubject(s)===normalizeSubject(subject));
  });
  return {subject,resources:matches.some(r=>!r.directory),searchLinks:matches.some(r=>!!r.directory),assessments:topics.some(t=>!!t.assessmentId&&normalizeSubject(t.subject)===normalizeSubject(subject))};
 })};
}
