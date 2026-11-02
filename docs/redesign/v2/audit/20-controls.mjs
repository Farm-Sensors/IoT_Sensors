// Lista los controles visibles de cada pantalla (botones, enlaces, campos) para el inventario de paridad.
import { open } from './lib.mjs';
import { writeFileSync } from 'node:fs';
const PAGES = {
  cliente: ['/cliente', '/cliente/areas', '/cliente/historico', '/cliente/exportar', '/cliente/perfil', '/cliente/predio/2', '/cliente/mapa'],
  admin: ['/admin', '/admin/clientes', '/admin/nodos', '/admin/gateways', '/admin/cultivos', '/admin/ciclos', '/admin/auditoria', '/admin/mapa', '/admin/gateways/pair', '/admin/nodos/1', '/admin/gateways/1', '/admin/clientes/1/predios', '/admin/clientes/1/dashboard', '/admin/predios/1/areas'],
};
const out = {};
for (const role of ['cliente', 'admin']) {
  const { browser, page } = await open(role, 'desktop');
  for (const r of PAGES[role]) {
    await page.goto('http://localhost:5174' + r); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(500);
    out[`${role}${r}`] = await page.evaluate(() => {
      const vis = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
      const main = document.querySelector('main') ?? document.body;
      const lab = (e) => (e.innerText || e.getAttribute('aria-label') || e.getAttribute('title') || e.getAttribute('placeholder') || e.name || '').trim().replace(/\s+/g, ' ').slice(0, 50);
      return {
        buttons: [...main.querySelectorAll('button, [role=button], [role=tab], [role=combobox]')].filter(vis).map((e) => `${e.getAttribute('role') ?? 'button'}:${lab(e)}${e.disabled ? ' (disabled)' : ''}`),
        links: [...main.querySelectorAll('a[href]')].filter(vis).map((e) => `${lab(e)} → ${e.getAttribute('href')}`),
        inputs: [...main.querySelectorAll('input, select, textarea')].filter(vis).map((e) => `${e.type ?? e.tagName}:${lab(e)}`),
      };
    });
  }
  await browser.close();
}
writeFileSync(new URL('./results/controls.json', import.meta.url), JSON.stringify(out, null, 1));
for (const [k, v] of Object.entries(out)) console.log(`\n## ${k}\nB: ${[...new Set(v.buttons)].join(' | ')}\nL: ${[...new Set(v.links)].slice(0, 12).join(' | ')}\nI: ${v.inputs.join(' | ')}`);
