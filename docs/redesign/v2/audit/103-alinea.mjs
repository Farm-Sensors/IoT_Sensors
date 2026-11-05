import { chromium } from './lib-axe.mjs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/audit-admin-red/', import.meta.url).pathname;
const b = await chromium.launch();
for (const [n, w, h, mob] of [['d', 1100, 760, false], ['m', 390, 844, true]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: mob })).newPage();
  await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('admin@sensores.com'); await p.getByLabel('Contraseña', { exact: true }).fill('admin123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/admin'); await p.waitForTimeout(1200);
  await p.goto(B + '/admin/nodos'); await p.waitForTimeout(3000);
  const xs = await p.evaluate(() => [...document.querySelectorAll('main li')].map((li) => { const b = li.querySelector('[class*="w-[11rem]"]'); return b ? Math.round(b.getBoundingClientRect().left) : null; }).filter((x) => x !== null));
  console.log(n, 'inicio de la columna de estado (px) por fila:', JSON.stringify(xs), '| alineadas:', new Set(xs).size === 1);
  await p.screenshot({ path: `${OUT}${n}-nodos3.jpg`, type: 'jpeg', quality: 55 });
}
await b.close();
