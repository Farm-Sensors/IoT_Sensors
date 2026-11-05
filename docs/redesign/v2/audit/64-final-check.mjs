// Verificación final única de la propuesta A (portada de resumen + página de mapa).
import { chromium, createRequireAxe } from './lib-axe.mjs';
import { createServer } from 'node:http'; import { readFileSync, existsSync } from 'node:fs'; import { extname, join } from 'node:path';
const ROOT = new URL('../prototype-a/', import.meta.url).pathname; const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = createServer((q, r) => { const p = join(ROOT, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]); if (!existsSync(p)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[extname(p)] }); r.end(readFileSync(p)); }).listen(5186);
const U = (role, theme, h) => `http://localhost:5186/?role=${role}&theme=${theme}${h}`; const res = []; const ok = (n, c, x = '') => { res.push(c); if (!c) console.log('FALLA', n, x); };
const b = await chromium.launch(); const axe = []; const errs = [];
for (const [vn, w, h] of [['desktop', 1366, 900], ['mobile', 390, 844]]) for (const theme of ['light', 'dark']) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500 }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e)));
  for (const [role, hash] of [['productor', '#/predios'], ['productor', '#/mapa'], ['productor', '#/area/1'], ['admin', '#/hoy'], ['admin', '#/red/mapa']]) {
    await p.goto(U(role, theme, hash), { waitUntil: 'domcontentloaded' }); await p.waitForSelector('main', { timeout: 30000 }); await p.waitForTimeout(/mapa|area/.test(hash) ? 3000 : 600);
    ok(`${vn} ${theme} ${hash} sin desborde`, await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
    const r = await createRequireAxe(p); r.violations.forEach((v) => axe.push(`${vn} ${theme} ${hash} ${v.id} x${v.nodes.length}`));
  }
  if (theme === 'light') {
    await p.goto(U('productor', 'light', '#/predios'), { waitUntil: 'domcontentloaded' }); await p.waitForSelector('main', { timeout: 30000 }); await p.waitForTimeout(600);
    ok(`${vn} portada: resumen y gráficas, sin mapa`, (await p.locator('.kpi').count()) === 4 && (await p.locator('.chart svg').count()) >= 2 && (await p.locator('.mapview').count()) === 0);
    await p.getByRole('link', { name: 'Mapa', exact: true }).first().click(); await p.waitForSelector('.mapview .maplibregl-canvas', { timeout: 25000 });
    ok(`${vn} Mapa: página propia con mapa real`, p.url().endsWith('#/mapa') && await p.locator('.maplibregl-canvas').first().isVisible());
    await p.getByRole('button', { name: 'Rancho Norte', exact: true }).first().click(); await p.waitForTimeout(3000);
    await p.locator('[data-pin-area="2"]').click(); await p.waitForTimeout(400);
    await p.locator('.maplibregl-popup').getByRole('link', { name: 'Abrir área' }).click(); await p.waitForTimeout(200);
    ok(`${vn} Mapa: pin → popup → área`, p.url().endsWith('#/area/2'));
    await p.goto(U('productor', 'light', '#/predios'), { waitUntil: 'domcontentloaded' }); await p.waitForSelector('main', { timeout: 30000 }); await p.waitForTimeout(500);
    await p.getByRole('link', { name: /Nogal Norte/ }).first().click(); await p.waitForTimeout(200); ok(`${vn} fila → área`, p.url().endsWith('#/area/1'));
  }
  await ctx.close();
}
await b.close(); srv.close();
console.log(`comprobaciones ${res.filter(Boolean).length}/${res.length} · errores JS ${errs.length} · axe ${axe.length}`); axe.slice(0, 10).forEach((x) => console.log(x));
