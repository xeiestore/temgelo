// Tem Gelo? – Seller portal (accounts + stock)

const API_BASE = "https://tem-gelo-publish.xeieloja.workers.dev";
const TOKEN_KEY = "temgelo_seller_token";
const PROFILE_KEY = "temgelo_seller_profile";

function readToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || null;
}
function writeToken(value, stay) {
  if (stay) {
    localStorage.setItem(TOKEN_KEY, value);
    sessionStorage.removeItem(TOKEN_KEY);
  } else {
    sessionStorage.setItem(TOKEN_KEY, value);
    localStorage.removeItem(TOKEN_KEY);
  }
}
function saveSellerProfile(seller, stay) {
  if (!seller) return;
  const payload = JSON.stringify({
    name: seller.name || "",
    username: seller.username || ""
  });
  // Prefer same storage as token when possible
  try {
    if (stay === false) {
      sessionStorage.setItem(PROFILE_KEY, payload);
      localStorage.removeItem(PROFILE_KEY);
    } else {
      localStorage.setItem(PROFILE_KEY, payload);
      sessionStorage.removeItem(PROFILE_KEY);
    }
  } catch (_) {}
}
function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PROFILE_KEY);
  sessionStorage.removeItem(PROFILE_KEY);
}

let token = readToken();
let me = null;
let regMap = null;
let regMarker = null;
let dashMap = null;
let dashMarker = null;

// ---------- Boot ----------
function setupInstallButtons() {
  const handler = (e) => {
    e.preventDefault();
    if (window.temGeloInstall) window.temGeloInstall.promptInstall();
  };
  document.getElementById("btn-install-app")?.addEventListener("click", handler);
  document.getElementById("btn-install-app-brand")?.addEventListener("click", handler);
  // Hide install CTAs if already running as installed app
  if (window.temGeloInstall && window.temGeloInstall.isStandalone()) {
    document.querySelectorAll(".install-app-btn, .install-app-btn-brand, #install-app-hint").forEach((el) => {
      el.classList.add("hidden");
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setupDrawer();
  setupAuthTabs();
  setupPasswordToggles();
  setupInstallButtons();
  document.getElementById("btn-login")?.addEventListener("click", doLogin);
  document.getElementById("btn-register")?.addEventListener("click", doRegister);
  document.getElementById("btn-save-stock")?.addEventListener("click", () => saveMe("stock"));
  document.getElementById("btn-stock-soldout")?.addEventListener("click", markSoldOut);
  document.getElementById("dash-unit")?.addEventListener("change", updateDashQtyLabel);
  document.getElementById("reg-unit")?.addEventListener("change", updateRegQtyLabel);
  document.getElementById("dash-available")?.addEventListener("change", updateStockHints);
  document.getElementById("dash-buckets")?.addEventListener("input", updateStockHints);
  updateRegQtyLabel();
  updateDashQtyLabel();
  document.getElementById("btn-add-package")?.addEventListener("click", () => addPackageRow("dash-packages"));
  document.getElementById("btn-reg-add-package")?.addEventListener("click", () => addPackageRow("reg-packages"));
  renderPackageRows("dash-packages", []);
  renderPackageRows("reg-packages", []);
  document.getElementById("btn-save-profile")?.addEventListener("click", () => saveMe("profile"));
  document.getElementById("btn-delete-account")?.addEventListener("click", deleteMyAccount);
  document.getElementById("link-to-profile")?.addEventListener("click", (e) => {
    e.preventDefault();
    try {
      sessionStorage.setItem("temgelo_seller_view", "profile");
    } catch (_) {}
    history.replaceState(null, "", "seller.html?view=profile#perfil");
    applySellerHash();
    if (me) fillDash();
    else loadMe();
  });
  document.getElementById("link-to-stock")?.addEventListener("click", (e) => {
    e.preventDefault();
    try {
      sessionStorage.setItem("temgelo_seller_view", "stock");
    } catch (_) {}
    history.replaceState(null, "", "seller.html?view=stock#stock");
    applySellerHash();
    if (me) fillDash();
    else loadMe();
  });
  document.getElementById("btn-reg-gps")?.addEventListener("click", () => useGps("reg"));
  document.getElementById("btn-dash-gps")?.addEventListener("click", () => useGps("dash"));

  document.getElementById("login-password")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doLogin();
  });

  window.addEventListener("hashchange", () => {
    applySellerHash();
    if (me) fillDash();
  });
  window.addEventListener("popstate", () => {
    applySellerHash();
    if (me) fillDash();
  });

  if (token) {
    // Show dashboard shell immediately (CSS also hides auth via seller-has-session)
    document.documentElement.classList.add("seller-has-session");
    document.getElementById("screen-auth")?.classList.add("hidden");
    document.getElementById("screen-dash")?.classList.remove("hidden");
    applySellerHash();
    loadMe().then(() => {
      fillDash();
      applySellerHash();
      setTimeout(() => {
        fillDash();
        applySellerHash();
      }, 0);
      setTimeout(() => {
        fillDash();
        applySellerHash();
        setTimeout(initDashMap, 50);
      }, 100);
    });
  } else {
    document.documentElement.classList.remove("seller-has-session");
    showAuth();
    initRegMap();
    if (location.hash === "#registar") {
      switchTab("register");
    }
  }
});

