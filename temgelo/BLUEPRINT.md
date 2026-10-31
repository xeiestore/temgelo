# Tem Gelo? – Blueprint

App for people in Luanda to find ice buckets near them.

## Stack (same spirit as your original blueprint)
- HTML / CSS / JS (no framework)
- Leaflet + OpenStreetMap
- Cloudflare Pages (public site)
- Cloudflare Worker (publish endpoint)
- Cloudinary (catalog.json as raw file)
- localStorage (admin drafts only)

## Folders
```
tem-gelo/
├── index.html          # Public map
├── admin.html          # Admin panel
├── css/styles.css
├── js/
│   ├── sellers.js      # Defaults + helpers
│   ├── app.js          # Public map logic
│   └── admin.js        # Admin logic
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
  ]
}
```

## 24-hour rule
A seller only shows **green** if:
- `available === true`
- `buckets > 0`
- `updatedAt` is less than 24 hours ago

Otherwise the marker is red.

## Safety
Prominent red banner on the public map + report button that opens WhatsApp to admin.

## Admin password
Change in `js/admin.js`:
```js
const ADMIN_PASSWORD = "gelo2026";
```

## Deploy checklist
1. Change admin password
2. Create Cloudinary folder `gelo` + unsigned preset if needed
3. Deploy Worker, set the 4 secrets
4. Put the Worker URL into `PUBLISH_URL` in `admin.js`
5. Deploy the static files to Cloudflare Pages
6. Test: add seller → Publicar → hard-refresh the public map

## Current status
- Public map works offline with seed data
- Admin works with localStorage drafts
- Publish currently downloads `catalog.json` for manual upload (until Worker is live)
- Report button uses a placeholder WhatsApp number – change it in `app.js`
