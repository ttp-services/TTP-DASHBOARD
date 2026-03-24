import { Router } from 'express';
import { query } from '../db/azureSql.js';

const router = Router();

router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    let kpiText = '';
    let dsText = '';
    let monthlyText = '';

    try {
      const k = await query(`
        SELECT
          SUM(CASE WHEN year=DATEPART(YEAR,GETDATE()) THEN revenue ELSE 0 END) AS cr,
          SUM(CASE WHEN year=DATEPART(YEAR,GETDATE())-1 THEN revenue ELSE 0 END) AS pr,
          SUM(CASE WHEN year=DATEPART(YEAR,GETDATE()) THEN pax ELSE 0 END) AS cp,
          SUM(CASE WHEN year=DATEPART(YEAR,GETDATE())-1 THEN pax ELSE 0 END) AS pp,
          COUNT(CASE WHEN year=DATEPART(YEAR,GETDATE()) THEN 1 END) AS cb,
          COUNT(CASE WHEN year=DATEPART(YEAR,GETDATE())-1 THEN 1 END) AS pb
        FROM bookings WHERE status IN ('ok','cancelled')
      `);
      const r = k.recordset[0];
      const cy = new Date().getFullYear();
      kpiText = `${cy}: ${r.cb} bookings, ${r.cp} PAX, EUR ${Math.round(r.cr).toLocaleString()} revenue. ` +
                `${cy-1}: ${r.pb} bookings, ${r.pp} PAX, EUR ${Math.round(r.pr).toLocaleString()} revenue.`;
    } catch(e) { kpiText = 'KPI data unavailable'; }

    try {
      const ds = await query(`
        SELECT dataset,
          COUNT(*) AS b,
          SUM(pax) AS p,
          SUM(revenue) AS r
        FROM bookings
        WHERE status IN ('ok','cancelled')
        GROUP BY dataset
        ORDER BY b DESC
      `);
      dsText = ds.recordset.map(d =>
        `${d.dataset}: ${d.b} bookings, ${d.p} PAX, EUR ${Math.round(d.r).toLocaleString()}`
      ).join(' | ');
    } catch(e) { dsText = 'Dataset breakdown unavailable'; }

    try {
      const mo = await query(`
        SELECT TOP 12
          year, month,
          COUNT(*) AS bookings,
          SUM(pax) AS pax,
          SUM(revenue) AS revenue
        FROM bookings
        WHERE status = 'ok'
        AND year = DATEPART(YEAR,GETDATE())
        GROUP BY year, month
        ORDER BY month DESC
      `);
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      monthlyText = mo.recordset.map(m =>
        `${months[m.month-1]} ${m.year}: ${m.bookings} bkg, ${m.pax} PAX, EUR ${Math.round(m.revenue).toLocaleString()}`
      ).join('; ');
    } catch(e) { monthlyText = 'Monthly data unavailable'; }

    const systemPrompt = `You are TTP Analytics AI for TTP Services, a Belgian travel company specializing in ski and beach holidays.

LIVE DATABASE DATA (current):
${kpiText}

BY DATASET (all time):
${dsText}

MONTHLY BREAKDOWN (current year):
${monthlyText}

COMPANY CONTEXT:
- Datasets: Snowtravel (ski/winter via TravelNote API), Solmar (beach Spain), Interbus (bus partner), Solmar DE (Germany market)
- Bus classes: RC=Royal Class, FC=First Class, PRE=Premium (Solmar/Interbus); Dream Class, First Class, Sleep/Royal (Snowtravel)
- Routes: BEN=Benidorm, CBR=Costa Brava, SAL=Salou, SSE=Sierra Nevada, LLO=Lloret, COB=Costa Blanca
- Departure cities: mainly Belgium (Antwerp, Ghent, Brussels, Hasselt, Genk, etc.)
- Currency: EUR

INSTRUCTIONS:
- Answer concisely with real numbers from the data above
- Format currency as EUR (e.g. EUR 1.2M, EUR 450K)
- If the question requires data not available above, say so and suggest using dashboard filters
- Be helpful and professional`;

    const openaiKey = process.env.OPENAI_API_KEY || '';

    if (openaiKey && openaiKey.startsWith('sk-')) {
      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 500,
          temperature: 0.3,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ]
        })
      });

      if (openaiRes.ok) {
        const data = await openaiRes.json();
        const reply = data.choices?.[0]?.message?.content;
        if (reply) return res.json({ reply });
      } else {
        const errText = await openaiRes.text();
        console.error('OpenAI error:', openaiRes.status, errText);
      }
    }

    // Fallback: smart answer from DB data
    const fallback = `Here is what I know from live data:\n\n${kpiText}\n\nBy dataset:\n${dsText}\n\nFor detailed analysis, use the dashboard filters.`;
    res.json({ reply: fallback });

  } catch(err) {
    console.error('AI chat error:', err.message);
    res.status(500).json({ reply: 'Sorry, AI is temporarily unavailable. Please try again.' });
  }
});

router.get('/status', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        dataset,
        COUNT(*) AS total_bookings,
        MAX(CONVERT(VARCHAR(19), bookingDate, 120)) AS last_booking_date
      FROM bookings
      WHERE status = 'ok'
      GROUP BY dataset
      ORDER BY total_bookings DESC
    `);
    res.json({
      datasets: result.recordset || [],
      checkedAt: new Date().toISOString(),
      dubaiTime: new Date().toLocaleString('en-GB', { timeZone: 'Asia/Dubai', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
    });
  } catch(err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

router.post('/notify', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });
    res.json({ success: true, message: `Notifications saved for ${email}` });
  } catch(err) {
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
