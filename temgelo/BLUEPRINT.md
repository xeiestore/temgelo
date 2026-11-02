# Tem Gelo? – Blueprint

App for people in Angola to find ice buckets near them.

**Live:** https://temgelo.pages.dev

## Documentation rule

Keep this file and `README.md` in sync with behaviour. **After every important change, update both docs in the same change** (auth, map visibility, admin, API, PWA, deploy). See README “Documentation rule (standing order)”.

## Stack
- HTML / CSS / JS (no framework)
- Leaflet + OpenStreetMap
- Cloudflare Pages (public site)
- Cloudflare Worker (API + live catalog)
- Cloudflare KV (seller accounts, sessions, public catalog)
- Cloudinary (catalog backup + invalidate on publish)
- Progressive Web App (installable)

## Folders
```
temgelo/
├── index.html          # Public map + auth-aware hamburger
├── seller.html         # Seller register / login / stock / profile
├── admin.html          # Admin + moderation (block / reactivate)
├── manifest.json       # PWA (start_url: /index.html)
├── sw.js               # Service worker (does not cache catalog/API)
├── css/styles.css
├── js/
│   ├── sellers.js      # Defaults + helpers
│   ├── app.js          # Public map (polls catalog every 30s)
│   ├── admin.js        # Admin + moderation
│   ├── seller.js       # Seller portal
│   └── install.js      # PWA install (native prompt or iOS sheet)
├── icons/
├── images/
├── worker/
│   ├── index.js
│   └── wrangler.toml
├── README.md
└── BLUEPRINT.md
```

## Public catalog (fast updates)

After **Publicar** / **Guardar textos** / **Republicar**, or after **register** / seller stock-profile update / moderate:

1. Site texts (and images) are stored in **KV** `meta:texts` / `meta:images` (durable across Worker and Pages redeploys).
2. Worker rebuilds catalog from **non-banned accounts** + those metas → **KV** `meta:public_catalog`.
3. Worker also uploads to Cloudinary with **`invalidate=true`** (backup).
4. Map loads **`GET /catalog`** from the Worker (`Cache-Control: no-store`). On read, empty catalog texts are healed from `meta:texts`.
5. Fallback: Cloudinary URL if Worker fails.
6. Map **polls every 30s** and refreshes when the tab becomes visible.

Changes should appear within about 0–30 seconds (or immediately on refresh).

**Important:** Do not rely on hardcoded `DEFAULT_TEXTS` in `js/sellers.js` or the HTML for production copy — always **Guardar textos** / **Publicar** so KV is the source of truth. Redeploying static files alone does not wipe KV texts.

## Seller accounts

1. Guest opens hamburger → **Entrar** or **Criar conta** → `seller.html`.
2. **Register:** public name, **username** (required), **email** (optional), password, map pin; WhatsApp / phone optional (map contact); payments optional.
3. Account stored in **KV** with **`status: "approved"`** (active immediately — **no pending gate**).
4. Worker rebuilds the public catalog on register so the seller can appear on the map right away.
5. Admin → **Vendedores** → **+ Adicionar / Guardar** creates or updates a **real** KV account (`POST` / `PATCH` `/admin/sellers`) and rebuilds the public catalog immediately (optional username/password; auto-generated if empty).
6. Admin → **Moderação**: **Bloquear** (removes from map), **Reactivar** (after ban), **Apagar**. UI labels accounts **Activo** / **Bloqueado** only.
7. Seller updates stock/profile; if not banned, catalog is republished automatically.

### Auth
- **Username** (required, 3–24: `a-z` `0-9` `_`) and optional **email**
- Login with **username or email** + password (not WhatsApp)
- WhatsApp / phone = contact fields on the public map only
- Password: PBKDF2-SHA256 (100k iterations) in the Worker
- Session: Bearer token in KV (30 days); **Manter sessão iniciada** defaults on (`localStorage`), off uses `sessionStorage`
- Show/hide password toggles on admin + seller forms

### Seller fields
| Field | Notes |
|--------|--------|
| id, username, email, passwordHash/Salt | System |
| name, lat, lng, neighborhood, notes, whatsapp, phone | Profile (whatsapp/phone = map contact) |
| payments | numerario, multicaixa, unitel, other |
| price, freeze, buckets, available | Stock |
| status | `approved` (active) \| `banned` — new signups are always `approved` |
| createdAt, updatedAt | Timestamps |

### 24-hour rule
Green on map only if `available && buckets > 0 && updatedAt < 24h`.

### Map visibility
Anyone **not banned** can appear in the public catalog. There is no approval step before map visibility.

## Worker API

