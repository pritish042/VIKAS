# Profile-based resource eligibility

## Confirmed cause

The resource GET route returned the published catalogue without loading the student's saved profile. The browser's recommended tab checked only education stage; its all-resources tab bypassed that check. Saving a profile did not reload resource results.

## Enforcement

The authenticated session supplies the user ID. `resource-service.ts` loads that user's MongoDB profile and uses `resource-eligibility.ts` for every personalised result. Search only narrows that eligible set. Client-supplied profile or identity query parameters are rejected.

Eligibility requires published status, explicit active status, no expired date, valid audience classification and a server-recorded audience review date. Pathway, class, board, stream, actual subjects and optional topic must all match. Shared 11–12 classes, board independence and stream independence must be explicit. Every subject a resource covers must occur in the saved subjects; PCB never implies Mathematics or an optional subject. Programme resources additionally match programme, discipline and year/semester. Selected topics match exact topic IDs or explicitly classified parent IDs.

Normalisation supports legacy class spellings, board/stream casing, PCB/PCM/PCMB and subject aliases without rewriting saved profiles or guessing missing subjects. Incomplete profiles return `missingFields` and no personalised resources. The interface links to profile editing.

Resources reload after authentication and saved-profile changes. Logout invalidates outstanding account loads and clears private state. Resource requests are cancelled logically when their account/filter/version changes; only results matching the current request key render.

## Resource classification

Existing records are preserved. Missing audience fields, active status or audience review date exclude legacy records from student recommendations and flag them in the editor review queue. Publishing alone does not classify a resource. No general study-skills section previously existed, so general records are not mixed into academic recommendations.

Verified editors can extend the existing `PATCH /api/resources/:id` operation with these fields:

```json
{
  "status": "published",
  "active": true,
  "audience": {
    "pathways": ["senior"],
    "classes": ["Class 12"],
    "boards": ["CBSE"],
    "boardIndependent": false,
    "streams": ["Science"],
    "streamIndependent": false,
    "subjects": ["Biology"],
    "topicIds": [],
    "parentTopicIds": []
  }
}
```

This is a contract example, not an imported resource or student record. Replace the audience with independently confirmed applicability for each actual link. The server stamps audience review identity/date only when a valid audience is supplied. `expiresAt` optionally accepts an ISO timestamp or null. Programme audiences require `programmes`, `disciplines` and `periods`. Topic checks, resource acceptance and DISHA resource links reuse the same eligibility gate. Existing imported catalogue records need audience classification too; this fix does not automatically approve or classify them.

The editor interface identifies missing classification; entering audience metadata currently uses the editor API. New YouTube links should include their actual subject, class/programme, board applicability, stream and topic so they can be classified accurately.

## Verification

Automated tests cover PCB/PCMB, optional subjects, Commerce/Humanities, different boards, shared classes, unrelated pathways, inactive/pending/expired records, incomplete profiles, exact topics, client identity injection, two-user results, profile changes and logout/load races. Tests use isolated in-memory fixtures, never production student records.

For manual verification, use an authorised existing account: save Class 12, CBSE, Science PCB and actual subjects Physics/Chemistry/Biology; confirm only appropriately classified resources appear. Save an optional subject and check eligibility changes. Logout/login and switch to a different existing account; confirm no previous cards flash. Exercise incomplete profiles, search and all tabs. Confirm a non-editor cannot access `view=review` or publish/classify resources.

A live account check remains required when no authorised signed-in account is available. A resource inventory requires working MongoDB connectivity; do not infer counts from the research catalogue.

## This change’s verification result

Typecheck, all 78 tests and production build passed. A read-only MongoDB inventory found 8 resources, all published and all lacking the required active/audience classification metadata; all 8 remain stored and are excluded until classified. No student or resource records were changed. The exact authorised local PCB-account browser test remains unverified.
