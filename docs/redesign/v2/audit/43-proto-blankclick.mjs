// Regresión: clic en zona sin controles no debe cambiar de ruta ni de rol.
import { chromium } from './lib-axe.mjs';
import { createServer } from 'node:http'; import { readFileSync, existsSync } from 'node:fs'; import { extname, join } from 'node:path';
const dir = process.argv[2] ?? '../prototype/'; const ROOT = new URL(dir, import.meta.url).pathname; const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = createServer((q, r) => { const p = join(ROOT, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]); if (!existsSync(p)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[extname(p)] }); r.end(readFileSync(p)); }).listen(5196);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
await p.goto('http://localhost:5196/?role=admin#/red/nodos'); await p.waitForTimeout(150);
await p.locator('main h1').click(); await p.waitForTimeout(150);
const u1 = p.url(); await p.locator('main table').first().click({ position: { x: 5, y: 5 } }); await p.waitForTimeout(150);
console.log(u1.endsWith('#/red/nodos') && p.url().endsWith('#/red/nodos') ? 'OK sin redirección' : 'FALLA ' + p.url());
await b.close(); srv.close();
