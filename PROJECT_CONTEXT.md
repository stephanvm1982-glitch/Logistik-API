# PROJECT_CONTEXT.md — Logiztik Shipment Viewer

> **Voor Claude (of een andere assistent): lees dit eerst.**
> Dit document vat samen wat er in eerdere sessies is besloten en geleerd, zodat je niet opnieuw bij nul begint. Werkproject. Antwoord in het Nederlands.

---

## Doel

Lokaal/web-dashboard om bij **Logiztik Alliance** per dag of periode zendingen en colli (binnenkomsten) te bekijken voor klant **CLI0113847**. Bloemenimport, route **UIO → AMS** (Quito → Amsterdam).

Hoofdgebruiker: **Stephan van Maldegem**.

## Stack

- **Frontend:** één `index.html` met embedded CSS + vanilla JS. Geen build-step, geen React, geen TypeScript. Bewuste keuze: minimaal, geen `npm install` nodig.
- **Backend lokaal:** `server.js`, Node.js 18+, **zero dependencies** — alleen ingebouwde modules (`http`, `https`, `fs`, `path`, `child_process`).
- **Doel-omgeving:** Vercel (serverless functions + statische pagina). Migratie staat nog open — zie "Volgende stap" onderaan.

## Architectuur

```
Browser (index.html)  →  proxy (lokaal: server.js / Vercel: /api/*.js)  →  Logiztik API
```

De Api-Key blijft **altijd** server-side; de browser krijgt 'm nooit te zien. CORS wordt opgelost doordat de browser en proxy op dezelfde origin draaien.

## Logiztik API — wat we ondervindelijk hebben geleerd

Productie: `https://cloud.logiztikalliance.com:5005/logCloudWS/...`

| Endpoint | URL-pad | Wat het levert |
|---|---|---|
| Shipment V2 | `/api/ClientesExternosA/ListarTotalesGuiasPorClienteV2/{CC}/{YYYY-MM-DD}` | Lijst AWB's met totalen voor die dag (origin, destination, pieces, totalAWB, charges[], rates[]). |
| Barcode V2 | `/api/v2/ClientesExternosA/ListarCodigosDeBarraPorClienteNew/{CC}/{SHIPMENTNR}` | Colli-detail (barcode, hawb, consignee, exporter, carrier, afmetingen, gewichten, productinfo, status `Received`/`Confirmed`). |

### Authenticatie — inconsistent
- **Shipment V2** leest de Api-Key uit de HTTP-**header** (`Api-Key`).
- **Barcode V2** vraagt om een **query-parameter** `?token=...` (anders: *"Missing input parameters. Please send token."*).
- Onze proxy stuurt 'm daarom op **beide plekken tegelijk** — endpoints negeren stilzwijgend wat ze niet nodig hebben.

### Netwerk / firewall
- Logiztik documenteert IP-whitelisting voor de **testomgeving**. Voor productie staat het niet expliciet vermeld; uit onze test blijkt dat productie geen strikte IP-check doet (thuisnetwerk werkte zonder registratie).
- **Poort 5005** is een ongebruikelijke poort die door corporate firewalls vaak wordt geblokkeerd. Symptoom: `ECONNREFUSED 186.101.25.194:5005`. Bekende observatie van Stephan's werkomgeving.

## Bestanden

| Bestand | Functie |
|---|---|
| `index.html` | Dashboard-UI. Corporate design tokens (blauw, Plus Jakarta Sans + Inter + JetBrains Mono). Periode-zoek (Van/Tot, max 31 dagen), AWB-filter, drill-down naar colli. Debug-toggles "Alle velden" + "Ruwe JSON". `file://` guard (toont waarschuwingskaart als pagina rechtstreeks geopend wordt). Multi-laags "core-spin-loader" animatie. |
| `server.js` | Lokale proxy. Routes: `/`, `/api/config`, `/api/shipments`, `/api/barcodes`. Token-loader uit `.env` zonder dotenv-dependency. Opent browser automatisch bij start (uitschakelbaar via `NO_BROWSER=true`). |
| `package.json` | Zero dependencies, `engines.node >=18`. |
| `.env.example` | `CUSTOMER_CODE`, `API_KEY`, `API_KEY_HEADER` (default `Api-Key`), `PORT` (default 3000), `ALLOW_INSECURE_TLS` (default false), `NO_BROWSER`. |
| `.gitignore` | `.env` blijft buiten Git. |
| `README.md` | Install + gebruik + troubleshooting (Windows-gericht). |

## Designprincipes (vastgelegd in eerdere sessies)

