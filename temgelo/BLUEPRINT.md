# Tem Gelo? – Blueprint

App for people in Angola to find ice buckets near them.

**Live:** https://temgelo.pages.dev

## Stack
- HTML / CSS / JS (no framework)
- Leaflet + OpenStreetMap
- Cloudflare Pages (public site)
- Cloudflare Worker (publish endpoint)
- Cloudinary (catalog.json as raw file)
- localStorage (admin drafts only)
- Progressive Web App (installable)

## Folders
```
temgelo/
├── index.html          # Public map
├── admin.html          # Admin panel
├── manifest.json       # PWA
├── sw.js               # Service Worker
├── css/styles.css
├── js/
│   ├── sellers.js      # Defaults + helpers
│   ├── app.js          # Public map logic
│   └── admin.js        # Admin logic
├── icons/              # PWA icons
├── worker/
│   ├── index.js
│   └── wrangler.toml
└── BLUEPRINT.md
```

## Live data
`catalog.json` on Cloudinary:
```
https://res.cloudinary.com/efvlvhce/raw/upload/gelo/catalog.json
```

Shape:
```json
{
  "updatedAt": "2026-10-31T14:00:00Z",
  "sellers": [
    {
      "id": "s001",
      "name": "João – Viana",
      "lat": -8.905,
      "lng": 13.37,
      "available": true,
      "buckets": 8,
      "freeze": "muito_congelado",
      "price": "1500",
      "whatsapp": "2449xxxxxxxx",
      "neighborhood": "Viana",
      "notes": "",
      "updatedAt": "2026-10-31T14:00:00Z"
    }
  ],
  "texts": {
    "pageTitle": "Tem Gelo? – Angola",
    "safetyTitle": "Atenção de Segurança:",
    "safetyBody": "...",
    "legendOk": "Tem gelo",
    "legendNo": "Sem gelo / expirado",
    "adminWhatsApp": "2449xxxxxxxx"
  }
}
```

Site texts are edited in Admin → **Textos** and published with the catalog.

## 24-hour rule
A seller only shows **green** if:
- `available === true`
- `buckets > 0`
- `updatedAt` is less than 24 hours ago

Otherwise the marker is red.

## Safety
Prominent red banner on the public map + report button that opens WhatsApp to admin.
Number and copy are editable in Admin → Textos.

## Admin password (important)
There are **two places** that must use the **same** personal password:

1. **Admin panel login** → `js/admin.js`
   ```js
   const ADMIN_PASSWORD = "your-personal-password";
   ```

2. **Worker secret** (checked only when clicking **Publicar**)
   ```bash
   npx wrangler secret put ADMIN_PASSWORD
   ```

Keep them identical. Never commit the real password to a public repo.

## Worker
- Name: `tem-gelo-publish`
- URL: `https://tem-gelo-publish.xeieloja.workers.dev`
- Publish endpoint: `https://tem-gelo-publish.xeieloja.workers.dev/publish`

In `js/admin.js` set:
```js
const PUBLISH_URL = "https://tem-gelo-publish.xeieloja.workers.dev/publish";
```

## Deploy checklist
1. Set the same personal password in `js/admin.js` and as Worker secret `ADMIN_PASSWORD`
2. Set the other 3 Cloudinary secrets on the Worker
3. Put the Worker URL into `PUBLISH_URL` in `admin.js`
4. Deploy / upload the static files to Cloudflare Pages
5. Test: add seller → Publicar → hard-refresh the public map

## Current status
- Public map live at https://temgelo.pages.dev
- Admin panel live
- PWA installable
- Worker deployed at https://tem-gelo-publish.xeieloja.workers.dev
- Report button still uses a placeholder WhatsApp number – change it in `js/app.js`
