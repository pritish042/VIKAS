import 'server-only';
import {failure,json} from './api';
import {TopicError} from './topic-service';
export const topicFailure=(e:unknown)=>e instanceof TopicError?json({error:e.message},e.status):failure(e);
