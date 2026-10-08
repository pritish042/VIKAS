import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Memory} from './helpers/memory-db';
import {saveMentorTurn,runMentor} from '../lib/mentor-workflow';
import {inferReplyLanguage} from '../lib/mentor-language';
import {mentorRequest} from '../lib/mentor-contract';
const outage={key:'never-log-secret',model:'test',fetcher:async()=>{throw new Error('Provider offline');}};
test('greetings and reviewed basics → answer → next bypass failed provider and preserve state',async()=>{
 const m=new Memory();let calls=0;const provider={...outage,fetcher:async()=>{calls++;throw new Error('offline');}};
 const hello=await saveMentorTurn(m.asDb(),'a',{message:'hello'},provider);assert.equal(hello.mentor.providerStatus,'local');assert.equal(hello.mentor.uncertainty.length,0);assert.doesNotMatch(hello.answer,/No approved|unavailable/);
 const first=await saveMentorTurn(m.asDb(),'a',{message:'Teach Python basics'},provider);assert.match(first.answer,/print\(2 \+ 3\)/);
 const yes=await saveMentorTurn(m.asDb(),'a',{message:'yes'},provider);assert.equal(yes.mentor.learning?.step,0);
 const answer=await saveMentorTurn(m.asDb(),'a',{message:'7'},provider);assert.equal(answer.mentor.learning?.pendingQuestion,'');
 const next=await saveMentorTurn(m.asDb(),'a',{message:'next'},provider);assert.equal(next.mentor.learning?.step,1);assert.match(next.answer,/score = 7/);assert.equal(calls,0);
});
test('retry is owned, leaves saved messages unchanged, and does not advance the saved lesson',async()=>{
 const m=new Memory();await saveMentorTurn(m.asDb(),'a',{message:'Teach Python basics'},outage);
 const failed=await saveMentorTurn(m.asDb(),'a',{message:'Explain this more'},outage);assert.equal(failed.mentor.retryable,true);const before=JSON.stringify(m.rows.get('messages'));
 const retry=await saveMentorTurn(m.asDb(),'a',{message:'Retry generation',retryRef:String(failed.id)},outage);assert.equal(retry.id.toString(),failed.id.toString());assert.equal(retry.mentor.learning?.step,0);assert.equal(JSON.stringify(m.rows.get('messages')),before);
 await m.collection('messages').updateOne({_id:failed.id},{$unset:{request:1}});const legacy=await saveMentorTurn(m.asDb(),'a',{message:'retry',retryRef:String(failed.id)},outage);assert.equal(legacy.mentor.learning?.step,0);assert.equal(m.rows.get('messages')!.length,4);
 await assert.rejects(()=>saveMentorTurn(m.asDb(),'b',{message:'retry',retryRef:String(failed.id)},outage));
});
test('language inference stays validated, uses short-followup preference, and does not invent translated sources',async()=>{
 assert.equal(mentorRequest.parse({message:'hello'}).language,'English');assert.equal(inferReplyLanguage('yes','Hindi'),'Hindi');assert.equal(inferReplyLanguage('Explain in Hindi'),'Hindi');assert.equal(inferReplyLanguage('Explain loops'),'English');
 const result=await runMentor(new Memory().asDb(),'a',{message:'Teach Python basics in Hindi'},outage);assert.equal(result.mentor.language,'Hindi');assert.equal(result.mentor.passages.length,1);assert.match(result.mentor.passages[0].sourceUrl,/docs.python.org/);assert.match(result.mentor.uncertainty.join(' '),/No translated source/);assert.match(result.answer,/print/);
});

test('Markdown is React text only, with list semantics, labelled code and Copy control',async()=>{
 const {createElement}=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');const {MentorMarkdown}=await import('../components/mentor-markdown');
 const html=renderToStaticMarkup(createElement(MentorMarkdown,{content:'<script>alert(1)</script>\n\n- one\n- two\n\n```python\nprint("hello")\n```'}));assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);assert.match(html,/<ul>/);assert.match(html,/Copy python example/);assert.match(html,/<pre><code>/);
});

test('workspace markup has a labelled multiline composer, collapsed context, no language field and route visibility',async()=>{
 const {createElement}=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');const {MentorWorkspace}=await import('../components/mentor-workspace');const {emptyProfile}=await import('../lib/types');
 const props={active:true,signedIn:false,profile:emptyProfile,messages:[],geminiConfigured:false,draft:'Unsent note',onDraft:()=>{},onReload:async()=>{},onProfile:()=>{},onSignIn:()=>{}};
 const html=renderToStaticMarkup(createElement(MentorWorkspace,props));assert.match(html,/textarea[^>]+aria-label="Message DISHA"/);assert.match(html,/Unsent note/);assert.match(html,/Learning context/);assert.match(html,/Conversation menu/);assert.doesNotMatch(html,/>Language</);assert.doesNotMatch(html,/Meet <em>/);assert.match(renderToStaticMarkup(createElement(MentorWorkspace,{...props,active:false})),/hidden=""/);
});
