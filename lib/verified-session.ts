'use client';
import {authClient} from './auth-client';

// Coalesce simultaneous readers, without retaining a session across checks.
let pending: ReturnType<typeof authClient.getSession> | undefined;
export function verifiedSession(){
 if(!pending){
  const request=authClient.getSession();
  pending=request;
  void request.finally(()=>{if(pending===request)pending=undefined;}).catch(()=>{});
 }
 return pending;
}
export function invalidateSessionRead(){pending=undefined;}
