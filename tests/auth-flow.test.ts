import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restoreAfterAuthentication, signOutAndClear } from '../lib/auth-flow';
import { emptyProfile, type Profile } from '../lib/types';

const draft: Profile = { ...emptyProfile, stage: 'undergraduate', level: 'Year 1', interests: ['  Science ', ''] };

test('login loads the saved profile without overwriting it with guest choices', async () => {
  let loaded = false;
  await restoreAfterAuthentication('login', draft, async () => { loaded = true; }, async () => {
    assert.fail('Login must never save the guest draft');
  });
  assert.equal(loaded, true);
});

test('new accounts save completed onboarding after loading the session', async () => {
  const actions: string[] = [];
  await restoreAfterAuthentication('signup', draft, async () => { actions.push('load'); }, async profile => {
    actions.push('save');
    assert.equal(profile.onboardingComplete, true);
    assert.deepEqual(profile.interests, ['Science']);
  });
  assert.deepEqual(actions, ['load', 'save']);
});

test('incomplete onboarding never overwrites a profile', async () => {
  await restoreAfterAuthentication('signup', emptyProfile, async () => {}, async () => {
    assert.fail('Incomplete onboarding must not be saved');
  });
});

test('failed session loading does not write profile data', async () => {
  await assert.rejects(restoreAfterAuthentication('signup', draft, async () => {
    throw new Error('Session unavailable');
  }, async () => { assert.fail('Must not save without loading the session'); }), /Session unavailable/);
});

test('failed logout preserves the visible session and reports the error', async () => {
  await assert.rejects(signOutAndClear(async () => ({ error: { message: 'Unavailable' } }), () => {
    assert.fail('Must not claim logout succeeded');
  }), /Unavailable/);
});

test('successful logout clears private client state', async () => {
  let cleared = false;
  await signOutAndClear(async () => ({ error: null }), () => { cleared = true; });
  assert.equal(cleared, true);
});
