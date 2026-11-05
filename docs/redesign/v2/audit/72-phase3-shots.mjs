// Fase 3: Área › Ahora, Historial, Detalles (solo lectura contra el stack local).
import { chromium } from './lib-axe.mjs';
import { mkdirSync } from 'node:fs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/fase3/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); const errs = []; const log = [];
for (const [vn, w, h, mob] of [['d', 1366, 900, false], ['m', 390, 844, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('alan2203mx@gmail.com'); await p.getByLabel('Contraseña', { exact: true }).fill('123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/cliente');
  await p.waitForSelector('h1:has-text("Mis predios")'); await p.getByRole('link', { name: /DEMO - Nogal Norte/ }).first().click(); await p.waitForTimeout(2200);
  log.push(`${vn} ahora ${new URL(p.url()).pathname} h1s=${await p.locator('h1').count()} desborde=${await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)}`);
  await p.screenshot({ path: `${OUT}${vn}-ahora.jpg`, type: 'jpeg', quality: 55 });
  await p.getByRole('link', { name: 'Historial', exact: true }).click(); await p.waitForTimeout(2500);
  log.push(`${vn} historial ${new URL(p.url()).pathname} h1s=${await p.locator('h1').count()} descargas=${await p.getByRole('button', { name: /^(CSV|Excel|PDF)$/ }).count()} desborde=${await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)}`);
  await p.screenshot({ path: `${OUT}${vn}-historial.jpg`, type: 'jpeg', quality: 55 });
  await p.getByRole('link', { name: 'Detalles', exact: true }).click(); await p.waitForTimeout(1800);
  log.push(`${vn} detalles ${new URL(p.url()).pathname} desborde=${await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)}`);
  await p.screenshot({ path: `${OUT}${vn}-detalles.jpg`, type: 'jpeg', quality: 55 });
  for (const old of ['/cliente/historico', '/cliente/exportar']) { await p.goto(B + old); await p.waitForTimeout(1500); log.push(`${vn} ${old} → ${new URL(p.url()).pathname}`); }
  await ctx.close(); }
await b.close(); console.log(log.join('\n')); console.log('errores JS', errs.length, errs.slice(0, 3));
