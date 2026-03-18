import { query } from './db/azureSql.js';

export async function getDailyKPIs() {
  try {
    const result = await query(`
      SELECT
        COUNT(CASE WHEN CAST(booking_date AS DATE) = CAST(GETDATE() AS DATE) THEN 1 END) AS todayBookings,
        COUNT(CASE WHEN CAST(booking_date AS DATE) = CAST(DATEADD(day,-1,GETDATE()) AS DATE) THEN 1 END) AS yesterdayBookings,
        SUM(CASE WHEN CAST(booking_date AS DATE) = CAST(GETDATE() AS DATE) THEN revenue ELSE 0 END) AS todayRevenue,
        SUM(CASE WHEN year = DATEPART(YEAR,GETDATE()) THEN revenue ELSE 0 END) AS ytdRevenue,
        COUNT(CASE WHEN year = DATEPART(YEAR,GETDATE()) THEN 1 END) AS ytdBookings
      FROM bookings WHERE status = 'ok'
    `);
    return result.recordset[0];
  } catch (err) {
    console.error('KPI fetch error:', err.message);
    return null;
  }
}

export function startAutoRefresh(io) {
  const DUBAI_OFFSET = 4 * 60;
  
  setInterval(async () => {
    const now = new Date();
    const dubaiMinutes = (now.getUTCHours() * 60 + now.getUTCMinutes() + DUBAI_OFFSET) % (24 * 60);
    
    // Midnight Dubai time = 1440 minutes
    if (dubaiMinutes >= 1438 && dubaiMinutes <= 1442) {
      console.log('Auto-refresh triggered at midnight Dubai time');
      const kpis = await getDailyKPIs();
      if (io && kpis) {
        io.emit('data-refresh', { timestamp: new Date().toISOString(), kpis });
      }
    }
  }, 60000); // Check every minute
}
