import { chromium } from './lib-axe.mjs';
import { mkdirSync } from 'node:fs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/audit-home/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
for (const [n, w, h, mob] of [['d', 1366, 900, false], ['m', 390, 844, true]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: mob })).newPage();
  await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('alan2203mx@gmail.com'); await p.getByLabel('Contraseña', { exact: true }).fill('123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/cliente'); await p.waitForTimeout(3000);
  await p.screenshot({ path: `${OUT}${n}-full.jpg`, type: 'jpeg', quality: 60, fullPage: true });
  const s = await p.evaluate(() => ({ h: document.documentElement.scrollHeight, headings: [...document.querySelectorAll('h1,h2,h3')].map(e => e.tagName + ' ' + e.textContent.trim().slice(0, 50)), links: document.querySelectorAll('main a').length, buttons: document.querySelectorAll('main button').length, nums: (document.querySelector('main')?.innerText.match(/\d+(\.\d+)?/g) || []).length }));
  console.log(n, JSON.stringify(s));
}
await b.close();
