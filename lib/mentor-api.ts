import 'server-only';
import {failure,json} from './api';
import {MentorError} from './mentor-knowledge';
export const mentorFailure=(e:unknown)=>e instanceof MentorError?json({error:e.message},e.status):failure(e);
