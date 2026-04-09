# TTP Analytics Dashboard — Full Technical Documentation

> **Version:** v2.1 · Data Engine  
> **Company:** TTP Services Middle East · CAPREALEO GROUP · Dubai / Belgium  
> **Last Updated:** April 2026  
> **Maintained by:** Abdul Rahman (Developer)  
> **Data Engineer:** Samir Al Gnabi  
> **Product Owner:** Robbert Jan Tel  

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

> ⚠️ **CRITICAL:** CustomerOverview uses Dutch statuses (`DEF`/`DEF-GEANNULEERD`). ST_Bookings uses English (`ok`/`cancelled`). Always handle both.

#### solmar_bus_bookings_modified
Bus bookings table — used for Bus KPI cards and Deck view filters.

| Column | Type | Notes |
|---|---|---|
| Booking_Number | nvarchar | |
| Status | nvarchar | `DEF` / `TIJD` / `VERV` / `DEF-GEANNULEERD` / etc |
| PAX | int | |
| Outbound_Class | nvarchar | `Royal Class` / `First Class` / `Premium Class` / `Comfort Class` |
| Outbound_Deck | nvarchar | Contains `Onderdek` (Lower) / `Bovendek` (Upper) / `Geen` (None) |
| dateDeparture | date | |
| Label | nvarchar | `STANDAARD` / `DEU` / `ITB` |
| Region | nvarchar | |

#### solmar_bus_deck_choice
Deck and class distribution — used for Deck & Class pivot table.

Same structure as `solmar_bus_bookings_modified` but specifically for deck choice reporting.

#### BUStrips
Pendel (shuttle bus) aggregated table. **Managed by Samir's ETL stored procedure.**

| Column | Type | Notes |
|---|---|---|
| StartDate | date | Departure date |
| EndDate | date | Return date |
| Status | nvarchar | DEF / DEF-GEANNULEERD etc |
| ORC | int | Outbound Royal Class booked |
| OFC | int | Outbound First Class booked |
| OPRE | int | Outbound Premium booked |
| OTotal | int | Total outbound |
| RRC | int | Return Royal Class |
| RFC | int | Return First Class |
| RPRE | int | Return Premium |
| RTotal | int | Total return |
| RC_Diff | int | Royal class difference (out vs in) |
| FC_Diff | int | First class difference |
| PRE_Diff | int | Premium difference |
| Total_Difference | int | Total difference |

> ⚠️ **CRITICAL:** BUStrips is NOT updated automatically. Samir must run the stored procedure manually to populate it. See Section 14.

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

#### solmar.MarginOverview
Purchase obligations per booking. Schema: `solmar` (not `dbo`).

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

#### dbo.BookingElementMarginOverview
Purchase obligations broken down by element category (Coach, Hotel, Flight, etc).

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

#### HotelRatings
Hotel rating snapshots from TravelTrustIt API.

#### HotelReviews
Individual hotel reviews from TravelTrustIt API.

---

## 7. Backend — Node.js / Express

### Entry Point: `src/server.js`

```
- Sets up Express
- Enables CORS (handles all origins)
- Rate limiter: validate.xForwardedForHeader = false  ← IMPORTANT for Azure
- Mounts /api/auth router
- Mounts /api/dashboard router (JWT protected)
- Listens on PORT env var or 3001
```

### Database Helper: `src/db/azureSql.js`

```javascript
// Simple query wrapper
export async function query(sql, params = {}) {
  // connects to Azure SQL
  // executes sql with named params (@paramName)
  // returns { recordset: [...rows] }
}
```

### Auth: `src/routes/auth.js`

```
POST /api/auth/login
  Body: { username, password }
  Returns: { token, user: { username, role } }
  
- Reads users from data/users.json
- Compares bcrypt hash
- Returns JWT (24h expiry)
```

### Main Routes: `src/routes/dashboard.js`

All routes are protected by JWT middleware. See Section 10 for full API reference.

#### Key Functions in dashboard.js

**`parseFilters(q)`** — Parses all query params into a clean filter object. Handles arrays for multi-select filters.

```javascript
// Returns:
{
  dataset: [],          // array of dataset names
  status: [],           // array of status values
  year: [],             // array of years (numbers)
  departureDateFrom: '',
  departureDateTo: '',
  bookingDateFrom: '',
  bookingDateTo: '',
  label: [],            // array — Solmar / Solmar DE / Interbus
  travelType: [],       // array — BUS / FLIGHT / OWN TRANSPORT etc
  statusBus: '',        // single string for bus filter
  // ...more
}
```

