import { chromium } from './lib-axe.mjs';
const B='http://localhost:5173', O=new URL('./results/final/', import.meta.url).pathname; const b=await chromium.launch();
const now=Date.now(); const iso=(m)=>new Date(now-m*60000).toISOString().slice(0,19);
const alert=(id,o)=>({id,node_id:10+id,irrigation_area_id:[1,2,3,5][id%4],threshold_id:3,type:'threshold',parameter:'soil.humidity',detected_value:18.4,severity:'warning',message:'Humedad del suelo fuera de rango (18.4 %)',timestamp:iso(id*37),read:false,read_at:null,notified_email:false,notified_whatsapp:false,ai_recommendation:null,ai_recommendation_error:null,ai_recommendation_generated_at:null,ai_recommendation_metadata:null,created_at:iso(id*37),updated_at:iso(id*37),...o});
const alerts=[alert(1,{severity:'critical',detected_value:6.1,message:'Humedad del suelo crítica (6.1 %)',notified_email:true,notified_whatsapp:true}),alert(2,{type:'inactivity',parameter:null,detected_value:null,message:'El nodo lleva 45 minutos sin enviar datos',threshold_id:null}),alert(3,{}),alert(4,{severity:'info',parameter:'environmental.eto',detected_value:7.9,message:'E.T.O. por encima del rango (7.9 mm/día)'}),alert(5,{read:true,read_at:iso(100),severity:'critical',parameter:'irrigation.flow_per_minute',detected_value:0,message:'Flujo de agua en 0 L/min con riego activo'})];
const th=(id,a,p,mn,mx,sv,ac=true)=>({id,irrigation_area_id:a,parameter:p,min_value:mn,max_value:mx,severity:sv,active:ac,created_at:'2026-10-20T10:00:00',updated_at:'2026-10-20T10:00:00'});
const thresholds=[th(1,1,'soil.humidity',20,30,'warning'),th(2,1,'irrigation.flow_per_minute',2,null,'critical'),th(3,2,'environmental.eto',null,7.5,'info',false)];
const rep=(id,st,o)=>({id,client_id:1,irrigation_area_id:null,range_start:iso(60*24*(id+1)),range_end:iso(60*24*id),status:st,summary:'La humedad del suelo bajó de forma sostenida en dos áreas; el flujo de agua se mantuvo estable.',findings:'• Nogal Norte: humedad a la baja.\n• Alfalfa Este: sin datos 45 min.',recommendation:'Revisar el nodo de Alfalfa Este.',generation_metadata:'{"provider":"rules-fallback"}',error_detail:null,generated_at:iso(60*24*id-30),created_at:iso(60*24*id),updated_at:iso(60*24*id),...o});
const reports=[rep(1,'completed'),rep(2,'processing',{summary:null}),rep(3,'failed',{summary:null,error_detail:'El servicio de IA no respondió'})];
const usage={page:1,per_page:20,total:3,window_hours:24,summary:{total_requests:12,successful_requests:10,ai_responses:7,fallback_responses:3,error_requests:1,rate_limited_requests:1,total_prompt_tokens:8123,total_completion_tokens:960,avg_latency_ms:1420},data:[
 {id:1,created_at:iso(20),user_id:1,user_email:'admin@sensores.com',user_name:'Administrador',action:'execute',source:'ai',provider:'azure-openai',model:'gpt-x',latency_ms:1320,tokens_prompt:812,tokens_completion:96,status_code:200,error_detail:null,client_id:1,irrigation_area_id:1,hours_back:72},
 {id:2,created_at:iso(55),user_id:2,user_email:'alan2203mx@gmail.com',user_name:'Alan Test',action:'error',source:null,provider:null,model:null,latency_ms:null,tokens_prompt:null,tokens_completion:null,status_code:503,error_detail:'Servicio no disponible',client_id:1,irrigation_area_id:null,hours_back:24},
 {id:3,created_at:iso(90),user_id:2,user_email:'alan2203mx@gmail.com',user_name:'Alan Test',action:'rate_limited',source:null,provider:null,model:null,latency_ms:null,tokens_prompt:null,tokens_completion:null,status_code:429,error_detail:null,client_id:1,irrigation_area_id:null,hours_back:24}]};
