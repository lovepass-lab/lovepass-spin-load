import OpenAI from 'openai';
// legacy-next/pages/api/appraisal.js
 
// super-light ENS-ish appraisal endpoint for Lovepass
// returns JSON shaped for your Lovable page

const MAINNET_MULTIPLIER = 1.0;
const TESTNET_MULTIPLIER = 0.12; // testnet / off-market

// very rough buckets taken from the reddit logic you pasted
function baseScoreFromName(name) {
  if (!name) return 0;
  const n = name.toLowerCase().replace('.eth', '');

  // 1) length bonus
  let score = 0;
  if (n.length <= 3) score += 45;         // 3-char and under = strong
  else if (n.length <= 4) score += 35;
  else if (n.length <= 6) score += 28;
  else score += 20;

  // 2) pure keyword bonus (very basic)
  const high = [
    'water','beer','phone','bank','loan','music',
    'art','game','games','ai','nft','nfts','crypto',
    'defi','dex','swap','wallet'
  ];
  if (high.includes(n)) score += 35;

  // 3) dash / multiword penalty
  if (n.includes('-') || n.includes(' ')) score -= 10;

  // 4) “brandable” if looks clean
  if (/^[a-z0-9]+$/.test(n)) score += 5;

  // clamp
  if (score < 0) score = 0;
  if (score > 100) score = 100;
  return score;
}

function priceFromScore(score, isMainnet) {
  // VERY conservative base, we’re not trying to fake real sales yet
  const baseUsd =
    score >= 80 ? 25000 :
    score >= 70 ? 10000 :
    score >= 60 ? 5500  :
    score >= 50 ? 2500  :
    score >= 40 ? 1200  :
    score >= 30 ? 500   :
    150;

  const mult = isMainnet ? MAINNET_MULTIPLIER : TESTNET_MULTIPLIER;
  return Math.round(baseUsd * mult);
}

function signalsFor(name, score, isMainnet) {
  const s = [];
  s.push(`Name analyzed: ${name}`);
  s.push(`Length-based desirability score: ${score}/100`);

  if (!isMainnet) {
    s.push('Network: Testnet / Off-market ENS (priced as speculative)');
  } else {
    s.push('Network: Mainnet ENS (higher commercial intent)');
  }

  const lower = name.toLowerCase();
  if (['water','beer','bank','phone','art','music','crypto','nft','ai','game','games'].includes(lower.replace('.eth',''))) {
    s.push('Keyword is short, global and non-branded → typically good for marketplace / gateway / tokenization concepts.');
  }

  if (name.length <= 4) {
    s.push('Very short ENS → good for identity, wallets, and social flex.');
  }

  return s;
}

function ideasFor(name) {
  const n = name.toLowerCase().replace('.eth','');
  const ideas = [
    `Create an onchain profile at app.ens.domains for ${name} so wallets & explorers show richer data.`,
    `Point ${name} to an IPFS site that explains what the name is for (Lovepass can render it).`,
    `List ${name} inside your own extension’s VIP hovercard so people see its story.` 
  ];

  if (n === 'water') {
    ideas.push('Water-based DAO: fund clean water / wells, governance via subdomains (dao.water.eth).');
    ideas.push('Tokenize bottled water batches and map them to subdomains (batch123.water.eth).');
    ideas.push('“Water paylink”: accept ETH/stablecoin donations at water.eth and show donors onchain.');
    ideas.push('Directory of water-related web3 projects (desalination, rain capture, wells) hosted under water.eth.');
  }

  return ideas;
}

// --- v2 deterministic helpers (numbers only; no AI) ---
function analyzeNameV2(raw) {
  const label = String(raw || '').toLowerCase().replace(/\.eth$/, '');
  return {
    label,
    len: label.length,
    hasDigits: /\d/.test(label),
    hasHyphen: /-/.test(label),
    isCleanWord: /^[a-z]+$/.test(label)
  };
}

