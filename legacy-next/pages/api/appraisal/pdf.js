import { PDFDocument, StandardFonts, rgb, grayscale, degrees } from 'pdf-lib';

function fmtUsd(n) {
  try { return `$${Number(n).toLocaleString('en-US')}`; } catch { return `$${n}`; }
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return String(iso || '');
  }
}

function sanitizeFilename(name) {
  return String(name || 'appraisal').replace(/[^a-z0-9_.-]+/gi, '-');
}

function wrapText(text, font, size, maxWidth) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    const width = font.widthOfTextAtSize(test, size);
    if (width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Draw wrapped text to the page and return the updated y-coordinate.
function drawWrappedText(page, text, { x, y, maxWidth, lineHeight, font, size = 11, color = rgb(0.1,0.1,0.1) }) {
  const lines = wrapText(text, font, size, maxWidth);
  for (const ln of lines) {
    page.drawText(ln, { x, y: y - size, size, font, color });
    y -= (size + (lineHeight ?? 4));
  }
  return y;
}

function drawSectionTitle(page, fonts, text, dims, y, size = 16) {
  const { margin } = dims;
  page.drawText(text, { x: margin, y: y - size, size, font: fonts.bold, color: rgb(0,0,0) });
  return y - (size + 8);
}

function drawLabelValueLine(page, fonts, label, value, dims, y, opts = {}) {
  const { width, margin } = dims;
  const labelSize = opts.labelSize ?? 11;
  const valueSize = opts.valueSize ?? 12;
  const colX = opts.colX ?? (margin + 150);
  const labelColor = opts.labelColor ?? rgb(0,0,0);
  const valueColor = opts.valueColor ?? rgb(0.1,0.1,0.1);
  const lineGap = opts.lineGap ?? 10;
  page.drawText(`${label}:`, { x: margin, y: y - labelSize, size: labelSize, font: fonts.bold, color: labelColor });
  page.drawText(String(value), { x: colX, y: y - valueSize, size: valueSize, font: fonts.regular, color: valueColor });
  return y - (valueSize + lineGap);
}

function drawLeftRightLine(page, fonts, leftText, rightText, dims, y, size = 10, color = rgb(0.25,0.25,0.25)) {
  const { width, margin } = dims;
  page.drawText(leftText, { x: margin, y: y - size, size, font: fonts.regular, color });
  const rightW = fonts.regular.widthOfTextAtSize(rightText, size);
  page.drawText(rightText, { x: width - margin - rightW, y: y - size, size, font: fonts.regular, color });
  return y - (size + 8);
}

async function tryLoadLogo(pdf, baseUrl) {
  const candidates = ['/logo.png', '/lovepass.png', '/lovepass-logo.png', '/images/logo.png', '/img/logo.png', '/logo.jpg', '/lovepass-logo.jpg'];
  for (const path of candidates) {
    try {
      const r = await fetch(`${baseUrl}${path}`);
      if (!r.ok) continue;
      const bytes = new Uint8Array(await r.arrayBuffer());
      const ct = r.headers.get('content-type') || '';
      try {
        if (ct.includes('png')) return await pdf.embedPng(bytes);
        if (ct.includes('jpg') || ct.includes('jpeg')) return await pdf.embedJpg(bytes);
        // Try PNG by default
        return await pdf.embedPng(bytes);
      } catch {}
    } catch {}
  }
  return null; // fallback to text logo
}

function addHeader(page, fonts, header, dims, logoImage) {
  const { width, height, margin } = dims;
  const yTop = height - margin;
  const bigTitle = 'ETHEREUM DOMAIN APPRAISAL REPORT';
  const subFor = `FOR ${(header?.ensName || '').toUpperCase()}`;
  const subBy = 'BY LOVEPASS LABS LLC';

  // Centered logo if available
  let cursorY = yTop;
  if (logoImage) {
    const targetW = 160;
    const scale = targetW / logoImage.width;
    const w = targetW;
    const h = logoImage.height * scale;
    page.drawImage(logoImage, { x: (width - w) / 2, y: cursorY - h, width: w, height: h });
    cursorY -= (h + 16);
  } else {
    // Fallback brand text
    const brand = 'Lovepass';
    const bSize = 14;
    const bw = fonts.bold.widthOfTextAtSize(brand, bSize);
    page.drawText(brand, { x: (width - bw) / 2, y: cursorY - bSize, size: bSize, font: fonts.bold, color: rgb(0.1,0.1,0.1) });
    cursorY -= (bSize + 6);
  }

  const titleSize = 18;
  const titleW = fonts.bold.widthOfTextAtSize(bigTitle, titleSize);
  page.drawText(bigTitle, { x: (width - titleW) / 2, y: cursorY - 20, size: titleSize, font: fonts.bold, color: rgb(0,0,0) });
  cursorY -= 32;

  const subSize = 10;
  const subForW = fonts.bold.widthOfTextAtSize(subFor, subSize);
  page.drawText(subFor, { x: (width - subForW) / 2, y: cursorY - 12, size: subSize, font: fonts.bold, color: rgb(0.15,0.15,0.15) });
  cursorY -= 20;
  const subByW = fonts.bold.widthOfTextAtSize(subBy, subSize);
  page.drawText(subBy, { x: (width - subByW) / 2, y: cursorY - 12, size: subSize, font: fonts.bold, color: rgb(0.2,0.2,0.2) });
  cursorY -= 20;

  cursorY = drawLeftRightLine(
    page,
    fonts,
    `Report ID: ${header?.reportId || ''}`,
    `Date: ${formatDate(header?.generatedAtIso)}`,
    { width, height, margin },
    cursorY,
    10,
    rgb(0.25,0.25,0.25)
  );

  return cursorY - 2;
}

function addHeadline(page, fonts, header, headline, dims) {
  const { width, margin } = dims;
  let y = dims.y;

  const blockTitle = 'Facts:';
  page.drawText(blockTitle, { x: margin, y: y - 14, size: 14, font: fonts.bold, color: rgb(0,0,0) });
  y -= 22;

  const labelSize = 11;
  const valSize = 12;
  const lineGap = 10;
  const rows = [
    ['Domain', header.ensName || ''],
    ['Network', header.networkLabel || ''],
    ['Estimated Value', fmtUsd(headline.estimatedUsd)],
    ['Range', `${fmtUsd(headline.rangeLowUsd)} – ${fmtUsd(headline.rangeHighUsd)}`],
    ['Confidence', String(headline.confidenceLabel || '')]
  ];
  const colX = margin + 150;
  for (const [k,v] of rows) {
    y = drawLabelValueLine(page, fonts, k, v, { width, height: dims.height, margin }, y, { labelSize, valueSize: valSize, colX, labelColor: rgb(0,0,0), valueColor: rgb(0.1,0.1,0.1), lineGap });
  }

  return y;
}

function addQuickFacts(page, fonts, report, dims, y) {
  const { width, margin } = dims;
  page.drawText('Quick Facts:', { x: margin, y: y - 14, size: 14, font: fonts.bold, color: rgb(0,0,0) });
  y -= 20;
  const band = String(report?.headline?.bandName || '').toLowerCase();
  const liquidity = band.includes('blue') || band.includes('premium') ? 'High liquidity'
    : band.includes('solid') ? 'Moderate liquidity'
    : band.includes('speculative') ? 'Speculative liquidity'
    : band ? 'Low liquidity' : 'Not available yet';
  const facts = [
    ['Expiration', 'N/A'],
    ['Last Sale', report?.lastSale?.description || 'Not available yet'],
    ['Liquidity Profile', liquidity],
    ['Valuation Tier', report?.headline?.bandName || 'Not available yet']
  ];
  const indentMargin = margin + 10;
  const colX = margin + 190;
  for (const [k,v] of facts) {
    y = drawLabelValueLine(page, fonts, k, v, { width, height: dims.height, margin: indentMargin }, y, { labelSize: 11, valueSize: 12, colX, lineGap: 6, labelColor: rgb(0,0,0), valueColor: rgb(0.1,0.1,0.1) });
  }
  return y;
}

function addExecutiveSummary(page, fonts, summary, dims, y) {
  const { width, margin } = dims;
  page.drawText('Executive Summary:', { x: margin, y: y - 14, size: 14, font: fonts.bold, color: rgb(0,0,0) });
  y -= 20;
  y = drawWrappedText(page, String(summary || ''), { x: margin, y, maxWidth: width - margin * 2, lineHeight: 6, font: fonts.regular, size: 11 });
  return y;
}

function addWatermark(page, fonts, text, dims) {
  const { width } = dims;
  const y = 100;
  const mark = String(text || '').toUpperCase();
  const size = 26;
  const w = fonts.bold.widthOfTextAtSize(mark, size);
  page.drawText(mark, { x: (width - w) / 2, y, size, font: fonts.bold, color: grayscale(0.85) });
}

function addFooter(page, fonts, header, name, net, pageNumber, pageTotal, dims) {
  const { width, margin } = dims;
  const y = 26; // baseline
  const left = 'Powered by Lovepass Labs LLC';
  const ens = header?.ensName || name || '';
  const center = `https://lovepass.io/appraisal/${encodeURIComponent(ens)}`;
  const right = `${pageNumber}/${pageTotal}`;
  page.drawText(left, { x: margin, y, size: 10, font: fonts.regular, color: grayscale(0.6) });
  const centerW = fonts.regular.widthOfTextAtSize(center, 10);
  page.drawText(center, { x: (width - centerW) / 2, y, size: 10, font: fonts.regular, color: grayscale(0.6) });
  const rightW = fonts.regular.widthOfTextAtSize(right, 10);
  page.drawText(right, { x: width - margin - rightW, y, size: 10, font: fonts.regular, color: grayscale(0.6) });
}

function addBorderText(page, fonts, ensName, dims) {
  const { width, height, margin } = dims;
  const size = 8;
  const color = grayscale(0.75);
  const unit = String(ensName || '').trim() || 'ens.name';
  const token = `${unit} • `;
  function repeatToWidth(targetW) {
    let s = token;
    let w = fonts.regular.widthOfTextAtSize(s, size);
    while (w < targetW * 1.2) { s += token; w = fonts.regular.widthOfTextAtSize(s, size); }
    return s;
  }
  const topStr = repeatToWidth(width - margin * 2);
  page.drawText(topStr, { x: margin, y: height - margin - 6, size, font: fonts.regular, color });
  const bottomStr = repeatToWidth(width - margin * 2);
  page.drawText(bottomStr, { x: margin, y: margin + 6, size, font: fonts.regular, color });
  const sideStr = repeatToWidth(height - margin * 2);
  // Left side (bottom-to-top)
  page.drawText(sideStr, { x: margin + 6, y: margin, size, font: fonts.regular, color, rotate: degrees(90) });
  // Right side (top-to-bottom)
  page.drawText(sideStr, { x: width - margin - 6, y: height - margin, size, font: fonts.regular, color, rotate: degrees(-90) });
}

function addScorecard(ctx) {
  const { pdf, pageRef, fonts, metrics, dims, name, net, header, pageNumber } = ctx;
  let { page, y } = pageRef;
  const { margin, width, height } = dims;

  const title = 'Scorecard:';
  page.drawText(title, { x: margin, y: y - 16, size: 16, font: fonts.bold, color: rgb(0,0,0) });
  y -= 24;

  const lineGap = 6;
  for (const m of metrics) {
    // First line: bold label — regular score
    const label = `${m.label}: `;
    const size1 = 12;
    const labelW = fonts.bold.widthOfTextAtSize(label, size1);
    page.drawText(label, { x: margin, y: y - size1, size: size1, font: fonts.bold, color: rgb(0,0,0) });
    page.drawText(`${m.score}/100`, { x: margin + labelW, y: y - size1, size: size1, font: fonts.regular, color: rgb(0.15,0.15,0.15) });
    y -= size1 + 2;

    // Note (wrapped)
    const beforeY = y;
    y = drawWrappedText(page, m.note || '', { x: margin, y, maxWidth: width - margin * 2, lineHeight: 5, font: fonts.regular, size: 11 });
    y -= lineGap;

    // Pagination if needed before next metric
    if (y < margin + 80) {
      pageNumber.value += 1;
      page = pdf.addPage([width, height]);
      pageRef.page = page;
      y = height - margin;
      page.drawText('Scorecard (cont.)', { x: margin, y: y - 14, size: 14, font: fonts.bold, color: rgb(0,0,0) });
      y -= 22;
    }
  }
  pageRef.y = y;
}

function addLegalDisclaimer(ctx) {
  const { pageRef, fonts, dims } = ctx;
  let { page, y } = pageRef;
  const { margin, width } = dims;
  page.drawText('Legal Disclaimer:', { x: margin, y: y - 16, size: 16, font: fonts.bold, color: rgb(0,0,0) });
  y -= 22;
  const text = 'This report expresses an algorithmic appraisal opinion generated by the Lovepass Appraisal Engine using on-chain data and comparable market behavior. It is for informational purposes only and does not constitute financial, investment, or legal advice.';
  y = drawWrappedText(page, text, { x: margin, y, maxWidth: width - margin * 2, lineHeight: 5, font: fonts.regular, size: 10 });
  pageRef.y = y;
}

function addComps(ctx) {
  const { pdf, pageRef, fonts, lastSale, comps, dims, name, net, header, pageNumber } = ctx;
  let { page, y } = pageRef;
  const { margin, width, height } = dims;

  page.drawText('Historical ENS Sales:', { x: margin, y: y - 16, size: 16, font: fonts.bold, color: rgb(0,0,0) });
  y -= 22;
  const hsText = lastSale?.known
    ? (lastSale.description || 'Recorded onchain sale.')
    : (lastSale?.description || 'No onchain sale data available.');
  y = drawWrappedText(page, hsText, { x: margin, y, maxWidth: width - margin * 2, lineHeight: 4, font: fonts.regular, size: 11 });
  if (lastSale?.known) {
    const details = [];
    if (lastSale.priceUsd != null) details.push(`approx. ${fmtUsd(lastSale.priceUsd)}`);
    const dt = lastSale.date || lastSale.iso || lastSale.timestamp;
    if (dt) details.push(`date: ${formatDate(dt)}`);
    if (details.length) {
      const dline = `Details: ${details.join(' — ')}`;
      page.drawText(dline, { x: margin, y: y - 12, size: 11, font: fonts.regular, color: rgb(0.1,0.1,0.1) });
      y -= 16;
    }
  }
  

  if (y < margin + 80) {
    pageNumber.value += 1;
    page = pdf.addPage([width, height]);
    pageRef.page = page; y = height - margin;
  }

  page.drawText('Comparable Sales (Illustrative):', { x: margin, y: y - 16, size: 16, font: fonts.bold, color: rgb(0,0,0) });
  y -= 22;
  for (const c of comps || []) {
    const src = [c.source, c.year].filter(Boolean).join(' / ');
    const line1 = `${c.domain || ''} (TLD: ${c.tld || ''}) — ${c.priceUsd ? `approx. ${fmtUsd(c.priceUsd)}` : 'price n/a'} — ${src || 'market data'}`;
    page.drawText(line1, { x: margin, y: y - 12, size: 12, font: fonts.regular, color: rgb(0.1,0.1,0.1) });
    y -= 16;
    y = drawWrappedText(page, String(c.commentary || ''), { x: margin, y, maxWidth: width - margin * 2, lineHeight: 4, font: fonts.regular, size: 11 });
    y -= 8;
    if (y < margin + 80) {
      pageNumber.value += 1;
      page = pdf.addPage([width, height]);
      pageRef.page = page; y = height - margin;
      page.drawText('Comparable Sales (cont.)', { x: margin, y: y - 14, size: 14, font: fonts.bold, color: rgb(0,0,0) });
      y -= 22;
    }
  }
  pageRef.y = y;
}

function addCommentaryAndMethodology(ctx) {
  const { pdf, pageRef, fonts, commentary, methodology, dims, name, net, header, pageNumber } = ctx;
  let { page, y } = pageRef;
  const { margin, width, height } = dims;

  const sections = [
    { title: 'Commentary & Considerations:', body: commentary },
    { title: 'Methodology:', body: methodology }
  ];

  for (const s of sections) {
    page.drawText(s.title, { x: margin, y: y - 16, size: 16, font: fonts.bold, color: rgb(0,0,0) });
    y -= 22;
    y = drawWrappedText(page, String(s.body || ''), { x: margin, y, maxWidth: width - margin * 2, lineHeight: 5, font: fonts.regular, size: 11 });
    y -= 10;
    if (y < margin + 80) {
      pageNumber.value += 1;
      page = pdf.addPage([width, height]);
      pageRef.page = page; y = height - margin;
    }
  }
  pageRef.y = y;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  const name = String(req.query.name || '').trim();
  const net = String(req.query.net || 'mainnet').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const proto = String(req.headers['x-forwarded-proto'] || 'https');
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000');
    const baseUrl = `${proto}://${host}`;
    const params = new URLSearchParams({ name, net });
    const apiUrl = `${baseUrl}/api/appraisal?${params.toString()}`;
    let r;
    try {
      r = await fetch(apiUrl, { headers: { accept: 'application/json' } });
    } catch (e) {
      return res.status(500).json({ error: 'upstream_appraisal_failed', details: e?.message || String(e) });
    }
    if (!r.ok) {
      return res.status(500).json({ error: 'upstream_appraisal_failed', details: `status ${r.status}` });
    }
    const data = await r.json();

    const report = data?.report || null;
    if (!report) {
      return res.status(500).json({ error: 'upstream_appraisal_failed', details: 'missing report in appraisal JSON' });
    }

    const pdf = await PDFDocument.create();
    const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
    const fonts = { regular: regularFont, bold: boldFont };

    const width = 612; // Letter portrait width
    const height = 792; // Letter portrait height
    const margin = 50;
    let page = pdf.addPage([width, height]);
    let pageNumber = { value: 1 };
    let y = height - margin;
    const dims = { width, height, margin, y };

    // Try to load a logo from public; fallback to text branding within addHeader
    const logoImage = await tryLoadLogo(pdf, baseUrl).catch(() => null);

    // Page 1
    y = addHeader(page, fonts, report.header, { width, height, margin }, logoImage);
    dims.y = y;
    y = addHeadline(page, fonts, report.header, report.headline, { width, height, margin, y });
    y = addQuickFacts(page, fonts, report, { width, height, margin }, y);
    y = addExecutiveSummary(page, fonts, report.commentary || '', { width, height, margin }, y);
    addWatermark(page, fonts, report.header?.ensName || data.name || name, { width, height, margin });

    // Page 2: Scorecard, Historical Sale, Comps, Commentary & Methodology
    pageNumber.value += 1;
    page = pdf.addPage([width, height]);
    y = height - margin;
    const pageRef = { page, y };
    const ctxBase = { pdf, pageRef, fonts, dims: { width, height, margin }, name: data.name || name, net: data.network || net, header: report.header, pageNumber };

    addScorecard({ ...ctxBase, metrics: report.metrics || [] });
    addComps({ ...ctxBase, lastSale: report.lastSale || {}, comps: report.comps || [] });
    addCommentaryAndMethodology({ ...ctxBase, commentary: report.commentary || '', methodology: report.methodology || '' });
    addLegalDisclaimer({ ...ctxBase });

    // After all pages are created, add footers and border text with final totals
    const pages = pdf.getPages();
    const total = pages.length;
    for (let i = 0; i < total; i++) {
      const p = pages[i];
      addFooter(p, fonts, report.header, data.name || name, data.network || net, i + 1, total, { width, height, margin });
      addBorderText(p, fonts, report.header?.ensName || data.name || name, { width, height, margin });
    }

    const bytes = await pdf.save();
    const filename = `${sanitizeFilename(data.name || name)}-appraisal.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return res.status(200).send(Buffer.from(bytes));
  } catch (e) {
    console.error('PDF error', e);
    return res.status(500).json({ error: 'failed_to_generate_pdf', details: e?.message || String(e) });
  }
}
