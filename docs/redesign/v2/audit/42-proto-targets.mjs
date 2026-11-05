// Mide objetivos táctiles menores de 44 px en el prototipo (móvil, 390 px).
import { chromium } from './lib-axe.mjs';
import { createServer } from 'node:http'; import { readFileSync, existsSync } from 'node:fs'; import { extname, join } from 'node:path';
const ROOT = new URL('../prototype/', import.meta.url).pathname; const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = createServer((q, r) => { const p = join(ROOT, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]); if (!existsSync(p)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[extname(p)] }); r.end(readFileSync(p)); }).listen(5197);
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const p = await ctx.newPage(); const all = {};
for (const [role, routes] of [['productor', ['#/predios', '#/area/1', '#/area/1/historial', '#/cuenta']], ['admin', ['#/hoy', '#/directorio?area=3&tab=ciclos', '#/red/equipos', '#/ajustes/catalogo']]]) for (const r of routes) {
  await p.goto(`http://localhost:5197/?role=${role}&theme=light${r}`); await p.waitForTimeout(150);
  all[`${role}${r}`] = await p.evaluate(() => [...document.querySelectorAll('main a,main button,main select,main input,.tabbar a,.top button,.top a')].map((e) => { const x = e.getBoundingClientRect(); return { t: (e.innerText || e.getAttribute('aria-label') || e.id || '').trim().slice(0, 28), w: Math.round(x.width), h: Math.round(x.height) }; }).filter((x) => x.w > 0 && (x.h < 44)));
}
await b.close(); srv.close();
let n = 0; for (const [k, v] of Object.entries(all)) { n += v.length; console.log(k, v.length, JSON.stringify(v.slice(0, 6))); } console.log('total <44px:', n);
