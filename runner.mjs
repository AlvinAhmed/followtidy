// This function is serialized by chrome.scripting; keep every dependency inside it.
export async function unfollowProfile(target, runId, inspectOnly = false) {
  let submitted = false;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const visible = el => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  const text = el => (el.innerText || el.textContent || '').trim();
  const buttons = root => [...root.querySelectorAll('button,[role="button"]')].filter(visible);
  const matching = (root, label) => buttons(root).filter(el => text(el) === label);
  const unique = items => items.length === 1 ? items[0] : null;
  const headers = () => [...document.querySelectorAll('header')].filter(el => visible(el) && [...el.querySelectorAll('h1,h2,[role="heading"]')].some(h => text(h).toLowerCase() === target));
  const fail = (outcome, message) => { const error = new Error(message); error.outcome = outcome; throw error; };
  const guard = async () => {
    const { run } = await chrome.storage.local.get('run');
    if (!run?.active || run.id !== runId || Date.now() > run.expires) fail('stopped', 'Stopped.');
    if (location.hostname !== 'www.instagram.com' || location.pathname.toLowerCase().replace(/\/$/, '') !== `/${target}`) fail('error', 'Unexpected page or sign-in redirect.');
    const body = document.body?.innerText || '';
    if (/try again later|we restrict certain activity|temporarily blocked|suspicious activity|confirm it.s you|something went wrong/i.test(body)) throw new Error('Instagram needs attention. Stopped.');
    if (document.querySelector('input[name="username"],input[name="password"]')) fail('error', 'Instagram sign-in is required.');
    // Only a complete error sentence on a page without the target profile header.
    const unavailable = body.split(/\r?\n/).some(line => /^(?:sorry,?\s+)?(?:this page (?:isn['’]t|is not) available|the page you requested could not be found)\.?$/i.test(line.trim()));
    if (!headers().length && unavailable) fail(submitted ? 'uncertain' : 'skipped', submitted ? 'Page became unavailable after submission. Check this profile manually.' : 'Skipped: Instagram says this page is unavailable.');
  };
  const waitFor = async get => {
    for (let i = 0; i < 40; i++) {
      await guard();
      const result = get();
      if (result) return result;
      await sleep(500);
    }
    throw new Error('Could not verify the expected Instagram controls. No further actions.');
  };
  try {
    if (!/^[a-z0-9._]{1,30}$/.test(target)) fail('error', 'Invalid username.');
    // Scope to a header explicitly naming this profile, excluding suggested accounts.
    const header = await waitFor(() => unique([...document.querySelectorAll('header')].filter(el => visible(el) && [...el.querySelectorAll('h1,h2,[role="heading"]')].some(h => text(h).toLowerCase() === target))));
    const control = await waitFor(() => {
      const following = unique(matching(header, 'Following'));
      if (following) return { following };
      return unique([...matching(header, 'Follow'), ...matching(header, 'Follow Back')]) ? { alreadyUnfollowed: true } : null;
    });
    if (control.alreadyUnfollowed) return { ok: true, outcome: 'skipped', submitted: false, message: 'Skipped: already not following this account.' };
    if (inspectOnly) return { ok: true, outcome: 'ready', submitted: false, message: 'Profile verified.' };
    await guard(); control.following.click();
    const dialog = await waitFor(() => unique([...document.querySelectorAll('[role="dialog"]')].filter(el => visible(el) && matching(el, 'Unfollow').length === 1)));
    await guard();
    const unfollow = unique(matching(dialog, 'Unfollow'));
    if (!unfollow) throw new Error('Unfollow control changed. Stopped.');
    await chrome.storage.local.set({ submittedOperation: { runId, target, at: Date.now() } });
    await guard(); submitted = true; unfollow.click();
    await waitFor(() => {
      const current = [...document.querySelectorAll('header')].filter(el => visible(el) && [...el.querySelectorAll('h1,h2,[role="heading"]')].some(h => text(h).toLowerCase() === target));
      const h = unique(current);
      return h && matching(h, 'Following').length === 0 && unique([...matching(h, 'Follow'), ...matching(h, 'Follow Back')]);
    });
    return { ok: true, outcome: 'success', submitted, message: 'Unfollowed — profile now shows Follow.' };
  } catch (error) {
    const outcome = submitted ? 'uncertain' : error.outcome || 'error';
    return { ok: outcome === 'skipped', outcome, submitted, message: error.message };
  }
}
