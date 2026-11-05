import { chromium } from './lib-axe.mjs';
import { mkdirSync } from 'node:fs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/audit-area/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
for (const [n, w, h, mob] of [['d', 1366, 900, false], ['m', 390, 844, true]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: mob })).newPage();
  await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('alan2203mx@gmail.com'); await p.getByLabel('Contraseña', { exact: true }).fill('123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/cliente');
  await p.goto(B + '/cliente/area/1'); await p.waitForTimeout(3500);
  await p.screenshot({ path: `${OUT}${n}-top.jpg`, type: 'jpeg', quality: 60 });
  const s = await p.evaluate(() => { const m = document.querySelector('main'); const t = m.innerText; const full = m.scrollHeight; return { alto: full, palabras: t.split(/\s+/).filter(Boolean).length, nums: (t.match(/-?\d+([.,]\d+)?/g) || []).length, headings: [...m.querySelectorAll('h1,h2,h3,h4')].map(e => e.tagName + ' ' + e.textContent.trim().slice(0, 45)), links: m.querySelectorAll('a').length, buttons: m.querySelectorAll('button').length, cards: m.querySelectorAll('[class*="rounded"]').length }; });
  console.log(n, JSON.stringify(s));
  if (n === 'd') { await p.evaluate(() => document.querySelector('main').scrollTo(0, 900)); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}d-mid.jpg`, type: 'jpeg', quality: 60 }); await p.evaluate(() => document.querySelector('main').scrollTo(0, 99999)); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}d-bottom.jpg`, type: 'jpeg', quality: 60 }); }
  if (n === 'm') await p.screenshot({ path: `${OUT}m-full.jpg`, type: 'jpeg', quality: 55, fullPage: true });
}
await b.close();