/** Exclusive views: stock page vs profile page (not one long scroll). */
function applySellerHash() {
  const rawHash = (location.hash || "").toLowerCase().replace(/^#/, "").split("?")[0];
  const path = (location.pathname || "").toLowerCase();
  const params = new URLSearchParams(location.search || "");
  let stored = "";
  try {
    stored = sessionStorage.getItem("temgelo_seller_view") || "";
  } catch (_) {}

  const root = document.documentElement;
  root.classList.remove("seller-view-stock", "seller-view-profile");

  // Priority: hash → ?view= → sessionStorage → path (hash must win so menu can switch)
  let view = "all";
  if (rawHash === "stock" || rawHash === "meu-stock") {
    view = "stock";
  } else if (rawHash === "perfil" || rawHash === "profile") {
    view = "profile";
  } else if (params.get("view") === "stock" || /\/stock(\.html)?$/.test(path)) {
    view = "stock";
  } else if (
    params.get("view") === "profile" ||
    params.get("view") === "perfil" ||
    /\/profile(\.html)?$/.test(path)
  ) {
    view = "profile";
  } else if (stored === "stock") {
    view = "stock";
  } else if (stored === "profile") {
    view = "profile";
  }

  const stock = document.getElementById("section-stock");
  const profile = document.getElementById("section-profile");
  const title = document.getElementById("topbar-title");

  function showEl(el, on) {
    if (!el) return;
    if (on) {
      el.classList.remove("hidden");
      el.hidden = false;
      el.style.display = "";
      el.style.visibility = "";
    } else {
      el.classList.add("hidden");
      el.hidden = true;
      el.style.display = "none";
      el.style.visibility = "hidden";
    }
  }

  if (view === "stock") {
    root.classList.add("seller-view-stock");
    try {
      sessionStorage.setItem("temgelo_seller_view", "stock");
    } catch (_) {}
    showEl(stock, true);
    showEl(profile, false);
    if (title) title.textContent = "Meu stock";
    window.scrollTo(0, 0);
  } else if (view === "profile") {
    root.classList.add("seller-view-profile");
    try {
      sessionStorage.setItem("temgelo_seller_view", "profile");
    } catch (_) {}
    showEl(profile, true);
    showEl(stock, false);
    if (title) title.textContent = "Perfil";
    window.scrollTo(0, 0);
    // Ensure fields are filled and map sized when profile becomes visible
    if (me) fillDash();
    setTimeout(initDashMap, 80);
  } else {
    try {
      sessionStorage.removeItem("temgelo_seller_view");
    } catch (_) {}
    showEl(stock, true);
    showEl(profile, true);
    if (title) title.textContent = me?.name || "A minha conta";
  }
}

function setupPasswordToggles() {
  document.querySelectorAll(".password-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.getAttribute("data-target"));
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.querySelector(".icon-eye")?.classList.toggle("hidden", show);
      btn.querySelector(".icon-eye-off")?.classList.toggle("hidden", !show);
      btn.setAttribute(
        "aria-label",
        show ? "Ocultar palavra-passe" : "Mostrar palavra-passe"
      );
    });
  });
}

