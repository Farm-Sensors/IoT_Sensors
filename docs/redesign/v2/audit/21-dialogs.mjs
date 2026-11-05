import { open, shot } from './lib.mjs';
const { browser, page } = await open('admin', 'desktop');
const probe = async (url, btn, name) => {
  await page.goto('http://localhost:5174' + url); await page.waitForLoadState('networkidle').catch(() => {});
  await page.getByRole('button', { name: btn, exact: false }).first().click(); await page.waitForTimeout(500);
  const d = await page.evaluate(() => { const dlg = document.querySelector('[role=dialog]'); if (!dlg) return null; return { title: dlg.querySelector('h2')?.innerText, fields: [...dlg.querySelectorAll('input,select,textarea,[role=combobox]')].map((e) => `${e.tagName}:${e.type ?? ''}:${e.getAttribute('aria-label') ?? e.name ?? e.id}`), labels: [...dlg.querySelectorAll('label')].map((l) => l.innerText.trim()), buttons: [...dlg.querySelectorAll('button')].map((b) => b.innerText.trim() || b.getAttribute('aria-label')) }; });
  console.log(name, JSON.stringify(d)); await shot(page, `dlg-${name}`);
  await page.keyboard.press('Escape');
};
await probe('/admin/clientes', 'Nuevo Cliente', 'cliente');
await probe('/admin/clientes/1/predios', 'Nuevo Predio', 'predio');
await probe('/admin/predios/1/areas', 'Nueva Área', 'area');
await probe('/admin/ciclos', 'Nuevo Ciclo', 'ciclo');
await probe('/admin/nodos', 'Nuevo Nodo', 'nodo');
await probe('/admin/cultivos', 'Nuevo Cultivo', 'cultivo');
await probe('/admin/gateways', 'Nuevo equipo', 'equipo');
await browser.close();
