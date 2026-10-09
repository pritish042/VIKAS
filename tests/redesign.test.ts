import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {readFileSync} from 'node:fs';
import {guideActionSchema,guideSteps,guidePlacement} from '../lib/guide-actions';
import {pageForPath} from '../lib/navigation';
import {themeBootstrap,themePreference,resolvedTheme} from '../lib/theme';
import {visibleChapterGroups} from '../lib/chapter-presentation';
import type {Chapter,ChapterMapping} from '../lib/chapter-catalogue';
import type {Resource} from '../lib/types';

test('guide accepts only registered tours, rejects arbitrary route/selector/action and uses existing destinations',()=>{
 for(const tour of Object.keys(guideSteps)){assert.equal(guideActionSchema.safeParse({tour}).success,true);for(const step of guideSteps[tour as keyof typeof guideSteps]){assert.notEqual(pageForPath(step.route),'landing');assert.match(step.target,/^[a-z]+(?:-[a-z]+)+$/);}}
 for(const input of [{tour:'delete'},{tour:'home',selector:'input'},{tour:'home',route:'https://evil.example'},{tour:'labs',action:'run'},{tour:'home',confirmed:true}])assert.equal(guideActionSchema.safeParse(input).success,false);
});
test('guide remains bounded on desktop and above keyboard/nav on mobile, including missing targets',()=>{
 for(const target of [undefined,{right:2000,top:2000},{right:-500,top:-500}]){
  const position=guidePlacement(1024,600,0,0,target);
  const [x,y]=position.transform.match(/[\d.-]+(?=px)/g)!.map(Number);assert.ok(x>=12&&x+320<=1012);assert.ok(y>=12&&y+260<=588);
 }
 const normal=guidePlacement(390,844,0,0);assert.equal(normal.bottom,84);assert.equal(normal.left,12);assert.equal(normal.right,12);
 const keyboard=guidePlacement(390,400,0,444);assert.equal(keyboard.bottom,456);assert.ok(keyboard.maxHeight<=376);
 const composer=guidePlacement(390,400,0,444,{right:390,top:340});assert.equal(composer.bottom,'auto');assert.ok(Number(composer.top)+composer.maxHeight<340);
});
test('first-paint theme respects saved preferences, defaults dark and survives storage failure',()=>{
 for(const saved of [null,'invalid','light','dark','system'])for(const dark of [false,true]){
  const document={documentElement:{dataset:{theme:''}}};runInNewContext(themeBootstrap,{document,localStorage:{getItem:()=>saved},matchMedia:()=>({matches:dark})});assert.equal(document.documentElement.dataset.theme,resolvedTheme(themePreference(saved),dark));
 }
 const document={documentElement:{dataset:{theme:''}}};runInNewContext(themeBootstrap,{document,localStorage:{getItem:()=>{throw Error('Blocked');}}});assert.equal(document.documentElement.dataset.theme,'dark');
});
const fixture=JSON.parse(readFileSync(new URL('../data/chapters/cbse-class8-mathematics-2026-27.json',import.meta.url),'utf8'));
const chapters=fixture.chapters as Chapter[];
test('chapter search removes unrelated empty groups but preserves honest matches without videos',()=>{
 const all=visibleChapterGroups(chapters,[],'');assert.equal(all[0].rows.length,chapters.length);
 const term=chapters[0].chapterTitle;const filtered=visibleChapterGroups(chapters,[],term);assert.equal(filtered[0].rows.length,1);assert.equal(filtered[0].rows[0].videos.length,0);
 assert.equal(visibleChapterGroups(chapters,[],'absent-search-term').length,0);assert.equal(visibleChapterGroups(chapters,[],'Mathematics')[0].rows.length,chapters.length);
});
test('chapter presentation never joins different textbook/session versions with reused chapter IDs',()=>{
 const chapter=chapters[0];const map={chapterId:chapter.chapterId,sequencePosition:1,chapter:{...chapter,academicSession:'2025-26'}} as ChapterMapping;
 const video={_id:'test-only',title:'Example',chapterMappings:[map]} as Resource;
 assert.equal(visibleChapterGroups([chapter],[video],'')[0].rows[0].videos.length,0);
 assert.equal(visibleChapterGroups([chapter],[{...video,chapterMappings:[{...map,chapter}]}],'')[0].rows[0].videos.length,1);
});
