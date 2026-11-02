import { chromium } from './lib-axe.mjs';
import { mkdirSync } from 'node:fs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/audit-detalles/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
for (const [n, w, h, mob] of [['d', 1366, 900, false], ['m', 390, 844, true]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: mob })).newPage();
  await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('alan2203mx@gmail.com'); await p.getByLabel('Contraseña', { exact: true }).fill('123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/cliente'); await p.waitForTimeout(1500);
  for (const [k, id] of [['con', 1], ['sin', 5]]) {
    await p.goto(B + `/cliente/area/${id}/detalles`); await p.waitForTimeout(3000);
    const s = await p.evaluate(() => { const m = document.querySelector('main'); const t = m.innerText; return { alto: m.scrollHeight, palabras: t.split(/\s+/).filter(Boolean).length, headings: [...m.querySelectorAll('h1,h2,h3')].map(e => e.tagName + ' ' + e.textContent.trim().slice(0, 30)), enlaces: m.querySelectorAll('a').length, texto: t.replace(/\n+/g, ' | ').slice(0, 700) }; });
    console.log(n, k, id, JSON.stringify(s));
    await p.screenshot({ path: `${OUT}${n}-${k}.jpg`, type: 'jpeg', quality: 60, fullPage: n === 'm' });
  }
}
await b.close();
