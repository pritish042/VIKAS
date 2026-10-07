import {createHash} from 'node:crypto';
import {checkOrigin,body,json,failure,throttle} from '@/lib/api';
import {configured} from '@/lib/db';
import {getAuth} from '@/lib/auth';
import {onboardingHelpSchema,boundedOnboardingHelp} from '@/lib/onboarding-contract';
import {onboardingWithGemini} from '@/lib/mentor-provider';
export async function POST(req:Request){try{
 checkOrigin(req);const input=boundedOnboardingHelp(await body(req,onboardingHelpSchema));
 if(!configured())return json({status:'unavailable'});
 const session=await getAuth().api.getSession({headers:req.headers});
 // Guests share an additional global budget; no browser-provided ID can bypass it.
 if(!session)await throttle('anonymous','onboarding-guest',20);
 const key=session?.user.id||createHash('sha256').update(req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'anonymous').digest('hex');
 await throttle(key,'onboarding-help',5);
 return json(await onboardingWithGemini(input,{key:process.env.GEMINI_API_KEY,model:process.env.GEMINI_MODEL,signal:req.signal}));
 }catch(e){return failure(e);}}
