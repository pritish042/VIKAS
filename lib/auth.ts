import 'server-only';
import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { mongoClient } from './db';
import nodemailer from 'nodemailer';
export const mailEnabled = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
async function mail(to: string, subject: string, url: string) {
 const transport = nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_PORT==='465',auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}:undefined});
 await transport.sendMail({from:process.env.SMTP_FROM,to,subject,text:`${subject}\n\nOpen this link: ${url}\n\nIf you did not request this, you can ignore this email.`});
}
function createAuth() {
 if (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32) throw new Error('Set a random BETTER_AUTH_SECRET of at least 32 characters.');
 return betterAuth({
  appName:'VIKAS', baseURL:process.env.BETTER_AUTH_URL, secret:process.env.BETTER_AUTH_SECRET,
  database:mongodbAdapter(mongoClient().db(process.env.MONGODB_DB||'vikas')),
  trustedOrigins:[process.env.BETTER_AUTH_URL!],
  emailAndPassword:{enabled:true,minPasswordLength:12,maxPasswordLength:128,requireEmailVerification:mailEnabled(),revokeSessionsOnPasswordReset:true,...(mailEnabled()?{sendResetPassword:async({user,url}:{user:{email:string};url:string})=>{await mail(user.email,'Reset your VIKAS password',url);}}:{})},
  ...(mailEnabled()?{emailVerification:{sendOnSignUp:true,autoSignInAfterVerification:true,sendVerificationEmail:async({user,url}:{user:{email:string};url:string})=>{await mail(user.email,'Verify your VIKAS email',url);}}}:{}),
  session:{expiresIn:60*60*24*7,updateAge:60*60*24},
  rateLimit:{enabled:true,storage:'database',window:60,max:60,customRules:{'/sign-in/email':{window:60,max:5},'/sign-up/email':{window:60,max:3},'/request-password-reset':{window:60,max:3}}},
 });
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() { return instance ??= createAuth(); }