Base: `https://tem-gelo-publish.xeieloja.workers.dev`

| Method | Path | Auth |
|--------|------|------|
| **GET** | **`/catalog`** | public (live map data from KV) |
| POST | `/publish` | admin password (push full catalog; prefers live accounts when any exist) |
| POST | `/auth/register` | public → creates **approved** account + rebuilds catalog |
| POST | `/auth/login` | public → session token |
| POST | `/auth/logout` | Bearer |
| GET | `/seller/me` | Bearer |
| PATCH | `/seller/me` | Bearer |
| GET | `/admin/sellers?password=` | admin |
| POST | `/admin/sellers` | admin create account (approved + catalog rebuild) |
| PATCH | `/admin/sellers` | admin update account / stock + catalog rebuild |
| POST | `/admin/moderate` | admin (`approve` = reactivate \| `ban` \| `delete`) |
| POST | `/admin/republish` | admin |
| POST | `/report` | public (in-app report, not WhatsApp) |
| GET | `/admin/reports?password=` | admin |

### KV binding `SELLERS`
- `seller:{id}` — account
- `user:{username}` / `email:{email}` — login indexes
- `session:{token}` — sessions
- `meta:index` — list of seller ids
- `meta:texts` — site texts
- `meta:images` — site image URLs
- `meta:public_catalog` — JSON served by `GET /catalog`
- `report:{id}` / `meta:report_index` — user reports

### Deploy Worker + KV
```bash
cd worker

# Once: create KV (or list existing)
npx wrangler kv namespace list
# Put production id into wrangler.toml binding SELLERS

npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put CLOUDINARY_CLOUD_NAME
npx wrangler secret put CLOUDINARY_API_KEY
npx wrangler secret put CLOUDINARY_API_SECRET

npx wrangler deploy
```

If deploy fails with invalid namespace id, run `npx wrangler kv namespace list` and fix `id` / `preview_id` in `wrangler.toml`.

## Admin password
Must match in:
1. `js/admin.js` → `ADMIN_PASSWORD`
2. Worker secret `ADMIN_PASSWORD`

Never commit the real password to a public repo.

## Hamburger menu
- **Public map (guest):** Entrar, Criar conta, Segurança, Instalar app, Reportar um problema
- **Public map (logged-in seller):** Meu stock (`stock.html` → `seller.html#stock`), Perfil (`profile.html` → `seller.html#perfil`), Sair, Segurança, Instalar app, Reportar
- **Seller portal:** exclusive views — stock page hides Perfil; profile page hides Stock
- Menu opens from the **left**
- **Login flash:** head script sets `html.seller-has-session` before paint when a token exists so Entrar never flashes

## PWA
- `start_url`: `/index.html` (always the map with hamburger)
- Logo links to `/index.html`
- SW cache versioned; HTML network-first; catalog/API never cached
- **Install:** `js/install.js`
  - Chromium: native prompt via `beforeinstallprompt` when available
  - **iOS:** no one-tap install API; **Instalar app** shows a guided sheet (Safari → Partilhar → Adicionar ao Ecrã Principal)

## Safety + bottom ads
- Red **safety banner** shows on map load, auto-hides after **10 seconds** (or on ×). Menu → Segurança shows it again temporarily.
- After hide, the same bottom strip becomes the **partner ad** slot (`#ad-banner`).
- **Editable in Admin → Textos** (saved to KV `meta:texts` with **Guardar textos** / **Publicar**):
  - `adTitle`, `adBody`, `adCta`, `adWaMessage`
  - CTA opens WhatsApp using `adminWhatsApp` + `adWaMessage`
- Leaflet **+/-** zoom controls sit **above** that bottom strip (raised via CSS).
- Report via WhatsApp and in-app `/report`. Admin WhatsApp number editable in Admin → Textos.

## Deploy checklist
1. KV namespace id in `wrangler.toml`
2. Same password in `admin.js` and Worker secret
3. Cloudinary secrets on Worker
4. `npx wrangler deploy`
5. Deploy static files to Cloudflare Pages (include `seller.html`, `install.js`)
6. Admin → **Publicar** / **Republicar** once if catalog empty
7. Test: register **or** Admin → Adicionar → map within ~30s; ban → disappears from map

## Current status
- Public map + left hamburger (auth-aware)
- Seller accounts: register → **active immediately** (no pending)
- Admin Vendedores: create/edit real accounts (live on map); Moderação: block / reactivate / delete
- Live catalog via Worker KV (`GET /catalog`) + 30s poll
- Cloudinary backup with CDN invalidate
- PWA installable (native on Chromium; guided sheet on iOS)
- In-app user reports