**`buildOverviewWhere(filters, opts)`** — Builds WHERE clause for CustomerOverview + ST_Bookings queries. Handles both tables with different column names.

**`overviewUnionSql(whereObj)`** — Creates UNION ALL of CustomerOverview + ST_Bookings.

**`buildBusWhere(q)`** — Builds WHERE clause for bus tables (`solmar_bus_bookings_modified`, `solmar_bus_deck_choice`).

**`cleanUnion(parts)`** — Safely joins SQL UNION parts, returns empty result if no valid parts.

---

## 8. Frontend — React / Vite

### Single File Architecture

The entire frontend is in **one file: `src/App.jsx`**. This was a deliberate choice for simplicity and to avoid import/deployment complexity.

### Key Constants

```javascript
const BASE = import.meta.env?.VITE_API_URL || "https://ttp-dashboard-api.azurewebsites.net";
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DATASETS = ["Solmar","Interbus","Solmar DE","Snowtravel"];
const YEARS = [2023,2024,2025,2026];
const YC = {2023:"#10b981", 2024:"#8b5cf6", 2025:"#f97316", 2026:"#3b82f6"};
```

### Color System (S object)

All colors are in a single `S` object:
```javascript
const S = {
  bg: "#f0f5ff",          // page background
  card: "#ffffff",        // card background
  accent: "#1a56db",      // primary blue
  success: "#059669",     // green
  danger: "#dc2626",      // red
  warn: "#d97706",        // orange/amber
  purple: "#7c3aed",      // purple
  // ...more
}
```

### Auth System

```javascript
// Saves to both localStorage AND sessionStorage (fallback)
saveAuth(token, user)

// Loads from localStorage first, then sessionStorage
// Auto-expires after 30 days
loadAuth()

// Clears both storages
clearAuth()
```

### API Helper

```javascript
async function api(path, params = {}, token) {
  // Builds URLSearchParams
  // Arrays → multiple qs.append(k, v) calls (for multi-select)
  // Single values → qs.set(k, v)
  // Adds Bearer token header
  // Throws on non-OK response
}
```

### Component Structure

```
App()                    ← Root, handles auth + navigation
├── Login()              ← Login form
├── OverviewTab()        ← Overview page
│   ├── LineChart()      ← SVG revenue line chart
│   └── BarChart()       ← SVG bookings/PAX bar chart
├── BusTab()             ← Bus Occupancy page
│   └── ElementMarginChart()  ← (legacy, replaced by pivot table)
├── PurchaseTab()        ← Purchase Obligations page
└── SettingsTab()        ← Settings page
```

### Formatting Helpers

```javascript
fmtM(v)    // formats to €1.23M / €456.7K / €123
fmtN(v)    // formats number with nl-BE locale (dots as thousand separators)
fmtEur(v)  // formats to €1.234,56 (2 decimal places)
fmtPct(v)  // formats to +12.3% or -5.6%
dc(v)      // returns green (#059669) if positive, red (#dc2626) if negative
```

---

## 9. Dashboard Tabs — Feature Guide

### Tab 1: Overview

**Purpose:** High-level KPIs and trend charts for all bookings.

**Data sources:**
- `CustomerOverview` (Solmar, Interbus, Solmar DE)
- `ST_Bookings` (Snowtravel)

**Features:**
- 3 KPI cards: Total Bookings, Total PAX, Gross Revenue (with Previous / Difference / Diff%)
- Revenue by Year — SVG line chart, one line per year, monthly x-axis
- Bookings/PAX by Month — SVG grouped bar chart, toggle between Bookings and PAX
- Year-on-Year Comparison table — Period, Current, Previous, Difference, Diff%
- Chip-based multi-select filters: Dataset, Status, Year, Departure dates, Booking dates, Quick presets
- CSV export of YoY table
- Fiscal year quick presets: Solmar FY (Dec–Nov), Snowtravel FY (Jul–Jun)

**YoY logic:** Backend loads `selectedYears + (y-1) + (y-2)` so Previous column always has data even when filtering.

---

### Tab 2: Bus Occupancy

**Purpose:** Analysis of Solmar bus trips — pendel, deck/class, feeder routes.

**Sub-tabs:**