// ---------- Drawer / hamburger ----------
function setupDrawer() {
  const btn = document.getElementById("hamburger-btn");
  const drawer = document.getElementById("drawer");
  const backdrop = document.getElementById("drawer-backdrop");
  const closeBtn = document.getElementById("drawer-close");

  function open() {
    drawer.classList.remove("hidden");
    backdrop.classList.remove("hidden");
    drawer.setAttribute("aria-hidden", "false");
    btn.setAttribute("aria-expanded", "true");
    document.body.classList.add("drawer-open");
  }
  function close() {
    drawer.classList.add("hidden");
    backdrop.classList.add("hidden");
    drawer.setAttribute("aria-hidden", "true");
    btn.setAttribute("aria-expanded", "false");
    document.body.classList.remove("drawer-open");
  }

  btn?.addEventListener("click", () => {
    if (drawer.classList.contains("hidden")) open();
    else close();
  });
  backdrop?.addEventListener("click", close);
  closeBtn?.addEventListener("click", close);
  window._closeDrawer = close;
  renderDrawerNav();
}

function renderDrawerNav() {
  const nav = document.getElementById("drawer-nav");
  if (!nav) return;
  const iconStock = '<svg class="drawer-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20 2H4c-1 0-2 1-2 2v16c0 1 1 2 2 2h16c1 0 2-1 2-2V4c0-1-1-2-2-2zM9 4h2v5l-1-.75L9 9V4zm11 16H4V4h3v9l3-2.25L13 13V4h7v16z"/></svg>';
  const iconUser = '<svg class="drawer-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
  const iconMap = '<svg class="drawer-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z"/></svg>';
  const iconLogout = '<svg class="drawer-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>';
  if (me) {
    nav.innerHTML = `
      <a href="#" class="drawer-link" data-action="stock">${iconStock} Meu stock</a>
      <a href="#" class="drawer-link" data-action="profile">${iconUser} Perfil</a>
      <a href="index.html" class="drawer-link" data-action="map">${iconMap} Ver mapa público</a>
      <a href="#" class="drawer-link drawer-link-danger" data-action="logout">${iconLogout} Sair</a>
    `;
  } else {
    nav.innerHTML = `
      <a href="#" class="drawer-link" data-action="login">Entrar</a>
      <a href="#" class="drawer-link" data-action="register">Criar conta</a>
      <a href="index.html" class="drawer-link" data-action="map">${iconMap} Ver mapa público</a>
    `;
  }
  nav.querySelectorAll("[data-action]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const a = el.getAttribute("data-action");
      window._closeDrawer?.();
      if (a === "logout") doLogout();
      if (a === "map") {
        window.location.href = "index.html";
        return;
      }
      if (a === "login") {
        showAuth();
        switchTab("login");
      }
      if (a === "register") {
        showAuth();
        switchTab("register");
      }
      if (a === "stock" || a === "profile") {
        if (a === "profile") {
          try {
            sessionStorage.setItem("temgelo_seller_view", "profile");
          } catch (_) {}
          history.replaceState(null, "", "seller.html?view=profile#perfil");
        } else {
          try {
            sessionStorage.setItem("temgelo_seller_view", "stock");
          } catch (_) {}
          history.replaceState(null, "", "seller.html?view=stock#stock");
        }
        showDash();
        applySellerHash();
        if (me) fillDash();
      }
    });
  });
}

// ---------- Auth tabs ----------
function setupUsernameInput() {
  const el = document.getElementById("reg-username");
  if (!el || el.dataset.boundUsername === "1") return;
  el.dataset.boundUsername = "1";
  el.addEventListener("input", () => {
    const start = el.selectionStart;
    // Disallow spaces while typing; keep only allowed chars
    const cleaned = el.value.replace(/\s+/g, "").replace(/[^a-zA-Z0-9_]/g, "");
    if (cleaned !== el.value) {
      el.value = cleaned;
      try {
        el.setSelectionRange(start - 1, start - 1);
      } catch (_) {}
    }
  });
}

