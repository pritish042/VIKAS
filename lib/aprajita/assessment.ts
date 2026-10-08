// Server-only answer bank. Each item and explanation reviewed for consistency at implementation.
// This is a basic readiness check, not a standardized assessment or mastery claim.
import {READINESS_VERSION} from './access';
export {READINESS_VERSION};
const bank=[
 {id:'instructions',prompt:'What is an algorithm?',choices:['A step-by-step method for solving a problem','A computer screen','A password','A network cable'],answer:'a',explanation:'An algorithm is an ordered set of steps for solving a problem. A program can implement those steps.'},
 {id:'input',prompt:'Which is an input device?',choices:['Monitor','Keyboard','Speaker','Printer'],answer:'b',explanation:'A keyboard sends input to a computer. Monitors, speakers and printers provide output.'},
 {id:'variable',prompt:'What is a variable used for in a program?',choices:['Cooling the computer','Connecting to Wi-Fi','Storing a value that the program can use','Deleting the operating system'],answer:'c',explanation:'A variable is a named way to store or refer to a value used by a program.'},
 {id:'condition',prompt:'What does an if statement help a program do?',choices:['Always repeat forever','Make a decision based on a condition','Turn off every error','Increase disk space'],answer:'b',explanation:'An if statement chooses whether to execute instructions based on whether a condition is true.'},
 {id:'debugging',prompt:'What does debugging mean?',choices:['Writing a file name','Charging a device','Changing the wallpaper','Finding and fixing problems in a program'],answer:'d',explanation:'Debugging is the process of identifying and fixing problems in code. Read errors and test small changes.'},
];
export const refresher='Programs follow instructions. Algorithms describe the steps; variables hold values, conditions choose what to do, and debugging helps find mistakes. Input enters a computer (for example, a keyboard); output leaves it (for example, a screen).';
export function publicQuestions(){return bank.map(q=>({id:q.id,prompt:q.prompt,options:q.choices.map((text,i)=>({id:'abcd'[i],text}))}));}
export function gradeReadiness(answers:string[]){
 const results=bank.map((q,i)=>({id:q.id,correct:answers[i]===q.answer,answer:q.answer,explanation:q.explanation}));
 const score=results.filter(r=>r.correct).length;return {score,passed:score>=3,results};
}
