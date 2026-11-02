# Tem Gelo?

Find ice buckets near you in Angola.

**Live:** https://temgelo.pages.dev

## Quick start

| App | URL |
|-----|-----|
| Public map | `/` or `/index.html` |
| Seller login / register | `/seller.html` |
| Admin | `/admin.html` |

Full architecture, API, auth, and deploy steps: **[BLUEPRINT.md](./BLUEPRINT.md)**.

## Deploy (short)

**Worker** (from `worker/`):

```bash
npx wrangler kv namespace list   # set id in wrangler.toml if needed
npx wrangler deploy
```

**Site:** deploy the `temgelo/` static files to Cloudflare Pages.

After deploy, open Admin → **Publicar** once so the live catalog is written to KV.
Site texts: Admin → **Textos** → **Guardar textos** (or **Publicar**) — stored in KV `meta:texts` and survive redeploys.

## Stack

Cloudflare Pages + Worker + KV · Cloudinary (backup) · Leaflet · PWA
