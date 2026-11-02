import { chromium } from './lib-axe.mjs';
const B = 'http://localhost:5173'; const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1366, height: 800 } })).newPage();
await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('admin@sensores.com'); await p.getByLabel('Contraseña', { exact: true }).fill('admin123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/admin');
await p.goto(B + '/admin/clientes/1/predios'); await p.waitForTimeout(1800);
const tree = p.getByRole('list', { name: 'Clientes, predios y áreas' }); const first = tree.getByRole('button', { name: /Contraer|Expandir/ }).first();
const rows = () => tree.getByRole('link').count();
const log = [`inicio: ${await first.getAttribute('aria-label')} enlaces=${await rows()}`];
for (let i = 0; i < 4; i++) { await first.click(); await p.waitForTimeout(150); log.push(`clic ${i + 1}: ${await first.getAttribute('aria-label')} enlaces=${await rows()}`); }
await b.close(); console.log(log.join('\n'));
