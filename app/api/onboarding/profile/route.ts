import {identity,body,json,failure,throttle,HttpError} from '@/lib/api';
import {db} from '@/lib/db';
import {onboardingSaveSchema,readOnboardingProfile,saveOnboardingProfile,OnboardingConflict} from '@/lib/onboarding-profile';
export async function GET(req:Request){try{const user=await identity(req);return json(await readOnboardingProfile(await db(),user.id));}catch(e){return failure(e);}}
export async function POST(req:Request){try{const user=await identity(req);await throttle(user.id,'profile');const input=await body(req,onboardingSaveSchema);return json(await saveOnboardingProfile(await db(),user.id,input));}catch(e){return failure(e instanceof OnboardingConflict?new HttpError(409,e.message):e);}}
