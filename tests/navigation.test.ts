import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pageForPath,pathForPage,landingAction} from '../lib/navigation';
test('public root and onboarding remain distinct',()=>{assert.equal(pageForPath('/'),'landing');assert.equal(pageForPath('/start'),'start');assert.equal(pageForPath('/onboarding'),'start');assert.equal(landingAction(false).href,'/start');});
test('legacy and planned navigation URLs resolve to the same existing experiences',()=>{for(const [old,next,page] of [['/home','/today','home'],['/plan','/journey','plan'],['/mentor','/disha','mentor']] as const){assert.equal(pageForPath(old),page);assert.equal(pageForPath(next),page);assert.equal(pathForPage(page),next);}for(const p of ['explore','profile','login','signup','forgot','reset','privacy'])assert.equal(pageForPath('/'+p),p);});
test('authenticated landing action points directly to Today without a root redirect cycle',()=>{assert.deepEqual(landingAction(true),{href:'/today',label:'Continue your journey'});assert.equal(pageForPath(landingAction(true).href),'home');assert.equal(pathForPage('landing'),'/');});
