import { Router } from 'express';
import { query } from '../db/azureSql.js';

const router = Router();

router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    // Fetch Live KPI Data for AI context
    let kpiText = '';
    try {
      const k = await query(`
        SELECT
          SUM(CASE WHEN year=DATEPART(YEAR,GETDATE()) THEN revenue ELSE 0 END) AS cr,
          SUM(CASE WHEN year=DATEPART(YEAR,GETDATE()) THEN pax ELSE 0 END) AS cp,
          COUNT(CASE WHEN year=DATEPART(YEAR,GETDATE()) THEN 1 END) AS cb
        FROM bookings WHERE status = 'ok'
      `);
      const r = k.recordset[0];
      kpiText = `2026 Live Data: ${r.cb} bookings, ${r.cp} PAX, EUR ${Math.round(r.cr).toLocaleString()} revenue.`;
    } catch(e) { kpiText = 'KPI data temporarily unavailable'; }

    // Fetch Dataset Breakdown for AI context
    let dsText = '';
    try {
      const ds = await query(`
        SELECT dataset, COUNT(*) AS b, SUM(revenue) AS r
        FROM bookings WHERE status = 'ok' AND year = 2026
        GROUP BY dataset
      `);
      dsText = ds.recordset.map(d => `${d.dataset}: ${d.b} bkg, EUR ${Math.round(d.r).toLocaleString()}`).join(' | ');
    } catch(e) { dsText = 'Breakdown unavailable'; }

    const systemPrompt = `You are TTP Analytics AI. 
    CURRENT 2026 DATA: ${kpiText}
    DATASET BREAKDOWN: ${dsText}
    
    CONTEXT:
    - Snowtravel: Ski holidays (Bus classes: Dream Class, First Class, Sleep/Royal)
    - Solmar/Interbus: Beach holidays (Bus classes: Royal Class/RC, First Class/FC, Premium/PRE)
    - Key Dest: Benidorm (BEN), Costa Brava (CBR), Sierra Nevada (SSE)
    
    Answer concisely using the numbers above. If asked for something else, tell the user to use the dashboard filters.`;

    const openaiKey = process.env.OPENAI_API_KEY || '';
    if (openaiKey.startsWith('sk-')) {
      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: message }]
        })
      });
      if (openaiRes.ok) {
        const data = await openaiRes.json();
        return res.json({ reply: data.choices[0].message.content });
      }
    }

    res.json({ reply: `Live 2026 Stats: ${kpiText}. (Fallback mode enabled)` });
  } catch(err) {
    res.status(500).json({ reply: 'AI Error: ' + err.message });
  }
});

export default router;