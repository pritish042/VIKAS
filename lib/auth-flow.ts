import type { Profile } from './types';
import {educationErrors} from './education';

// Signing in must only load persisted data. Only a newly created account
// can receive the guest's onboarding choices automatically.
export async function restoreAfterAuthentication(
  mode: 'login' | 'signup',
  draft: Profile,
  load: () => Promise<void>,
  save: (profile: Profile) => Promise<void>,
) {
  await load();
  if (mode === 'signup' && draft.stage && draft.level && (!draft.education || !Object.keys(educationErrors(draft.stage,draft.education)).length)) {
    await save({
      ...draft,
      interests: draft.interests.map(value => value.trim()).filter(Boolean),
      onboardingComplete: true,
    });
  }
}

export async function signOutAndClear(
  signOut: () => Promise<{ error: { message?: string } | null }>,
  clear: () => void,
) {
  const result = await signOut();
  if (result.error) throw new Error(result.error.message || 'Could not sign out. Please try again.');
  clear();
}
