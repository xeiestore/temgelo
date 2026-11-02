# Tem Gelo? – Blueprint

App for people in Angola to find ice buckets near them.

**Live:** https://temgelo.pages.dev

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
├── admin.html          # Admin + moderation
├── manifest.json       # PWA (start_url: /index.html)
├── sw.js               # Service worker (does not cache catalog/API)
├── css/styles.css
├── js/
│   ├── sellers.js      # Defaults + helpers
│   ├── app.js          # Public map (polls catalog every 30s)
│   ├── admin.js        # Admin + moderation
│   └── seller.js       # Seller portal
├── icons/
├── images/
├── worker/
│   ├── index.js
│   └── wrangler.toml
├── README.md
└── BLUEPRINT.md
```

## Public catalog (fast updates)

After **Publicar** / **Guardar textos** (or seller stock update / approve):

1. Site texts are stored in **KV** `meta:texts` (durable across Worker and Pages redeploys).
2. Worker rebuilds catalog from **approved accounts** + `meta:texts` → **KV** `meta:public_catalog`.
3. Worker also uploads to Cloudinary with **`invalidate=true`** (backup).
4. Map loads **`GET /catalog`** from the Worker (`Cache-Control: no-store`). On read, empty catalog texts are healed from `meta:texts`.
5. Fallback: Cloudinary URL if Worker fails.
6. Map **polls every 30s** and refreshes when the tab becomes visible.

Changes should appear within about 0–30 seconds (or immediately on refresh).

**Important:** Do not rely on hardcoded `DEFAULT_TEXTS` in `js/sellers.js` or the HTML for production copy — always **Guardar textos** / **Publicar** so KV is the source of truth. Redeploying static files alone does not wipe KV texts.

## Seller accounts

1. Guest opens hamburger → **Entrar** or **Criar conta** → `seller.html`.
2. **Register:** public name, **username** (required), **email** (optional), password, map pin; WhatsApp is optional contact for the map only.
3. Account stored in **KV** with `status: "pending"`.
4. Admin → **Moderação** → Aprovar / Bloquear / Apagar.
5. On approve, Worker rebuilds public catalog (approved sellers only) → KV + Cloudinary.
6. Seller updates stock/profile; if approved, catalog is republished automatically.

### Auth
- **Username** (required, 3–24: `a-z` `0-9` `_`) and optional **email**
- Login with **username or email** + password (not WhatsApp)
- WhatsApp = contact field on the public map only
- Password: PBKDF2-SHA256 (100k iterations) in the Worker
- Session: Bearer token in KV (30 days); **Manter sessão iniciada** defaults on (`localStorage`), off uses `sessionStorage`
- Show/hide password toggles on admin + seller forms

### Seller fields
| Field | Notes |
|--------|--------|
| id, username, email, passwordHash/Salt | System |
| name, lat, lng, neighborhood, notes, whatsapp | Profile (whatsapp = map contact) |
| price, freeze, buckets, available | Stock |
| status | `pending` \| `approved` \| `banned` |
| createdAt, updatedAt | Timestamps |

### 24-hour rule
Green on map only if `available && buckets > 0 && updatedAt < 24h`.

## Worker API

Base: `https://tem-gelo-publish.xeieloja.workers.dev`

| Method | Path | Auth |
|--------|------|------|
| **GET** | **`/catalog`** | public (live map data from KV) |
| POST | `/publish` | admin password (push full catalog) |
| POST | `/auth/register` | public |
| POST | `/auth/login` | public → session token |
| POST | `/auth/logout` | Bearer |
| GET | `/seller/me` | Bearer |
| PATCH | `/seller/me` | Bearer |
| GET | `/admin/sellers?password=` | admin |
| POST | `/admin/moderate` | admin (`approve` \| `ban` \| `delete`) |
| POST | `/admin/republish` | admin |

### KV binding `SELLERS`
- `seller:{id}` — account
- `user:{username}` / `email:{email}` — login indexes
- `session:{token}` — sessions
- `meta:index` — list of seller ids
- `meta:texts` — site texts
- `meta:public_catalog` — JSON served by `GET /catalog`

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
- **Public map (guest):** Entrar, Criar conta, Segurança
- **Public map (logged-in seller):** Área do vendedor (stock, perfil, painel, sair), Segurança
- **Seller portal:** Stock, Perfil, mapa público, Sair
- Menu opens from the **left**

## PWA
- `start_url`: `/index.html` (always the map with hamburger)
- Logo links to `/index.html`
- SW cache versioned; HTML network-first; catalog/API never cached

## Safety
Prominent red banner + report via WhatsApp. Number editable in Admin → Textos.

## Deploy checklist
1. KV namespace id in `wrangler.toml`
2. Same password in `admin.js` and Worker secret
3. Cloudinary secrets on Worker
4. `npx wrangler deploy`
5. Deploy static files to Cloudflare Pages (include `seller.html`)
6. Admin → **Publicar** once (seeds KV catalog)
7. Test: register → approve → update stock → map within ~30s

## Current status
- Public map + left hamburger (auth-aware)
- Seller accounts (username/email + password)
- Admin moderation
- Live catalog via Worker KV (`GET /catalog`) + 30s poll
- Cloudinary backup with CDN invalidate
- PWA installable
