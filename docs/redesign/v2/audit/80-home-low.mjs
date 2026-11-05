import { chromium } from './lib-axe.mjs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/audit-home/', import.meta.url).pathname;
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('alan2203mx@gmail.com'); await p.getByLabel('Contraseña', { exact: true }).fill('123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/cliente'); await p.waitForTimeout(2500);
const total = await p.evaluate(() => { const m = document.querySelector('main'); m.scrollTo(0, 99999); return m.scrollHeight; });
await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}d-bottom.jpg`, type: 'jpeg', quality: 60 }); console.log('alto del contenido', total);
await b.close();
