export default function handler(req, res) {
  // Normalization helper (same as email route)
  const normalize = (s) => {
    let v = String(s || '');
    v = v.replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, '-');
    v = v.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
    v = v.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
    v = v.replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ');
    v = v.trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    v = v.replace(/\s+/g, ' ');
    return v;
  };

  // Accept token via header and optional query for testing
  const providedRaw = req.headers['x-auth-token'] || req.query.token || '';
  const provided = normalize(providedRaw);
  const serverRaw = process.env.INBOUND_SECRET || '';
  const server = normalize(serverRaw);
  const set = !!serverRaw;
  const matches = set && provided && provided === server;

  // Do not leak the real secret
  return res.status(200).json({
    ok: true,
    set,
    providedLength: provided.length,
    serverLength: server.length,
    providedFirstCode: provided.length ? provided.codePointAt(0) : null,
    providedLastCode: provided.length ? provided.codePointAt(provided.length - 1) : null,
    serverFirstCode: server.length ? server.codePointAt(0) : null,
    serverLastCode: server.length ? server.codePointAt(server.length - 1) : null,
    matches
  });
}
