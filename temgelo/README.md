# Tem Gelo?

Find ice buckets near you in Angola.

**Live:** https://temgelo.pages.dev

## Documentation rule (standing order)

**After every important change, update both this README and [BLUEPRINT.md](./BLUEPRINT.md) in the same change.**

Important changes include: auth/registration flow, map visibility rules, admin moderation behaviour, catalog/API routes, PWA install behaviour, deploy steps, or any user-facing flow that docs describe. Do not leave docs describing pending-approval, old field names, or removed UI.

## Quick start

| App | URL |
|-----|-----|
| Public map | `/` or `/index.html` |
| Seller login / register | `/seller.html` |
| Admin | `/admin.html` |

Full architecture, API, auth, and deploy steps: **[BLUEPRINT.md](./BLUEPRINT.md)**.

## How it works (current)

1. **Anyone** can open the public map and see sellers with fresh stock (green = available + buckets > 0 + updated within 24h).
2. **Sellers** register or log in on `seller.html`. New accounts are **active immediately** (`status: approved`) and can appear on the map as soon as stock is set — **no admin approval step**.
3. **Admin** manages texts, images, catalog republish, reports, and can **block / reactivate / delete** accounts (block removes them from the map).
4. Catalog is rebuilt on register, stock/profile update, moderate, and admin publish → KV + Cloudinary; map polls every 30s.

## Deploy (short)

**Worker** (from `worker/`):

```bash
npx wrangler kv namespace list   # set id in wrangler.toml if needed
npx wrangler deploy
```

**Site:** deploy the `temgelo/` static files to Cloudflare Pages.

After deploy, open Admin → **Publicar** / **Republicar** once if the public catalog is empty.
Site texts: Admin → **Textos** → **Guardar textos** (or **Publicar**) — stored in KV `meta:texts` and survive redeploys.

## Stack

Cloudflare Pages + Worker + KV · Cloudinary (backup) · Leaflet · PWA

## PWA install

- **Android / desktop Chromium:** native “Install” when the browser fires `beforeinstallprompt`.
- **iPhone / iPad:** Apple does not allow a one-tap web install. **Instalar app** opens a guided sheet: Safari → Partilhar → Adicionar ao Ecrã Principal.
