import { chromium } from './lib-axe.mjs';
import { createServer } from 'node:http'; import { readFileSync, existsSync, mkdirSync } from 'node:fs'; import { extname, join } from 'node:path';
const ROOT = new URL('../prototype-a/', import.meta.url).pathname; const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = createServer((q, r) => { const p = join(ROOT, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]); if (!existsSync(p)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[extname(p)] }); r.end(readFileSync(p)); }).listen(5187);
const OUT = new URL('./results/quick/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); const errs = [];
for (const [wn, w, h, full] of [['d', 1366, 900, true], ['m', 390, 844, true]]) { const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500 }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e)));
  for (const [role, hash, n] of [['productor', '#/predios', 'predios'], ['productor', '#/mapa', 'mapa'], ['admin', '#/hoy', 'hoy']]) { await p.goto(`http://localhost:5187/?role=${role}&theme=light${hash}`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(n === 'mapa' ? 3500 : 800); await p.screenshot({ path: `${OUT}${wn}-${n}.jpg`, type: 'jpeg', quality: 55, fullPage: full }); } await ctx.close(); }
await b.close(); srv.close(); console.log('errores', errs);
