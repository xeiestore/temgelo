// Tem Gelo? – Admin logic

const ADMIN_PASSWORD = "EuRico2027"; // Must match the Worker secret ADMIN_PASSWORD
const CATALOG_URL = "https://res.cloudinary.com/efvlvhce/raw/upload/gelo/catalog.json";
const PUBLISH_URL = "https://tem-gelo-publish.xeieloja.workers.dev/publish";

let sellers = [];
let texts = { ...DEFAULT_TEXTS };
let editingId = null;

const TEXT_FIELDS = [
  "pageTitle",
  "pageDescription",
  "legendOk",
  "legendNo",
  "safetyTitle",
  "safetyBody",
  "statusOk",
  "statusNo",
  "labelBuckets",
  "labelFreeze",
  "labelPrice",
  "labelUpdated",
  "btnWhatsApp",
  "btnReport",
  "waMessage",
  "reportMessage",
  "countFormat",
  "adminWhatsApp",
  "freezeMuito",
  "freezeParcial",
  "freezeFraco"
];

// ---------- Boot ----------
document.addEventListener("DOMContentLoaded", () => {
  // Check if already logged in this session
  if (sessionStorage.getItem("temgelo_admin") === "1") {
    showAdmin();
  }

  // Enter key on password
  document.getElementById("admin-password")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") tryLogin();
  });
});

function tryLogin() {
  const pw = document.getElementById("admin-password").value;
  if (pw === ADMIN_PASSWORD) {
    sessionStorage.setItem("temgelo_admin", "1");
    showAdmin();
  } else {
    alert("Palavra-passe incorrecta");
  }
}

function logout() {
  sessionStorage.removeItem("temgelo_admin");
  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("admin-screen").classList.add("hidden");
}

function showAdmin() {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("admin-screen").classList.remove("hidden");
  loadSellers();
}

function showSection(name) {
  document.querySelectorAll(".admin-section").forEach((el) => el.classList.add("hidden"));
  document.querySelectorAll(".sidebar-link").forEach((el) => el.classList.remove("active"));
  const section = document.getElementById("section-" + name);
  if (section) section.classList.remove("hidden");
  const link = document.querySelector(`.sidebar-link[data-section="${name}"]`);
  if (link) link.classList.add("active");
}

// ---------- Load ----------
async function loadSellers() {
  // 1. Start from defaults
  sellers = JSON.parse(JSON.stringify(DEFAULT_SELLERS));
  texts = { ...DEFAULT_TEXTS };

  // Local draft texts (if any)
  try {
    const localTexts = localStorage.getItem("temgelo_texts");
    if (localTexts) texts = { ...DEFAULT_TEXTS, ...JSON.parse(localTexts) };
  } catch (_) {}

  // 2. Try live catalog
  try {
    const res = await fetch(CATALOG_URL + "?t=" + Date.now(), { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.sellers)) {
        sellers = data.sellers;
        document.getElementById("catalog-status").textContent =
          `Catálogo remoto carregado (${sellers.length} vendedores) – ${data.updatedAt || ""}`;
      }
      if (data && data.texts && typeof data.texts === "object") {
        texts = { ...DEFAULT_TEXTS, ...data.texts };
      }
    } else {
      throw new Error("HTTP " + res.status);
    }
  } catch (err) {
    // 3. Fallback to localStorage
    const local = localStorage.getItem("temgelo_sellers");
    if (local) {
      try {
        sellers = JSON.parse(local);
        document.getElementById("catalog-status").textContent =
          "A usar rascunho local (catálogo remoto indisponível)";
      } catch (_) {}
    } else {
      document.getElementById("catalog-status").textContent =
        "A usar dados de exemplo (ainda não publicou nada)";
    }
  }

  fillTextsForm();
  renderList();
}

function fillTextsForm() {
  TEXT_FIELDS.forEach((key) => {
    const el = document.getElementById("t-" + key);
    if (el) el.value = texts[key] != null ? texts[key] : DEFAULT_TEXTS[key] || "";
  });
}

function readTextsForm() {
  const next = { ...DEFAULT_TEXTS };
  TEXT_FIELDS.forEach((key) => {
    const el = document.getElementById("t-" + key);
    if (el) next[key] = el.value.trim();
  });
  return next;
}

function saveTexts() {
  texts = readTextsForm();
  localStorage.setItem("temgelo_texts", JSON.stringify(texts));
  document.getElementById("catalog-status").textContent =
    "Textos guardados localmente – ainda não publicados";
  alert("Textos guardados. Clique em Publicar para o mapa público.");
}

// ---------- Render list ----------
function renderList() {
  const container = document.getElementById("seller-list");
  if (!sellers.length) {
    container.innerHTML = `<p class="text-muted text-sm">Nenhum vendedor ainda. Clique em + Adicionar.</p>`;
    return;
  }

  container.innerHTML = sellers
    .map((s) => {
      const avail = isEffectivelyAvailable(s);
      const statusClass = avail ? "ok" : "no";
      const statusText = avail ? "Tem gelo" : "Sem / expirado";
      return `
        <div class="seller-item">
          <div class="info">
            <div class="name">${escapeHtml(s.name)}</div>
            <div class="meta">
              ${escapeHtml(s.neighborhood || "")} · ${s.buckets} baldes · ${s.price || "—"} Kz
              <span class="status-pill ${statusClass}">${statusText}</span>
            </div>
          </div>
          <div class="actions">
            <button type="button" title="Editar" onclick="editSeller('${s.id}')">✎</button>
            <button type="button" title="Reconfirmar (24h)" onclick="reconfirm('${s.id}')">↻</button>
            <button type="button" title="Apagar" onclick="deleteSeller('${s.id}')">🗑</button>
          </div>
        </div>
      `;
    })
    .join("");
}