#### Pendel Overview
- Data source: `dbo.BUStrips`
- Aggregated by StartDate/EndDate
- Shows: ORC, OFC, OPRE, Out Total, RRC, RFC, RPRE, In Total, Δ Royal, Δ First, Δ Premium, Δ Total
- **⚠️ BUStrips must be loaded by Samir manually** (see Section 14)
- Status filter does NOT apply here — BUStrips is pre-filtered by ETL

#### Deck & Class
- Data source: `solmar_bus_bookings_modified` (KPIs) + `solmar_bus_deck_choice` (pivot table)
- Shows: 8 KPI cards (Total PAX, Royal/First/Premium/Comfort, Lower/Upper/No Deck)
- Pivot table: per departure date, all classes × all decks
- Status filter DOES apply here

#### Feeder Routes
- Data source: `FeederOverview`
- Shows: Pivot table — routes as rows, dates as columns, PAX as values
- Each route shows total row + individual stop rows

**Sidebar filters:** Date From/To, Label, Status, Pendel, Region, Weekday, Feeder Line

---

### Tab 3: Purchase Obligations

**Purpose:** Finance team's view of margins, commissions, and supplier obligations.

#### Booking Summary
- Data source: `solmar.MarginOverview`
- 9 KPI cards: Total Bookings, Confirmed, Cancelled, Total PAX, Total Sales, Net Margin, Commission, Obligations, Margin+Commission
- Detail table: per booking with all financial columns
- Filters: Departure dates, Status (DEF/DEF-GEANNULEERD), Label, Travel Type (all chip multi-select)
- CSV export

#### Element Breakdown
- Data source: `dbo.BookingElementMarginOverview`
- 6 KPI cards: Total Bookings, PAX, Sales, Net Margin, Commission, Commission %
- Per-category cards: Coach, Hotel, Flight, Transfer, Other, Service Line
- Monthly pivot table: Sales + Margin per category per month + totals row
- Full detail table with all element rows
- Filters: Departure dates, Status, Label, Year (chip multi-select)
- CSV export

---

### Tab 4: Settings (Admin only)

- User Management: create, delete, change role (viewer/admin)
- API Status: test each backend endpoint
- AI Prompts: custom system prompt for TTP AI tab
- Email Alerts: threshold-based alerts configuration

---

## 10. API Reference

Base URL: `https://ttp-dashboard-api.azurewebsites.net`

All routes require: `Authorization: Bearer <token>`

### Auth

```
POST /api/auth/login
Body: { username: string, password: string }
Response: { token: string, user: { username, role } }
```

### Overview

```
GET /api/dashboard/kpis
Params: dataset[], status[], year[], departureDateFrom, departureDateTo, bookingDateFrom, bookingDateTo
Response: { currentBookings, previousBookings, percentBookings, currentPax, previousPax, percentPax, currentRevenue, previousRevenue, percentRevenue, periodLabel, prevLabel }

GET /api/dashboard/revenue-by-year
Same params as kpis
Response: [{ year, month, bookings, pax, revenue }]

GET /api/dashboard/year-month-comparison
Same params as kpis
Response: [{ currentYear, previousYear, month, currentBookings, previousBookings, diffBookings, diffPctBookings, currentPax, previousPax, diffPax, diffPctPax, currentRevenue, previousRevenue, diffRevenue, diffPctRevenue }]

GET /api/dashboard/slicers
Response: { datasets[], years[], statuses[] }
```

### Bus Occupancy

```
GET /api/dashboard/bus-slicers
Response: { pendels[], regions[], statuses[], statusesEnglish[], feederLines[] }

GET /api/dashboard/bus-kpis
Params: dateFrom, dateTo, status, label, region, pendel, weekday
Response: { total_pax, royal_pax, first_pax, premium_pax, comfort_pax, lower_pax, upper_pax, no_deck_pax }

GET /api/dashboard/pendel-overview
Params: dateFrom, dateTo, weekday, status
Response: [{ StartDate, EndDate, ORC, OFC, OPRE, Outbound_Total, RRC, RFC, RPRE, Inbound_Total, Diff_Royal, Diff_First, Diff_Premium, Diff_Total }]

GET /api/dashboard/deck-class
Params: dateFrom, dateTo, status, label, region, pendel, weekday
Response: [{ dateDeparture, Total, Total_Lower, Total_Upper, Total_NoDeck, Royal_Total, Royal_Lower, ... }]

GET /api/dashboard/feeder-overview
Params: dateFrom, dateTo, feederLine, label, direction
Response: [{ DepartureDate, LabelName, FeederLine, RouteNo, RouteLabel, StopName, StopType, Direction, TotalPax, BookingCount }]
```

