# Logiztik Shipment Viewer

Een lokale webpagina en Vercel-deployment om je zendingen en binnenkomsten bij **Logiztik Alliance**
te bekijken. De pagina gebruikt twee API's uit de Logiztik API Portal:

- **Shipment Information V2** — totalen, tarieven en toeslagen per AWB op een datum.
- **Barcode Information V2** — colli-/doosdetails per zending, met status
  `Received` (binnen) of `Confirmed` (gepland, nog niet ontvangen).

## Architectuur

Een browserpagina kan deze API's niet rechtstreeks aanroepen (CORS-blokkering,
en je Api-Key zou zichtbaar worden). Daarom zit er een klein tussenstuk tussen:

### Lokale development:
```
Browser (index.html)  →  lokale proxy (server.js)  →  Logiztik API
```

### Vercel production:
```
Browser (index.html)  →  serverless functions (/api/*)  →  Logiztik API
                      →  data cache (Vercel KV / Redis) ←
```

De proxy/functions bewaart de Api-Key en doet de echte calls.
Data wordt elke 5 minuten automatisch vernieuwd via een cron job.

## Vereisten

### Lokaal (development met server.js)
- **Node.js 18 of hoger** ( controleer met `node --version` )
- Een geldige **CUSTOMER_CODE** en **API_KEY** voor de Logiztik productie-omgeving
- Geen `npm install` nodig — het project gebruikt alleen ingebouwde Node-modules

### Vercel (production deployment)
- GitHub account met deze repo
- Vercel account verbonden met je GitHub
- (Optioneel) Vercel KV store voor data caching

## Lokale installatie & start

1. Pak alle bestanden uit in één map.
2. Kopieer `.env.example` naar `.env`:
   - macOS/Linux: `cp .env.example .env`
   - Windows: `copy .env.example .env`
3. Open `.env` en vul je `CUSTOMER_CODE` en `API_KEY` in.
4. Start de server:
   ```
   node server.js
   ```
   (of `npm start`). Open daarna in je browser: **http://localhost:3000**

Stoppen: `Ctrl + C` in het terminalvenster.

## Vercel deployment

### Stap 1: Git repository
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USER/logiztik-viewer.git
git push -u origin main
```

### Stap 2: Vercel setup
1. Ga naar **vercel.com** → "Add New Project"
2. Importeer je GitHub repository
3. Vercel zal automatisch zien dat het een serverless project is
4. Stel environment variables in:
   - `CUSTOMER_CODE` = je klantcode
   - `API_KEY` = je API key
   - `API_KEY_HEADER` = Api-Key (standaard)
5. (Optioneel) Verbind **Vercel KV** voor caching:
   - Project settings → Storage → Create Vercel KV Database
   - Vercel zal automatisch `KV_REST_API_URL` en `KV_REST_API_TOKEN` vullen
6. Deploy!

### Stap 3: Testen
- Browser: `https://your-project.vercel.app`
- `/api/config` geeft je configuratie terug
- `/api/shipments?date=2026-05-28` haalt zendingen
- Cron job logt zich elke 5 minuten uit (zie Vercel dashboard → Logs)

## Gebruik

- **Op datum** — kies een verzenddatum, klik op *Toon zendingen*. Je krijgt een
  lijst AWB's met totalen. Klik op een zending om de colli te bekijken.
- **Op zendingsnummer** — typ een zendingsnummer en klik op *Toon colli* om
  direct de colli-/barcodedetails te zien.

De datumkiezer staat standaard op de datum van vandaag (van je eigen machine);
je past hem zelf aan.

## Probleemoplossing

| Melding | Mogelijke oorzaak / oplossing |
|---|---|
| `Niet geautoriseerd` / `Unauthorized` | Controleer `API_KEY`. Klopt de `API_KEY_HEADER`? Mogelijk is het IP-adres van deze machine niet gewhitelist bij Logiztik. |
| `The ApiKey does not have access to that customer code` | `CUSTOMER_CODE` past niet bij de Api-Key. |
| `Customer does not exist` | Verkeerde `CUSTOMER_CODE`. |
| `The shipment number does not contain pieces...` | Zendingsnummer klopt niet, of heeft geen colli voor jouw klant. |
| Time-out | De proxy bereikt de API niet — mogelijk IP-whitelisting of netwerk. |
| TLS-/certificaatfout | Zet `ALLOW_INSECURE_TLS=true` in `.env` en herstart. Minder veilig, dus bewust gebruiken. |
| Vercel logs leeg / cron draait niet | Controleer of je KV store beter geconfigureerd is. Voor development kun je zonder KV werken (in-memory mock). |

### Over de headernaam van de Api-Key

De Logiztik-documentatie noemt de Api-Key als verplichte parameter, maar vermeldt
**niet** exact in welke HTTP-header die hoort. De viewer gebruikt standaard
`Api-Key`. Werkt dat niet, pas dan `API_KEY_HEADER` in `.env` aan
(bijv. `Authorization`, `X-Api-Key` of `ApiKey`) — of vraag het na bij
`customerservice.ec@logiztikalliance.com`.

### Over het zendingsnummer

Bij het doorklikken vanaf een zending gebruikt de viewer het `awb`-veld als
zendingsnummer voor de Barcode-API. Mocht jouw administratie een ander
zendingsnummer hanteren, gebruik dan het veld *Direct op zendingsnummer*.

## Veiligheid

- Commit **nooit** je `.env`-bestand. `.gitignore` sluit het al uit.
- De Api-Key blijft op de proxy/server en wordt niet naar de browser gestuurd.
- Op Vercel worden geheimen via environment variables ingesteld (niet in code).

## Projectstructuur

| Bestand/Map | Functie |
|---|---|
| `index.html` | Dashboardpagina (frontend, vanilla HTML/CSS/JS) |
| `server.js` | Lokale proxy (Node.js, development only) |
| `api/` | Vercel serverless functions (`config.js`, `shipments.js`, `barcodes.js`, `cron-refresh.js`) |
| `lib/` | Gedeelde code (`logiztik.js` = API-logic, `kv.js` = caching) |
| `vercel.json` | Vercel configuratie (o.a. cron schedule) |
| `package.json` | Projectmetadata |
| `.env` | Lokale geheimen (niet in Git) |
| `.env.example` | Template voor `.env` |
| `.gitignore` | Houdt `.env` en node_modules buiten Git |

---

*Niet door Logiztik Alliance gemaakt of ondersteund. Eigen hulpmiddel,
gebouwd op hun openbare API-documentatie.*
