// Tem Gelo? – public map logic

const API_BASE = "https://tem-gelo-publish.xeieloja.workers.dev";
const CATALOG_URL = API_BASE + "/catalog";
const CATALOG_FALLBACK =
  "https://res.cloudinary.com/efvlvhce/raw/upload/gelo/catalog.json";
const POLL_MS = 30000; // refresh map every 30s

// Empty until live catalog loads — avoids brief flash of demo/seed pins
let sellers = [];
let texts = { ...DEFAULT_TEXTS };
let siteImages = {};
let map;
let markersLayer;
let lastCatalogAt = null;
let pendingReportSellerId = "";
let pendingReportSellerName = "";
let catalogLoadedOnce = false;

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
  applyTexts();
  if (typeof window !== "undefined") window.TEMGELO_TEXTS = texts;
  initMap();
  setupBottomSlot();
  loadCatalog();
  setInterval(loadCatalog, POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") loadCatalog();
  });
});

const SAFETY_AUTO_HIDE_MS = 10000;
let safetyHideTimer = null;

function hideSafetyShowAds() {
  const safety = document.getElementById("safety-banner");
  const ads = document.getElementById("ad-banner");
  if (!safety || safety.getAttribute("data-dismissed") === "1") return;
  safety.setAttribute("data-dismissed", "1");
  safety.classList.add("is-hiding");
  window.setTimeout(() => {
    safety.classList.add("hidden");
    safety.style.display = "none";
    safety.classList.remove("is-hiding");
    if (ads) {
      ads.classList.remove("hidden");
      ads.style.display = "flex";
    }
  }, 300);
}

function showSafetyTemporarily() {
  if (typeof window.__temGeloShowSafety === "function") {
    window.__temGeloShowSafety();
    return;
  }
  const safety = document.getElementById("safety-banner");
  const ads = document.getElementById("ad-banner");
  if (!safety) return;
  if (safetyHideTimer) {
    clearTimeout(safetyHideTimer);
    safetyHideTimer = null;
  }
  if (ads) {
    ads.classList.add("hidden");
    ads.style.display = "";
  }
  safety.removeAttribute("data-dismissed");
  safety.classList.remove("hidden", "is-hiding");
  safety.style.display = "";
  safetyHideTimer = window.setTimeout(hideSafetyShowAds, SAFETY_AUTO_HIDE_MS);
}

function setupBottomSlot() {
  // Primary auto-hide is the inline script in index.html (survives stale SW app.js).
  // This is a backup + menu helper.
  document.getElementById("safety-close-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (safetyHideTimer) {
      clearTimeout(safetyHideTimer);
      safetyHideTimer = null;
    }
    hideSafetyShowAds();
  });
  if (safetyHideTimer) clearTimeout(safetyHideTimer);
  safetyHideTimer = window.setTimeout(hideSafetyShowAds, SAFETY_AUTO_HIDE_MS);
  window.showSafetyBanner = showSafetyTemporarily;
}

function initMap() {
  // Approximate Angola bounds (small padding so edges aren't clipped awkwardly)
  const angolaBounds = L.latLngBounds(
    L.latLng(-18.5, 11.0), // SW
    L.latLng(-4.0, 24.5) // NE
  );

  map = L.map("map", {
    zoomControl: false,
    attributionControl: true,
    maxBounds: angolaBounds,
    maxBoundsViscosity: 1.0, // hard stop at edges
    minZoom: 5,
    maxZoom: 19
  }).fitBounds(angolaBounds, { padding: [12, 12] });

  L.control.zoom({ position: "bottomright" }).addTo(map);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
  // No seed markers — wait for live catalog in loadCatalog()
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
    // Skip re-render if nothing changed (after first successful paint)
    const stamp = data.updatedAt || JSON.stringify(data.sellers || []).slice(0, 200);
    if (catalogLoadedOnce && stamp === lastCatalogAt) return;
    lastCatalogAt = stamp;

    if (Array.isArray(data.sellers)) {
      sellers = data.sellers;
      console.log("Catalog loaded:", sellers.length, "sellers");
    }
    if (data.texts && typeof data.texts === "object") {
      texts = { ...DEFAULT_TEXTS, ...data.texts };
    }
    if (data.images && typeof data.images === "object") {
      siteImages = data.images;
    }
    catalogLoadedOnce = true;
  } else if (!catalogLoadedOnce) {
    // Network failed on first load — keep map empty (no demo pins)
    sellers = [];
  }

  applyTexts();
  applyImages();
  renderMarkers();
  updateCount();
  // Only fit bounds on first successful load with sellers
  if (!loadCatalog._fitted && catalogLoadedOnce && sellers.length) {
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

  // Partner self-promo ad (persuade Angolan businesses to buy this strip)
  const adTitle = document.getElementById("ad-banner-title");
  const adText = document.getElementById("ad-banner-text");
  const adCta = document.getElementById("ad-banner-cta");
  if (adTitle) {
    adTitle.textContent = texts.adTitle || "Negócio angolano?";
  }
  if (adText) {
    adText.textContent =
      " " +
      (texts.adBody ||
        "Coloque a sua marca aqui — lojas, serviços, entregas. Quem procura gelo em Angola já está a ver este espaço.");
  }
  if (adCta) {
    adCta.textContent = texts.adCta || "Quero anunciar";
    const wa = String(texts.adminWhatsApp || DEFAULT_TEXTS.adminWhatsApp || "")
      .replace(/\D/g, "");
    const msg = encodeURIComponent(
      texts.adWaMessage ||
        "Olá! Vi o espaço de anúncios no Tem Gelo? e quero anunciar o meu negócio/serviço."
    );
    if (wa && wa.length >= 11) {
      adCta.href = "https://wa.me/" + wa + "?text=" + msg;
      adCta.target = "_blank";
      adCta.rel = "noopener";
    } else {
      adCta.href = "#";
      adCta.removeAttribute("target");
      adCta.onclick = (e) => {
        e.preventDefault();
        alert(
          "Para anunciar neste espaço, contacte a equipa Tem Gelo? pelo WhatsApp indicado em Segurança / Admin."
        );
      };
    }
  }
}

