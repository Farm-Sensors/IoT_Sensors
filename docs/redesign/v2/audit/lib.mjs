// Utilidades de la auditoría v2. Apunta SOLO al stack aislado (:5174 → :5051 → MySQL :3307).
import { createRequire } from 'node:module';
const require = createRequire('/Users/jp-dlg/Documents/workspace/personal/riego/IoT_Sensors/frontend/');
export const { chromium } = require('@playwright/test');
export const BASE = process.env.AUDIT_BASE ?? 'http://localhost:5174';
if (!BASE.includes('5174')) throw new Error('La auditoría solo corre contra :5174');
export const USERS = {
  admin: { email: 'admin@sensores.com', password: 'admin123', landing: '/admin' },
  cliente: { email: 'alan2203mx@gmail.com', password: '123', landing: '/cliente' },
};
export const VIEWPORTS = { desktop: { width: 1366, height: 900 }, mobile: { width: 390, height: 844 } };
export async function open(role, vp) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORTS[vp], isMobile: vp === 'mobile', hasTouch: vp === 'mobile', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const log = { console: [], failed: [], http: [], requests: [] };
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) log.console.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
  page.on('pageerror', (e) => log.console.push('pageerror: ' + String(e).slice(0, 200)));
  page.on('response', (r) => { const u = r.url(); if (u.includes('/api/')) { log.requests.push(`${r.request().method()} ${u.replace(BASE, '')} ${r.status()}`); if (r.status() >= 400) log.http.push(`${r.status()} ${r.request().method()} ${u.replace(BASE, '')}`); } });
  await page.goto(BASE + '/');
  await page.getByLabel('Correo Electrónico').fill(USERS[role].email);
  await page.getByLabel('Contraseña', { exact: true }).fill(USERS[role].password);
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
  await page.waitForURL('**' + USERS[role].landing);
  return { browser, page, log };
}
export async function shot(page, name) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: new URL(`./screens/${name}.jpg`, import.meta.url).pathname, type: 'jpeg', quality: 55 });
}
