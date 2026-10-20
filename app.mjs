import { readExport, nonFollowers, readManual } from './core.mjs';
import { unfollowProfile } from './runner.mjs';
import { runQueue } from './queue.mjs';
const $ = id => document.getElementById(id);
let followers = null, following = null, manual = [], selected = new Set(), mode = 'nonfollowers', running = false, cancelled = false;
const hasExtension = !!globalThis.chrome?.runtime?.id;
const status = text => { $('status').textContent = text; };
function shown() {
  const base = mode === 'all' ? following || [] : followers && following ? nonFollowers(following, followers) : [];
  return [...new Set([...base, ...manual])].sort().filter(name => name.includes($('search').value.trim().toLowerCase().replace(/^@/, '')));
}
function render() {
  const names = shown(); $('list').replaceChildren();
  $('empty').hidden = names.length > 0;
  $('empty').textContent = followers && following ? 'No matching accounts in this view.' : 'Import both lists or add usernames to get started.';
  for (const name of names) {
    const row = document.createElement('label'); row.className = 'row';
    const check = document.createElement('input'); check.type = 'checkbox'; check.checked = selected.has(name); check.disabled = running;
    check.addEventListener('change', () => { if (check.checked) selected.add(name); else selected.delete(name); updateCount(); });
    const label = document.createElement('span'); label.textContent = '@' + name;
    const link = document.createElement('a'); link.href = `https://www.instagram.com/${name}/`; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'View profile';
    row.append(check, label, link); $('list').append(row);
  }
  $('imports').textContent = `${followers === null ? 'Followers: not imported' : `${followers.length} followers`} · ${following === null ? 'Following: not imported' : `${following.length} following`}`;
  $('nonfollowers').classList.toggle('active', mode === 'nonfollowers'); $('all').classList.toggle('active', mode === 'all'); updateCount();
}
function updateCount() { $('count').textContent = `${selected.size} selected`; $('review').disabled = running || !selected.size; }
for (const kind of ['followers', 'following']) $(kind).addEventListener('change', async event => {
  try {
    const files = [...event.target.files]; if (!files.length) return;
    const arrays = await Promise.all(files.map(async file => readExport(JSON.parse(await file.text()), kind)));
    const names = [...new Set(arrays.flat())];
    if (kind === 'followers') followers = names; else following = names;
    selected.clear(); render(); status('Imported. Check that every follower file is included before selecting accounts.');
  } catch (error) { if(kind === 'followers') followers = null; else following = null; selected.clear(); render(); status(`Import failed: ${error.message}`); event.target.value = ''; }
});
$('add').onclick = () => { try { manual = [...new Set([...manual, ...readManual($('manual').value)])]; $('manual').value = ''; render(); } catch (error) { status(error.message); } };
$('search').oninput = render;
for (const key of ['nonfollowers', 'all']) $(key).onclick = () => { mode = key; render(); };
$('select').onclick = () => { shown().forEach(name => selected.add(name)); render(); };
$('clear').onclick = () => { selected.clear(); render(); };
$('review').onclick = () => { $('reviewList').textContent = [...selected].sort().map(name => '@' + name).join('\n'); $('ack').checked = false; $('start').disabled = true; $('confirm').showModal(); };
$('ack').onchange = () => { $('start').disabled = !$('ack').checked; };
$('cancel').onclick = () => $('confirm').close();
$('download').onclick = () => {
  const url = URL.createObjectURL(new Blob([[...selected].sort().join('\n')], { type: 'text/plain' }));
  const a = document.createElement('a'); a.href = url; a.download = 'selected-instagram-accounts.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('reset').onclick = () => { followers = following = null; manual = []; selected.clear(); $('followers').value = $('following').value = $('manual').value = ''; $('log').replaceChildren(); render(); status('Imported data cleared.'); };
function lock(value) {
  running = value;
  for (const id of ['followers','following','manual','add','select','clear','reset']) $(id).disabled = value;
  $('stop').disabled = !value; render();
}
$('stop').onclick = async () => { cancelled = true; await chrome.storage.local.set({ run: { active: false } }); status('Stopping. An unfollow already submitted may still finish.'); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function loaded(id, target) {
  for (let i = 0; i < 60; i++) {
    if (cancelled) throw new Error('Stopped.');
    const tab = await chrome.tabs.get(id);
    if (tab.status === 'complete') {
      const url = new URL(tab.url);
      if (url.hostname === 'www.instagram.com' && url.pathname.toLowerCase() === `/${target}/`) return;
      if (i > 5) throw new Error('Instagram redirected the page. Sign in or resolve its prompt before trying again.');
    }
    await delay(500);
  }
  throw new Error('Instagram did not finish loading.');
}
$('start').onclick = () => navigator.locks.request('followtidy-queue', { ifAvailable: true }, async lease => {
  if (!lease) { $('confirm').close(); status('A queue is already running in another FollowTidy tab.'); return; }
  if (!$('ack').checked || running) return;
  $('confirm').close();
  if (!hasExtension) { status('Automatic unfollowing requires installing the desktop extension. See START-HERE.html.'); return; }
  const queue = [...selected].sort(), runId = crypto.randomUUID();
  cancelled = false; lock(true); $('log').replaceChildren(); let completed = 0, skipped = 0;
  try {
    const { run } = await chrome.storage.local.get('run');
    if (run?.active && run.expires > Date.now()) throw new Error('Another queue is active. Stop it first or wait two minutes.');
    const tab = await chrome.tabs.create({ url: 'https://www.instagram.com/', active: true });
    const inject = async (name, inspectOnly) => {
      if (cancelled) return { outcome: 'stopped', submitted: false, message: 'Stopped.' };
      await chrome.storage.local.set({ run: { id: runId, active: true, expires: Date.now() + 120000 } });
      if (cancelled) { await chrome.storage.local.set({ run: { active: false } }); return { outcome: 'stopped', submitted: false, message: 'Stopped.' }; }
      const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: unfollowProfile, args: [name, runId, inspectOnly] });
      return results[0]?.result;
    };
    const totals = await runQueue(queue, {
      cancelled: () => cancelled,
      inspect: async name => { status(`Checking @${name} · ${completed} unfollowed · ${skipped} skipped`); await chrome.tabs.update(tab.id, { url: `https://www.instagram.com/${name}/` }); await loaded(tab.id, name); return inject(name, true); },
      execute: name => inject(name, false),
      report: async (name, result) => {
        const line = document.createElement('li'); line.textContent = `@${name}: ${result?.message || 'No result returned.'}`; $('log').append(line);
        if (result?.outcome === 'success') completed++;
        if (result?.outcome === 'skipped') skipped++;
        if (['success','skipped'].includes(result?.outcome)) selected.delete(name);
        render();
      },
      pause: async ms => { status(`${completed} unfollowed · ${skipped} skipped. Next account in ${ms / 1000} seconds…`); for (let elapsed = 0; elapsed < ms && !cancelled; elapsed += 500) await delay(500); }
    });
    status(`${totals.stopped ? 'Stopped' : 'Finished'}. ${completed} unfollowed · ${skipped} skipped.`);
  } catch (error) { status(`Queue stopped: ${completed} unfollowed · ${skipped} skipped. ${error.message}`); }
  finally {
    try {
      const { run } = await chrome.storage.local.get('run');
      if (run?.id === runId) await chrome.storage.local.set({ run: { active: false } });
    } finally { lock(false); }
  }
});
window.addEventListener('beforeunload', () => { if (running && hasExtension) chrome.storage.local.set({ run: { active: false } }); });
render();
