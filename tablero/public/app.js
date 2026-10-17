(() => {
  const TZ = "America/Mexico_City";
  const VEHICLES = [
    { id: "02-avanza", label: "02 Avanza" },
    { id: "03-avanza", label: "03 Avanza" },
    { id: "05-avanza", label: "05 Avanza" },
    { id: "06-urvan", label: "06 Urvan" },
    { id: "07-hiace", label: "07 Hiace" },
  ];

  const DATE = new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const DATE_SHORT = new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const DATETIME = new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const els = {
    today: document.getElementById("today"),
    lastGlobal: document.getElementById("last-global"),
    status: document.getElementById("status"),
    ghost: document.getElementById("ghost"),
    zones: {
      valpa: document.getElementById("zone-valpa"),
      zacatecas: document.getElementById("zone-zacatecas"),
    },
  };

  let state = null;
  let dirty = false;
  let saving = false;
  let selectedId = null;
  let drag = null;
  let justDragged = false;
  let saveTimer = null;

  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.className = "status" + (kind ? " " + kind : "");
  }

  function formatDate(iso) {
    if (!iso) return "Sin movimientos aún";
    return DATETIME.format(new Date(iso));
  }

  function otherZone(zone) {
    return zone === "valpa" ? "zacatecas" : "valpa";
  }

  function zoneTitle(zone) {
    return zone === "valpa" ? "Valpa" : "Zacatecas";
  }

  function isCompact() {
    return window.matchMedia("(max-width: 760px)").matches;
  }

  function paintToday() {
    els.today.textContent = isCompact()
      ? DATE_SHORT.format(new Date())
      : DATE.format(new Date());
  }

  function render() {
    paintToday();
    if (!state) return;
    const last = state.lastMovedVehicleId
      ? VEHICLES.find((v) => v.id === state.lastMovedVehicleId)
      : null;
    els.lastGlobal.textContent = state.updatedAt
      ? formatDate(state.updatedAt) + (last ? " · " + last.label : "")
      : "Sin movimientos aún";

    for (const zone of ["valpa", "zacatecas"]) {
      const section = els.zones[zone];
      const wrap = section.querySelector("[data-cards]");
      wrap.innerHTML = "";
      const here = VEHICLES.filter((v) => state.vehicles[v.id].zone === zone);
      section.classList.toggle("empty", here.length === 0);
      section.querySelector("[data-count]").textContent = String(here.length);
      for (const v of here) {
        const info = state.vehicles[v.id];
        const card = document.createElement("article");
        card.className = "card" + (selectedId === v.id ? " selected" : "");
        card.dataset.id = v.id;
        card.innerHTML =
          '<div><div class="card-name"></div><div class="card-meta"></div></div>' +
          '<button type="button" class="move-btn"></button>';
        card.querySelector(".card-name").textContent = v.label;
        card.querySelector(".card-meta").textContent = info.movedAt
          ? "Último traslado: " + formatDate(info.movedAt)
          : "Sin traslado registrado";
        const btn = card.querySelector(".move-btn");
        const dest = otherZone(zone);
        const full = "A " + zoneTitle(dest);
        const short = dest === "valpa" ? "A Valpa" : "A Zac";
        btn.innerHTML =
          '<span class="btn-full"></span><span class="btn-short"></span>';
        btn.querySelector(".btn-full").textContent = full;
        btn.querySelector(".btn-short").textContent = short;
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          moveVehicle(v.id, dest);
        });
        card.addEventListener("pointerdown", onPointerDown);
        card.addEventListener("click", () => onCardTap(v.id, zone));
        wrap.appendChild(card);
      }
    }
  }

  function onCardTap(id, zone) {
    if (justDragged) return;
    if (selectedId && selectedId !== id) {
      const from = state.vehicles[selectedId].zone;
      if (from !== zone) {
        moveVehicle(selectedId, zone);
        selectedId = null;
        render();
        return;
      }
    }
    selectedId = selectedId === id ? null : id;
    render();
    if (selectedId) setStatus("Toca la otra zona para mover " + labelOf(id), "warn");
  }

  for (const zone of ["valpa", "zacatecas"]) {
    els.zones[zone].addEventListener("click", (e) => {
      if (!selectedId) return;
      if (e.target.closest(".card")) return;
      const from = state.vehicles[selectedId].zone;
      if (from !== zone) moveVehicle(selectedId, zone);
      selectedId = null;
      render();
    });
  }

  function labelOf(id) {
    const v = VEHICLES.find((x) => x.id === id);
    return v ? v.label : id;
  }

  function moveVehicle(id, zone) {
    if (!state || !state.vehicles[id] || state.vehicles[id].zone === zone) return;
    const now = new Date().toISOString();
    state.vehicles[id] = { zone, movedAt: now };
    state.lastMovedVehicleId = id;
    state.updatedAt = now;
    dirty = true;
    render();
    setStatus("Guardando " + labelOf(id) + " en " + zoneTitle(zone) + "…", "warn");
    queueSave();
  }

  function queueSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 80);
  }

  async function save() {
    if (!state || saving) return;
    saving = true;
    try {
      while (dirty) {
        dirty = false;
        const payload = JSON.parse(JSON.stringify(state));
        const res = await fetch("/api/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const saved = await res.json();
        if (!dirty) {
          state = saved;
          render();
          setStatus("Guardado en el servidor", "ok");
        }
      }
    } catch (err) {
      dirty = true;
      setStatus("No se pudo guardar. Revisa la conexión e inténtalo de nuevo.", "err");
      console.error(err);
    } finally {
      saving = false;
      if (dirty) queueSave();
    }
  }

  async function load() {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    state = await res.json();
    render();
    setStatus("Sincronizado", "ok");
  }

  async function poll() {
    if (dirty || document.hidden) return;
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) return;
      const next = await res.json();
      if (JSON.stringify(next) !== JSON.stringify(state)) {
        state = next;
        render();
        setStatus("Actualizado desde el servidor", "ok");
      }
    } catch {
      /* keep local view */
    }
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest(".move-btn")) return;
    const card = e.currentTarget;
    const id = card.dataset.id;
    drag = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      pointerId: e.pointerId,
    };
    card.setPointerCapture(e.pointerId);
    card.addEventListener("pointermove", onPointerMove);
    card.addEventListener("pointerup", onPointerUp);
    card.addEventListener("pointercancel", onPointerUp);
  }

  function onPointerMove(e) {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 8) return;
    if (!drag.moved) {
      drag.moved = true;
      const card = e.currentTarget;
      card.classList.add("dragging");
      els.ghost.hidden = false;
      els.ghost.textContent = labelOf(drag.id);
      els.ghost.className = "ghost card";
    }
    els.ghost.style.left = e.clientX + "px";
    els.ghost.style.top = e.clientY + "px";
    highlightZone(e.clientX, e.clientY);
  }

  function onPointerUp(e) {
    const card = e.currentTarget;
    card.removeEventListener("pointermove", onPointerMove);
    card.removeEventListener("pointerup", onPointerUp);
    card.removeEventListener("pointercancel", onPointerUp);
    card.classList.remove("dragging");
    els.ghost.hidden = true;
    document.querySelectorAll(".zone.over").forEach((z) => z.classList.remove("over"));
    if (drag && drag.moved) {
      justDragged = true;
      const zoneEl = zoneAt(e.clientX, e.clientY);
      if (zoneEl) moveVehicle(drag.id, zoneEl.dataset.zone);
      selectedId = null;
      render();
      setTimeout(() => {
        justDragged = false;
      }, 0);
    }
    drag = null;
  }

  function zoneAt(x, y) {
    const stack = document.elementsFromPoint(x, y) || [];
    for (const el of stack) {
      if (el === els.ghost || (el.classList && el.classList.contains("ghost"))) continue;
      if (el.closest && el.closest(".card.dragging")) continue;
      const zone = el.closest && el.closest(".zone");
      if (zone) return zone;
    }
    return null;
  }

  function highlightZone(x, y) {
    document.querySelectorAll(".zone.over").forEach((z) => z.classList.remove("over"));
    const z = zoneAt(x, y);
    if (z) z.classList.add("over");
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) poll();
  });

  setInterval(paintToday, 30_000);
  setInterval(poll, 4000);

  load().catch(() => setStatus("No se pudo cargar el tablero.", "err"));
})();
