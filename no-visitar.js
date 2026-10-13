/* Domicilios que solicitaron no recibir visitas. Módulo independiente. */
(function () {
  "use strict";
  if (window.__noVisitarInstalled) return;
  window.__noVisitarInstalled = true;
  var legend = document.querySelector(".legend");
  if (!legend) return;

  var css = document.createElement("style");
  css.textContent = [
    "#nvOpen{display:inline-flex;align-items:center;border:1px solid #edbac0;border-radius:11px;background:#fff0f2;color:#9d2636;font:800 13px system-ui;padding:10px 13px;cursor:pointer;white-space:nowrap}",
    "#nvOpen:hover{background:#ffe1e5}",
    "#nvOverlay{position:fixed;inset:0;background:#081b2dbb;z-index:2147483000;display:none;align-items:center;justify-content:center;padding:14px;box-sizing:border-box}",
    "#nvOverlay.shown{display:flex}",
    "#nvPanel{box-sizing:border-box;width:min(750px,100%);max-height:90vh;overflow:auto;background:#f8fbff;border:1px solid #ccdce9;border-radius:18px;box-shadow:0 25px 90px #071b2e70;padding:20px;color:#16324b;font:14px system-ui}",
    "#nvPanel h2{margin:0;font-size:21px;color:#a22e3c}",
    "#nvPanel p{color:#60758a;font-size:13px;line-height:1.5}",
    ".nvHead{display:flex;justify-content:space-between;gap:12px;align-items:start}",
    "#nvClose{cursor:pointer;background:#e9eff5;border:0;border-radius:9px;padding:7px 11px}",
    "#nvForm{display:grid;grid-template-columns:2fr 1fr;gap:10px;background:#ebf2f9;padding:14px;border-radius:12px;margin-bottom:15px}",
    "#nvForm label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:750;color:#4b6478}",
    "#nvForm input,#nvForm textarea,#nvSearch{width:100%;min-width:0;box-sizing:border-box;background:white;border:1px solid #b9ccda;border-radius:8px;padding:10px;color:#16324b;font:14px system-ui}",
    "#nvForm textarea{min-height:62px;resize:vertical}",
    ".nvWide{grid-column:1/-1}",
    "#nvSave{background:#aa2c3b;color:#fff;border:0;border-radius:9px;padding:11px 15px;cursor:pointer;font-weight:800;justify-self:start}",
    "#nvSave:disabled{opacity:.6}",
    ".nvSearchbar{display:flex;align-items:center;justify-content:space-between;gap:9px;margin-bottom:8px}",
    "#nvCount{white-space:nowrap;font-weight:800}",
    "#nvMessage{min-height:20px;color:#5f7489;font-size:13px}",
    "#nvList{display:grid;gap:8px}",
    ".nvCard{display:flex;justify-content:space-between;align-items:start;gap:12px;background:white;border:1px solid #d8e5ef;border-left:4px solid #d84b57;border-radius:11px;padding:12px}",
    ".nvAddress{font-size:15px;font-weight:800;overflow-wrap:anywhere}",
    ".nvDetail{font-size:12px;color:#5c7287;margin-top:5px;overflow-wrap:anywhere}",
    ".nvRemove{border:1px solid #f4bdc5;border-radius:8px;background:#fff0f2;color:#a52b3a;padding:7px 9px;cursor:pointer}",
    "@media(max-width:580px){#nvPanel{padding:14px}#nvForm{grid-template-columns:1fr}.nvWide{grid-column:auto}.nvSearchbar{align-items:stretch;flex-direction:column}}"
  ].join("\n");
  document.head.appendChild(css);
  var openBtn = document.createElement("button");
  openBtn.id = "nvOpen";
  openBtn.type = "button";
  openBtn.textContent = "⛔ No visitar";
  var controls = legend.querySelector(".map-controls");
  if (controls) legend.insertBefore(openBtn, controls);
  else legend.appendChild(openBtn);

  var overlay = document.createElement("div");
  overlay.id = "nvOverlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "nvTitle");
  overlay.innerHTML = [
    '<section id="nvPanel"><div class="nvHead"><h2 id="nvTitle">⛔ Domicilios: no visitar</h2><button id="nvClose" type="button" aria-label="Cerrar">✕</button></div>',
    '<p>Direcciones de vecinos que pidieron no recibir visitas. Estos registros son permanentes e independientes del estado del territorio.</p>',
    '<form id="nvForm">',
    '<label>Dirección del domicilio *<input id="nvAddress" maxlength="220" required placeholder="Calle y número" autocomplete="off"></label>',
    '<label>Territorio (opcional)<input id="nvTerritory" maxlength="40" placeholder="Ej.: 32" autocomplete="off"></label>',
    '<label class="nvWide">Observaciones (opcional)<textarea id="nvNotes" maxlength="1000" placeholder="Motivo o información útil, sin datos personales innecesarios"></textarea></label>',
    '<button id="nvSave" type="submit">Guardar domicilio</button></form>',
    '<div class="nvSearchbar"><strong id="nvCount">Domicilios registrados</strong><input id="nvSearch" type="search" placeholder="Buscar dirección o territorio..." aria-label="Buscar domicilio"></div>',
    '<div id="nvMessage" role="status" aria-live="polite"></div><div id="nvList"></div></section>'
  ].join("");
  document.body.appendChild(overlay);
  var $ = function (id) { return document.getElementById(id); };
  var records = [], busy = false, form = $("nvForm"), list = $("nvList"), search = $("nvSearch");
  function role() { try { return currentRole || ""; } catch (_) { return ""; } }
  function authorized() {
    try { return !!currentUser && ["admin", "usuario", "lector"].includes(role()); }
    catch (_) { return false; }
  }
  function client() { try { return db; } catch (_) { return null; } }
  function message(t, error) { $("nvMessage").textContent = t; $("nvMessage").style.color = error ? "#a22e3c" : "#5f7489"; }
  function close() { overlay.classList.remove("shown"); }
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined) n.textContent = String(txt);
    return n;
  }
  function render() {
    var query = search.value.trim().toLocaleLowerCase("es-AR");
    var shown = records.filter(function (r) {
      return [r.direccion, r.territorio, r.observaciones].some(function (v) {
        return String(v || "").toLocaleLowerCase("es-AR").includes(query);
      });
    });
    $("nvCount").textContent = records.length + (records.length === 1 ? " domicilio registrado" : " domicilios registrados");
    list.replaceChildren();
    if (!shown.length) {
      list.appendChild(el("p", "", records.length ? "No hay coincidencias." : "Todavía no hay domicilios registrados."));
      return;
    }
    shown.forEach(function (r) {
      var card = el("article", "nvCard"), info = el("div");
      info.appendChild(el("div", "nvAddress", r.direccion));
      if (r.territorio) info.appendChild(el("div", "nvDetail", "Territorio: " + r.territorio));
      if (r.observaciones) info.appendChild(el("div", "nvDetail", r.observaciones));
      if (r.created_at) info.appendChild(el("div", "nvDetail", "Registrado: " + new Date(r.created_at).toLocaleDateString("es-AR")));
      card.appendChild(info);
      if (role() === "admin") {
        var remove = el("button", "nvRemove", "Quitar");
        remove.type = "button";
        remove.addEventListener("click", async function () {
          if (!confirm("¿Quitar de NO VISITAR la dirección " + r.direccion + "? Solo corresponde si la restricción ya no aplica.")) return;
          if (!authorized() || role() !== "admin") return;
          remove.disabled = true;
          try {
            var res = await client().from("domicilios_no_visitar").delete().eq("id", r.id).select("id");
            if (res.error) throw res.error;
            if (!res.data || res.data.length !== 1) throw new Error("La eliminación no pudo confirmarse.");
            await load();
          } catch (err) { message("Error: " + err.message, true); remove.disabled = false; }
        });
        card.appendChild(remove);
      }
      list.appendChild(card);
    });
  }
  async function load() {
    if (busy) return;
    busy = true;
    message("Cargando domicilios...");
    try {
      if (!authorized() || !client()) throw new Error("Iniciá sesión con una cuenta autorizada.");
      var result = await client().from("domicilios_no_visitar")
        .select("id,direccion,territorio,observaciones,created_at")
        .order("created_at", { ascending: false }).limit(1000);
      if (result.error) throw result.error;
      records = result.data || [];
      render();
      message("");
    } catch (err) {
      records = [];
      list.replaceChildren();
      message("No se pudo cargar la lista: " + err.message, true);
    } finally { busy = false; }
  }
  openBtn.addEventListener("click", function () {
    if (!authorized()) { alert("Iniciá sesión con una cuenta autorizada."); return; }
    form.style.display = role() === "lector" ? "none" : "grid";
    search.value = "";
    overlay.classList.add("shown");
    load();
    $("nvClose").focus();
  });
  $("nvClose").addEventListener("click", close);
  overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && overlay.classList.contains("shown")) close(); });
  search.addEventListener("input", render);
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!authorized() || role() === "lector") return;
    var address = $("nvAddress").value.trim();
    var territory = $("nvTerritory").value.trim();
    var notes = $("nvNotes").value.trim();
    if (address.length < 4) { message("Ingresá calle y número del domicilio.", true); return; }
    if (records.some(function (r) { return r.direccion.toLocaleLowerCase("es-AR") === address.toLocaleLowerCase("es-AR"); })) {
      message("Esta dirección ya se encuentra registrada.", true); return;
    }
    var save = $("nvSave");
    save.disabled = true;
    message("Guardando...");
    try {
      var result = await client().from("domicilios_no_visitar").insert({ direccion: address, territorio: territory || null, observaciones: notes || null });
      if (result.error) throw result.error;
      form.reset();
      await load();
      message("Domicilio guardado correctamente.");
    } catch (err) { message("No se pudo guardar: " + err.message, true); }
    finally { save.disabled = false; }
  });
  var logout = $("logoutBtn");
  if (logout) logout.addEventListener("click", function () { close(); records = []; list.replaceChildren(); });
  var gate = $("authGate");
  if (gate) new MutationObserver(function () {
    if (!authorized()) { close(); records = []; list.replaceChildren(); }
  }).observe(gate, { attributes: true, attributeFilter: ["style", "class"] });
})();