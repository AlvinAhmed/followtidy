import test from 'node:test';
import assert from 'node:assert/strict';
import { unfollowProfile } from './runner.mjs';
function fixture({ active = true, path = '/alice/', blocked = false, ambiguous = false, stopAfterFollowing = false, noChange = false, unavailable = '', login = false, profile = true, already = false, disappears = false } = {}) {
  let phase = already ? 'done' : 'following'; const clicks = [];
  const element = (label, click = () => {}, children = () => []) => ({innerText:label,textContent:label,getClientRects:()=>[{}],click,querySelectorAll:children});
  const heading = element('alice');
  const following = element('Following', () => { clicks.push('Following'); phase = 'dialog'; if (stopAfterFollowing) active = false; });
  const unfollow = element('Unfollow', () => { clicks.push('Unfollow'); if (!noChange) phase = 'done'; if(disappears) { profile=false; document.body.innerText="Sorry, this page isn't available."; } });
  const follow = element('Follow');
  const header = element('', () => {}, selector => selector.includes('heading') ? [heading] : [phase === 'done' ? follow : following]);
  const dialog = element('', () => {}, () => [unfollow]);
  globalThis.chrome = {storage:{local:{get:async()=>({run:{id:'test',active,expires:Date.now()+10000}}),set:async()=>{}}}};
  globalThis.location = {hostname:'www.instagram.com',pathname:path};
  globalThis.getComputedStyle = () => ({visibility:'visible'});
  globalThis.document = {body:{innerText:blocked?'Try again later':unavailable}, querySelector:()=>login?{}:null, querySelectorAll: selector => selector === 'header' ? (!profile?[]:ambiguous?[header,header]:[header]) : phase === 'dialog' ? [dialog] : []};
  return clicks;
}
test('verifies the target, confirmation and final follow state', async () => {
  const clicks = fixture(); assert.equal((await unfollowProfile('alice','test')).ok, true); assert.deepEqual(clicks,['Following','Unfollow']);
});
test('unavailable profiles return skip, without clicks', async () => {
  for(const unavailable of ["Sorry, this page isn't available.",'Sorry, this page is not available.','This page isn’t available.']) {
    const clicks=fixture({unavailable,profile:false}); const result=await unfollowProfile('alice','test');
    assert.equal(result.outcome,'skipped'); assert.equal(result.submitted,false); assert.deepEqual(clicks,[]);
  }
});
test('restriction and login screens take precedence over unavailable text', async () => {
  for(const options of [{blocked:true},{login:true}]) { fixture({...options,profile:false,unavailable:'Sorry, this page is not available.'}); assert.equal((await unfollowProfile('alice','test')).outcome,'error'); }
});
test('an unavailable sentence in a valid profile is not a skip', async () => {
  fixture({unavailable:"Sorry, this page isn't available."}); assert.equal((await unfollowProfile('alice','test')).outcome,'success');
});
test('inspect mode verifies without clicking; already unfollowed is skipped', async () => {
  let clicks=fixture(); assert.equal((await unfollowProfile('alice','test',true)).outcome,'ready'); assert.deepEqual(clicks,[]);
  clicks=fixture({already:true}); assert.equal((await unfollowProfile('alice','test')).outcome,'skipped'); assert.deepEqual(clicks,[]);
});
test('disappearance after submission is uncertain, never skipped', async () => {
  fixture({disappears:true}); const result=await unfollowProfile('alice','test'); assert.equal(result.outcome,'uncertain'); assert.equal(result.submitted,true);
});
test('cancellation, redirects and restriction messages prevent clicks', async () => {
  for (const options of [{active:false},{path:'/bob/'},{blocked:true}]) {
    const clicks = fixture(options); assert.equal((await unfollowProfile('alice','test')).ok,false); assert.deepEqual(clicks,[]);
  }
});
test('stop between menu and confirmation prevents unfollow', async () => {
  const clicks = fixture({stopAfterFollowing:true}); assert.equal((await unfollowProfile('alice','test')).ok,false); assert.deepEqual(clicks,['Following']);
});
test('ambiguous headers and unconfirmed outcomes are failures', async () => {
  const original = globalThis.setTimeout; globalThis.setTimeout = fn => {queueMicrotask(fn);return 0;};
  try {
    const clicks = fixture({ambiguous:true}); assert.equal((await unfollowProfile('alice','test')).ok,false); assert.deepEqual(clicks,[]);
    fixture({noChange:true}); assert.equal((await unfollowProfile('alice','test')).ok,false);
  } finally {globalThis.setTimeout = original;}
});
