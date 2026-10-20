// Personal edition: no quota, account service, subscription, or billing calls.
export async function runQueue(names, io) {
  const totals = { succeeded: 0, skipped: 0, stopped: false };
  for (let index = 0; index < names.length; index++) {
    const name = names[index];
    if (io.cancelled()) { totals.stopped = true; break; }
    let result = await io.inspect(name);
    if (result?.outcome === 'ready') {
      if (io.cancelled()) { totals.stopped = true; break; }
      result = await io.execute(name);
    }
    await io.report(name, result);
    if (result?.outcome === 'skipped') totals.skipped++;
    else if (result?.outcome === 'success') totals.succeeded++;
    else throw new Error(result?.message || 'No verifiable result. The queue stopped.');
    if (index < names.length - 1) await io.pause(result.outcome === 'skipped' ? 2000 : 30000, totals);
  }
  if (io.cancelled()) totals.stopped = true;
  return totals;
}
