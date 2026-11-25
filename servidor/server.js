/* =========================================================
   SINTRABAS · servidor de conexiones (Node 18 o superior, sin dependencias obligatorias)
   Rutas:
     POST /sina            Asistente con modelo de IA (API de Anthropic)
     GET  /dominios?name=  Disponibilidad de dominios (GoDaddy Domains API)
     GET  /nombre/sic?q=   Marcas y nombres comerciales (SIPI, SIC)      [requiere: npm i playwright]
     GET  /nombre/rues?q=  Razón social (RUES)                            [requiere: npm i playwright]
     POST /contacto        Guarda solicitudes de contacto en contactos.jsonl
     GET  /salud           Qué está configurado
   Las llaves van en variables de entorno (ver .env.ejemplo). Nunca en el HTML.
   ========================================================= */
const http=require('http'), fs=require('fs'), path=require('path');
const E=process.env, PORT=+E.PORT||8787;
const ORIGIN=E.ORIGEN_PERMITIDO||'*';                         // en producción: https://sintrabas.co
const AI_URL=(E.ANTHROPIC_BASE_URL||'https://api.anthropic.com')+'/v1/messages';
const AI_MODEL=E.SINA_MODELO||'claude-haiku-5-5';
const NOMBRE=E.ASISTENTE_NOMBRE||'Sina';

const SISTEMA=ctx=>`Eres ${NOMBRE}, el asistente de SINTRABAS, una plataforma que orienta a personas que están creando un negocio en Bucaramanga, Colombia.
Reglas:
- Responde en español claro y cercano, sin jerga legal. Máximo 120 palabras, salvo que te pidan detalle.
- Usa primero los datos del contexto del usuario (su negocio, su ruta de trámites, el resultado de uso del suelo). No inventes costos, plazos, normas ni enlaces: si un dato no está en el contexto, dilo y remite a la entidad.
- Nombra siempre la entidad donde se hace el trámite.
- Das orientación, no asesoría legal ni contable. Si la pregunta lo requiere, sugiere un aliado de la plataforma.
- La homonimia de razón social la revisan las Cámaras de Comercio (RUES); las marcas, la SIC (SIPI). El uso del suelo lo certifica la Secretaría de Planeación.
- Si preguntan algo ajeno a emprender o formalizar un negocio, redirige con amabilidad.
Contexto del usuario (JSON): ${JSON.stringify(ctx||{}).slice(0,6000)}`;

