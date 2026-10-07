import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBoard} from '../lib/education-board';
import {emptyEducation,subjectGroups,changeEducation,educationFor,educationReviewRequired,withEducation} from '../lib/education';
import {seniorCombinationNames,seniorSelectionIssues,seniorSubjectHint,seniorSubjectIssues,seniorSuggestedSubjects} from '../lib/senior-subjects';
import {emptyProfile} from '../lib/types';
import {profileSchema} from '../lib/validation';
import {resourceEligible} from '../lib/resource-eligibility';
import {matchesProfile} from '../lib/topic-rules';

const education=(board='CBSE',stream='Science — PCM')=>({...emptyEducation,board,stream,className:'Class 11',subjects:['English','Physics']});
test('senior suggestions prioritise distinct streams and leave cross-stream electives available',()=>{
 const science=seniorSuggestedSubjects(education());
 const commerce=seniorSuggestedSubjects(education('CBSE','Commerce'));
 const arts=seniorSuggestedSubjects(education('CBSE','Arts'));
 assert.ok(science.includes('Physics'));assert.ok(!science.includes('Accountancy'));
 assert.ok(commerce.includes('Accountancy'));assert.ok(!commerce.includes('Physics'));
 assert.ok(arts.includes('History'));assert.ok(!arts.includes('Physics'));assert.ok(!arts.includes('Accountancy'));
 assert.ok(seniorSuggestedSubjects(education('CBSE','Science — PCB')).includes('Biology'));
 assert.ok(!seniorSuggestedSubjects(education('CBSE','Science — PCB')).includes('Mathematics'));
 assert.ok(Object.values(subjectGroups('senior',education('CBSE','Commerce'))).flat().includes('Physics'));
});
test('senior pools exclude combined junior subjects but school pools retain them',()=>{
 for(const board of ['CBSE','ISC','Other board']){
  const senior=Object.values(subjectGroups('senior',education(board))).flat();
  for(const subject of ['Mathematics (Basic)','Mathematics (Standard)','Science','Social Science','Social Studies','History & Civics'])assert.ok(!senior.includes(subject));
 }
 const school=Object.values(subjectGroups('school',education())).flat();
 assert.ok(school.includes('Science'));assert.ok(school.includes('Social Science'));assert.ok(school.includes('Mathematics (Basic)'));
});
test('board aliases share picker, resource and assessment recognition without guessing unknown boards',()=>{
 const p=withEducation({...emptyProfile,stage:'senior'},education('ISC'));
 const r={status:'published',active:true,audienceReviewedAt:new Date(),audience:{pathways:['senior'],classes:['Class 11'],boards:['CISCE / ICSE / ISC'],streamIndependent:true,subjects:['Physics']}};
 const applicability={stage:'senior' as const,classes:['Class 11'],boards:['ISC'],subjects:['Physics']};
 for(const board of ['ISC','isc',' ICSE ','CISCE','CISCE/ICSE/ISC','CISCE / ICSE / ISC','Council for the Indian School Certificate Examinations']){
  assert.equal(normalizeBoard(board),'isc');
  const e=education(board);assert.deepEqual(subjectGroups('senior',e),subjectGroups('senior',education('ISC')));
  assert.equal(resourceEligible(r,withEducation(p,e)),true);assert.equal(matchesProfile(withEducation(p,e),applicability),true);
 }
 assert.equal(resourceEligible(r,withEducation(p,education('My ISC-inspired board'))),false);
 assert.equal(normalizeBoard('Central Board of Secondary Education'),'cbse');
});
test('ISC Commerce stays distinct and English paper relationships are explained',()=>{
 const e=education('ISC','Commerce'),groups=subjectGroups('senior',e);
 assert.ok(groups.Commerce.includes('Commerce'));assert.ok(groups.Commerce.includes('Business Studies'));
 assert.ok(!groups.English.includes('English Language'));assert.ok(!groups.English.includes('English Literature'));
 assert.match(seniorSubjectHint('ISC','English'),/Paper 1.*Paper 2/);
 assert.match(seniorSubjectHint('ISC','Commerce'),/2027.*2028/);
 assert.ok(seniorSubjectIssues({...e,subjects:['English','English Language']}).length);
 assert.deepEqual(seniorSubjectIssues({...e,subjects:['English Language','English Literature']}),[]);
});
test('science presets never appear for Commerce, Arts or unspecified streams',()=>{
 for(const stream of ['Science — PCM','Science — PCB','Science — PCMB','Science — custom combination','PCM','PCB'])assert.deepEqual(seniorCombinationNames(education('ISC',stream)),['PCM','PCB','PCMB']);
 for(const stream of ['Commerce','Arts','Humanities / Arts','Custom combination','Not sure','Vocational'])assert.deepEqual(seniorCombinationNames(education('ISC',stream)),[]);
});
test('picker blocks known board combinations including typed subjects while letting retained conflicts be removed',()=>{
 for(const board of ['CBSE','ISC','CISCE']){
  const e={...education(board),subjects:['Mathematics']};
  assert.ok(seniorSelectionIssues(e,['Mathematics',' applied mathematics ']).length);
  assert.deepEqual(seniorSelectionIssues(e,['Mathematics','Local elective']),[]);
 }
 for(const [board,a,b] of [['ISC','English','Modern English'],['ISC','Physics','Engineering Science'],['ISC','Robotics','Artificial Intelligence'],['CBSE','English Core','English Elective'],['CBSE','Computer Science','Informatics Practices']])assert.ok(seniorSubjectIssues({...education(board),subjects:[a,b]}).length);
 const legacy={...education('ISC'),subjects:['Science','Social Science','Mathematics','Applied Mathematics']};
 assert.deepEqual(seniorSelectionIssues(legacy,['Social Science','Mathematics','Applied Mathematics']),[]);
 assert.deepEqual(seniorSelectionIssues(legacy,[]),[]);
 assert.deepEqual(seniorSubjectIssues({...education('My board'),subjects:['Mathematics','Applied Mathematics']}),[]);
 // The server API retains the existing custom-profile contract.
 assert.equal(profileSchema.safeParse(withEducation({...emptyProfile,stage:'senior'},{...education('ISC'),subjects:['Mathematics','Applied Mathematics']})).success,true);
});
test('pathway changes retain selected subjects and require review; class matching remains exact',()=>{
 const original=withEducation({...emptyProfile,stage:'senior'}, {...education(),subjects:['Physics','Local elective']});
 for(const [key,value] of [['board','ISC'],['stream','Commerce'],['className','Class 12']] as const){
  const next=changeEducation(original,key,value);assert.deepEqual(educationFor(next).subjects,original.education!.subjects);assert.equal(educationReviewRequired(original,next),true);
 }
 const app={stage:'senior' as const,classes:['Class 11'],boards:['CBSE'],subjects:['Physics']};
 assert.equal(matchesProfile(original,app),true);assert.equal(matchesProfile(changeEducation(original,'className','Class 12'),app),false);
});
