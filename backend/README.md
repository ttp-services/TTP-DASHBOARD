# TTP Dashboard API

Secure Node.js API for the TTP Services dashboard. Connects to Azure SQL; all credentials live in environment variables.

## Quick start

1. `npm install`
2. Copy `.env.example` to `.env` and set Azure SQL and `API_SECRET_KEY`.
3. **Database**: The routes in `src/routes/dashboard.js` expect a table or view named `bookings` with columns such as: `year`, `month`, `departure_date`, `return_date`, `booking_date`, `transport_type`, `destination`, `region`, and aggregated `num_bookings`, `pax`, `revenue`. Adapt the SQL to your actual schema or create a view that matches this structure.
4. `npm run dev`

## Security

- Never commit `.env`. Use Azure Key Vault in production.
- Set `REQUIRE_API_KEY=true` and send `x-api-key` header from the frontend in production.
- All queries use parameterized inputs to prevent SQL injection.
