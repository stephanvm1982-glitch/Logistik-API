# Vercel Deployment Guide

Stap-voor-stap instructies om het project live te zetten op Vercel.

## Stap 1: Lokale test (optioneel maar aanbevolen)

```bash
cd /pad/naar/Logistik-API
cp .env.example .env
# Vul CUSTOMER_CODE en API_KEY in .env in
node server.js
```

Open http://localhost:3000 en check dat de UI werkt en data laadt.

## Stap 2: GitHub repository

Het project staat al op GitHub:  
https://github.com/stephanvm1982-glitch/Logistik-API

Zorg dat je:
- GitHub account hebt
- Deze repo mag forken of je bent owner

## Stap 3: Vercel setup

### 3a. Vercel project maken
1. Ga naar https://vercel.com/dashboard
2. Klik "Add New Project"
3. Selecteer "Import Git Repository"
4. Zoek naar `stephanvm1982-glitch/Logistik-API` (of jouw fork)
5. Klik "Import"

Vercel herkendt automatisch dat het geen build nodig heeft (serverless functions).

### 3b. Environment variables instellen

In Vercel Project Settings → Environment Variables:

| Variabele | Waarde | Notitie |
|---|---|---|
| `CUSTOMER_CODE` | `CLI0113847` | Jouw klantcode |
| `API_KEY` | `CGTKPVOHKXAOMGAERLKDKCPITOBMDPCR` | Jouw API key (GEHEIM!) |
| `API_KEY_HEADER` | `Api-Key` | Standaard, wijzig indien nodig |
| `ALLOW_INSECURE_TLS` | `false` | Alleen `true` als TLS-fout optreedt |

**⚠️ Wichtig**: Deze variabelen zijn GEHEIM. Vercel sluit ze automatisch voor logs/output.

### 3c. (Optioneel) Vercel KV database verbinden

Voor automatische data caching (sneller, minder API-calls):

1. Project Settings → "Storage"
2. Klik "Create Database" → "Create Vercel KV"
3. Kies region dicht bij je Logiztik API
4. Vercel vult `KV_REST_API_URL` en `KV_REST_API_TOKEN` automatisch in

Zonder KV: project werkt nog, maar data wordt niet gecached.  
Met KV: data wordt elke 5 min vernieuwd en snel geserveerd.

### 3d. Deploy!

Nadat env vars ingesteld zijn:
- Klik "Deploy"
- Vercel bouwt en deployt automatisch

Je project draait nu op: `https://your-project.vercel.app`

## Stap 4: Verify deployment

### Config testen
```bash
curl https://your-project.vercel.app/api/config
```

Verwacht output:
```json
{
  "customerCode": "CLI0113847",
  "environment": "Vercel",
  "apiKeyHeader": "Api-Key",
  "configured": true
}
```

### Shipments ophalen
```bash
curl "https://your-project.vercel.app/api/shipments?date=2026-05-28"
```

Verwacht: JSON array met zendingen (of `{ ok: false }` indien geen data).

### Cron job testen
In Vercel dashboard, ga naar "Logs":
- Selecteer "Function Logs"
- Filter op `/api/cron-refresh`
- Je ziet logs elke 5 minuten

Staat niets? Controleer:
1. `vercel.json` is correct
2. Environment variables zijn ingesteld
3. Herstart deployment

## Stap 5: Browser access

Open in je browser:
```
https://your-project.vercel.app
```

Je ziet het dashboard. Gebruik de UI om zendingen/colli op te vragen.

## Troubleshooting

| Probleem | Oplossing |
|---|---|
| "Missing environment variables" | Controleer Project Settings → Environment Variables |
| "Cannot GET /api/shipments" | Check dat api/shipments.js correct is, Vercel deployed |
| "Unauthorized" op API | Check CUSTOMER_CODE + API_KEY in env vars |
| "No shipments found" | Data van die datum bestaat niet, probeer ander datum |
| Cron draait niet | Check Vercel Functions logs, verifier KV (optioneel) |
| Slow responses | Activeer KV database voor caching |

## Lokale development (server.js)

Je kunt ook lokaal development doen met `server.js`:

```bash
node server.js
```

Dit is identiek aan Vercel API routes, maar draait lokaal op localhost:3000.

## Meer info

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel KV (Redis) Docs](https://vercel.com/docs/storage/vercel-kv)
- [Cron Jobs in Vercel](https://vercel.com/docs/cron-jobs)
- [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) — Architectuur & API details
- [README.md](README.md) — Setup instructies

---

**Vragen / Issues?**  
Controleer eerst `PROJECT_CONTEXT.md` voor architecture notes en bekende onzekerheden.
