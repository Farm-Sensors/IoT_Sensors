import { chromium } from './lib-axe.mjs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/audit-admin-clientes/', import.meta.url).pathname;
const b = await chromium.launch();
for (const [n, w, h, mob] of [['d', 1366, 900, false], ['m', 390, 844, true]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: mob })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('admin@sensores.com'); await p.getByLabel('Contraseña', { exact: true }).fill('admin123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/admin'); await p.waitForTimeout(1500);
  await p.goto(B + '/admin/clientes'); await p.waitForTimeout(2500);
  await p.getByRole('link', { name: /Agricola del Norte/ }).filter({ hasText: 'Alan' }).first().click(); await p.waitForURL('**/clientes/1/predios'); await p.waitForTimeout(1500);
  console.log(n, 'cliente abierto:', new URL(p.url()).pathname);
  await p.getByRole('button', { name: 'Editar', exact: true }).click(); await p.waitForTimeout(500);
  console.log(n, 'Editar cliente abre ventana:', await p.getByRole('dialog').count() > 0, '| título:', await p.getByRole('dialog').getByRole('heading').first().innerText().catch(() => '?'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}${n}-cliente2.jpg`, type: 'jpeg', quality: 55, fullPage: mob });
  await p.getByRole('link', { name: /Granja Hogar/ }).first().click(); await p.waitForTimeout(1500);
  await p.getByRole('link', { name: /Area Granja Hogar/ }).first().click(); await p.waitForTimeout(2000);
  console.log(n, 'área:', new URL(p.url()).pathname);
  await p.getByRole('button', { name: 'Borrar', exact: true }).click(); await p.waitForTimeout(400);
  console.log(n, 'Borrar área pide confirmación:', await p.getByRole('alertdialog').count() + await p.getByRole('dialog').count() > 0);
  await p.getByRole('button', { name: 'Cancelar' }).click().catch(() => p.keyboard.press('Escape')); await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}${n}-area2.jpg`, type: 'jpeg', quality: 55, fullPage: mob });
  console.log(n, 'errores', errs.length);
}
await b.close();
