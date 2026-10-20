import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {runQueue} from './queue.mjs';
function io(overrides={}) {return {cancelled:()=>false,inspect:async()=>({outcome:'ready'}),execute:async()=>({outcome:'success',submitted:true}),report:async()=>{},pause:async()=>{},...overrides};}
test('private queue processes 1001 synthetic accounts without quota or billing',async()=>{
  let calls=0;const names=Array.from({length:1001},(_,i)=>`demo_${i}`);
  const result=await runQueue(names,io({execute:async()=>{calls++;return {outcome:'success',submitted:true};}}));
  assert.equal(calls,1001);assert.deepEqual(result,{succeeded:1001,skipped:0,stopped:false});
});
test('unavailable and already-unfollowed profiles skip to the next ID',async()=>{
  const executed=[];
  const result=await runQueue(['missing','already','next'],io({inspect:async name=>({outcome:name==='next'?'ready':'skipped'}),execute:async name=>{executed.push(name);return {outcome:'success'};}}));
  assert.deepEqual(executed,['next']);assert.equal(result.skipped,2);
});
test('uncertain result halts before the next account',async()=>{
  const inspected=[];await assert.rejects(runQueue(['first','next'],io({inspect:async name=>{inspected.push(name);return {outcome:'ready'};},execute:async()=>({outcome:'uncertain',message:'Check manually'})})),/Check manually/);
  assert.deepEqual(inspected,['first']);
});
test('stop after inspection prevents clicking',async()=>{
  let stopped=false,clicked=false;
  const result=await runQueue(['first'],io({cancelled:()=>stopped,inspect:async()=>{stopped=true;return {outcome:'ready'};},execute:async()=>{clicked=true;}}));
  assert.equal(clicked,false);assert.equal(result.stopped,true);
});
test('private package has no billing modules and all UI references resolve',async()=>{
  const root=new URL('./',import.meta.url);
  const files=await readdir(root);for(const name of ['account.mjs','quota.mjs','config.mjs'])assert.ok(!files.includes(name));
  const html=await readFile(new URL('index.html',root),'utf8'),app=await readFile(new URL('app.mjs',root),'utf8');
  const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
  for(const [,id] of app.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.includes(id),id);
  assert.ok(!/accountStatus|reserve|settle|checkout|connectedBilling/.test(app));
  const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));assert.equal(manifest.version,'0.3.0');assert.deepEqual(manifest.host_permissions,['https://www.instagram.com/*']);
});
