// Tem Gelo? – public map logic

const CATALOG_URL =
  "https://tem-gelo-publish.xeieloja.workers.dev/catalog";
const CATALOG_FALLBACK =
  "https://res.cloudinary.com/efvlvhce/raw/upload/gelo/catalog.json";
const POLL_MS = 30000; // refresh map every 30s

let sellers = [...DEFAULT_SELLERS];
let texts = { ...DEFAULT_TEXTS };
let map;
let markersLayer;
let lastCatalogAt = null;

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
  applyTexts();
  initMap();
  loadCatalog();
  setInterval(loadCatalog, POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") loadCatalog();
  });
});

function initMap() {
  map = L.map("map", {
    zoomControl: false,
    attributionControl: true
  }).setView([-11.2, 17.5], 6);

  L.control.zoom({ position: "bottomright" }).addTo(map);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
  renderMarkers();
}

// ---------- Load live catalog ----------
async function fetchCatalogJson(url) {
  const res = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now(), {
    cache: "no-store",
    headers: { Accept: "application/json" }
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

async function loadCatalog() {
  let data = null;
  try {
    data = await fetchCatalogJson(CATALOG_URL);
  } catch (err) {
    console.warn("Worker catalog failed, trying Cloudinary:", err.message);
    try {
      data = await fetchCatalogJson(CATALOG_FALLBACK);
    } catch (err2) {
      console.warn("Using default sellers:", err2.message);
    }
  }

  if (data) {
    // Skip re-render if nothing changed
    const stamp = data.updatedAt || JSON.stringify(data.sellers || []).slice(0, 200);
    if (stamp === lastCatalogAt) return;
    lastCatalogAt = stamp;

    if (Array.isArray(data.sellers)) {
      sellers = data.sellers;
      console.log("Catalog loaded:", sellers.length, "sellers");
    }
    if (data.texts && typeof data.texts === "object") {
      texts = { ...DEFAULT_TEXTS, ...data.texts };
    }
  }

  applyTexts();
  renderMarkers();
  updateCount();
  // Only fit bounds on first successful load
  if (!loadCatalog._fitted && sellers.length) {
    fitToSellers();
    loadCatalog._fitted = true;
  }
}

function fitToSellers() {
  if (!map || !sellers.length) return;
  const points = sellers
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
    .map((s) => [s.lat, s.lng]);
  if (!points.length) return;
  if (points.length === 1) {
    map.setView(points[0], 13);
  } else {
    map.fitBounds(points, { padding: [40, 40], maxZoom: 14 });
  }
}

function applyTexts() {
  document.title = texts.pageTitle || DEFAULT_TEXTS.pageTitle;

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute("content", texts.pageDescription || DEFAULT_TEXTS.pageDescription);

  const legendOk = document.getElementById("legend-ok");
  const legendNo = document.getElementById("legend-no");
  if (legendOk) legendOk.textContent = texts.legendOk || DEFAULT_TEXTS.legendOk;
  if (legendNo) legendNo.textContent = texts.legendNo || DEFAULT_TEXTS.legendNo;

  const safetyTitle = document.getElementById("safety-title");
  const safetyBody = document.getElementById("safety-body");
  if (safetyTitle) safetyTitle.textContent = texts.safetyTitle || DEFAULT_TEXTS.safetyTitle;
  if (safetyBody) safetyBody.textContent = texts.safetyBody || DEFAULT_TEXTS.safetyBody;
}

function freezeLabel(key) {
  if (key === "muito_congelado") return texts.freezeMuito || FREEZE_LABELS.muito_congelado;
  if (key === "parcial") return texts.freezeParcial || FREEZE_LABELS.parcial;
  if (key === "fraco") return texts.freezeFraco || FREEZE_LABELS.fraco;
  return FREEZE_LABELS[key] || key;
}

// ---------- Markers ----------
function renderMarkers() {
  markersLayer.clearLayers();

  sellers.forEach((seller) => {
    const available = isEffectivelyAvailable(seller);
    const color = available ? "#22c55e" : "#ef4444";

    const marker = L.circleMarker([seller.lat, seller.lng], {
      radius: 11,
      fillColor: color,
      color: "#0f172a",
      weight: 3,
      opacity: 1,
      fillOpacity: 0.95
    });

    marker.bindPopup(createPopup(seller, available), {
      maxWidth: 280,
      className: "tem-gelo-popup"
    });

    markersLayer.addLayer(marker);
  });
}

function createPopup(seller, available) {
  const freeze = freezeLabel(seller.freeze);
  const updated = seller.updatedAt
    ? new Date(seller.updatedAt).toLocaleString("pt-AO", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "—";

  const statusHtml = available
    ? `<span class="popup-status ok">${escapeHtml(texts.statusOk || DEFAULT_TEXTS.statusOk)}</span>`
    : `<span class="popup-status no">${escapeHtml(texts.statusNo || DEFAULT_TEXTS.statusNo)}</span>`;

  const waNumber = (seller.whatsapp || "").replace(/\D/g, "");
  const waMsg = encodeURIComponent(texts.waMessage || DEFAULT_TEXTS.waMessage);
  const waLink = waNumber ? `https://wa.me/${waNumber}?text=${waMsg}` : "#";

  return `
    <div class="popup-title">${escapeHtml(seller.name)}</div>
    ${statusHtml}
    <div class="popup-meta">${escapeHtml(seller.neighborhood || "")}</div>
    <div class="popup-row">
      <span>${escapeHtml(texts.labelBuckets || DEFAULT_TEXTS.labelBuckets)}</span>
      <span>${seller.buckets ?? "—"}</span>
    </div>
    <div class="popup-row">
      <span>${escapeHtml(texts.labelFreeze || DEFAULT_TEXTS.labelFreeze)}</span>
      <span>${escapeHtml(freeze)}</span>
    </div>
    <div class="popup-row">
      <span>${escapeHtml(texts.labelPrice || DEFAULT_TEXTS.labelPrice)}</span>
      <span>${seller.price ? seller.price + " Kz" : "—"}</span>
    </div>
    <div class="popup-row">
      <span>${escapeHtml(texts.labelUpdated || DEFAULT_TEXTS.labelUpdated)}</span>
      <span>${updated}</span>
    </div>
    ${seller.notes ? `<div class="text-sm text-muted mt-2">${escapeHtml(seller.notes)}</div>` : ""}
    ${
      waNumber
        ? `<a class="btn-wa" href="${waLink}" target="_blank" rel="noopener">${escapeHtml(
            texts.btnWhatsApp || DEFAULT_TEXTS.btnWhatsApp
          )}</a>`
        : ""
    }
    <button class="btn-report" type="button" onclick="reportSeller('${seller.id}')">${escapeHtml(
      texts.btnReport || DEFAULT_TEXTS.btnReport
    )}</button>
  `;
}

function updateCount() {
  const available = sellers.filter(isEffectivelyAvailable).length;
  const total = sellers.length;
  const el = document.getElementById("seller-count");
  if (el) {
    const fmt = texts.countFormat || DEFAULT_TEXTS.countFormat;
    el.textContent = fmt
      .replace("{available}", String(available))
      .replace("{total}", String(total));
  }
}

// ---------- Report ----------
function reportSeller(id) {
  const seller = sellers.find((s) => s.id === id);
  const name = seller ? seller.name : id;
  const template = texts.reportMessage || DEFAULT_TEXTS.reportMessage;
  const msg = encodeURIComponent(
    template.replace("{name}", name).replace("{id}", id)
  );
  const adminWa = (texts.adminWhatsApp || DEFAULT_TEXTS.adminWhatsApp).replace(/\D/g, "");
  window.location.href = `https://wa.me/${adminWa}?text=${msg}`;
}

// ---------- Helpers ----------
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
