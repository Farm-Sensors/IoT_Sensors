// Fase 7: barrido final de rutas (solo lectura contra el stack local).
import { chromium } from './lib-axe.mjs';
import { mkdirSync } from 'node:fs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/fase7/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); const errs = []; const log = [];
const ov = (p) => p.evaluate(() => { const d = document.documentElement; return d.scrollWidth > d.clientWidth + 1; });
const sets = [
  ['admin', 'admin@sensores.com', 'admin123', '**/admin', ['/admin', '/admin/clientes', '/admin/areas/1?tab=nodo', '/admin/ciclos', '/admin/nodos', '/admin/gateways', '/admin/mapa', '/admin/cultivos', '/admin/auditoria', '/admin/umbrales']],
  ['cliente', 'alan2203mx@gmail.com', '123', '**/cliente', ['/cliente', '/cliente/area/1', '/cliente/area/1/historial', '/cliente/area/1/detalles', '/cliente/mapa', '/cliente/perfil', '/cliente/historico', '/cliente/exportar', '/cliente/areas']]];
for (const [vn, w, h, mob] of [['d', 1366, 900, false], ['m', 390, 844, true]]) for (const [role, email, pass, wait, routes] of sets) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(`${p.url()} ${e}`));
  await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill(email); await p.getByLabel('Contraseña', { exact: true }).fill(pass); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL(wait);
  for (const r of routes) {
    await p.goto(B + r); await p.waitForTimeout(1800);
    const h1 = await p.locator('h1').count(); const crash = await p.getByText('¡Ups! Algo salió mal').count();
    log.push(`${vn} ${r} -> ${new URL(p.url()).pathname} h1s=${h1} crash=${crash} desborde=${await ov(p)}`);
    if (vn === 'd' || r === '/admin' || r === '/cliente') await p.screenshot({ path: `${OUT}${vn}-${r.replace(/\W+/g, '_')}.jpg`, type: 'jpeg', quality: 50 });
  }
  await ctx.close(); }
await b.close(); console.log(log.join('\n')); console.log('errores JS', errs.length, errs.slice(0, 3));
