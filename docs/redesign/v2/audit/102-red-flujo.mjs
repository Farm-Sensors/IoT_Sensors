import { chromium } from './lib-axe.mjs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/audit-admin-red/', import.meta.url).pathname;
const b = await chromium.launch();
for (const [n, w, h, mob] of [['d', 1366, 900, false], ['m', 390, 844, true]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: mob })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('admin@sensores.com'); await p.getByLabel('Contraseña', { exact: true }).fill('admin123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/admin'); await p.waitForTimeout(1200);
  const meas = () => p.evaluate(() => { const m = document.querySelector('main'); const t = m.innerText; return { alto: m.scrollHeight, palabras: t.split(/\s+/).filter(Boolean).length }; });
  const pins = async () => (await p.locator('.map-pin').allInnerTexts()).map((t) => t.replace(/\n/g, ' / '));
  await p.goto(B + '/admin/mapa'); await p.waitForTimeout(6000);
  console.log(n, 'mapa inicio', JSON.stringify(await meas()), JSON.stringify(await pins()), 'mapa alto', await p.evaluate(() => Math.round(document.querySelector('[aria-label="Mapa de la red"]').getBoundingClientRect().height)), 'de', h);
  await p.screenshot({ path: `${OUT}${n}-mapa2.jpg`, type: 'jpeg', quality: 60 });
  await p.locator('.map-pin').first().click({ force: true }); await p.waitForTimeout(2500);
  console.log(n, 'tras elegir predio', JSON.stringify(await pins()));
  await p.locator('.map-pin').first().click({ force: true }); await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}${n}-mapa-pin.jpg`, type: 'jpeg', quality: 60 });
  await p.getByRole('link', { name: /Abrir área/ }).click(); await p.waitForTimeout(1500); console.log(n, 'Abrir área ->', new URL(p.url()).pathname);
  await p.goto(B + '/admin/nodos'); await p.waitForTimeout(3000); console.log(n, 'nodos', JSON.stringify(await meas()));
  await p.screenshot({ path: `${OUT}${n}-nodos2.jpg`, type: 'jpeg', quality: 55, fullPage: mob });
  await p.goto(B + '/admin/gateways'); await p.waitForTimeout(2500); console.log(n, 'equipos', await p.locator('main h2').first().innerText());
  await p.screenshot({ path: `${OUT}${n}-equipos2.jpg`, type: 'jpeg', quality: 55 });
  console.log(n, 'errores', errs.length);
}
await b.close();
