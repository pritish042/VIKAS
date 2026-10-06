import 'server-only';
import type {Db} from 'mongodb';
import {failure,json,HttpError} from './api';
import {YoutubeError} from './youtube-rules';
import {youtubeConsent} from './youtube-service';
export function youtubeFailure(error:unknown) {
  if(error instanceof YoutubeError||error instanceof HttpError) return json({error:error.message},error.status);
  return failure(error);
}
export async function requireYoutubeConsent(db:Db,userId:string) {
  if(!await youtubeConsent(db,userId)) throw new HttpError(428,'Accept the YouTube Terms of Service before using video discovery.');
}
