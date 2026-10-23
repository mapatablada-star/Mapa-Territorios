/* Panel de asignacion rapida. Modulo aislado; no altera el editor o el mapa. */
(function () {
"use strict";
if (window.__quickAssignV1) return;
window.__quickAssignV1 = true;

const $ = id => document.getElementById(id);
const make = (tag, className, content) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) element.textContent = String(content);
  return element;
};
const formatDate = date => date ? String(date).slice(0,10).split("-").reverse().join("/") : "—";
const statusLabels = {available:"Disponible", assigned:"Asignado", done:"Recién completado"};
const state = record => {
  if (record.estado !== "done" || !record.fecha_ultima_visita) return record.estado || "available";
  const start = Date.parse(record.fecha_ultima_visita + "T00:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Number.isFinite(start) && Math.floor((today-start)/86400000)>=28 ? "available" : "done";
};
const editable = () => typeof currentUser !== "undefined" && !!currentUser &&
  typeof currentRole !== "undefined" && (currentRole==="admin" || currentRole==="usuario");
const n = value => String(value===null || value===undefined ? "" : value);
const hasLock = id => typeof otherEditorFor === "function" && !!otherEditorFor(id);
const freshRows = async () => {
  const [a,b] = await Promise.all([
    db.from("territorios").select("id,numero,manzanas,estado,fecha_asignacion,fecha_ultima_visita,asignado_a,persona,observaciones,updated_at").order("numero"),
    db.from("territorio_partes").select("id,territorio_id,orden,manzanas,estado,fecha_asignacion,fecha_ultima_visita,asignado_a,persona,observaciones,version").order("territorio_id").order("orden")
  ]);
  if (a.error) throw a.error;
  if (b.error) throw b.error;
  return {territories:a.data||[], parts:b.data||[]};
};

const style=make("style");
style.textContent = [
"#qaOpen{background:#e9f3ff!important;color:#123b66!important;border:1px solid #b8d3ee!important;padding:9px 12px!important;font-weight:800!important;cursor:pointer!important}",
"#qaOpen:hover{background:#fff!important}",
"#qaMask[hidden]{display:none!important}",
"#qaMask{position:fixed;inset:0;background:rgba(8,22,38,.73);z-index:2147483000;display:flex;justify-content:center;align-items:center;padding:12px;box-sizing:border-box}",
"#qaWindow{width:min(1100px,100%);max-height:94vh;overflow:auto;border-radius:18px;background:#f6f9fd;color:#172b45;box-shadow:0 30px 90px rgba(0,0,0,.4);padding:20px;box-sizing:border-box}",
"#qaWindow *{box-sizing:border-box}",
"#qaWindow h2{margin:0;font-size:22px;color:#173450}",
"#qaWindow p{margin:5px 0 12px}",
"#qaWindow button{cursor:pointer;border-radius:9px;padding:9px 12px;font-weight:750;min-height:38px}",
"#qaWindow input,#qaWindow select{border:1px solid #b9cce0;border-radius:8px;padding:8px;width:100%;background:#fff;color:#172b45;min-height:39px}",
"#qaWindow input[type=checkbox]{width:18px;min-height:18px;height:18px;flex:0 0 auto;accent-color:#2475d3}",
"#qaWindow label{font-size:12px;font-weight:750;display:block;color:#385572;margin:0}",
"#qaHead{display:flex;gap:10px;justify-content:space-between;align-items:flex-start;margin-bottom:14px}",
"#qaClose{background:#e8eef4;color:#21405e;border:1px solid #c9d6e4}",
"#qaCols{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:14px}",
".qaBlock{border:1px solid #d5e0ed;border-radius:14px;background:#fff;padding:13px;min-width:0}",
".qaBlock h3{margin:0 0 10px;font-size:15px;color:#163a5c}",
".qaLine{display:flex;gap:8px;align-items:center;margin-bottom:10px}",
".qaLine input{flex:1}",
".qaGhost{background:#eaf3fb;color:#1d4d76;border:1px solid #bcd4e9}",
"#qaList{overflow-y:auto;max-height:51vh;border-top:1px solid #e4eaf1}",
".qaTerr{padding:11px 3px;border-bottom:1px solid #e8eef4}",
".qaTerrHead{font-size:13px;font-weight:850;color:#153650;margin-bottom:7px}",
".qaChoice{display:flex!important;align-items:center;gap:9px;padding:7px 10px!important;margin:5px 0!important;background:#f5f9fe;border:1px solid #dce8f5;border-radius:9px;cursor:pointer}",
".qaChoice:has(input:checked){background:#e7f2ff;border-color:#86b3e7}",
".qaChoice b{font-size:13px;color:#173c5b}",
".qaChoice small{color:#64748b;font-size:11px}",
".qaTag{display:inline-block;padding:3px 7px;border-radius:6px;font-size:11px;font-weight:800}",
".qaTag.available{background:#def8e8;color:#13683e}",
".qaTag.assigned{background:#dceaff;color:#204fac}",
".qaTag.done{background:#ffe3e5;color:#a2374a}",
".qaField{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:10px}",
".qaField>div{min-width:0}",
".qaField label{margin-bottom:4px!important}",
".qaFull{grid-column:1/-1}",
".qaPair{display:grid;grid-template-columns:minmax(0,1fr) 30px minmax(0,1fr);gap:7px;align-items:end;margin-bottom:10px}",
".qaPair>div{min-width:0}",
".qaPair label{margin-bottom:4px!important}",
".qaEq{width:30px!important;min-width:30px!important;height:39px!important;min-height:39px!important;padding:0!important;align-self:end;background:#eaf3fb;color:#1d4d76;border:1px solid #bcd4e9;font-size:15px;line-height:1}",
".qaEq:focus-visible{outline:2px solid #2563eb;outline-offset:2px}",
".qaInputClear{display:grid;grid-template-columns:minmax(0,1fr) 25px;gap:4px;align-items:center}",
".qaClear{width:25px!important;min-width:25px!important;height:25px!important;min-height:25px!important;padding:0!important;border-radius:6px!important;background:#f1f5f9;color:#64748b;border:1px solid #d6e0ea;font-size:13px;line-height:1}",
".qaClear:hover{background:#fee2e2;color:#b91c1c;border-color:#fecaca}",
"#qaPreview{margin-top:14px;padding:12px;background:#fff;border:1px solid #d6e2ee;border-radius:12px}",
"#qaPreviewRows{max-height:27vh;overflow:auto;font-size:12px;line-height:1.5}",
".qaPreviewLine{padding:7px 0;border-bottom:1px solid #e9eef5}",
"#qaMessage{font-weight:750;font-size:12px;line-height:1.5;min-height:18px;margin:10px 0}",
"#qaSave{background:#156f4a;color:white;border:0}",
"#qaSave:disabled{opacity:.42;cursor:not-allowed}",
".qaNote{color:#52677f;font-size:12px;line-height:1.5}",
"@media(max-width:760px){#qaWindow{padding:12px;max-height:97vh}#qaCols{grid-template-columns:1fr}#qaList{max-height:35vh}.qaField{grid-template-columns:1fr}.qaPair{grid-template-columns:minmax(0,1fr) 28px minmax(0,1fr);gap:5px}.qaPair label{font-size:11px!important}}"
].join("\n");
document.head.appendChild(style);

const toolbar=document.querySelector("header .toolbar") || document.querySelector(".toolbar") || document.querySelector("header");
if (!toolbar) return;
const openButton=make("button","","⚡ Asignación rápida");
openButton.id="qaOpen"; openButton.type="button";
toolbar.appendChild(openButton);

const mask=make("div"); mask.id="qaMask"; mask.hidden=true;
mask.setAttribute("role","dialog"); mask.setAttribute("aria-modal","true");
mask.setAttribute("aria-label","Panel de asignación rápida");
const win=make("div"); win.id="qaWindow"; mask.appendChild(win);
win.innerHTML=
'<div id="qaHead"><div><h2>Asignación rápida</h2><p class="qaNote">Seleccioná territorios o partes existentes, revisá y confirmá antes de guardar.</p></div><button type="button" id="qaClose">✕ Cerrar</button></div>'+
'<div id="qaCols"><section class="qaBlock"><h3>1. Elegí los territorios</h3><div class="qaLine"><input id="qaSearch" placeholder="Buscar número, nombre o manzana" aria-label="Buscar territorio"><button type="button" class="qaGhost" id="qaRefresh">Actualizar</button></div><p class="qaNote" id="qaSelected">0 seleccionados</p><div id="qaList"></div></section>'+
'<section class="qaBlock"><h3>2. Completá los datos</h3>'+
'<div class="qaField"><div class="qaFull"><label for="qaAction">Operación</label><select id="qaAction"><option value="assigned">Asignar</option><option value="done">Marcar como completado</option><option value="available">Dejar disponible</option></select></div></div>'+
'<div class="qaPair"><div><label for="qaName">Asignado a</label><div class="qaInputClear"><input id="qaName" maxlength="200" placeholder="Nombre o grupo"><button type="button" class="qaClear" data-clear="qaName" title="Borrar asignado a" aria-label="Borrar asignado a">×</button></div></div><button type="button" class="qaEq" id="qaCopyName" title="Copiar Asignado a a Realizado por" aria-label="Copiar Asignado a a Realizado por">=</button><div><label for="qaPerson">Realizado por</label><div class="qaInputClear"><input id="qaPerson" maxlength="200" placeholder="Nombre"><button type="button" class="qaClear" data-clear="qaPerson" title="Borrar realizado por" aria-label="Borrar realizado por">×</button></div></div></div>'+
'<div class="qaPair"><div><label for="qaAssignedDate">Fecha de asignación</label><div class="qaInputClear"><input type="date" id="qaAssignedDate"><button type="button" class="qaClear" data-clear="qaAssignedDate" title="Borrar fecha de asignación" aria-label="Borrar fecha de asignación">×</button></div></div><button type="button" class="qaEq" id="qaCopyDate" title="Copiar Fecha de asignación a Fecha de visita" aria-label="Copiar Fecha de asignación a Fecha de visita">=</button><div><label for="qaVisitDate">Fecha de visita</label><div class="qaInputClear"><input type="date" id="qaVisitDate"><button type="button" class="qaClear" data-clear="qaVisitDate" title="Borrar fecha de visita" aria-label="Borrar fecha de visita">×</button></div></div></div>'+
'<p class="qaNote" id="qaHelp">Al asignar, se limpia la fecha de visita anterior. Las observaciones se conservan.</p>'+
'<button type="button" class="qaGhost" id="qaReview">3. Revisar cambios</button>'+
'<div id="qaMessage" role="status" aria-live="polite"></div>'+
'<div id="qaPreview" hidden><b>Vista previa — todavía no se guardó nada</b><div id="qaPreviewRows"></div><p class="qaNote">Se comprobarán nuevamente los datos y permisos antes de guardar. Cada territorio se guarda por separado.</p><button type="button" id="qaSave" disabled>Confirmar y guardar</button></div></section></div>';
document.body.appendChild(mask);

let territories=[],parts=[],selected=new Set(),planned=null,busy=false;
const message=(value,bad=false)=>{const node=$("qaMessage");node.textContent=value||"";node.style.color=bad?"#b91c1c":"#17623f";};
const invalidate=()=>{planned=null;$("qaPreview").hidden=true;$("qaSave").disabled=true;message("");};
const keyFor=(row,isPart)=> (isPart?"p:":"t:")+String(row.id);
const groupParts=id=>parts.filter(p=>String(p.territorio_id)===String(id)).sort((a,b)=>a.orden-b.orden);
const sortedTerritories=()=>territories.slice().sort((a,b)=>Number(a.numero)-Number(b.numero));
function selectedRecords(){
 return [...selected].map(key=>{
  const [type,id]=key.split(":");
  return type==="p" ? parts.find(p=>String(p.id)===id) : territories.find(t=>String(t.id)===id);
 }).filter(Boolean);
}
function syncFieldsFromSelection(){
 const rows=selectedRecords();
 const fields=[
  ["qaName","asignado_a","Nombre o grupo",false],
  ["qaPerson","persona","Nombre",false],
  ["qaAssignedDate","fecha_asignacion","",true],
  ["qaVisitDate","fecha_ultima_visita","",true]
 ];
 for(const [inputId,field,emptyPlaceholder,isDate] of fields){
  const input=$(inputId);
  input.placeholder=emptyPlaceholder || (isDate?"":"");
  if(!rows.length){input.value="";continue;}
  const values=rows.map(row=>{
   const value=row[field];
   return value==null?"":(isDate?String(value).slice(0,10):String(value));
  });
  const distinct=[...new Set(values)];
  if(distinct.length===1){
   input.value=distinct[0];
   input.placeholder=emptyPlaceholder;
  }else{
   input.value="";
   input.placeholder=isDate?"Fechas distintas":"Valores distintos";
  }
 }
}
function choice(row,isPart,label){
  const line=make("label","qaChoice");
  const check=make("input");check.type="checkbox";
  const key=keyFor(row,isPart);check.checked=selected.has(key);
  check.setAttribute("aria-label",label);
  check.onchange=()=>{if(check.checked)selected.add(key);else selected.delete(key);invalidate();syncFieldsFromSelection();renderList();};
  const txt=make("span");
  const bold=make("b","",label);
  const detailParts=[];
  if(!isPart) detailParts.push((row.manzanas||1)+" manzana(s)");
  detailParts.push(row.asignado_a?"Asignado a: "+row.asignado_a:"Sin asignar");
  detailParts.push(row.fecha_asignacion?"Fecha: "+formatDate(row.fecha_asignacion):"Sin fecha");
  const detail=make("small","", " · "+detailParts.join(" · "));
  const tag=make("span","qaTag "+state(row),statusLabels[state(row)]||"Disponible");
  txt.append(bold,detail);
  line.append(check,txt,tag);
  return line;
}
function renderList(){
 const list=$("qaList");list.replaceChildren();
 const query=$("qaSearch").value.trim().toLowerCase();
 for (const t of sortedTerritories()){
  const ps=groupParts(t.id);
  const terms=[t.numero,t.asignado_a,t.persona,...ps.flatMap(p=>[p.manzanas,p.asignado_a,p.persona])]
    .join(" ").toLowerCase();
  if(query && !terms.includes(query))continue;
  const card=make("div","qaTerr");
  const title=make("div","qaTerrHead","Territorio "+t.numero+(ps.length?" · "+ps.length+" partes":""));
  card.appendChild(title);
  if(ps.length){
    for(const p of ps)card.appendChild(choice(p,true,"Parte "+p.orden+" · manzanas "+p.manzanas));
  }else card.appendChild(choice(t,false,"Territorio completo"));
  list.appendChild(card);
 }
 if(!list.children.length)list.appendChild(make("p","qaNote","No se encontraron territorios."));
 $("qaSelected").textContent=selected.size+" seleccionado(s). Las divisiones existentes se muestran por manzanas y estado.";
}
async function refresh(){
 if(!editable()){message("Necesitás iniciar sesión como administrador o usuario para usar el panel.",true);return;}
 message("Cargando datos actualizados...");
 const r=await freshRows();
 territories=r.territories;parts=r.parts;
 selected.clear();invalidate();syncFieldsFromSelection();renderList();
 message("Lista actualizada. No se modificó ningún territorio.");
}
function resolveNew(old,act,form){
 const next={...old};
 if(act==="assigned"){
  if(!form.name||!form.assignedDate)throw Error("Para asignar, completá «Asignado a» y la fecha de asignación.");
  next.estado="assigned";
  next.asignado_a=form.name;
  next.fecha_asignacion=form.assignedDate;
  next.fecha_ultima_visita=null;
  next.persona="";
 }else if(act==="done"){
  next.estado="done";
  next.asignado_a=form.name||n(old.asignado_a);
  next.fecha_asignacion=form.assignedDate||old.fecha_asignacion||null;
  next.fecha_ultima_visita=form.visitDate||null;
  next.persona=form.person||"";
  if(!next.asignado_a||!next.fecha_asignacion||!next.fecha_ultima_visita||!next.persona)
    throw Error("Para completar, indicá asignado a, fecha de asignación, fecha de visita y realizado por (podés conservar los existentes).");
 }else if(act==="available"){
  next.estado="available";
  // Los campos se precargan con los valores existentes; si el usuario los borra, se guarda el borrado.
  next.asignado_a=form.name||"";
  next.persona=form.person||"";
  next.fecha_asignacion=form.assignedDate||null;
  next.fecha_ultima_visita=form.visitDate||null;
 }
 if(next.fecha_ultima_visita && next.fecha_asignacion && next.fecha_ultima_visita<next.fecha_asignacion)
   throw Error("La fecha de visita no puede ser anterior a la fecha de asignación.");
 return next;
}
const valuesEqual=(a,b)=>["estado","fecha_asignacion","fecha_ultima_visita","asignado_a","persona"].every(k=>n(a[k])===n(b[k]));
async function review(){
 invalidate();
 if(!editable())throw Error("No tenés permiso para modificar territorios.");
 if(!selected.size)throw Error("Elegí por lo menos un territorio o una parte.");
 const form={name:$("qaName").value.trim(),person:$("qaPerson").value.trim(),
  assignedDate:$("qaAssignedDate").value,visitDate:$("qaVisitDate").value};
 const act=$("qaAction").value;
 if(act==="done" && (!form.visitDate || !form.person))
   throw Error("Para completar, indicá la fecha de visita y quién lo realizó.");
 const live=await freshRows();
 const all=new Map(live.territories.map(t=>[String(t.id),t]));
 const byTerr=new Map();
 live.parts.forEach(p=>{
  const id=String(p.territorio_id);
  if(!byTerr.has(id))byTerr.set(id,[]);
  byTerr.get(id).push(p);
 });
 const groups=[];
 for(const [key,idString] of [...selected].map(k=>[k,k.split(":")[1]])){
   let tid,selectedPart=null;
   if(key.startsWith("p:")){
     selectedPart=live.parts.find(p=>String(p.id)===idString);
     if(!selectedPart)throw Error("Una parte seleccionada ya no existe. Actualizá la lista.");
     tid=String(selectedPart.territorio_id);
   }else tid=idString;
   const territory=all.get(tid);
   if(!territory)throw Error("Un territorio seleccionado ya no existe.");
   const availableParts=(byTerr.get(tid)||[]).sort((a,b)=>a.orden-b.orden);
   if(key.startsWith("t:") && availableParts.length)throw Error("Un territorio pasó a estar dividido. Actualizá la lista.");
   if(key.startsWith("p:") && !availableParts.length)throw Error("La división de un territorio cambió. Actualizá la lista.");
   let group=groups.find(g=>String(g.t.id)===tid);
   if(!group){
     group={t:territory,originalParts:availableParts,changes:new Map()};
     groups.push(group);
   }
   const old=selectedPart||territory;
   if(hasLock(territory.id))throw Error("Otro usuario está editando el territorio "+territory.numero+".");
   const updated=resolveNew(old,act,form);
   if(!valuesEqual(updated,old))group.changes.set(key,{key,old,next:updated});
 }
 const active=groups.filter(g=>g.changes.size>0);
 if(!active.length)throw Error("No hay cambios nuevos para guardar.");
 planned=active;
 const rows=$("qaPreviewRows");rows.replaceChildren();
 let count=0;
 for(const g of active){
   for(const ch of g.changes.values()){
     count++;
     const target=ch.key.startsWith("p:")?"parte "+ch.old.orden+" ("+ch.old.manzanas+")":"territorio completo";
     const info="Territorio "+g.t.numero+" · "+target+
      " | "+(statusLabels[state(ch.old)]||ch.old.estado)+" → "+statusLabels[ch.next.estado]+
      " | Asignado a: "+(ch.next.asignado_a||"—")+
      " | Fecha de asignación: "+formatDate(ch.next.fecha_asignacion)+
      " | Visita: "+formatDate(ch.next.fecha_ultima_visita)+
      " | Realizado por: "+(ch.next.persona||"—");
     rows.appendChild(make("div","qaPreviewLine",info));
   }
 }
 $("qaPreview").hidden=false;
 $("qaSave").disabled=false;
 message("Revisá "+count+" cambio(s) en "+active.length+" territorio(s) antes de confirmar.");
}
function partsSnapshot(list){
 return list.map(p=>({id:Number(p.id),version:Number(p.version)})).sort((a,b)=>a.id-b.id);
}
async function assertUnchanged(group){
 const tRes=await db.from("territorios").select("id,updated_at").eq("id",group.t.id).single();
 if(tRes.error || !tRes.data || n(tRes.data.updated_at)!==n(group.t.updated_at))
   throw Error("El territorio "+group.t.numero+" fue modificado por otra persona. Revisá nuevamente.");
 const pRes=await db.from("territorio_partes").select("id,version").eq("territorio_id",group.t.id).order("id");
 if(pRes.error)throw pRes.error;
 if(JSON.stringify(partsSnapshot(pRes.data||[]))!==JSON.stringify(partsSnapshot(group.originalParts)))
   throw Error("Las partes del territorio "+group.t.numero+" cambiaron. Revisá nuevamente.");
 if(hasLock(group.t.id))throw Error("Otro usuario está editando el territorio "+group.t.numero+".");
}
async function writeGroup(group,session){
 await assertUnchanged(group);
 if(group.originalParts.length){
   const updated=group.originalParts.map(p=>{
     const change=group.changes.get("p:"+p.id);
     const row=change?change.next:p;
     return {id:p.id,manzanas:p.manzanas,estado:row.estado,
       fecha_asignacion:row.fecha_asignacion||null,fecha_ultima_visita:row.fecha_ultima_visita||null,
       asignado_a:row.asignado_a||"",persona:row.persona||"",observaciones:row.observaciones||""};
   });
   const {error}=await db.rpc("guardar_territorio_partes",{
     p_territorio_id:Number(group.t.id),p_expected:partsSnapshot(group.originalParts),p_partes:updated
   });
   if(error)throw error;
 }else{
   const changed=[...group.changes.values()][0].next;
   const res=await fetch("https://pmogqedfxspyudezyvwd.supabase.co/functions/v1/smooth-endpoint",{
     method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+session.access_token},
     body:JSON.stringify({
       accion:"actualizar_territorio",id:group.t.id,numero:group.t.numero,manzanas:group.t.manzanas,
       estado:changed.estado,fecha_asignacion:changed.fecha_asignacion||null,
       fecha_ultima_visita:changed.fecha_ultima_visita||null,
       asignado_a:changed.asignado_a||"",persona:changed.persona||"",
       observaciones:changed.observaciones||""
     })
   });
   const body=await res.json().catch(()=>({}));
   if(!res.ok || !body.ok)throw Error(body.mensaje||body.error||"No se pudo guardar el territorio "+group.t.numero+".");
 }
}
async function save(){
 if(!planned || busy || !editable())return;
 const num=[...planned].reduce((a,g)=>a+g.changes.size,0);
 if(!confirm("¿Confirmás "+num+" cambio(s) en "+planned.length+" territorio(s)? Los cambios reales quedarán registrados en Supabase."))return;
 busy=true;$("qaSave").disabled=true;$("qaReview").disabled=true;$("qaRefresh").disabled=true;
 const totalGroups=planned.length;
 let completed=0,failed=null;
 try{
   const s=await db.auth.getSession();
   const session=s.data && s.data.session;
   if(!session)throw Error("La sesión venció. Volvé a iniciar sesión.");
   for(const group of planned){
     message("Guardando territorio "+group.t.numero+"...");
     try{await writeGroup(group,session);completed++;}catch(err){failed=err;break;}
   }
 }catch(err){failed=err;}
 try{await loadTerritories();}catch(err){console.warn("No se pudo actualizar la lista:",err);}
 planned=null;$("qaPreview").hidden=true;
 try{const r=await freshRows();territories=r.territories;parts=r.parts;selected.clear();renderList();}
 catch(err){console.warn("No se pudo actualizar el panel",err);}
 if(failed)message("Se guardaron "+completed+" de "+totalGroups+" territorios seleccionados. Se detuvo la operación: "+(failed.message||failed)+". Revisá los cambios antes de intentar nuevamente.",true);
 else message("Se guardaron "+completed+" territorio(s) correctamente. El mapa y los historiales se actualizaron.");
 busy=false;$("qaReview").disabled=false;$("qaRefresh").disabled=false;
}
function formChanged(){invalidate();}
for(const id of ["qaAction","qaName","qaPerson","qaAssignedDate","qaVisitDate"])
  $(id).addEventListener("input",formChanged);
