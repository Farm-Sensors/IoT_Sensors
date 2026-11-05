import { chromium } from './lib-axe.mjs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/audit-mapa/', import.meta.url).pathname;
const b = await chromium.launch();
for (const [n, w, h, mob] of [['d', 1366, 900, false], ['m', 390, 844, true]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: mob })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('alan2203mx@gmail.com'); await p.getByLabel('Contraseña', { exact: true }).fill('123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/cliente'); await p.waitForTimeout(1500);
  await p.goto(B + '/cliente/mapa'); await p.waitForTimeout(5000);
  console.log(n, 'pines', await p.locator('.map-pin').count(), 'mapa alto', await p.evaluate(() => Math.round(document.querySelector('[aria-label="Mapa de tus terrenos"]').getBoundingClientRect().height)), 'de', h);
  await p.getByRole('button', { name: 'Granja Hogar', exact: true }).click(); await p.waitForTimeout(1800);
  await p.locator('.map-pin').first().click({ force: true }); await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}${n}-pin.jpg`, type: 'jpeg', quality: 60 });
  await p.getByRole('link', { name: /Abrir área/ }).click(); await p.waitForURL('**/cliente/area/**'); console.log(n, 'Abrir área ->', new URL(p.url()).pathname);
  await p.goto(B + '/cliente/area/5/detalles'); await p.waitForTimeout(2500); await p.getByRole('link', { name: 'Abrir el mapa' }).click(); await p.waitForTimeout(3500);
  console.log(n, 'desde Detalles ->', p.url().replace(B, ''), 'tarjeta visible:', await p.getByRole('link', { name: /Abrir área/ }).count() > 0 ? 'no (solo centra)' : 'no', 'errores', errs.length);
  await p.screenshot({ path: `${OUT}${n}-centrado.jpg`, type: 'jpeg', quality: 60 });
}
await b.close();
