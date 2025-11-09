import { PDFDocument, StandardFonts, rgb, grayscale } from 'pdf-lib';

function fmtUsd(n) {
  try { return `$${Number(n).toLocaleString('en-US')}`; } catch { return `$${n}`; }
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

    const r = await fetch(apiUrl, { headers: { accept: 'application/json' } });
    if (!r.ok) {
      return res.status(r.status).json({ error: 'failed to fetch appraisal', status: r.status });
    }
    const data = await r.json();

    const pdf = await PDFDocument.create();
    let page = pdf.addPage([612, 792]); // Letter portrait
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);

    const pink = rgb(0.98, 0.14, 0.62);
    const gray = grayscale(0.6);

    const margin = 50;
    const lineGap = 6;
    const maxWidth = 612 - margin * 2;
    let y = 792 - margin;

    // Title
    const title = 'Lovepass Domain Appraisal';
    let size = 22;
    page.drawText(title, { x: margin, y: y - size, size, font: bold, color: rgb(0,0,0) });
    y -= size + 16;

    // Name + network
    const tag = `${data.name || name} • ${(data.network || net).toUpperCase()}`;
    size = 14;
    page.drawText(tag, { x: margin, y: y - size, size, font: regular, color: rgb(0.1,0.1,0.1) });
    y -= size + 18;

    // Estimated value
    const value = `Estimated Value: ${fmtUsd(data.appraisalUsd)}`;
    size = 28;
    page.drawText(value, { x: margin, y: y - size, size, font: bold, color: pink });
    y -= size + 14;

    // Confidence + score
    const meta = `${(data.confidence || '').charAt(0).toUpperCase() + (data.confidence || '').slice(1)} confidence • ${data.score ?? '?'} / 100`;
    size = 12;
    page.drawText(meta, { x: margin, y: y - size, size, font: regular, color: rgb(0.2,0.2,0.2) });
    y -= size + 22;

    // Section: Why this has value
    const h1 = 'Why This Has Value';
    size = 16;
    page.drawText(h1, { x: margin, y: y - size, size, font: bold, color: rgb(0,0,0) });
    y -= size + 10;

    const signals = Array.isArray(data.signals) ? data.signals : [];
    size = 11;
    for (const s of signals) {
      const lines = wrapText(`• ${s}`, regular, size, maxWidth);
      for (const ln of lines) {
        if (y - size < margin + 40) {
          page = pdf.addPage([612, 792]);
          y = 792 - margin;
          page.drawText('Lovepass Domain Appraisal (cont.)', { x: margin, y: y - 12, size: 12, font: bold, color: gray });
          y -= 12 + 14;
        }
        page.drawText(ln, { x: margin, y: y - size, size, font: regular, color: rgb(0.1,0.1,0.1) });
        y -= size + lineGap;
      }
    }

    y -= 12;

    // Section: What to do next
    const h2 = 'What To Do Next';
    size = 16;
    page.drawText(h2, { x: margin, y: y - size, size, font: bold, color: rgb(0,0,0) });
    y -= size + 10;

    const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
    size = 11;
    for (const s of suggestions) {
      const lines = wrapText(`• ${s}`, regular, size, maxWidth);
      for (const ln of lines) {
        if (y - size < margin + 40) {
          page = pdf.addPage([612, 792]);
          y = 792 - margin;
          page.drawText('Lovepass Domain Appraisal (cont.)', { x: margin, y: y - 12, size: 12, font: bold, color: gray });
          y -= 12 + 14;
        }
        page.drawText(ln, { x: margin, y: y - size, size, font: regular, color: rgb(0.1,0.1,0.1) });
        y -= size + lineGap;
      }
    }

    // Footer
    const footer = 'Powered by Lovepass Labs';
    page.drawText(footer, { x: margin, y: 24, size: 10, font: regular, color: gray });

    const bytes = await pdf.save();
    const filename = `${sanitizeFilename(data.name || name)}-appraisal.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return res.status(200).send(Buffer.from(bytes));
  } catch (e) {
    return res.status(500).json({ error: 'failed to generate pdf', details: e?.message || String(e) });
  }
}
