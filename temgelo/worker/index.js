/**
 * Cloudflare Worker – Tem Gelo?
 *
 * Routes:
 *   POST /publish          – admin: publish full catalog (legacy + after approve)
 *   POST /auth/register    – seller self-register (status: pending)
 *   POST /auth/login       – seller login → session token
 *   POST /auth/logout      – invalidate session
 *   GET  /seller/me        – current seller profile (Bearer token)
 *   PATCH /seller/me       – update own profile / stock
 *   GET  /admin/sellers    – list all accounts (admin password)
 *   POST /admin/moderate   – approve | ban | delete seller
 *   POST /admin/republish  – rebuild public catalog from approved sellers
 *
 * Secrets:
 *   ADMIN_PASSWORD, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 *
 * KV binding: SELLERS
 *   seller:{id}           → full account JSON
 *   wa:{normalizedPhone}  → seller id
 *   session:{token}       → { sellerId, exp }
 *   meta:texts            → site texts JSON (optional)
 *   meta:index            → JSON array of seller ids
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

function respond(body, status = 200) {
  const isString = typeof body === "string";
  return new Response(isString ? body : JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      "Content-Type": isString ? "text/plain; charset=utf-8" : "application/json"
    }
  });
}

function jsonError(msg, status) {
  return respond({ error: msg }, status);
}

/** Normalize Angolan WhatsApp: digits only, ensure starts with 244 */
function normalizeWhatsApp(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("0") && d.length === 10) d = "244" + d.slice(1);
  if (d.length === 9) d = "244" + d;
  return d;
}

function isValidWhatsApp(d) {
  return /^2449\d{8}$/.test(d);
}

