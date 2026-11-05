// Prueba del prototipo: recorre las 4 pantallas pedidas en 390 y 1366 px, claro y oscuro; comprueba desbordes, errores y contraste básico.
import { chromium } from './lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';
const ROOT = new URL('../prototype/', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = createServer((q, r) => { const p = join(ROOT, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]); if (!existsSync(p)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'text/plain' }); r.end(readFileSync(p)); }).listen(5199);
const OUT = new URL('./results/proto/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(); const report = [];
const ROUTES = { productor: ['#/predios', '#/area/1', '#/area/1/historial', '#/area/1/detalles', '#/area/4', '#/area/5', '#/area/6', '#/cuenta'], admin: ['#/hoy', '#/directorio', '#/directorio?area=3&tab=ciclos', '#/red/equipos', '#/red/nodos', '#/ajustes/catalogo', '#/ajustes/auditoria'] };
for (const vp of [{ n: 'desktop', w: 1366, h: 900 }, { n: 'mobile', w: 390, h: 844 }]) for (const theme of ['light', 'dark']) for (const role of ['productor', 'admin']) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.n === 'mobile', hasTouch: vp.n === 'mobile' }); const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  for (const r of ROUTES[role]) {
    await page.goto(`http://localhost:5199/?role=${role}&theme=${theme}${r}`); await page.waitForTimeout(150);
    const m = await page.evaluate(() => ({ hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, h1: document.querySelector('h1')?.innerText, small: [...document.querySelectorAll('main a,main button,main select,main input,.tabbar a')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.height < 32; }).length }));
    report.push({ vp: vp.n, theme, role, route: r, ...m, errs: [...errs] });
    if (['#/predios', '#/area/1', '#/hoy', '#/directorio', '#/area/4'].includes(r)) await page.screenshot({ path: `${OUT}${vp.n}-${theme}-${role}-${r.replace(/[#/?=&]/g, '_')}.jpg`, type: 'jpeg', quality: 60 });
  }
  await ctx.close();
}
await browser.close(); srv.close();
writeFileSync(`${OUT}report.json`, JSON.stringify(report, null, 1));
const bad = report.filter((x) => x.hscroll || x.errs.length || !x.h1);
console.log('rutas probadas:', report.length, '· con problemas:', bad.length); bad.slice(0, 10).forEach((b) => console.log(JSON.stringify(b)));
