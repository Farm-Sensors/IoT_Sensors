import { chromium } from './lib-axe.mjs';
import { mkdirSync } from 'node:fs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/audit-admin-ajustes/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const measure = (p) => p.evaluate(() => { const m = document.querySelector('main'); const t = m.innerText; return { alto: m.scrollHeight, palabras: t.split(/\s+/).filter(Boolean).length, headings: [...m.querySelectorAll('h1,h2,h3')].map(e => e.tagName + ' ' + e.textContent.trim().slice(0, 34)), botones: m.querySelectorAll('button').length, enlaces: m.querySelectorAll('a').length, tablas: m.querySelectorAll('table').length, inputs: m.querySelectorAll('input,select').length, texto: t.replace(/\n+/g, ' | ').slice(0, 1100) }; });
for (const [n, w, h, mob] of [['d', 1366, 900, false], ['m', 390, 844, true]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: mob })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('admin@sensores.com'); await p.getByLabel('Contraseña', { exact: true }).fill('admin123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/admin'); await p.waitForTimeout(1200);
  for (const [k, path] of [['catalogo', '/admin/cultivos'], ['auditoria', '/admin/auditoria'], ['ciclos', '/admin/ciclos'], ['preferencias', '/admin/clientes/1/dashboard']]) {
    await p.goto(B + path); await p.waitForTimeout(3000);
    console.log(n, k, JSON.stringify(await measure(p)));
    await p.screenshot({ path: `${OUT}${n}-${k}.jpg`, type: 'jpeg', quality: 55, fullPage: n === 'm' });
  }
  console.log(n, 'errores', errs.length);
}
await b.close();
