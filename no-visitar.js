/* Domicilios "No visitar" dentro del formulario de cada territorio. */
(function () {
  "use strict";
  if (window.__noVisitarEnTerritorio) return;
  window.__noVisitarEnTerritorio = true;

  var notes = document.getElementById("notes");
  var panel = document.getElementById("panel");
  if (!notes || !panel || typeof openPanel !== "function") return;

  var style = document.createElement("style");
  style.textContent = [
    "#nvTerrSection{grid-column:1/-1;width:100%;box-sizing:border-box;margin:12px 0 8px;padding:14px;border:1px solid #e4c5ca;border-left:4px solid #bc4554;border-radius:12px;background:linear-gradient(135deg,#fff9fa,#f9fcff);color:#243e53}",
    "#nvTerrSection *{box-sizing:border-box}",
    ".nvTerrHead{display:flex;align-items:center;gap:10px;flex-wrap:wrap}",
    "#nvTerrCheck{width:19px;height:19px;accent-color:#bf3c4d;cursor:pointer}",
    ".nvTerrHead label{font-size:14px;font-weight:800;color:#9a2638;cursor:pointer;margin:0}",
    ".nvTerrHint{font-size:12px;line-height:1.45;color:#60758b;margin:7px 0}",
    "#nvTerrList{display:grid;gap:7px;margin:8px 0}",
    ".nvTerrItem{border:1px solid #ead7dc;background:white;border-radius:9px;padding:10px;display:flex;justify-content:space-between;gap:10px;align-items:start}",
    ".nvTerrAddress{font-weight:800;font-size:13px;overflow-wrap:anywhere}",
    ".nvTerrNote{font-size:12px;color:#64798c;overflow-wrap:anywhere;margin-top:4px;white-space:pre-wrap}",
    ".nvTerrActions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}",
    "#nvTerrForm{display:none;gap:7px;margin-top:10px}",
    "#nvTerrForm label{display:block;font-size:12px;font-weight:750;margin-top:7px}",
    "#nvTerrForm input,#nvTerrForm textarea{display:block;width:100%;border:1px solid #c3d0dc;background:white;border-radius:8px;padding:9px;font:13px system-ui;margin-top:4px}",
    "#nvTerrForm textarea{min-height:55px;resize:vertical}",
    ".nvTerrBtn{border:1px solid #e1b2b9;border-radius:8px;padding:8px 10px;font:750 12px system-ui;cursor:pointer;color:#a02d3e;background:#fff}",
    ".nvTerrBtn.primary{color:white;background:#af3647;border-color:#af3647}",
    ".nvTerrBtn:disabled{opacity:.5;cursor:default}",
    "#nvTerrMessage{min-height:18px;font-size:12px;margin-top:5px;color:#61758a}"
  ].join("\n");
  document.head.appendChild(style);

  var section = document.createElement("section");
  section.id = "nvTerrSection";
  section.innerHTML = [
    '<div class="nvTerrHead">',
    '<input type="checkbox" id="nvTerrCheck" aria-describedby="nvTerrHelp">',
    '<label for="nvTerrCheck">⛔ No visitar</label></div>',
    '<p class="nvTerrHint" id="nvTerrHelp">Registrá la dirección exacta del domicilio que solicitó no recibir visitas. La restricción no afecta al resto del territorio y no se borra al cambiar su estado.</p>',
    '<div id="nvTerrList"></div>',
    '<div class="nvTerrActions"><button type="button" class="nvTerrBtn" id="nvTerrAdd">+ Agregar domicilio</button></div>',
    '<form id="nvTerrForm">',
    '<label for="nvTerrAddress">Dirección (calle y número) *</label>',
    '<input id="nvTerrAddress" name="direccion" maxlength="220" autocomplete="off" required placeholder="Ej.: Calle 1234">',
    '<label for="nvTerrNotes">Observaciones (opcional)</label>',
    '<textarea id="nvTerrNotes" name="observaciones" maxlength="1000" placeholder="Solo información necesaria para respetar la solicitud"></textarea>',
    '<div class="nvTerrActions"><button class="nvTerrBtn primary" type="submit" id="nvTerrSave">Guardar domicilio</button>',
    '<button class="nvTerrBtn" type="button" id="nvTerrCancel">Cancelar</button></div>',
    '</form><div id="nvTerrMessage" role="status" aria-live="polite"></div>'
  ].join("");
  notes.after(section);

  function $(id) { return document.getElementById(id); }
  function role() { try { return currentRole || ""; } catch (_) { return ""; } }
  function user() { try { return currentUser; } catch (_) { return null; } }
  function client() { try { return db; } catch (_) { return null; } }
  function isEditor() { return !!user() && (role() === "usuario" || role() === "admin"); }
  function isAdmin() { return !!user() && role() === "admin"; }
  function selected() { try { return sel || null; } catch (_) { return null; } }
  function setMessage(text, isError) {
    $("nvTerrMessage").textContent = text;
    $("nvTerrMessage").style.color = isError ? "#a72839" : "#61758a";
  }
  function node(tag, klass, text) {
    var e = document.createElement(tag);
    if (klass) e.className = klass;
    if (text !== undefined) e.textContent = String(text);
    return e;
  }

  var currentId = null, records = [], requestSeq = 0, writing = false;
  function resetForm() {
    $("nvTerrForm").reset();
    $("nvTerrForm").style.display = "none";
  }
  function showForm() {
    if (!isEditor()) {
      setMessage("Tu cuenta es de solo lectura.", true);
      return;
    }
    $("nvTerrForm").style.display = "grid";
    $("nvTerrAddress").focus();
  }
  function render() {
    var list = $("nvTerrList");
    list.replaceChildren();
    $("nvTerrCheck").checked = records.length > 0;
    $("nvTerrCheck").disabled = !isEditor();
    $("nvTerrAdd").style.display = isEditor() ? "" : "none";
    if (!records.length) {
      list.appendChild(node("div", "nvTerrHint", "Sin domicilios restringidos en este territorio."));
      return;
    }
    records.forEach(function (rec) {
      var item = node("div", "nvTerrItem");
      var detail = node("div");
      detail.appendChild(node("div", "nvTerrAddress", rec.direccion));
      if (rec.observaciones) detail.appendChild(node("div", "nvTerrNote", rec.observaciones));
      item.appendChild(detail);
      if (isAdmin()) {
        var remove = node("button", "nvTerrBtn", "Quitar");
        remove.type = "button";
        remove.addEventListener("click", function () { removeOne(rec, remove); });
        item.appendChild(remove);
      }
      list.appendChild(item);
    });
  }

  async function load(id, seq) {
    setMessage("Consultando domicilios...");
    try {
      var response = await client().from("domicilios_no_visitar")
        .select("id,direccion,observaciones,territorio_id")
        .eq("territorio_id", id).order("created_at", { ascending: true }).limit(500);
      if (seq !== requestSeq || String(id) !== String(currentId)) return;
      if (response.error) throw response.error;
      records = response.data || [];
      render();
      setMessage("");
    } catch (err) {
      if (seq !== requestSeq) return;
      records = [];
      render();
      setMessage("No se pudo comprobar el estado: " + (err.message || "Error de conexión") + ". Reabrí el territorio para reintentar.", true);
    }
  }

  function showTerritory(t) {
    currentId = t && t.id !== undefined ? t.id : null;
    requestSeq += 1;
    records = [];
    resetForm();
    render();
    if (currentId === null) {
      section.style.display = "none";
      return;
    }
    section.style.display = "block";
    load(currentId, requestSeq);
  }

  async function removeOne(rec, button) {
    if (!isAdmin() || currentId === null) return;
    if (!confirm('¿Quitar la restricción "No visitar" para ' + rec.direccion + '? Hacelo solo si el vecino volvió a autorizar visitas.')) return;
    button.disabled = true;
    var id = currentId;
    try {
      var response = await client().from("domicilios_no_visitar")
        .delete().eq("id", rec.id).eq("territorio_id", id).select("id");
      if (response.error) throw response.error;
      if (!response.data || response.data.length !== 1) throw Error("El servidor no confirmó la eliminación.");
      if (String(currentId) !== String(id)) return;
      await load(id, requestSeq);
      setMessage("Restricción retirada por el administrador.");
    } catch (err) {
      setMessage("No se pudo quitar la restricción. No se modificó la lista. " + (err.message || "Servidor no disponible"), true);
      button.disabled = false;
    }
  }

  $("nvTerrCheck").addEventListener("change", async function () {
    if (!isEditor()) { this.checked = records.length > 0; return; }
    if (this.checked && records.length === 0) {
      this.checked = false;
      showForm();
      setMessage("Para marcar No visitar, ingresá la dirección y presioná Guardar domicilio.");
    } else if (!this.checked && records.length > 0) {
      this.checked = true;
      if (!isAdmin()) {
        setMessage("La restricción se mantiene. Solo el administrador puede quitarla.", true);
      } else if (records.length === 1) {
        var remove = $("nvTerrList").querySelector("button.nvTerrBtn");
        if (remove) remove.click();
      } else {
        setMessage("Para quitar la marca, el administrador debe retirar cada domicilio de esta lista.", true);
      }
    } else {
      this.checked = records.length > 0;
    }
  });

  $("nvTerrAdd").addEventListener("click", showForm);
  $("nvTerrCancel").addEventListener("click", resetForm);
  $("nvTerrForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!isEditor() || writing || currentId === null) return;
    var address = $("nvTerrAddress").value.trim();
    var remark = $("nvTerrNotes").value.trim();
    if (address.length < 4) {
      setMessage("Ingresá la calle y el número del domicilio.", true);
      return;
    }
    if (records.some(function (r) { return r.direccion.trim().toLocaleLowerCase("es-AR") === address.toLocaleLowerCase("es-AR"); })) {
      setMessage("Este domicilio ya está registrado como No visitar.", true);
      return;
    }
    var id = currentId;
    var territory = selected();
    if (!territory || String(territory.id) !== String(id)) {
      setMessage("Seleccioná nuevamente el territorio antes de guardar.", true);
      return;
    }
    writing = true;
    $("nvTerrSave").disabled = true;
    setMessage("Guardando domicilio...");
    try {
      var result = await client().from("domicilios_no_visitar").insert({
        territorio_id: id,
        territorio: String(territory.numero),
        direccion: address,
        observaciones: remark || null
      });
      if (result.error) throw result.error;
      if (String(currentId) !== String(id)) return;
      resetForm();
      await load(id, requestSeq);
      setMessage("Domicilio guardado. La marca No visitar quedará hasta que el administrador retire la restricción.");
    } catch (err) {
      setMessage("Error al guardar: " + (err.message || "El servidor no responde"), true);
    } finally {
      writing = false;
      $("nvTerrSave").disabled = false;
    }
  });

  var originalOpenPanel = openPanel;
  openPanel = function (territory) {
    originalOpenPanel(territory);
    showTerritory(territory);
  };
  var active = selected();
  if (active && panel.classList.contains("show")) showTerritory(active);
  else section.style.display = "none";
})();