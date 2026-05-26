# Logistik Portal - POC

Vrachtbeheersysteem voor Dutch Flower Group Ecuador & Colombia routes.

## Snelle Start

```bash
npm install
npm run dev
# http://localhost:3000
```

→ Zie `DEPLOYMENT.md` voor live deployment op Vercel

## Structuur

```
app/
  api/
    shipments/    - GET verzendingen van Logiztik API
    barcodes/     - GET barcode details
  components/
    Header        - Portal header
    ShipmentTable - Verzending tabel + filter
    BarcodeSearch - Barcode lookup
  dashboard/      - Main portal page
  page.tsx        - Landing page
  layout.tsx      - Root layout

lib/
  api-client.ts   - Logiztik API wrapper
```

## Features

✅ Dashboard met verzendingslijst  
✅ Barcode zoeken  
✅ Real-time status updates (5 min refresh)  
✅ Responsive design  
✅ API caching (5 min TTL)  

## API Routes

| Route | Method | Query Params |
|-------|--------|--------------|
| `/api/shipments` | GET | `status`, `limit` |
| `/api/barcodes` | GET | `code` (required) |

## Environment

```
LOGIZTIK_API_KEY=xxx
LOGIZTIK_CUSTOMER_CODE=xxx
```

## Deploy

Vercel: `DEPLOYMENT.md` → Stap 1-2
