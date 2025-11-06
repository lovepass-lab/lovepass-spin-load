import React, { useState } from 'react';

export default function Settings() {
  const [ipfsToken, setIpfsToken] = useState<string>('');
  return (
    <section>
      <h2>Settings</h2>
      <label>
        IPFS API Token
        <input value={ipfsToken} onChange={(e)=>setIpfsToken(e.target.value)} placeholder="web3.storage / Pinata token" />
      </label>
      <p>Token is stored locally in your browser.</p>
    </section>
  );
}