function randomId(prefix = "s") {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return (
    prefix +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password, saltB64) {
  const enc = new TextEncoder();
  let salt;
  if (saltB64) {
    salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  } else {
    salt = new Uint8Array(16);
    crypto.getRandomValues(salt);
  }
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hash = btoa(String.fromCharCode(...new Uint8Array(bits)));
  const saltOut = btoa(String.fromCharCode(...salt));
  return { hash, salt: saltOut };
}

async function verifyPassword(password, storedHash, saltB64) {
  const { hash } = await hashPassword(password, saltB64);
  return hash === storedHash;
}

async function signCloudinary(paramsToSign, apiSecret) {
  const encoder = new TextEncoder();
  const data = encoder.encode(paramsToSign + apiSecret);
  const digest = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function uploadCatalog(env, catalog) {
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = "gelo/catalog";
  const paramsToSign = `overwrite=true&public_id=${publicId}&timestamp=${timestamp}`;
  const signature = await signCloudinary(paramsToSign, env.CLOUDINARY_API_SECRET);

  const form = new FormData();
  form.append(
    "file",
    new Blob([JSON.stringify(catalog)], { type: "application/json" }),
    "catalog.json"
  );
  form.append("api_key", env.CLOUDINARY_API_KEY);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("public_id", publicId);
  form.append("overwrite", "true");
  form.append("resource_type", "raw");

  const cloudRes = await fetch(
    `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/raw/upload`,
    { method: "POST", body: form }
  );
  if (!cloudRes.ok) {
    const errText = await cloudRes.text();
    throw new Error("Cloudinary: " + errText.slice(0, 300));
  }
  return true;
}

function publicSeller(s) {
  return {
    id: s.id,
    name: s.name,
    lat: s.lat,
    lng: s.lng,
    available: !!s.available,
    buckets: Number(s.buckets) || 0,
    freeze: s.freeze || "muito_congelado",
    price: s.price || "",
    whatsapp: s.whatsapp,
    neighborhood: s.neighborhood || "",
    notes: s.notes || "",
    updatedAt: s.updatedAt
  };
}

async function getIndex(env) {
  const raw = await env.SELLERS.get("meta:index");
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function setIndex(env, ids) {
  await env.SELLERS.put("meta:index", JSON.stringify(ids));
}

async function loadSeller(env, id) {
  const raw = await env.SELLERS.get("seller:" + id);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function saveSeller(env, seller) {
  await env.SELLERS.put("seller:" + seller.id, JSON.stringify(seller));
}

async function rebuildPublicCatalog(env) {
  const ids = await getIndex(env);
  const sellers = [];
  for (const id of ids) {
    const s = await loadSeller(env, id);
    if (s && s.status === "approved") {
      sellers.push(publicSeller(s));
    }
  }
  let texts = {};
  const textsRaw = await env.SELLERS.get("meta:texts");
  if (textsRaw) {
    try {
      texts = JSON.parse(textsRaw);
    } catch (_) {}
  }
  const catalog = {
    updatedAt: new Date().toISOString(),
    sellers,
    texts
  };
  await uploadCatalog(env, catalog);
  return catalog;
}

async function getSession(env, request) {
  const auth = request.headers.get("Authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const token = m[1].trim();
  const raw = await env.SELLERS.get("session:" + token);
  if (!raw) return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data.exp || data.exp < Date.now()) {
    await env.SELLERS.delete("session:" + token);
    return null;
  }
  const seller = await loadSeller(env, data.sellerId);
  if (!seller || seller.status === "banned") return null;
  return { token, seller };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    try {
      if (request.method === "POST" && path.endsWith("/publish")) {
        const body = await request.json();
        if (body.password !== env.ADMIN_PASSWORD) return respond("Unauthorized", 401);
        const catalog = body.catalog;
        if (!catalog || !Array.isArray(catalog.sellers)) {
          return respond("Invalid catalog", 400);
        }
        if (catalog.texts && typeof catalog.texts === "object") {
          await env.SELLERS.put("meta:texts", JSON.stringify(catalog.texts));
        }
        await uploadCatalog(env, catalog);
        return respond({ ok: true });
      }

      if (request.method === "POST" && path.endsWith("/auth/register")) {
        const body = await request.json();
        const whatsapp = normalizeWhatsApp(body.whatsapp);
        const password = String(body.password || "");
        const name = String(body.name || "").trim();
        const lat = parseFloat(body.lat);
        const lng = parseFloat(body.lng);

        if (!isValidWhatsApp(whatsapp)) {
          return jsonError("WhatsApp inválido. Use o número com 2449…", 400);
        }
        if (password.length < 6) {
          return jsonError("Palavra-passe deve ter pelo menos 6 caracteres.", 400);
        }
        if (!name || isNaN(lat) || isNaN(lng)) {
          return jsonError("Nome, latitude e longitude são obrigatórios.", 400);
        }

        const existingId = await env.SELLERS.get("wa:" + whatsapp);
        if (existingId) {
          return jsonError("Já existe uma conta com este WhatsApp.", 409);
        }

        const { hash, salt } = await hashPassword(password);
        const id = randomId("s");
        const now = new Date().toISOString();
        const seller = {
          id,
          whatsapp,
          passwordHash: hash,
          passwordSalt: salt,
          name,
          lat,
          lng,
          neighborhood: String(body.neighborhood || "").trim(),
          price: String(body.price || "").trim(),
          freeze: body.freeze || "muito_congelado",
          buckets: Math.max(0, parseInt(body.buckets, 10) || 0),
          available: !!body.available,
          notes: String(body.notes || "").trim(),
          status: "pending",
          createdAt: now,
          updatedAt: now
        };

        await saveSeller(env, seller);
        await env.SELLERS.put("wa:" + whatsapp, id);
        const ids = await getIndex(env);
        if (!ids.includes(id)) {
          ids.push(id);
          await setIndex(env, ids);
        }

        return respond({
          ok: true,
          id,
          status: "pending",
          message:
            "Conta criada. Aguarde a aprovação do administrador para aparecer no mapa."
        });
      }

      if (request.method === "POST" && path.endsWith("/auth/login")) {
        const body = await request.json();
        const whatsapp = normalizeWhatsApp(body.whatsapp);
        const password = String(body.password || "");

        const sellerId = await env.SELLERS.get("wa:" + whatsapp);
        if (!sellerId) return jsonError("Conta não encontrada.", 401);
        const seller = await loadSeller(env, sellerId);
        if (!seller) return jsonError("Conta não encontrada.", 401);
        if (seller.status === "banned") {
          return jsonError("Esta conta foi bloqueada.", 403);
        }

        const ok = await verifyPassword(
          password,
          seller.passwordHash,
          seller.passwordSalt
        );
        if (!ok) return jsonError("Palavra-passe incorrecta.", 401);

        const token = randomToken();
        const exp = Date.now() + 30 * 24 * 60 * 60 * 1000;
        await env.SELLERS.put(
          "session:" + token,
          JSON.stringify({ sellerId: seller.id, exp }),
          { expirationTtl: 30 * 24 * 60 * 60 }
        );

        const { passwordHash, passwordSalt, ...safe } = seller;
        return respond({ ok: true, token, seller: safe });
      }

      if (request.method === "POST" && path.endsWith("/auth/logout")) {
        const session = await getSession(env, request);
        if (session) await env.SELLERS.delete("session:" + session.token);
        return respond({ ok: true });
      }

      if (request.method === "GET" && path.endsWith("/seller/me")) {
        const session = await getSession(env, request);
        if (!session) return jsonError("Não autenticado.", 401);
        const { passwordHash, passwordSalt, ...safe } = session.seller;
        return respond({ seller: safe });
      }

      if (request.method === "PATCH" && path.endsWith("/seller/me")) {
        const session = await getSession(env, request);
        if (!session) return jsonError("Não autenticado.", 401);
        if (session.seller.status === "banned") {
          return jsonError("Conta bloqueada.", 403);
        }

        const body = await request.json();
        const s = session.seller;

        if (body.name != null) s.name = String(body.name).trim() || s.name;
        if (body.lat != null && !isNaN(parseFloat(body.lat))) s.lat = parseFloat(body.lat);
        if (body.lng != null && !isNaN(parseFloat(body.lng))) s.lng = parseFloat(body.lng);
        if (body.neighborhood != null) s.neighborhood = String(body.neighborhood).trim();
        if (body.price != null) s.price = String(body.price).trim();
        if (body.freeze != null) s.freeze = body.freeze;
        if (body.buckets != null) s.buckets = Math.max(0, parseInt(body.buckets, 10) || 0);
        if (body.available != null) s.available = !!body.available;
        if (body.notes != null) s.notes = String(body.notes).trim();

        if (body.newPassword && String(body.newPassword).length >= 6) {
          const { hash, salt } = await hashPassword(String(body.newPassword));
          s.passwordHash = hash;
          s.passwordSalt = salt;
        }

        s.updatedAt = new Date().toISOString();
        await saveSeller(env, s);

        if (s.status === "approved") {
          try {
            await rebuildPublicCatalog(env);
          } catch (e) {
            console.error("republish after update failed", e);
          }
        }

        const { passwordHash, passwordSalt, ...safe } = s;
        return respond({ ok: true, seller: safe });
      }

      if (request.method === "GET" && path.endsWith("/admin/sellers")) {
        const pw = url.searchParams.get("password") || "";
        if (pw !== env.ADMIN_PASSWORD) return respond("Unauthorized", 401);
        const ids = await getIndex(env);
        const list = [];
        for (const id of ids) {
          const s = await loadSeller(env, id);
          if (s) {
            const { passwordHash, passwordSalt, ...safe } = s;
            list.push(safe);
          }
        }
        return respond({ sellers: list });
      }

      if (request.method === "POST" && path.endsWith("/admin/moderate")) {
        const body = await request.json();
        if (body.password !== env.ADMIN_PASSWORD) return respond("Unauthorized", 401);
        const action = body.action;
        const sellerId = body.sellerId;
        if (!sellerId || !action) return jsonError("sellerId e action obrigatórios.", 400);

        const seller = await loadSeller(env, sellerId);
        if (!seller && action !== "delete") return jsonError("Vendedor não encontrado.", 404);

        if (action === "approve") {
          seller.status = "approved";
          seller.updatedAt = new Date().toISOString();
          await saveSeller(env, seller);
          await rebuildPublicCatalog(env);
          return respond({ ok: true, status: "approved" });
        }
        if (action === "ban") {
          seller.status = "banned";
          seller.available = false;
          seller.updatedAt = new Date().toISOString();
          await saveSeller(env, seller);
          await rebuildPublicCatalog(env);
          return respond({ ok: true, status: "banned" });
        }
        if (action === "delete") {
          if (seller) {
            await env.SELLERS.delete("wa:" + seller.whatsapp);
            await env.SELLERS.delete("seller:" + sellerId);
          }
          const ids = (await getIndex(env)).filter((x) => x !== sellerId);
          await setIndex(env, ids);
          await rebuildPublicCatalog(env);
          return respond({ ok: true, status: "deleted" });
        }
        return jsonError("action inválida.", 400);
      }

      if (request.method === "POST" && path.endsWith("/admin/republish")) {
        const body = await request.json();
        if (body.password !== env.ADMIN_PASSWORD) return respond("Unauthorized", 401);
        if (body.texts && typeof body.texts === "object") {
          await env.SELLERS.put("meta:texts", JSON.stringify(body.texts));
        }
        const catalog = await rebuildPublicCatalog(env);
        return respond({ ok: true, count: catalog.sellers.length });
      }

      return respond("Not found", 404);
    } catch (err) {
      return respond("Error: " + (err && err.message ? err.message : String(err)), 500);
    }
  }
};