function setupAuthTabs() {
  setupUsernameInput();

  document.getElementById("tab-login")?.addEventListener("click", () => switchTab("login"));
  document.getElementById("tab-register")?.addEventListener("click", () => switchTab("register"));
}

function switchTab(tab) {
  document.getElementById("tab-login")?.classList.toggle("active", tab === "login");
  document.getElementById("tab-register")?.classList.toggle("active", tab === "register");
  document.getElementById("form-login")?.classList.toggle("hidden", tab !== "login");
  document.getElementById("form-register")?.classList.toggle("hidden", tab !== "register");
  const auth = document.getElementById("screen-auth");
  if (auth) {
    auth.classList.toggle("auth-mode-login", tab === "login");
    auth.classList.toggle("auth-mode-register", tab === "register");
  }
  if (tab === "register") setTimeout(initRegMap, 50);
}

function showAuth() {
  document.documentElement.classList.remove("seller-has-session");
  document.getElementById("screen-auth")?.classList.remove("hidden");
  document.getElementById("screen-dash")?.classList.add("hidden");
  document.getElementById("topbar-title").textContent = "Vendedor";
  renderDrawerNav();
  applyBrandImage();
}

async function applyBrandImage() {
  try {
    const res = await fetch(API_BASE + "/catalog?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const url = data.images && (data.images.logoBrand || data.images.logoHeader);
    if (!url) return;
    document.querySelectorAll(".auth-brand-logo, .seller-topbar .logo img, .drawer-header img").forEach((img) => {
      img.src = url;
    });
  } catch (_) {}
}

function showDash() {
  document.documentElement.classList.add("seller-has-session");
  document.getElementById("screen-auth")?.classList.add("hidden");
  document.getElementById("screen-dash")?.classList.remove("hidden");
  renderDrawerNav();
  fillDash();
  applySellerHash();
  setTimeout(initDashMap, 50);
}

// ---------- API helpers ----------
async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = "Bearer " + token;
  const res = await fetch(API_BASE + path, { ...options, headers });
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    const msg = (data && data.error) || text || "HTTP " + res.status;
    throw new Error(msg);
  }
  return data;
}

// ---------- Login / register / logout ----------
async function doLogin() {
  const login = document.getElementById("login-user").value.trim();
  const password = document.getElementById("login-password").value;
  if (!login || !password) {
    alert("Preencha utilizador/email e palavra-passe.");
    return;
  }
  const btn = document.getElementById("btn-login");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "A entrar…";
  }
  try {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: login, password })
    });
    token = data.token;
    const stay = document.getElementById("login-stay")?.checked !== false;
    writeToken(token, stay);
    me = data.seller;
    saveSellerProfile(me, stay);
    try {
      sessionStorage.removeItem("temgelo_seller_view");
    } catch (_) {}
    // After login always land on the public map (hamburger → Meu stock / Perfil)
    window.location.replace("./index.html");
  } catch (err) {
    alert(err.message || "Erro ao entrar");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Entrar";
    }
  }
}

