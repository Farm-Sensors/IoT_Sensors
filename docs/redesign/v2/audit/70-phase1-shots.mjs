// Capturas de la fase 1 contra el stack local del usuario (solo inicia sesión y navega; no escribe datos).
import { chromium } from './lib-axe.mjs';
import { mkdirSync } from 'node:fs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/fase1/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const U = { admin: ['admin@sensores.com', 'admin123'], cliente: ['alan2203mx@gmail.com', '123'] };
const b = await chromium.launch(); const errs = [];
for (const [vn, w, h, mob] of [['d', 1366, 800, false], ['m', 390, 844, true]]) for (const theme of ['light', 'dark']) for (const role of ['cliente', 'admin']) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e)));
  await ctx.addInitScript((t) => localStorage.setItem('app-ui-theme', t), theme);
  await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill(U[role][0]); await p.getByLabel('Contraseña', { exact: true }).fill(U[role][1]); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/' + (role === 'admin' ? 'admin' : 'cliente'));
  for (const [n, path] of role === 'admin' ? [['hoy', '/admin'], ['red', '/admin/gateways']] : [['area', '/cliente'], ['predios', '/cliente/areas']]) { await p.goto(B + path); await p.waitForLoadState('networkidle').catch(() => {}); await p.waitForTimeout(600); await p.screenshot({ path: `${OUT}${vn}-${theme}-${role}-${n}.jpg`, type: 'jpeg', quality: 55 }); }
  await ctx.close(); }
await b.close(); console.log('errores JS', errs.length, errs.slice(0, 3));
