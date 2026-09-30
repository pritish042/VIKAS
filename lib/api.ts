import 'server-only';
import { NextResponse } from 'next/server';
import { getAuth } from './auth';
import { db, configured } from './db';
import { ObjectId } from 'mongodb';
import { ZodError, type ZodType } from 'zod';
export class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
export const json = (value:unknown,status=200) => NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});
export function failure(e:unknown) {
 if(e instanceof HttpError) return json({error:e.message},e.status);
 if(e instanceof ZodError) return json({error:e.issues[0]?.message || 'Check your entries.'},400);
 console.error('Request failed',e instanceof Error?e.name:'UnknownError');
 return json({error:'We could not save or load your data. Please try again shortly.'},503);
}
export function checkOrigin(req:Request) {
 if(['GET','HEAD','OPTIONS'].includes(req.method))return;
 const origin=req.headers.get('origin');
 if(!origin || origin!==new URL(process.env.BETTER_AUTH_URL||'http://localhost:3000').origin)throw new HttpError(403,'Request origin not allowed.');
}
export async function identity(req:Request) {
 if(!configured())throw new HttpError(503,'Accounts are not available yet. Please try again later.');
 checkOrigin(req);
 const s=await getAuth().api.getSession({headers:req.headers});
 if(!s)throw new HttpError(401,'Please sign in to continue.');
 return s.user;
}
export async function body<T>(req:Request,schema:ZodType<T>):Promise<T> {
 if(Number(req.headers.get('content-length')||0)>12000)throw new HttpError(413,'This entry is too long.');
 const raw=await req.text(); if(raw.length>12000)throw new HttpError(413,'This entry is too long.');
 let data;try{data=JSON.parse(raw);}catch{throw new HttpError(400,'Invalid request.');}
 return schema.parse(data);
}
export function objectId(id:string) { if(!/^[a-f\d]{24}$/i.test(id))throw new HttpError(400,'Invalid item.'); return new ObjectId(id); }
export function editor(user:{email:string;emailVerified:boolean}) { return user.emailVerified && (process.env.CONTENT_EDITOR_EMAILS||'').split(',').map(v=>v.trim().toLowerCase()).includes(user.email.toLowerCase()); }
export async function throttle(userId:string,bucket:string,limit=30) {
 const d=await db();const minute=Math.floor(Date.now()/60000);const _id=`${bucket}:${userId}:${minute}`;
 const result=await d.collection<{_id:string;count:number;expiresAt:Date}>('app_limits').findOneAndUpdate({_id},{$inc:{count:1},$setOnInsert:{expiresAt:new Date(Date.now()+120000)}},{upsert:true,returnDocument:'after'});
 if((result?.count||0)>limit)throw new HttpError(429,'Please wait a moment before trying again.');
}
