import { useState, useEffect } from 'react';

// Temporary page to verify environment variable exposure
export default function EnvCheck() {
  const [clientEnv, setClientEnv] = useState(null);

  useEffect(() => {
    // Only check env vars on client-side to avoid hydration mismatch
    setClientEnv({
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_DEV_AUTH: process.env.NEXT_PUBLIC_DEV_AUTH,
      // These should be undefined on client-side:
      INBOUND_SECRET: process.env.INBOUND_SECRET,
      LOVEPASS_DB_PATH: process.env.LOVEPASS_DB_PATH,
    });
  }, []);

  if (!clientEnv) {
    return <div style={{ padding: 20 }}>Loading environment check...</div>;
  }

  const hasSecrets = clientEnv.INBOUND_SECRET || clientEnv.LOVEPASS_DB_PATH;

  return (
    <div style={{ padding: 20, fontFamily: 'monospace' }}>
      <h2>Environment Variable Check</h2>
      <p>This page shows what env vars are exposed to the client:</p>
      <pre>{JSON.stringify(clientEnv, null, 2)}</pre>
      <p><strong>Security Check:</strong></p>
      <ul>
        <li style={{ color: clientEnv.NEXT_PUBLIC_APP_URL ? 'green' : 'red' }}>
          {clientEnv.NEXT_PUBLIC_APP_URL ? '✅' : '❌'} NEXT_PUBLIC_APP_URL: {clientEnv.NEXT_PUBLIC_APP_URL ? 'visible' : 'missing'}
        </li>
        <li style={{ color: clientEnv.NEXT_PUBLIC_DEV_AUTH ? 'green' : 'red' }}>
          {clientEnv.NEXT_PUBLIC_DEV_AUTH ? '✅' : '❌'} NEXT_PUBLIC_DEV_AUTH: {clientEnv.NEXT_PUBLIC_DEV_AUTH ? 'visible' : 'missing'}
        </li>
        <li style={{ color: hasSecrets ? 'red' : 'green' }}>
          {hasSecrets ? '❌' : '✅'} Server secrets: {hasSecrets ? 'EXPOSED (BAD!)' : 'hidden (good)'}
        </li>
      </ul>
      {hasSecrets && (
        <div style={{ background: '#fee', padding: 10, border: '1px solid #f99', marginTop: 10 }}>
          <strong>⚠️ Security Issue:</strong> Server secrets are exposed to the client!
        </div>
      )}
    </div>
  );
}
