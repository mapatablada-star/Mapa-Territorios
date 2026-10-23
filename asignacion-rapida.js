/* Panel optativo de asignacion rapida. No modifica mapa, editor ni tablas. */
(function () {
  "use strict";
  if (window.__asignacionRapidaV1) return;
  window.__asignacionRapidaV1 = true;

  const toolbar = document.querySelector(".toolbar");
  if (!toolbar || typeof db === "undefined") return;

  const css = document.createElement("style");
  css.textContent = [
    "#arOverlay[hidden]{display:none!important}",
    "#arOverlay{position:fixed;inset:0;background:rgba(15,23,42,.65);z-index:4000;display:flex;align-items:center;justify-content:center;padding:14px}",
    "#arCard{width:min(590px,100%);max-height:94vh;overflow:auto;background:#fff;color:#172033;border-radius:17px;padding:22px;box-shadow:0 24px 70px #0f172a55}",
    "#arCard h2{margin:0 0 6px;font-size:21px;color:#172033}",
    "#arCard p{margin:0 0 14px;color:#52617a;font-size:13px;line-height:1.5}",
    "#arCard label{display:block;margin:12px 0 5px;color:#26364e;font-weight:750;font-size:13px}",
    "#arCard input{display:block;width:100%;border:1px solid #cbd5e1;border-radius:9px;padding:10px 12px;font:inherit;color:#172033;background:#fff}",
    "#arCard .arRow{display:grid;grid-template-columns:1fr 1fr;gap:12px}",
    "#arCard .arActions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:17px}",
    "#arCard button{min-height:38px}",
    "#arCard button:disabled{opacity:.48;cursor:not-allowed}",
    "#arReview{margin-top:15px;border:1px solid #dce4ef;border-radius:10px;padding:12px;background:#f8fafc;font-size:13px;line-height:1.55;white-space:pre-wrap}",
    "#arReview[hidden]{display:none!important}",
    "#arSave[hidden]{display:none!important}",
    "#arReview .arLine{padding:5px 0;border-bottom:1px solid #e5e7eb}",
    "#arReview .arLine:last-child{border-bottom:0}",
    "#arMessage{font-size:13px;line-height:1.45;white-space:pre-wrap;margin-top:10px}",
    "#arQuickBtn{background:#2563eb;color:#fff;border:0;border-radius:9px;padding:9px 13px;font-weight:750}",
    "@media(max-width:540px){#arCard{padding:16px}#arCard .arRow{grid-template-columns:1fr}}"
  ].join("\n");
  document.head.appendChild(css);

  const quick = document.createElement("button");
  quick.id = "arQuickBtn";
  quick.type = "button";
  quick.textContent = "⚡ Asignación rápida";
  const spacer = toolbar.querySelector(".spacer");
  toolbar.insertBefore(quick, spacer || null);

  const overlay = document.createElement("div");
  overlay.id = "arOverlay";
  overlay.hidden = true;
  overlay.innerHTML =
    '<section id="arCard" role="dialog" aria-modal="true" aria-labelledby="arTitle">' +
      '<h2 id="arTitle">⚡ Asignación rápida</h2>' +
      '<p>Asigná uno o varios territorios completos con el mismo nombre y fecha. Las partes divididas se gestionan en el editor habitual.</p>' +
      '<form id="arForm">' +
      '<label for="arNumbers">Número de territorio (varios separados por comas)</label>' +
      '<input id="arNumbers" required autocomplete="off" placeholder="Ej.: 28, 29, 30" />' +
      '<div class="arRow">' +
        '<div><label for="arName">Asignado a</label><input id="arName" maxlength="120" required placeholder="Nombre o grupo" /></div>' +
        '<div><label for="arDate">Fecha de asignación</label><input id="arDate" type="date" required /></div>' +
      '</div>' +
      '<div class="arActions">' +
        '<button type="button" id="arClose" class="gray">Cerrar</button>' +
        '<button type="submit" id="arCheck">Revisar asignación</button>' +
      '</div></form>' +
      '<div id="arReview" hidden></div>' +
      '<div id="arMessage" role="status" aria-live="polite"></div>' +
      '<div class="arActions"><button type="button" id="arSave" class="green" hidden>Confirmar y guardar</button></div>' +
    '</section>';
  document.body.appendChild(overlay);

  const get = id => document.getElementById(id);
  const form = get("arForm"), review = get("arReview"), save = get("arSave");
  const message = get("arMessage");
  let prepared = null, busy = false;

  function allowed() {
    return !!currentUser && (currentRole === "admin" || currentRole === "usuario");
  }
  function updateAccess() {
    quick.style.display = allowed() ? "" : "none";
    if (!allowed() && !overlay.hidden) close();
  }
  if (typeof applyRoleUI === "function") {
    const originalRoleUI = applyRoleUI;
    applyRoleUI = function () {
      originalRoleUI.apply(this, arguments);
      updateAccess();
    };
  }
  const gate = get("authGate");
  if (gate) new MutationObserver(updateAccess).observe(gate, {attributes:true, attributeFilter:["style","class"]});
  updateAccess();

  function close() {
    if (busy) return;
    overlay.hidden = true;
    prepared = null;
    save.hidden = true;
    review.hidden = true;
    message.textContent = "";
  }
  function invalidate() {
    prepared = null;
    save.hidden = true;
    review.hidden = true;
    message.textContent = "";
  }
  function displayMessage(value, isError) {
    message.textContent = value || "";
    message.style.color = isError ? "#b91c1c" : "#166534";
  }
  function normalizeNumbers(value) {
    if (!/^[0-9,;\s]+$/.test(value)) throw new Error("Usá únicamente números de territorio separados por comas.");
    const raw = value.split(/[,;\s]+/).filter(Boolean);
    if (!raw.length || raw.length > 20) throw new Error("Seleccioná entre 1 y 20 territorios.");
    const numbers = raw.map(Number);
    if (numbers.some(x => !Number.isSafeInteger(x) || x < 1))
      throw new Error("Hay un número de territorio inválido.");
    if (new Set(numbers).size !== numbers.length)
      throw new Error("Hay territorios repetidos. Quitá los duplicados.");
    return numbers;
  }
  function appendLine(textValue) {
    const line = document.createElement("div");
    line.className = "arLine";
    line.textContent = textValue;
    review.appendChild(line);
  }
  function localDate(value) {
    const p = value.split("-");
    return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : value;
  }
  function eligible(t) {
    if (effectiveState(t) !== "available")
      return "ya está asignado o recién completado";
    if (typeof otherEditorFor === "function" && otherEditorFor(t.id))
      return "otra persona lo está editando";
    return "";
  }
  async function check() {
    if (!allowed()) throw new Error("Tu cuenta no tiene permiso para asignar territorios.");
    const numbers = normalizeNumbers(get("arNumbers").value.trim());
    const name = get("arName").value.trim();
    const date = get("arDate").value;
    if (!name) throw new Error("Completá el nombre o grupo.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      throw new Error("Elegí una fecha de asignación válida.");

    const found = await db.from("territorios").select("*").in("numero", numbers);
    if (found.error) throw new Error("No se pudieron consultar los territorios: " + found.error.message);
    const byNumber = new Map((found.data || []).map(t => [Number(t.numero),t]));
    const rows = numbers.map(n => byNumber.get(n));
    const ids = rows.filter(Boolean).map(t => t.id);
    const parts = ids.length ?
      await db.from("territorio_partes").select("territorio_id").in("territorio_id", ids) :
      {data:[],error:null};
    if (parts.error) throw new Error("No se pudo verificar si existen territorios divididos.");
    const splitIds = new Set((parts.data || []).map(p => String(p.territorio_id)));

    const errors = [];
    review.textContent = "";
    appendLine("Asignado a: " + name + "  |  Fecha: " + localDate(date));
    numbers.forEach((n, i) => {
      const t = rows[i];
      let reason = !t ? "no existe" :
        splitIds.has(String(t.id)) ? "está dividido por manzanas; usá el editor habitual" : eligible(t);
      if (reason) errors.push("Territorio " + n + ": " + reason);
      appendLine("Territorio " + n + " — " +
        (reason ? "NO se puede asignar: " + reason :
          "Disponible → Asignado (" + t.manzanas + " manzanas)"));
    });
    review.hidden = false;
    if (errors.length) {
      prepared = null;
      save.hidden = true;
      displayMessage("No se guardará nada mientras exista algún conflicto. Corregí la selección o utilizá el editor habitual.", true);
      return;
    }
    prepared = {numbers, name, date, rows};
    save.hidden = false;
    displayMessage("Revisá los cambios y confirmá para guardarlos. Se conservan las observaciones y el historial existente.", false);
  }

  quick.addEventListener("click", function () {
    if (!allowed()) return;
    overlay.hidden = false;
    get("arNumbers").focus();
  });
  get("arClose").addEventListener("click", close);
  overlay.addEventListener("click", e => {if (e.target === overlay) close();});
  document.addEventListener("keydown", e => {if (e.key === "Escape" && !overlay.hidden) close();});
  form.addEventListener("input", invalidate);
  form.addEventListener("change", invalidate);
  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (busy) return;
    busy = true;
    get("arCheck").disabled = true;
    try {
      invalidate();
      await check();
    } catch (err) {
      displayMessage(err.message || "No se pudo revisar la asignación.", true);
    } finally {
      busy = false;
      get("arCheck").disabled = false;
    }
  });

  save.addEventListener("click", async () => {
    if (busy || !prepared || !allowed()) return;
    const plan = prepared;
    if (!confirm("¿Asignar " + plan.numbers.join(", ") + " a " +
      plan.name + " el " + localDate(plan.date) +
      "?\nLos territorios se guardan uno por uno; si hay un error, los anteriores podrían quedar guardados.")) return;
    busy = true;
    save.disabled = true;
    get("arCheck").disabled = true;
    let completed = [];
    try {
      const sessionResult = await db.auth.getSession();
      const session = sessionResult.data && sessionResult.data.session;
      if (!session) throw new Error("La sesión expiró. Volvé a ingresar.");
      for (const original of plan.rows) {
        if (!allowed()) throw new Error("Se perdió el permiso para editar.");
        const freshResult = await db.from("territorios").select("*").eq("id", original.id).single();
        if (freshResult.error || !freshResult.data)
          throw new Error("No se pudo volver a verificar el territorio " + original.numero);
        const t = freshResult.data;
        if (String(t.updated_at || "") !== String(original.updated_at || ""))
          throw new Error("El territorio " + t.numero + " cambió desde la vista previa. Revisalo nuevamente.");
        if (eligible(t))
          throw new Error("El territorio " + t.numero + " dejó de estar disponible.");
        const splitCheck = await db.from("territorio_partes").select("id")
          .eq("territorio_id",t.id).limit(1);
        if (splitCheck.error || (splitCheck.data || []).length)
          throw new Error("No se pudo confirmar que el territorio " + t.numero + " esté sin divisiones.");
        const response = await fetch(SUPABASE_URL + "/functions/v1/smooth-endpoint", {
          method: "POST",
          headers: {
            "Content-Type":"application/json",
            "Authorization":"Bearer " + session.access_token
          },
          body: JSON.stringify({
            accion:"actualizar_territorio",
            id:t.id,
            numero:t.numero,
            manzanas:t.manzanas,
            estado:"assigned",
            fecha_asignacion:plan.date,
            fecha_ultima_visita:null,
            asignado_a:plan.name,
            persona:t.persona || "",
            observaciones:t.observaciones || ""
          })
        });
        const result = await response.json();
        if (!response.ok || !result.ok)
          throw new Error("No se pudo guardar el territorio " + t.numero +
            ": " + (result.mensaje || result.error || "Error desconocido"));
        completed.push(t.numero);
        displayMessage("Guardados: " + completed.join(", ") + ". Procesando…", false);
      }
      prepared = null;
      save.hidden = true;
      review.hidden = true;
      displayMessage("Asignación terminada: " + completed.join(", ") + ". Datos sincronizados.", false);
    } catch (err) {
      prepared = null;
      save.hidden = true;
      displayMessage("Guardados correctamente: " + (completed.join(", ") || "ninguno") +
        ".\n" + (err.message || "Error al guardar") + "\nRevisá los datos antes de volver a intentar.", true);
    } finally {
      try { await loadTerritories(); } catch (e) { console.warn("No se pudo actualizar el mapa",e); }
      busy = false;
      save.disabled = false;
      get("arCheck").disabled = false;
    }
  });
})();