### Purchase Obligations

```
GET /api/dashboard/margin-overview
Params: departureFrom, departureTo, status (ok/cancelled), label[], travelType[], page, limit
Response: { kpis: { totalBookings, totalSales, totalPurchase, totalObligation, totalMargin, totalCommission, totalMarginIncludingCommission, confirmedCount, cancelledCount, totalPax }, data: [...rows], totalRows, page, limit }

GET /api/dashboard/margin-slicers
Response: { minDeparture, maxDeparture, statuses[], travelTypes[] }

GET /api/dashboard/element-margin-overview
Params: departureFrom, departureTo, status, label[], dataset, year[], page, limit
Response: { kpis: {...}, byCategory: [...], trend: [...], data: [...rows], totalRows, page, limit }
```

### Hotel

```
GET /api/dashboard/hotel-ratings
Response: [{ accommodation_code, accommodation_name, avg_overall, avg_sleep, avg_location, avg_cleanliness, avg_service, avg_facilities, total_reviews, recommendation_pct }]

GET /api/dashboard/hotel-reviews
Params: code, country, minRating, page, limit
Response: { rows: [...], total, page, limit }

GET /api/dashboard/hotel-stats
Response: { total_hotels, total_reviews, avg_rating, high_rated, low_rated, latest_review }
```

### User Management (Admin only)

```
GET    /api/dashboard/users
POST   /api/dashboard/users       Body: { username, password, role, name, email }
PUT    /api/dashboard/users/:id   Body: { role?, password? }
DELETE /api/dashboard/users/:id
```

### Settings

```
GET  /api/dashboard/settings
POST /api/dashboard/settings   Body: { aiPrompt, emailAlerts: { enabled, recipients, ... } }
```

---

## 11. Data Rules — Critical

> These rules are non-negotiable. Getting them wrong causes wrong numbers in the dashboard.

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

### Dataset Mapping

| Dataset name | Source table |
|---|---|
| Solmar | `CustomerOverview` WHERE Dataset='Solmar' |
| Interbus | `CustomerOverview` WHERE Dataset='Interbus' |
| Solmar DE | `CustomerOverview` WHERE Dataset='Solmar DE' |
| Snowtravel | `ST_Bookings` |

### Travel Type Normalization

In `solmar.MarginOverview`, the value `"ownTransport"` must be normalized to `"own transport"` (lowercase with space) if needed.

### Pendel Table

- `BUStrips` is **NOT automatically updated**
- It is populated by Samir running `etl.usp_LoadBUStrips`
- Default run excludes `VERV` and `DEF-GEANNULEERD`
- Status filter on the dashboard sidebar does NOT filter `BUStrips` — it only filters `solmar_bus_bookings_modified` and `solmar_bus_deck_choice`

### Deck Column Mapping (solmar_bus_bookings_modified)

```sql
Lower Deck:  Outbound_Deck LIKE '%Onderdek%' AND Outbound_Deck NOT LIKE '%Geen%'
Upper Deck:  Outbound_Deck LIKE '%Bovendek%' AND Outbound_Deck NOT LIKE '%Geen%'
No Deck:     Outbound_Deck LIKE '%Geen%' OR Outbound_Deck IS NULL
```

---

## 12. Deployment Guide

### Frontend (GitHub Pages)

Frontend auto-deploys via GitHub Actions when you push to `main`.

**Manual deploy:**
```bash
cd C:\Project\frontend
git add src/App.jsx
git commit -m "your message"
git push
# GitHub Actions runs automatically → deploys to GitHub Pages in ~2 min
```

**Check deploy status:** Go to GitHub repo → Actions tab

**Live URL:** `https://ttp-services.github.io/TTP-DASHBOARD/`

---

### Backend (Azure App Service)

Backend deploys via Git push to Azure remote.

**Manual deploy:**
```bash
cd C:\Project\backend
git add src/routes/dashboard.js   # or whichever files changed
git commit -m "your message"
git push azure master
# Deploys in ~30-60 seconds
```

**If git push fails (auth error):**
```bash
# Use ZIP deploy instead
cd C:\Project\backend
az login
az webapp deployment source config-zip \
  --resource-group datafactory \
  --name ttp-dashboard-api \
  --src backend.zip
```

**Set upstream if needed:**
```bash
git branch --set-upstream-to=azure/master master
```

**Check if backend is running:**
```
https://ttp-dashboard-api.azurewebsites.net/api/dashboard/kpis
```
Should return JSON (may need auth token).

