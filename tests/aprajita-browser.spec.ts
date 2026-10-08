import {test,expect} from '@playwright/test';
import {build} from 'esbuild';
import {createServer,type Server} from 'node:http';
import type {AddressInfo} from 'node:net';
import type {BrowserPython,PythonPhase} from '../lib/aprajita/browser-python';
import type {RunResult} from '../lib/aprajita/contract';
import type {previewDocument} from '../lib/aprajita/preview';
declare global {interface Window {runner:BrowserPython;phase:PythonPhase;pending:Promise<RunResult>;prepareHTML:typeof previewDocument;PythonRunner:typeof BrowserPython;}}
let server:Server,url:string;
test.beforeAll(async()=>{
 const bundle=await build({stdin:{contents:"import {BrowserPython} from './lib/aprajita/browser-python'; import {previewDocument} from './lib/aprajita/preview'; window.PythonRunner=BrowserPython; window.prepareHTML=previewDocument;",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'browser',format:'iife'});
 server=createServer((req,res)=>{if(req.url==='/bundle.js'){res.setHeader('Content-Type','application/javascript');res.end(bundle.outputFiles[0].text);}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body><script src="/bundle.js"></script></body></html>');}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));url=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
test.afterAll(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));});
test.beforeEach(async({page})=>{page.on('console',message=>{if(message.type()==='error')console.log('Browser diagnostic:',message.text());});page.on('requestfailed',request=>console.log('Request failed:',request.url(),request.failure()?.errorText));await page.goto(url);await page.evaluate(()=>{window.runner=new window.PythonRunner();window.phase='idle';});});
test('real browser Python reads stdin, separates stdout/stderr, and cannot reach app storage/network',async({page})=>{
 test.setTimeout(90000);
 const result=await page.evaluate(()=>window.runner.run('import sys\nprint(input())\nprint("warning", file=sys.stderr)','42\n',phase=>window.phase=phase));
 expect(result.success).toBe(true);expect(result.stdout).toBe('42\n');expect(result.stderr).toBe('warning\n');await expect.poll(()=>page.workers().length).toBe(0);
 const isolated=await page.evaluate(()=>window.runner.run('import js\nprint(js.location.origin)\ntry:\n js.fetch("/api/profile")\nexcept Exception:\n print("network blocked")\ntry:\n js.indexedDB.open("private")\nexcept Exception:\n print("storage blocked")','',phase=>window.phase=phase));
 expect(isolated.success).toBe(true);expect(isolated.stdout).toContain('null\n');expect(isolated.stdout).toContain('network blocked');expect(isolated.stdout).toContain('storage blocked');
});
test('Stop terminates an infinite loop and the next Run starts a fresh worker',async({page})=>{
 test.setTimeout(90000);
 await page.evaluate(()=>{window.pending=window.runner.run('x=99\nwhile True: pass','',phase=>window.phase=phase);});
 await expect.poll(()=>page.evaluate(()=>window.phase),{timeout:50000}).toBe('running');
 await page.evaluate(()=>window.runner.stop());const stopped=await page.evaluate(()=>window.pending);expect(stopped.status).toContain('Stopped');expect(stopped.success).toBe(false);
 await expect.poll(()=>page.workers().length).toBe(0);
 const fresh=await page.evaluate(()=>window.runner.run('print("fresh" if "x" not in globals() else "stale")','',phase=>window.phase=phase));expect(fresh.stdout).toBe('fresh\n');expect(fresh.success).toBe(true);
});
test('the parent deadline stops an infinite loop without cooperative Python interrupts',async({page})=>{
 test.setTimeout(70000);
 const result=await page.evaluate(()=>window.runner.run('while True: pass','',phase=>window.phase=phase));expect(result.statusId).toBe(5);expect(result.status).toContain('Time limit exceeded');await expect.poll(()=>page.workers().length).toBe(0);
});
test('HTML stays inert during sanitization and opaque during preview',async({page})=>{
 const received:string[]=[];page.on('response',response=>{if(response.url().includes('/leak'))received.push(response.url());});
 await page.evaluate(()=>{
  localStorage.setItem('aprajita-isolation-test','private');
  const iframe=document.createElement('iframe');iframe.id='html-preview';iframe.setAttribute('sandbox','');iframe.referrerPolicy='no-referrer';
  iframe.srcdoc=window.prepareHTML('<h1>Preview works</h1><script>parent.document.body.dataset.leaked=1;fetch("/leak")</script><img src="/leak-image"><iframe src="/leak-frame"></iframe><a href="/leak-link">link</a><style>body{background-image:url(/leak-css)}</style><form action="/leak-form"><input></form>');document.body.appendChild(iframe);
 });
 const frame=page.frameLocator('#html-preview');await expect(frame.locator('h1')).toHaveText('Preview works');expect(await frame.locator('script,iframe,form').count()).toBe(0);expect(await frame.locator('a').getAttribute('href')).toBeNull();
 expect(await page.locator('body').getAttribute('data-leaked')).toBeNull();expect(await page.locator('#html-preview').getAttribute('sandbox')).toBe('');
 const preview=page.frames().find(f=>f.url()==='about:srcdoc')!;const isolated=await preview.evaluate(()=>{try{return localStorage.getItem('aprajita-isolation-test');}catch{return 'blocked';}});expect(isolated).toBe('blocked');expect(received).toEqual([]);
});