async function doRegister() {
  const payload = {
    name: document.getElementById("reg-name").value.trim(),
    username: document.getElementById("reg-username").value.trim(),
    email: document.getElementById("reg-email").value.trim(),
    whatsapp: document.getElementById("reg-whatsapp").value.trim(),
    phone: document.getElementById("reg-phone")?.value.trim() || "",
    payments: {
      numerario: !!document.getElementById("reg-pay-numerario")?.checked,
      multicaixa: !!document.getElementById("reg-pay-multicaixa")?.checked,
      unitel: !!document.getElementById("reg-pay-unitel")?.checked,
      other: document.getElementById("reg-pay-other")?.value.trim() || ""
    },
    password: document.getElementById("reg-password").value,
    neighborhood: document.getElementById("reg-neighborhood").value.trim(),
    lat: parseFloat(document.getElementById("reg-lat").value),
    lng: parseFloat(document.getElementById("reg-lng").value),
    price: document.getElementById("reg-price").value.trim(),
    unit: document.getElementById("reg-unit")?.value === "kg" ? "kg" : "baldes",
    buckets: parseFloat(document.getElementById("reg-buckets").value) || 0,
    packages: collectPackages("reg-packages"),
    freeze: document.getElementById("reg-freeze").value,
    available: document.getElementById("reg-available").checked
  };
  if (!payload.name || !payload.username || !payload.password) {
    alert("Nome, nome de utilizador e palavra-passe são obrigatórios.");
    return;
  }
  const usernameNorm = payload.username.trim().toLowerCase().replace(/\s+/g, "");
  if (!/^[a-z0-9_]{3,24}$/.test(usernameNorm)) {
    alert(
      "Nome de utilizador inválido.\n\nUse apenas letras, números ou _ (sem espaços).\nExemplo: joao_viana\n3 a 24 caracteres."
    );
    document.getElementById("reg-username")?.focus();
    return;
  }
  if (/\s/.test(payload.username)) {
    alert("O nome de utilizador não pode ter espaços. Use _ em vez de espaço (ex: joao_viana).");
    document.getElementById("reg-username")?.focus();
    return;
  }
  payload.username = usernameNorm;
  if (isNaN(payload.lat) || isNaN(payload.lng)) {
    alert("Defina a localização no mapa ou com GPS.");
    return;
  }
  try {
    await api("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    // Enter the account immediately – ready to use (no approval wait)
    const loginData = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: payload.username,
        password: payload.password
      })
    });
    token = loginData.token;
    writeToken(token, true);
    me = loginData.seller;
    saveSellerProfile(me, true);
    // Profile + stock already saved at register — do not open seller dashboard / "Guardar perfil".
    // Land on the public map; hamburger has Meu stock / Perfil when needed.
    try {
      sessionStorage.removeItem("temgelo_seller_view");
    } catch (_) {}
    const onMap =
      me && me.available && Number(me.buckets) > 0
        ? "Com gelo disponível, já pode aparecer no mapa."
        : "No menu (☰) use Meu stock para publicar gelo.";
    alert("Conta criada com sucesso.\n\n" + onMap);
    window.location.replace("./index.html");
    return;
  } catch (err) {
    alert(err.message || "Erro ao registar");
  }
}

async function deleteMyAccount() {
  if (!token) {
    alert("Sessão expirada. Entre de novo.");
    showAuth();
    return;
  }
  const ok = confirm(
    "Eliminar a sua conta de forma permanente?\n\n" +
      "• Some do mapa público\n" +
      "• Perfil e stock são apagados\n" +
      "• Não pode ser desfeito\n\n" +
      "Na próxima caixa escreva ELIMINAR para confirmar."
  );
  if (!ok) return;
  const typed = prompt("Para confirmar, escreva ELIMINAR:");
  if (!typed || typed.trim().toUpperCase() !== "ELIMINAR") {
    alert("Conta não eliminada.");
    return;
  }
  const btn = document.getElementById("btn-delete-account");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "A eliminar…";
  }
  try {
    // Prefer POST /seller/delete; fall back to DELETE /seller/me
    try {
      await api("/seller/delete", { method: "POST", body: "{}" });
    } catch (e1) {
      await api("/seller/me", { method: "DELETE", body: "{}" });
    }
    token = null;
    me = null;
    clearToken();
    try {
      sessionStorage.removeItem("temgelo_seller_view");
      localStorage.removeItem("temgelo_seller_profile");
    } catch (_) {}
    alert("Conta eliminada. Já não aparece no mapa.");
    window.location.replace("./index.html");
  } catch (err) {
    alert(err.message || "Não foi possível eliminar a conta.");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Eliminar a minha conta";
    }
  }
}

async function doLogout() {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch (_) {}
  token = null;
  me = null;
  clearToken();
  showAuth();
  switchTab("login");
}

async function loadMe() {
  try {
    const data = await api("/seller/me");
    me = data.seller;
    saveSellerProfile(me, !!localStorage.getItem(TOKEN_KEY));
    showDash();
  } catch {
    token = null;
    clearToken();
    showAuth();
    initRegMap();
  }
}

function setInputValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.type === "checkbox") {
    el.checked = !!value;
  } else {
    el.value = value == null ? "" : String(value);
  }
}

