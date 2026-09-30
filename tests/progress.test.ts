import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ObjectId} from 'mongodb';
import {feedbackSchema,proposalDecisionSchema,taskSchema,profileSchema} from '../lib/validation';
import {goalRef,ownedTaskQuery,proposeStep,resolveProposal} from '../lib/progress';

const source={title:'Read a chapter',minutes:20};
const goal='Understand biology';
test('completed and easy proposes a slightly longer step without approving it',()=>{
 const p=proposeStep(source,goal,{outcome:'completed',feeling:'easy',reflection:'I finished the reading'});
 assert.equal(p.minutes>source.minutes,true);assert.equal(p.status,'pending');assert.match(p.explanation,/I finished the reading/);
});
test('completed and about right keeps the same size',()=>{
 const p=proposeStep(source,goal,{outcome:'completed',feeling:'about_right',reflection:''});assert.equal(p.minutes,20);
});
test('completed and difficult proposes a smaller step without judging the student',()=>{
 const p=proposeStep(source,goal,{outcome:'completed',feeling:'difficult',reflection:''});assert.equal(p.minutes<source.minutes,true);assert.match(p.explanation,/not a judgment/);
});
test('need help proposes a prerequisite and a DISHA option',()=>{
 const p=proposeStep(source,goal,{outcome:'need_help',feeling:'difficult',reflection:''});assert.match(p.title,/prerequisite/);assert.match(p.explanation,/DISHA/);
});
test('no longer relevant asks the student to reconsider step or goal',()=>{
 const p=proposeStep(source,goal,{outcome:'irrelevant',feeling:'about_right',reflection:''});assert.match(p.explanation,/change this step or edit your goal/);assert.equal(p.status,'pending');
});
test('feedback and decisions reject ownership injection and unbounded text',()=>{
 assert.equal(feedbackSchema.safeParse({outcome:'completed',feeling:'easy',reflection:'',userId:'other'}).success,false);
 assert.equal(feedbackSchema.safeParse({outcome:'completed',feeling:'easy',reflection:'x'.repeat(501)}).success,false);
 assert.equal(feedbackSchema.safeParse({outcome:'missed',feeling:'weak',reflection:''}).success,false);
 assert.equal(proposalDecisionSchema.safeParse({decision:'edit',title:'',notes:'',minutes:5}).success,false);
 assert.equal(proposalDecisionSchema.safeParse({decision:'accept',userId:'other'}).success,false);
});
test('accept, edit and reject remain distinct student decisions',()=>{
 const p={title:'Read a chapter',notes:'',minutes:20};
 assert.deepEqual(resolveProposal(p,{decision:'accept'},'new-task'),{status:'accepted',acceptedStep:{taskRef:'new-task',...p}});
 assert.deepEqual(resolveProposal(p,{decision:'edit',title:'Read two pages',notes:'Start here',minutes:10},'edited-task'),{status:'accepted',acceptedStep:{taskRef:'edited-task',title:'Read two pages',notes:'Start here',minutes:10}});
 assert.deepEqual(resolveProposal(p,{decision:'reject'},'unused'),{status:'rejected'});
});
test('task ownership filter binds both verified user and task identity',()=>{
 const id=new ObjectId();const userA=ownedTaskQuery('student-a',id);const userB=ownedTaskQuery('student-b',id);
 assert.notDeepEqual(userA,userB);assert.deepEqual(userA,{userId:'student-a',_id:id});
 assert.equal(userA.userId==='student-b',false);
 assert.notEqual(goalRef('student-a',goal),goalRef('student-b',goal));
});
test('two users cannot select or mutate one another’s tasks through the scoped query',()=>{
 const a={_id:new ObjectId(),userId:'student-a',title:'A private step'};
 const b={_id:new ObjectId(),userId:'student-b',title:'B private step'};
 const records=[a,b];
 const find=(query:ReturnType<typeof ownedTaskQuery>)=>records.find(item=>item.userId===query.userId&&item._id.equals(query._id));
 assert.equal(find(ownedTaskQuery('student-a',a._id)),a);
 assert.equal(find(ownedTaskQuery('student-b',a._id)),undefined);
 assert.equal(find(ownedTaskQuery('student-a',b._id)),undefined);
 assert.equal(find(ownedTaskQuery('student-b',b._id)),b);
});
test('existing tasks and profiles remain valid without feedback or a goal reference',()=>{
 assert.equal(taskSchema.safeParse({title:'Existing step',notes:'',minutes:25}).success,true);
 assert.equal(profileSchema.safeParse({stage:'school',level:'Class 9',stream:'',interests:[],goal:'Existing goal',weeklyHours:3,bio:'',onboardingComplete:true}).success,true);
});
