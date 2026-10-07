import type {Profile} from './types';
import {educationFor} from './education';
export type SubjectCoverage={educationKey:string;subjects:{subject:string;resources:boolean;searchLinks:boolean;assessments:boolean}[]};
// Compare the complete education draft so coverage never follows stale saved details.
export function educationCoverageKey(profile:Profile):string {
 return JSON.stringify({stage:profile.stage,education:educationFor(profile)});
}
