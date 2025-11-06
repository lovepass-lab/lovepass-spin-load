import 'dotenv/config';

const BASE = process.env.TEST_BASE || 'http://localhost:3000';
const SECRET = process.env.INBOUND_SECRET || 'dev-shared-secret';

const to = 'vaped@lovepass.eth';
const body = {
  to,
  from: 'alice@example.com',
  subject: 'Hello ENS',
  text: 'Hi from Lovepass',
  net: 'sepolia'
};

async function main() {
  // 1) POST /api/email
  const postRes = await fetch(`${BASE}/api/email` , {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': SECRET
    },
    body: JSON.stringify(body)
  }).catch(e => ({ ok:false, status:0, json: async()=>({ error:String(e) }) }));

  const postJson = await (postRes.json?.() ?? Promise.resolve({ error: 'no json' }));
  console.log('POST /api/email ->', postRes.status, postJson);

  // 2) GET /api/mailbox?name=<ens>&net=<net>
  const name = to.split('@')[0] + '.eth';
  const inboxRes = await fetch(`${BASE}/api/mailbox?name=${encodeURIComponent(name)}&net=${encodeURIComponent(body.net)}` )
    .catch(e => ({ ok:false, status:0, json: async()=>({ error:String(e) }) }));
  const inboxJson = await (inboxRes.json?.() ?? Promise.resolve({ error: 'no json' }));
  console.log('GET  /api/mailbox ->', inboxRes.status, inboxJson);
}

main().catch(err => {
  console.error('Test script error:', err);
  process.exit(1);
});
