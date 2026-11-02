import { chromium } from './lib-axe.mjs';
const B = 'http://localhost:5173'; const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1366, height: 800 } })).newPage();
await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('admin@sensores.com'); await p.getByLabel('Contraseña', { exact: true }).fill('admin123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/admin'); await p.waitForTimeout(3500);
for (const name of ['Crear ciclos', 'Ver área']) { await p.getByRole('link', { name: new RegExp(name) }).first().click(); await p.waitForTimeout(1200); console.log(name, '->', p.url().replace(B, '')); await p.goto(B + '/admin'); await p.waitForTimeout(3000); }
await b.close();
