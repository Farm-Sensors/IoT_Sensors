// Fase 5: Hoy y Red (solo lectura contra el stack local).
import { chromium } from './lib-axe.mjs';
import { mkdirSync } from 'node:fs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/fase5/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); const errs = []; const log = [];
for (const [vn, w, h, mob] of [['d', 1366, 900, false], ['m', 390, 844, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('admin@sensores.com'); await p.getByLabel('Contraseña', { exact: true }).fill('admin123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/admin');
  const ov = () => p.evaluate(() => { const d = document.documentElement; const w = d.clientWidth; const bad = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > w + 1 && !e.closest('[class*="overflow-x"],[class*="overflow-auto"]'); }).slice(0, 3).map(e => e.tagName + '.' + String(e.className).slice(0, 50)); return { page: d.scrollWidth > w + 1, bad }; });
  for (const [name, path, sel] of [['hoy', '/admin', 'h1:has-text("Hoy")'], ['equipos', '/admin/gateways', 'h1'], ['nodos', '/admin/nodos', 'h1'], ['mapa', '/admin/mapa', 'h1']]) {
    await p.goto(B + path); await p.waitForSelector(sel); await p.waitForTimeout(2500);
    log.push(`${vn} ${name} h1s=${await p.locator('h1').count()} desborde=${JSON.stringify(await ov())}`);
    await p.screenshot({ path: `${OUT}${vn}-${name}.jpg`, type: 'jpeg', quality: 55, fullPage: true });
  }
  await ctx.close(); }
await b.close(); console.log(log.join('\n')); console.log('errores JS', errs.length, errs.slice(0, 3));