**Azure Portal:**
- Resource Group: `datafactory`
- App Service: `ttp-dashboard-api`
- Region: West Europe

---

## 13. Known Errors & Fixes

### Error: Bus Occupancy → 500 on deck-class / bus-kpis

**Symptom:** Console shows `Failed to load resource: 500` for `deck-class` and `bus-kpis` endpoints.

**Cause:** Status filter sending wrong format — `q.status` was being read as `f.statusBus` which was empty.

**Fix in `dashboard.js` `buildBusWhere`:**
```javascript
// Read status directly from raw query, not from parseFilters
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

### Error: `SyntaxError: Identifier 'Router' has already been declared`

**Symptom:** Backend crashes on startup.

**Cause:** Duplicate `import { Router }` in dashboard.js.

**Fix:** Remove duplicate import — keep only one at the top of the file.

---

### Error: CORS error on API calls

**Symptom:** Browser blocks API calls with CORS error.

**Cause:** Azure Portal CORS settings conflicting with Node.js CORS.

**Fix:**
1. Go to Azure Portal → App Service → CORS
2. Delete ALL entries there (leave it empty)
3. Let Node.js handle CORS in `server.js` with `cors()` middleware

---

### Error: Rate limiter — Invalid IP address

**Symptom:** Backend logs `Error: Invalid IP address` and crashes.

**Cause:** Azure App Service sends `x-forwarded-for` header that the rate limiter can't parse.

**Fix in `server.js`:**
```javascript
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  validate: { xForwardedForHeader: false }  // ← This line fixes it
}));
```

---

### Error: YoY "Previous" column shows 0 or —

**Symptom:** When filtering by year 2025, the "Previous" column shows 0 or — for many rows.

**Cause:** Backend only loaded `[2025, 2024]` years, but 2024 rows need 2023 to show their "previous".

**Fix in `dashboard.js` year-month-comparison route:**
```javascript
// Load 3 years: selected + previous + the one before
const loadYears = uniq([
  ...selectedYears,
  ...selectedYears.map(y=>y-1),
  ...selectedYears.map(y=>y-2)
]);
```

---

### Error: Chart tooltip crashes

**Symptom:** Clicking/hovering on chart dots causes JavaScript error.

**Cause:** `e.target.closest("svg")` returns null in some browser states.

**Fix:**
```javascript
onMouseEnter={e=>{
  try {
    const sv = e.currentTarget.closest("svg") || e.target.closest("svg");
    if (!sv) return;
    const rc = sv.getBoundingClientRect();
    // ... rest of tooltip logic
  } catch {}
}}
```

---

### Error: Backend startup crash — `users.js` not found

**Symptom:** Backend crashes on startup with module not found error.

**Cause:** `server.js` imports `users.js` but file doesn't exist or is not a proper Express router.

**Fix:** Ensure `src/routes/auth.js` exists and exports a valid Express Router.

---

### Error: Pendel table shows "No data"

**Symptom:** Pendel Overview table is empty even with correct date range.

**Cause:** `BUStrips` table is empty — Samir has not run the ETL procedure.

**Fix:** Ask Samir to run:
```sql
EXEC etl.usp_LoadBUStrips;
```
Then verify:
```sql
SELECT MIN(StartDate), MAX(StartDate), COUNT(*) FROM dbo.BUStrips;
```

---

### Error: solmar.MarginOverview has 0 rows

**Symptom:** Purchase Obligations → Booking Summary shows 0 for everything.

**Cause:** Samir's pipeline has not yet loaded data into `solmar.MarginOverview`.

**Fix:** Check row count:
```sql
SELECT COUNT(*) FROM solmar.MarginOverview;
```
If 0, ask Samir to run the pipeline.

---

## 14. ETL & Samir's Procedures

### BUStrips — Pendel Data

Samir owns the stored procedure `etl.usp_LoadBUStrips`.

**How it works:**
- `@Statuses` — optional, comma-separated. If empty → accepts all except default excluded ones
- `@ExcludedStatuses` — optional. If empty → uses default excluded (VERV and DEF-GEANNULEERD)

**Run with defaults (DEF only, excludes VERV + DEF-GEANNULEERD):**
```sql
EXEC etl.usp_LoadBUStrips;
```

**Run with specific statuses:**
```sql
EXEC etl.usp_LoadBUStrips
    @Statuses = 'DEF, DEF-GEANNULEERD';
