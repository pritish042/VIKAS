import {z} from 'zod';
import type {Db} from 'mongodb';
import {mentorRequest,studentContextSchema,prerequisiteResultSchema,retrievalSchema,mentorProposalSchema,topicKey,type MentorResponse} from './mentor-contract';
import {readStudentContext} from './mentor-context';
import {approvedTopics,mongoKnowledgeRetriever,MentorError} from './mentor-knowledge';
import {checkPrerequisites,proposeMentorStep} from './mentor-rules';
import {readConversation,resolveLearning,learningStateSchema} from './mentor-learning';
import {beginnerTopics,beginnerPassages} from './mentor-beginner-pack';
import {explainWithGemini,converseWithGemini,providerNotice} from './mentor-provider';

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
 const conversation=await readConversation(d,userId);
 const explicitDefinition=definitions.find(t=>input.message.toLowerCase().includes(t.title.toLowerCase())||input.message.toLowerCase().includes(t.topicId.toLowerCase()));
 const learning=resolveLearning(input.message,explicitDefinition?.topicId||input.topicId,conversation.state);
 const packDefinitions=beginnerTopics();
 const resolvedTopic=learning.state?.topicId;
 const normalized=input.message.toLocaleLowerCase();
 const definition=resolvedTopic?definitions.find(t=>t.topicId===resolvedTopic)||packDefinitions.find(t=>t.topicId===resolvedTopic):input.topicId?definitions.find(t=>t.topicId===input.topicId):definitions.find(t=>normalized.includes(t.title.toLocaleLowerCase())||normalized.includes(t.topicId.toLocaleLowerCase()));
 const topic=definition?{id:definition.topicId,title:definition.title}:learning.state?{id:learning.state.topicId,title:learning.state.title}:null;
 const topicIds=definition?[definition.topicId,...definition.prerequisites.map(p=>p.topicId)]:input.topicId?[input.topicId]:[];
 let profile:Awaited<ReturnType<typeof readStudentContext>>['profile']=null;
 const context=await tool(z.object({topicIds:z.array(topicKey).max(7)}).strict(),studentContextSchema,{topicIds},async a=>{const r=await readStudentContext(d,userId,a.topicIds);profile=r.profile;return r.context;});
 const prerequisites=await tool(z.object({}).strict(),z.array(prerequisiteResultSchema).max(6),{},async()=>checkPrerequisites(definition?.prerequisites||[],context.evidence));
 const retrieval=await tool(z.object({topicIds:z.array(topicKey).max(7),query:z.string().max(2500),language:z.string().min(1).max(40)}).strict(),retrievalSchema,{topicIds,query:[input.message,definition?.title,...(definition?.prerequisites.map(p=>p.title)||[])].filter(Boolean).join(' ').slice(0,2500),language:input.language},async args=>mongoKnowledgeRetriever(d).retrieve(args,context,profile));
 if(learning.pack){retrieval.passages=[...beginnerPassages(learning.pack,learning.state!.step),...retrieval.passages].slice(0,4);if(retrieval.notice)retrieval.notice='Knowledge search is temporarily unavailable; the bundled beginner pack remains available.';}
 const proposal=await tool(z.object({choice:z.enum(['consider','refresher','continue'])}).strict(),mentorProposalSchema,{choice:input.choice},async args=>proposeMentorStep(topic,prerequisites,context,args.choice));
 const remaining=Math.max(1,25000-(Date.now()-started));
 const boundedContext={...context,evidence:context.evidence.slice(0,10)};
 const options={...provider,signal:AbortSignal.timeout(Math.min(15000,remaining)),timeoutMs:Math.min(15000,remaining)};
 const learningInput={history:conversation.history,learning:learning.state,learningIntent:learning.intent};
 const generated=learning.intent==='clarify'?{status:'insufficient_knowledge' as const}:retrieval.passages.length?await explainWithGemini({message:learning.resolvedMessage||input.message,...learningInput,topicId:topic?.id||input.topicId||'unknown',language:input.language,passages:retrieval.passages,evidence:[],context:boundedContext},options):await converseWithGemini({message:learning.resolvedMessage||input.message,...learningInput,language:input.language,context:boundedContext},options);
 if(generated.status!=='used'&&generated.status!=='insufficient_knowledge')console.warn('DISHA provider failure',{category:generated.status});
 if(!retrieval.passages.length)console.warn('DISHA retrieval gap',{category:'no_approved_passages'});
 if(retrieval.notice)console.warn('DISHA retrieval gap',{category:'search_unavailable'});
 const uncertainty=[...(!definition?['No approved prerequisite map matches this topic, stage, board and language. I cannot establish its prerequisites from the current knowledge base.']:[]),...(!retrieval.passages.length?['No approved lesson passages were found for this question. General AI guidance can still explain it; resource metadata is not lesson text.']:[]),...(retrieval.notice?[retrieval.notice]:[]),...prerequisites.filter(p=>p.status==='not_checked').map(p=>`${p.title}: evidence is missing, uncertain or dated.`)];
 const notice=providerNotice(generated.status);
 let answer=generated.status==='used'?'sentences' in generated.answer?generated.answer.sentences.map(s=>`${s.text} ${s.citations.map(id=>`[${retrieval.passages.findIndex(p=>p.id===id)+1}]`).join(' ')}`).join('\n\n'):generated.answer.answer:retrieval.passages.length?`${notice}\n\nHere are relevant excerpts from approved sources:\n\n`+retrieval.passages.map((p,i)=>`${p.text.slice(0,800)} [${i+1}]`).join('\n\n'):`${notice}\n\nNo approved lesson passages were found for this question. The source library has no matching lesson text; retry AI or ask for C, C++ or Python basics from the beginner pack.`;
 let state=learning.state&&definition?{...learning.state,title:definition.title}:learning.state;
 if(learning.intent==='clarify')answer=learning.clarification!;
 else if(input.language.toLowerCase()==='english'&&learning.lesson)answer=learning.lesson;
 else if(learning.feedback)answer=learning.feedback;
 if(!state&&topic)state={topicId:topic.id,title:topic.title,step:conversation.state?.topicId===topic.id?conversation.state.step:0,pendingQuestion:''};
 if(state&&generated.status==='used'&&learning.intent==='conversation')state={...state,pendingQuestion:generated.answer.pendingQuestion??state.pendingQuestion};
 if(state)state=learningStateSchema.parse(state);
 const retryable=generated.status!=='used'&&generated.status!=='insufficient_knowledge';
 if(retryable&&(learning.lesson||learning.feedback))answer=`${answer}\n\n${notice} The reviewed practice above remains available.`;
 if(definition&&!definition.prerequisites.length)uncertainty.push('This approved entry does not list prerequisites; that does not establish that none exist.');
 const mentor:MentorResponse={topic,prerequisites,evidence:boundedContext.evidence,recentProgress:context.recentProgress,mode:retrieval.passages.length?'grounded':'conversation',uncertainty,passages:retrieval.passages,resources:retrieval.resources,providerStatus:generated.status,proposal,...(definition&&'reviewedAt' in definition&&definition.reviewedAt?{prerequisiteSource:{title:definition.title,url:definition.sourceUrl,version:definition.version,reviewedAt:definition.reviewedAt.toISOString()}}:{}),...(state?{learning:state}:{}),...(learning.pack==='c'||learning.pack==='python'||learning.pack==='c-cpp'&&state?.step===0?{labLanguage:learning.pack==='python'?'python' as const:'c' as const}:{}),sourceLabel:learning.intent==='clarify'?'Topic clarification':learning.pack?'Reviewed beginner pack':retrieval.passages.length?'Approved source passages':generated.status==='used'?'General AI guidance — no approved lesson passages':'AI reply unavailable',retryable};
 return {answer,mentor,toolCalls:calls,previousTurnAt:conversation.latestAt};
}

// The route obtains userId from Better Auth before calling this operation.
// Conversation storage is the only write performed by a mentor request.
export async function saveMentorTurn(d:Db,userId:string,value:unknown,provider:Parameters<typeof runMentor>[3]={}){
 const input=mentorRequest.parse(value);
 const result=await runMentor(d,userId,input,provider);
 const now=new Date(Math.max(Date.now(),result.previousTurnAt+2));
 await d.collection('messages').insertOne({userId,role:'user',content:input.message,createdAt:now});
 const saved=await d.collection('messages').insertOne({userId,role:'assistant',content:result.answer,mentor:result.mentor,toolCalls:result.toolCalls,createdAt:new Date(now.getTime()+1)});
 return {answer:result.answer,mentor:result.mentor,id:saved.insertedId};
}
