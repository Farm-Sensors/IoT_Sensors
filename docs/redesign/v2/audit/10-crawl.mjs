// Recorre cada ruta de `main` como cada rol y viewport. Salida: results/crawl.json y capturas.
import { open, shot } from './lib.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync(new URL('./results', import.meta.url).pathname, { recursive: true });
const ROUTES = {
  cliente: ['/cliente', '/cliente/areas', '/cliente/mapa', '/cliente/historico', '/cliente/exportar', '/cliente/perfil', '/cliente/alertas', '/cliente/umbrales', '/cliente/notificaciones', '/cliente/asistente-ia', '/cliente/reportes-ia', '/cliente/predio/1', '/cliente/inexistente'],
  admin: ['/admin', '/admin/clientes', '/admin/mapa', '/admin/nodos', '/admin/gateways', '/admin/gateways/pair', '/admin/cultivos', '/admin/ciclos', '/admin/auditoria', '/admin/umbrales', '/admin/alertas', '/admin/asistente-ia', '/admin/consumo-ia', '/admin/reportes-ia', '/admin/recorrido-v2', '/admin/inexistente'],
};
const out = {};
for (const role of ['cliente', 'admin']) for (const vp of ['desktop', 'mobile']) {
  const { browser, page, log } = await open(role, vp);
  const key = `${role}-${vp}`; out[key] = { nav: null, routes: {} };
  // menú visible tras login
  out[key].nav = await page.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
    return [...document.querySelectorAll('nav a, nav button, aside a, aside button, header a, header button')].filter(vis).map((e) => ({ tag: e.tagName, text: (e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40), href: e.getAttribute('href') }));
  });
  for (const r of ROUTES[role]) {
    log.console.length = 0; log.http.length = 0;
    await page.goto('http://localhost:5174' + r, { waitUntil: 'load' }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    const info = await page.evaluate(() => ({ url: location.pathname + location.search, h1: [...document.querySelectorAll('h1,h2')].slice(0, 3).map((e) => e.innerText.trim()), text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 400), scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth }));
    out[key].routes[r] = { ...info, console: [...log.console], http: [...log.http], hscroll: info.scrollW > info.clientW + 1 };
    await shot(page, `${key}${r.replace(/\//g, '_')}`);
  }
  await browser.close();
}
writeFileSync(new URL('./results/crawl.json', import.meta.url), JSON.stringify(out, null, 2));
console.log('ok', Object.keys(out));
