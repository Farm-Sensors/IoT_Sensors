import { chromium } from './lib-axe.mjs';
const B='http://localhost:5173', O=new URL('./results/umbrales-admin/', import.meta.url).pathname; const b=await chromium.launch();
const t=(id,area,parameter,min,max,severity,active=true)=>({id,irrigation_area_id:area,parameter,min_value:min,max_value:max,severity,active,created_at:'2026-10-20T10:00:00',updated_at:'2026-10-20T10:00:00'});
const items=[t(1,1,'soil.humidity',20,30,'warning'),t(2,1,'soil.humidity',null,10,'critical'),t(3,1,'irrigation.flow_per_minute',2,null,'warning'),t(4,1,'environmental.eto',null,7.5,'info',false),t(5,2,'soil.humidity',22,35,'warning'),t(6,3,'soil.temperature',5,38,'critical')];
const run=async(tag,w,h,mob,data,steps)=>{
  const p=await (await b.newContext({viewport:{width:w,height:h},isMobile:mob})).newPage();
  await p.route('**/api/v1/thresholds**',async r=>{ if(r.request().method()!=='GET') return r.abort(); const u=new URL(r.request().url()); const aid=u.searchParams.get('irrigation_area_id'); const par=u.searchParams.get('parameter'); const act=u.searchParams.get('active');
    let rows=data.filter(x=>(!aid||String(x.irrigation_area_id)===aid)&&(!par||x.parameter===par)&&(act===null||String(x.active)===act));
    return r.fulfill({json:{page:1,per_page:200,total:rows.length,data:rows}});});
  await p.goto(B+'/'); await p.getByLabel('Correo Electrónico').fill('admin@sensores.com'); await p.getByLabel('Contraseña',{exact:true}).fill('admin123'); await p.getByRole('button',{name:'Iniciar Sesión'}).click(); await p.waitForTimeout(3000);
  await p.goto(B+'/admin/umbrales'); await p.waitForTimeout(2500);
  await p.screenshot({path:O+tag+'-lista.png',fullPage:false});
  if(steps){ await p.getByRole('button',{name:'Nuevo umbral'}).first().click(); await p.waitForTimeout(600); await p.screenshot({path:O+tag+'-form.png'});
    await p.getByRole('button',{name:'Crear umbral'}).click(); await p.waitForTimeout(400); await p.screenshot({path:O+tag+'-form-error.png'}); await p.getByRole('button',{name:'Cancelar'}).click(); await p.waitForTimeout(300);
    await p.getByRole('button',{name:/Eliminar el umbral/}).first().click(); await p.waitForTimeout(500); await p.screenshot({path:O+tag+'-borrar.png'}); await p.getByRole('button',{name:'Cancelar'}).click(); }
  console.log(tag,'h1:',await p.locator('h1').first().textContent(),'| grupos:',await p.locator('main h2').allTextContents());
};
await run('d',1366,900,false,items,true); await run('m',390,844,true,items,false); await run('vacio',1366,700,false,[],false);
await b.close();
