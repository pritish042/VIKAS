import {z} from 'zod';
export const guideActionSchema=z.object({tour:z.enum(['home','learn','labs','journey','disha','setup'])}).strict();
export type GuideTour=z.infer<typeof guideActionSchema>['tour'];
export const guideSteps={
 home:[{route:'/today',target:'home-next-step',title:'Your next step',text:'Your current goal and next action live here. Review a step when you are ready.'},{route:'/today',target:'home-features',title:'Everything in one place',text:'Lessons, DISHA, the code lab and your journey each have a direct link.'}],
 learn:[{route:'/learn',target:'learn-context',title:'Your studies come first',text:'Resources use your saved board, class or degree and actual subjects. Update Profile if these details changed.'},{route:'/learn',target:'learn-search',title:'Find a lesson',text:'Search a subject or chapter. Source and syllabus limitations stay with each resource.'},{route:'/learn',target:'learn-checks',title:'Optional topic checks',text:'Open this section to choose a check yourself. A check is optional and does not establish mastery.'}],
 labs:[{route:'/labs',target:'labs-workspace',title:'APRAJITA Code Lab',text:'Your saved studies determine access. Once eligible, choose a language, edit, then Run or Preview. Save is always explicit.'}],
 journey:[{route:'/journey',target:'journey-plan',title:'Your plan',text:'Add a manageable step. Completing an activity is separate from demonstrating mastery.'},{route:'/journey',target:'journey-journal',title:'Your growth journal',text:'Keep skills, projects, certifications and achievements here. Add only what you want to record.'}],
 disha:[{route:'/disha',target:'disha-composer',title:'Talk through a topic',text:'Ask a question or request C, C++ or Python basics. Reviewed beginner practice works during an AI outage.'}],
 setup:[{route:'/start',target:'profile-questions',title:'One question at a time',text:'Choose your studies, review your answers and save only when you are ready. Board and stream changes preserve subject selections for review.'}],
} satisfies Record<GuideTour,{route:string;target:string;title:string;text:string}[]>;
export function startGuide(tour:GuideTour){window.dispatchEvent(new CustomEvent('vikas:guide-start',{detail:{tour}}));}
// Positions are derived from measured UI, never from a model response.
export function guidePlacement(width:number,height:number,offset:number,keyboardInset:number,target?:{right:number;top:number},panelHeight=260){
 if(width<760&&target&&target.top>offset+height*.55)return {left:12,right:12,top:offset+12,bottom:'auto',maxHeight:Math.max(80,Math.min(height-100,target.top-offset-24)),width:'auto',transform:'none'};
 if(width<760)return {left:12,right:12,bottom:Math.max(84,keyboardInset+12),maxHeight:Math.max(80,height-(keyboardInset>120?24:100)),width:'auto',top:'auto',transform:'none'};
 const x=Math.max(12,Math.min(width-332,target?target.right+12:width-332));
 const y=Math.max(offset+12,Math.min(offset+height-Math.min(panelHeight,height-24)-12,target?.top??offset+100));
 return {left:0,top:0,right:'auto',width:320,maxHeight:Math.max(80,height-24),transform:`translate3d(${x}px,${y}px,0)`};
}
