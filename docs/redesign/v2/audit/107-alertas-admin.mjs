import { chromium } from './lib-axe.mjs';
const B='http://localhost:5173', O=new URL('./results/alertas-admin/', import.meta.url).pathname; const b=await chromium.launch();
const now=Date.now(); const iso=(m)=>new Date(now-m*60000).toISOString().slice(0,19);
const mk=(id,over)=>({id,node_id:10+id,irrigation_area_id:[1,2,3,5][id%4],threshold_id:3,type:'threshold',parameter:'soil.humidity',detected_value:18.4,severity:'warning',message:'Humedad del suelo fuera de rango (18.4 %)',timestamp:iso(id*37),read:false,read_at:null,notified_email:false,notified_whatsapp:false,ai_recommendation:null,ai_recommendation_error:null,ai_recommendation_generated_at:null,ai_recommendation_metadata:null,created_at:iso(id*37),updated_at:iso(id*37),...over});
const items=[
 mk(1,{severity:'critical',detected_value:6.1,message:'Humedad del suelo crítica (6.1 %)',notified_email:true,notified_whatsapp:true}),
 mk(2,{type:'inactivity',parameter:null,detected_value:null,severity:'warning',message:'El nodo lleva 45 minutos sin enviar datos',threshold_id:null}),
 mk(3,{}), mk(4,{severity:'info',parameter:'environmental.eto',detected_value:7.9,message:'E.T.O. por encima del rango (7.9 mm/día)'}),
 mk(5,{read:true,read_at:iso(100),severity:'critical',parameter:'irrigation.flow_per_minute',detected_value:0,message:'Flujo de agua en 0 L/min con riego activo'}),
 mk(6,{read:true,read_at:iso(300),type:'inactivity',parameter:null,detected_value:null,message:'El nodo lleva 30 minutos sin enviar datos',threshold_id:null}),
];
const run=async(tag,w,h,mob,data)=>{
  const ctx=await b.newContext({viewport:{width:w,height:h},isMobile:mob}); const p=await ctx.newPage();
  await p.route('**/api/v1/alerts**',async r=>{const u=new URL(r.request().url()); const path=u.pathname;
    if(path.endsWith('/unread-count')){const aid=u.searchParams.get('irrigation_area_id'); return r.fulfill({json:{unread_count:data.filter(a=>!a.read&&(!aid||String(a.irrigation_area_id)===aid)).length}});}
    if(/\/alerts\/\d+\/recommendation$/.test(path)) return r.fulfill({json:{alert_id:1,recommendation:'Revisa el equipo de riego del área y confirma que la válvula abre.',source:'fallback',generated_at:iso(1),error_detail:null}});
    const m=path.match(/\/alerts\/(\d+)$/); if(m) return r.fulfill({json:items.find(a=>a.id==m[1])||items[0]});
    const aid=u.searchParams.get('irrigation_area_id'); const rows=aid?data.filter(a=>String(a.irrigation_area_id)===aid):data;
    return r.fulfill({json:{page:1,per_page:20,total:rows.length,data:rows}});});
  await p.goto(B+'/'); await p.getByLabel('Correo Electrónico').fill('admin@sensores.com'); await p.getByLabel('Contraseña',{exact:true}).fill('admin123'); await p.getByRole('button',{name:'Iniciar Sesión'}).click(); await p.waitForTimeout(3000);
  await p.goto(B+'/admin/alertas'); await p.waitForTimeout(2500); await p.screenshot({path:O+tag+'-lista.png',fullPage:true});
  if(data.length){ await p.goto(B+'/admin/alertas/1'); await p.waitForTimeout(2500); await p.screenshot({path:O+tag+'-detalle.png',fullPage:true}); }
};
await run('d',1366,900,false,items); await run('m',390,844,true,items);
await b.close();
