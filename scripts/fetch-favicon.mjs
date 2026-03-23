/**
 * Fetch strykermediagroup.com HTML, find favicon link (or manifest), download and save to public/favicon.ico
 */
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE = 'https://strykermediagroup.com';

function get(url, binary = false) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0' } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = binary ? Buffer.concat(chunks) : Buffer.concat(chunks).toString('utf8');
        resolve({ body, statusCode: res.statusCode });
      });
    });
    req.on('error', reject);
  });
}

function resolveUrl(href) {
  if (!href || !href.trim()) return null;
  const s = href.trim();
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (s.startsWith('//')) return 'https:' + s;
  if (s.startsWith('/')) return BASE + s;
  return BASE + '/' + s.replace(/^\//, '');
}

async function main() {
  console.log('Fetching', BASE, '...');
  const { body } = await get(BASE);

  // Common patterns for favicon in HTML
  const patterns = [
    /<link[^>]+rel=["'](?:shortcut\s+)?icon["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut\s+)?icon["']/i,
    /<link[^>]+rel=["']apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  ];

  let faviconUrl = null;
  for (const re of patterns) {
    const m = body.match(re);
    if (m && m[1]) {
      faviconUrl = resolveUrl(m[1]);
      console.log('Found favicon URL:', faviconUrl);
      break;
    }
  }

  // Fallback: check manifest
  if (!faviconUrl) {
    const manifestMatch = body.match(/<link[^>]+rel=["']manifest["'][^>]+href=["']([^"']+)["']/i);
    if (manifestMatch && manifestMatch[1]) {
      const manifestUrl = resolveUrl(manifestMatch[1]);
      console.log('Fetching manifest', manifestUrl);
      const { body: manifestBody } = await get(manifestUrl);
      try {
        const manifest = JSON.parse(manifestBody);
        const icons = manifest.icons || [];
        const best = icons.sort((a, b) => (b.width || 0) - (a.width || 0))[0];
        if (best && best.src) faviconUrl = resolveUrl(best.src);
      } catch (_) {}
    }
  }

  // Fallback: standard paths
  if (!faviconUrl) {
    faviconUrl = BASE + '/favicon.ico';
    console.log('Trying default', faviconUrl);
  }

  const outPath = path.join(process.cwd(), 'public', 'favicon.ico');
  const res = await get(faviconUrl, true);
  if (res.statusCode !== 200) {
    console.error('Download failed:', res.statusCode);
    process.exit(1);
  }
  fs.writeFileSync(outPath, res.body);
  console.log('Saved to', outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