$("qaAction").addEventListener("change",()=>{
 const op=$("qaAction").value;
 $("qaHelp").textContent=op==="assigned"
  ?"Asignar limpia la fecha de visita y «Realizado por» anteriores; conserva observaciones."
  :op==="done"
  ?"Al completar, ingresá la fecha real de visita y quién lo realizó. Se conserva la asignación existente si dejás esos campos vacíos."
  :"Disponible conserva las fechas, los nombres y las observaciones anteriores.";
});
$("qaSearch").addEventListener("input",renderList);
$("qaCopyName").onclick=()=>{$("qaPerson").value=$("qaName").value;invalidate();};
$("qaCopyDate").onclick=()=>{$("qaVisitDate").value=$("qaAssignedDate").value;invalidate();};
for(const button of mask.querySelectorAll("[data-clear]")){
 button.onclick=()=>{const field=$(button.dataset.clear);field.value="";invalidate();field.focus();};
}
$("qaReview").onclick=async()=>{
 try{message("Verificando territorios...");await review();}catch(err){message(err.message||String(err),true);}
};
$("qaSave").onclick=save;
$("qaRefresh").onclick=async()=>{try{await refresh();}catch(err){message(err.message||String(err),true);}};
$("qaClose").onclick=()=>{if(!busy)mask.hidden=true;};
mask.addEventListener("click",event=>{if(event.target===mask && !busy)mask.hidden=true;});
document.addEventListener("keydown",event=>{if(event.key==="Escape" && !busy)mask.hidden=true;});
openButton.onclick=async()=>{
 if(!editable()){alert("Necesitás iniciar sesión como administrador o usuario.");return;}
 const editor=document.getElementById("panel");
 if(editor && editor.classList.contains("show")){alert("Cerrá el editor del territorio antes de utilizar la asignación rápida.");return;}
 mask.hidden=false;
 try{await refresh();$("qaSearch").focus();}catch(err){message(err.message||String(err),true);}
};
})();