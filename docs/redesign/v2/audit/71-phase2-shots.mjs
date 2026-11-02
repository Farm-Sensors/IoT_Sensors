// Fase 2: portada «Mis predios» (solo lectura contra el stack local: inicia sesión y navega).
import { chromium } from './lib-axe.mjs';
import { mkdirSync } from 'node:fs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/fase2/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); const errs = []; const log = [];
for (const [vn, w, h, mob] of [['d', 1366, 900, false], ['m', 390, 844, true]]) for (const theme of ['light', 'dark']) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e)));
  await ctx.addInitScript((t) => localStorage.setItem('app-ui-theme', t), theme);
  await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('alan2203mx@gmail.com'); await p.getByLabel('Contraseña', { exact: true }).fill('123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/cliente');
  await p.waitForSelector('h1:has-text("Mis predios")', { timeout: 20000 }); await p.waitForTimeout(1200);
  log.push(`${vn} ${theme} desborde=${await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)}`);
  await p.screenshot({ path: `${OUT}${vn}-${theme}-portada.jpg`, type: 'jpeg', quality: 55, fullPage: true });
  if (theme === 'light') {
    await p.getByRole('link', { name: /Area Granja Hogar|DEMO - Nogal Norte/ }).first().click(); await p.waitForTimeout(1500);
    log.push(`${vn} fila→ ${new URL(p.url()).pathname} h1=${await p.locator('h1').first().innerText()}`);
    await p.screenshot({ path: `${OUT}${vn}-area.jpg`, type: 'jpeg', quality: 55 });
    await p.goto(B + '/cliente/areas'); await p.waitForTimeout(800); log.push(`${vn} /cliente/areas → ${new URL(p.url()).pathname}`);
    await p.goto(B + '/cliente/area/999999'); await p.waitForTimeout(1200); log.push(`${vn} área inexistente → ${new URL(p.url()).pathname}`);
  }
  await ctx.close(); }
await b.close(); console.log(log.join('\n')); console.log('errores JS', errs.length, errs.slice(0, 3));