function scoreV2(name) {
  const m = analyzeNameV2(name);
  let score = 10; // baseline
  if (m.len <= 3) score += 50;
  else if (m.len === 4) score += 40;
  else if (m.len <= 6) score += 30;
  else if (m.len <= 10) score += 20;
  else score += 10;
  if (m.hasDigits) score -= 8;
  if (m.hasHyphen) score -= 12;
  if (m.isCleanWord) score += 5; else score -= 5;
  if (score < 0) score = 0;
  if (score > 100) score = 100;
  return { score, meta: m };
}

function priceFromScoreV2(score, isMainnet) {
  // 80–100 → ~$25k, 60–79 → ~$10k, 40–59 → ~$3.5k, 20–39 → ~$500, 0–19 → ~$75
  const baseUsd =
    score >= 80 ? 25000 :
    score >= 60 ? 10000 :
    score >= 40 ? 3500  :
    score >= 20 ? 500   :
    75;
  const mult = isMainnet ? MAINNET_MULTIPLIER : TESTNET_MULTIPLIER;
  return Math.round(baseUsd * mult);
}

function defaultTextV2(name, score, isMainnet, meta) {
  const signals = [
    `Name analyzed: ${name}`,
    `Length: ${meta.len} (${meta.isCleanWord ? 'clean word' : 'mixed characters'})`,
    `Digits: ${meta.hasDigits ? 'yes' : 'no'} • Hyphen: ${meta.hasHyphen ? 'yes' : 'no'}`,
    isMainnet ? 'Network: Mainnet (higher commercial intent)' : 'Network: Testnet / off-market (conservative)'
  ];
  const suggestions = [
    `Create an onchain profile at app.ens.domains for ${name}.`,
    `Publish a simple site for ${name} (IPFS/ENS) explaining purpose.`,
    `Showcase ${name} in your Lovepass extension.`
  ];
  return { signals, suggestions };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "method not allowed" });
  try {
    const { name, net } = req.query;

    if (!name) {
      return res.status(400).json({ error: 'name is required, e.g. ?name=water.eth&net=sepolia' });
    }

    const isMainnet = net === 'mainnet' || net === '1';
    const networkStr = isMainnet ? 'mainnet' : (net || 'sepolia');
    const { score, meta } = scoreV2(name);
    const usd = priceFromScoreV2(score, isMainnet);
    const confidence = score >= 70 ? 'high' : score >= 35 ? 'medium' : 'low';

    // Default text (no AI)
    let { signals, suggestions } = defaultTextV2(name, score, isMainnet, meta);
    let source = 'lovepass-appraisal-v2-fallback';

    // Optional AI: generate text only (keep numbers deterministic)
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      try {
        const openai = new OpenAI({ apiKey });
        const payload = {
          name,
          network: networkStr,
          score,
          appraisalUsd: usd,
          hasDigits: meta.hasDigits,
          hasHyphen: meta.hasHyphen,
          isShortWord: meta.len <= 6,
          lengthCategory: meta.len <= 3 ? 'very_short' : meta.len <= 4 ? 'short' : meta.len <= 6 ? 'medium' : meta.len <= 10 ? 'long' : 'very_long',
          networkBonusApplied: isMainnet,
        };
        const r = await openai.chat.completions.create({
          model: 'gpt-4.1-mini',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'You generate short, clear explanations for ENS name appraisals. Reply with JSON only: {"signals": string[], "suggestions": string[]}. Do not change numbers.' },
            { role: 'user', content: JSON.stringify(payload) }
          ]
        });
        const content = r?.choices?.[0]?.message?.content || '{}';
        const obj = JSON.parse(content);
        if (Array.isArray(obj?.signals) && Array.isArray(obj?.suggestions)) {
          signals = obj.signals.map(String);
          suggestions = obj.suggestions.map(String);
          source = 'lovepass-appraisal-v2-ai';
        }
      } catch (e) {
        // fall back silently
      }
    }

    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=60");
    return res.status(200).json({
      name,
      network: networkStr,
      appraisalUsd: usd,
      confidence,
      score,
      signals,
      suggestions,
      source
    });
  } catch (e) {
    console.error('appraisal error', e);
    return res.status(500).json({ error: 'internal error', details: e.message });
  }
}
