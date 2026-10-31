// Tem Gelo? – Seller portal (accounts + stock)

const API_BASE = "https://tem-gelo-publish.xeieloja.workers.dev";
const TOKEN_KEY = "temgelo_seller_token";

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
function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

let token = readToken();
let me = null;
let regMap = null;
let regMarker = null;
let dashMap = null;
let dashMarker = null;

// ---------- Boot ----------
document.addEventListener("DOMContentLoaded", () => {
  setupDrawer();
  setupAuthTabs();
  setupPasswordToggles();
  document.getElementById("btn-login")?.addEventListener("click", doLogin);
  document.getElementById("btn-register")?.addEventListener("click", doRegister);
  document.getElementById("btn-save-stock")?.addEventListener("click", () => saveMe("stock"));
  document.getElementById("btn-save-profile")?.addEventListener("click", () => saveMe("profile"));
  document.getElementById("btn-reg-gps")?.addEventListener("click", () => useGps("reg"));
  document.getElementById("btn-dash-gps")?.addEventListener("click", () => useGps("dash"));

  document.getElementById("login-password")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doLogin();
  });

  if (token) {
    loadMe();
  } else {
    showAuth();
    initRegMap();
  }
});

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
          document.querySelector("#dash-name")?.scrollIntoView({ behavior: "smooth" });
        }
      }
    });
  });
}

// ---------- Auth tabs ----------
function setupAuthTabs() {
  document.getElementById("tab-login")?.addEventListener("click", () => switchTab("login"));
  document.getElementById("tab-register")?.addEventListener("click", () => switchTab("register"));
}

function switchTab(tab) {
  document.getElementById("tab-login")?.classList.toggle("active", tab === "login");
  document.getElementById("tab-register")?.classList.toggle("active", tab === "register");
  document.getElementById("form-login")?.classList.toggle("hidden", tab !== "login");
  document.getElementById("form-register")?.classList.toggle("hidden", tab !== "register");
  if (tab === "register") setTimeout(initRegMap, 50);
}

function showAuth() {
  document.getElementById("screen-auth")?.classList.remove("hidden");
  document.getElementById("screen-dash")?.classList.add("hidden");
  document.getElementById("topbar-title").textContent = "Vendedor";
  renderDrawerNav();
}

function showDash() {
  document.getElementById("screen-auth")?.classList.add("hidden");
  document.getElementById("screen-dash")?.classList.remove("hidden");
  document.getElementById("topbar-title").textContent = me?.name || "A minha conta";
  renderDrawerNav();
  fillDash();
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
  const whatsapp = document.getElementById("login-whatsapp").value.trim();
  const password = document.getElementById("login-password").value;
  if (!whatsapp || !password) {
    alert("Preencha WhatsApp e palavra-passe.");
    return;
  }
  try {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ whatsapp, password })
    });
    token = data.token;
    const stay = document.getElementById("login-stay")?.checked !== false;
    writeToken(token, stay);
    me = data.seller;
    showDash();
  } catch (err) {
    alert(err.message || "Erro ao entrar");
  }
}

async function doRegister() {
  const payload = {
    name: document.getElementById("reg-name").value.trim(),
    whatsapp: document.getElementById("reg-whatsapp").value.trim(),
    password: document.getElementById("reg-password").value,
    neighborhood: document.getElementById("reg-neighborhood").value.trim(),
    lat: parseFloat(document.getElementById("reg-lat").value),
    lng: parseFloat(document.getElementById("reg-lng").value),
    price: document.getElementById("reg-price").value.trim(),
    buckets: parseInt(document.getElementById("reg-buckets").value, 10) || 0,
    freeze: document.getElementById("reg-freeze").value,
    available: document.getElementById("reg-available").checked
  };
  if (!payload.name || !payload.whatsapp || !payload.password) {
    alert("Nome, WhatsApp e palavra-passe são obrigatórios.");
    return;
  }
  if (isNaN(payload.lat) || isNaN(payload.lng)) {
    alert("Defina a localização no mapa ou com GPS.");
    return;
  }
  try {
    const data = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    alert(data.message || "Conta criada. Aguarde aprovação.");
    document.getElementById("login-whatsapp").value = payload.whatsapp;
    switchTab("login");
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
  document.getElementById("dash-neighborhood").value = me.neighborhood || "";
  document.getElementById("dash-notes").value = me.notes || "";
  document.getElementById("dash-lat").value = me.lat ?? "";
  document.getElementById("dash-lng").value = me.lng ?? "";

  const banner = document.getElementById("status-banner");
  if (!banner) return;
  banner.className = "status-banner";
  if (me.status === "pending") {
    banner.classList.add("pending");
    banner.textContent =
      "Conta pendente de aprovação. Ainda não aparece no mapa público.";
  } else if (me.status === "approved") {
    banner.classList.add("approved");
    banner.textContent = "Conta aprovada – visível no mapa (se tiver stock fresco).";
  } else if (me.status === "banned") {
    banner.classList.add("banned");
    banner.textContent = "Conta bloqueada. Contacte o administrador.";
  } else {
    banner.textContent = "";
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
