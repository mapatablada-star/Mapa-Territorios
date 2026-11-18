/* Lista para carpetas: registro independiente de visitas recién completadas. */
(function () {
"use strict";
if (window.__listaCarpetasV1) return;
window.__listaCarpetasV1 = true;

const $ = id => document.getElementById(id);
const make = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
};
const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));
const formatDate = value => {
  if (!value) return "—";
  const parts = String(value).slice(0,10).split("-");
  return parts.length === 3 ? parts[2] + "/" + parts[1] + "/" + parts[0] : String(value);
};
const titleCase = value => value ? value.charAt(0).toLocaleUpperCase("es-AR") + value.slice(1) : "—";
const slotName = value => value === "manana" ? "Mañana" : value === "tarde" ? "Tarde" : "Sin definir";
const dayTypeName = value => value === "fin_de_semana" ? "Fin de semana" : value === "semana" ? "Entre semana" : "—";
const canEdit = () => typeof currentUser !== "undefined" && !!currentUser &&
  typeof currentRole !== "undefined" && (currentRole === "admin" || currentRole === "usuario");

const style = make("style");
style.textContent = [
  "#lcOpen{background:#e8f1fb!important;color:#173f66!important;border:1px solid #b9cde2!important;padding:9px 12px!important;font-weight:800!important;cursor:pointer!important}",
  "#lcOpen:hover{background:#fff!important}",
  "#lcMask[hidden]{display:none!important}",
  "#lcMask{position:fixed;inset:0;background:rgba(8,22,38,.72);z-index:2147483001;display:flex;justify-content:center;align-items:center;padding:12px;box-sizing:border-box}",
  "#lcWindow{width:min(920px,100%);max-height:94vh;overflow:auto;border-radius:17px;background:#f6f9fd;color:#172b45;box-shadow:0 28px 85px rgba(0,0,0,.38);padding:20px;box-sizing:border-box}",
  "#lcWindow *{box-sizing:border-box}",
  "#lcHead{display:flex;gap:12px;justify-content:space-between;align-items:flex-start;margin-bottom:14px}",
  "#lcWindow h2{margin:0;font-size:22px;color:#173450}",
  "#lcWindow p{margin:5px 0 0}",
  "#lcWindow button{cursor:pointer;border-radius:9px;padding:9px 12px;font-weight:750;min-height:37px}",
  "#lcClose{background:#e8eef4;color:#21405e;border:1px solid #c9d6e4;white-space:nowrap}",
  "#lcTools{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;align-items:center;margin:12px 0}",
  "#lcSearch{width:100%;min-height:43px;padding:10px 12px;border:1px solid #b9cce0;border-radius:9px;background:#fff;color:#172b45;font:inherit}",
  "#lcRefresh{background:#eaf3fb;color:#1d4d76;border:1px solid #bcd4e9}",
  "#lcTabs{display:flex;gap:7px;flex-wrap:wrap;margin:8px 0 12px}",
  "#lcTabs button{background:#e9eff6;color:#435c75;border:1px solid #d2deea}",
  "#lcTabs button.active{background:#173f66;color:#fff;border-color:#173f66}",
  "#lcCounts{font-size:12px;color:#60748b;margin:0 0 9px}",
  "#lcRows{overflow:auto;max-height:62vh;padding-right:2px}",
  ".lcCard{background:#fff;border:1px solid #d9e3ed;border-radius:12px;padding:13px;margin:0 0 9px}",
  ".lcCardHead{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:9px}",
  ".lcTitle{font-size:15px;font-weight:850;color:#173b5b}",
  ".lcTag{font-size:11px;font-weight:800;padding:4px 8px;border-radius:999px;background:#fff3dc;color:#8a5a0b;white-space:nowrap}",
  ".lcTag.archived{background:#e8f2eb;color:#286346}",
  ".lcGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:8px 0}",
  ".lcField{background:#f6f9fc;border:1px solid #e5ecf3;border-radius:8px;padding:8px;min-width:0}",
  ".lcField small{display:block;color:#6b7f94;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;margin-bottom:3px}",
  ".lcField b{display:block;color:#203e5c;font-size:13px;overflow-wrap:anywhere}",
  ".lcMeta{font-size:12px;color:#546d84;line-height:1.5;margin:5px 0}",
  ".lcActions{display:flex;gap:7px;justify-content:flex-end;margin-top:10px}",
  ".lcArchive{background:#e8f2eb;color:#286346;border:1px solid #c8dfd0}",
  ".lcRestore{background:#edf3fa;color:#315575;border:1px solid #cedbe8}",
  ".lcEmpty{padding:26px 12px;text-align:center;color:#60748b;background:#fff;border:1px dashed #c9d7e5;border-radius:12px}",
  "#lcMessage{min-height:18px;margin:8px 0 0;font-size:12px;font-weight:750;color:#9b3434}",
  ".lcNote{font-size:12px;color:#637991;line-height:1.5}",
  "@media(max-width:640px){#lcWindow{padding:13px;max-height:97vh}#lcTools{grid-template-columns:1fr}.lcGrid{grid-template-columns:1fr 1fr}.lcGrid .lcField:first-child{grid-column:1/-1}#lcHead{align-items:center}#lcWindow h2{font-size:19px}}"
].join("\n");
document.head.appendChild(style);