function fillDash() {
  if (!me) return;

  // Stock
  setInputValue("dash-buckets", me.buckets ?? 0);
  const unitEl = document.getElementById("dash-unit");
  if (unitEl) unitEl.value = me.unit === "kg" ? "kg" : "baldes";
  setInputValue("dash-freeze", me.freeze || "muito_congelado");
  updateDashQtyLabel();
  renderPackageRows("dash-packages", me.packages || []);
  setInputValue("dash-price", me.price || "");
  setInputValue("dash-available", !!me.available);

  // Profile — always refill so switching views never shows empty fields
  setInputValue("dash-name", me.name || "");
  setInputValue("dash-email", me.email || "");
  setInputValue("dash-whatsapp", me.whatsapp || "");
  setInputValue("dash-phone", me.phone || "");
  const pay = me.payments || {};
  setInputValue("dash-pay-numerario", pay.numerario);
  setInputValue("dash-pay-multicaixa", pay.multicaixa);
  setInputValue("dash-pay-unitel", pay.unitel);
  setInputValue("dash-pay-other", pay.other || "");
  setInputValue("dash-neighborhood", me.neighborhood || "");
  setInputValue("dash-notes", me.notes || "");
  setInputValue("dash-lat", me.lat ?? "");
  setInputValue("dash-lng", me.lng ?? "");

  const banner = document.getElementById("status-banner");
  if (banner) {
    banner.className = "status-banner";
    if (me.status === "banned") {
      banner.classList.add("banned");
      banner.textContent = "Conta bloqueada. Contacte o administrador.";
    } else {
      const qty = Number(me.buckets) || 0;
      const pkgs = Array.isArray(me.packages) ? me.packages.length : 0;
      const onMap = !!me.available && (qty > 0 || pkgs > 0);
      banner.classList.add("approved");
      banner.textContent = onMap
        ? "Conta activa – visível no mapa agora (gelo disponível)."
        : "Conta activa – marque «Tenho gelo disponível» e quantidade > 0 para aparecer no mapa.";
    }
  }

  updateStockHints();
}

function updateStockHints() {
  const hint = document.getElementById("stock-map-hint");
  if (!hint || !me) return;
  const qty = Number(document.getElementById("dash-buckets")?.value) || 0;
  const available = !!document.getElementById("dash-available")?.checked;
  const pkgs = collectPackages("dash-packages");
  const onMap = available && (qty > 0 || pkgs.length > 0);
  hint.textContent = onMap
    ? "Com estes valores fica visível no mapa (verde)."
    : "Ainda não aparece no mapa — active «Tenho gelo disponível» e ponha quantidade > 0 (ou tamanhos na tabela).";
  hint.className = "text-sm mt-1 " + (onMap ? "stock-hint-ok" : "text-muted");
}

async function markSoldOut() {
  if (!me) return;
  const ok = confirm("Marcar como esgotado?\n\nSome do mapa até voltar a activar stock.");
  if (!ok) return;
  document.getElementById("dash-available").checked = false;
  document.getElementById("dash-buckets").value = "0";
  await saveMe("stock");
}



function renderPackageRows(containerId, packages) {
  const box = document.getElementById(containerId);
  if (!box) return;
  const list = Array.isArray(packages) && packages.length ? packages : [];
  box.innerHTML = "";
  if (!list.length) {
    // one empty row to start
    list.push({ amount: "", unit: "kg", price: "" });
  }
  list.forEach((pkg, idx) => {
    const row = document.createElement("div");
    row.className = "package-row";
    row.innerHTML =
      '<div class="form-group" style="margin:0">' +
      '<label>Qtd</label>' +
      '<input type="number" min="0" step="any" class="pkg-amount" value="' +
      (pkg.amount ?? "") +
      '" placeholder="2" />' +
      "</div>" +
      '<div class="form-group" style="margin:0">' +
      "<label>Unidade</label>" +
      '<select class="pkg-unit">' +
      '<option value="kg"' +
      (pkg.unit === "baldes" ? "" : " selected") +
      ">kg</option>" +
      '<option value="baldes"' +
      (pkg.unit === "baldes" ? " selected" : "") +
      ">baldes</option>" +
      "</select></div>" +
      '<div class="form-group" style="margin:0">' +
      "<label>Preço (Kz)</label>" +
      '<input type="text" class="pkg-price" value="' +
      (pkg.price ?? "") +
      '" placeholder="150" />' +
      "</div>" +
      '<button type="button" class="pkg-remove" aria-label="Remover">×</button>';
    row.querySelector(".pkg-remove").addEventListener("click", () => {
      row.remove();
      if (!box.querySelector(".package-row")) {
        renderPackageRows(containerId, []);
      }
    });
    box.appendChild(row);
  });
}

