# TTP Analytics Dashboard

> **Version:** v2.2 · Data Engine  
> **Company:** TTP Services Middle East · CAPREALEO GROUP · Dubai / Belgium  
> **Last Updated:** April 2026  
> **Developer:** Abdul Rahman · **Data Engineer:** Samir Al Gnabi · **Product Owner:** Robbert Jan Tel

---

## Table of Contents

1. [What Is This Project](#1-what-is-this-project)
2. [Architecture](#2-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Repository Structure](#4-repository-structure)
5. [Environment Setup](#5-environment-setup)
6. [Database Tables](#6-database-tables)
7. [Critical Data Rules](#7-critical-data-rules)
8. [Authentication & Security](#8-authentication--security)
9. [Dashboard Tabs](#9-dashboard-tabs)
10. [API Reference](#10-api-reference)
11. [SQL Query Patterns](#11-sql-query-patterns)
12. [Frontend Patterns](#12-frontend-patterns)
13. [Deployment](#13-deployment)
14. [ETL & Stored Procedures](#14-etl--stored-procedures)
15. [Known Bugs & Fixes](#15-known-bugs--fixes)
16. [How to Make Changes](#16-how-to-make-changes)
17. [Emergency Reference](#17-emergency-reference)
18. [Contacts & Access](#18-contacts--access)

---

## 1. What Is This Project

TTP Analytics Dashboard is an internal business intelligence tool for TTP Services. It is a **read-only** dashboard — it never writes booking data to the database. All data flows in one direction:

```
Azure SQL → Node.js Backend → React Frontend
```

The dashboard gives management visibility into:

- Travel bookings and PAX across 4 datasets (Solmar, Interbus, Solmar DE, Snowtravel)
- Revenue and year-on-year comparisons
- Bus occupancy with pendel trips, deck distribution, and feeder routes
- Purchase obligations with margins and commissions
- Hotel ratings and reviews
- Flight route PAX data

**Key people:**
| Name | Role |
|---|---|
| Robbert Jan Tel | Product Owner — defines requirements and table formats |
| Samir Al Gnabi | Data/ETL Engineer — database pipelines and stored procedures |
| Mallory | Uses the Flights tab for purchasing transfers |
| Maarten | Yield/media planning team |

---

## 2. Architecture

The system has three layers:

```
Browser (GitHub Pages)
  └── React SPA at ttp-services.github.io/TTP-DASHBOARD
        │  HTTPS API calls with Bearer token auth
        ▼
Node.js/Express Backend (Azure App Service)
  └── ttp-dashboard-api.azurewebsites.net
        │  mssql/tedious driver
        ▼
Azure SQL Database
  └── ttpserver.database.windows.net / TTPDatabase
```

**Frontend:** Single-page React 18 + Vite app. The entire frontend lives in one file: `src/App.jsx`. This was deliberate to avoid import/deployment complexity.

**Backend:** Node.js + Express. Dashboard routes in `src/routes/dashboard.js`, auth routes in `src/routes/auth.js`.

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, GitHub Pages, GitHub Actions CI/CD |
| UI | Lucide React icons, custom SVG charts (no chart library), inline React styles |
| Backend | Node.js, Express, Azure App Service |
| Auth | bcryptjs (passwords), speakeasy + qrcode (2FA TOTP), JWT |
| Database | Azure SQL (SQL Server), mssql/tedious driver |
| AI Tab | OpenAI GPT-4o-mini with live database context |

---

## 4. Repository Structure

**Local working directories:** `C:\Project\frontend` and `C:\Project\backend`

```
frontend/
├── src/
│   └── App.jsx                    # Entire frontend in one file
├── public/
│   └── assets/logo.png            # TTP logo
├── index.html
├── vite.config.js
└── .github/workflows/deploy.yml   # Auto-deploy to GitHub Pages

backend/
├── src/
│   ├── server.js                  # Entry point
│   ├── routes/
│   │   ├── dashboard.js           # All dashboard API routes
│   │   └── auth.js                # Login, 2FA, password change
│   ├── db/
│   │   └── azureSql.js            # DB connection helper
│   └── middleware/
│       └── auth.js                # JWT verify
└── data/
    └── settings.json              # AI prompt and email alert config
```

---

## 5. Environment Setup

### Backend — Azure App Service Configuration

| Variable | Value |
|---|---|
| `DB_SERVER` | `ttpserver.database.windows.net` |
| `DB_NAME` | `TTPDatabase` |
| `DB_USER` | `ttp_admin` |
| `DB_PASSWORD` | *(secret)* |
| `JWT_SECRET` | *(secret)* |
| `OPENAI_API_KEY` | *(secret)* |
| `NODE_ENV` | `production` |

### Frontend — `.env.production`

```env
VITE_API_URL=https://ttp-dashboard-api.azurewebsites.net
```

### Local Development

```bash
# Backend (port 3001)
cd backend && npm install && node src/server.js

# Frontend (port 5173)
cd frontend && npm install && npm run dev
```

---

## 6. Database Tables

### `CustomerOverview`
Main booking table for Solmar, Interbus, and Solmar DE datasets.

| Column | Description |
|---|---|
| BookingID | Booking identifier |
| Dataset | `Solmar` / `Interbus` / `Solmar DE` |
| Status | `DEF` (confirmed), `DEF-GEANNULEERD` (cancelled) |
| DepartureDate, ReturnDate, BookingDate | Dates |
| DepartureYear, DepartureMonth | Partitions |
| PAXCount, TotalRevenue | Metrics |
| LabelName, TransportType | Categorisation |

Used by: Overview tab KPIs, charts, and YoY comparison.

---

### `ST_Bookings`
Snowtravel dataset — uses different column names and status values.

| ST_Bookings Column | Equivalent |
|---|---|
| `travelFileId` | BookingID |
| `dateDeparture` / `dateReturn` / `creationTime` | DepartureDate / ReturnDate / BookingDate |
| `paxCount` / `totalPrice` | PAXCount / TotalRevenue |
| `ok` | DEF (confirmed) |
| `cancelled` | DEF-GEANNULEERD |

The Overview tab unions `CustomerOverview` and `ST_Bookings` together.

---

### `BUStrips`
Pendel (shuttle bus) aggregated data. **NOT automatically updated** — Samir must run `etl.usp_LoadBUStrips` to populate it.

Key columns: `StartDate`, `EndDate`, `NormalizedPendel`, `ORC/OFC/OPRE` (outbound Royal/First/Premium), `RRC/RFC/RPRE` (return classes), `OTotal/RTotal`, difference columns.

The dashboard's "Reload ETL" button triggers `usp_LoadBUStrips` via the `/reload-bustrips` endpoint.

---

### `FeederOverview`
Feeder route stop-level data. Rebuilt via `dbo.usp_RebuildFeederOverview`.

Key columns: `DepartureDate`, `LabelName`, `FeederLine`, `RouteNo`, `RouteLabel`, `StopName`, `StopType`, `Direction`, `TotalPax`, `BookingCount`.

> ⚠️ Feeder PAX counts will **not** match pendel/deck PAX — they measure different things. Feeder counts PAX per pickup stop; pendel counts bus capacity per trip.

---

### `solmar_bus_bookings_modified`
Bus bookings for Bus KPI cards and Deck view filters.

| Column | Values |
|---|---|
| Status | `DEF` / `TIJD` / `VERV` / `DEF-GEANNULEERD` |
| Outbound_Class | `RC` (Royal Class), `FC` (First Class), `PRE` (Premium), `Comfort Class` |
| Outbound_Deck | Contains `Onderdek` (Lower), `Bovendek` (Upper), or `Geen` (None) |

---

### `solmar_bus_deck_choice`
Deck and class distribution pivot data. Uses class codes `RC/FC/PRE`. Deck values have trailing spaces — **always use `LTRIM(RTRIM())`**.

---

### `solmar.MarginOverview`
Purchase obligations per booking. Schema is `solmar`, not `dbo`.

Key columns: `BookingID`, `StatusCode`, `DepartureDate`, `PAX`, `TravelType`, `Label`, `SalesBooking`, `PurchaseCalculation`, `PurchaseObligation`, `Margin`, `Commission`, `MarginIncludingCommission`.

> ⚠️ `TravelType` value `"ownTransport"` must be normalised to `"own transport"` (lowercase with space).

---

### `dbo.BookingElementMarginOverview`
Purchase obligations broken down by element category: Coach, Hotel, Flight, Transfer, Other, Service Line.

---

### `dbo.BookingElementItems`
Source for the Flights tab. Filtered by `ElementTypeCode = 'VLUCHT'`. Route codes like `EIN_BCN` are split at the underscore. PAX deduplication uses `MAX(Quantity)` per `BookingId + ElementCode + ElementStartDate`.

---

### `dbo.CustomerTrips`
Source for BUStrips ETL. Columns: `TripType` (Heen/Terug), `Pendel`, `SeatType`, `PAX`, `BusStartDate`, `BusEndDate`, `Status`, `PickupLocation`, `DropoffLocation`.

---

### `HotelRatings` / `HotelReviews`
Hotel rating snapshots and individual reviews from the TravelTrustIt API.

---

### `dbo.users`
User accounts in Azure SQL (migrated from `users.json` because Azure App Service resets the file system on every deploy).

Columns: `id`, `username`, `password` (bcrypt hash), `role` (admin/viewer), `name`, `email`, `totp_secret`, `totp_enabled`.

---

## 7. Critical Data Rules

> Getting these wrong breaks the numbers. Read carefully.

### Status values per table

| Table | Confirmed | Cancelled | Other |
|---|---|---|---|
| CustomerOverview | `DEF` | `DEF-GEANNULEERD` | — |
| ST_Bookings | `ok` | `cancelled` | — |
| Bus tables | `DEF` | `DEF-GEANNULEERD` | `TIJD`, `VERV` |
| BookingElementItems | `DEF` | `DEF-GEANNULEERD` | `VERV`, `TIJD`, `IN_AANVRAAG`, `ACC AV NIET OK` |

### Dataset mapping

| UI Dataset | Source |
|---|---|
| Solmar | `CustomerOverview WHERE Dataset='Solmar'` |
| Interbus | `CustomerOverview WHERE Dataset='Interbus'` |
| Solmar DE | `CustomerOverview WHERE Dataset='Solmar DE'` |
| Snowtravel | `ST_Bookings` (separate table entirely) |

### Other critical rules

- **Deck column mapping:** Lower = `LIKE '%Onderdek%' AND NOT LIKE '%Geen%'`. Upper = `LIKE '%Bovendek%' AND NOT LIKE '%Geen%'`. No Deck = `LIKE '%Geen%' OR IS NULL`.
- **NormalizedPendel** is stored without prefix but displayed with `H-` prefix in UI.
- **FeederOverview trailing spaces:** Always use `LTRIM(RTRIM(FeederLine))`.
- **YoY logic:** Backend loads `selectedYears + (y-1) + (y-2)` so the Previous column always has data.
- **Pendel grouping:** Always group by date only — never split by pendel name. Robbert's requirement.
- **2026 deck Lower/Upper showing zero:** Expected — Samir's pipeline hasn't populated 2026 yet.
- **Formatting locale:** All numbers use `nl-BE` (dots as thousand separators, comma for decimals). Currency: `€10.000` format.
- **TravelType normalisation:** `"ownTransport"` → `"own transport"` in `solmar.MarginOverview`.

---

## 8. Authentication & Security

### Login flow (2FA)

```
1. User enters username + password
2. Backend verifies bcrypt hash against users table
3a. First login / 2FA not set up:
    → Returns { needsSetup: true, tempToken }
    → Frontend shows QR code for Microsoft Authenticator
    → User scans and enters 6-digit code
    → 2FA activated, full JWT issued
3b. Subsequent logins:
    → Returns { needs2FA: true, tempToken }
    → User enters authenticator code
    → Backend verifies via speakeasy TOTP
    → Full JWT issued (8h expiry)
```

### Token storage

Tokens are stored in `sessionStorage` **only** (not localStorage). Closing the tab clears the session.

Temporary tokens (2FA flow): 10-minute expiry, `temp: true` flag.

### Idle timeout

30 minutes of inactivity → 2-minute countdown modal. User can click "Stay Signed In" or auto-logs out. Tracked events: `mousemove`, `mousedown`, `keydown`, `touchstart`, `scroll`, `click`.

### Role-based access

| Role | Accessible Tabs |
|---|---|
| Admin | All tabs including Settings |
| Viewer | Overview, Bus Occupancy, Purchase Obligations |

### 2FA implementation note

Uses `speakeasy` npm package (not `otplib` — that caused ESM import issues on Azure). Import style:

```javascript
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
```

TOTP verification uses `window: 1` for ±30 second tolerance.

---

## 9. Dashboard Tabs

### Overview Tab

- **KPI cards:** Total Bookings, Total PAX, Gross Revenue with previous period comparison and diff%
- **Charts:** Revenue by Year (SVG line chart), Bookings/PAX by Month (grouped bar chart with toggle)
- **YoY table:** Period, Current, Previous, Difference, Diff%
- **Filters:** Dataset, Status, Year, Departure dates, Booking dates, Quick presets (Solmar FY Dec–Nov, Snowtravel FY Jul–Jun)
- **CSV export** of YoY table

---

### Bus Occupancy Tab

Three sub-views with a shared sidebar filter.

**Pendel Overview** — data from `BUStrips`. Grouped by StartDate/EndDate. Shows outbound vs inbound per class with difference columns. "Reload ETL" triggers `usp_LoadBUStrips`.

**Deck & Class** — data from `solmar_bus_bookings_modified` (KPIs) and `solmar_bus_deck_choice` (pivot). 7 KPI cards: Total PAX, Royal/First/Premium/Comfort, Lower/Upper/No Deck. Summary table with breakdown and percentages.

**Feeder Routes** — data from `FeederOverview`. Pivot: routes as rows, dates as columns, PAX as values. "Reload ETL" triggers `usp_RebuildFeederOverview`.

**Sidebar filters:** Date range (with year quick buttons), Status, Label, Pendel (cascading from Label), Region (Deck only), Weekday, Feeder Line (Feeder only).

---

### Purchase Obligations Tab

**Booking Summary** — from `solmar.MarginOverview`. 10 KPI cards. Detail table per booking with all financial columns. Filters: Departure dates, Status, Label, Travel Type. Paginated with search. CSV export.

**Element Breakdown** — from `dbo.BookingElementMarginOverview`. 7 KPI cards. Per-category cards (Coach, Hotel, Flight, Transfer, Other, Service Line). Monthly pivot table with Sales + Margin per category. CSV export.

---

### Hotel Insights Tab

**Hotel Overview** — 4 KPIs: Hotels, Bookings, Total PAX, Total Margin. Sortable table with YoY columns. Filters: Departure dates, Booking dates, Destination, Transport, Status. CSV export.

**Hotel Reviews** — from `HotelRatings` + `HotelReviews`. 4 KPIs: Hotels Tracked, Total Reviews, Avg Rating, High Rated. Clickable ratings table filters reviews by hotel. Review cards with category breakdowns (Sleep, Location, Cleanliness, Service, Facilities) and score bars.

---

### Flights Tab

- **Source:** `BookingElementItems WHERE ElementTypeCode='VLUCHT'`
- **KPIs:** Total PAX, Total Revenue, Routes
- **Chart:** Grouped bar chart — PAX by month per year
- **Table:** Route, Route Name, From, To, Flight Date, Status, PAX, Revenue
- **Filters:** Departure airports, Arrival airports, Status, Date range
- **Note:** Snowtravel bookings show €0 revenue (they live in `ST_Bookings`, not `CustomerOverview`)

---

### Settings Tab (Admin only)

Five sub-tabs:
- **User Management** — search, role filter, edit/delete users, add user form
- **API Status** — endpoint testing and system info
- **Data Refresh** — per-table manual/scheduled refresh buttons and status
- **AI Prompts** — custom system prompt editor
- **Email Alerts** — toggle, recipient, threshold configuration

---

## 10. API Reference

**Base URL:** `https://ttp-dashboard-api.azurewebsites.net`  
All routes require: `Authorization: Bearer <token>`

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Returns token or starts 2FA flow |
| POST | `/api/auth/setup-2fa` | Generates QR code |
| POST | `/api/auth/confirm-2fa` | Activates 2FA |
| POST | `/api/auth/verify-2fa` | Verifies returning user code |
| POST | `/api/auth/change-password` | Requires `currentPassword` + `newPassword` |

### Overview

| Method | Endpoint | Description |
|---|---|---|
| GET | `/kpis` | 3 KPIs with previous/diff |
| GET | `/revenue-by-year` | Monthly data per year |
| GET | `/year-month-comparison` | YoY rows |
| GET | `/slicers` | Datasets, years, statuses |

### Bus

| Method | Endpoint | Description |
|---|---|---|
| GET | `/bus-slicers` | Pendels, deckPendels, regions, statuses, feederLines, feederLabels, pendelByLabel |
| GET | `/bus-kpis` | 7 bus metrics |
| GET | `/pendel-overview` | BUStrips rows |
| GET | `/deck-class` | Deck pivot rows |
| GET | `/feeder-overview` | Feeder stop rows |
| GET | `/reload-bustrips` | Triggers ETL |
| GET | `/reload-feeder` | Triggers feeder ETL |

### Purchase

| Method | Endpoint | Description |
|---|---|---|
| GET | `/margin-overview` | KPIs + paginated detail rows |
| GET | `/margin-slicers` | Filter options |
| GET | `/element-margin-overview` | KPIs + category breakdown + trend + detail rows |

### Hotel

| Method | Endpoint | Description |
|---|---|---|
| GET | `/hotel-overview` | KPIs + paginated sortable rows |
| GET | `/hotel-slicers` | Filter options |
| GET | `/hotel-ratings` | Rating data |
| GET | `/hotel-reviews` | Paginated with search/filter |
| GET | `/hotel-stats` | Aggregate stats |

### Flights

| Method | Endpoint | Description |
|---|---|---|
| GET | `/flight-slicers` | Departures, arrivals, statuses arrays |
| GET | `/flights` | Filtered route + date + PAX + revenue rows |

### Users (Admin)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/users` | All users |
| POST | `/users` | Create user |
| PUT | `/users/:id` | Update user |
| DELETE | `/users/:id` | Delete user |

### Settings

| Method | Endpoint | Description |
|---|---|---|
| GET | `/settings` | Load settings |
| POST | `/settings` | Save settings |

---

## 11. SQL Query Patterns

### Overview queries

Use `UNION ALL` of `CustomerOverview` + `ST_Bookings` with different column mappings via the `overviewUnionSql` function. Status mapping: frontend sends `"ok"/"cancelled"`, backend maps to appropriate per-table values.

### Bus queries

Use `buildBusWhere(q)` which reads status directly from raw query params (not from `parseFilters`) because the status format differs between bus and overview tables.

### Flight route splitting

```sql
-- Departure (left of first underscore)
LEFT(ElementCode, CHARINDEX('_', ElementCode) - 1)

-- Arrival (right of LAST underscore — handles multi-underscore codes)
RIGHT(ElementCode, CHARINDEX('_', REVERSE(ElementCode)) - 1)
```

> ⚠️ Using simple `CHARINDEX` for arrival breaks on multi-underscore codes like `EIN_BCN_X`. Always use the `REVERSE` trick.

### Pendel/Feeder ETL pattern

Before querying, call the stored procedure with status params, wait for completion, then query the refreshed table. This happens on every request to `pendel-overview` and `feeder-overview`.

### Hotel overview

Joins booking data to get per-hotel aggregations with current vs previous year. Supports server-side sorting via `sort` and `dir` params.

---

## 12. Frontend Patterns

### Single file architecture

Everything is in `src/App.jsx`. Component order:

```
Utility functions
→ Shared components (Badge, Card, Btn, LineChart, BarChart, KpiCard)
→ Login
→ OverviewTab
→ BusTab
→ PurchaseTab
→ HotelTab
→ FlightsTab
→ UserTable        ← must be defined BEFORE SettingsTab
→ SettingsTab
→ App
```

### Color system

All colors in the `S` object. Dark theme with deep blue accent `#1a56db`.

Year colors (`YC`):

| Year | Color |
|---|---|
| 2023 | `#10b981` |
| 2024 | `#8b5cf6` |
| 2025 | `#f97316` |
| 2026 | `#3b82f6` |

### Auth helpers

```javascript
saveAuth()   // saves to sessionStorage with 8h expiry timestamp
loadAuth()   // reads from sessionStorage, auto-expires after 8h
clearAuth()  // removes from sessionStorage
```

### API helper

```javascript
async function api(path, params, token)
// Arrays: qs.append() for multi-select
// Single values: qs.set()
// Adds Bearer token header, throws on non-OK
```

### Filter pattern

Each tab manages its own filter state. "Apply Filters" triggers a data reload. "Reset" clears all filters and reloads defaults.

### Formatting helpers

| Function | Output |
|---|---|
| `fmtM(v)` | `€1.23M` / `€456.7K` / `€123` |
| `fmtN(v)` | nl-BE number with dots (e.g. `10.000`) |
| `fmtEur(v)` | `€1.234,56` with 2 decimals |
| `fmtPct(v)` | `+12.3%` / `-5.6%` |
| `dc(v)` | Green if positive, red if negative |

### ⚠️ Critical: SettingsTab sub-tab state

`SettingsTab` uses `stab`/`setStab` for internal sub-tab state — **not** `tab`/`setTab`. Using `tab` would shadow the parent App's navigation state and silently break sub-tab switching. This was a recurring bug.

### ⚠️ Critical: UserTable is a standalone component

`UserTable` must be a proper named function component defined **before** `SettingsTab`. An IIFE pattern causes React error #300 (hooks called inside a non-component function).

---

## 13. Deployment

### Frontend → GitHub Pages

Push to `main` branch. GitHub Actions auto-deploys in ~2 minutes.

```bash
cd C:\Project\frontend
git add src/App.jsx
git commit -m "your message"
git push
```

The correct workflow file is `.github/workflows/github-pages.yml` using `peaceiris/actions-gh-pages@v3` with `publish_dir: ./frontend/dist`.

> ⚠️ Multiple conflicting workflow files in `.github/workflows/` have caused GitHub Pages breakages before. Only `github-pages.yml` should be active.

### Backend → Azure App Service

```bash
cd C:\Project\backend
git add .
git commit -m "your message"
git push azure master
```

Deploys in 30–60 seconds.

**If git push fails with an auth error**, use ZIP deploy:

```bash
az login
az webapp deployment source config-zip \
  --resource-group datafactory \
  --name ttp-dashboard-api \
  --src backend.zip
```

> ⚠️ Backend deploys via `git push azure master` ONLY — not GitHub Actions.  
> ⚠️ Azure App Service resets the file system on every deploy. This is why user accounts live in Azure SQL, not a JSON file.

### Checking deployment health

```
GET https://ttp-dashboard-api.azurewebsites.net/health
```

Or: Azure Portal → App Service → Log Stream for errors.  
Or: GitHub repo → Actions tab for frontend deploy status.

---

## 14. ETL & Stored Procedures

### `etl.usp_LoadBUStrips`

Source: `dbo.CustomerTrips`

Parameters:
- `@Statuses` — comma-separated, optional
- `@ExcludedStatuses` — default: `VERV,DEF-GEANNULEERD`

Logic: Truncates `BUStrips`, rebuilds from `CustomerTrips`. Filters by `Label IN ('STANDAARD', 'DEU')` and `TravelType='BUS'`. Groups outbound (Heen) and inbound (Terug) separately, matches them by `NormalizedPendel + date`, calculates differences.

---

### `dbo.usp_RebuildFeederOverview`

Same parameter pattern as BUStrips.

Parameters: `@FullReload`, `@Statuses`, `@ExcludedStatuses`, `@SnapshotDate`, `@FromDepartureDate`, `@ToDepartureDate`.

---

### Verify row counts

```sql
SELECT DepartureYear, COUNT(*) FROM CustomerOverview GROUP BY DepartureYear ORDER BY DepartureYear;
SELECT YEAR(dateDeparture) AS yr, COUNT(*) FROM ST_Bookings GROUP BY YEAR(dateDeparture);
SELECT COUNT(*) FROM solmar.MarginOverview;
SELECT COUNT(*) FROM dbo.BUStrips;
SELECT COUNT(*) FROM dbo.BookingElementMarginOverview;
SELECT COUNT(*) FROM dbo.FeederOverview;
```

---

## 15. Known Bugs & Fixes

| Bug | Root Cause | Fix |
|---|---|---|
| **React error #300** | `useState` called inside an IIFE instead of a proper component | Extract as a named function component (UserTable) |
| **Settings sub-tabs not switching** | `const[tab,setTab]` inside SettingsTab shadows parent App's `tab` | Rename to `stab`/`setStab` inside SettingsTab |
| **CORS error on API calls** | Azure Portal CORS settings conflicting with Node.js CORS | Delete ALL entries in Azure Portal → App Service → CORS; let Node.js `cors()` handle it |
| **Rate limiter "Invalid IP address" crash** | Azure App Service sends `x-forwarded-for` header that the rate limiter can't parse | Add `validate: { xForwardedForHeader: false }` to rate limiter config |
| **Bus Occupancy 500 on deck-class/bus-kpis** | Status filter reading wrong variable (`f.statusBus` was empty) | Read status from raw query `q.status`, not from `parseFilters` |
| **YoY Previous column shows 0** | Backend only loaded selected years + previous, missing the year before previous | Load `selectedYears + (y-1) + (y-2)` |
| **Backend crash on startup** | `otplib` uses ESM modules incompatible with CommonJS on Azure Node.js | Switch to `speakeasy` package |
| **Feeder Label/Line slicers empty** | `ORDER BY LTRIM(RTRIM(FeederLine))` expression not in SELECT list | Use `ORDER BY FeederLine` directly |
| **Flight arrival slicer broken** | `CHARINDEX` finds first underscore on multi-underscore codes | Use `RIGHT(ElementCode, CHARINDEX('_', REVERSE(ElementCode)) - 1)` |
| **Chart tooltip crashes** | `e.target.closest("svg")` returns null in some browser states | Use `e.currentTarget.closest("svg") \|\| e.target.closest("svg")` with try/catch |
| **Bus data not loading (cold start)** | Azure free tier cold starts | Keep-alive ping added to `server.js` |
| **Duplicate UserTable code in SettingsTab** | Old IIFE pattern not fully removed after UserTable extraction | Delete everything between `<UserTable .../>` and its closing `</div>`, keep only the component call |
| **401 login errors** | Plain-text passwords in `users.json`, or file reset on Azure deploy | Migrate all users to Azure SQL with bcrypt-hashed passwords |
| **Pendel table shows "No data"** | `BUStrips` table is empty | Ask Samir to run `EXEC etl.usp_LoadBUStrips;`, verify with `SELECT MIN(StartDate), MAX(StartDate), COUNT(*) FROM dbo.BUStrips;` |
| **Purchase Obligations empty** | User didn't click "Apply Filters", or `solmar.MarginOverview` is empty | Click Apply Filters. Check `SELECT COUNT(*) FROM solmar.MarginOverview;` |

---

## 16. How to Make Changes

### Adding a new filter to an existing tab

1. Add state in the tab component
2. Add it to the filter bar JSX
3. Add it to the `buildParams` (or equivalent) function
4. Add it to the `reset` function
5. Add the corresponding WHERE clause in `dashboard.js`

### Adding a new KPI card

Add to the KPI card array in the JSX. The `KpiCard` component accepts: `label`, `current`, `previous`, `pct`, `fmt` (eur/num), `color`, `icon`.

### Adding a new table column

1. Add `<th>` to the header
2. Add `<td>` to the row map
3. If data doesn't exist in the API response, add the column to the SQL SELECT in `dashboard.js`

### Adding a new tab

1. Create the component function **before** the `App` function
2. Add to the `NAV` array in `App()` with `id`, `label`, `icon`
3. Add render condition: `{tab === "newid" && <NewTab token={token}/>}`
4. Create corresponding backend routes in `dashboard.js`

### Modifying a SQL query

Find the route in `dashboard.js`. Pattern:

```
parse query params → build WHERE clause → execute SQL → return JSON
```

Named parameters use `@paramName` syntax with the mssql driver.

### Adding a new stored procedure call

Follow the pendel/feeder ETL pattern: call the stored procedure with status params → wait for completion → query the refreshed table.

---

## 17. Emergency Reference

**Dashboard not loading at all?**
1. Check `https://ttp-dashboard-api.azurewebsites.net` responds
2. Azure Portal → App Service → Log Stream for errors
3. GitHub Actions → last deploy status

**All numbers showing 0?**
1. Login works → backend is up
2. Open browser Console for 500 or 401 errors
3. Test `GET /api/dashboard/kpis` with a valid token
4. Check Azure SQL connection in App Service Configuration

**Bus data not showing?**
1. `SELECT COUNT(*) FROM dbo.BUStrips;` — if 0, click "Reload ETL" or ask Samir to run the procedure
2. Check date filter range

**Login not working?**
1. Check `JWT_SECRET` env var is set in Azure App Service
2. Verify users table has bcrypt-hashed passwords (not plain text)
3. Check CORS (Azure Portal CORS should be empty; let Node.js handle it)

**Settings sub-tabs not switching?**
→ Verify `stab`/`setStab` is used inside SettingsTab, not `tab`/`setTab`

**React error #300 on Settings?**
→ Check UserTable is a proper named function component defined before SettingsTab, with no IIFE patterns containing hooks

---

## 18. Contacts & Access

| Name | Role | Responsibility |
|---|---|---|
| Abdul Rahman | Developer | Frontend + Backend code |
| Samir Al Gnabi | Data Analyst | Azure SQL, ETL pipelines, stored procedures |
| Robbert Jan Tel | IT Head / Product Owner | Requirements and approvals |

| Resource | URL |
|---|---|
| Dashboard | https://ttp-services.github.io/TTP-DASHBOARD/ |
| Backend API | https://ttp-dashboard-api.azurewebsites.net |
| GitHub Repo | https://github.com/ttp-services/TTP-DASHBOARD |
| Azure Portal | https://portal.azure.com → Resource Group: `datafactory` |

---

*TTP Services Middle East · CAPREALEO GROUP · Dubai / Belgium*
