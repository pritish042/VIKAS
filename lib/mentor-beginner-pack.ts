import {createHash} from 'node:crypto';
import type {Passage} from './mentor-contract';
export type BeginnerLanguage='c'|'cpp'|'python'|'c-cpp';
export type BeginnerLesson={heading:string;explanation:string;code:string;question:string;expected:string;reason:string;source?:string};
const cSource='https://www.gnu.org/software/gnu-c-manual/gnu-c-manual.html';
const cppSource='https://devblogs.microsoft.com/cppblog/cpp-tutorial-hello-world/';
const pythonSource='https://docs.python.org/3/tutorial/introduction.html';
const wrap=(language:'c'|'cpp',body:string)=>language==='c'?`#include <stdio.h>\n\nint main(void) {\n    ${body}\n    return 0;\n}`:`#include <iostream>\n\nint main() {\n    ${body}\n    return 0;\n}`;
const numericQuestion='What number is printed when you replace 2 + 3 with 4 + 3?';
const c:BeginnerLesson[]=[
 {heading:'Output and arithmetic',explanation:'C programs start at main. Include stdio.h to declare printf; %d prints an integer, and + adds numbers.',code:wrap('c','printf("%d\\n", 2 + 3);'),question:numericQuestion,expected:'7',reason:'4 + 3 is 7; %d prints that integer.'},
 {heading:'Variables',explanation:'An int variable holds an integer. Initialise it before use; the expression score + 2 adds two without changing score.',code:wrap('c','int score = 7;\n    printf("%d\\n", score + 2);'),question:'What number does this example print?',expected:'9',reason:'score is 7, so score + 2 is 9.'},
];
const cpp:BeginnerLesson[]=[
 {heading:'Output and arithmetic',explanation:'C++ programs start at main. Include iostream and use std::cout with << to send a value to standard output.',code:wrap('cpp','std::cout << 2 + 3 << "\\n";'),question:numericQuestion,expected:'7',reason:'4 + 3 is 7; std::cout prints the value.'},
 {heading:'Variables',source:'https://learn.microsoft.com/en-us/cpp/cpp/declarations-and-definitions-cpp?view=msvc-170',explanation:'An int variable holds an integer. Initialise it before use; score + 2 computes a new value without changing score.',code:wrap('cpp','int score = 7;\n    std::cout << score + 2 << "\\n";'),question:'What number does this example print?',expected:'9',reason:'score is 7, so score + 2 is 9.'},
];
const python:BeginnerLesson[]=[
 {heading:'Output and arithmetic',explanation:'Python executes these statements in order. print displays a value; + adds numbers. You can run this example as a complete Python script.',code:'print(2 + 3)',question:numericQuestion,expected:'7',reason:'4 + 3 is 7; print displays that value.'},
 {heading:'Variables',explanation:'Assignment associates a name with a value. score + 2 adds two without changing the value associated with score.',code:'score = 7\nprint(score + 2)',question:'What number does this example print?',expected:'9',reason:'score is 7, so score + 2 is 9.'},
];
// Original app-authored summaries, reviewed against linked primary documentation on 2026-10-08.
// This is a small programming pack, not a board curriculum or an educator certification.
export const beginnerPack={
 c:{title:'C basics',source:cSource,lessons:c},
 cpp:{title:'C++ basics',source:cppSource,lessons:cpp},
 python:{title:'Python basics',source:pythonSource,lessons:python},
 'c-cpp':{title:'C and C++ basics',source:cSource,lessons:[{...c[0],explanation:'C and C++ are distinct languages. Start with C output below; next compares the C++ version. '+c[0].explanation},{...cpp[0],explanation:'Here is the C++ version of the previous C example. '+cpp[0].explanation}]},
} satisfies Record<BeginnerLanguage,{title:string;source:string;lessons:BeginnerLesson[]}>;
export const beginnerTopics=()=>Object.entries(beginnerPack).map(([key,pack])=>({topicId:`${key}-basics`,title:pack.title,prerequisites:[]}));
export function packLanguage(topicId:string):BeginnerLanguage|undefined{return (Object.keys(beginnerPack) as BeginnerLanguage[]).find(key=>topicId===`${key}-basics`);}
export function beginnerPassages(language:BeginnerLanguage,step:number):Passage[]{
 const pack=beginnerPack[language],lesson=pack.lessons[Math.min(step,pack.lessons.length-1)],text=`${lesson.explanation}\nExample:\n${lesson.code}\nPractice: ${lesson.question}\nAnswer check: ${lesson.expected}. ${lesson.reason}`;
 const version=createHash('sha256').update(text).digest('hex');
 const source=lesson.source||(language==='c-cpp'&&step===1?cppSource:pack.source);
 return [{id:`pack-${language}-${step}`,knowledgeRef:version.slice(0,24),title:pack.title,heading:lesson.heading,text,sourceUrl:source,version,reviewedAt:'2026-10-08T00:00:00.000Z',topicId:`${language}-basics`}];
}
export function lessonText(language:BeginnerLanguage,step:number){const lesson=beginnerPack[language].lessons[step],codeLanguage=language==='c-cpp'?(step===0?'c':'cpp'):language;return `${lesson.heading}\n\n${lesson.explanation}\n\n\`\`\`${codeLanguage}\n${lesson.code}\n\`\`\`\n\nPractice: ${lesson.question}`;}
