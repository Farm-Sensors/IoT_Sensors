import { chromium } from './lib-axe.mjs';
import { mkdirSync } from 'node:fs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/audit-historial/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
for (const [n, w, h, mob] of [['d', 1366, 900, false], ['m', 390, 844, true]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: mob })).newPage();
  await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('alan2203mx@gmail.com'); await p.getByLabel('Contraseña', { exact: true }).fill('123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/cliente'); await p.waitForTimeout(1500);
  await p.goto(B + '/cliente/area/1/historial'); await p.waitForTimeout(4000);
  const s = await p.evaluate(() => { const m = document.querySelector('main'); const t = m.innerText; return { alto: m.scrollHeight, palabras: t.split(/\s+/).filter(Boolean).length, headings: [...m.querySelectorAll('h1,h2,h3')].map(e => e.tagName + ' ' + e.textContent.trim().slice(0, 40)), botones: m.querySelectorAll('button').length, inputs: m.querySelectorAll('input,select').length, tablas: m.querySelectorAll('table').length, filas: m.querySelectorAll('tbody tr').length }; });
  console.log(n, JSON.stringify(s));
  await p.screenshot({ path: `${OUT}${n}-full.jpg`, type: 'jpeg', quality: 55, fullPage: n === 'm' });
  if (n === 'd') for (const [k, y] of [['mid', 900], ['mid2', 1800], ['bottom', 99999]]) { await p.evaluate((yy) => document.querySelector('main').scrollTo(0, yy), y); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}d-${k}.jpg`, type: 'jpeg', quality: 55 }); }
}
await b.close();
