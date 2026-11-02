import { chromium } from './lib-axe.mjs';
const b=await chromium.launch(); const p=await b.newPage();
p.on('response',r=>{if(r.status()>=400)console.log(r.status(),r.url())});
await p.goto('http://localhost:5173/'); await p.waitForTimeout(1500);
await p.getByLabel('Correo Electrónico').fill('alan2203mx@gmail.com'); await p.getByLabel('Contraseña',{exact:true}).fill('123'); await p.getByRole('button',{name:'Iniciar Sesión'}).click(); await p.waitForTimeout(3000);
await p.goto('http://localhost:5173/cliente/area/1'); await p.waitForTimeout(3000); await b.close();
