import { chromium } from './lib-axe.mjs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/audit-mapa/', import.meta.url).pathname;
const b = await chromium.launch();
for (const [n, w, h, mob] of [['d', 1366, 900, false], ['m', 390, 844, true]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: mob })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('alan2203mx@gmail.com'); await p.getByLabel('Contraseña', { exact: true }).fill('123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/cliente'); await p.waitForTimeout(1500);
  await p.goto(B + '/cliente/mapa'); await p.waitForTimeout(5000);
  const names = async () => (await p.locator('.map-pin').allInnerTexts()).map((t) => t.replace(/\n/g, ' / '));
  console.log(n, 'inicio:', JSON.stringify(await names()));
  await p.screenshot({ path: `${OUT}${n}-predios.jpg`, type: 'jpeg', quality: 60 });
  await p.locator('.map-pin').first().click({ force: true }); await p.waitForTimeout(2200);
  console.log(n, 'tras elegir predio:', JSON.stringify(await names()));
  await p.screenshot({ path: `${OUT}${n}-predio.jpg`, type: 'jpeg', quality: 60 });
  await p.getByRole('button', { name: 'Todos los predios' }).first().click(); await p.waitForTimeout(1500);
  console.log(n, 'volver:', (await names()).length, 'pines; errores', errs.length);
  await p.goto(B + '/cliente/area/1/detalles'); await p.waitForTimeout(2500); await p.getByRole('link', { name: 'Abrir el mapa' }).click(); await p.waitForTimeout(4500);
  console.log(n, 'desde Detalles:', JSON.stringify(await names()), 'tarjeta:', await p.getByRole('link', { name: /Abrir área/ }).count());
}
await b.close();
