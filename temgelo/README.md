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

1. **Anyone** can open the public map and see sellers with stock (green = available + qty > 0 in baldes or kg; no 24h auto-expiry). Map opens on **full Angola** (does not auto-zoom to sellers).
2. **Sellers** register or log in on `seller.html`. New accounts are **active immediately** (`status: approved`) and can appear on the map as soon as stock is set — **no admin approval step**.
3. **After login or register** the seller goes to the **public map**. Hamburger → Meu stock / Perfil.
4. **Admin** manages texts, images, catalog republish, reports, and can **create / edit / block / delete** real accounts (Vendedores → Guardar writes to KV and rebuilds the map immediately).
5. Catalog is rebuilt on register, admin create/update, stock/profile update, moderate, self-delete, and admin publish → KV + Cloudinary; map polls every 30s.
6. **Logged-in menu:** Meu stock and Perfil are exclusive views (hamburger also on desktop). Profile fields are always prefilled. Stock has «Marcar esgotado» and a live map-visibility hint.
7. **Map chrome:** safety auto-hides after 10s → partner ad strip (CTA always visible); map starts empty until live catalog loads (no demo pins flash).

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
