import { chromium } from './lib-axe.mjs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/audit-admin-ajustes/', import.meta.url).pathname;
const b = await chromium.launch();
for (const [n, w, h, mob] of [['d', 1366, 900, false], ['m', 390, 844, true]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: mob })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('admin@sensores.com'); await p.getByLabel('Contraseña', { exact: true }).fill('admin123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/admin'); await p.waitForTimeout(1200);
  await p.goto(B + '/admin/cultivos'); await p.waitForTimeout(2500);
  console.log(n, 'lista sin fotos elegidas -> imágenes en la lista:', await p.locator('main li img').count());
  await p.screenshot({ path: `${OUT}${n}-catalogo3.jpg`, type: 'jpeg', quality: 60 });
  // Editar «Chile» SIN guardar: se abre el selector, se buscan fotos y se elige una; luego se cancela.
  await p.getByRole('button', { name: 'Editar el cultivo Chile' }).click(); await p.waitForTimeout(600);
  await p.getByRole('button', { name: /Buscar fotos/ }).click(); await p.waitForSelector('[aria-label="Fotos encontradas"] img', { timeout: 15000 }); await p.waitForTimeout(2500);
  console.log(n, 'opciones ofrecidas:', await p.locator('[aria-label="Fotos encontradas"] li').count());
  await p.locator('[aria-label="Fotos encontradas"] button').nth(1).click(); await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}${n}-selector.jpg`, type: 'jpeg', quality: 60 });
  await p.getByRole('button', { name: 'Cancelar' }).click(); await p.waitForTimeout(400);
  console.log(n, 'tras cancelar la lista sigue sin fotos:', await p.locator('main li img').count(), '| errores', errs.length);
}
await b.close();
