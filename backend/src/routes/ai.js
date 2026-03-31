import { Router } from 'express';
import { query } from '../db/azureSql.js';
const router = Router();

// ─── DIRECT SQL QUERY for specific data requests ─────────────────────────────
async function runDirectQuery(message, pool_query) {
  const msg = message.toLowerCase();
  
  // Revenue queries with dataset + date range
  const revenueMatch = msg.match(/revenue.*solmar|solmar.*revenue/);
  const dateFromMatch = message.match(/(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/g);
  
  if (revenueMatch && dateFromMatch && dateFromMatch.length >= 2) {
    const parseDateStr = s => {
      const p = s.split(/[.\-\/]/);
      return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
    };
    const df = parseDateStr(dateFromMatch[0]);
    const dt = parseDateStr(dateFromMatch[1]);
    const r = await pool_query(`
      SELECT 
        COUNT(*) AS bookings,
        SUM(PAXCount) AS pax,
        ROUND(SUM(TotalRevenue),0) AS revenue,
        COUNT(CASE WHEN Status='DEF' THEN 1 END) AS confirmed,
        COUNT(CASE WHEN Status='DEF-GEANNULEERD' THEN 1 END) AS cancelled
      FROM CustomerOverview 
      WHERE Dataset='Solmar' 
      AND Status IN ('DEF','DEF-GEANNULEERD')
      AND DepartureDate BETWEEN '${df}' AND '${dt}'`);
    const d = r.recordset[0];
    return `Solmar ${dateFromMatch[0]} – ${dateFromMatch[1]}:
• Bookings: ${d.bookings?.toLocaleString('nl-BE')}
• PAX: ${d.pax?.toLocaleString('nl-BE')}
• Revenue: €${Math.round(d.revenue||0).toLocaleString('nl-BE')}
• Confirmed: ${d.confirmed?.toLocaleString('nl-BE')} | Cancelled: ${d.cancelled?.toLocaleString('nl-BE')}`;
  }
  return null;
}

router.post('/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: 'No message' });

    const [kpiRes, datasetRes, monthlyRes] = await Promise.all([
      query(`SELECT
        COUNT(*) AS total_bookings,
        SUM(pax) AS total_pax,
        ROUND(SUM(revenue),0) AS total_revenue,
        COUNT(CASE WHEN yr=YEAR(GETDATE()) THEN 1 END) AS cy_bookings,
        COUNT(CASE WHEN yr=YEAR(GETDATE())-1 THEN 1 END) AS py_bookings,
        SUM(CASE WHEN yr=YEAR(GETDATE()) THEN pax ELSE 0 END) AS cy_pax,
        SUM(CASE WHEN yr=YEAR(GETDATE()) THEN revenue ELSE 0 END) AS cy_revenue,
        SUM(CASE WHEN yr=YEAR(GETDATE())-1 THEN revenue ELSE 0 END) AS py_revenue,
        COUNT(CASE WHEN ns='cancelled' THEN 1 END) AS cancelled,
        COUNT(CASE WHEN ns='ok' THEN 1 END) AS confirmed
        FROM (
          SELECT DepartureYear AS yr, PAXCount AS pax, TotalRevenue AS revenue,
            CASE WHEN Status='DEF' THEN 'ok' ELSE 'cancelled' END AS ns
          FROM CustomerOverview WHERE Status IN ('DEF','DEF-GEANNULEERD')
          UNION ALL
          SELECT YEAR(dateDeparture) AS yr, paxCount AS pax, totalPrice AS revenue, status AS ns
          FROM ST_Bookings WHERE status IN ('ok','cancelled')
        ) AS t`),

      query(`SELECT dataset, COUNT(*) AS bookings, SUM(pax) AS pax, ROUND(SUM(revenue),0) AS revenue,
        COUNT(CASE WHEN ns='cancelled' THEN 1 END) AS cancelled
        FROM (
          SELECT Dataset AS dataset, PAXCount AS pax, TotalRevenue AS revenue,
            CASE WHEN Status='DEF' THEN 'ok' ELSE 'cancelled' END AS ns
          FROM CustomerOverview WHERE Status IN ('DEF','DEF-GEANNULEERD')
          UNION ALL
          SELECT 'Snowtravel' AS dataset, paxCount AS pax, totalPrice AS revenue, status AS ns
          FROM ST_Bookings WHERE status IN ('ok','cancelled')
        ) AS t GROUP BY dataset ORDER BY bookings DESC`),

      query(`SELECT yr AS year, mo AS month, COUNT(*) AS bookings, SUM(pax) AS pax, ROUND(SUM(revenue),0) AS revenue
        FROM (
          SELECT DepartureYear AS yr, DepartureMonth AS mo, PAXCount AS pax, TotalRevenue AS revenue
          FROM CustomerOverview WHERE Status IN ('DEF','DEF-GEANNULEERD') AND DepartureYear>=YEAR(GETDATE())-1
          UNION ALL
          SELECT YEAR(dateDeparture) AS yr, MONTH(dateDeparture) AS mo, paxCount AS pax, totalPrice AS revenue
          FROM ST_Bookings WHERE status IN ('ok','cancelled') AND YEAR(dateDeparture)>=YEAR(GETDATE())-1
        ) AS t GROUP BY yr, mo ORDER BY yr DESC, mo DESC`),
    ]);

    const kpi = kpiRes.recordset[0]||{};
    const datasets = datasetRes.recordset||[];
    const monthly = monthlyRes.recordset||[];
    const curYear = new Date().getFullYear(), prevYear = curYear-1;
    const revGrowth = kpi.py_revenue>0?(((kpi.cy_revenue-kpi.py_revenue)/kpi.py_revenue)*100).toFixed(1):'N/A';
    const bkGrowth  = kpi.py_bookings>0?(((kpi.cy_bookings-kpi.py_bookings)/kpi.py_bookings)*100).toFixed(1):'N/A';
    const cancRate  = kpi.total_bookings>0?((kpi.cancelled/kpi.total_bookings)*100).toFixed(1):0;
    const avgRev    = kpi.total_bookings>0?Math.round(kpi.total_revenue/kpi.total_bookings):0;
    const avgPax    = kpi.total_bookings>0?(kpi.total_pax/kpi.total_bookings).toFixed(1):0;

    const dbContext = `
=== TTP SERVICES LIVE DATABASE (${new Date().toISOString().split('T')[0]}) ===
Sources: CustomerOverview (Solmar/Interbus/Solmar DE) + ST_Bookings (Snowtravel)
Status: DEF=confirmed, DEF-GEANNULEERD=cancelled (Solmar) | ok=confirmed (Snowtravel)

ALL-TIME TOTALS:
• Total bookings: ${kpi.total_bookings?.toLocaleString('nl-BE')}
• Total PAX: ${kpi.total_pax?.toLocaleString('nl-BE')}
• Total revenue: €${(kpi.total_revenue/1e6).toFixed(2)}M
• Confirmed: ${kpi.confirmed?.toLocaleString('nl-BE')} | Cancelled: ${kpi.cancelled?.toLocaleString('nl-BE')} (${cancRate}% cancel rate)
• Avg revenue/booking: €${avgRev.toLocaleString('nl-BE')} | Avg PAX/booking: ${avgPax}

YEAR COMPARISON (${curYear} vs ${prevYear}):
• ${curYear}: ${kpi.cy_bookings?.toLocaleString('nl-BE')} bookings | ${kpi.cy_pax?.toLocaleString('nl-BE')} PAX | €${(kpi.cy_revenue/1e6).toFixed(2)}M
• ${prevYear}: ${kpi.py_bookings?.toLocaleString('nl-BE')} bookings | €${(kpi.py_revenue/1e6).toFixed(2)}M
• Growth: bookings ${bkGrowth}% | revenue ${revGrowth}%

BY DATASET:
${datasets.map(d=>`• ${d.dataset}: ${d.bookings?.toLocaleString('nl-BE')} bookings | ${d.pax?.toLocaleString('nl-BE')} PAX | €${(d.revenue/1e6).toFixed(2)}M | ${d.cancelled} cancelled`).join('\n')}

MONTHLY TREND (last 24 months):
${monthly.slice(0,24).map(m=>`• ${m.year}-${String(m.month).padStart(2,'0')}: ${m.bookings} bookings | ${m.pax} PAX | €${(m.revenue/1000).toFixed(0)}K`).join('\n')}

FISCAL YEARS: Solmar = Dec 1–Nov 30 | Snowtravel = Jul 1–Jun 30
=== END CONTEXT ===`;

    const systemPrompt = `You are TTP AI — the analytics assistant for TTP Services (Belgian travel company).
You have LIVE data from Azure SQL pulled at the time of each question.

DATASETS:
- Solmar: CustomerOverview WHERE Dataset='Solmar' AND Status IN ('DEF','DEF-GEANNULEERD')
- Interbus: CustomerOverview WHERE Dataset='Interbus'
- Solmar DE: CustomerOverview WHERE Dataset='Solmar DE'
- Snowtravel: ST_Bookings WHERE status IN ('ok','cancelled')
- DEF = confirmed | DEF-GEANNULEERD = cancelled | ok = confirmed | cancelled = cancelled

CRITICAL RULES:
1. NEVER guess or estimate. Only use numbers from the live context below.
2. If the question is ambiguous (no dataset specified, no date range, no status filter), ASK BACK before answering.
   Example questions to ask back:
   - "Do you mean all datasets or a specific one (Solmar / Interbus / Solmar DE / Snowtravel)?"
   - "Do you want confirmed bookings only, or include cancelled?"
   - "What date range? This year, all time, or a specific period?"
3. When you have enough info, give a direct answer with the exact number from the data.
4. Format: use € for currency, use . as thousand separator (Dutch style e.g. 1.234.567).
5. If asked about a number not in the context, say "I don't have that specific breakdown in the current data pull."

AMBIGUOUS QUERY EXAMPLES:
- "What is our revenue?" → Ask: which dataset? which year? confirmed only?
- "How many bookings?" → Ask: which dataset? which period?
- "Revenue for Solmar 2025 confirmed" → Answer directly, no need to ask back.

DATA FRESHNESS: Pulled live from Azure SQL right now.`;

    const messages = [
      {role:'system', content: systemPrompt},

      ...history.slice(-6).map(h=>({role:h.role,content:h.content})),
      {role:'user',content:`${dbContext}\n\nQuestion: ${message}`}
    ];

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
        body:JSON.stringify({model:'gpt-4o-mini',messages:[{role:'system',content:systemPrompt},...messages],max_tokens:700,temperature:0.2})
      });
      if (r.ok) {
        const d = await r.json();
        return res.json({reply:d.choices[0].message.content,source:'openai'});
      }
    }

    // Fallback
    const q = message.toLowerCase();
    let reply = '';
    if (q.includes('total') && q.includes('revenue')) {
      reply = `All-time revenue: €${(kpi.total_revenue/1e6).toFixed(2)}M | ${curYear}: €${(kpi.cy_revenue/1e6).toFixed(2)}M (${revGrowth}% vs ${prevYear})`;
    } else if (q.includes('cancel')) {
      reply = `Cancellation rate: ${cancRate}% — ${kpi.cancelled?.toLocaleString('nl-BE')} of ${kpi.total_bookings?.toLocaleString('nl-BE')} bookings cancelled.`;
    } else if (q.includes('dataset') || q.includes('breakdown') || q.includes('solmar') || q.includes('snowtravel')) {
      reply = `By dataset:\n${datasets.map(d=>`• ${d.dataset}: ${d.bookings?.toLocaleString('nl-BE')} bookings | €${(d.revenue/1e6).toFixed(2)}M`).join('\n')}`;
    } else if (q.includes('growth') || q.includes('yoy')) {
      reply = `${curYear} vs ${prevYear}: bookings ${bkGrowth}% | revenue ${revGrowth}%\n• ${curYear}: ${kpi.cy_bookings?.toLocaleString('nl-BE')} bookings, €${(kpi.cy_revenue/1e6).toFixed(2)}M\n• ${prevYear}: ${kpi.py_bookings?.toLocaleString('nl-BE')} bookings, €${(kpi.py_revenue/1e6).toFixed(2)}M`;
    } else if (q.includes('pax')) {
      reply = `Total PAX: ${kpi.total_pax?.toLocaleString('nl-BE')} | ${curYear}: ${kpi.cy_pax?.toLocaleString('nl-BE')} PAX`;
    } else {
      const top = [...monthly].sort((a,b)=>b.bookings-a.bookings)[0];
      reply = `Summary:\n• ${curYear}: ${kpi.cy_bookings?.toLocaleString('nl-BE')} bookings (${bkGrowth}% vs ${prevYear})\n• Revenue: €${(kpi.total_revenue/1e6).toFixed(2)}M all-time\n• Cancel rate: ${cancRate}%\n• Best month: ${top?.year}-${String(top?.month||1).padStart(2,'0')} (${top?.bookings?.toLocaleString('nl-BE')} bookings)`;
    }
    res.json({reply,source:'fallback'});

  } catch(err) {
    console.error('AI error:',err.message);
    res.status(500).json({error:err.message});
  }
});

export default router;