- **Corporate visuele stijl** (werkproject). Niet expressief/donker. Tokens uit `/mnt/skills/user/design-system/references/tokens-corporate.md`.
- Mobile-first responsive volgens `/mnt/skills/user/frontend-design/SKILL.md`.
- **Bedragen met `$`** prefix — Logiztik prijst in USD.
- **Gewichten** met duizendscheidingsteken + `kg`.
- **Codes naast namen**: Consignee, Exporteur, Carrier, Product tonen *naam (CODE)*.
- UI 100% **Nederlandstalig**.
- **Geen aannames voor datums** — gebruiker kiest, default = vandaag (lokale machine-datum, JS-berekend, niet hardcoded).
- **Debug-modi standaard ingeklapt** — knoppen "Alle velden" en "Ruwe JSON" rechtsboven elke sectie, gebruiker activeert wanneer nodig.

## Truth-stand / openstaande onzekerheden

Markeer alles waar je gokt; bevestig nooit als zeker wat je niet weet.

- **Headernaam Api-Key:** `Api-Key` werkt voor Shipment V2. Voor Barcode V2 hebben we 'm in de query gezet en dat lijkt te werken; niet uitgesloten dat een andere header (`Authorization`, `X-Api-Key`) óók zou werken.
- **Vercel IP-whitelisting risico:** Vercel egress-IP's zijn niet vast. Productie lijkt geen strikte whitelist te doen, maar als het toch faalt na deploy is dat de eerste verdachte. Workarounds: Vercel's "Secure Backend Compute" add-on (vaste IP), of een tussenproxy met vast IP.
- **Niet-gedocumenteerde API-velden:** mogelijk levert de API méér velden dan in de Logiztik-docs staan. Gebruiker kan via de debug-toggles checken. Nog niet systematisch gevalideerd.

## Voorkeurstijl van de gebruiker (uit `userPreferences`)

- Antwoorden in het **Nederlands**.
- Bij elk nieuw project eerst vragen: *werk of privé* en *planmode ja/nee* (in dit project: werk, planmode aangezet).
- Truth-prompt: expliciet onzekerheid markeren, bron labelen, geen aannames presenteren als feiten, datums fact-checken (geen aannames over dag).
- Bondige, directe antwoorden zonder overbodige opsmuk.

---

## Volgende stap — Vercel-portering (route A gekozen)

De huidige `server.js` moet worden opgesplitst in Vercel serverless functions. Geen frontend-rewrite — `index.html` blijft 1-op-1 als statische pagina.

**Beoogde structuur:**

```
/
├── index.html                  ← blijft op root, Vercel serveert 'm statisch
├── package.json
├── vercel.json                 ← waarschijnlijk niet nodig; defaults werken
├── .gitignore
├── .env.example
├── README.md
├── PROJECT_CONTEXT.md          ← dit bestand
├── api/
│   ├── config.js               ← één serverless function per endpoint
│   ├── shipments.js
│   └── barcodes.js
└── lib/
    └── logiztik.js             ← gedeelde callLogiztik() + enumerateDays() + paths
```

**Per file de logica:**
- `api/config.js` — geeft `{ customerCode, environment, apiKeyHeader, configured }` terug op basis van Vercel env vars. Geen secrets in respons.
- `api/shipments.js` — accepteert `?date=YYYY-MM-DD` (1 dag) of `?from=...&to=...` (range, max 31 dagen). Bij range: parallel calls per dag (Promise.all), aggregatie + meta.errors per dag.
- `api/barcodes.js` — accepteert `?shipment=SHIPMENTNR`.
- `lib/logiztik.js` — exporteert `callLogiztik(apiPath)`, `enumerateDays(from, to)`, en de twee URL-builders. **Belangrijk:** Api-Key wordt op twee plekken meegestuurd (header `Api-Key` + query `token=`).

**Vercel-conventies:**
- Each `api/*.js` exporteert `export default async function handler(req, res) { ... }` (ESM) of `module.exports = async (req, res) => { ... }` (CommonJS). Beide werken; kies één stijl consistent.
- Geen `http.createServer` — Vercel beheert de server.
- Env vars via `process.env.CUSTOMER_CODE` etc., gezet in het Vercel-dashboard (Project Settings → Environment Variables).

**Frontend-aanpassing minimaal:**
- `index.html` praat al met relatieve paden (`/api/config`, `/api/shipments`, `/api/barcodes`). Niets te wijzigen daar.
- De `file://` guard, core-loader, debug-toggles enz. blijven 1-op-1.

**Deployment-pad:**
1. Code naar GitHub via VS Code Source Control.
2. vercel.com → "Add New Project" → Import van die GitHub-repo.
3. Env vars instellen: `CUSTOMER_CODE`, `API_KEY`, `API_KEY_HEADER`.
4. Deploy. Eerste call doet de echte test.

**Wat te checken bij eerste deploy:**
- Geeft `/api/config` op de Vercel-URL het juiste customer-code-veld terug?
- Geeft `/api/shipments?date=...` data of een fout? Bij fout: is het netwerk (Vercel egress IP geblokkeerd door Logiztik), auth, of iets anders?
- Werkt de browser op kantoor met deze Vercel-URL? (Doel van de migratie.)

---

## Tot slot

Als iets onduidelijk is: vraag het. Niet aannemen. Niet ongevraagd hele bestanden omgooien.
