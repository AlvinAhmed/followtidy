export function username(value) {
  const name = String(value ?? '').trim().replace(/^@/, '').toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(name) ? name : null;
}

export function readExport(data, kind) {
  const entries = kind === 'following' ? data?.relationships_following : data;
  if (!Array.isArray(entries)) throw new Error(`This is not a ${kind} JSON export.`);
  const names = [];
  for (const entry of entries) {
    if (!entry || !Array.isArray(entry.string_list_data)) throw new Error(`Unrecognized ${kind} export entry.`);
    let candidate = entry.string_list_data[0]?.value || entry.title;
    if (!candidate && entry.string_list_data[0]?.href) {
      const url = new URL(entry.string_list_data[0].href);
      if (!['www.instagram.com', 'instagram.com'].includes(url.hostname)) throw new Error('Unexpected profile address.');
      candidate = url.pathname.split('/').filter(Boolean).pop();
    }
    const name = username(candidate);
    if (!name) throw new Error('An export entry has an invalid username.');
    names.push(name);
  }
  return [...new Set(names)].sort();
}

export function nonFollowers(following, followers) {
  const followerSet = new Set(followers);
  return [...new Set(following)].filter(name => !followerSet.has(name)).sort();
}

export function readManual(text) {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  const names = parts.map(username);
  if (names.some(name => !name)) throw new Error('Use usernames only, separated by commas or new lines.');
  return [...new Set(names)].sort();
}
