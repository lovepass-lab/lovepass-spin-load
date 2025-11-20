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

function bandInfoFromScoreV2(score) {
  // Bands and narrative labels used to derive a range for headline.
  // 80–100 → blue-chip generic (anchor ~25k, range 15k–40k)
  // 60–79  → premium generic  (anchor ~10k, range 5k–18k)
  // 40–59  → solid brandable  (anchor ~3.5k, range 1k–7k)
  // 20–39  → speculative       (anchor ~500,  range 200–1k)
  // 0–19   → low-liquidity     (anchor ~75,   range 0–200)
  if (score >= 80) return { bandName: 'blue-chip generic', anchor: 25000, low: 15000, high: 40000 };
  if (score >= 60) return { bandName: 'premium generic', anchor: 10000, low:  5000, high: 18000 };
  if (score >= 40) return { bandName: 'solid brandable', anchor:  3500, low:  1000, high:  7000 };
  if (score >= 20) return { bandName: 'speculative',      anchor:   500, low:   200, high:  1000 };
  return { bandName: 'low-liquidity', anchor: 75, low: 0, high: 200 };
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

async function getAiNarrative(params) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const openai = new OpenAI({ apiKey });
  const { name, network, score, appraisalUsd, rangeLowUsd, rangeHighUsd, bandName, metrics } = params;
  const payload = { name, network, score, appraisalUsd, rangeLowUsd, rangeHighUsd, bandName, metrics };
  const r = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You are an ENS domain appraisal engine for Lovepass Labs. Output STRICT JSON only with keys: executiveSummary, scorecardNotes, comps, commentary, methodology. Each scorecardNotes value is a single sentence. Comps are illustrative and safe.' },
      { role: 'user', content: JSON.stringify(payload) }
    ]
  });
  const content = r?.choices?.[0]?.message?.content || '{}';
  try { return JSON.parse(content); } catch { return null; }
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
    const confidenceLabel = confidence.charAt(0).toUpperCase() + confidence.slice(1);

    // Headline band and ranges (apply network multiplier to ranges as well)
    const band = bandInfoFromScoreV2(score);
    const mult = isMainnet ? MAINNET_MULTIPLIER : TESTNET_MULTIPLIER;
    const rangeLowUsd = Math.round(band.low * mult);
    const rangeHighUsd = Math.round(band.high * mult);

    // Header labels
    const networkLabel = networkStr === 'mainnet'
      ? 'Ethereum Mainnet'
      : networkStr === 'sepolia'
        ? 'Sepolia (Off-Market)'
        : `Network: ${networkStr}`;
    const generatedAtIso = new Date().toISOString();
    const reportId = `LP-APP-${Date.now()}`;

    // Metric helpers
    function clamp01to100(n){ return Math.max(0, Math.min(100, Math.round(n))); }
    const m1 = clamp01to100(score + (meta.len <= 3 ? 12 : meta.len <= 4 ? 8 : meta.len <= 6 ? 4 : meta.len <= 10 ? 0 : -6));
    const m2 = clamp01to100(score + (meta.isCleanWord ? 6 : -6) + (meta.hasHyphen ? -10 : 0) + (meta.hasDigits ? -6 : 0));
    const m3 = clamp01to100(score + (meta.len <= 6 ? 6 : 0) + (meta.isCleanWord ? 4 : -4));
    const m4 = clamp01to100(score + (isMainnet ? 8 : -12) + (meta.hasHyphen ? -6 : 0) + (meta.hasDigits ? -4 : 0));
    const m5 = clamp01to100(60 + (isMainnet ? 20 : -15));

    const metrics = [
      { label: 'Length & Simplicity', score: m1, note: 'Shorter, simpler labels are easier to type and remember. This metric rewards compact, clean labels and penalizes very long strings.' },
      { label: 'Memorability & Brandability', score: m2, note: 'Letters-only and single-word labels read better and brand more cleanly. Digits or hyphens reduce recall and increase friction.' },
      { label: 'Commercial Scope', score: m3, note: 'Broader, generic terms can anchor products, experiences, or categories. Compact and clean labels tend to support wider use.' },
      { label: 'Liquidity / Buyer Pool', score: m4, note: 'Liquidity tends to rise with clean labels on mainnet and fall for hyphenated or numeric strings and off-market networks.' },
      { label: 'Extension & Network', score: m5, note: 'The .eth namespace has unique utility for identity and routing; mainnet typically carries more commercial intent than testnets.' }
    ];

    // Last sale (placeholder)
    const lastSale = {
      known: false,
      description: 'No verified onchain sale data was available at the time of this report.'
    };

    // Illustrative comps
    const comps = [
      { label: 'Comparable 1', domain: 'beer.eth', tld: 'eth', priceUsd: 12000, source: 'illustrative', year: 2023, commentary: 'Illustrative comparable in the same band based on typical ENS / domain market behavior.' },
      { label: 'Comparable 2', domain: 'music.eth', tld: 'eth', priceUsd: 9500, source: 'illustrative', year: 2022, commentary: 'Illustrative comparable in the same band based on typical ENS / domain market behavior.' },
      { label: 'Comparable 3', domain: 'loan.eth', tld: 'eth', priceUsd: 15000, source: 'illustrative', year: 2021, commentary: 'Illustrative comparable in the same band based on typical ENS / domain market behavior.' }
    ];

    // Deterministic narrative
    let commentary = `This appraisal places ${name} in the “${band.bandName}” band with a headline estimate of $${usd.toLocaleString('en-US')}. ` +
      `The label’s length and cleanliness, combined with the ${networkLabel.toLowerCase()}, indicate a buyer pool consistent with similar names. ` +
      `The range of $${rangeLowUsd.toLocaleString('en-US')}–$${rangeHighUsd.toLocaleString('en-US')} reflects recent market behavior for comparable quality.`;
    commentary += ' Liquidity is generally stronger for clean, single-word labels and weaker for strings containing hyphens or digits.';
    let methodology = 'The estimate is derived from deterministic heuristics: label length, presence of digits and hyphens, and letters-only cleanliness. ' +
      'These inputs roll into a 0–100 score which maps to value bands with anchored price points. ' +
      'Mainnet vs. testnet is applied as a conservative multiplier to reflect marketability. ' +
      'No external sales data or AI is used to alter the numeric estimate; AI may be used only to refine text.';

    const report = {
      header: {
        ensName: name,
        networkLabel,
        reportId,
        generatedAtIso
      },
      headline: {
        estimatedUsd: usd,
        rangeLowUsd,
        rangeHighUsd,
        confidenceLabel,
        bandName: band.bandName
      },
      metrics,
      lastSale,
      comps,
      commentary,
      methodology
    };

    let { signals, suggestions } = defaultTextV2(name, score, isMainnet, meta);
    let source = 'lovepass-appraisal-v2-fallback';
    try {
      const ai = await getAiNarrative({
        name,
        network: networkStr,
        score,
        appraisalUsd: usd,
        rangeLowUsd,
        rangeHighUsd,
        bandName: band.bandName,
        metrics: metrics.map(m => ({ label: m.label, score: m.score }))
      });
      if (ai) {
        if (typeof ai.executiveSummary === 'string' && ai.executiveSummary.trim()) {
          report.executiveSummary = ai.executiveSummary.trim();
          report.commentary = ai.executiveSummary.trim();
        }
        if (ai.scorecardNotes && typeof ai.scorecardNotes === 'object') {
          const notes = ai.scorecardNotes;
          const map = {
            'Length & Simplicity': 'lengthSimplicity',
            'Memorability & Brandability': 'memorabilityBrandability',
            'Commercial Scope': 'commercialScope',
            'Liquidity / Buyer Pool': 'liquidityBuyerPool',
            'Extension & Network': 'extensionNetwork'
          };
          for (const m of metrics) {
            const key = map[m.label] || '';
            if (key && typeof notes[key] === 'string') m.note = notes[key];
          }
          const scorecard = {
            lengthSimplicity: { score: metrics[0]?.score ?? 0, note: notes.lengthSimplicity || '' },
            memorabilityBrandability: { score: metrics[1]?.score ?? 0, note: notes.memorabilityBrandability || '' },
            commercialScope: { score: metrics[2]?.score ?? 0, note: notes.commercialScope || '' },
            liquidityBuyerPool: { score: metrics[3]?.score ?? 0, note: notes.liquidityBuyerPool || '' },
            extensionNetwork: { score: metrics[4]?.score ?? 0, note: notes.extensionNetwork || '' },
            overallNote: typeof notes.overallNote === 'string' ? notes.overallNote : ''
          };
          report.scorecard = scorecard;
        }
        if (Array.isArray(ai.comps) && ai.comps.length) {
          const mapped = ai.comps.map(c => ({
            domain: String(c.domain || c.label || '').split(' ')[0] || '',
            tld: c.tld || 'eth',
            priceUsd: c.priceUsd != null ? Math.round(Number(c.priceUsd)) : (c.approxPriceUsd != null ? Math.round(Number(c.approxPriceUsd)) : undefined),
            source: c.source || 'illustrative',
            year: c.year != null ? Number(c.year) : undefined,
            commentary: c.note || c.commentary || ''
          }));
          report.comps = mapped;
        }
        if (typeof ai.commentary === 'string' && ai.commentary.trim()) report.commentary = ai.commentary.trim();
        if (typeof ai.methodology === 'string' && ai.methodology.trim()) report.methodology = ai.methodology.trim();
        source = 'lovepass-appraisal-v2-ai';
      }
    } catch {}

    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=60");
    return res.status(200).json({
      name,
      network: networkStr,
      appraisalUsd: usd,
      confidence,
      score,
      signals,
      suggestions,
      source,
      executiveSummary: report.executiveSummary || report.commentary,
      scorecard: report.scorecard || null,
      comps: report.comps || [],
      commentary: report.commentary,
      methodology: report.methodology,
      report
    });
  } catch (e) {
    console.error('appraisal error', e);
    return res.status(500).json({ error: 'internal error', details: e.message });
  }
}
