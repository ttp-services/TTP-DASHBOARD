import { Router } from 'express';
import { query } from '../db/azureSql.js';

const router = Router();

router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    let kpiText = '', dsText = '', monthlyText = '';
    try {
      const [kpiResult, dsResult, monthResult] = await Promise.all([
        query(`
          SELECT
            SUM(CASE WHEN year=DATEPART(YEAR,GETDATE()) THEN revenue ELSE 0 END) AS cr,
            SUM(CASE WHEN year=DATEPART(YEAR,GETDATE())-1 THEN revenue ELSE 0 END) AS pr,
            SUM(CASE WHEN year=DATEPART(YEAR,GETDATE()) THEN pax ELSE 0 END) AS cp,
            SUM(CASE WHEN year=DATEPART(YEAR,GETDATE())-1 THEN pax ELSE 0 END) AS pp,
            COUNT(CASE WHEN year=DATEPART(YEAR,GETDATE()) THEN 1 END) AS cb,
            COUNT(CASE WHEN year=DATEPART(YEAR,GETDATE())-1 THEN 1 END) AS pb
          FROM bookings WHERE status IN ('ok','cancelled')
        `),
        query(`
          SELECT dataset, COUNT(*) AS b, SUM(pax) AS p, ROUND(SUM(revenue),0) AS r
          FROM bookings WHERE status IN ('ok','cancelled')
          GROUP BY dataset ORDER BY b DESC
        `),
        query(`
          SELECT year, month, COUNT(*) AS bookings, SUM(pax) AS pax, ROUND(SUM(revenue),0) AS revenue
          FROM bookings WHERE status IN ('ok','cancelled')
            AND year >= DATEPART(YEAR,GETDATE())-1
          GROUP BY year, month ORDER BY year, month
        `)
      ]);

      const k = kpiResult.recordset[0] || {};
      const yr = new Date().getFullYear();
      kpiText = `${yr}: ${k.cb?.toLocaleString()} bookings, ${k.cp?.toLocaleString()} PAX, EUR${Math.round(k.cr||0).toLocaleString()} revenue. ${yr-1}: ${k.pb?.toLocaleString()} bookings, ${k.pp?.toLocaleString()} PAX, EUR${Math.round(k.pr||0).toLocaleString()} revenue.`;
      dsText = dsResult.recordset.map(d => `${d.dataset}: ${d.b} bookings, ${d.p} PAX, EUR${d.r?.toLocaleString()}`).join(' | ');
      monthlyText = JSON.stringify(monthResult.recordset);
    } catch (e) {
      console.error('DB fetch error:', e.message);
      kpiText = 'Data temporarily unavailable';
    }

    const systemPrompt = `You are TTP Analytics AI - a smart data analyst for TTP Services, a Belgian travel company specializing in ski and beach holidays.

LIVE KPI DATA:
${kpiText}

BY DATASET:
${dsText}

MONTHLY DATA (last 2 years):
${monthlyText}

KEY FACTS:
- Snowtravel = ski/winter holidays via TravelNote API. Bus classes: Dream Class, First Class, Sleep/Royal Class
- Solmar = beach holidays in Spain (Costa Brava, Benidorm, Salou, Lloret, Costa Blanca, Sierra Nevada)
- Interbus = bus transport partner for Solmar routes
- Solmar DE = German market beach holidays
- Bus classes for Solmar/Interbus: RC=Royal Class, FC=First Class, PRE=Premium
- All data covers 2023-2026, status: ok (confirmed) or cancelled
- Revenue in EUR, company based in Belgium

INSTRUCTIONS:
- Answer concisely and directly using the live data provided
- Format numbers nicely: EUR 1.2M, 12,345 bookings, etc.
- If exact data not available, say so and suggest which dashboard filter to use
- Compare years when asked about trends
- Be professional and helpful`;

    const openaiKey = process.env.OPENAI_API_KEY || '';
    const anthropicKey = process.env.ANTHROPIC_API_KEY || '';

    // Try OpenAI first
    if (openaiKey && openaiKey.startsWith('sk-')) {
      try {
        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 800,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: message }
            ]
          })
        });
        const data = await openaiRes.json();
        if (data.choices?.[0]?.message?.content) {
          return res.json({ reply: data.choices[0].message.content });
        }
      } catch (e) {
        console.error('OpenAI error:', e.message);
      }
    }

    // Try Anthropic Claude as fallback
    if (anthropicKey && anthropicKey.startsWith('sk-ant-')) {
      try {
        const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 800,
            system: systemPrompt,
            messages: [{ role: 'user', content: message }]
          })
        });
        const data = await anthropicRes.json();
        if (data.content?.[0]?.text) {
          return res.json({ reply: data.content[0].text });
        }
      } catch (e) {
        console.error('Anthropic error:', e.message);
      }
    }

    // Fallback: smart DB-based reply
    const msg = message.toLowerCase();
    let reply = '';
    if (msg.includes('revenue')) {
      reply = `Based on live data:\n${kpiText}\n\nDataset breakdown: ${dsText}`;
    } else if (msg.includes('booking')) {
      reply = `Booking summary: ${kpiText}\n\nBy dataset: ${dsText}`;
    } else if (msg.includes('solmar')) {
      const solmar = dsText.split('|').find(d => d.includes('Solmar') && !d.includes('DE'));
      reply = `Solmar data: ${solmar || 'Use the Dataset filter to see Solmar-specific data.'}`;
    } else {
      reply = `Current data summary:\n${kpiText}\n\nBy dataset: ${dsText}`;
    }
    res.json({ reply });

  } catch (err) {
    console.error('AI chat error:', err.message);
    res.json({ reply: 'Sorry, I could not process your request. Please try again.' });
  }
});

router.get('/status', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        dataset,
        COUNT(*) AS total_bookings,
        MAX(CONVERT(VARCHAR(19), booking_date, 120)) AS last_booking_date,
        MAX(CONVERT(VARCHAR(19), GETDATE(), 120)) AS checked_at
      FROM bookings
      WHERE status = 'ok'
      GROUP BY dataset
      ORDER BY total_bookings DESC
    `);
    const datasets = result.recordset || [];
    res.json({
      datasets,
      lastUpdate: datasets.length ? datasets[0].last_booking_date : null,
      checkedAt: new Date().toISOString(),
      dubaiTime: new Date().toLocaleString('en-AE', { timeZone: 'Asia/Dubai' })
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

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
