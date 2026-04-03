import { Router } from 'express';
import { query } from '../db/azureSql.js';
const router = Router();

router.post('/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: 'No message provided' });

    // ── Pull LIVE data from Azure SQL ─────────────────────────────────────────
    const [kpiRes, datasetRes, monthlyRes, busRes] = await Promise.allSettled([
      query(`
        SELECT
          (SELECT COUNT(*) FROM CustomerOverview WHERE Status IN ('DEF','DEF-GEANNULEERD')) +
          (SELECT COUNT(*) FROM ST_Bookings WHERE status IN ('ok','cancelled')) AS total_bookings,
          (SELECT ISNULL(SUM(PAXCount),0) FROM CustomerOverview WHERE Status IN ('DEF','DEF-GEANNULEERD')) +
          (SELECT ISNULL(SUM(paxCount),0) FROM ST_Bookings WHERE status IN ('ok','cancelled')) AS total_pax,
          (SELECT ISNULL(ROUND(SUM(TotalRevenue),0),0) FROM CustomerOverview WHERE Status IN ('DEF','DEF-GEANNULEERD')) +
          (SELECT ISNULL(ROUND(SUM(totalPrice),0),0) FROM ST_Bookings WHERE status IN ('ok','cancelled')) AS total_revenue,
          -- Current year (confirmed only)
          (SELECT COUNT(*) FROM CustomerOverview WHERE Status='DEF' AND DepartureYear=YEAR(GETDATE())) +
          (SELECT COUNT(*) FROM ST_Bookings WHERE status='ok' AND YEAR(dateDeparture)=YEAR(GETDATE())) AS cy_bookings,
          (SELECT COUNT(*) FROM CustomerOverview WHERE Status='DEF' AND DepartureYear=YEAR(GETDATE())-1) +
          (SELECT COUNT(*) FROM ST_Bookings WHERE status='ok' AND YEAR(dateDeparture)=YEAR(GETDATE())-1) AS py_bookings,
          (SELECT ISNULL(SUM(PAXCount),0) FROM CustomerOverview WHERE Status='DEF' AND DepartureYear=YEAR(GETDATE())) +
          (SELECT ISNULL(SUM(paxCount),0) FROM ST_Bookings WHERE status='ok' AND YEAR(dateDeparture)=YEAR(GETDATE())) AS cy_pax,
          (SELECT ISNULL(ROUND(SUM(TotalRevenue),0),0) FROM CustomerOverview WHERE Status='DEF' AND DepartureYear=YEAR(GETDATE())) +
          (SELECT ISNULL(ROUND(SUM(totalPrice),0),0) FROM ST_Bookings WHERE status='ok' AND YEAR(dateDeparture)=YEAR(GETDATE())) AS cy_revenue,
          (SELECT ISNULL(ROUND(SUM(TotalRevenue),0),0) FROM CustomerOverview WHERE Status='DEF' AND DepartureYear=YEAR(GETDATE())-1) +
          (SELECT ISNULL(ROUND(SUM(totalPrice),0),0) FROM ST_Bookings WHERE status='ok' AND YEAR(dateDeparture)=YEAR(GETDATE())-1) AS py_revenue,
          -- Cancelled
          (SELECT COUNT(*) FROM CustomerOverview WHERE Status='DEF-GEANNULEERD') +
          (SELECT COUNT(*) FROM ST_Bookings WHERE status='cancelled') AS total_cancelled,
          (SELECT COUNT(*) FROM CustomerOverview WHERE Status='DEF') +
          (SELECT COUNT(*) FROM ST_Bookings WHERE status='ok') AS total_confirmed`),

      query(`
        SELECT Dataset, COUNT(*) AS bookings, SUM(PAXCount) AS pax,
          ROUND(SUM(TotalRevenue),0) AS revenue,
          COUNT(CASE WHEN Status='DEF-GEANNULEERD' THEN 1 END) AS cancelled,
          COUNT(CASE WHEN Status='DEF' THEN 1 END) AS confirmed
        FROM CustomerOverview WHERE Status IN ('DEF','DEF-GEANNULEERD')
        GROUP BY Dataset ORDER BY bookings DESC`),

      query(`
        SELECT DepartureYear AS year, DepartureMonth AS month,
          COUNT(*) AS bookings, SUM(PAXCount) AS pax, ROUND(SUM(TotalRevenue),0) AS revenue
        FROM CustomerOverview
        WHERE Status IN ('DEF','DEF-GEANNULEERD') AND DepartureYear >= YEAR(GETDATE())-2
        GROUP BY DepartureYear, DepartureMonth
        ORDER BY DepartureYear DESC, DepartureMonth DESC`),

      query(`
        SELECT
          SUM(CASE WHEN Status='DEF' THEN PAX ELSE 0 END) AS confirmed_pax,
          SUM(CASE WHEN Status='TIJD' THEN PAX ELSE 0 END) AS temp_pax,
          SUM(CASE WHEN Status='VERV' THEN PAX ELSE 0 END) AS lapsed_pax,
          COUNT(DISTINCT CASE WHEN Status='DEF' THEN Booking_Number END) AS confirmed_bookings,
          SUM(CASE WHEN Outbound_Class='Royal Class' AND Status='DEF' THEN PAX ELSE 0 END) AS royal_pax,
          SUM(CASE WHEN Outbound_Class='First Class' AND Status='DEF' THEN PAX ELSE 0 END) AS first_pax,
          SUM(CASE WHEN Outbound_Class='Premium Class' AND Status='DEF' THEN PAX ELSE 0 END) AS premium_pax
        FROM solmar_bus_bookings_modified`),
    ]);

    const kpi      = kpiRes.status      === 'fulfilled' ? (kpiRes.value.recordset?.[0]      || {}) : {};
    const datasets = datasetRes.status  === 'fulfilled' ? (datasetRes.value.recordset        || []) : [];
    const monthly  = monthlyRes.status  === 'fulfilled' ? (monthlyRes.value.recordset        || []) : [];
    const bus      = busRes.status      === 'fulfilled' ? (busRes.value.recordset?.[0]       || {}) : {};

    const curYear  = new Date().getFullYear();
    const prevYear = curYear - 1;
    const fmt = n => n != null ? Number(n).toLocaleString('nl-BE') : 'N/A';
    const fmtM = n => n != null ? `€${(Number(n)/1e6).toFixed(2)}M` : 'N/A';
    const revGrowth = kpi.py_revenue > 0 ? (((kpi.cy_revenue - kpi.py_revenue) / kpi.py_revenue) * 100).toFixed(1) + '%' : 'N/A';
    const bkGrowth  = kpi.py_bookings > 0 ? (((kpi.cy_bookings - kpi.py_bookings) / kpi.py_bookings) * 100).toFixed(1) + '%' : 'N/A';
    const cancRate  = kpi.total_bookings > 0 ? ((kpi.total_cancelled / kpi.total_bookings) * 100).toFixed(1) + '%' : 'N/A';

    const dbContext = `
══════════════════════════════════════════════════════════════
TTP SERVICES — LIVE AZURE SQL DATA
Snapshot: ${new Date().toISOString().split('T')[0]} ${new Date().toTimeString().split(' ')[0]} UTC
══════════════════════════════════════════════════════════════

DATA SOURCES:
• CustomerOverview → Solmar NL, Interbus, Solmar DE
  Statuses: DEF = Confirmed | DEF-GEANNULEERD = Cancelled
• ST_Bookings → Snowtravel
  Statuses: ok = Confirmed | cancelled = Cancelled
• Bus: solmar_bus_bookings_modified (all statuses: DEF, TIJD, VERV)

BOOKING TOTALS (ALL TIME — confirmed + cancelled):
• Total bookings : ${fmt(kpi.total_bookings)}
• Total PAX       : ${fmt(kpi.total_pax)}
• Total revenue   : ${fmtM(kpi.total_revenue)}
• Confirmed       : ${fmt(kpi.total_confirmed)}
• Cancelled       : ${fmt(kpi.total_cancelled)} (${cancRate} cancel rate)

${curYear} vs ${prevYear} (CONFIRMED ONLY):
• ${curYear} bookings : ${fmt(kpi.cy_bookings)} | PAX: ${fmt(kpi.cy_pax)} | Revenue: ${fmtM(kpi.cy_revenue)}
• ${prevYear} bookings : ${fmt(kpi.py_bookings)} | Revenue: ${fmtM(kpi.py_revenue)}
• Growth: bookings ${bkGrowth} | revenue ${revGrowth}

BY DATASET (CustomerOverview — confirmed + cancelled):
${datasets.map(d => `• ${d.dataset}: ${fmt(d.bookings)} bookings | ${fmt(d.pax)} PAX | ${fmtM(d.revenue)} | ${fmt(d.confirmed)} conf. | ${fmt(d.cancelled)} canc.`).join('\n')}
Note: Snowtravel (ST_Bookings) is included in all-time totals above but shown separately.

MONTHLY TREND (CustomerOverview, last 3 years):
${monthly.slice(0, 36).map(m => `• ${m.year}-${String(m.month).padStart(2,'0')}: ${fmt(m.bookings)} bookings | ${fmt(m.pax)} PAX | €${Math.round(m.revenue/1000)}K`).join('\n')}

BUS OCCUPANCY (solmar_bus_bookings_modified — all statuses):
• Confirmed PAX (DEF) : ${fmt(bus.confirmed_pax)}
• Temporary PAX (TIJD): ${fmt(bus.temp_pax)}
• Lapsed PAX (VERV)   : ${fmt(bus.lapsed_pax)}
• Royal Class PAX     : ${fmt(bus.royal_pax)}
• First Class PAX     : ${fmt(bus.first_pax)}
• Premium Class PAX   : ${fmt(bus.premium_pax)}

FISCAL YEARS:
• Solmar    = Dec 1 – Nov 30
• Snowtravel= Jul 1 – Jun 30
══════════════════════════════════════════════════════════════`;

    // ── Professional system prompt ────────────────────────────────────────────
    const systemPrompt = `You are TTP AI — the internal analytics assistant for TTP Services, a Belgian travel and bus company headquartered in Belgium with operations in the Middle East.

You have direct read-only access to live data from the TTP Azure SQL database, pulled fresh at the start of every conversation.

═══ YOUR ROLE ═══
You help the management team (Robbert Jan Tel, Abdul Rahman, Samir) quickly understand booking performance, PAX trends, revenue, and bus occupancy — without them having to run SQL queries themselves.

═══ DATA SOURCES ═══
1. CustomerOverview — Solmar NL, Interbus, Solmar DE bookings
   • DEF = Confirmed | DEF-GEANNULEERD = Cancelled
2. ST_Bookings — Snowtravel bookings
   • ok = Confirmed | cancelled = Cancelled
3. solmar_bus_bookings_modified — Bus bookings (all statuses)
   • DEF = Confirmed | TIJD = Temporary | VERV = Lapsed/Cancelled

═══ RULES — NEVER BREAK THESE ═══
1. ONLY use numbers from the live database context provided. NEVER estimate, extrapolate, or make up figures.
2. If a question is ambiguous, ASK ONE clarifying question before answering. Do not ask multiple questions at once.
   — Missing dataset? Ask: "Which dataset — Solmar, Interbus, Solmar DE, Snowtravel, or all combined?"
   — Missing period? Ask: "Which period — this year (${new Date().getFullYear()}), last year, a specific date range, or all time?"
   — Missing status? Ask: "Confirmed bookings only, or include cancelled?"
3. Answer directly when all three are clear: dataset + period + status.
4. Format all numbers Dutch-style (1.234.567) and use € for currency.
5. Never say "as an AI" or "I don't have real-time access" — you DO have live data.
6. If a number isn't in the current data context, say: "That specific breakdown isn't in the current data pull — please use the Data Table tab for row-level detail."
7. Route zero queries: flag that Samir should verify route assignment before drawing conclusions.
8. Keep answers concise. Use bullet points for multi-part answers. Lead with the number.

═══ FISCAL YEAR AWARENESS ═══
• Solmar fiscal year = 1 Dec → 30 Nov
• Snowtravel fiscal year = 1 Jul → 30 Jun
• Always clarify which year you're reporting when comparing across fiscal boundaries.

═══ TONE ═══
Professional, direct, precise. Like a smart analyst briefing the CEO — no padding, no hedging, just clean numbers with context.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: `${dbContext}\n\nUser question: ${message}` },
    ];

    // ── OpenAI ────────────────────────────────────────────────────────────────
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 800, temperature: 0.15 }),
      });
      if (r.ok) {
        const d = await r.json();
        return res.json({ reply: d.choices[0].message.content, source: 'openai' });
      }
    }

    // ── Smart fallback ────────────────────────────────────────────────────────
    const q = message.toLowerCase();
    let reply = '';

    // Ambiguity check
    const hasDataset = q.includes('solmar') || q.includes('interbus') || q.includes('snowtravel') || q.includes('all');
    const hasPeriod  = q.includes('2025') || q.includes('2026') || q.includes('this year') || q.includes('last year') || q.includes('all time');

    if (!hasDataset && (q.includes('revenue') || q.includes('bookings') || q.includes('pax'))) {
      reply = `I want to give you the right number — which dataset do you mean?\n• Solmar NL\n• Interbus\n• Solmar DE\n• Snowtravel\n• All combined`;
    } else if (!hasPeriod && (q.includes('revenue') || q.includes('bookings'))) {
      reply = `Which period should I report?\n• ${curYear} (current year)\n• ${prevYear} (last year)\n• All time\n• Specific date range`;
    } else if (q.includes('revenue') && q.includes(String(curYear))) {
      reply = `Revenue ${curYear} (confirmed): ${fmtM(kpi.cy_revenue)}\nGrowth vs ${prevYear}: ${revGrowth}`;
    } else if (q.includes('cancel')) {
      reply = `Cancellation rate: ${cancRate}\n• Total cancelled: ${fmt(kpi.total_cancelled)}\n• Total bookings: ${fmt(kpi.total_bookings)}`;
    } else if (q.includes('bus') || q.includes('pendel')) {
      reply = `Bus occupancy (confirmed DEF):\n• Confirmed PAX: ${fmt(bus.confirmed_pax)}\n• Temporary (TIJD): ${fmt(bus.temp_pax)}\n• Lapsed (VERV): ${fmt(bus.lapsed_pax)}\n• Royal Class: ${fmt(bus.royal_pax)}\n• First Class: ${fmt(bus.first_pax)}\n• Premium: ${fmt(bus.premium_pax)}`;
    } else if (q.includes('dataset') || q.includes('breakdown')) {
      reply = `By dataset:\n${datasets.map(d => `• ${d.dataset}: ${fmt(d.bookings)} bookings | ${fmtM(d.revenue)}`).join('\n')}`;
    } else {
      const top = [...monthly].sort((a,b) => b.bookings - a.bookings)[0];
      reply = `Here's a live summary:\n• ${curYear} bookings: ${fmt(kpi.cy_bookings)} (${bkGrowth} vs ${prevYear})\n• ${curYear} revenue: ${fmtM(kpi.cy_revenue)}\n• Cancel rate: ${cancRate}\n• Best recent month: ${top?.year}-${String(top?.month||1).padStart(2,'0')} (${fmt(top?.bookings)} bookings)\n\nAsk me something specific and I'll pull the exact number!`;
    }

    res.json({ reply, source: 'fallback' });
  } catch (err) {
    console.error('AI error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
