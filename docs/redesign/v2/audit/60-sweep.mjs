// Barrido visual único de la propuesta A final: capturas por ancho para revisarlas en hojas de contacto.
import { chromium } from './lib-axe.mjs';
import { createServer } from 'node:http'; import { readFileSync, existsSync, mkdirSync } from 'node:fs'; import { extname, join } from 'node:path';
const dir = process.argv[2] ?? '../prototype-a/'; const out = process.argv[3] ?? 'sweep';
const ROOT = new URL(dir, import.meta.url).pathname; const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = createServer((q, r) => { const p = join(ROOT, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]); if (!existsSync(p)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[extname(p)] }); r.end(readFileSync(p)); }).listen(5190);
const OUT = new URL(`./results/${out}/`, import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const S = [['productor', '#/predios', 'predios'], ['productor', '#/area/1', 'area'], ['productor', '#/area/1/historial', 'historial'], ['productor', '#/area/4', 'area-sin-com'], ['productor', '#/cuenta', 'cuenta'], ['admin', '#/hoy', 'hoy'], ['admin', '#/directorio?area=3&tab=ciclos', 'dir-area'], ['admin', '#/directorio', 'dir'], ['admin', '#/red/equipos', 'red'], ['admin', '#/ajustes/catalogo', 'ajustes']];
const W = [['d1366', 1366, 900], ['t1024', 1024, 768], ['t820', 820, 1000], ['m390', 390, 844]];
const b = await chromium.launch();
for (const [wn, w, h] of W) { const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 900 }); const p = await ctx.newPage();
  for (const [role, hash, name] of S) { await p.goto(`http://localhost:5190/?role=${role}&theme=light${hash}`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(/predios|area|hoy|dir-area/.test(name) ? 2600 : 500); await p.screenshot({ path: `${OUT}${wn}-${name}.jpg`, type: 'jpeg', quality: 55 }); }
  await ctx.close(); }
await b.close(); srv.close(); console.log('ok');
