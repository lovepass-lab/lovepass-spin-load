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

export default async function handler(req, res) {
  try {
    const { name, net } = req.query;

    if (!name) {
      return res.status(400).json({ error: 'name is required, e.g. ?name=water.eth&net=sepolia' });
    }

    const isMainnet = net === 'mainnet' || net === '1';
    const score = baseScoreFromName(name);
    const usd = priceFromScore(score, isMainnet);

    return res.status(200).json({
      name,
      network: isMainnet ? 'mainnet' : (net || 'sepolia'),
      appraisalUsd: usd,
      confidence: score >= 70 ? 'high' : score >= 50 ? 'medium' : 'low',
      score,
      signals: signalsFor(name, score, isMainnet),
      suggestions: ideasFor(name),
      source: 'lovepass-appraisal-v1'
    });
  } catch (e) {
    console.error('appraisal error', e);
    return res.status(500).json({ error: 'internal error', details: e.message });
  }
}
