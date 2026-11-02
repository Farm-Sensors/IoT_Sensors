import { chromium } from './lib-axe.mjs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/audit-historial/', import.meta.url).pathname;
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1000, height: 700 }, acceptDownloads: true }); const p = await ctx.newPage();
await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('alan2203mx@gmail.com'); await p.getByLabel('Contraseña', { exact: true }).fill('123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/cliente'); await p.waitForTimeout(1500);
await p.goto(B + '/cliente/area/1/historial'); await p.waitForTimeout(3000);
await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'CSV' }).click()]);
await p.getByRole('dialog').waitFor();
// opacidad del círculo y de la marca a lo largo de los primeros instantes
const samples = [];
for (let i = 0; i < 6; i++) { samples.push(await p.evaluate(() => { const c = getComputedStyle(document.querySelector('.download-check-circle')); const m = getComputedStyle(document.querySelector('.download-check-mark')); return `círculo op=${(+c.opacity).toFixed(2)} off=${(+c.strokeDashoffset).toFixed(2)} | marca op=${(+m.opacity).toFixed(2)} off=${(+m.strokeDashoffset).toFixed(2)}`; })); await p.waitForTimeout(150); }
console.log(samples.join('\n'));
await b.close();