function applyImages() {
  const header = siteImages.logoHeader || siteImages.logo;
  const drawer = siteImages.logoDrawer || header;
  if (header) {
    document.querySelectorAll("#home-logo img, .topbar .logo img").forEach((img) => {
      img.src = header;
    });
  }
  if (drawer) {
    document.querySelectorAll("#public-drawer .drawer-header img").forEach((img) => {
      img.src = drawer;
    });
  }
}

function paymentsHtml(payments) {
  const p = payments || {};
  const tags = [];
  if (p.numerario) tags.push("Numerário");
  if (p.multicaixa) tags.push("Multicaixa Express");
  if (p.unitel) tags.push("Unitel Money");
  if (p.other) tags.push(String(p.other));
  if (!tags.length) return "";
  return `<div class="popup-payments">${tags
    .map((t) => `<span class="pay-tag">${escapeHtml(t)}</span>`)
    .join("")}</div>`;
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
  const phoneNumber = (seller.phone || "").replace(/\D/g, "");
  const waMsg = encodeURIComponent(texts.waMessage || DEFAULT_TEXTS.waMessage);
  const waLink = waNumber ? `https://wa.me/${waNumber}?text=${waMsg}` : "";
  const telLink = phoneNumber ? `tel:+${phoneNumber}` : "";

  let contactHtml = "";
  if (waNumber) {
    contactHtml += `<a class="btn-wa" href="${waLink}" target="_blank" rel="noopener">${escapeHtml(
      texts.btnWhatsApp || DEFAULT_TEXTS.btnWhatsApp
    )}</a>`;
  }
  if (phoneNumber) {
    contactHtml += `<a class="btn-call" href="${telLink}">${escapeHtml(
      texts.btnCall || DEFAULT_TEXTS.btnCall || "Ligar"
    )}</a>`;
  }
  if (!waNumber && !phoneNumber) {
    contactHtml += `<p class="popup-no-contact">${escapeHtml(
      texts.noContact ||
        DEFAULT_TEXTS.noContact ||
        "Sem contacto público — só localização no mapa"
    )}</p>`;
  }

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
    ${paymentsHtml(seller.payments)}
    ${seller.notes ? `<div class="text-sm text-muted mt-2">${escapeHtml(seller.notes)}</div>` : ""}
    ${contactHtml}
    <button class="btn-report" type="button" onclick="openReportModal('${seller.id}')">${escapeHtml(
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

// ---------- Report (to admin panel, not WhatsApp) ----------
function openReportModal(sellerId) {
  pendingReportSellerId = sellerId || "";
  const seller = sellers.find((s) => s.id === sellerId);
  pendingReportSellerName = seller ? seller.name : "";
  const modal = document.getElementById("report-modal");
  const title = document.getElementById("report-modal-title");
  const msg = document.getElementById("report-message");
  const contact = document.getElementById("report-contact");
  if (title) {
    title.textContent = seller
      ? "Reportar vendedor"
      : "Reportar um problema";
  }
  if (msg) {
    msg.value = seller
      ? `Quero reportar o vendedor "${seller.name}" (ID: ${seller.id}). Motivo: `
      : "";
  }
  if (contact) contact.value = "";
  modal?.classList.remove("hidden");
  msg?.focus();
}

function closeReportModal() {
  document.getElementById("report-modal")?.classList.add("hidden");
  pendingReportSellerId = "";
  pendingReportSellerName = "";
}

async function submitReport() {
  const message = document.getElementById("report-message")?.value.trim() || "";
  const contact = document.getElementById("report-contact")?.value.trim() || "";
  if (message.length < 5) {
    alert("Escreva uma mensagem com pelo menos 5 caracteres.");
    return;
  }
  const btn = document.getElementById("report-submit");
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(API_BASE + "/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sellerId: pendingReportSellerId,
        sellerName: pendingReportSellerName,
        message,
        contact
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || res.statusText);
    }
    closeReportModal();
    alert("Obrigado. O relatório foi enviado à equipa Tem Gelo?.");
  } catch (err) {
    alert("Não foi possível enviar: " + (err.message || err));
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Keep old name for any leftover onclick
function reportSeller(id) {
  openReportModal(id);
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
