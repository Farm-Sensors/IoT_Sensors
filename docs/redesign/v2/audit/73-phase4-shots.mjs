// Fase 4: Directorio del admin (solo lectura contra el stack local).
import { chromium } from './lib-axe.mjs';
import { mkdirSync } from 'node:fs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/fase4/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); const errs = []; const log = [];
for (const [vn, w, h, mob] of [['d', 1366, 900, false], ['m', 390, 844, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('admin@sensores.com'); await p.getByLabel('Contraseña', { exact: true }).fill('admin123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/admin');
  const ov = () => p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  await p.goto(B + '/admin/clientes'); await p.waitForSelector('h1:has-text("Clientes")'); await p.waitForTimeout(1800);
  log.push(`${vn} raíz h1s=${await p.locator('h1').count()} desborde=${await ov()}`); await p.screenshot({ path: `${OUT}${vn}-raiz.jpg`, type: 'jpeg', quality: 55 });
  await p.goto(B + '/admin/clientes/1/predios'); await p.waitForTimeout(1800); log.push(`${vn} cliente h1s=${await p.locator('h1').count()} desborde=${await ov()}`); await p.screenshot({ path: `${OUT}${vn}-cliente.jpg`, type: 'jpeg', quality: 55 });
  await p.goto(B + '/admin/predios/1/areas'); await p.waitForTimeout(1800); log.push(`${vn} predio h1s=${await p.locator('h1').count()} desborde=${await ov()}`); await p.screenshot({ path: `${OUT}${vn}-predio.jpg`, type: 'jpeg', quality: 55 });
  await p.goto(B + '/admin/areas/1?tab=nodo'); await p.waitForTimeout(2000); log.push(`${vn} área/nodo h1s=${await p.locator('h1').count()} desborde=${await ov()}`); await p.screenshot({ path: `${OUT}${vn}-area-nodo.jpg`, type: 'jpeg', quality: 55 });
  await p.goto(B + '/admin/areas/1?tab=ciclos'); await p.waitForTimeout(2000); await p.screenshot({ path: `${OUT}${vn}-area-ciclos.jpg`, type: 'jpeg', quality: 55 });
  await p.goto(B + '/admin/areas/999999'); await p.waitForTimeout(1500); log.push(`${vn} área inexistente: ${(await p.getByText('No se encontró').count())}`);
  await ctx.close(); }
await b.close(); console.log(log.join('\n')); console.log('errores JS', errs.length, errs.slice(0, 3));
