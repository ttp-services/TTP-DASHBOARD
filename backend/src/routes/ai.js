import { Router } from 'express';
import { query } from '../db/azureSql.js';
const router = Router();

router.post('/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: 'No message' });

    // ── Pull LIVE data from correct Azure SQL tables ────────────────────────
    const [kpiRes, datasetRes, monthlyRes] = await Promise.allSettled([
      query(`
        SELECT
          (SELECT COUNT(*) FROM CustomerOverview WHERE Status IN ('DEF','DEF-GEANNULEERD')) +
          (SELECT COUNT(*) FROM ST_Bookings WHERE status IN ('ok','cancelled')) AS total_bookings,
          (SELECT SUM(PAXCount) FROM CustomerOverview WHERE Status IN ('DEF','DEF-GEANNULEERD')) +
          (SELECT SUM(paxCount) FROM ST_Bookings WHERE status IN ('ok','cancelled')) AS total_pax,
          (SELECT ROUND(SUM(TotalRevenue),0) FROM CustomerOverview WHERE Status IN ('DEF','DEF-GEANNULEERD')) +
          (SELECT ROUND(SUM(totalPrice),0) FROM ST_Bookings WHERE status IN ('ok','cancelled')) AS total_revenue,
          (SELECT COUNT(*) FROM CustomerOverview WHERE Status='DEF' AND DepartureYear=YEAR(GETDATE())) +
          (SELECT COUNT(*) FROM ST_Bookings WHERE status='ok' AND YEAR(dateDeparture)=YEAR(GETDATE())) AS cy_bookings,
          (SELECT COUNT(*) FROM CustomerOverview WHERE Status='DEF' AND DepartureYear=YEAR(GETDATE())-1) +
          (SELECT COUNT(*) FROM ST_Bookings WHERE status='ok' AND YEAR(dateDeparture)=YEAR(GETDATE())-1) AS py_bookings,
          (SELECT SUM(PAXCount) FROM CustomerOverview WHERE Status='DEF' AND DepartureYear=YEAR(GETDATE())) +
          (SELECT SUM(paxCount) FROM ST_Bookings WHERE status='ok' AND YEAR(dateDeparture)=YEAR(GETDATE())) AS cy_pax,
          (SELECT ROUND(SUM(TotalRevenue),0) FROM CustomerOverview WHERE Status='DEF' AND DepartureYear=YEAR(GETDATE())) +
          (SELECT ROUND(SUM(totalPrice),0) FROM ST_Bookings WHERE status='ok' AND YEAR(dateDeparture)=YEAR(GETDATE())) AS cy_revenue,
          (SELECT ROUND(SUM(TotalRevenue),0) FROM CustomerOverview WHERE Status='DEF' AND DepartureYear=YEAR(GETDATE())-1) +
          (SELECT ROUND(SUM(totalPrice),0) FROM ST_Bookings WHERE status='ok' AND YEAR(dateDeparture)=YEAR(GETDATE())-1) AS py_revenue,
          (SELECT COUNT(*) FROM CustomerOverview WHERE Status='DEF-GEANNULEERD') +
          (SELECT COUNT(*) FROM ST_Bookings WHERE status='cancelled') AS cancelled,
          (SELECT COUNT(*) FROM CustomerOverview WHERE Status='DEF') +
          (SELECT COUNT(*) FROM ST_Bookings WHERE status='ok') AS confirmed
      `),
      query(`
        SELECT Dataset, COUNT(*) AS bookings, SUM(PAXCount) AS pax, ROUND(SUM(TotalRevenue),0) AS revenue
        FROM CustomerOverview WHERE Status IN ('DEF','DEF-GEANNULEERD')
        GROUP BY Dataset ORDER BY bookings DESC
      `),
      query(`
        SELECT DepartureYear AS year, DepartureMonth AS month,
          COUNT(*) AS bookings, SUM(PAXCount) AS pax, ROUND(SUM(TotalRevenue),0) AS revenue
        FROM CustomerOverview
        WHERE Status IN ('DEF','DEF-GEANNULEERD') AND DepartureYear >= YEAR(GETDATE())-1
        GROUP BY DepartureYear, DepartureMonth ORDER BY DepartureYear DESC, DepartureMonth DESC
      `),
    ]);

    const kpi      = kpiRes.status === 'fulfilled'     ? (kpiRes.value.recordset?.[0] || {}) : {};
    const datasets = datasetRes.status === 'fulfilled' ? (datasetRes.value.recordset || [])  : [];
    const monthly  = monthlyRes.status === 'fulfilled' ? (monthlyRes.value.recordset || [])  : [];

    const curYear  = new Date().getFullYear();
    const prevYear = curYear - 1;
    const revGrowth = kpi.py_revenue > 0
      ? (((kpi.cy_revenue - kpi.py_revenue) / kpi.py_revenue) * 100).toFixed(1) : 'N/A';
    const bkGrowth  = kpi.py_bookings > 0
      ? (((kpi.cy_bookings - kpi.py_bookings) / kpi.py_bookings) * 100).toFixed(1) : 'N/A';
    const cancRate  = kpi.total_bookings > 0
      ? ((kpi.cancelled / kpi.total_bookings) * 100).toFixed(1) : 0;
    const avgRev    = kpi.total_bookings > 0
      ? Math.round(kpi.total_revenue / kpi.total_bookings) : 0;
    const avgPax    = kpi.total_bookings > 0
      ? (kpi.total_pax / kpi.total_bookings).toFixed(1) : 0;

    const dbContext = `
=== TTP SERVICES LIVE DATABASE (${new Date().toISOString().split('T')[0]}) ===
SOURCES: CustomerOverview (Solmar NL, Interbus, Solmar DE) + ST_Bookings (Snowtravel)
STATUS MAPPING: DEF=confirmed, DEF-GEANNULEERD=cancelled | ok=confirmed, cancelled=cancelled

ALL-TIME TOTALS:
• Total bookings: ${kpi.total_bookings?.toLocaleString('nl-BE') || 'N/A'}
• Total PAX: ${kpi.total_pax?.toLocaleString('nl-BE') || 'N/A'}
• Total revenue: €${kpi.total_revenue ? (kpi.total_revenue/1e6).toFixed(2) : 'N/A'}M
• Confirmed: ${kpi.confirmed?.toLocaleString('nl-BE') || 'N/A'} | Cancelled: ${kpi.cancelled?.toLocaleString('nl-BE') || 'N/A'} (${cancRate}% cancel rate)
• Avg revenue/booking: €${avgRev.toLocaleString('nl-BE')} | Avg PAX/booking: ${avgPax}

YEAR COMPARISON:
• ${curYear}: ${kpi.cy_bookings?.toLocaleString('nl-BE') || 'N/A'} bookings | €${kpi.cy_revenue ? (kpi.cy_revenue/1e6).toFixed(2)+'M' : 'N/A'} revenue
• ${prevYear}: ${kpi.py_bookings?.toLocaleString('nl-BE') || 'N/A'} bookings | €${kpi.py_revenue ? (kpi.py_revenue/1e6).toFixed(2)+'M' : 'N/A'} revenue
• Bookings growth: ${bkGrowth}% | Revenue growth: ${revGrowth}%

BY DATASET (CustomerOverview only):
${datasets.map(d => `• ${d.dataset}: ${d.bookings?.toLocaleString('nl-BE')} bookings | ${d.pax?.toLocaleString('nl-BE')} PAX | €${(d.revenue/1e6).toFixed(2)}M`).join('\n')}
NOTE: Snowtravel (ST_Bookings) totals are included in all-time figures above.

MONTHLY TREND (CustomerOverview, last 18 months):
${monthly.slice(0,18).map(m => `• ${m.year}-${String(m.month).padStart(2,'0')}: ${m.bookings} bookings | ${m.pax} PAX | €${(m.revenue/1000).toFixed(0)}K`).join('\n')}

IMPORTANT NOTES FOR AI:
- Route zero data: verify with Samir before drawing conclusions
- 2026 Lower/Upper deck data not yet assigned (pipeline pending)
- Fiscal: Solmar = Dec 1–Nov 30 | Snowtravel = Jul 1–Jun 30
=== END CONTEXT ===`;

    // ── Ambiguity detection ─────────────────────────────────────────────────
    const q = message.toLowerCase();
    const isAmbiguous =
      (q.includes('best') && !q.includes('month') && !q.includes('year') && !q.includes('dataset')) ||
      (q.includes('compare') && !q.includes('solmar') && !q.includes('snow') && !q.includes('year') && !q.includes('month')) ||
      (q.includes('performance') && q.split(' ').length < 5);

    if (isAmbiguous) {
      return res.json({
        reply: `I want to make sure I give you accurate data. Could you be more specific?\n\nFor example:\n• "Which year had the best bookings?"\n• "Compare Solmar vs Snowtravel revenue"\n• "What was performance in 2026 vs 2025?"\n\nWhat specifically are you looking for?`,
        source: 'clarification'
      });
    }

    // ── Build messages for OpenAI ───────────────────────────────────────────
    const systemPrompt = `You are TTP AI, the analytics assistant for TTP Services (Belgian travel company).

CRITICAL RULES:
1. ONLY answer using the database context provided. NEVER invent or estimate numbers.
2. If a question is ambiguous or the data isn't in the context, ASK for clarification instead of guessing.
3. If asked about something not in the context (e.g. specific booking IDs, hotel names, individual customers), say you don't have that level of detail and suggest checking the Data Table.
4. Format numbers Dutch style (. as thousand separator), use € for currency.
5. Be concise and professional. Use bullet points for multi-part answers.
6. If data shows "N/A" or is missing, say so honestly — do not fill in gaps.
7. For Route zero queries: flag that this should be verified with Samir before drawing conclusions.

You have access to live data from Azure SQL (CustomerOverview + ST_Bookings tables).`;

    const messages = [
      ...history.slice(-8).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: `${dbContext}\n\nUser question: ${message}` }
    ];

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
          max_tokens: 700,
          temperature: 0.2
        })
      });
      if (r.ok) {
        const d = await r.json();
        return res.json({ reply: d.choices[0].message.content, source: 'openai' });
      }
    }

    // ── Smart fallback using live data ──────────────────────────────────────
    let reply = '';

    if (q.includes('revenue') && (q.includes(String(curYear)) || q.includes('this year'))) {
      reply = `Revenue ${curYear}: €${kpi.cy_revenue ? (kpi.cy_revenue/1e6).toFixed(2)+'M' : 'N/A'} (${revGrowth}% vs ${prevYear}).`;
    } else if (q.includes('previous') || (q.includes('compare') && q.includes('year'))) {
      reply = `${curYear} vs ${prevYear}:\n• Bookings: ${kpi.cy_bookings?.toLocaleString('nl-BE')} vs ${kpi.py_bookings?.toLocaleString('nl-BE')} (${bkGrowth}%)\n• Revenue: €${kpi.cy_revenue ? (kpi.cy_revenue/1e6).toFixed(2)+'M' : 'N/A'} vs €${kpi.py_revenue ? (kpi.py_revenue/1e6).toFixed(2)+'M' : 'N/A'} (${revGrowth}%)`;
    } else if (q.includes('cancell')) {
      reply = `Cancellation rate: ${cancRate}% (${kpi.cancelled?.toLocaleString('nl-BE')} of ${kpi.total_bookings?.toLocaleString('nl-BE')} bookings).`;
    } else if (q.includes('dataset') || q.includes('breakdown') || q.includes('solmar') || q.includes('interbus')) {
      reply = `Revenue by dataset:\n${datasets.map(d=>`• ${d.dataset}: €${(d.revenue/1e6).toFixed(2)}M (${d.bookings?.toLocaleString('nl-BE')} bookings)`).join('\n')}\nNote: Snowtravel figures are included in all-time totals but shown separately in the Data Table.`;
    } else if (q.includes('average') || q.includes('avg')) {
      reply = `Average per booking: €${avgRev.toLocaleString('nl-BE')} revenue | ${avgPax} PAX.`;
    } else if (q.includes('pax')) {
      reply = `Total PAX: ${kpi.total_pax?.toLocaleString('nl-BE')} | ${curYear} PAX: ${kpi.cy_pax?.toLocaleString('nl-BE')}.`;
    } else if (q.includes('route zero') || q.includes('route 0')) {
      reply = `⚠️ Route zero data requires verification with Samir before drawing conclusions. The assignment of certain locations to "Route zero" may reflect a data categorisation issue rather than actual trips. Please check the Data Table and confirm with the data engineering team.`;
    } else {
      const topMonth = [...monthly].sort((a,b)=>b.bookings-a.bookings)[0];
      reply = `Here's a live summary:\n• ${curYear} bookings: ${kpi.cy_bookings?.toLocaleString('nl-BE')} (${bkGrowth}% vs ${prevYear})\n• Total revenue: €${kpi.total_revenue ? (kpi.total_revenue/1e6).toFixed(2)+'M' : 'N/A'}\n• Cancel rate: ${cancRate}%\n• Best recent month: ${topMonth?.year}-${String(topMonth?.month||1).padStart(2,'0')} (${topMonth?.bookings?.toLocaleString('nl-BE')} bookings)\n\nAsk me something specific and I'll pull the exact numbers!`;
    }

    res.json({ reply, source: 'fallback' });
  } catch (err) {
    console.error('AI error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
