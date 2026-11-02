# Tem Gelo? – Blueprint

App for people in Angola to find ice buckets near them.

**Live:** https://temgelo.pages.dev

## Stack
- HTML / CSS / JS (no framework)
- Leaflet + OpenStreetMap
- Cloudflare Pages (public site)
- Cloudflare Worker (API + publish)
- Cloudflare KV (seller accounts + sessions)
- Cloudinary (public `catalog.json` for the map)
- Progressive Web App (installable)

## Folders
```
temgelo/
├── index.html          # Public map + hamburger
├── seller.html         # Seller register / login / stock
├── admin.html          # Admin + moderation
├── manifest.json
├── sw.js
├── css/styles.css
├── js/
│   ├── sellers.js      # Defaults + helpers
│   ├── app.js          # Public map logic
│   ├── admin.js        # Admin + moderation
│   └── seller.js       # Seller portal
├── icons/
├── images/
├── worker/
│   ├── index.js
│   └── wrangler.toml
└── BLUEPRINT.md
```

## Seller accounts (Option B)

1. Seller opens **seller.html** (or “Sou vendedor” in the hamburger menu).
2. **Criar conta**: WhatsApp (2449…) + password + name + map pin.
3. Account is stored in **Cloudflare KV** with `status: "pending"`.
4. Admin opens **Admin → Moderação**, reviews, **Aprovar** / **Bloquear** / **Apagar**.
5. On approve, Worker rebuilds public `catalog.json` (approved sellers only) → Cloudinary.
6. Seller logs in, updates stock/profile; if approved, catalog is republished automatically.

### Auth
- Identity: **username** (required) and optional **email** — not WhatsApp
- Login: username **or** email + password
- WhatsApp is only a **contact field** on the public map (optional)
- Password: PBKDF2-SHA256 (100k iterations) in the Worker
- Session: Bearer session id in KV (30 days), stored in localStorage/sessionStorage

### Seller fields
| Field | Notes |
|--------|--------|
| id, username, email, passwordHash/Salt | System |
| name, lat, lng, neighborhood, notes | Profile |
| price, freeze, buckets, available | Stock |
| status | `pending` \| `approved` \| `banned` |
| createdAt, updatedAt | Timestamps |

### 24-hour rule (unchanged)
Green on map only if `available && buckets > 0 && updatedAt < 24h`.

## Worker API

Base: `https://tem-gelo-publish.xeieloja.workers.dev`

| Method | Path | Auth |
|--------|------|------|
| POST | `/publish` | admin password (legacy catalog push) |
| POST | `/auth/register` | public |
| POST | `/auth/login` | public → token |
| POST | `/auth/logout` | Bearer |
| GET | `/seller/me` | Bearer |
| PATCH | `/seller/me` | Bearer |
| GET | `/admin/sellers?password=` | admin |
| POST | `/admin/moderate` | admin (`approve` \| `ban` \| `delete`) |
| POST | `/admin/republish` | admin |

### Deploy Worker + KV
```bash
# Create KV namespace once
npx wrangler kv namespace create SELLERS
npx wrangler kv namespace create SELLERS --preview

# Put the ids into worker/wrangler.toml (binding SELLERS)

npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put CLOUDINARY_CLOUD_NAME
npx wrangler secret put CLOUDINARY_API_KEY
npx wrangler secret put CLOUDINARY_API_SECRET

npx wrangler deploy
```

## Admin password
Must match in:
1. `js/admin.js` → `ADMIN_PASSWORD`
2. Worker secret `ADMIN_PASSWORD`

Never commit the real password to a public repo.

## Hamburger menu
- **Public map**: Sou vendedor, Entrar/Criar conta, Segurança
- **Seller portal**: Stock, Perfil, Mapa, Sair (when logged in)

## Safety
Prominent red banner + report via WhatsApp. Number editable in Admin → Textos.

## Deploy checklist
1. Create KV namespace and set id in `wrangler.toml`
2. Same personal password in `admin.js` and Worker secret
3. Cloudinary secrets on Worker
4. Deploy Worker
5. Upload static files to Cloudflare Pages (include `seller.html`)
6. Test: register on seller.html → approve in Admin → stock update → map

## Current status
- Public map + hamburger
- Seller self-registration + login + stock/profile
- Admin moderation queue
- Worker auth + KV + auto-republish of approved sellers
- PWA installable
