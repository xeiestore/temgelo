// Tem Gelo? – Admin logic

const ADMIN_PASSWORD = "EuRico2027"; // Must match the Worker secret ADMIN_PASSWORD
const API_BASE = "https://tem-gelo-publish.xeieloja.workers.dev";
const CATALOG_URL = API_BASE + "/catalog";
const CATALOG_FALLBACK =
  "https://res.cloudinary.com/efvlvhce/raw/upload/gelo/catalog.json";
const PUBLISH_URL = API_BASE + "/publish";

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
  "btnCall",
  "btnReport",
  "noContact",
  "waMessage",
  "reportMessage",
  "countFormat",
  "adminWhatsApp",
  "adTitle",
  "adBody",
  "adCta",
  "adWaMessage",
  "freezeMuito",
  "freezeParcial",
  "freezeFraco",
  "menuLogin",
  "menuRegister",
  "menuSafety",
  "menuReport",
  "menuSellerSection",
  "menuStock",
  "menuProfile",
  "menuPanel",
  "menuLogout",
  "menuInstall"
];

// ---------- Boot ----------
document.addEventListener("DOMContentLoaded", () => {
  // Stay logged in by default (localStorage); otherwise sessionStorage
  if (
    localStorage.getItem("temgelo_admin") === "1" ||
    sessionStorage.getItem("temgelo_admin") === "1"
  ) {
    showAdmin();
  }

  document.getElementById("admin-password")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") tryLogin();
  });
});

function tryLogin() {
  const pw = document.getElementById("admin-password").value;
  if (pw === ADMIN_PASSWORD) {
    const stay = document.getElementById("admin-stay")?.checked !== false;
    if (stay) {
      localStorage.setItem("temgelo_admin", "1");
      sessionStorage.removeItem("temgelo_admin");
    } else {
      sessionStorage.setItem("temgelo_admin", "1");
      localStorage.removeItem("temgelo_admin");
    }
    showAdmin();
  } else {
    alert("Palavra-passe incorrecta");
  }
}

