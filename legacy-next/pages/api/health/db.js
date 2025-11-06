import { init, countMessages, getDriverInfo } from '../../../lib/db/adapter.js';

export default async function handler(req, res) {
  try {
    await init();

    let rows = 0;
    let err = null;
    try {
      rows = await countMessages({ ens: 'vaped.eth', net: 'sepolia' });
    } catch (e) {
      err = e?.message || 'count failed';
    }

    const { driver } = getDriverInfo();
    const body = { ok: !err, driver, rows };
    if (err) body.error = err;
    return res.status(err ? 500 : 200).json(body);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'database check failed' });
  }
}
