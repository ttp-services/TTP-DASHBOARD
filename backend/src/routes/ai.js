import { Router } from 'express';
import { query } from '../db/azureSql.js';

const router = Router();

router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    // Fetch live data from Azure SQL
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
      kpiText = `${yr}: ${k.cb?.toLocaleString()} bookings, ${k.cp?.toLocaleString()} PAX, €${Math.round(k.cr||0).toLocaleString()} revenue. ${yr-1}: ${k.pb?.toLocaleString()} bookings, ${k.pp?.toLocaleString()} PAX, €${Math.round(k.pr||0).toLocaleString()} revenue.`;
      dsText = dsResult.recordset.map(d => `${d.dataset}: ${d.b} bookings, ${d.p} PAX, €${d.r?.toLocaleString()}`).join(' | ');
      monthlyText = JSON.stringify(monthResult.recordset);
    } catch (e) {
      console.error('DB fetch error:', e.message);
      kpiText = 'Data temporarily unavailable';
    }

    const systemPrompt = `You are TTP Analytics AI — a smart data analyst for TTP Services, a Belgian travel company specializing in ski and beach holidays.

LIVE KPI DATA:
${kpiText}

BY DATASET:
${dsText}

MONTHLY DATA (last 2 years):
${monthlyText}

KEY FACTS:
- Snowtravel = ski/winter holidays via TravelNote API. Bus classes: Dream Class (most popular), First Class, Sleep/Royal Class
- Solmar = beach holidays in Spain (Costa Brava CBR, Benidorm BEN, Salou SAL, Lloret LLO, Costa Blanca COB, Sierra Nevada SSE)
- Interbus = bus transport partner for Solmar routes
- Solmar DE = German market beach holidays
- Bus classes for Solmar/Interbus: RC=Royal Class, FC=First Class, PRE=Premium
- All data covers 2023-2026, status: ok (confirmed) or cancelled
- Revenue in EUR (€), company based in Belgium
- Dashboard built on Azure SQL (TTPDatabase on ttpserver.database.windows.net)

INSTRUCTIONS:
- Answer concisely and directly using the live data provided
- Format numbers nicely: €1.2M, 12,345 bookings, etc.
- If exact data not available in context, say so and suggest which dashboard filter to use
- Compare years when asked about trends
- Be professional and helpful`;

    const apiKey = process.env.ANTHROPIC_API_KEY || '';

    // If no API key, return smart data-based reply
    if (!apiKey || apiKey.trim() === '') {
      const msg = message.toLowerCase();
      let reply = '';
      if (msg.includes('revenue')) {
        reply = `Based on live data: ${kpiText}\n\nDataset breakdown: ${dsText}\n\nFor detailed revenue analysis, use the date filters in the Overview tab.`;
      } else if (msg.includes('booking')) {
        reply = `Booking summary: ${kpiText}\n\nBy dataset: ${dsText}`;
      } else if (msg.includes('pax') || msg.includes('passenger')) {
        reply = `PAX summary: ${kpiText}\n\nCheck the PAX by Year chart in the Overview tab for monthly breakdown.`;
      } else if (msg.includes('solmar')) {
        const solmar = dsText.split('|').find(d => d.includes('Solmar') && !d.includes('DE'));
        reply = `Solmar data: ${solmar || 'Use the Dataset filter to see Solmar-specific data.'}\n\nFor monthly breakdown, filter by Dataset=Solmar in the Overview tab.`;
      } else if (msg.includes('bus') || msg.includes('class')) {
        reply = `Bus occupancy data is available in the Bus Occupancy tab. Snowtravel uses Dream Class, First Class, and Sleep/Royal Class. Solmar/Interbus uses Royal Class (RC), First Class (FC), and Premium (PRE).`;
      } else {
        reply = `Here is the current data summary:\n\n${kpiText}\n\nBy dataset: ${dsText}\n\nTo add AI analysis, set ANTHROPIC_API_KEY in the backend .env file. For now, use the dashboard filters for detailed analysis.`;
      }
      return res.json({ reply });
    }

    // Call Anthropic Claude
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }]
      })
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('Anthropic API error:', errText);
      return res.json({
        reply: `Here is the current data summary:\n\n${kpiText}\n\nBy dataset: ${dsText}\n\n(AI service temporarily unavailable. Check ANTHROPIC_API_KEY in .env)`
      });
    }

    const data = await anthropicRes.json();
    const reply = data.content?.[0]?.text || 'No response generated.';
    res.json({ reply });

  } catch (err) {
    console.error('AI chat error:', err.message);
    res.json({
      reply: 'Sorry, I could not process your request. The backend is running but encountered an error. Please try again.'
    });
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
    const lastUpdate = datasets.length ? datasets[0].last_booking_date : null;
    res.json({
      datasets,
      lastUpdate,
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
