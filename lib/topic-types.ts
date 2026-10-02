export type ResourceFeeling = 'too_easy' | 'about_right' | 'too_difficult';
export interface TopicQuestion { id:string; prompt:string; options:{id:string;label:string}[] }
export interface TopicSummary { id:string; subject:string; title:string; languages:string[]; assessmentId:string|null }
export interface ConceptResult { questionId:string; objective:string; prerequisite:boolean; result:'revisit'|'not_sure'|'understood'; explanation:string; answer:string }
export interface Recommendation {
 resourceId:string; title:string; url:string; provider:string; language:string; effort:string; access:string;
 prerequisites:string; limitations:string; reasons:string[]; minutes:number; approach:string;
}
export interface TopicAttempt {
 _id:string; topicId:string; topicTitle:string; assessmentId:string|null; version:string|null;
 skipped:boolean; results:ConceptResult[]; recommendations:Recommendation[]; createdAt:string;
 acceptance?:{resourceId:string;taskRef:string;goalTitle:string};
 feedback?:{feeling:ResourceFeeling;createdAt:string};
}