function collectPackages(containerId) {
  const box = document.getElementById(containerId);
  if (!box) return [];
  const out = [];
  box.querySelectorAll(".package-row").forEach((row) => {
    const amount = parseFloat(row.querySelector(".pkg-amount")?.value);
    const unit = row.querySelector(".pkg-unit")?.value === "baldes" ? "baldes" : "kg";
    const price = String(row.querySelector(".pkg-price")?.value || "").trim();
    if (amount > 0 && price) out.push({ amount, unit, price });
  });
  return typeof normalizePackages === "function" ? normalizePackages(out) : out;
}

function addPackageRow(containerId) {
  const box = document.getElementById(containerId);
  if (!box) return;
  const existing = collectPackages(containerId);
  existing.push({ amount: "", unit: "kg", price: "" });
  // re-render loses empty trailing - append one empty row manually
  const row = document.createElement("div");
  row.className = "package-row";
  row.innerHTML =
    '<div class="form-group" style="margin:0"><label>Qtd</label><input type="number" min="0" step="any" class="pkg-amount" placeholder="2" /></div>' +
    '<div class="form-group" style="margin:0"><label>Unidade</label><select class="pkg-unit"><option value="kg" selected>kg</option><option value="baldes">baldes</option></select></div>' +
    '<div class="form-group" style="margin:0"><label>Preço (Kz)</label><input type="text" class="pkg-price" placeholder="150" /></div>' +
    '<button type="button" class="pkg-remove" aria-label="Remover">×</button>';
  row.querySelector(".pkg-remove").addEventListener("click", () => {
    row.remove();
    if (!box.querySelector(".package-row")) renderPackageRows(containerId, []);
  });
  box.appendChild(row);
}

function updateDashQtyLabel() {
  const unit = document.getElementById("dash-unit")?.value === "kg" ? "kg" : "baldes";
  const label = document.getElementById("dash-qty-label");
  if (label) label.textContent = unit === "kg" ? "Quantidade (kg)" : "Quantidade (baldes)";
}
function updateRegQtyLabel() {
  const unit = document.getElementById("reg-unit")?.value === "kg" ? "kg" : "baldes";
  const label = document.getElementById("reg-qty-label");
  if (label) label.textContent = unit === "kg" ? "Quantidade (kg)" : "Quantidade (baldes)";
}

