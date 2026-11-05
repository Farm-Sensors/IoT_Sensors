import { chromium } from './lib-axe.mjs';
import { mkdirSync } from 'node:fs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/audit-admin-hoy/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
for (const [n, w, h, mob] of [['d', 1366, 900, false], ['m', 390, 844, true]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: mob })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('admin@sensores.com'); await p.getByLabel('Contraseña', { exact: true }).fill('admin123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/admin'); await p.waitForTimeout(4500);
  const s = await p.evaluate(() => { const m = document.querySelector('main'); const t = m.innerText; return { alto: m.scrollHeight, viewport: innerHeight, palabras: t.split(/\s+/).filter(Boolean).length, headings: [...m.querySelectorAll('h1,h2,h3')].map(e => e.tagName + ' ' + e.textContent.trim().slice(0, 36)), enlaces: m.querySelectorAll('a').length, botones: m.querySelectorAll('button').length, texto: t.replace(/\n+/g, ' | ').slice(0, 1400) }; });
  console.log(n, JSON.stringify(s)); console.log('errores', errs.length);
  await p.screenshot({ path: `${OUT}${n}-full.jpg`, type: 'jpeg', quality: 60, fullPage: n === 'm' });
  if (n === 'd') { await p.evaluate(() => document.querySelector('main').scrollTo(0, 99999)); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}d-bottom.jpg`, type: 'jpeg', quality: 60 }); }
}
await b.close();
