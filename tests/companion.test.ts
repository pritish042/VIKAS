import {test} from 'node:test';
import assert from 'node:assert/strict';
import {acceptCompanionEvent,companionPlacement,navigationCompanionEvent,type CompanionPolicy} from '../lib/companion-events';
import {pageForPath} from '../lib/navigation';
test('routine events cool down, deduplicate, and yield to errors',()=>{
 const state:CompanionPolicy={lastRoutine:-Infinity,seen:{}};
 assert.equal(acceptCompanionEvent(state,'navigation:learn',0),true);
 assert.equal(acceptCompanionEvent(state,'navigation:labs',1000),false);
 assert.equal(acceptCompanionEvent(state,'action:failed',1100),true);
 assert.equal(acceptCompanionEvent(state,'progress:saved',1200),false);
 assert.equal(acceptCompanionEvent(state,'navigation:learn',11000),false);
 assert.equal(acceptCompanionEvent(state,'navigation:learn',21000),true);
});
test('placement stays inside viewport and outside obstructing regions',()=>{
 assert.equal(companionPlacement(900,300,480,[{top:650,bottom:900}]),334);
 assert.equal(companionPlacement(400,390,0,[]),null);
 assert.equal(companionPlacement(900,390,400,[{top:0,bottom:900}]),null);
 assert.equal(companionPlacement(900,300,-200,[]),88);
});
test('legacy and current routes produce the same navigation events',()=>{
 for(const [a,b] of [['/learn','/explore'],['/aprajita','/labs'],['/journey','/plan'],['/disha','/mentor']])assert.equal(navigationCompanionEvent(pageForPath(a)),navigationCompanionEvent(pageForPath(b)));
 assert.equal(navigationCompanionEvent(pageForPath('/reset')),undefined);
});
