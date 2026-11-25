/* Revisa que el enlace de cada trámite responda. Uso: node verificar-enlaces.js */
const ENLACES={
 'RUT · DIAN':'https://www.dian.gov.co/',
 'Uso del suelo · consulta oficial de la Alcaldía':'https://consultadesarrolloactividadeconomica.bucaramanga.gov.co/',
 'Uso del suelo · concepto formal':'https://camevirtual.bucaramanga.gov.co/tramites/121/concepto-de-uso-del-suelo/',
 'Nombre y marca · SIC (SIPI)':'https://sipi.sic.gov.co/sipi/Extra/Default.aspx',
 'Razón social · RUES':'https://www.rues.org.co/',
 'Matrícula, SAS y renovación · Cámara de Comercio de Bucaramanga':'https://www.camaradirecta.com/',
 'Industria y Comercio, sanitario, licor · Alcaldía':'https://camevirtual.bucaramanga.gov.co/tramites/',
 'Bomberos de Bucaramanga':'https://bomberosdebucaramanga.gov.co/contenido/inspecciones-comerciales/',
 'Sayco & Acinpro · OSA':'https://www.osa.org.co/',
 'Manipulación de alimentos · SENA':'https://www.sena.edu.co/',
 'INVIMA':'https://www.invima.gov.co/',
 'Seguridad social · Mi Seguridad Social':'https://www.miseguridadsocial.gov.co/',
 'Facturación electrónica · DIAN':'https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/',
 'Registro Nacional de Turismo':'https://rnt.confecamaras.co/',
 'Habilitación en salud · REPS':'https://prestadores.minsalud.gov.co/habilitacion/'};
(async()=>{ for(const [n,u] of Object.entries(ENLACES)){ try{ const r=await fetch(u,{redirect:'follow',signal:AbortSignal.timeout(20000),headers:{'user-agent':'Mozilla/5.0'}}); console.log(r.ok?'OK  ':'FALLA',r.status,n,'→',r.url); }catch(e){ console.log('FALLA  — ',n,'→',u,'(',e.cause&&e.cause.code||e.name,')'); } } })();
