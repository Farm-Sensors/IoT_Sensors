import { chromium } from './lib-axe.mjs';
import { mkdirSync } from 'node:fs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/audit-admin-clientes/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const measure = (p) => p.evaluate(() => { const m = document.querySelector('main'); const t = m.innerText; return { alto: m.scrollHeight, palabras: t.split(/\s+/).filter(Boolean).length, headings: [...m.querySelectorAll('h1,h2,h3')].map(e => e.tagName + ' ' + e.textContent.trim().slice(0, 34)), botones: m.querySelectorAll('button').length, enlaces: m.querySelectorAll('a').length, tablas: m.querySelectorAll('table').length, filas: m.querySelectorAll('tbody tr').length, texto: t.replace(/\n+/g, ' | ').slice(0, 900) }; });
for (const [n, w, h, mob] of [['d', 1366, 900, false], ['m', 390, 844, true]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: mob })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('admin@sensores.com'); await p.getByLabel('Contraseña', { exact: true }).fill('admin123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/admin'); await p.waitForTimeout(1500);
  for (const [k, path] of [['lista', '/admin/clientes'], ['cliente', '/admin/clientes/1/predios'], ['predio', '/admin/predios/1/areas'], ['area', '/admin/areas/5?tab=resumen'], ['ciclos', '/admin/areas/5?tab=ciclos'], ['nodo', '/admin/areas/5?tab=nodo']]) {
    await p.goto(B + path); await p.waitForTimeout(3000);
    console.log(n, k, JSON.stringify(await measure(p))); 
    await p.screenshot({ path: `${OUT}${n}-${k}.jpg`, type: 'jpeg', quality: 55, fullPage: n === 'm' });
  }
  console.log(n, 'errores', errs.length);
}
await b.close();