// ---------- Modal ----------
function openSellerModal(id = null) {
  editingId = id;
  const modal = document.getElementById("seller-modal");
  const title = document.getElementById("modal-title");

  if (id) {
    const s = sellers.find((x) => x.id === id);
    if (!s) return;
    title.textContent = "Editar vendedor";
    document.getElementById("seller-id").value = s.id;
    document.getElementById("f-name").value = s.name || "";
    document.getElementById("f-lat").value = s.lat ?? "";
    document.getElementById("f-lng").value = s.lng ?? "";
    document.getElementById("f-neighborhood").value = s.neighborhood || "";
    document.getElementById("f-buckets").value = s.buckets ?? 0;
    document.getElementById("f-price").value = s.price || "";
    document.getElementById("f-freeze").value = s.freeze || "muito_congelado";
    document.getElementById("f-whatsapp").value = s.whatsapp || "";
    document.getElementById("f-notes").value = s.notes || "";
    document.getElementById("f-available").checked = !!s.available;
  } else {
    title.textContent = "Adicionar vendedor";
    document.getElementById("seller-id").value = "";
    document.getElementById("f-name").value = "";
    document.getElementById("f-lat").value = "";
    document.getElementById("f-lng").value = "";
    document.getElementById("f-neighborhood").value = "";
    document.getElementById("f-buckets").value = "5";
    document.getElementById("f-price").value = "1500";
    document.getElementById("f-freeze").value = "muito_congelado";
    document.getElementById("f-whatsapp").value = "2449";
    document.getElementById("f-notes").value = "";
    document.getElementById("f-available").checked = true;
  }

  modal.classList.remove("hidden");
}

function closeSellerModal() {
  document.getElementById("seller-modal").classList.add("hidden");
  editingId = null;
}

function saveSeller() {
  const name = document.getElementById("f-name").value.trim();
  const lat = parseFloat(document.getElementById("f-lat").value);
  const lng = parseFloat(document.getElementById("f-lng").value);

  if (!name || isNaN(lat) || isNaN(lng)) {
    alert("Nome, latitude e longitude são obrigatórios.");
    return;
  }

  const data = {
    id: document.getElementById("seller-id").value || "s" + Date.now(),
    name,
    lat,
    lng,
    neighborhood: document.getElementById("f-neighborhood").value.trim(),
    buckets: parseInt(document.getElementById("f-buckets").value, 10) || 0,
    price: document.getElementById("f-price").value.trim(),
    freeze: document.getElementById("f-freeze").value,
    whatsapp: document.getElementById("f-whatsapp").value.trim(),
    notes: document.getElementById("f-notes").value.trim(),
    available: document.getElementById("f-available").checked,
    updatedAt: new Date().toISOString()
  };

  const idx = sellers.findIndex((s) => s.id === data.id);
  if (idx >= 0) {
    sellers[idx] = data;
  } else {
    sellers.push(data);
  }

  saveLocal();
  renderList();
  closeSellerModal();
}

function editSeller(id) {
  openSellerModal(id);
}

function deleteSeller(id) {
  if (!confirm("Apagar este vendedor?")) return;
  sellers = sellers.filter((s) => s.id !== id);
  saveLocal();
  renderList();
}

function reconfirm(id) {
  const s = sellers.find((x) => x.id === id);
  if (!s) return;
  s.updatedAt = new Date().toISOString();
  s.available = true;
  if (s.buckets < 1) s.buckets = 1;
  saveLocal();
  renderList();
  alert("Reconfirmado! Válido por mais 24 horas.");
}

// ---------- Local draft ----------
function saveLocal() {
  localStorage.setItem("temgelo_sellers", JSON.stringify(sellers));
  localStorage.setItem("temgelo_texts", JSON.stringify(texts));
  document.getElementById("catalog-status").textContent =
    "Rascunho guardado localmente – ainda não publicado";
}

// ---------- Publish ----------
async function publishCatalog() {
  // Include latest form values if user is on Texts section
  if (document.getElementById("t-pageTitle")) {
    texts = readTextsForm();
  }

  const catalog = {
    updatedAt: new Date().toISOString(),
    sellers: sellers,
    texts: texts
  };

  // Always keep a local copy
  localStorage.setItem("temgelo_sellers", JSON.stringify(sellers));
  localStorage.setItem("temgelo_texts", JSON.stringify(texts));

  if (!PUBLISH_URL) {
    // Fallback: download JSON so you can upload manually to Cloudinary
    const blob = new Blob([JSON.stringify(catalog, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "catalog.json";
    a.click();
    URL.revokeObjectURL(url);

    alert(
      "Worker ainda não configurado.\n\n" +
      "O ficheiro catalog.json foi descarregado.\n" +
      "Faça upload manual para Cloudinary:\n" +
      "Folder: gelo\n" +
      "Public ID: catalog\n" +
      "Resource type: raw\n\n" +
      "Depois o mapa público vai ler esse ficheiro."
    );
    return;
  }

  // Real publish via Worker
  try {
    const res = await fetch(PUBLISH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: ADMIN_PASSWORD,
        catalog
      })
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error((detail || res.statusText || "HTTP " + res.status).slice(0, 200));
    }
    document.getElementById("catalog-status").textContent =
      "Publicado com sucesso! " + new Date().toLocaleString("pt-AO");
    alert("Publicado! O mapa público já deve mostrar as alterações.");
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      alert(
        "Erro de rede ao publicar (Failed to fetch).\n\n" +
          "1) Confirme que o Worker está online.\n" +
          "2) Actualize o service worker (limpe dados do site ou hard-refresh).\n" +
          "3) Confirme que ADMIN_PASSWORD em admin.js = secret do Worker."
      );
    } else {
      alert("Erro ao publicar: " + msg);
    }
  }
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
