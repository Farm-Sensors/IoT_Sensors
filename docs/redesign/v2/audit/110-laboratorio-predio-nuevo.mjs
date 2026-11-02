import { chromium } from './lib-axe.mjs';
const B='http://localhost:5173', O=new URL('./results/laboratorio/', import.meta.url).pathname; const b=await chromium.launch();
const out=[];
const run=async(tag,email,pw,w,h,mob,paths)=>{
  const p=await (await b.newContext({viewport:{width:w,height:h},isMobile:mob})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto(B+'/'); await p.getByLabel('Correo Electrónico').fill(email); await p.getByLabel('Contraseña',{exact:true}).fill(pw); await p.getByRole('button',{name:'Iniciar Sesión'}).click(); await p.waitForTimeout(3200);
  for(const [n,u] of paths){ await p.goto(B+u); await p.waitForTimeout(3000);
    const ov=await p.evaluate(()=>{const m=document.querySelector('main'); return Math.max(document.documentElement.scrollWidth-innerWidth,(m?.scrollWidth??0)-(m?.clientWidth??0))});
    await p.screenshot({path:O+tag+'-'+n+'.png'}); out.push(`${tag} ${n}: h1="${await p.locator('h1').first().textContent().catch(()=>'-')}" desborde=${ov}`); }
  if(errs.length) out.push(tag+' ERRORES '+errs.slice(0,3).join(' | ')); await p.close();
};
await run('adm','admin@sensores.com','admin123',1366,900,false,[['inicio','/admin'],['equipos','/admin/gateways'],['equipo','/admin/gateways?gateway=19'],['nodos','/admin/nodos'],['mapa','/admin/mapa'],['clientes','/admin/predios/40/areas'],['area','/admin/areas/43']]);
await run('cli','alan2203mx@gmail.com','123',1366,900,false,[['predios','/cliente'],['predio','/cliente/predio/40'],['ahora','/cliente/area/43'],['historial','/cliente/area/43/historial'],['detalles','/cliente/area/43/detalles'],['mapa','/cliente/mapa'],['alertas','/cliente/alertas']]);
await run('clim','alan2203mx@gmail.com','123',390,844,true,[['predios','/cliente'],['ahora','/cliente/area/43']]);
console.log(out.join('\n')); await b.close();
