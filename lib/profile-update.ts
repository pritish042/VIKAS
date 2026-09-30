import type { Profile } from './types';

// An aggregation update keeps legacy writes atomic. Older clients can still edit
// goals etc. without losing new fields; changing legacy education invalidates
// the structured education instead of leaving contradictory saved answers.
export function profileUpdate(profile: Profile): Array<{$set:Record<string,unknown>}> {
 const fields=Object.fromEntries(Object.entries(profile).filter(([,value])=>value!==undefined).map(([key,value])=>[key,{$literal:value}]));
 return [{$set:{
  ...fields,
  ...(!profile.education?{education:{$cond:[{$and:['stage','level','stream'].map(key=>({$eq:[`$${key}`,{$literal:profile[key as 'stage'|'level'|'stream']}]}))},'$education','$$REMOVE']}}:{}),
  updatedAt:'$$NOW',createdAt:{$ifNull:['$createdAt','$$NOW']},
 }}];
}