async function sina(body){
  if(!E.ANTHROPIC_API_KEY) return [501,{error:'Falta ANTHROPIC_API_KEY'}];
  const mensajes=(body.mensajes||[]).filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string').slice(-12).map(m=>({role:m.role,content:m.content.slice(0,2000)}));
  if(!mensajes.length||mensajes[mensajes.length-1].role!=='user') return [400,{error:'El último mensaje debe ser del usuario'}];
  const r=await fetch(AI_URL,{method:'POST',headers:{'content-type':'application/json','x-api-key':E.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},
    body:JSON.stringify({model:AI_MODEL,max_tokens:500,system:SISTEMA(body.contexto),messages:mensajes})});
  const j=await r.json();
  if(!r.ok) return [502,{error:'El modelo no respondió',detalle:j.error&&j.error.message}];
  return [200,{respuesta:(j.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n').trim(),modelo:j.model}];
}

async function dominios(name){
  const s=String(name||'').toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,60);
  if(!s) return [400,{error:'Falta name'}];
  if(!E.GODADDY_TOKEN&&!E.GODADDY_KEY) return [501,{error:'Falta GODADDY_TOKEN o GODADDY_KEY/GODADDY_SECRET'}];
  const auth=E.GODADDY_TOKEN?`Bearer ${E.GODADDY_TOKEN}`:`sso-key ${E.GODADDY_KEY}:${E.GODADDY_SECRET}`;
  const out=await Promise.all(['com','com.co','co'].map(async t=>{
    const r=await fetch(`https://api.godaddy.com/v1/domains/available?domain=${s}.${t}&checkType=FAST`,{headers:{Authorization:auth,Accept:'application/json'}});
    const j=await r.json(); return {domain:`${s}.${t}`,available:!!j.available,definitive:!!j.definitive,ok:r.ok};
  }));
  return [200,out];
}

/* SIC y RUES no tienen API pública: se consulta su búsqueda pública con un navegador automatizado.
   BORRADOR: los pasos siguen la consulta manual, pero no se ha probado contra los sitios reales.
   Antes de producción: probar selectores, poner caché (24 h) y límite de consultas por minuto. */
let _browser=null;
async function pagina(){ let pw; try{ pw=require('playwright'); }catch(e){ return null; } _browser=_browser||await pw.chromium.launch(); return (await _browser.newContext({locale:'es-CO'})).newPage(); }
/* Variantes: exacta, raíz con comodín, prefijo, AND y fonética (mismo criterio de la consulta manual) */
function variantes(n){
  const N=n.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\b(S\.?A\.?S\.?|LTDA|S\.?A\.?)\b/g,'').replace(/\s+/g,' ').trim();
  const w=N.split(' '), raiz=w.slice().sort((a,b)=>b.length-a.length)[0].replace(/^(ASO|FUNDA|CORP|GRUPO)/,'')||w[0];
  const fon=N.replace(/K/g,'C').replace(/Z/g,'S').replace(/V/g,'B').replace(/(.)\1/g,'$1');
  const v=[`"${N}"`,`*${raiz}*`,`${w[0]}*`]; if(w.length>1) v.push(w.join(' AND ')); if(fon!==N) v.push(fon);
  return {N,lista:[...new Set(v)].slice(0,5)};
}
const LEER_TABLA=`[...document.querySelectorAll('table tr')].map(r=>[...r.cells].map(c=>c.innerText.trim())).filter(c=>/\\d{2}/.test(c.join(' '))&&c.join(' | ').length<400&&c.length>=7)`;
async function sic(q){
  const pg=await pagina(); if(!pg) return [501,{error:'Instala playwright: npm i playwright && npx playwright install chromium'}];
  try{
    const {N,lista}=variantes(q), vistos=new Map();
    for(const v of lista){
      await pg.goto('https://sipi.sic.gov.co/sipi/Extra/Default.aspx',{timeout:45000});
      await pg.getByText('Buscar',{exact:true}).first().click();              // Signos Distintivos → Buscar
      await pg.getByText('Búsqueda Avanzada').first().click();
      await pg.getByLabel('Denominación').first().fill(v);
      await pg.getByRole('button',{name:'Buscar'}).last().click();            // botón al final del formulario
      await pg.waitForTimeout(6000);
      // Columnas: Expediente | Certificado | Denominación | Etiqueta | Vigencia | Estado | Titular | Clases
      for(const c of await pg.evaluate(LEER_TABLA)) vistos.set(c[0],{expediente:c[0],certificado:c[1],denominacion:c[2],vigencia:c[4],estado:c[5],titular:c[6],clases:c[7],variante:v});
    }
    const marcas=[...vistos.values()], viva=m=>!/negad|caduc|cancel|desist|abandon/i.test(m.estado||'');
    const igual=marcas.filter(m=>(m.denominacion||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')===N&&viva(m));
    const estado=igual.length?'bad':marcas.length?'warn':'ok';   // rojo / amarillo / verde. La relación entre clases de Niza la revisa una persona.
    return [200,{estado,semaforo:{bad:'rojo',warn:'amarillo',ok:'verde'}[estado],src:'SIC · SIPI',variantes:lista,marcas:marcas.slice(0,40),
      msg:igual.length?`Hay ${igual.length} signo(s) vigentes o en trámite con esa misma denominación.`:marcas.length?`Hay ${marcas.length} signo(s) parecidos. Revisa clases, estado y titular.`:'Sin signos distintivos iguales ni parecidos en la SIC.'}];
  } finally { await pg.context().close(); }
}
async function rues(q){
  const pg=await pagina(); if(!pg) return [501,{error:'Instala playwright: npm i playwright && npx playwright install chromium'}];
  try{
    const out={};
    for(const tipo of ['RM','ESAL']){                                          // sociedades/comerciantes y entidades sin ánimo de lucro
      await pg.goto(`https://www.rues.org.co/buscar/${tipo}/${encodeURIComponent(q)}`,{timeout:45000});
      await pg.waitForTimeout(9000);                                           // los resultados cargan tarde
      out[tipo]=await pg.evaluate(()=>(document.querySelector('main')||document.body).innerText.slice(0,3000));
    }
    const rx=new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'), hay=Object.values(out).some(t=>rx.test(t)&&/matr[ií]cula|NIT/i.test(t)), activa=Object.values(out).some(t=>/ACTIV/i.test(t));
    const estado=hay?(activa?'bad':'warn'):'ok';
    return [200,{estado,semaforo:{bad:'rojo',warn:'amarillo',ok:'verde'}[estado],src:'RUES · Confecámaras',texto:out,
      msg:hay?(activa?'Hay una razón social igual o muy parecida, activa.':'Hay una razón social parecida, no activa.'):'Sin coincidencias de razón social en el RUES.'}];
  } finally { await pg.context().close(); }
}

const leer=req=>new Promise((ok,ko)=>{ let d=''; req.on('data',c=>{ d+=c; if(d.length>1e5){ ko(new Error('muy grande')); req.destroy(); } }); req.on('end',()=>{ try{ ok(d?JSON.parse(d):{}); }catch(e){ ko(e); } }); });
http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://x'), fin=(c,o)=>{ res.writeHead(c,{'content-type':'application/json; charset=utf-8','access-control-allow-origin':ORIGIN,'access-control-allow-headers':'content-type','access-control-allow-methods':'GET,POST,OPTIONS'}); res.end(JSON.stringify(o)); };
  try{
    if(req.method==='OPTIONS') return fin(204,{});
    if(u.pathname==='/salud') return fin(200,{ia:!!E.ANTHROPIC_API_KEY,modelo:AI_MODEL,godaddy:!!(E.GODADDY_TOKEN||E.GODADDY_KEY),navegador:(()=>{try{require.resolve('playwright');return true}catch(e){return false}})()});
    if(u.pathname==='/sina'&&req.method==='POST') return fin(...await sina(await leer(req)));
    if(u.pathname==='/dominios') return fin(...await dominios(u.searchParams.get('name')));
    if(u.pathname==='/nombre/sic') return fin(...await sic((u.searchParams.get('q')||'').slice(0,80)));
    if(u.pathname==='/nombre/rues') return fin(...await rues((u.searchParams.get('q')||'').slice(0,80)));
    if(u.pathname==='/contacto'&&req.method==='POST'){ fs.appendFileSync(path.join(__dirname,'contactos.jsonl'),JSON.stringify({...await leer(req),recibido:new Date().toISOString()})+'\n'); return fin(200,{ok:true}); }
    fin(404,{error:'Ruta no encontrada'});
  }catch(e){ fin(500,{error:'Error interno',detalle:String(e.message||e)}); }
}).listen(PORT,()=>console.log(`SINTRABAS servidor en http://localhost:${PORT}`));
