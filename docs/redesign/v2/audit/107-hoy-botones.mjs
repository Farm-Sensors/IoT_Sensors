import { chromium } from './lib-axe.mjs';
const B='http://localhost:5173'; const b=await chromium.launch();
for (const [w,mob] of [[1366,false],[390,true]]) {
  const p=await (await b.newContext({viewport:{width:w,height:800},isMobile:mob})).newPage();
  await p.goto(B+'/'); await p.getByLabel('Correo Electrónico').fill('admin@sensores.com'); await p.getByLabel('Contraseña',{exact:true}).fill('admin123'); await p.getByRole('button',{name:'Iniciar Sesión'}).click(); await p.waitForURL('**/admin'); await p.waitForTimeout(1500);
  for (const n of ['Nuevo Cliente','Nuevo Nodo','Registro de eventos']) { const r=await p.getByRole('link',{name:n}).first().boundingBox(); console.log(w,n,Math.round(r.width),'x',Math.round(r.height)); }
}
await b.close();
