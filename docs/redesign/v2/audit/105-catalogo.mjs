import { chromium } from './lib-axe.mjs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/audit-admin-ajustes/', import.meta.url).pathname;
const b = await chromium.launch();
for (const [n, w, h, mob] of [['d', 1366, 900, false], ['m', 390, 844, true]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: mob })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('admin@sensores.com'); await p.getByLabel('Contraseña', { exact: true }).fill('admin123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/admin'); await p.waitForTimeout(1200);
  await p.goto(B + '/admin/cultivos'); await p.waitForTimeout(9000);
  const info = await p.evaluate(() => [...document.querySelectorAll('main li')].map((li) => { const img = li.querySelector('img'); const ok = img && img.complete && img.naturalWidth > 0; return `${li.querySelector('h2')?.textContent}: ${img ? (ok ? 'foto ' + img.naturalWidth + 'px' : 'foto sin cargar') : 'ícono'} | ${li.querySelector('p')?.textContent}`; }));
  console.log(n, JSON.stringify(info, null, 1));
  await p.screenshot({ path: `${OUT}${n}-catalogo2.jpg`, type: 'jpeg', quality: 70, fullPage: mob }); console.log(n, 'errores', errs.length);
}
await b.close();
