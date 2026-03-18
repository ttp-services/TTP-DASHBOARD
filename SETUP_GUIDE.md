# TTP Services Dashboard – Step-by-Step Setup Guide

This guide walks you through building and deploying a **secure**, **user-friendly** dashboard that connects to your Azure SQL database. The dashboard shows year-over-year comparisons, revenue trends, and slicers (dates, transport type, destination, region).

---

## Overview

- **Backend**: Node.js API that connects to Azure SQL (connection string never exposed to the browser).
- **Frontend**: React app with KPI cards, comparison table, revenue line chart, and slicers.
- **Security**: Environment-based secrets, optional authentication, parameterized queries, HTTPS-ready.

---

## Step 1: Prerequisites

1. **Node.js** (v18 or later) – [Download](https://nodejs.org/)
2. **Azure SQL Database** – You need:
   - Server name (e.g. `yourserver.database.windows.net`)
   - Database name
   - A user with read access (or use Azure AD / managed identity later)
   - Firewall rule allowing your IP (or your app’s IP in production)
3. **Git** (optional, for version control)

---

## Step 2: Clone or Copy the Project

- If using Git: clone the repo into a folder (e.g. `r:\Project`).
- Otherwise: ensure all project files are in `r:\Project` (backend and frontend as below).

---

## Step 3: Backend Setup (Azure SQL Connection)

1. Open a terminal in the project root: `r:\Project`.

2. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```

3. Create environment file (never commit real secrets):
   - Copy `backend\.env.example` to `backend\.env`.
   - Fill in your Azure SQL details:
   ```env
   AZURE_SQL_SERVER=yourserver.database.windows.net
   AZURE_SQL_DATABASE=YourDatabaseName
   AZURE_SQL_USER=your_username
   AZURE_SQL_PASSWORD=your_secure_password
   AZURE_SQL_ENCRYPT=true
   API_SECRET_KEY=generate_a_long_random_string_here
   ```
   - Use a strong password and a long random string for `API_SECRET_KEY` (e.g. from a password manager or `openssl rand -hex 32`).

4. Run the backend:
   ```bash
   npm run dev
   ```
   You should see something like: `Server running on port 3001`.

5. **Security**: In production, use **Azure Key Vault** or **Azure App Configuration** for these values instead of a `.env` file.

---

## Step 4: Database Schema (Expected Structure)

Your Azure SQL database should expose data that the API can query. The backend expects (or you can adapt) concepts like:

- **Bookings**: e.g. `booking_date`, `departure_date`, `return_date`, `transport_type`, `destination`, `region`, `pax`, `revenue`, `year`, `month`.
- **Aggregations**: The API will compute current vs previous year by `year` and `month`, and filter by the slicers.

You can either:

- Create views/stored procedures that return:
  - Year–month comparison (current vs previous year).
  - Revenue by year (for the line chart).
  - Distinct values for transport type, destination, region (for slicers).
- Or point the API to your actual table names and we adapt the SQL in `backend/src/routes/dashboard.js` (or equivalent).

If you share your table names and column names, the SQL in the backend can be adjusted to match exactly.

---

## Step 5: Frontend Setup

1. In a new terminal, from `r:\Project`:
   ```bash
   cd frontend
   npm install
   ```

2. Create frontend environment file:
   - Copy `frontend\.env.example` to `frontend\.env.local`.
   - Set the API base URL, e.g.:
   ```env
   VITE_API_URL=http://localhost:3001
   ```
   For production, set this to your backend URL (e.g. `https://api.ttp-services.com`).

3. Run the frontend:
   ```bash
   npm run dev
   ```
   Open the URL shown (e.g. `http://localhost:5173`).

---

## Step 6: Using the Dashboard

1. **Slicers** (filters):
   - **Departure date**, **Return date**, **Booking date**: use the date range pickers.
   - **Transport type**, **Destination**, **Region**: use the dropdowns (options come from the API/Azure SQL).

2. **KPI cards**: Show current vs previous year for:
   - Bookings, PAX, Revenue, plus difference and % difference.

3. **Table**: Year–month comparison (current year vs previous year).

4. **Line chart**: Revenue by year (one line per year).

Data is loaded from your backend, which reads from Azure SQL, so the dashboard is “live” in the sense that it reflects the database at the time of each request (no direct DB connection from the browser).

---

## Step 7: Security Checklist

- [ ] **Secrets**: All Azure SQL and API keys in `.env` (dev) or Key Vault / App Config (production). Never commit `.env`.
- [ ] **HTTPS**: Use HTTPS in production for both frontend and backend.
- [ ] **Authentication**: Add auth (e.g. Azure AD, API key in header, or JWT) so only authorised users can access the API and dashboard. The backend has a placeholder for an API key check.
- [ ] **CORS**: Backend is configured to allow only your frontend origin; adjust `CORS_ORIGIN` for your domain (e.g. `https://dashboard.ttp-services.com`).
- [ ] **Firewall**: Restrict Azure SQL firewall to your app server and known IPs; avoid opening to 0.0.0.0.
- [ ] **Parameterized queries**: The backend uses parameterized queries to avoid SQL injection.

---

## Step 8: Production Deployment (High Level)

1. **Backend**: Deploy to Azure App Service, Azure Functions, or a VM. Set environment variables (or Key Vault references) for Azure SQL and `API_SECRET_KEY`. Enable HTTPS.
2. **Frontend**: Build with `npm run build` and host the `dist` folder on Azure Static Web Apps, App Service (static site), or a CDN.
3. **Domain**: Optionally use a subdomain like `dashboard.ttp-services.com` and link it to your main site (https://www.ttp-services.com/).
4. **Auth**: Implement login (e.g. Azure AD B2C or Entra ID) and protect both the API and the dashboard.

---

## Troubleshooting

- **Cannot connect to Azure SQL**: Check server name, database, user, password, and firewall. Test with SSMS or Azure Data Studio from the same network.
- **CORS errors**: Ensure `VITE_API_URL` and backend `CORS_ORIGIN` match your frontend URL (and protocol).
- **401 Unauthorized**: If you enabled API key auth, ensure the frontend sends the header configured in the backend (e.g. `x-api-key`).

---

## Next Steps

- Replace placeholder SQL in `backend/src/routes/dashboard.js` with your actual tables/views.
- Add authentication (e.g. Azure AD) and role-based access.
- Add more KPIs or charts as needed.
- Set up CI/CD (e.g. GitHub Actions) to deploy backend and frontend automatically.

If you tell me your exact Azure SQL table and column names, I can adapt the backend queries to match your schema.
