# TTP Analytics Dashboard — Full Technical Documentation

> **Version:** v2.1 · Data Engine  
> **Company:** TTP Services Middle East · CAPREALEO GROUP · Dubai / Belgium  
> **Last Updated:** April 2026  
> **Maintained by:** Abdul Rahman (Data Analyst)  
> **Data Analyst:** Samir Al Gnabi  
> **IT Team Head:** Robbert Jan Tel  

---

## 📋 Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Repository Structure](#4-repository-structure)
5. [Environment Setup](#5-environment-setup)
6. [Database — Azure SQL](#6-database--azure-sql)
7. [Backend — Node.js / Express](#7-backend--nodejs--express)
8. [Frontend — React / Vite](#8-frontend--react--vite)
9. [Dashboard Tabs — Feature Guide](#9-dashboard-tabs--feature-guide)
10. [API Reference](#10-api-reference)
11. [Data Rules — Critical](#11-data-rules--critical)
12. [Deployment Guide](#12-deployment-guide)
13. [Known Errors & Fixes](#13-known-errors--fixes)
14. [ETL & Samir's Procedures](#14-etl--samirs-procedures)
15. [Future Roadmap](#15-future-roadmap)

---

## 1. Project Overview

TTP Analytics Dashboard is an **internal business intelligence tool** for TTP Services. It gives the management and finance team real-time visibility into:

- Travel bookings and PAX across all datasets
- Revenue and Year-on-Year comparisons
- Bus occupancy, pendel trips, deck/class distribution, feeder routes
- Purchase obligations, margins, commissions per booking and per element category
- Hotel ratings and reviews

The dashboard is **read-only** — it never writes to the database. All data flows from Azure SQL → Node.js backend → React frontend.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────┐
│                   USER BROWSER                       │
│         https://ttp-services.github.io/              │
│              TTP-DASHBOARD/ (React)                  │
└───────────────────────┬─────────────────────────────┘
                        │ HTTPS API calls
                        │ Bearer token auth
                        ▼
┌─────────────────────────────────────────────────────┐
│              AZURE APP SERVICE                       │
│    ttp-dashboard-api.azurewebsites.net               │
│         Node.js + Express Backend                    │
│    Resource Group: datafactory                       │
│    App Name: ttp-dashboard-api                       │
└───────────────────────┬─────────────────────────────┘
                        │ SQL queries
                        │ mssql / tedious driver
                        ▼
┌─────────────────────────────────────────────────────┐
│              AZURE SQL DATABASE                      │
│    Server:  ttpserver.database.windows.net           │
│    Database: TTPDatabase                             │
│    User:    ttp_admin                                │
└─────────────────────────────────────────────────────┘
```

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Frontend hosting | GitHub Pages |
| Frontend CI/CD | GitHub Actions |
| Backend | Node.js + Express |
| Backend hosting | Azure App Service |
| Database | Azure SQL (SQL Server) |
| DB Driver | mssql / tedious |
| Auth | JWT Bearer tokens |
| Password hashing | bcryptjs |
| AI (TTP AI tab) | OpenAI GPT-4o-mini |
| Charts | Custom SVG (inline React) |
| Styling | Inline React styles (no CSS framework) |

---

## 4. Repository Structure

```
TTP Project/
├── frontend/                     ← React + Vite app
│   ├── src/
│   │   └── App.jsx               ← ENTIRE frontend in one file
│   ├── public/
│   │   └── assets/
│   │       └── logo.png          ← TTP logo
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── .github/
│       └── workflows/
│           └── deploy.yml        ← GitHub Actions auto-deploy
│
└── backend/                      ← Node.js + Express API
    ├── src/
    │   ├── server.js             ← Entry point
    │   ├── routes/
    │   │   ├── dashboard.js      ← ALL dashboard API routes
    │   │   └── auth.js           ← Login / JWT
    │   ├── db/
    │   │   └── azureSql.js       ← DB connection + query helper
    │   └── middleware/
    │       └── auth.js           ← JWT verify middleware
    ├── data/
    │   ├── users.json            ← User accounts (hashed passwords)
    │   └── settings.json         ← AI prompt + email alert settings
    └── package.json
```

---

## 5. Environment Setup

### Backend Environment Variables (Azure App Service → Configuration)

| Variable | Value |
|---|---|
| `DB_SERVER` | `ttpserver.database.windows.net` |
| `DB_NAME` | `TTPDatabase` |
| `DB_USER` | `ttp_admin` |
| `DB_PASSWORD` | *(secret — in Azure config)* |
| `JWT_SECRET` | *(secret — in Azure config)* |
| `OPENAI_API_KEY` | *(secret — for TTP AI tab)* |
| `NODE_ENV` | `production` |

### Frontend Environment Variables

```bash
# frontend/.env.production
VITE_API_URL=https://ttp-dashboard-api.azurewebsites.net
```

### Local Development

```bash
# Backend
cd backend
npm install
cp .env.example .env      # fill in your DB credentials
node src/server.js        # runs on port 3001

# Frontend
cd frontend
npm install
npm run dev               # runs on port 5173
```

---

## 6. Database — Azure SQL

### Connection Details

```
Server:   ttpserver.database.windows.net
Database: TTPDatabase
User:     ttp_admin
Port:     1433
```

---

### Tables Overview

#### CustomerOverview
Main booking table for Solmar, Interbus, and Solmar DE datasets.

| Column | Type | Notes |
|---|---|---|
| BookingID | nvarchar | Unique booking ID |
| Dataset | nvarchar | `Solmar` / `Interbus` / `Solmar DE` |
| Status | nvarchar | `DEF` = Confirmed, `DEF-GEANNULEERD` = Cancelled |
| DepartureDate | date | |
| ReturnDate | date | |
| BookingDate | datetime | |
| DepartureYear | int | |
| DepartureMonth | int | |
| PAXCount | int | Number of passengers |
| TotalRevenue | decimal | Revenue in EUR |
| LabelName | nvarchar | Label of the booking |
| TransportType | nvarchar | BUS / FLIGHT / OWN TRANSPORT etc |

---

#### ST_Bookings
Booking table for Snowtravel dataset.

| Column | Type | Notes |
|---|---|---|
| travelFileId | int | Booking ID |
| status | nvarchar | `ok` = Confirmed, `cancelled` = Cancelled |
| dateDeparture | datetime | |
| dateReturn | datetime | |
| creationTime | datetime | Booking date |
| paxCount | int | |
| totalPrice | decimal | |

> ⚠️ **CRITICAL:** CustomerOverview uses Dutch statuses (`DEF`/`DEF-GEANNULEERD`). ST_Bookings uses English (`ok`/`cancelled`). Always handle both in backend queries.

---

#### solmar_bus_bookings_modified
Bus bookings table — used for Bus KPI cards and Deck view filters.

| Column | Type | Notes |
|---|---|---|
| Booking_Number | nvarchar | |
| Status | nvarchar | `DEF` / `TIJD` / `VERV` / `DEF-GEANNULEERD` |
| PAX | int | |
| Outbound_Class | nvarchar | `Royal Class` / `First Class` / `Premium Class` / `Comfort Class` |
| Outbound_Deck | nvarchar | `Onderdek` (Lower) / `Bovendek` (Upper) / `Geen` (None) |
| dateDeparture | date | |
| Label | nvarchar | `STANDAARD` / `DEU` / `ITB` |
| Region | nvarchar | |

---

#### solmar_bus_deck_choice
Deck and class distribution — used for Deck & Class pivot table. Same structure as `solmar_bus_bookings_modified`.

---

#### BUStrips
Pendel (shuttle bus) aggregated table. **Managed by Samir's ETL stored procedure — NOT automatic.**

| Column | Type | Notes |
|---|---|---|
| StartDate | date | Departure date |
| EndDate | date | Return date |
| Status | nvarchar | DEF / DEF-GEANNULEERD etc |
| ORC | int | Outbound Royal Class |
| OFC | int | Outbound First Class |
| OPRE | int | Outbound Premium |
| OTotal | int | Total outbound |
| RRC | int | Return Royal Class |
| RFC | int | Return First Class |
| RPRE | int | Return Premium |
| RTotal | int | Total return |
| RC_Diff | int | Royal class difference (out vs in) |
| FC_Diff | int | First class difference |
| PRE_Diff | int | Premium difference |
| Total_Difference | int | Total difference |

> ⚠️ **CRITICAL:** BUStrips is NOT updated automatically. Samir must run the stored procedure. See Section 14.

---

#### FeederOverview
Feeder route data (pickup stops per departure date).

| Column | Type | Notes |
|---|---|---|
| DepartureDate | date | |
| LabelName | nvarchar | |
| FeederLine | nvarchar | |
| RouteNo | int | |
| RouteLabel | nvarchar | |
| StopName | nvarchar | |
| StopType | nvarchar | |
| Direction | nvarchar | |
| TotalPax | int | |
| BookingCount | int | |

---

#### solmar.MarginOverview
Purchase obligations per booking. Schema prefix is `solmar` (not `dbo`).

| Column | Type | Notes |
|---|---|---|
| BookingID | nvarchar | |
| StatusCode | nvarchar | `DEF` / `DEF-GEANNULEERD` |
| DepartureDate | date | |
| ReturnDate | date | |
| BookingDate | datetime | |
| PAX | int | |
| TravelType | nvarchar | BUS / OWN TRANSPORT / FLIGHT / ENKEL / UNKNOWN |
| Label | nvarchar | Solmar / Solmar DE / Interbus |
| SalesBooking | decimal | Revenue from customer |
| PurchaseCalculation | decimal | Actual purchase cost |
| PurchaseObligation | decimal | Outstanding obligation to supplier |
| Margin | decimal | SalesBooking - PurchaseCalculation |
| Commission | decimal | |
| MarginIncludingCommission | decimal | Margin + Commission |

---

#### dbo.BookingElementMarginOverview
Purchase obligations broken down by element category.

| Column | Type | Notes |
|---|---|---|
| BookingId | nvarchar | |
| MarginCategory | nvarchar | `Coach` / `Hotel` / `Flight` / `Transfer` / `Other` / `Service Line` |
| Dataset | nvarchar | |
| Status | nvarchar | `DEF` / `DEF-GEANNULEERD` |
| LabelName | nvarchar | |
| LabelCode | nvarchar | |
| DepartureDate | date | |
| ReturnDate | date | |
| DepartureYear | int | |
| DepartureMonth | int | |
| PAXCount | int | |
| ElementCount | int | |
| BasePriceTotal | decimal | |
| SoldAmount | decimal | |
| PaidAmount | decimal | |
| DepositAmount | decimal | |
| CommissionAmount | decimal | |
| Margin | decimal | |
| MarginIncludingCommission | decimal | |

---

#### HotelRatings
Hotel rating snapshots from TravelTrustIt API.

#### HotelReviews
Individual hotel reviews from TravelTrustIt API.

---

## 7. Backend — Node.js / Express

### Entry Point: `src/server.js`

```
- Sets up Express app
- Enables CORS (all origins — Azure Portal CORS must be EMPTY)
- Rate limiter: validate.xForwardedForHeader = false  ← REQUIRED for Azure
- Mounts /api/auth router (public)
- Mounts /api/dashboard router (JWT protected)
- Listens on PORT env var or 3001
```

### Database Helper: `src/db/azureSql.js`

```javascript
// Use named params with @name syntax
export async function query(sql, params = {}) {
  // connects to Azure SQL using mssql/tedious
  // executes sql with named params
  // returns { recordset: [...rows] }
}

// Example:
const result = await query(
  "SELECT * FROM CustomerOverview WHERE Dataset=@ds AND DepartureYear=@yr",
  { ds: "Solmar", yr: 2025 }
);
```

### Key Functions in `dashboard.js`

**`parseFilters(q)`** — Parses all query params into a clean filter object. Handles arrays for multi-select filters.

```javascript
{
  dataset: [],       // array — Solmar / Interbus / Solmar DE / Snowtravel
  status: [],        // array — ok / cancelled / DEF / DEF-GEANNULEERD
  year: [],          // array of numbers
  label: [],         // array — Solmar / Solmar DE / Interbus
  travelType: [],    // array — BUS / FLIGHT / OWN TRANSPORT / ENKEL / UNKNOWN
  departureDateFrom: '', departureDateTo: '',
  bookingDateFrom: '', bookingDateTo: '',
  departureFrom: '', departureTo: '',   // used by margin-overview
}
```

**`buildOverviewWhere(filters, opts)`** — Builds WHERE clause for CustomerOverview + ST_Bookings with different column names handled.

**`overviewUnionSql(whereObj)`** — Creates UNION ALL SQL combining CustomerOverview and ST_Bookings.

**`buildBusWhere(q)`** — Builds WHERE clause for bus tables. Reads status directly from `req.query.status`.

**`cleanUnion(parts)`** — Safely joins SQL UNION parts, returns empty result if no valid parts.

---

## 8. Frontend — React / Vite

### Single File Architecture

**The entire frontend is in one file: `src/App.jsx`**. No separate component files, no CSS files — everything inline. This is intentional for simplicity.

### Key Constants

```javascript
const BASE = import.meta.env?.VITE_API_URL || "https://ttp-dashboard-api.azurewebsites.net";
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DATASETS = ["Solmar","Interbus","Solmar DE","Snowtravel"];
const YEARS = [2023,2024,2025,2026];
const YC = {2023:"#10b981", 2024:"#8b5cf6", 2025:"#f97316", 2026:"#3b82f6"};
```

### Color System — S Object

All UI colors are in one `S` object. Edit this to change any color:
```javascript
const S = {
  bg: "#f0f5ff",       // page background
  card: "#ffffff",     // card background
  accent: "#1a56db",   // primary blue
  success: "#059669",  // green (confirmed, positive)
  danger: "#dc2626",   // red (cancelled, negative)
  warn: "#d97706",     // amber (warnings, obligations)
  purple: "#7c3aed",   // purple
  orange: "#ea580c",   // orange
  muted: "#64748b",    // grey text
  border: "#e2e8f0",   // light border
}
```

### Auth System

```javascript
saveAuth(token, user)  // saves to localStorage + sessionStorage (fallback)
loadAuth()             // reads auth, auto-expires after 30 days
clearAuth()            // clears both → logs user out
```

### API Helper

```javascript
async function api(path, params = {}, token) {
  // Arrays → multiple ?key=val&key=val2 (for multi-select filters)
  // Adds Authorization: Bearer <token> header
  // Throws error if response not OK
}
```

### Formatting Helpers

```javascript
fmtM(v)    // €1.23M / €456.7K / €123
fmtN(v)    // 1.234 (nl-BE locale, dots as separators)
fmtEur(v)  // €1.234,56 (2 decimal places)
dc(v)      // green if positive, red if negative
```

---

## 9. Dashboard Tabs — Feature Guide

### Tab 1: Overview

**Data sources:** `CustomerOverview` + `ST_Bookings`

**Features:**
- 3 KPI cards: Total Bookings, Total PAX, Gross Revenue (each with Previous / Difference / Diff%)
- Revenue by Year — SVG line chart, one line per year (2023–2026)
- Bookings/PAX by Month — SVG grouped bar chart with toggle
- Year-on-Year Comparison table — Period, Current, Previous, Difference, Diff%
- Chip multi-select filters: Dataset, Status, Year, Departure dates, Booking dates, Quick presets
- Fiscal year presets: Solmar FY (Dec–Nov), Snowtravel FY (Jul–Jun)
- CSV export of YoY table

**YoY backend logic — loads 3 years so Previous always shows:**
```javascript
const loadYears = uniq([
  ...selectedYears,
  ...selectedYears.map(y=>y-1),
  ...selectedYears.map(y=>y-2)
]);
```

---

### Tab 2: Bus Occupancy

**Sub-tabs:**

**🚌 Pendel Overview** — Source: `dbo.BUStrips`
- Shows weekly pendel trips: ORC, OFC, OPRE, Out Total, RRC, RFC, RPRE, In Total, Δ Royal, Δ First, Δ Premium, Δ Total
- Status filter does NOT apply — BUStrips is ETL-managed by Samir
- Empty table = ask Samir to run `EXEC etl.usp_LoadBUStrips;`

**🪑 Deck & Class** — Source: `solmar_bus_bookings_modified` + `solmar_bus_deck_choice`
- 8 KPI cards + pivot table per departure date
- Status filter DOES apply here

**🗺 Feeder Routes** — Source: `FeederOverview`
- Pivot table: routes as rows, dates as columns, PAX as values

**Sidebar filters:** Date, Label, Status (dropdown), Pendel, Region, Weekday, Feeder Line

---

### Tab 3: Purchase Obligations

**📋 Booking Summary** — Source: `solmar.MarginOverview`
- 9 KPI cards: Total Bookings, Confirmed, Cancelled, PAX, Sales, Net Margin, Commission, Obligations, Margin+Commission
- Detail table: Booking ID, Departure, Return, Status, Label, PAX, Sales, Purchase, Obligation, Margin, Margin%, Commission, Margin+Comm
- Chip multi-select filters: Status, Label, Travel Type
- Search + CSV export + pagination (200 rows/page)

**🔍 Element Breakdown** — Source: `dbo.BookingElementMarginOverview`
- 6 KPI cards: Bookings, PAX, Sales, Net Margin, Commission, Commission %
- Per-category cards: Coach, Hotel, Flight, Transfer, Other, Service Line
- Monthly pivot table: Sales + Margin per category per month + TOTAL row
- Full detail table with CSV export + pagination

---

### Tab 4: Settings (Admin only)

- User Management: create/delete users, change roles
- API Status: live test of each endpoint
- AI Prompts: custom system prompt
- Email Alerts: configuration UI (backend not yet implemented)

---

## 10. API Reference

**Base URL:** `https://ttp-dashboard-api.azurewebsites.net`
**All routes require:** `Authorization: Bearer <token>`

### Auth
```
POST /api/auth/login
Body: { username, password }
Response: { token, user: { username, role } }
```

### Overview
```
GET /api/dashboard/kpis
GET /api/dashboard/revenue-by-year
GET /api/dashboard/year-month-comparison
GET /api/dashboard/slicers
Common params: dataset[], status[], year[], departureDateFrom, departureDateTo, bookingDateFrom, bookingDateTo
```

### Bus Occupancy
```
GET /api/dashboard/bus-slicers
GET /api/dashboard/bus-kpis          params: dateFrom, dateTo, status, label, region, pendel, weekday
GET /api/dashboard/pendel-overview   params: dateFrom, dateTo, weekday, status
GET /api/dashboard/deck-class        params: dateFrom, dateTo, status, label, region, pendel, weekday
GET /api/dashboard/feeder-overview   params: dateFrom, dateTo, feederLine, label, direction
```

### Purchase Obligations
```
GET /api/dashboard/margin-overview         params: departureFrom, departureTo, status[], label[], travelType[], page, limit
GET /api/dashboard/margin-slicers
GET /api/dashboard/element-margin-overview params: departureFrom, departureTo, status, label[], year[], page, limit
```

### Hotel
```
GET /api/dashboard/hotel-ratings
GET /api/dashboard/hotel-reviews   params: code, country, minRating, page, limit
GET /api/dashboard/hotel-stats
```

### Users & Settings
```
GET/POST/PUT/DELETE /api/dashboard/users
GET/POST            /api/dashboard/settings
```

---

## 11. Data Rules — Critical

### Status Values per Table

| Table | Confirmed | Cancelled |
|---|---|---|
| `CustomerOverview` | `DEF` | `DEF-GEANNULEERD` |
| `ST_Bookings` | `ok` | `cancelled` |
| `solmar_bus_bookings_modified` | `DEF` | `DEF-GEANNULEERD` |
| `solmar_bus_deck_choice` | `DEF` | `DEF-GEANNULEERD` |
| `BUStrips` | `DEF` | `DEF-GEANNULEERD` |
| `solmar.MarginOverview` | `DEF` | `DEF-GEANNULEERD` |
| `dbo.BookingElementMarginOverview` | `DEF` | `DEF-GEANNULEERD` |

### Dataset → Table Mapping

| Dataset | Table | Condition |
|---|---|---|
| Solmar | `CustomerOverview` | `Dataset='Solmar'` |
| Interbus | `CustomerOverview` | `Dataset='Interbus'` |
| Solmar DE | `CustomerOverview` | `Dataset='Solmar DE'` |
| Snowtravel | `ST_Bookings` | entire table |

### Deck Column Mapping (Dutch → English)

```sql
Lower Deck:  Outbound_Deck LIKE '%Onderdek%' AND Outbound_Deck NOT LIKE '%Geen%'
Upper Deck:  Outbound_Deck LIKE '%Bovendek%' AND Outbound_Deck NOT LIKE '%Geen%'
No Deck:     Outbound_Deck LIKE '%Geen%' OR Outbound_Deck IS NULL
```

### BUStrips Rules
- NOT automatically updated — Samir runs ETL proc manually
- Default proc excludes `VERV` and `DEF-GEANNULEERD`
- Status filter does NOT filter BUStrips — only filters `solmar_bus_bookings_modified`

---

## 12. Deployment Guide

### Frontend — GitHub Pages

```bash
cd C:\Project\frontend
git add src/App.jsx
git commit -m "describe change"
git push
# Auto-deploys via GitHub Actions in ~2 minutes
# Check: GitHub repo → Actions tab
```

**Live URL:** `https://ttp-services.github.io/TTP-DASHBOARD/`

### Backend — Azure App Service

```bash
cd C:\Project\backend
git add src/routes/dashboard.js
git commit -m "describe change"
git push azure master
# Deploys in ~30-60 seconds
```

**If push fails (auth error):**
```bash
az login
az webapp deployment source config-zip \
  --resource-group datafactory \
  --name ttp-dashboard-api \
  --src backend.zip
```

**If upstream error:**
```bash
git branch --set-upstream-to=azure/master master
```

**Azure Portal:** portal.azure.com → Resource Group: `datafactory` → App: `ttp-dashboard-api`

---

## 13. Known Errors & Fixes

### 🔴 Bus Occupancy → 500 error on deck-class / bus-kpis

**Symptom:** Console: `Failed to load resource: 500` on deck-class or bus-kpis endpoint.

**Cause:** `buildBusWhere` reads `f.statusBus` (processed) instead of `q.status` (raw), building broken SQL.

**Fix in `dashboard.js` — `buildBusWhere`:**
```javascript
const rawStatus = Array.isArray(q.status) ? q.status.join(',') : (q.status||'');
if (rawStatus && rawStatus !== 'all' && rawStatus !== '') {
  const statuses = rawStatus.split(',').map(s=>s.trim()).filter(Boolean);
  if (statuses.length===1) { conds.push('Status=@st'); params.st=statuses[0]; }
  else if (statuses.length>1) {
    statuses.forEach((s,i)=>{ params['st'+i]=s; });
    conds.push('(' + statuses.map((_,i)=>'Status=@st'+i).join(' OR ') + ')');
  }
}
```

---

### 🔴 `SyntaxError: Identifier 'Router' has already been declared`

**Cause:** Duplicate `import { Router } from 'express'` in `dashboard.js`.

**Fix:** Keep only ONE `import { Router }` at the very top. Delete the duplicate.

---

### 🔴 CORS error on all API calls

**Cause:** Azure Portal CORS entries conflict with Node.js CORS middleware.

**Fix:**
1. Azure Portal → App Service → CORS → **Delete ALL entries** → Save
2. Let Node.js `cors()` middleware in `server.js` handle everything

---

### 🔴 Rate limiter — "Invalid IP address" crash

**Cause:** Azure sends `x-forwarded-for` header with multiple IPs.

**Fix in `server.js`:**
```javascript
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  validate: { xForwardedForHeader: false }  // ← REQUIRED
}));
```

---

### 🟡 YoY "Previous" column shows 0 or —

**Cause:** Backend only loads [2025, 2024] but needs 2023 to show 2024's previous.

**Fix in `dashboard.js`:**
```javascript
const loadYears = uniq([
  ...selectedYears,
  ...selectedYears.map(y=>y-1),
  ...selectedYears.map(y=>y-2)   // ← load 3 years
]);
```

---

### 🟡 Chart tooltips crash / freeze

**Cause:** `e.target.closest("svg")` returns null, then crashes calling `.getBoundingClientRect()` on null.

**Fix in `App.jsx`:**
```javascript
onMouseEnter={e=>{
  try {
    const sv = e.currentTarget.closest("svg") || e.target.closest("svg");
    if (!sv) return;
    const rc = sv.getBoundingClientRect();
    setTooltip({ ... });
  } catch {}
}}
```

---

### 🟡 Pendel table shows "No data"

**Cause:** `BUStrips` table is empty — Samir has not run the ETL proc.

**Fix:**
```sql
EXEC etl.usp_LoadBUStrips;

-- Verify:
SELECT Status, COUNT(*) AS cnt, MIN(StartDate), MAX(StartDate)
FROM dbo.BUStrips GROUP BY Status;
```

---

### 🟡 Purchase Obligations shows zeros

**Cause 1:** User forgot to click Apply Filters — data does not auto-load.
**Cause 2:** `solmar.MarginOverview` table is empty.

**Fix:**
```sql
SELECT COUNT(*) FROM solmar.MarginOverview;
-- If 0 → ask Samir to run the pipeline
```

---

### 🟡 Backend startup crash — auth.js not found

**Cause:** `server.js` imports `auth.js` but it's missing from deployment.

**Fix:** Ensure `src/routes/auth.js` exists and exports a valid Express Router.

---

## 14. ETL & Samir's Procedures

### BUStrips Stored Procedure

**Procedure name:** `etl.usp_LoadBUStrips`

```sql
-- Default run (DEF only — excludes VERV and DEF-GEANNULEERD):
EXEC etl.usp_LoadBUStrips;

-- Include DEF-GEANNULEERD as well:
EXEC etl.usp_LoadBUStrips
    @Statuses = 'DEF, DEF-GEANNULEERD',
    @ExcludedStatuses = 'VERV, TEST';

-- Verify result:
SELECT Status, COUNT(*) AS cnt, MIN(StartDate) AS minDate, MAX(StartDate) AS maxDate
FROM dbo.BUStrips
GROUP BY Status;
```

**Rules:**
- Use comma-separated values for parameters
- No brackets needed
- Spaces around commas are fine

---

### Data Verification Queries

```sql
-- Bookings by year
SELECT DepartureYear, COUNT(*) AS bookings
FROM CustomerOverview
GROUP BY DepartureYear ORDER BY DepartureYear;
-- Expected: 2023~23557, 2024~24969, 2025~22316, 2026~12126

-- Snowtravel by year
SELECT YEAR(dateDeparture) AS yr, COUNT(*) FROM ST_Bookings
GROUP BY YEAR(dateDeparture) ORDER BY yr;

-- Margin data
SELECT COUNT(*) FROM solmar.MarginOverview;

-- BUStrips
SELECT COUNT(*) FROM dbo.BUStrips;

-- Element breakdown
SELECT COUNT(*) FROM dbo.BookingElementMarginOverview;
```

---

## 15. Future Roadmap

### Planned Features

| Feature | Priority | Notes |
|---|---|---|
| Hotel Insights tab | High | Backend routes exist. Frontend view not built yet. |
| Data Table tab | Medium | Backend route `/bookings-table` exists. Frontend not built. |
| TTP AI tab improvements | Medium | GPT-4o-mini works but needs refinement. |
| Dynamic Travel Type filter | Low | Currently hardcoded. Should fetch from `/margin-slicers`. |
| Hotel reviews ETL fix | Low | TravelTrustIt API pipeline broken — Samir to fix. |
| Email alerts backend | Low | UI exists, backend logic not implemented. |
| Excel export | Low | Currently CSV only. Finance team requested Excel. |
| BUStrips auto-refresh schedule | Low | Currently manual only. |

### Data Gaps

| Item | Owner | Status |
|---|---|---|
| `solmar.MarginOverview` empty rows | Samir | Pending pipeline run |
| 2026 deck data showing zero | Samir | Pipeline not yet run for 2026 |
| `CustomerOverview` 2025 completeness | Samir | Verify all months loaded |
| `BUStrips` refresh schedule | Samir | No schedule — manual only |
| Hotel reviews ETL | Samir | API broken — needs fixing |

---

## 📞 Team Contacts & Access

| Person | Role | Responsibility |
|---|---|---|
| Abdul Rahman | Data Analyst | Frontend + Backend code, dashboard features, deployment |
| Samir Al Gnabi | Data Analyst | Azure SQL, ETL pipelines, stored procedures, data loading |
| Robbert Jan Tel | IT Team Head | Feature requirements, UX decisions, product direction |

### Quick Access Links

| Resource | URL / Location |
|---|---|
| Dashboard (live) | https://ttp-services.github.io/TTP-DASHBOARD/ |
| Backend API | https://ttp-dashboard-api.azurewebsites.net |
| GitHub Repository | https://github.com/ttp-services/TTP-DASHBOARD |
| Azure Portal | https://portal.azure.com → Resource Group: `datafactory` |
| App Service | `ttp-dashboard-api` · West Europe |
| Azure SQL | `ttpserver.database.windows.net` / DB: `TTPDatabase` |

---

## 🆘 Emergency Quick Reference

**Dashboard not loading?**
1. Test: `https://ttp-dashboard-api.azurewebsites.net` → should respond
2. Azure Portal → App Service → Log Stream → check for errors
3. GitHub → Actions tab → check latest deploy status

**All numbers showing 0?**
1. Browser DevTools → Console → look for 500 or 401 errors
2. 401 = token expired → log out and log back in
3. 500 = backend SQL error → check Azure Log Stream

**Bus Occupancy 500 error?**
1. Check `buildBusWhere` in `dashboard.js` — status must read from `req.query.status`
2. Redeploy backend after fix

**Pendel empty?**
1. `SELECT COUNT(*) FROM dbo.BUStrips;`
2. If 0 → `EXEC etl.usp_LoadBUStrips;`

**Purchase Obligations empty?**
1. Click **Apply Filters** — data does not auto-load
2. `SELECT COUNT(*) FROM solmar.MarginOverview;`

**Login broken?**
1. Check `data/users.json` exists in backend
2. Check `JWT_SECRET` in Azure App Service Configuration
3. Redeploy backend if files missing

---

*Documentation by Abdul Rahman — Data Analyst, TTP Services Middle East.*  
*Last updated: April 2026. Contact: Abdul Rahman or Robbert Jan Tel.*
