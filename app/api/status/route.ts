import { configured } from '@/lib/db';
import { mailEnabled } from '@/lib/auth';
import { json } from '@/lib/api';
export const dynamic='force-dynamic';
export function GET(){return json({accounts:configured(),email:mailEnabled(),mentor:Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL)});}
