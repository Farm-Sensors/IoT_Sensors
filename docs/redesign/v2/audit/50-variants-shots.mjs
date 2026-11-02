// Capturas de las 3 propuestas: 4 pantallas × 2 viewports × 2 temas, y comprobaciones (desborde, errores, axe).
import { chromium, createRequireAxe } from './lib-axe.mjs';
import { createServer } from 'node:http'; import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'; import { extname, join } from 'node:path';
const ROOT = new URL('../variants/', import.meta.url).pathname; const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = createServer((q, r) => { const p = join(ROOT, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]); if (!existsSync(p)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[extname(p)] }); r.end(readFileSync(p)); }).listen(5195);
const OUT = new URL('./results/variants/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const SCREENS = [['productor', '#/predios', 'predios'], ['productor', '#/area/1', 'area'], ['admin', '#/hoy', 'hoy'], ['admin', '#/directorio?area=3&tab=ciclos', 'directorio']];
const b = await chromium.launch(); const rep = []; const ax = [];
for (const v of ['a', 'b', 'c']) for (const vp of [['desktop', 1366, 900], ['mobile', 390, 844]]) for (const th of ['light', 'dark']) {
  const ctx = await b.newContext({ viewport: { width: vp[1], height: vp[2] }, isMobile: vp[0] === 'mobile', hasTouch: vp[0] === 'mobile' }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  for (const [role, hash, name] of SCREENS) {
    await p.goto(`http://localhost:5195/?variant=${v}&role=${role}&theme=${th}${hash}`); await p.waitForLoadState('networkidle').catch(() => {}); await p.waitForTimeout(400);
    const m = await p.evaluate(() => ({ hs: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, small: [...document.querySelectorAll('main a,main button,main select,main input,.tabbar a,.top button,.top a')].filter((e) => { const x = e.getBoundingClientRect(); return x.width > 0 && x.height > 0 && x.height < 44; }).length }));
    rep.push({ v, vp: vp[0], th, name, ...m, errs: errs.length });
    await p.screenshot({ path: `${OUT}${v}-${name}-${vp[0]}-${th}.jpg`, type: 'jpeg', quality: 62 });
    if (name !== 'x') { const r = await createRequireAxe(p); r.violations.forEach((x) => ax.push({ v, vp: vp[0], th, name, id: x.id, n: x.nodes.length, s: x.nodes[0]?.html.slice(0, 80) })); }
  }
  await ctx.close();
}
await b.close(); srv.close(); writeFileSync(`${OUT}report.json`, JSON.stringify({ rep, ax }, null, 1));
console.log('páginas', rep.length, '· desborde', rep.filter((x) => x.hs).length, '· errores', rep.filter((x) => x.errs).length, '· táctiles<44 (páginas con alguno)', rep.filter((x) => x.small && x.vp === 'mobile').length, '· axe', ax.length);
ax.slice(0, 15).forEach((x) => console.log(JSON.stringify(x)));