const toolbar = document.querySelector("header .toolbar") ||
  document.querySelector(".toolbar") || document.querySelector("header");
if (!toolbar) return;

const openButton = make("button", "", "🗂 Lista para carpetas");
openButton.id = "lcOpen";
openButton.type = "button";
toolbar.appendChild(openButton);

const mask = make("div");
mask.id = "lcMask";
mask.hidden = true;
mask.setAttribute("role","dialog");
mask.setAttribute("aria-modal","true");
mask.setAttribute("aria-label","Lista para carpetas");
const win = make("div");
win.id = "lcWindow";
mask.appendChild(win);
win.innerHTML =
  '<div id="lcHead"><div><h2>Lista para carpetas</h2>' +
  '<p class="lcNote">Visitas que acaban de pasar a «Recién completado». Cada visita queda guardada aunque después el territorio vuelva a estar disponible.</p></div>' +
  '<button type="button" id="lcClose">✕ Cerrar</button></div>' +
  '<div id="lcTools"><input id="lcSearch" type="search" autocomplete="off" placeholder="Buscar territorio por número o manzana…" aria-label="Buscar territorio por número o manzana">' +
  '<button type="button" id="lcRefresh">Actualizar lista</button></div>' +
  '<div id="lcTabs"><button type="button" class="active" data-tab="pending">Pendientes</button><button type="button" data-tab="archived">Pasados a carpeta</button></div>' +
  '<div id="lcCounts"></div><div id="lcRows"><div class="lcEmpty">Abrí la lista para cargar las visitas.</div></div>' +
  '<div id="lcMessage" role="status" aria-live="polite"></div>';
document.body.appendChild(mask);

let records = [];
let activeTab = "pending";
let busy = false;

function message(value, bad) {
  const node = $("lcMessage");
  node.textContent = value || "";
  node.style.color = bad ? "#a33131" : "#286346";
}
function visibleRecords() {
  const query = $("lcSearch").value.trim().toLocaleLowerCase("es-AR");
  return records.filter(row => {
    const archived = !!row.archivado_en;
    if (activeTab === "pending" && archived) return false;
    if (activeTab === "archived" && !archived) return false;
    if (!query) return true;
    const searchable = [
      row.numero_territorio, row.manzanas, row.asignado_a, row.persona
    ].join(" ").toLocaleLowerCase("es-AR");
    return searchable.includes(query);
  });
}
function render() {
  const pending = records.filter(row => !row.archivado_en).length;
  const archived = records.length - pending;
  $("lcCounts").textContent = pending + " pendientes · " + archived + " pasados a carpeta · " + records.length + " visitas guardadas";
  $("lcTabs").querySelectorAll("[data-tab]").forEach(button => {
    button.classList.toggle("active", button.dataset.tab === activeTab);
  });

  const rows = visibleRecords();
  const box = $("lcRows");
  box.replaceChildren();
  if (!rows.length) {
    const empty = make("div","lcEmpty", $("lcSearch").value.trim()
      ? "No hay territorios que coincidan con esa búsqueda."
      : activeTab === "pending"
        ? "No hay visitas pendientes para pasar a las carpetas."
        : "Todavía no marcaste visitas como pasadas a carpeta.");
    box.appendChild(empty);
    return;
  }

  for (const row of rows) {
    const card = make("article","lcCard");
    const head = make("div","lcCardHead");
    head.appendChild(make("div","lcTitle","Territorio " + row.numero_territorio));
    head.appendChild(make("span","lcTag" + (row.archivado_en ? " archived" : ""),
      row.archivado_en ? "Pasado a carpeta" : "Por registrar"));
    card.appendChild(head);

    const manzanas = row.manzanas === "Todas"
      ? "Todas" + (row.cantidad_manzanas ? " (" + row.cantidad_manzanas + ")" : "")
      : row.manzanas;
    const grid = make("div","lcGrid");
    const fields = [
      ["Manzanas",manzanas || "—"],
      ["Fecha de visita",formatDate(row.fecha_visita)],
      ["Día de la semana",titleCase(row.dia_semana)],
      ["Horario",slotName(row.franja_visita)],
      ["Tipo de día",dayTypeName(row.tipo_dia)],
      ["Asignado a",row.asignado_a || row.persona || "—"]
    ];
    for (const [label,value] of fields) {
      const field = make("div","lcField");
      field.appendChild(make("small","",label));
      field.appendChild(make("b","",value));
      grid.appendChild(field);
    }
    card.appendChild(grid);
    if (row.persona && row.persona !== row.asignado_a) {
      card.appendChild(make("div","lcMeta","Realizado por: " + row.persona));
    }
    if (row.observaciones) {
      card.appendChild(make("div","lcMeta","Observaciones: " + row.observaciones));
    }

    const actions = make("div","lcActions");
    const action = make("button",row.archivado_en ? "lcRestore" : "lcArchive",
      row.archivado_en ? "↶ Devolver a pendientes" : "✓ Marcar pasado a carpeta");
    action.type = "button";
    action.dataset.action = row.archivado_en ? "restore" : "archive";
    action.dataset.id = row.id;
    action.disabled = !canEdit();
    actions.appendChild(action);
    card.appendChild(actions);
    box.appendChild(card);
  }
}

