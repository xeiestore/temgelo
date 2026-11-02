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
  document.getElementById("btn-save-profile")?.addEventListener("click", () => saveMe("profile"));
  document.getElementById("btn-reg-gps")?.addEventListener("click", () => useGps("reg"));
  document.getElementById("btn-dash-gps")?.addEventListener("click", () => useGps("dash"));

  document.getElementById("login-password")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doLogin();
  });

  window.addEventListener("hashchange", () => applySellerHash());

  if (token) {
    // Show dashboard shell immediately (CSS also hides auth via seller-has-session)
    document.documentElement.classList.add("seller-has-session");
    document.getElementById("screen-auth")?.classList.add("hidden");
    document.getElementById("screen-dash")?.classList.remove("hidden");
    applySellerHash();
    loadMe().then(() => {
      applySellerHash();
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
  const h = (location.hash || "").toLowerCase();
  const path = (location.pathname || "").toLowerCase();
  const root = document.documentElement;
  root.classList.remove("seller-view-stock", "seller-view-profile");

  let view = "all";
  if (h === "#stock" || h === "#meu-stock" || /stock\.html$/.test(path)) view = "stock";
  else if (h === "#perfil" || h === "#profile" || /profile\.html$/.test(path)) view = "profile";

  if (view === "stock") {
    root.classList.add("seller-view-stock");
    document.getElementById("section-stock")?.classList.remove("hidden");
    document.getElementById("section-profile")?.classList.add("hidden");
    if (document.getElementById("topbar-title") && me) {
      document.getElementById("topbar-title").textContent = "Meu stock";
    } else if (document.getElementById("topbar-title")) {
      document.getElementById("topbar-title").textContent = "Meu stock";
    }
    window.scrollTo(0, 0);
  } else if (view === "profile") {
    root.classList.add("seller-view-profile");
    document.getElementById("section-profile")?.classList.remove("hidden");
    document.getElementById("section-stock")?.classList.add("hidden");
    if (document.getElementById("topbar-title")) {
      document.getElementById("topbar-title").textContent = "Perfil";
    }
    window.scrollTo(0, 0);
  } else {
    document.getElementById("section-stock")?.classList.remove("hidden");
    document.getElementById("section-profile")?.classList.remove("hidden");
    if (document.getElementById("topbar-title")) {
      document.getElementById("topbar-title").textContent = me?.name || "A minha conta";
    }
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
      <a href="./" class="drawer-link">${iconMap} Ver mapa público</a>
      <a href="#" class="drawer-link drawer-link-danger" data-action="logout">${iconLogout} Sair</a>
    `;
  } else {
    nav.innerHTML = `
      <a href="#" class="drawer-link" data-action="login">Entrar</a>
      <a href="#" class="drawer-link" data-action="register">Criar conta</a>
      <a href="./" class="drawer-link">${iconMap} Ver mapa público</a>
    `;
  }
  nav.querySelectorAll("[data-action]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const a = el.getAttribute("data-action");
      window._closeDrawer?.();
      if (a === "logout") doLogout();
      if (a === "login") {
        showAuth();
        switchTab("login");
      }
      if (a === "register") {
        showAuth();
        switchTab("register");
      }
      if (a === "stock" || a === "profile") {
        showDash();
        if (a === "profile") {
          history.replaceState(null, "", "#perfil");
        } else {
          history.replaceState(null, "", "#stock");
        }
        applySellerHash();
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
    showDash();
  } catch (err) {
    alert(err.message || "Erro ao entrar");
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
    buckets: parseInt(document.getElementById("reg-buckets").value, 10) || 0,
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
    alert(
      "Conta criada. Já está na área do vendedor.\n\n" +
        "Actualize o stock para aparecer no mapa público."
    );
    showDash();
  } catch (err) {
    alert(err.message || "Erro ao registar");
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

function fillDash() {
  if (!me) return;
  document.getElementById("dash-buckets").value = me.buckets ?? 0;
  document.getElementById("dash-freeze").value = me.freeze || "muito_congelado";
  document.getElementById("dash-price").value = me.price || "";
  document.getElementById("dash-available").checked = !!me.available;
  document.getElementById("dash-name").value = me.name || "";
  document.getElementById("dash-email").value = me.email || "";
  document.getElementById("dash-whatsapp").value = me.whatsapp || "";
  const dashPhone = document.getElementById("dash-phone");
  if (dashPhone) dashPhone.value = me.phone || "";
  const pay = me.payments || {};
  const setChk = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!val;
  };
  setChk("dash-pay-numerario", pay.numerario);
  setChk("dash-pay-multicaixa", pay.multicaixa);
  setChk("dash-pay-unitel", pay.unitel);
  const other = document.getElementById("dash-pay-other");
  if (other) other.value = pay.other || "";
  document.getElementById("dash-neighborhood").value = me.neighborhood || "";
  document.getElementById("dash-notes").value = me.notes || "";
  document.getElementById("dash-lat").value = me.lat ?? "";
  document.getElementById("dash-lng").value = me.lng ?? "";

  const banner = document.getElementById("status-banner");
  if (!banner) return;
  banner.className = "status-banner";
  if (me.status === "banned") {
    banner.classList.add("banned");
    banner.textContent = "Conta bloqueada. Contacte o administrador.";
  } else {
    banner.classList.add("approved");
    banner.textContent =
      "Conta activa – visível no mapa quando tiver gelo disponível (actualizado nas últimas 24h).";
  }
}

async function saveMe(mode) {
  if (!me) return;
  const body = {};
  if (mode === "stock") {
    body.buckets = parseInt(document.getElementById("dash-buckets").value, 10) || 0;
    body.freeze = document.getElementById("dash-freeze").value;
    body.price = document.getElementById("dash-price").value.trim();
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
  }
  try {
    const data = await api("/seller/me", {
      method: "PATCH",
      body: JSON.stringify(body)
    });
    me = data.seller;
    saveSellerProfile(me, !!localStorage.getItem(TOKEN_KEY));
    fillDash();
    alert("Guardado com sucesso.");
  } catch (err) {
    alert(err.message || "Erro ao guardar");
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
