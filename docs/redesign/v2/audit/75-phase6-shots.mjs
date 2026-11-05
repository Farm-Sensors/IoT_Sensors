// Fase 6: Ajustes y Cuenta (solo lectura contra el stack local).
import { chromium } from './lib-axe.mjs';
import { mkdirSync } from 'node:fs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/fase6/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); const errs = []; const log = [];
const ov = (p) => p.evaluate(() => { const d = document.documentElement; const w = d.clientWidth; const bad = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > w + 1 && !e.closest('[class*="overflow-x"],[class*="overflow-auto"]'); }).slice(0, 3).map(e => e.tagName + '.' + String(e.className).slice(0, 50)); return { page: d.scrollWidth > w + 1, bad }; });
for (const [vn, w, h, mob] of [['d', 1366, 900, false], ['m', 390, 844, true]]) {
  for (const [role, email, pass, wait, pages] of [
    ['admin', 'admin@sensores.com', 'admin123', '**/admin', [['catalogo', '/admin/cultivos'], ['auditoria', '/admin/auditoria']]],
    ['cliente', 'alan2203mx@gmail.com', '123', '**/cliente', [['cuenta', '/cliente/perfil']]]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e)));
    await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill(email); await p.getByLabel('Contraseña', { exact: true }).fill(pass); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL(wait);
    for (const [name, path] of pages) {
      await p.goto(B + path); await p.waitForSelector('h1'); await p.waitForTimeout(2000);
      log.push(`${vn} ${name} h1="${await p.locator('h1').first().innerText()}" h1s=${await p.locator('h1').count()} desborde=${JSON.stringify(await ov(p))}`);
      await p.screenshot({ path: `${OUT}${vn}-${name}.jpg`, type: 'jpeg', quality: 55, fullPage: true });
    }
    await ctx.close();
  }
}
await b.close(); console.log(log.join('\n')); console.log('errores JS', errs.length, errs.slice(0, 3));
