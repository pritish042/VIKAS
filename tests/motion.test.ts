import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MotionProgress} from '../components/motion-progress';
import {MotionPresence} from '../components/motion-presence';
test('progress derives only from real values, bounds its visual fill and retains native semantics',()=>{
 const html=renderToStaticMarkup(createElement(MotionProgress,{value:2,max:4,label:'2 of 4 steps'}));assert.match(html,/scaleX\(0.5\)/);assert.match(html,/<progress[^>]+value="2"[^>]+max="4"/);assert.match(html,/aria-label="2 of 4 steps"/);
 assert.match(renderToStaticMarkup(createElement(MotionProgress,{value:0,max:0})),/scaleX\(0\)/);assert.match(renderToStaticMarkup(createElement(MotionProgress,{value:10,max:4})),/scaleX\(1\)/);
});
test('dialog presence never hides or delays opening content and omits a closed initial shell',()=>{
 assert.equal(renderToStaticMarkup(createElement(MotionPresence,{children:null})), '');
 const html=renderToStaticMarkup(createElement(MotionPresence,{children:createElement('section',{role:'dialog'},'Visible immediately')}));assert.match(html,/Visible immediately/);assert.doesNotMatch(html,/inert=""|aria-hidden="true"/);
});
