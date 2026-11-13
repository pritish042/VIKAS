// Guest-only local production verification. No accounts, fixtures or data mutations.
// VIKAS_PREVIEW_URL=http://127.0.0.1:3100 node scripts/verify-landing-motion.mjs
// Optional: VIKAS_MOTION_OUTPUT_DIR=/tmp/vikas-motion-verification
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from '@playwright/test';

const base=new URL(process.env.VIKAS_PREVIEW_URL||'http://127.0.0.1:3100');
if(!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw new Error('Use a local production preview; this script is not a production benchmark.');
const output=process.env.VIKAS_MOTION_OUTPUT_DIR||'/tmp/vikas-motion-verification';
await mkdir(output,{recursive:true});
const chrome=process.env.VIKAS_CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser=await chromium.launch({headless:true,...(existsSync(chrome)?{executablePath:chrome}:{channel:'chrome'}),args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],consoleErrors=[],brokenAssets=[],checks=[];
const assetPattern=/\.(?:js|css|woff2|webp|glb|wasm)(?:\?|$)/;
const track=(page,{allowModelFailure=false}={})=>{
 page.on('console',message=>{if(message.type()==='error'){const location=message.location().url||'';if(allowModelFailure&&location.includes('/stitch/anatomical-brain.glb'))return;consoleErrors.push({message:message.text(),location});}});
 page.on('pageerror',error=>errors.push(error.message));
 page.on('response',response=>{if(response.status()>=400&&assetPattern.test(response.url()))brokenAssets.push({status:response.status(),path:new URL(response.url()).pathname});});
};
const mark=message=>{checks.push(message);console.log(`PASS ${message}`);};
const visibleLanding=async page=>{
 await page.locator('#landing-title').waitFor();
 assert.ok(await page.locator('#landing-title').isVisible());
 assert.ok(await page.locator('.landing-actions a').first().isVisible());
 assert.ok(await page.locator('.landing-header .brand').isVisible());
 const opacity=await page.locator('.hero-line').first().evaluate(node=>Number(getComputedStyle(node).opacity));
 assert.ok(opacity>.1,'Initial headline must not be hidden behind an entrance');
};
const settledWorld=async(page,theme)=>{
 await page.waitForFunction(expected=>{
  const root=document.documentElement,cosmos=document.querySelector('.landing-world-cosmos'),dawn=document.querySelector('.landing-world-dawn');
  if(root.dataset.theme!==expected||!cosmos||!dawn)return false;
  const dark=Number(getComputedStyle(cosmos).opacity),light=Number(getComputedStyle(dawn).opacity);
  return expected==='dark'?dark>.98&&light<.02:light>.98&&dark<.02;
 },theme,{timeout:5000});
};
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark'});
 const page=await context.newPage();track(page);
 let modelRequests=0;
 page.on('request',request=>{if(new URL(request.url()).pathname==='/stitch/anatomical-brain.glb')modelRequests++;});
 await page.addInitScript(()=>{
  // Only initialize an unset preference: reload must preserve a real theme-control change.
  if(!localStorage.getItem('vikas-theme'))localStorage.setItem('vikas-theme','dark');
  window.__motionMetrics={cls:0,shifts:0};
  try{new PerformanceObserver(list=>{for(const entry of list.getEntries())if(!entry.hadRecentInput){window.__motionMetrics.cls+=entry.value;window.__motionMetrics.shifts++;}}).observe({type:'layout-shift',buffered:true});}catch{}
 });
 await page.goto(base.href,{waitUntil:'domcontentloaded'});
 await visibleLanding(page);
 mark('Headline, navigation and CTA are immediately visible');
 const finite=await page.evaluate(()=>{
  const selectors=['.landing-header .brand','.landing-header nav','.hero-line','.landing-intro > p:not(.landing-note)','.landing-actions'];
  const ms=value=>value.trim().endsWith('ms')?parseFloat(value):parseFloat(value)*1000;
  return selectors.flatMap(selector=>Array.from(document.querySelectorAll(selector),node=>{
   const style=getComputedStyle(node),durations=style.animationDuration.split(',').map(ms),delays=style.animationDelay.split(',').map(ms),iterations=style.animationIterationCount.split(',');
   return {selector,name:style.animationName,totalMs:Math.max(...durations.map((duration,i)=>duration+(delays[i%delays.length]||0))),iterations};
  }));
 });
 for(const item of finite){assert.ok(item.totalMs<=950,`${item.selector} entrance exceeds 950ms`);assert.ok(!item.iterations.includes('infinite'),`${item.selector} must settle`);}
 assert.equal(await page.locator('.landing-intro h1').evaluate(node=>getComputedStyle(node).animationName),'none','Headline parent must not duplicate line entrances');
 mark('Hero entrances are finite and settle within the entrance budget');
 await page.locator('.sculpture-stage[data-rendered=true] canvas').waitFor({timeout:90000});
 const canvas=await page.locator('.sculpture-stage canvas').elementHandle();
 assert.ok(canvas);assert.equal(modelRequests,1);
 await settledWorld(page,'dark');
 assert.ok(Number(await page.locator('.sculpture-stage').getAttribute('data-surface-paths'))>0,'Pulse paths must follow actual cortical geometry');
 await page.screenshot({path:join(output,'dark-desktop.png')});
 const loadSample=await page.evaluate(()=>({paint:performance.getEntriesByType('paint').map(entry=>({name:entry.name,ms:Math.round(entry.startTime)})),cls:window.__motionMetrics.cls,shiftEntries:window.__motionMetrics.shifts,enhancementStartMs:Math.round(performance.getEntriesByName('vikas-brain-initialization')[0]?.startTime||0)}));

 assert.ok(loadSample.enhancementStartMs>=(loadSample.paint.find(entry=>entry.name==='first-contentful-paint')?.ms||0)-1,'GPU enhancement must start after useful content paint');

 for(const theme of ['light','dark']){
  await page.getByLabel(`${theme} theme`,{exact:true}).click();
  await settledWorld(page,theme);
  await page.waitForFunction(expected=>{const stage=document.querySelector('.sculpture-stage');return stage?.dataset.lightingTheme===expected&&stage.dataset.themeBlend==='settled';},theme,{timeout:10000});
  assert.ok(await canvas.evaluate(node=>node===document.querySelector('.sculpture-stage canvas')),'Theme switch must retain the same canvas');
  assert.equal(modelRequests,1,'Theme switch must not fetch the brain again');
 }
 mark('Dark → light → dark changes worlds without remounting canvas or refetching GLB');
 await page.getByLabel('light theme',{exact:true}).click();await settledWorld(page,'light');
 await page.screenshot({path:join(output,'light-desktop.png')});
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
 await visibleLanding(page);await settledWorld(page,'light');
 mark('Theme preference survives a hard reload');
 await page.getByLabel('system theme',{exact:true}).click();
 await page.emulateMedia({colorScheme:'dark'});await settledWorld(page,'dark');
 await page.emulateMedia({colorScheme:'light'});await settledWorld(page,'light');
 mark('System preference follows operating-system theme changes');

 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:900});
  await page.waitForFunction(expected=>innerWidth===expected,width);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Horizontal overflow at ${width}px`);
 }
 mark('Desktop, tablet and 390/320px layouts have no horizontal overflow');
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('.landing-final').scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>document.querySelector('.landing')?.dataset.heroActive==='false');
 assert.ok(await page.locator('.landing-final').isVisible());
 await page.evaluate(()=>scrollTo(0,0));
 await page.waitForFunction(()=>document.querySelector('.landing')?.dataset.heroActive==='true');
 assert.ok(await page.evaluate(()=>document.querySelector('.landing')?.dataset.pageVisible===String(!document.hidden)));
 mark('Hero visibility pauses/restarts ambient state while sections stay readable');

 await page.emulateMedia({reducedMotion:'reduce'});
 for(const selector of ['.hero-line','.landing-header .brand','.landing-world-cosmos','.landing-world-dawn','.landing-world-field']){
  const motion=await page.locator(selector).first().evaluate(node=>({animation:getComputedStyle(node).animationName,transition:getComputedStyle(node).transitionDuration}));
  assert.equal(motion.animation,'none',`${selector} still animates under reduced motion`);
 }
 await page.getByLabel('dark theme',{exact:true}).click();await settledWorld(page,'dark');
 const toggle=page.locator('.neural-toggle');await toggle.focus();await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.querySelector('.neural-toggle')?.getAttribute('aria-expanded')==='true');
 const links=await page.locator('.neural-destinations a').evaluateAll(nodes=>nodes.map(node=>({title:node.querySelector('span')?.textContent,href:node.getAttribute('href')})));
 assert.deepEqual(links.map(link=>link.href),['/learn','/labs','/disha','/journey']);
 assert.equal(await page.locator('.neural-destinations a:visible').count(),4);
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>document.querySelector('.neural-toggle')?.getAttribute('aria-expanded')==='false');
 mark('Reduced motion, keyboard expansion, Escape and four destination links work');
 const mobileContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 const mobile=await mobileContext.newPage();track(mobile);
 await mobile.goto(base.href,{waitUntil:'domcontentloaded'});
 await visibleLanding(mobile);
 await mobile.locator('.neural-toggle').tap();
 await mobile.waitForFunction(()=>document.querySelector('.neural-toggle')?.getAttribute('aria-expanded')==='true');
 assert.equal(await mobile.locator('.neural-destinations a:visible').count(),4);
 await mobile.screenshot({path:join(output,'mobile-network.png')});
 await mobile.locator('.neural-destinations a[href="/labs"]').tap();
 await mobile.waitForURL(url=>url.pathname==='/labs');
 assert.equal(await mobile.locator('.sculpture-stage canvas').count(),0);
 mark('Mobile tap opens the network and Build navigates to the existing lab');
 await mobileContext.close();

 // Separate guest page with model held back: useful UI must not depend on model completion.
 const fallback=await context.newPage();track(fallback,{allowModelFailure:true});
 let releaseModel;
 const heldModel=new Promise(resolve=>{releaseModel=resolve;});
 await fallback.route('**/stitch/anatomical-brain.glb',async route=>{await heldModel;await route.abort();});
 await fallback.goto(base.href,{waitUntil:'domcontentloaded'});
 await visibleLanding(fallback);
 await fallback.waitForFunction(()=>{const image=document.querySelector('.neural-fallback img');return image?.complete&&image.naturalWidth>0;});
 assert.ok(await fallback.locator('.neural-fallback').isVisible());
 assert.notEqual(await fallback.locator('.sculpture-stage').getAttribute('data-rendered'),'true');
 await fallback.screenshot({path:join(output,'model-held-fallback.png')});
 releaseModel();
 await fallback.locator('.neural-toggle').click();
 assert.equal(await fallback.locator('.neural-destinations a:visible').count(),4);
 mark('Delayed/failed model keeps the matching preview, headline, CTA and network usable');
 await fallback.close();
 assert.deepEqual(errors,[],'Page JavaScript errors');assert.deepEqual(consoleErrors,[],'Console / shader errors');assert.deepEqual(brokenAssets,[],'Broken local static assets');
 mark('No page exceptions or broken static assets');
 const report={checks,loadSample,links,consoleErrors,limitations:'Isolated local production Chrome/SwiftShader observations, not production Core Web Vitals or physical-device FPS. Guest UI only; no account saves, provider execution or student data were exercised. Background-tab lifecycle was not forced; offscreen pause and live visibility-state mapping were checked.'};
 await writeFile(join(output,'verification.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
 await context.close();
}finally{await browser.close();}