async function loadRecords() {
  if (!canEdit()) {
    message("Iniciá sesión con un usuario autorizado para consultar esta lista.", true);
    records = [];
    render();
    return;
  }
  if (busy) return;
  busy = true;
  $("lcRefresh").disabled = true;
  message("Actualizando visitas…", false);
  try {
    const { data, error } = await db.from("lista_carpetas_visitas")
      .select("*")
      .order("fecha_visita", {ascending:false})
      .order("numero_territorio", {ascending:true})
      .order("id", {ascending:false});
    if (error) throw error;
    records = data || [];
    render();
    message("Lista actualizada.", false);
  } catch (error) {
    message("No se pudo cargar la lista: " + (error && error.message ? error.message : String(error)), true);
  } finally {
    busy = false;
    $("lcRefresh").disabled = false;
  }
}

async function setArchived(id, archived) {
  if (!canEdit() || busy) return;
  busy = true;
  message(archived ? "Marcando como pasado a carpeta…" : "Devolviendo a pendientes…", false);
  try {
    const patch = archived
      ? {archivado_en:new Date().toISOString(),archivado_por:currentUser.id}
      : {archivado_en:null,archivado_por:null};
    const { error } = await db.from("lista_carpetas_visitas")
      .update(patch).eq("id",id);
    if (error) throw error;
    await loadAfterAction();
    message(archived ? "La visita pasó a «Pasados a carpeta»." : "La visita volvió a pendientes.", false);
  } catch (error) {
    message("No se pudo actualizar la visita: " + (error && error.message ? error.message : String(error)), true);
  } finally {
    busy = false;
    $("lcRefresh").disabled = false;
  }
}
async function loadAfterAction() {
  const { data, error } = await db.from("lista_carpetas_visitas")
    .select("*")
    .order("fecha_visita", {ascending:false})
    .order("numero_territorio", {ascending:true})
    .order("id", {ascending:false});
  if (error) throw error;
  records = data || [];
  render();
}

openButton.onclick = async () => {
  mask.hidden = false;
  $("lcSearch").value = "";
  activeTab = "pending";
  render();
  await loadRecords();
  $("lcSearch").focus();
};
$("lcClose").onclick = () => { mask.hidden = true; };
$("lcRefresh").onclick = loadRecords;
$("lcSearch").addEventListener("input",render);
$("lcTabs").addEventListener("click",event => {
  const button = event.target.closest("[data-tab]");
  if (!button) return;
  activeTab = button.dataset.tab;
  render();
});
$("lcRows").addEventListener("click",event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  setArchived(button.dataset.id,button.dataset.action === "archive");
});
mask.addEventListener("click",event => {
  if (event.target === mask) mask.hidden = true;
});
document.addEventListener("keydown",event => {
  if (event.key === "Escape" && !mask.hidden) mask.hidden = true;
});
})();