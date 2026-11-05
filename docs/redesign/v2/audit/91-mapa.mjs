import { chromium } from './lib-axe.mjs';
import { mkdirSync } from 'node:fs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/audit-mapa/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
for (const [n, w, h, mob] of [['d', 1366, 900, false], ['m', 390, 844, true]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: mob })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 100)); });
  await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('alan2203mx@gmail.com'); await p.getByLabel('Contraseña', { exact: true }).fill('123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/cliente'); await p.waitForTimeout(1500);
  await p.goto(B + '/cliente/mapa'); await p.waitForTimeout(6000);
  const s = await p.evaluate(() => { const m = document.querySelector('main'); const t = m.innerText; return { alto: m.scrollHeight, viewport: innerHeight, palabras: t.split(/\s+/).filter(Boolean).length, headings: [...m.querySelectorAll('h1,h2,h3')].map(e => e.tagName + ' ' + e.textContent.trim().slice(0, 40)), botones: m.querySelectorAll('button').length, enlaces: m.querySelectorAll('a').length, canvas: m.querySelectorAll('canvas').length, mapH: Math.round(document.querySelector('canvas')?.getBoundingClientRect().height || 0), texto: t.replace(/\n+/g, ' | ').slice(0, 900) }; });
  console.log(n, JSON.stringify(s)); console.log('errores', errs.length, errs.slice(0, 3));
  await p.screenshot({ path: `${OUT}${n}-full.jpg`, type: 'jpeg', quality: 60, fullPage: n === 'm' });
}
await b.close();
