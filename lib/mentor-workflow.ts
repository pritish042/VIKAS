import {z} from 'zod';
import type {Db} from 'mongodb';
import {mentorRequest,studentContextSchema,prerequisiteResultSchema,retrievalSchema,mentorProposalSchema,topicKey,type MentorResponse} from './mentor-contract';
import {readStudentContext} from './mentor-context';
import {approvedTopics,mongoKnowledgeRetriever,MentorError} from './mentor-knowledge';
import {checkPrerequisites,proposeMentorStep} from './mentor-rules';
import {explainWithGemini} from './mentor-provider';

// Fixed server-owned tool sequence, not a model-dispatched agent loop. No write tool exists.
export async function runMentor(d:Db,userId:string,value:unknown,provider:{key?:string;model?:string;fetcher?:typeof fetch}={}){
 const input=mentorRequest.parse(value),started=Date.now();let calls=0;
 async function tool<I,O>(schema:z.ZodType<I>,output:z.ZodType<O>,args:unknown,fn:(input:I)=>Promise<unknown>):Promise<O>{
  if(++calls>4||Date.now()-started>12000)throw new MentorError(503,'DISHA took too long to read context. Please try again.');
  return output.parse(await fn(schema.parse(args)));
 }
 // Topic selection is server metadata lookup; the model cannot broaden it.
 const rawProfile=await d.collection('profiles').findOne({userId},{projection:{stage:1,'education.board':1},maxTimeMS:2000});
 const definitions=await approvedTopics(d,{stage:rawProfile?.stage||'',board:rawProfile?.education?.board||''},input.language);
 const normalized=input.message.toLocaleLowerCase();
 const definition=input.topicId?definitions.find(t=>t.topicId===input.topicId):definitions.find(t=>normalized.includes(t.title.toLocaleLowerCase())||normalized.includes(t.topicId.toLocaleLowerCase()));
 const topic=definition?{id:definition.topicId,title:definition.title}:null;
 const topicIds=definition?[definition.topicId,...definition.prerequisites.map(p=>p.topicId)]:input.topicId?[input.topicId]:[];
 let profile:Awaited<ReturnType<typeof readStudentContext>>['profile']=null;
 const context=await tool(z.object({topicIds:z.array(topicKey).max(7)}).strict(),studentContextSchema,{topicIds},async a=>{const r=await readStudentContext(d,userId,a.topicIds);profile=r.profile;return r.context;});
 const prerequisites=await tool(z.object({}).strict(),z.array(prerequisiteResultSchema).max(6),{},async()=>checkPrerequisites(definition?.prerequisites||[],context.evidence));
 const retrieval=await tool(z.object({topicIds:z.array(topicKey).max(7),query:z.string().max(2500),language:z.string().min(1).max(40)}).strict(),retrievalSchema,{topicIds,query:[input.message,definition?.title,...(definition?.prerequisites.map(p=>p.title)||[])].filter(Boolean).join(' ').slice(0,2500),language:input.language},async args=>mongoKnowledgeRetriever(d).retrieve(args,context,profile));
 const proposal=await tool(z.object({choice:z.enum(['consider','refresher','continue'])}).strict(),mentorProposalSchema,{choice:input.choice},async args=>proposeMentorStep(topic,prerequisites,context,args.choice));
 const remaining=Math.max(1,25000-(Date.now()-started));
 const generated=retrieval.passages.length?await explainWithGemini({message:input.message,topicId:topic?.id||input.topicId||'unknown',passages:retrieval.passages,evidence:context.evidence.slice(0,16)},{...provider,signal:AbortSignal.timeout(Math.min(15000,remaining))}):{status:'insufficient_knowledge' as const};
 const uncertainty=[...(!definition?['No approved prerequisite map matches this topic, stage, board and language. I cannot establish its prerequisites from the current knowledge base.']:[]),...(!retrieval.passages.length?['I do not have enough approved lesson text to explain this topic. Resource links are metadata, not retrieved lessons.']:[]),...(retrieval.notice?[retrieval.notice]:[]),...prerequisites.filter(p=>p.status==='not_checked').map(p=>`${p.title}: evidence is missing, uncertain or dated.`)];
 const answer=generated.status==='used'?generated.answer.sentences.map(s=>`${s.text} ${s.citations.map(id=>`[${retrieval.passages.findIndex(p=>p.id===id)+1}]`).join(' ')}`).join('\n\n'):retrieval.passages.length?'I could not generate an explanation right now. Here are relevant excerpts from approved sources:\n\n'+retrieval.passages.map((p,i)=>`${p.text.slice(0,800)} [${i+1}]`).join('\n\n'):'I do not have enough approved knowledge to explain this topic yet. You can try a topic check, use a reviewed resource if one is available, or continue independently.';
 if(definition&&!definition.prerequisites.length)uncertainty.push('This approved entry does not list prerequisites; that does not establish that none exist.');
 const mentor:MentorResponse={topic,prerequisites,evidence:context.evidence,uncertainty,passages:retrieval.passages,resources:retrieval.resources,providerStatus:generated.status,proposal,...(definition?.reviewedAt?{prerequisiteSource:{title:definition.title,url:definition.sourceUrl,version:definition.version,reviewedAt:definition.reviewedAt.toISOString()}}:{}),...(generated.status==='used'&&generated.answer.memorySuggestion?{memorySuggestion:generated.answer.memorySuggestion}:{})};
 return {answer,mentor,toolCalls:calls};
}
