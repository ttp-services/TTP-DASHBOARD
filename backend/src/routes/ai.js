import { Router } from 'express';
import { query } from '../db/azureSql.js';
const router = Router();

router.post('/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: 'No message' });

    // ── Pull LIVE data from Azure SQL ──────────────────────────────────────────
    const [kpiRes, datasetRes, monthlyRes, busRes] = await Promise.all([
      query(`SELECT
        COUNT(*) AS total_bookings, SUM(pax) AS total_pax, ROUND(SUM(revenue),0) AS total_revenue,
        COUNT(CASE WHEN year=YEAR(GETDATE()) THEN 1 END) AS cy_bookings,
        COUNT(CASE WHEN year=YEAR(GETDATE())-1 THEN 1 END) AS py_bookings,
        SUM(CASE WHEN year=YEAR(GETDATE()) THEN pax ELSE 0 END) AS cy_pax,
        SUM(CASE WHEN year=YEAR(GETDATE()) THEN revenue ELSE 0 END) AS cy_revenue,
        SUM(CASE WHEN year=YEAR(GETDATE())-1 THEN revenue ELSE 0 END) AS py_revenue,
        COUNT(CASE WHEN status='cancelled' THEN 1 END) AS cancelled,
        COUNT(CASE WHEN status='ok' THEN 1 END) AS confirmed
        FROM bookings WHERE status IN ('ok','cancelled')`),
      query(`SELECT dataset, COUNT(*) AS bookings, SUM(pax) AS pax, ROUND(SUM(revenue),0) AS revenue
        FROM bookings WHERE status IN ('ok','cancelled') GROUP BY dataset ORDER BY bookings DESC`),
      query(`SELECT year, month, COUNT(*) AS bookings, SUM(pax) AS pax, ROUND(SUM(revenue),0) AS revenue
        FROM bookings WHERE status IN ('ok','cancelled') AND year>=YEAR(GETDATE())-1
        GROUP BY year, month ORDER BY year DESC, month DESC`),
      query(`SELECT bus_type_name, COUNT(*) AS bookings, SUM(pax) AS pax
        FROM bookings WHERE status IN ('ok','cancelled') AND bus_type_name IS NOT NULL AND bus_type_name NOT IN ('Other','')
        GROUP BY bus_type_name ORDER BY pax DESC`),
    ]);

    const kpi = kpiRes.recordset[0] || {};
    const datasets = datasetRes.recordset || [];
    const monthly = monthlyRes.recordset || [];
    const busClasses = busRes.recordset || [];

    const curYear = new Date().getFullYear();
    const prevYear = curYear - 1;
    const revGrowth = kpi.py_revenue > 0 ? (((kpi.cy_revenue - kpi.py_revenue) / kpi.py_revenue) * 100).toFixed(1) : 'N/A';
    const bkGrowth  = kpi.py_bookings > 0 ? (((kpi.cy_bookings - kpi.py_bookings) / kpi.py_bookings) * 100).toFixed(1) : 'N/A';
    const cancRate  = kpi.total_bookings > 0 ? ((kpi.cancelled / kpi.total_bookings) * 100).toFixed(1) : 0;
    const avgRev    = kpi.total_bookings > 0 ? Math.round(kpi.total_revenue / kpi.total_bookings) : 0;
    const avgPax    = kpi.total_bookings > 0 ? (kpi.total_pax / kpi.total_bookings).toFixed(1) : 0;

    const dbContext = `
=== TTP SERVICES LIVE DATABASE CONTEXT (${new Date().toISOString().split('T')[0]}) ===

ALL-TIME TOTALS (2023–${curYear}, status: ok + cancelled):
• Total bookings: ${kpi.total_bookings?.toLocaleString('nl-BE')}
• Total PAX: ${kpi.total_pax?.toLocaleString('nl-BE')}
• Total revenue: €${(kpi.total_revenue/1e6).toFixed(2)}M
• Confirmed: ${kpi.confirmed?.toLocaleString('nl-BE')} | Cancelled: ${kpi.cancelled?.toLocaleString('nl-BE')} (${cancRate}% cancel rate)
• Avg revenue/booking: €${avgRev.toLocaleString('nl-BE')} | Avg PAX/booking: ${avgPax}

YEAR COMPARISON:
• ${curYear}: ${kpi.cy_bookings?.toLocaleString('nl-BE')} bookings, €${(kpi.cy_revenue/1e6).toFixed(2)}M revenue
• ${prevYear}: ${kpi.py_bookings?.toLocaleString('nl-BE')} bookings, €${(kpi.py_revenue/1e6).toFixed(2)}M revenue
• Bookings growth: ${bkGrowth}% | Revenue growth: ${revGrowth}%

BY DATASET:
${datasets.map(d => `• ${d.dataset}: ${d.bookings?.toLocaleString('nl-BE')} bookings | ${d.pax?.toLocaleString('nl-BE')} PAX | €${(d.revenue/1e6).toFixed(2)}M`).join('\n')}

MONTHLY (last 24 months):
${monthly.slice(0,24).map(m => `• ${m.year}-${String(m.month).padStart(2,'0')}: ${m.bookings} bookings | ${m.pax} PAX | €${(m.revenue/1000).toFixed(0)}K`).join('\n')}

BUS CLASSES:
${busClasses.map(b => `• ${b.bus_type_name}: ${b.bookings?.toLocaleString('nl-BE')} bookings | ${b.pax?.toLocaleString('nl-BE')} PAX`).join('\n')}

DATASETS EXPLAINED:
• Solmar NL: main Dutch ski travel brand
• Snowtravel: Belgian snow travel
• Interbus: bus-only bookings
• Solmar DE: German market
FISCAL YEARS: Solmar = Dec 1–Nov 30 | Snowtravel = Jul 1–Jun 30
=== END CONTEXT ===`;

    // ── Build messages ──────────────────────────────────────────────────────────
    const systemPrompt = `You are TTP AI, the analytics assistant for TTP Services (Belgian travel company).
You have access to LIVE data from the Azure SQL database updated as of today.
Answer questions accurately using the database context provided.
Be concise, professional, and use € for currency. Format numbers with . as thousand separator (Dutch style).
If asked about specific booking IDs or customer names, say you don't have that level of detail here.
Always refer to the live data context when answering — do not make up numbers.`;

    const messages = [
      ...history.slice(-6).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: `${dbContext}\n\nUser question: ${message}` }
    ];

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role:'system', content: systemPrompt }, ...messages], max_tokens: 600, temperature: 0.3 })
      });
      if (r.ok) {
        const d = await r.json();
        return res.json({ reply: d.choices[0].message.content, source: 'openai' });
      }
    }

    // ── Smart fallback using live data ─────────────────────────────────────────
    const q = message.toLowerCase();
    let reply = '';

    if (q.includes('revenue') && (q.includes('2026') || q.includes('this year'))) {
      reply = `Revenue for ${curYear}: €${(kpi.cy_revenue/1e6).toFixed(2)}M (${revGrowth}% vs ${prevYear}).`;
    } else if (q.includes('total revenue') || q.includes('all time revenue')) {
      reply = `All-time revenue (2023–${curYear}): €${(kpi.total_revenue/1e6).toFixed(2)}M across ${kpi.total_bookings?.toLocaleString('nl-BE')} bookings.`;
    } else if (q.includes('solmar') && q.includes('snowtravel')) {
      const s = datasets.find(d=>d.dataset==='Solmar'), st = datasets.find(d=>d.dataset==='Snowtravel');
      reply = s && st ? `Solmar: ${s.bookings?.toLocaleString('nl-BE')} bookings, €${(s.revenue/1e6).toFixed(2)}M revenue.\nSnowtravel: ${st.bookings?.toLocaleString('nl-BE')} bookings, €${(st.revenue/1e6).toFixed(2)}M revenue.` : 'Dataset data not available.';
    } else if (q.includes('cancell')) {
      reply = `Cancellation rate: ${cancRate}% (${kpi.cancelled?.toLocaleString('nl-BE')} of ${kpi.total_bookings?.toLocaleString('nl-BE')} bookings cancelled).`;
    } else if (q.includes('growth') || q.includes('yoy') || q.includes('year')) {
      reply = `${curYear} vs ${prevYear}:\n• Bookings: ${kpi.cy_bookings?.toLocaleString('nl-BE')} vs ${kpi.py_bookings?.toLocaleString('nl-BE')} (${bkGrowth}%)\n• Revenue: €${(kpi.cy_revenue/1e6).toFixed(2)}M vs €${(kpi.py_revenue/1e6).toFixed(2)}M (${revGrowth}%)`;
    } else if (q.includes('dataset') || q.includes('breakdown')) {
      reply = `Revenue by dataset:\n${datasets.map(d=>`• ${d.dataset}: €${(d.revenue/1e6).toFixed(2)}M (${d.bookings?.toLocaleString('nl-BE')} bookings)`).join('\n')}`;
    } else if (q.includes('average') || q.includes('avg')) {
      reply = `Average per booking: €${avgRev.toLocaleString('nl-BE')} revenue | ${avgPax} PAX.`;
    } else if (q.includes('pax')) {
      reply = `Total PAX: ${kpi.total_pax?.toLocaleString('nl-BE')} | ${curYear} PAX: ${kpi.cy_pax?.toLocaleString('nl-BE')}.`;
    } else if (q.includes('bus') || q.includes('class')) {
      reply = `Bus classes:\n${busClasses.map(b=>`• ${b.bus_type_name}: ${b.pax?.toLocaleString('nl-BE')} PAX`).join('\n')}`;
    } else {
      const topMonth = monthly.sort((a,b)=>b.bookings-a.bookings)[0];
      reply = `Here's a quick summary:\n• ${curYear} bookings: ${kpi.cy_bookings?.toLocaleString('nl-BE')} (${bkGrowth}% vs ${prevYear})\n• Total revenue: €${(kpi.total_revenue/1e6).toFixed(2)}M\n• Cancel rate: ${cancRate}%\n• Best month: ${topMonth?.year}-${String(topMonth?.month||1).padStart(2,'0')} (${topMonth?.bookings?.toLocaleString('nl-BE')} bookings)\n\nAsk me anything specific!`;
    }
    res.json({ reply, source: 'fallback' });
  } catch (err) {
    console.error('AI error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