function logout() {
  sessionStorage.removeItem("temgelo_admin");
  localStorage.removeItem("temgelo_admin");
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
  texts = { ...DEFAULT_TEXTS };

  // Local draft texts (if any)
  try {
    const localTexts = localStorage.getItem("temgelo_texts");
    if (localTexts) texts = { ...DEFAULT_TEXTS, ...JSON.parse(localTexts) };
  } catch (_) {}

  // Prefer real accounts (source of truth for the map)
  try {
    const res = await fetch(
      API_BASE + "/admin/sellers?password=" + encodeURIComponent(ADMIN_PASSWORD) + "&t=" + Date.now(),
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json();
      sellers = Array.isArray(data.sellers) ? data.sellers : [];
      document.getElementById("catalog-status").textContent =
        `Contas no servidor (${sellers.length}) – ${new Date().toLocaleString("pt-AO")}`;
    } else {
      throw new Error("HTTP " + res.status);
    }
  } catch (err) {
    // Fallback: public catalog (map view only – no full account fields)
    try {
      let res = await fetch(CATALOG_URL + "?t=" + Date.now(), { cache: "no-store" });
      if (!res.ok) {
        res = await fetch(CATALOG_FALLBACK + "?t=" + Date.now(), { cache: "no-store" });
      }
      if (res.ok) {
        const data = await res.json();
        sellers = Array.isArray(data.sellers) ? data.sellers : [];
        document.getElementById("catalog-status").textContent =
          `Catálogo público (${sellers.length}) – contas admin indisponíveis`;
        if (data.texts && typeof data.texts === "object") {
          texts = { ...DEFAULT_TEXTS, ...data.texts };
        }
        if (data.images && typeof data.images === "object") {
          fillImagesForm(data.images);
        }
      } else {
        sellers = [];
        document.getElementById("catalog-status").textContent =
          "Sem dados – Worker indisponível";
      }
    } catch (_) {
      sellers = [];
      document.getElementById("catalog-status").textContent =
        "Sem dados – Worker indisponível";
    }
  }

  // Always try to refresh texts/images from public catalog
  try {
    const res = await fetch(CATALOG_URL + "?t=" + Date.now(), { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data && data.texts && typeof data.texts === "object") {
        texts = { ...DEFAULT_TEXTS, ...data.texts };
      }
      if (data && data.images && typeof data.images === "object") {
        fillImagesForm(data.images);
      }
    }
  } catch (_) {}

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

async function saveTexts() {
  texts = readTextsForm();
  localStorage.setItem("temgelo_texts", JSON.stringify(texts));
  // Persist to KV immediately so texts survive Worker/Pages redeploys
  try {
    const res = await fetch(API_BASE + "/admin/republish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: ADMIN_PASSWORD,
        texts,
        images: readImagesForm()
      })
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    document.getElementById("catalog-status").textContent =
      "Textos publicados no servidor (" +
      (data.count ?? "?") +
      " vendedores activos) – " +
      new Date().toLocaleString("pt-AO");
    alert("Textos guardados e publicados. Permanecem após redeploy.");
  } catch (err) {
    document.getElementById("catalog-status").textContent =
      "Textos só no browser – falha ao publicar no servidor";
    alert(
      "Guardado localmente, mas falhou no servidor:\n" +
        (err && err.message ? err.message : String(err)) +
        "\n\nClique em Publicar quando o Worker estiver online."
    );
  }
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
      const banned = s.status === "banned";
      const avail = !banned && isEffectivelyAvailable(s);
      const statusClass = banned ? "no" : avail ? "ok" : "no";
      const statusText = banned ? "Bloqueado" : avail ? "Tem gelo" : "Sem / expirado";
      const userBit = s.username ? "@" + escapeHtml(s.username) + " · " : "";
      return `
        <div class="seller-item">
          <div class="info">
            <div class="name">${escapeHtml(s.name)}</div>
            <div class="meta">
              ${userBit}${escapeHtml(s.neighborhood || "")} · ${s.buckets ?? 0} baldes · ${s.price || "—"} Kz
              <span class="status-pill ${statusClass}">${statusText}</span>
            </div>
          </div>
          <div class="actions">
            <button type="button" title="Editar" onclick="editSeller('${s.id}')" aria-label="Editar"><svg class="action-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
            <button type="button" title="Reconfirmar (24h)" onclick="reconfirm('${s.id}')" aria-label="Reconfirmar"><svg class="action-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8A5.87 5.87 0 0 1 6 12c0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z"/></svg></button>
            <button type="button" title="Apagar" onclick="deleteSeller('${s.id}')" aria-label="Apagar"><svg class="action-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
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
  const userEl = document.getElementById("f-username");
  const passEl = document.getElementById("f-seller-password");

  if (id) {
    const s = sellers.find((x) => x.id === id);
    if (!s) return;
    title.textContent = "Editar vendedor";
    document.getElementById("seller-id").value = s.id;
    document.getElementById("f-name").value = s.name || "";
    if (userEl) {
      userEl.value = s.username || "";
      userEl.disabled = true;
      userEl.placeholder = s.username || "";
    }
    if (passEl) {
      passEl.value = "";
      passEl.placeholder = "deixe vazio para não alterar";
    }
    document.getElementById("f-lat").value = s.lat ?? "";
    document.getElementById("f-lng").value = s.lng ?? "";
    document.getElementById("f-neighborhood").value = s.neighborhood || "";
    document.getElementById("f-buckets").value = s.buckets ?? 0;
    document.getElementById("f-price").value = s.price || "";
    document.getElementById("f-freeze").value = s.freeze || "muito_congelado";
    document.getElementById("f-whatsapp").value = s.whatsapp || "";
    document.getElementById("f-phone").value = s.phone || "";
    const pay = s.payments || {};
    document.getElementById("f-pay-numerario").checked = !!pay.numerario;
    document.getElementById("f-pay-multicaixa").checked = !!pay.multicaixa;
    document.getElementById("f-pay-unitel").checked = !!pay.unitel;
    document.getElementById("f-pay-other").value = pay.other || "";
    document.getElementById("f-notes").value = s.notes || "";
    document.getElementById("f-available").checked = !!s.available;
  } else {
    title.textContent = "Adicionar vendedor";
    document.getElementById("seller-id").value = "";
    document.getElementById("f-name").value = "";
    if (userEl) {
      userEl.value = "";
      userEl.disabled = false;
      userEl.placeholder = "auto se vazio";
    }
    if (passEl) {
      passEl.value = "";
      passEl.placeholder = "auto se vazia";
    }
    document.getElementById("f-lat").value = "";
    document.getElementById("f-lng").value = "";
    document.getElementById("f-neighborhood").value = "";
    document.getElementById("f-buckets").value = "5";
    document.getElementById("f-price").value = "1500";
    document.getElementById("f-freeze").value = "muito_congelado";
    document.getElementById("f-whatsapp").value = "";
    document.getElementById("f-phone").value = "";
    document.getElementById("f-pay-numerario").checked = true;
    document.getElementById("f-pay-multicaixa").checked = false;
    document.getElementById("f-pay-unitel").checked = false;
    document.getElementById("f-pay-other").value = "";
    document.getElementById("f-notes").value = "";
    document.getElementById("f-available").checked = true;
  }

  modal.classList.remove("hidden");
}

function closeSellerModal() {
  document.getElementById("seller-modal").classList.add("hidden");
  editingId = null;
}

function readSellerFormPayload() {
  return {
    name: document.getElementById("f-name").value.trim(),
    lat: parseFloat(document.getElementById("f-lat").value),
    lng: parseFloat(document.getElementById("f-lng").value),
    username: (document.getElementById("f-username")?.value || "").trim(),
    sellerPassword: (document.getElementById("f-seller-password")?.value || "").trim(),
    neighborhood: document.getElementById("f-neighborhood").value.trim(),
    buckets: parseInt(document.getElementById("f-buckets").value, 10) || 0,
    price: document.getElementById("f-price").value.trim(),
    freeze: document.getElementById("f-freeze").value,
    whatsapp: document.getElementById("f-whatsapp").value.trim(),
    phone: document.getElementById("f-phone").value.trim(),
    payments: {
      numerario: !!document.getElementById("f-pay-numerario").checked,
      multicaixa: !!document.getElementById("f-pay-multicaixa").checked,
      unitel: !!document.getElementById("f-pay-unitel").checked,
      other: document.getElementById("f-pay-other").value.trim()
    },
    notes: document.getElementById("f-notes").value.trim(),
    available: document.getElementById("f-available").checked
  };
}

async function saveSeller() {
  const data = readSellerFormPayload();
  if (!data.name || isNaN(data.lat) || isNaN(data.lng)) {
    alert("Nome, latitude e longitude são obrigatórios.");
    return;
  }

  const existingId = document.getElementById("seller-id").value.trim();
  const btn = document.querySelector("#seller-modal .btn-green");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "A guardar…";
  }

  try {
    if (existingId) {
      const res = await fetch(API_BASE + "/admin/sellers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: ADMIN_PASSWORD,
          sellerId: existingId,
          ...data
        })
      });
      const text = await res.text();
      let payload = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch (_) {}
      if (!res.ok) {
        throw new Error((payload && payload.error) || text || "HTTP " + res.status);
      }
      alert("Vendedor actualizado e publicado no mapa.");
    } else {
      const res = await fetch(API_BASE + "/admin/sellers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: ADMIN_PASSWORD,
          ...data
        })
      });
      const text = await res.text();
      let payload = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch (_) {}
      if (!res.ok) {
        throw new Error((payload && payload.error) || text || "HTTP " + res.status);
      }
      const u = payload && payload.seller && payload.seller.username;
      const gen = payload && payload.generatedPassword;
      if (gen) {
        alert(
          "Conta criada e no mapa.\n\nUtilizador: " +
            (u || "—") +
            "\nPalavra-passe gerada: " +
            gen +
            "\n\nGuarde estes dados para o vendedor entrar em seller.html."
        );
      } else {
        alert(
          "Conta criada e publicada no mapa." +
            (u ? "\nUtilizador: " + u : "")
        );
      }
    }
    closeSellerModal();
    await loadSellers();
  } catch (err) {
    alert("Erro ao guardar: " + (err && err.message ? err.message : String(err)));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Guardar";
    }
  }
}

function editSeller(id) {
  openSellerModal(id);
}

async function deleteSeller(id) {
  if (!confirm("Apagar este vendedor da conta e do mapa?")) return;
  try {
    const res = await fetch(API_BASE + "/admin/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: ADMIN_PASSWORD,
        sellerId: id,
        action: "delete"
      })
    });
    if (!res.ok) throw new Error(await res.text());
    await loadSellers();
    alert("Apagado.");
  } catch (err) {
    alert("Erro: " + (err && err.message ? err.message : String(err)));
  }
}

async function reconfirm(id) {
  const s = sellers.find((x) => x.id === id);
  if (!s) return;
  try {
    const res = await fetch(API_BASE + "/admin/sellers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: ADMIN_PASSWORD,
        sellerId: id,
        available: true,
        buckets: Math.max(1, Number(s.buckets) || 1)
      })
    });
    if (!res.ok) throw new Error(await res.text());
    await loadSellers();
    alert("Reconfirmado no servidor! Válido por mais 24 horas no mapa.");
  } catch (err) {
    alert("Erro: " + (err && err.message ? err.message : String(err)));
  }
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

  // Always keep a local copy
  localStorage.setItem("temgelo_sellers", JSON.stringify(sellers));
  localStorage.setItem("temgelo_texts", JSON.stringify(texts));

  // Preferred path: persist texts in KV + rebuild catalog from approved accounts.
  // This is what survives Worker / Pages redeploys. Legacy /publish is only
  // used as fallback when the accounts index is still empty.
  try {
    const res = await fetch(API_BASE + "/admin/republish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: ADMIN_PASSWORD,
        texts,
        images: readImagesForm()
      })
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error((detail || res.statusText || "HTTP " + res.status).slice(0, 200));
    }
    const data = await res.json();
    const count = data.count ?? 0;

    if (count === 0 && Array.isArray(sellers) && sellers.length > 0) {
      // No approved accounts yet – seed public catalog from admin draft once
      const catalog = {
        updatedAt: new Date().toISOString(),
        sellers,
        texts
      };
      const seedRes = await fetch(PUBLISH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: ADMIN_PASSWORD, catalog })
      });
      if (!seedRes.ok) {
        const detail = await seedRes.text().catch(() => "");
        throw new Error((detail || seedRes.statusText || "HTTP " + seedRes.status).slice(0, 200));
      }
      document.getElementById("catalog-status").textContent =
        "Publicado (rascunho inicial + textos) – " + new Date().toLocaleString("pt-AO");
      alert("Publicado! Textos e catálogo inicial no servidor.");
      return;
    }

    document.getElementById("catalog-status").textContent =
      "Publicado (" + count + " activos + textos) – " + new Date().toLocaleString("pt-AO");
    alert("Publicado! Textos ficam no KV e sobrevivem a redeploys.");
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

// ---------- Accounts moderation (seller self-registration) ----------
async function loadAccounts() {
  const container = document.getElementById("accounts-list");
  if (!container) return;
  container.innerHTML = `<p class="text-muted text-sm">A carregar contas…</p>`;
  try {
    const res = await fetch(
      API_BASE + "/admin/sellers?password=" + encodeURIComponent(ADMIN_PASSWORD),
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const list = data.sellers || [];
    if (!list.length) {
      container.innerHTML = `<p class="text-muted text-sm">Nenhuma conta registada ainda.</p>`;
      return;
    }
    // Active first, banned last
    list.sort((a, b) => {
      const order = { approved: 0, pending: 1, banned: 2 };
      return (order[a.status] ?? 1) - (order[b.status] ?? 1);
    });
    container.innerHTML = list
      .map((s) => {
        const st = s.status === "banned" ? "banned" : "approved";
        const label = st === "banned" ? "Bloqueado" : "Activo";
        return `
        <div class="seller-item">
          <div class="info">
            <div class="name">${escapeHtml(s.name)}</div>
            <div class="meta">
              @${escapeHtml(s.username || s.id || "")}${s.email ? " · " + escapeHtml(s.email) : ""}
              · ${escapeHtml(s.neighborhood || "")}${s.whatsapp ? " · " + escapeHtml(s.whatsapp) : ""}
              · ${s.buckets ?? 0} baldes
              <span class="status-pill ${st}">${label}</span>
            </div>
          </div>
          <div class="actions">
            ${
              st === "banned"
                ? `<button type="button" title="Reactivar" onclick="moderateAccount('${s.id}','approve')" aria-label="Reactivar"><svg class="action-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></button>`
                : `<button type="button" title="Bloquear" onclick="moderateAccount('${s.id}','ban')" aria-label="Bloquear"><svg class="action-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9A7.92 7.92 0 0 1 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1A7.92 7.92 0 0 1 20 12c0 4.42-3.58 8-8 8z"/></svg></button>`
            }
            <button type="button" title="Apagar" onclick="moderateAccount('${s.id}','delete')" aria-label="Apagar"><svg class="action-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
          </div>
        </div>`;
      })
      .join("");
  } catch (err) {
    container.innerHTML = `<p class="text-muted text-sm">Erro: ${escapeHtml(err.message)}. Confirme o Worker e o KV.</p>`;
  }
}

async function moderateAccount(sellerId, action) {
  const labels = { approve: "reactivar", ban: "bloquear", delete: "apagar" };
  if (!confirm("Tem a certeza que quer " + (labels[action] || action) + " esta conta?")) return;
  try {
    const res = await fetch(API_BASE + "/admin/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: ADMIN_PASSWORD,
        sellerId,
        action
      })
    });
    if (!res.ok) throw new Error(await res.text());
    await loadAccounts();
    alert("Feito.");
  } catch (err) {
    alert("Erro: " + err.message);
  }
}

async function republishFromAccounts() {
  try {
    const res = await fetch(API_BASE + "/admin/republish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: ADMIN_PASSWORD,
        texts: readTextsForm ? readTextsForm() : texts,
        images: readImagesForm()
      })
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    document.getElementById("catalog-status").textContent =
      "Republicado a partir das contas (" + (data.count ?? "?") + " activos).";
    alert("Catálogo público actualizado.");
  } catch (err) {
    alert("Erro: " + err.message);
  }
}


// ---------- Site images ----------
function readImagesForm() {
  return {
    logoHeader: (document.getElementById("img-logoHeader")?.value || "").trim(),
    logoDrawer: (document.getElementById("img-logoDrawer")?.value || "").trim(),
    logoBrand: (document.getElementById("img-logoBrand")?.value || "").trim()
  };
}

function fillImagesForm(images) {
  const img = images || {};
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || "";
  };
  set("img-logoHeader", img.logoHeader);
  set("img-logoDrawer", img.logoDrawer);
  set("img-logoBrand", img.logoBrand);

  const map = {
    logoHeader: "img-preview-header",
    logoDrawer: "img-preview-drawer",
    logoBrand: "img-preview-brand"
  };
  Object.keys(map).forEach((slot) => {
    const el = document.getElementById(map[slot]);
    if (el && img[slot]) {
      el.src = img[slot];
      el.style.display = "block";
    }
  });
}

async function uploadSiteImage(slot, fileInputId) {
  const input = document.getElementById(fileInputId);
  const status = document.getElementById("status-" + slot);
  if (!input || !input.files || !input.files[0]) {
    alert("Escolha um ficheiro de imagem primeiro.");
    return;
  }
  const file = input.files[0];
  if (file.size > 4.5 * 1024 * 1024) {
    alert("Imagem demasiado grande (máx. cerca de 4 MB).");
    return;
  }
  if (status) status.textContent = "A enviar…";

  const form = new FormData();
  form.append("password", ADMIN_PASSWORD);
  form.append("slot", slot);
  form.append("file", file, file.name);

  try {
    const res = await fetch(API_BASE + "/admin/upload-image", {
      method: "POST",
      body: form
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || (await res.text().catch(() => res.statusText)));
    }
    if (data.images) fillImagesForm(data.images);
    else if (data.url) {
      const hidden = document.getElementById("img-" + slot);
      if (hidden) hidden.value = data.url;
      const previewId =
        slot === "logoHeader"
          ? "img-preview-header"
          : slot === "logoDrawer"
            ? "img-preview-drawer"
            : "img-preview-brand";
      const prev = document.getElementById(previewId);
      if (prev) prev.src = data.url;
    }
    if (status) status.textContent = "Carregado · " + new Date().toLocaleTimeString("pt-AO");
    document.getElementById("catalog-status").textContent =
      "Imagem " + slot + " actualizada – " + new Date().toLocaleString("pt-AO");
  } catch (err) {
    if (status) status.textContent = "Erro";
    alert("Erro no upload: " + (err.message || err));
  }
}

// ---------- Reports ----------
async function loadReports() {
  const container = document.getElementById("reports-list");
  if (!container) return;
  container.innerHTML = `<p class="text-muted text-sm">A carregar…</p>`;
  try {
    const res = await fetch(
      API_BASE + "/admin/reports?password=" + encodeURIComponent(ADMIN_PASSWORD),
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const list = data.reports || [];
    if (!list.length) {
      container.innerHTML = `<p class="text-muted text-sm">Nenhum relatório ainda.</p>`;
      return;
    }
    container.innerHTML = list
      .map((r) => {
        const st = r.status || "open";
        const when = r.createdAt
          ? new Date(r.createdAt).toLocaleString("pt-AO")
          : "";
        const who = r.sellerName
          ? escapeHtml(r.sellerName) + (r.sellerId ? " (" + escapeHtml(r.sellerId) + ")" : "")
          : "Problema geral";
        return `
        <div class="seller-item">
          <div class="info">
            <div class="name">${who}</div>
            <div class="meta">${when} · <span class="status-pill ${st === "open" ? "pending" : "approved"}">${st === "open" ? "Aberto" : "Resolvido"}</span></div>
            <div class="text-sm" style="margin-top:6px;white-space:pre-wrap">${escapeHtml(r.message || "")}</div>
            ${r.contact ? `<div class="text-sm text-muted">Contacto: ${escapeHtml(r.contact)}</div>` : ""}
          </div>
          <div class="actions">
            ${
              st === "open"
                ? `<button type="button" title="Marcar resolvido" onclick="resolveReport('${r.id}','resolved')">✓</button>`
                : `<button type="button" title="Reabrir" onclick="resolveReport('${r.id}','open')">↺</button>`
            }
            <button type="button" title="Apagar" onclick="resolveReport('${r.id}','delete')">🗑</button>
          </div>
        </div>`;
      })
      .join("");
  } catch (err) {
    container.innerHTML = `<p class="text-muted text-sm">Erro: ${escapeHtml(err.message)}</p>`;
  }
}

async function resolveReport(id, action) {
  try {
    const body = { password: ADMIN_PASSWORD, id };
    if (action === "delete") body.action = "delete";
    else body.status = action;
    const res = await fetch(API_BASE + "/admin/reports/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await res.text());
    await loadReports();
  } catch (err) {
    alert("Erro: " + err.message);
  }
}