```

**Run with specific statuses AND override excluded:**
```sql
EXEC etl.usp_LoadBUStrips
    @Statuses = 'DEF, DEF-GEANNULEERD',
    @ExcludedStatuses = 'VERV, TEST';
```

**Verify result:**
```sql
SELECT Status, COUNT(*) AS cnt, MIN(StartDate) AS minDate, MAX(StartDate) AS maxDate
FROM dbo.BUStrips
GROUP BY Status;
```

**Format rules:**
- Use comma-separated values
- No brackets needed
- Spaces are fine

---

### Verifying Data Counts

```sql
-- Check CustomerOverview by year
SELECT DepartureYear, COUNT(*) FROM CustomerOverview GROUP BY DepartureYear ORDER BY DepartureYear;

-- Check ST_Bookings
SELECT YEAR(dateDeparture) AS yr, COUNT(*) FROM ST_Bookings GROUP BY YEAR(dateDeparture);

-- Check MarginOverview
SELECT COUNT(*) FROM solmar.MarginOverview;

-- Check BUStrips
SELECT COUNT(*) FROM dbo.BUStrips;

-- Check ElementMarginOverview
SELECT COUNT(*) FROM dbo.BookingElementMarginOverview;
```

---

## 15. Future Roadmap

### Planned Features

| Feature | Priority | Notes |
|---|---|---|
| Hotel Insights tab | High | Backend routes exist (`/hotel-ratings`, `/hotel-reviews`). Frontend view not built yet. |
| Data Table tab | Medium | Paginated table from CustomerOverview + ST_Bookings. Backend route `/bookings-table` exists. |
| TTP AI tab improvements | Medium | GPT-4o-mini with live DB context. Ask-one-clarifying-question logic. Needs refinement. |
| Dynamic Travel Type options in Purchase Obligations | Low | Currently hardcoded. Should fetch from `/margin-slicers` once data is consistent. |
| Hotel reviews ETL fix | Low | TravelTrustIt API ETL needs fixing by Samir. |
| Email alerts | Low | Settings UI exists. Backend logic not implemented. |
| Export improvements | Low | Currently CSV only. Excel export requested. |

### Data Gaps to Resolve

| Item | Owner | Status |
|---|---|---|
| `solmar.MarginOverview` empty rows | Samir | Pending pipeline run |
| 2026 deck Lower/Upper data showing zero | Samir | Expected — pipeline not yet run for 2026 |
| `CustomerOverview` 2025 data verification | Samir | Verify data completeness |
| `BUStrips` regular refresh schedule | Samir | Currently manual only |

---

## 📞 Contacts & Access

| Person | Role | Responsibility |
|---|---|---|
| Abdul Rahman | Developer | Frontend + Backend code |
| Samir Al Gnabi | Data Engineer | Azure SQL, ETL pipelines, stored procedures |
| Robbert Jan Tel | Manager / Product Owner | Feature requirements, UX decisions |

### Quick Access Links

| Resource | URL |
|---|---|
| Dashboard (live) | https://ttp-services.github.io/TTP-DASHBOARD/ |
| Backend API | https://ttp-dashboard-api.azurewebsites.net |
| GitHub Repository | https://github.com/ttp-services/TTP-DASHBOARD |
| Azure Portal | https://portal.azure.com → Resource Group: datafactory |

---

## 🆘 Emergency Fixes — Quick Reference

**Dashboard not loading at all?**
1. Check https://ttp-dashboard-api.azurewebsites.net — is it responding?
2. Check Azure Portal → App Service → Log Stream for errors
3. Check GitHub Actions → did the last deploy succeed?

**All numbers showing 0?**
1. Login works → backend is up
2. Open browser Console → look for 500 or 401 errors
3. Test: `GET /api/dashboard/kpis` with a valid token
4. Check Azure SQL connection in App Service Configuration

**Bus data not showing?**
1. Check `SELECT COUNT(*) FROM dbo.BUStrips;` — if 0, ask Samir to run the procedure
2. Check date filter — default is current year, BUStrips may have different date range

**Purchase Obligations showing empty?**
1. Click **Apply Filters** — data does not load automatically, user must click Apply
2. Check `SELECT COUNT(*) FROM solmar.MarginOverview;` — if 0, pipeline not loaded

**Login not working?**
1. Check `data/users.json` exists in backend deployment
2. Check JWT_SECRET environment variable is set in Azure App Service Configuration

---

*This documentation is maintained by Abdul Rahman. Last updated: April 2026.*
*For questions: contact Abdul Rahman or Robbert Jan Tel.*