async function saveMe(mode) {
  if (!me) return;
  const body = {};
  if (mode === "stock") {
    body.buckets = parseFloat(document.getElementById("dash-buckets").value) || 0;
    body.unit = document.getElementById("dash-unit")?.value === "kg" ? "kg" : "baldes";
    body.freeze = document.getElementById("dash-freeze").value;
    body.price = document.getElementById("dash-price").value.trim();
    body.packages = collectPackages("dash-packages");
    body.available = document.getElementById("dash-available").checked;
  } else {
    body.name = document.getElementById("dash-name").value.trim();
    body.email = document.getElementById("dash-email").value.trim();
    body.whatsapp = document.getElementById("dash-whatsapp").value.trim();
    body.phone = document.getElementById("dash-phone")?.value.trim() || "";
    body.payments = {
      numerario: !!document.getElementById("dash-pay-numerario")?.checked,
      multicaixa: !!document.getElementById("dash-pay-multicaixa")?.checked,
      unitel: !!document.getElementById("dash-pay-unitel")?.checked,
      other: document.getElementById("dash-pay-other")?.value.trim() || ""
    };
    body.neighborhood = document.getElementById("dash-neighborhood").value.trim();
    body.notes = document.getElementById("dash-notes").value.trim();
    body.lat = parseFloat(document.getElementById("dash-lat").value);
    body.lng = parseFloat(document.getElementById("dash-lng").value);
    if (!body.name) {
      alert("O nome é obrigatório.");
      document.getElementById("dash-name")?.focus();
      return;
    }
    if (isNaN(body.lat) || isNaN(body.lng)) {
      alert("Defina a localização no mapa ou com GPS.");
      return;
    }
  }
  const saveBtn = document.getElementById(mode === "stock" ? "btn-save-stock" : "btn-save-profile");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "A guardar…";
  }
  try {
    const data = await api("/seller/me", {
      method: "PATCH",
      body: JSON.stringify(body)
    });
    me = data.seller;
    saveSellerProfile(me, !!localStorage.getItem(TOKEN_KEY));
    fillDash();
    if (mode === "stock") {
      const qty = Number(me.buckets) || 0;
      const pkgs = Array.isArray(me.packages) ? me.packages.length : 0;
      const onMap = !!me.available && (qty > 0 || pkgs > 0);
      alert(
        onMap
          ? "Stock guardado. Já pode aparecer no mapa (actualiza em até ~30 s)."
          : "Stock guardado. Ainda não aparece no mapa — active «Tenho gelo disponível» e quantidade > 0."
      );
    } else {
      alert("Perfil guardado com sucesso.");
    }
  } catch (err) {
    alert(err.message || "Erro ao guardar");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = mode === "stock" ? "Guardar stock" : "Guardar perfil";
    }
  }
}

// ---------- Maps ----------
function initRegMap() {
  const el = document.getElementById("reg-map");
  if (!el || regMap) {
    if (regMap) regMap.invalidateSize();
    return;
  }
  regMap = L.map(el, { zoomControl: true }).setView([-8.84, 13.23], 11);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OSM"
  }).addTo(regMap);
  regMap.on("click", (e) => {
    setRegPos(e.latlng.lat, e.latlng.lng);
  });
}

function setRegPos(lat, lng) {
  document.getElementById("reg-lat").value = lat.toFixed(5);
  document.getElementById("reg-lng").value = lng.toFixed(5);
  if (!regMarker) {
    regMarker = L.marker([lat, lng]).addTo(regMap);
  } else {
    regMarker.setLatLng([lat, lng]);
  }
  regMap.setView([lat, lng], Math.max(regMap.getZoom(), 14));
}

function initDashMap() {
  const el = document.getElementById("dash-map");
  if (!el) return;
  if (!dashMap) {
    const lat = me?.lat || -8.84;
    const lng = me?.lng || 13.23;
    dashMap = L.map(el, { zoomControl: true }).setView([lat, lng], 14);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OSM"
    }).addTo(dashMap);
    dashMap.on("click", (e) => {
      setDashPos(e.latlng.lat, e.latlng.lng);
    });
    if (me?.lat && me?.lng) {
      dashMarker = L.marker([me.lat, me.lng]).addTo(dashMap);
    }
  } else {
    dashMap.invalidateSize();
    if (me?.lat && me?.lng) setDashPos(me.lat, me.lng);
  }
}

function setDashPos(lat, lng) {
  document.getElementById("dash-lat").value = Number(lat).toFixed(5);
  document.getElementById("dash-lng").value = Number(lng).toFixed(5);
  if (!dashMarker) {
    dashMarker = L.marker([lat, lng]).addTo(dashMap);
  } else {
    dashMarker.setLatLng([lat, lng]);
  }
  dashMap.setView([lat, lng], Math.max(dashMap.getZoom(), 14));
}

function useGps(target) {
  if (!navigator.geolocation) {
    alert("GPS não disponível neste dispositivo.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      if (target === "reg") {
        initRegMap();
        setRegPos(latitude, longitude);
      } else {
        initDashMap();
        setDashPos(latitude, longitude);
      }
    },
    () => alert("Não foi possível obter a localização."),
    { enableHighAccuracy: true, timeout: 15000 }
  );
}
