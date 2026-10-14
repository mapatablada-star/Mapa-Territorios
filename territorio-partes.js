/* Estados independientes por manzana. Módulo optativo: no toca el guardado anterior. */
(function(){
"use strict";
if(window.__partesV1)return;window.__partesV1=true;
const e=id=>document.getElementById(id);
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const names={available:"Disponible",assigned:"Asignado",done:"Recién completado"};
const colors={available:"#22a06b",assigned:"#3b82f6",done:"#e27474"};
const ABC="ABCDEFGHIJKLMNÑOPQRSTUVWXYZ",store=new Map();
let ready=false,draft=null,dirty=false,active=null,refreshing=false;
const rows=id=>store.get(String(id))||[];
const writable=()=>currentUser&&["admin","usuario"].includes(currentRole)&&
  !(typeof otherEditorFor==="function"&&sel&&otherEditorFor(sel.id));
const snap=a=>a.map(p=>({id:+p.id,version:+p.version})).sort((x,y)=>x.id-y.id);
function expand(value){
 const s=String(value||"").toUpperCase().replace(/\s+/g,"");
 if(!/^[A-ZÑ](-[A-ZÑ])?(,[A-ZÑ](-[A-ZÑ])?)*$/.test(s))return null;
 let result=[];
 for(const item of s.split(",")){
  let v=item.split("-"),from=ABC.indexOf(v[0]),to=ABC.indexOf(v[v.length-1]);
  if(from<0||to<from)return null;
  for(let n=from;n<=to;n++){if(result.includes(ABC[n]))return null;result.push(ABC[n]);}
 }
 return result;
}
function state(p){
 return p.estado==="done"&&daysSince(p.fecha_ultima_visita)>=28?"available":p.estado||"available";
}
function detail(t){
 const a=rows(t.id);if(!a.length)return{a,s:effectiveState(t),mixed:false};
 const u=[...new Set(a.map(state))];return{a,s:u[0],mixed:u.length>1};
}
function redraw(){
 const bs=e("points")?.querySelectorAll("button.p")||[];
 ts.forEach((t,i)=>{
  let b=bs[i],d=detail(t);if(!b||!d.a.length)return;
  let sizes=d.a.map(p=>Math.max(1,(expand(p.manzanas)||[]).length));
  let total=sizes.reduce((a,b)=>a+b,0),start=0,spans=[];
  d.a.forEach((p,k)=>{
   let end=start+360*sizes[k]/total;
   spans.push((colors[state(p)]||colors.available)+" "+start+"deg "+end+"deg");start=end;
  });
  b.style.setProperty("background","conic-gradient("+spans.join(",")+")","important");
  b.style.setProperty("--touch-color","#475569");
  b.style.setProperty("--touch-ring","#64748b44");
  b.title="Territorio "+t.numero+": "+d.a.map(p=>p.manzanas+" "+names[state(p)]).join(" | ");
  b.classList.add("part-point");
 });
 const count={available:0,assigned:0,done:0,mixed:0};
 ts.forEach(t=>{let d=detail(t);count[d.mixed?"mixed":d.s]++;});
 for(const s of ["available","assigned","done"]){
  let id={available:"statAvailable",assigned:"statAssigned",done:"statDone"}[s];
  if(e(id))e(id).textContent=count[s]||0;
 }
 if(e("partialCount")){e("partialCount").textContent=count.mixed?
  "🟣 "+count.mixed+" territorio(s) con estados mixtos":"";}
 const box=e("items"),q=(e("filter")?.value||"").toLowerCase().trim();if(!box)return;
 const filtered=ts.filter(t=>{
  let d=detail(t),search=[t.numero,t.asignado_a,t.persona,names[d.s],
   ...d.a.map(p=>p.manzanas+" "+p.asignado_a+" "+p.persona+" "+names[state(p)])].join(" ").toLowerCase();
  return !q||search.includes(q);
 });
 box.innerHTML=filtered.length?filtered.map(t=>{
  let d=detail(t);
  let info=d.a.length?"🔷 "+d.a.map(p=>esc(p.manzanas)+": "+names[state(p)]).join(" · "):
   esc(t.manzanas)+" manzana(s) — "+esc(statusName(d.s))+
   (polygonPoints(t).length>=3?" — 🗺️ área definida":"")+
   (t.fecha_ultima_visita?" — última visita: "+esc(t.fecha_ultima_visita):"");
  return '<div class="item" data-id="'+t.id+'"><b>Territorio '+esc(t.numero)+'</b> — '+info+"</div>";
 }).join(""):"<p class='small'>No hay territorios que coincidan con la búsqueda.</p>";
 box.querySelectorAll(".item").forEach(item=>{item.onclick=()=>{
  const t=ts.find(t=>String(t.id)===item.dataset.id);if(t)openPanel(t);
 };});
}
const oldRender=render;
render=function(){oldRender();if(ready)redraw();};
const oldLoad=loadTerritories;
loadTerritories=async function(){
 const v=await oldLoad();
 if(currentUser&&!refreshing){refreshing=true;try{await reload();}finally{refreshing=false;}}
 return v;
};
async function reload(){
 if(!currentUser)return;
 const {data,error}=await db.from("territorio_partes").select("*")
  .order("territorio_id").order("orden");
 if(error){console.warn("Partes no disponibles; se mantiene el sistema normal.",error);ready=false;return;}
 store.clear();for(const p of data||[]){
  let key=String(p.territorio_id);if(!store.has(key))store.set(key,[]);
  store.get(key).push(p);
 }
 ready=true;redraw();
 if(active!=null&&!dirty&&sel&&String(sel.id)===String(active))show();
}
const style=document.createElement("style");
style.textContent=[
 "#partRegion[hidden],#startPartial[hidden]{display:none!important}",
 "#panel #startPartial{display:block;width:100%;background:#eef6ff;color:#1e40af;border:1px solid #bfd4ef}",
 "#panel .part-card{background:#f8fbff;border:1px solid #dae5f2;border-radius:11px;margin:10px 0;padding:10px}",
 "#panel .part-card h3{font-size:14px;margin:0 0 6px}",
 "#panel .part-card label{margin-top:6px}",
 "#panel .part-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}",
 "#panel .part-actions{display:flex;flex-wrap:wrap;gap:6px}",
 "#panel .part-actions button{flex:1 1 130px;padding:9px 5px}",
 "#partSave{background:#166534;color:#fff}",
 "#partAdd{background:#eaf3ff;color:#1e40af}",
 "#partUndo{background:#fff;color:#9a3412;border:1px solid #fed7aa}",
 "#partNotice,#partHistory{font-size:12px;line-height:1.5;margin:10px 0;color:#475569}",
 "#partNotice{min-height:16px}",
 ".p.part-point{border:1.5px solid #475569!important;box-shadow:0 0 0 2px #ffffff,0 0 0 3px #64748b55!important}",
 "#partialCount{max-width:1500px;margin:5px auto 0;padding:0 18px;font-size:12px;font-weight:700;color:#6d28d9}"
].join("\n");
document.head.appendChild(style);
const notes=e("notes"),panel=e("panel"),save=e("save");
if(!notes||!panel||!save)return;
const start=document.createElement("button");start.id="startPartial";
start.type="button";start.hidden=true;start.textContent="＋ Dividir territorio por manzanas";
notes.after(start);
const region=document.createElement("section");region.id="partRegion";region.hidden=true;
region.innerHTML='<p class="small">Cada parte tiene su propio estado, fechas y observaciones. '+
 'Indicá las letras de las manzanas sin repetirlas.</p><div id="partCards"></div>'+
 '<div class="part-actions"><button type="button" id="partAdd">＋ Agregar parte</button>'+
 '<button type="button" id="partSave">Guardar partes</button>'+
 '<button type="button" id="partUndo">Volver a estado único</button></div>'+
 '<div id="partNotice" role="status"></div><div id="partHistory"></div>';
start.after(region);
const legacyIds=["status","assignmentDate","date","assignedTo","person","notes"];
function toggle(split){
 legacyIds.forEach(id=>{const f=e(id);if(!f)return;
  f.style.display=split?"none":"";
  if(f.previousElementSibling?.tagName==="LABEL")f.previousElementSibling.style.display=split?"none":"";
 });
 save.style.display=split?"none":(currentRole==="lector"?"none":"");
 if(e("history"))e("history").style.display=split?"none":"";
 start.hidden=split||!ready||!writable();
 region.hidden=!split;
}
const clean=p=>({
 id:p?.id||null,manzanas:p?.manzanas||"",estado:p?.estado||"available",
 fecha_asignacion:p?.fecha_asignacion||"",fecha_ultima_visita:p?.fecha_ultima_visita||"",
 asignado_a:p?.asignado_a||"",persona:p?.persona||"",observaciones:p?.observaciones||""
});
function notice(t,bad=true){const x=e("partNotice");if(x){x.textContent=t||"";x.style.color=bad?"#b91c1c":"#166534";}}
function cards(){
 const box=e("partCards");if(!draft||!box)return;
 box.innerHTML=draft.map((p,i)=>{
  let opts=Object.entries(names).map(([v,n])=>'<option value="'+v+'"'+(p.estado===v?" selected":"")+">"+n+"</option>").join("");
  return '<div class="part-card" data-index="'+i+'"><h3>Parte '+(i+1)+' — '+esc(p.manzanas||"sin definir")+'</h3>'+
   '<label>Manzanas (ej.: A-B o C,D)</label><input data-key="manzanas" maxlength="90" value="'+esc(p.manzanas)+'">'+
   '<label>Estado</label><select data-key="estado">'+opts+'</select>'+
   '<div class="part-grid"><div><label>Fecha de asignación</label><input type="date" data-key="fecha_asignacion" value="'+esc(p.fecha_asignacion)+'"></div>'+
   '<div><label>Fecha de visita</label><input type="date" data-key="fecha_ultima_visita" value="'+esc(p.fecha_ultima_visita)+'"></div></div>'+
   '<label>Asignado a</label><input data-key="asignado_a" maxlength="200" value="'+esc(p.asignado_a)+'">'+
   '<label>Realizado por</label><input data-key="persona" maxlength="200" value="'+esc(p.persona)+'">'+
   '<label>Observaciones</label><textarea rows="2" data-key="observaciones" maxlength="3000">'+esc(p.observaciones)+'</textarea>'+
   (draft.length>2?'<button type="button" data-remove="'+i+'">Quitar parte</button>':"")+"</div>";
 }).join("");
 const permitted=!!writable();
 box.querySelectorAll("[data-key]").forEach(input=>{
  input.disabled=!permitted;input.oninput=()=>{
   let i=+input.closest(".part-card").dataset.index,key=input.dataset.key;
   draft[i][key]=input.value;dirty=true;notice("");
   if(key==="manzanas")input.closest(".part-card").querySelector("h3").textContent=
     "Parte "+(i+1)+" — "+(input.value||"sin definir");
   if(key==="estado"&&input.value==="assigned"){
    draft[i].fecha_ultima_visita="";
    input.closest(".part-card").querySelector('[data-key="fecha_ultima_visita"]').value="";
   }
  };
 });
 box.querySelectorAll("[data-remove]").forEach(btn=>{
  btn.disabled=!permitted;btn.onclick=()=>{draft.splice(+btn.dataset.remove,1);dirty=true;cards();};
 });
 e("partAdd").disabled=!permitted||draft.length>=27;
 e("partSave").disabled=!permitted;
 e("partUndo").disabled=!permitted;
 e("partUndo").textContent=rows(active).length?"Volver a estado único":"Cancelar división";
}
async function history(id){
 const {data,error}=await db.from("historial_partes")
  .select("accion,datos,created_at").eq("territorio_id",id)
  .order("created_at",{ascending:false}).limit(12);
 if(!sel||String(sel.id)!==String(id)||region.hidden)return;
 e("partHistory").innerHTML=error?"No se pudo cargar el historial.":!data?.length?
  "No hay cambios anteriores.":"<b>Últimos cambios de partes</b><br>"+
   data.map(x=>esc(new Date(x.created_at).toLocaleDateString("es-AR"))+" — "+
    esc(x.accion)+" — "+esc(x.datos?.manzanas)+" — "+esc(names[x.datos?.estado]||"")).join("<br>");
}
function show(){
 if(!sel||!ready)return;active=sel.id;
 draft=rows(sel.id).length?rows(sel.id).map(clean):null;dirty=false;
 toggle(!!draft);if(draft){cards();history(sel.id);}
}
const originalOpen=openPanel;
openPanel=function(t){originalOpen(t);active=t.id;if(ready)show();else toggle(false);};
start.onclick=()=>{
 if(!sel||!writable())return;
 active=sel.id;
 draft=[clean({...sel,id:null,manzanas:""}),clean({estado:"available"})];
 dirty=true;toggle(true);cards();notice("Indicá las manzanas de ambas partes y guardá.",false);
};
e("partAdd").onclick=()=>{
 if(!draft||draft.length>=27||!writable())return;
 draft.push(clean({estado:"available"}));dirty=true;cards();
};
function validation(){
 if(!draft||draft.length<2||draft.length>27)return "Se necesitan entre 2 y 27 partes.";
 const used=new Set();
 for(let i=0;i<draft.length;i++){
  const p=draft[i],labels=expand(p.manzanas);
  if(!labels)return "Revisá las manzanas de la parte "+(i+1)+". Ejemplo: A-B o C,D.";
  for(const letter of labels){if(used.has(letter))return "La manzana "+letter+" está repetida.";used.add(letter);}
  if(p.fecha_asignacion&&p.fecha_ultima_visita&&p.fecha_ultima_visita<p.fecha_asignacion)
    return "La visita no puede ser anterior a la asignación (parte "+(i+1)+").";
 }
 return null;
}
async function persist(id,list){
 const {error}=await db.rpc("guardar_territorio_partes",{
  p_territorio_id:+id,p_expected:snap(rows(id)),
  p_partes:list.map(p=>({id:p.id||null,manzanas:p.manzanas?.trim().toUpperCase(),
   estado:p.estado,fecha_asignacion:p.fecha_asignacion||null,
   fecha_ultima_visita:p.fecha_ultima_visita||null,asignado_a:p.asignado_a,
   persona:p.persona,observaciones:p.observaciones}))
 });if(error)throw error;
 await reload();
}
e("partSave").onclick=async()=>{
 if(!sel||!draft||!writable())return;
 const msg=validation();if(msg){notice(msg);return;}
 const id=sel.id,button=e("partSave");button.disabled=true;notice("Guardando...",false);
 try{
  await persist(id,draft);dirty=false;if(String(sel?.id)===String(id)){
   show();notice("Partes guardadas correctamente.",false);
  }
 }catch(err){notice(err?.message||"No se pudo guardar.");}
 finally{button.disabled=!writable();}
};
e("partUndo").onclick=async()=>{
 if(!sel||!draft||!writable())return;
 const id=sel.id;
 if(!rows(id).length){draft=null;dirty=false;toggle(false);return;}
 if(!confirm("¿Volver al estado único original? Se quitarán las partes independientes y volverá a mostrarse el estado general guardado."))return;
 e("partUndo").disabled=true;
 try{await persist(id,[]);dirty=false;draft=null;toggle(false);}
 catch(err){notice(err?.message||"No se pudo volver al estado único.");}
 finally{e("partUndo").disabled=!writable();}
};
if(typeof applyTerritoryLock==="function"){
 const oldLock=applyTerritoryLock;
 applyTerritoryLock=function(){oldLock();if(draft&&!region.hidden)cards();};
}
if(typeof startRealtime==="function"){
 const oldRealtime=startRealtime;
 startRealtime=function(){
  oldRealtime();
  db.channel("territorio-partes-tiempo-real").on("postgres_changes",
   {event:"*",schema:"public",table:"territorio_partes"},async()=>{
    await reload();
    if(dirty)notice("Hay cambios de otro usuario. El guardado comprobará que no se pisen.");
   }).subscribe();
 };
}
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&currentUser&&!dirty)reload();});
const indicator=document.createElement("div");indicator.id="partialCount";
document.querySelector(".dashboard")?.after(indicator);
})();