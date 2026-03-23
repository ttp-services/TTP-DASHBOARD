import { Router } from 'express';
import { query } from '../db/azureSql.js';

const router = Router();

// ── AI CHAT ───────────────────────────────────────────────────────────────────
router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    // Fetch live KPI data
    let kpiText = 'data unavailable';
    let dsText  = '';
    try {
      const cy = new Date().getFullYear();
      const k = await query(`
        SELECT
          SUM(CASE WHEN year=${cy}   THEN revenue ELSE 0 END) AS cr,
          SUM(CASE WHEN year=${cy-1} THEN revenue ELSE 0 END) AS pr,
          SUM(CASE WHEN year=${cy}   THEN pax     ELSE 0 END) AS cp,
          SUM(CASE WHEN year=${cy-1} THEN pax     ELSE 0 END) AS pp,
          COUNT(CASE WHEN year=${cy}   THEN 1 END)            AS cb,
          COUNT(CASE WHEN year=${cy-1} THEN 1 END)            AS pb
        FROM bookings WHERE status IN ('ok','cancelled')
      `);
      const r = k.recordset[0];
      kpiText = `${cy}: ${r.cb} bookings, ${r.cp} PAX, EUR ${Math.round(r.cr).toLocaleString()} revenue. ` +
                `${cy-1}: ${r.pb} bookings, ${r.pp} PAX, EUR ${Math.round(r.pr).toLocaleString()} revenue.`;

      const ds = await query(`
        SELECT dataset, COUNT(*) AS b, SUM(pax) AS p, SUM(revenue) AS r
        FROM bookings WHERE status IN ('ok','cancelled')
        GROUP BY dataset ORDER BY b DESC
      `);
      dsText = ds.recordset.map(d =>
        `${d.dataset}: ${d.b} bookings, ${d.p} PAX, EUR ${Math.round(d.r).toLocaleString()}`
      ).join(' | ');
    } catch (e) {
      console.error('KPI fetch error:', e.message);
    }

    const system = `You are TTP Analytics AI for TTP Services, a Belgian travel company.
LIVE DATA: ${kpiText}
BY DATASET: ${dsText}
Datasets: Snowtravel (ski/winter via TravelNote), Solmar (beach Spain), Interbus (bus partner), Solmar DE (Germany market).
Bus classes: RC=Royal Class, FC=First Class, PRE=Premium. Dream/First/Sleep for Snowtravel.
Routes: BEN=Benidorm, CBR=Costa Brava, SAL=Salou, SSE=Sierra Nevada, LLO=Lloret, COB=Costa Blanca.
Answer concisely with real numbers. Format currency as EUR. Always be helpful and data-driven.
If exact data not available for a specific filter, suggest using the dashboard filters.`;

    const openaiKey = process.env.OPENAI_API_KEY || '';
    const anthropicKey = process.env.ANTHROPIC_API_KEY || '';

    // Try OpenAI first
    if (openaiKey && openaiKey.startsWith('sk-')) {
      try {
        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 800,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: message }
            ]
          })
        });
        const data = await aiRes.json();
        const reply = data.choices?.[0]?.message?.content;
        if (reply) return res.json({ reply });
      } catch (e) {
        console.error('OpenAI error:', e.message);
      }
    }

    // Try Anthropic as fallback
    if (anthropicKey && anthropicKey.startsWith('sk-ant')) {
      try {
        const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 600,
            system,
            messages: [{ role: 'user', content: message }]
          })
        });
        const data = await aiRes.json();
        const reply = data.content?.[0]?.text;
        if (reply) return res.json({ reply });
      } catch (e) {
        console.error('Anthropic error:', e.message);
      }
    }

    // Fallback: smart DB-based reply
    res.json({
      reply: `Based on live data: ${kpiText}\n\nBy dataset: ${dsText}\n\nFor detailed analysis, use the dashboard filters to drill down into specific datasets, date ranges, or bus types.`
    });

  } catch (err) {
    console.error('AI chat error:', err.message);
    res.status(500).json({ reply: 'Sorry, I could not process your request right now. Please try again.' });
  }
});

// ── DASHBOARD STATUS ──────────────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        dataset,
        COUNT(*) AS total_bookings,
        MAX(CONVERT(VARCHAR(19), booking_date, 120)) AS last_booking_date
      FROM bookings
      WHERE status IN ('ok','cancelled')
      GROUP BY dataset
      ORDER BY total_bookings DESC
    `);
    res.json({
      datasets: result.recordset || [],
      checkedAt: new Date().toISOString(),
      dubaiTime: new Date().toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

// ── EMAIL NOTIFICATIONS ───────────────────────────────────────────────────────
router.post('/notify', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.default.join(process.cwd(), 'src/data/subscribers.json');
    let subscribers = [];
    try {
      subscribers = JSON.parse(fs.default.readFileSync(filePath, 'utf8'));
    } catch { subscribers = []; }
    if (!subscribers.includes(email)) {
      subscribers.push(email);
      fs.default.writeFileSync(filePath, JSON.stringify(subscribers, null, 2));
    }
    res.json({ success: true, message: `Notifications enabled for ${email}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

export default router;