const results=[];
const run=async(tag,{w,h,mob,dark,role,paths})=>{
  const ctx=await b.newContext({viewport:{width:w,height:h},isMobile:mob}); await ctx.addInitScript((d)=>{try{localStorage.setItem('app-ui-theme',d?'dark':'light')}catch(e){}},dark);
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push('PAGE '+e)); p.on('console',m=>{if(m.type()==='error'&&!/status of (401|404|409|429|503)/.test(m.text()))errs.push(m.text().slice(0,120))});
  await p.route('**/api/v1/**',async r=>{const u=new URL(r.request().url()); const path=u.pathname.replace('/api/v1','');
    if(r.request().method()!=='GET') return path.startsWith('/auth')?r.continue():r.abort();
    if(path==='/alerts/unread-count') return r.fulfill({json:{unread_count:4}});
    if(/^\/alerts\/\d+\/recommendation/.test(path)) return r.fulfill({json:{alert_id:1,recommendation:'Revisa el equipo del área.',source:'fallback',generated_at:iso(1),error_detail:null}});
    if(/^\/alerts\/\d+$/.test(path)) return r.fulfill({json:alerts[0]});
    if(path==='/alerts'){const aid=u.searchParams.get('irrigation_area_id'); const rd=u.searchParams.get('read'); let rows=alerts.filter(a=>(!aid||String(a.irrigation_area_id)===aid)&&(rd===null||String(a.read)===rd)); return r.fulfill({json:{page:1,per_page:20,total:rows.length,data:rows}});}
    if(path==='/thresholds') return r.fulfill({json:{page:1,per_page:200,total:thresholds.length,data:thresholds}});
    if(/^\/ai-reports\/\d+$/.test(path)) return r.fulfill({json:reports[0]});
    if(path==='/ai-reports') return r.fulfill({json:{page:1,per_page:20,total:reports.length,data:reports}});
    if(path.startsWith('/ai-assistant/usage')) return r.fulfill({json:usage});
    return r.continue();});
  await p.goto(B+'/'); await p.getByLabel('Correo Electrónico').fill(role==='admin'?'admin@sensores.com':'alan2203mx@gmail.com'); await p.getByLabel('Contraseña',{exact:true}).fill(role==='admin'?'admin123':'123'); await p.getByRole('button',{name:'Iniciar Sesión'}).click(); await p.waitForTimeout(3200);
  for(const [n,u,extra] of paths){ await p.goto(B+u); await p.waitForTimeout(2300); if(extra) await extra(p);
    const overflow=await p.evaluate(()=>{const m=document.querySelector('main'); const el=m||document.documentElement; return Math.max(document.documentElement.scrollWidth-window.innerWidth, el.scrollWidth-el.clientWidth)});
    await p.screenshot({path:O+tag+'-'+n+'.png'}); results.push(`${tag} ${n}: h1="${await p.locator('h1').first().textContent().catch(()=> '-')}" desborde=${overflow}px`);}
  if(errs.length) results.push(`${tag} ERRORES: ${[...new Set(errs)].slice(0,4).join(' | ')}`);
  await ctx.close();
};
const adminPaths=[['hoy','/admin'],['alertas','/admin/alertas'],['alerta','/admin/alertas/1'],['umbrales','/admin/umbrales'],['chat','/admin/asistente-ia'],['reportes','/admin/reportes-ia'],['reporte','/admin/reportes-ia/1'],['consumo','/admin/consumo-ia'],['campana','/admin',async p=>{await p.getByRole('button',{name:/^Alertas/}).click(); await p.waitForTimeout(700);}]];
const clientPaths=[['predios','/cliente'],['alertas','/cliente/alertas'],['umbrales','/cliente/umbrales'],['notif','/cliente/notificaciones',async p=>{await p.getByRole('button',{name:'Elegir avisos'}).first().click().catch(()=>{}); await p.waitForTimeout(500);}],['chat','/cliente/asistente-ia'],['reportes','/cliente/reportes-ia']];
await run('adm-claro',{w:1366,h:860,mob:false,dark:false,role:'admin',paths:adminPaths});
await run('adm-oscuro',{w:1366,h:860,mob:false,dark:true,role:'admin',paths:adminPaths});
await run('adm-movil',{w:390,h:844,mob:true,dark:false,role:'admin',paths:adminPaths});
await run('cli-claro',{w:1366,h:860,mob:false,dark:false,role:'client',paths:clientPaths});
await run('cli-oscuro',{w:1366,h:860,mob:false,dark:true,role:'client',paths:clientPaths});
await run('cli-movil',{w:390,h:844,mob:true,dark:false,role:'client',paths:clientPaths});
console.log(results.join('\n')); await b.close();
