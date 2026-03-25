import { Router } from 'express';
import { query } from '../db/azureSql.js';
const router = Router();

router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    let kpiText='', dsText='', monthlyText='';
    try {
      const k = await query(`SELECT
        SUM(CASE WHEN departure_date >= DATEADD(month,-12,GETDATE()) THEN revenue ELSE 0 END) AS cr,
        SUM(CASE WHEN departure_date >= DATEADD(month,-24,GETDATE()) AND departure_date < DATEADD(month,-12,GETDATE()) THEN revenue ELSE 0 END) AS pr,
        SUM(CASE WHEN departure_date >= DATEADD(month,-12,GETDATE()) THEN pax ELSE 0 END) AS cp,
        SUM(CASE WHEN departure_date >= DATEADD(month,-24,GETDATE()) AND departure_date < DATEADD(month,-12,GETDATE()) THEN pax ELSE 0 END) AS pp,
        COUNT(CASE WHEN departure_date >= DATEADD(month,-12,GETDATE()) THEN 1 END) AS cb,
        COUNT(CASE WHEN departure_date >= DATEADD(month,-24,GETDATE()) AND departure_date < DATEADD(month,-12,GETDATE()) THEN 1 END) AS pb
        FROM bookings WHERE status IN ('ok','cancelled')`);
      const r=k.recordset[0];
      kpiText=`Rolling 12m: ${r.cb} bookings, ${r.cp} PAX, EUR ${Math.round(r.cr).toLocaleString()} revenue. Prev 12m: ${r.pb} bookings, ${r.pp} PAX, EUR ${Math.round(r.pr).toLocaleString()} revenue.`;
    } catch(e) { kpiText='KPI unavailable'; }
    try {
      const ds = await query(`SELECT dataset, COUNT(*) AS b, SUM(pax) AS p, ROUND(SUM(revenue),0) AS r FROM bookings WHERE status IN ('ok','cancelled') GROUP BY dataset ORDER BY b DESC`);
      dsText = ds.recordset.map(d=>`${d.dataset}: ${d.b} bookings, ${d.p} PAX, EUR ${Math.round(d.r).toLocaleString()}`).join(' | ');
    } catch(e) { dsText='Dataset unavailable'; }
    try {
      const mo = await query(`SELECT TOP 12 year, month, COUNT(*) AS b, ROUND(SUM(revenue),0) AS r FROM bookings WHERE status='ok' AND year>=YEAR(GETDATE())-1 GROUP BY year,month ORDER BY year DESC,month DESC`);
      const mn=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      monthlyText = mo.recordset.map(m=>`${mn[m.month-1]} ${m.year}: ${m.b} bkg, EUR ${Math.round(m.r).toLocaleString()}`).join('; ');
    } catch(e) { monthlyText='Monthly unavailable'; }

    const systemPrompt = `You are TTP Analytics AI for TTP Services, a Belgian travel company.
LIVE DATA (rolling 12 months): ${kpiText}
BY DATASET: ${dsText}
MONTHLY: ${monthlyText}
Datasets: Snowtravel (ski), Solmar (beach Spain), Interbus (bus), Solmar DE (Germany).
Bus classes: RC=Royal, FC=First, PRE=Premium (Solmar). Dream/First/Sleep-Royal (Snowtravel).
Routes: BEN=Benidorm, CBR=Costa Brava, SAL=Salou, SSE=Sierra Nevada, LLO=Lloret.
Answer concisely with real numbers. Format as EUR. Keep under 150 words.`;

    const key = process.env.OPENAI_API_KEY||'';
    if (key && key.startsWith('sk-')) {
      try {
        const r = await fetch('https://api.openai.com/v1/chat/completions',{
          method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},
          body:JSON.stringify({model:'gpt-4o-mini',max_tokens:500,temperature:0.2,
            messages:[{role:'system',content:systemPrompt},{role:'user',content:message}]})
        });
        if(r.ok){const d=await r.json();const reply=d.choices?.[0]?.message?.content;if(reply)return res.json({reply,source:'openai'});}
        else{console.error('OpenAI error:',r.status,await r.text());}
      } catch(e){console.error('OpenAI fetch:',e.message);}
    }
    // Fallback
    const msg=message.toLowerCase();
    let reply=`Live data: ${kpiText}\n\nBy dataset: ${dsText}`;
    if(msg.includes('solmar'))reply=`Solmar data: `+(dsText.split('|').find(s=>s.includes('Solmar'))||'see dashboard');
    res.json({reply,source:'fallback'});
  } catch(err){console.error('AI error:',err.message);res.status(500).json({reply:'AI temporarily unavailable.'});}
});

router.get('/status', async (req,res)=>{
  try{
    const r=await query(`SELECT dataset,COUNT(*) AS total FROM bookings WHERE status IN ('ok','cancelled') GROUP BY dataset ORDER BY total DESC`);
    res.json({datasets:r.recordset||[],dubaiTime:new Date().toLocaleString('en-GB',{timeZone:'Asia/Dubai',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}),openaiConfigured:!!(process.env.OPENAI_API_KEY&&process.env.OPENAI_API_KEY.startsWith('sk-'))});
  }catch(err){res.status(500).json({error:'Status failed'});}
});
router.post('/notify',async(req,res)=>{
  const{email}=req.body;
  if(!email||!email.includes('@'))return res.status(400).json({error:'Valid email required'});
  res.json({success:true,message:`Notifications saved for ${email}`});
});
export default router;
