import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyProfile, type Profile, type Stage} from '../lib/types';
import {changeEducation,changeStage,educationFor,emptyEducation,normalizeProfile,withEducation,educationErrors,disciplineChoices,periodChoices,subjectGroups} from '../lib/education';
import {profileSchema} from '../lib/validation';
import {profileUpdate} from '../lib/profile-update';

function school(stage:Stage='school'):Profile {
 return withEducation({...emptyProfile,stage}, {...emptyEducation,board:'CBSE',className:stage==='school'?'Class 9':'Class 11',stream:stage==='senior'?'Science — PCM':'',subjects:['English','Mathematics','Science']});
}
function degree():Profile {
 return withEducation({...emptyProfile,stage:'undergraduate'}, {...emptyEducation,program:'B.Tech / B.E.',discipline:'Computer Science',period:'Year 4',subjects:['Mathematics']});
}

test('Class 8–10 accepts actual subjects without forcing a stream',()=>{
 const p=school();assert.equal(profileSchema.safeParse(p).success,true);
 assert.deepEqual(educationErrors(p.stage,educationFor(p)),{});
 assert.equal(profileSchema.safeParse({...p,education:{...p.education!,stream:'Science'}}).success,false);
});
test('senior school accepts custom combinations and separate subjects',()=>{
 const p=withEducation(school('senior'),{...educationFor(school('senior')),stream:'Custom combination',subjects:['Physics','Economics','Mathematics','English']});
 assert.equal(profileSchema.safeParse(p).success,true);
});
test('board changes preserve class and explicit subject selections',()=>{
 const p=changeEducation(school(),'board','CISCE / ICSE / ISC');
 assert.equal(p.education?.className,'Class 9');
 assert.deepEqual(p.education?.subjects,['English','Mathematics','Science']);
 const science=subjectGroups(p.stage,educationFor(p)).Science;
 assert.deepEqual(science,['Physics','Chemistry','Biology','Science']);
});
test('changing school stage clears the incompatible class and keeps board and subjects',()=>{
 const p=changeStage(school(),'senior');
 assert.equal(p.education?.className,'');assert.equal(p.level,'');
 assert.equal(p.education?.board,'CBSE');assert.deepEqual(p.education?.subjects,['English','Mathematics','Science']);
});
test('changing from school to a degree clears school-only fields',()=>{
 const p=changeStage(school(),'undergraduate');assert.deepEqual(p.education,emptyEducation);assert.equal(p.stream,'');assert.equal(p.level,'');
});
test('reselecting a stage or program preserves the entire answer',()=>{
 const p=degree();assert.equal(changeStage(p,'undergraduate'),p);assert.equal(changeEducation(p,'program','B.Tech / B.E.'),p);
});
test('changing program retains shared disciplines and valid periods',()=>{
 const p=changeEducation(degree(),'program','B.Sc.');assert.equal(p.education?.discipline,'Computer Science');assert.equal(p.education?.period,'Year 4');assert.deepEqual(p.education?.subjects,['Mathematics']);
});
test('changing program clears incompatible disciplines and periods',()=>{
 const p=changeEducation(degree(),'program','LL.B.');assert.equal(p.education?.discipline,'');assert.equal(p.education?.period,'');assert.deepEqual(p.education?.subjects,[]);
});
test('programs offer relevant branches and bounded year/semester suggestions',()=>{
 assert.ok(disciplineChoices('vocational','ITI').includes('Electrician'));
 assert.ok(!disciplineChoices('vocational','ITI').includes('Political Science'));
 assert.ok(periodChoices('vocational','ITI').includes('Semester 4'));
 assert.ok(!periodChoices('vocational','ITI').includes('Semester 8'));
 assert.ok(disciplineChoices('postgraduate','MBA / PGDM').includes('Finance'));
});
test('each education stage can be saved with complete relevant fields',()=>{
 for(const [stage,program,discipline,period] of [['undergraduate','B.Tech / B.E.','Civil Engineering','Semester 8'],['vocational','ITI','Electrician','Year 2'],['postgraduate','M.Sc.','Physics','Semester 4']] as const){
  const p=withEducation({...emptyProfile,stage},{...emptyEducation,program,discipline,period});assert.equal(profileSchema.safeParse(p).success,true);
 }
});
test('custom and uncertain answers are allowed without inventing subjects',()=>{
 const p=withEducation(school(),{...emptyEducation,board:'My regional board',className:'Other',subjects:['Other','Local language studies']});
 assert.equal(profileSchema.safeParse(p).success,true);
 assert.equal(profileSchema.safeParse(withEducation(school(),{...educationFor(school()),subjects:['Not sure']})).success,true);
 assert.equal(profileSchema.safeParse(withEducation(school(),{...educationFor(school()),subjects:['Not sure','English']})).success,false);
});
test('structured education rejects mismatches, duplicate subjects, unknown fields and out-of-range periods',()=>{
 const p=school();
 assert.equal(profileSchema.safeParse({...p,stage:'senior'}).success,false);
 assert.equal(profileSchema.safeParse({...p,education:{...p.education!,subjects:['English','English']}}).success,false);
 assert.equal(profileSchema.safeParse({...p,education:{...p.education!,userId:'override'}}).success,false);
 assert.equal(profileSchema.safeParse({...p,userId:'override'}).success,false);
 assert.equal(profileSchema.safeParse(withEducation(degree(),{...educationFor(degree()),period:'Semester 14'})).success,false);
});
test('legacy profiles remain valid and normalize without guessing missing details',()=>{
 const legacy={...emptyProfile,stage:'school' as const,level:'Class 10',stream:'',goal:'Read regularly'};
 assert.equal(profileSchema.safeParse(legacy).success,true);
 const p=normalizeProfile(legacy);assert.equal(p.education?.className,'Class 10');assert.equal(p.education?.board,'');assert.deepEqual(p.education?.subjects,[]);assert.equal(p.goal,legacy.goal);
 const unknown=normalizeProfile({...legacy,level:'Custom year'});assert.equal(unknown.level,'Custom year');assert.equal(unknown.education?.className,'');
});
test('structured education round trips and profile update treats values as literals',()=>{
 const p=withEducation(school(),{...educationFor(school()),subjects:['English','Science','Robotics elective']});
 const parsed=profileSchema.parse(JSON.parse(JSON.stringify(p)));
 assert.deepEqual(normalizeProfile(parsed).education,p.education);
 const update=profileUpdate({...p,goal:'$userId'});
 assert.deepEqual(update[0].$set.goal,{$literal:'$userId'});
 assert.deepEqual(update[0].$set.education,{$literal:p.education});
});

test('uncertain school selections remain valid when changing school stages',()=>{
 const p=withEducation(school(),{...educationFor(school()),className:'Not sure',subjects:['Not sure']});
 const next=changeStage(p,'senior');assert.equal(next.education?.className,'Not sure');assert.deepEqual(next.education?.subjects,['Not sure']);
});
