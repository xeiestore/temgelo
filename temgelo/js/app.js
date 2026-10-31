// Tem Gelo? – public map logic

const CATALOG_URL = "https://res.cloudinary.com/efvlvhce/raw/upload/gelo/catalog.json";
// Add ?t= timestamp to bust cache when needed

let sellers = [...DEFAULT_SELLERS];
let map;
let markersLayer;

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  loadCatalog();
});

function initMap() {
  // Center on Luanda
  map = L.map("map", {
    zoomControl: false,
    attributionControl: true
  }).setView([-8.8383, 13.2344], 12);

  L.control.zoom({ position: "bottomright" }).addTo(map);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
  renderMarkers();
}

// ---------- Load live catalog ----------
async function loadCatalog() {
  try {
    const res = await fetch(CATALOG_URL + "?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (data && Array.isArray(data.sellers)) {
      sellers = data.sellers;
      console.log("Catalog loaded:", sellers.length, "sellers");
    }
  } catch (err) {
    console.warn("Using default sellers (catalog not available yet):", err.message);
  }
  renderMarkers();
  updateCount();
}

// ---------- Markers ----------
function renderMarkers() {
  markersLayer.clearLayers();

  sellers.forEach(seller => {
    const available = isEffectivelyAvailable(seller);
    const color = available ? "#22c55e" : "#ef4444";

    // Custom circle marker
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
  const freezeLabel = FREEZE_LABELS[seller.freeze] || seller.freeze;
  const updated = seller.updatedAt
    ? new Date(seller.updatedAt).toLocaleString("pt-AO", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "—";

  const statusHtml = available
    ? `<span class="popup-status ok">Tem gelo</span>`
    : `<span class="popup-status no">Sem gelo / expirado</span>`;

  const waNumber = (seller.whatsapp || "").replace(/\D/g, "");
  const waMsg = encodeURIComponent(
    `Olá! Vi no Tem Gelo? que tem baldes de gelo. Ainda tem disponível?`
  );
  const waLink = waNumber
    ? `https://wa.me/${waNumber}?text=${waMsg}`
    : "#";

  return `
    <div class="popup-title">${escapeHtml(seller.name)}</div>
    ${statusHtml}
    <div class="popup-meta">${escapeHtml(seller.neighborhood || "")}</div>
    <div class="popup-row">
      <span>Baldes</span>
      <span>${seller.buckets ?? "—"}</span>
    </div>
    <div class="popup-row">
      <span>Congelamento</span>
      <span>${escapeHtml(freezeLabel)}</span>
    </div>
    <div class="popup-row">
      <span>Preço</span>
      <span>${seller.price ? seller.price + " Kz" : "—"}</span>
    </div>
    <div class="popup-row">
      <span>Atualizado</span>
      <span>${updated}</span>
    </div>
    ${seller.notes ? `<div class="text-sm text-muted mt-2">${escapeHtml(seller.notes)}</div>` : ""}
    ${waNumber ? `<a class="btn-wa" href="${waLink}" target="_blank" rel="noopener">Contactar no WhatsApp</a>` : ""}
    <button class="btn-report" type="button" onclick="reportSeller('${seller.id}')">Reportar este vendedor</button>
  `;
}

function updateCount() {
  const available = sellers.filter(isEffectivelyAvailable).length;
  const total = sellers.length;
  const el = document.getElementById("seller-count");
  if (el) {
    el.textContent = `${available} de ${total} com gelo`;
  }
}

// ---------- Report ----------
function reportSeller(id) {
  const seller = sellers.find(s => s.id === id);
  const name = seller ? seller.name : id;
  const msg = encodeURIComponent(
    `Quero reportar o vendedor "${name}" (ID: ${id}) no Tem Gelo?. Motivo: `
  );
  // Change this number to your admin WhatsApp
  const adminWa = "244900000000";
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
