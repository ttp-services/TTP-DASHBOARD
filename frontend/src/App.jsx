import { useState, useEffect, useCallback, useRef } from "react";
import Login from "./Login.jsx";

const BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://localhost:3001";
const CHART_COLORS = ["#3b82f6","#f59e0b","#10b981","#ef4444","#a855f7","#f97316","#06b6d4","#ec4899"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
// Session-only: token lives only in sessionStorage — cleared on tab/browser close
const getToken = () => sessionStorage.getItem("ttp_token") || "";
const fmtN   = n => n == null ? "—" : Number(n).toLocaleString("nl-BE");
const fmtEur = n => {
  if (n == null) return "—";
  const v = Number(n);
  if (Math.abs(v) >= 1e6) return `€${(v/1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `€${(v/1e3).toFixed(1)}K`;
  return `€${v.toLocaleString("nl-BE")}`;
};
const fmtPct = (n, plus = true) => n == null ? "—" : `${n > 0 && plus ? "+" : ""}${Number(n).toFixed(1)}%`;
const diffColor = v => v > 0 ? "var(--green)" : v < 0 ? "var(--red)" : "var(--text-muted)";

async function apiFetch(path, params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k,v]) => {
    if (v == null || v === "") return;
    if (Array.isArray(v)) v.forEach(x => qs.append(k, x));
    else qs.set(k, v);
  });
  const url = `${BASE}${path}${qs.toString() ? "?"+qs.toString() : ""}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (r.status === 401) throw new Error("Unauthorized");
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ─── SVG ICONS ────────────────────────────────────────────────────────────────
const I = {
  overview: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  bus:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6v6M15 6v6M2 12h19.6M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><circle cx="16" cy="18" r="2"/></svg>,
  hotel:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 22V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v15M2 22h20M15 22v-4a3 3 0 0 0-6 0v4"/><rect x="9" y="7" width="2" height="3"/><rect x="13" y="7" width="2" height="3"/></svg>,
  table:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>,
  ai:       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/><circle cx="9" cy="14" r="1" fill="currentColor"/><circle cx="15" cy="14" r="1" fill="currentColor"/></svg>,
  settings: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  refresh:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.04-5.44"/></svg>,
  filter:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  close:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  up:       <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>,
  down:     <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>,
  send:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  eye:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  eyeOff:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  search:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  download: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  plus:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  trash:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  warn:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  moon:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  sun:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
};

// ─── LINE CHART ───────────────────────────────────────────────────────────────
function LineChart({ data }) {
  const ref = useRef(null), ptsRef = useRef([]);
  const [tip, setTip] = useState(null);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = window.devicePixelRatio||1, rect = c.getBoundingClientRect();
    c.width = rect.width*dpr; c.height = rect.height*dpr;
    const ctx = c.getContext("2d"); ctx.scale(dpr,dpr);
    const W=rect.width, H=rect.height, pad={top:28,right:16,bottom:36,left:60};
    ctx.clearRect(0,0,W,H);
    if (!data?.length) return;
    const years = [...new Set(data.map(d=>d.year))].sort();
    const byY = {};
    data.forEach(d => { if (!byY[d.year]) byY[d.year]={}; byY[d.year][d.month]=d.revenue||0; });
    const maxV = Math.max(...data.map(d=>d.revenue||0), 1);
    const sx = m => pad.left + ((m-1)/11)*(W-pad.left-pad.right);
    const sy = v => pad.top + (1-v/maxV)*(H-pad.top-pad.bottom);
    const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || 'rgba(30,58,95,.4)';
    const labelColor = getComputedStyle(document.documentElement).getPropertyValue('--text-dim').trim() || '#3d5a80';
    for (let i=0;i<=4;i++) {
      const y = pad.top+(i/4)*(H-pad.top-pad.bottom);
      ctx.strokeStyle=gridColor; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(W-pad.right,y); ctx.stroke();
      ctx.fillStyle=labelColor; ctx.font="10px system-ui"; ctx.textAlign="right";
      ctx.fillText(fmtEur(maxV*(1-i/4)), pad.left-6, y+4);
    }
    MONTHS.forEach((m,i) => {
      ctx.fillStyle=labelColor; ctx.font="10px system-ui"; ctx.textAlign="center";
      ctx.fillText(m, sx(i+1), H-pad.bottom+14);
    });
    ptsRef.current = [];
    years.forEach((yr,yi) => {
      const color = CHART_COLORS[yi % CHART_COLORS.length];
      const pts = [1,2,3,4,5,6,7,8,9,10,11,12].map(m => ({ x:sx(m), y:sy(byY[yr]?.[m]||0), val:byY[yr]?.[m]||0, m }));
      ctx.strokeStyle=color; ctx.lineWidth=2; ctx.lineJoin="round";
      ctx.beginPath(); pts.forEach((p,i) => i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y)); ctx.stroke();
      pts.forEach(p => {
        ctx.fillStyle=color; ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2); ctx.fill();
        ptsRef.current.push({...p,year:yr,month:MONTHS[p.m-1],color});
      });
      const lx = pad.left + yi*68;
      ctx.fillStyle=color; ctx.fillRect(lx,6,14,3);
      ctx.fillStyle=labelColor; ctx.font="10px system-ui"; ctx.textAlign="left";
      ctx.fillText(String(yr), lx+18, 12);
    });
  }, [data]);

  const onMove = e => {
    const rect = ref.current?.getBoundingClientRect(); if (!rect) return;
    const mx=e.clientX-rect.left, my=e.clientY-rect.top;
    const hit = ptsRef.current.find(p => Math.hypot(p.x-mx,p.y-my)<12);
    setTip(hit ? {...hit,cx:mx,cy:my} : null);
  };

  return (
    <div style={{position:"relative"}}>
      <canvas ref={ref} style={{width:"100%",height:220,display:"block",cursor:"crosshair"}} onMouseMove={onMove} onMouseLeave={()=>setTip(null)}/>
      {tip && <div style={{position:"absolute",left:tip.cx+10,top:tip.cy-10,background:"var(--surface-2)",border:"1px solid var(--border)",borderRadius:8,padding:"8px 12px",fontSize:12,pointerEvents:"none",zIndex:10}}>
        <b style={{color:tip.color}}>{tip.year}</b> · {tip.month}<br/><span style={{color:"var(--text)"}}>{fmtEur(tip.val)}</span>
      </div>}
    </div>
  );
}

// ─── BAR CHART ───────────────────────────────────────────────────────────────
function BarChart({ data, metric="bookings" }) {
  const ref = useRef(null), barsRef = useRef([]);
  const [tip, setTip] = useState(null);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr=window.devicePixelRatio||1, rect=c.getBoundingClientRect();
    c.width=rect.width*dpr; c.height=rect.height*dpr;
    const ctx=c.getContext("2d"); ctx.scale(dpr,dpr);
    const W=rect.width, H=rect.height, pad={top:28,right:16,bottom:36,left:60};
    ctx.clearRect(0,0,W,H);
    if (!data?.length) return;
    const years=[...new Set(data.map(d=>d.year))].sort();
    const byY={};
    data.forEach(d=>{ if(!byY[d.year]) byY[d.year]={}; byY[d.year][d.month]=(byY[d.year][d.month]||0)+(metric==="bookings"?d.bookings:metric==="pax"?d.pax:d.revenue)||0; });
    const allVals=Object.values(byY).flatMap(m=>Object.values(m)); const maxV=Math.max(...allVals,1);
    const slotW=(W-pad.left-pad.right)/12; const bW=Math.max(2,(slotW/years.length)-1);
    const sy=v=>pad.top+(1-v/maxV)*(H-pad.top-pad.bottom);
    const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || 'rgba(30,58,95,.4)';
    const labelColor = getComputedStyle(document.documentElement).getPropertyValue('--text-dim').trim() || '#3d5a80';
    for(let i=0;i<=4;i++){const y=pad.top+(i/4)*(H-pad.top-pad.bottom);ctx.strokeStyle=gridColor;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(W-pad.right,y);ctx.stroke();}
    MONTHS.forEach((m,i)=>{ctx.fillStyle=labelColor;ctx.font="10px system-ui";ctx.textAlign="center";ctx.fillText(m,pad.left+(i+.5)*slotW,H-pad.bottom+14);});
    barsRef.current=[];
    [1,2,3,4,5,6,7,8,9,10,11,12].forEach((mo,mi)=>{
      years.forEach((yr,yi)=>{
        const v=byY[yr]?.[mo]||0; const color=CHART_COLORS[yi%CHART_COLORS.length];
        const x=pad.left+mi*slotW+yi*(bW+1); const barH=Math.max(1,(H-pad.top-pad.bottom)*v/maxV);
        ctx.fillStyle=color+"cc"; ctx.fillRect(x,sy(v),bW,barH);
        barsRef.current.push({x,y:sy(v),w:bW,h:barH,year:yr,month:MONTHS[mi],value:v,color});
      });
    });
    years.forEach((yr,yi)=>{const color=CHART_COLORS[yi%CHART_COLORS.length];const lx=pad.left+yi*68;ctx.fillStyle=color;ctx.fillRect(lx,6,14,3);ctx.fillStyle=labelColor;ctx.font="10px system-ui";ctx.textAlign="left";ctx.fillText(String(yr),lx+18,12);});
  },[data,metric]);

  const onMove=e=>{const rect=ref.current?.getBoundingClientRect();if(!rect)return;const mx=e.clientX-rect.left,my=e.clientY-rect.top;const hit=barsRef.current.find(b=>mx>=b.x&&mx<=b.x+b.w&&my>=b.y&&my<=b.y+b.h);setTip(hit?{...hit,cx:mx,cy:my}:null);};
  const fmt=v=>metric==="revenue"?fmtEur(v):fmtN(v);

  return(
    <div style={{position:"relative"}}>
      <canvas ref={ref} style={{width:"100%",height:220,display:"block",cursor:"crosshair"}} onMouseMove={onMove} onMouseLeave={()=>setTip(null)}/>
      {tip&&<div style={{position:"absolute",left:tip.cx+10,top:tip.cy-10,background:"var(--surface-2)",border:"1px solid var(--border)",borderRadius:8,padding:"8px 12px",fontSize:12,pointerEvents:"none",zIndex:10}}>
        <b style={{color:tip.color}}>{tip.year}</b> · {tip.month}<br/><span style={{color:"var(--text)"}}>{fmt(tip.value)}</span>
      </div>}
    </div>
  );
}

// ─── KPI CARD ─────────────────────────────────────────────────────────────────
function KpiCard({label,curr,prev,diff,pct,fmt,color,prevLabel}) {
  const up=diff>0, dn=diff<0;
  return (
    <div style={{flex:1,minWidth:180,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"18px 20px"}}>
      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:12}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:color}}/>
        <span style={{fontSize:11,fontWeight:700,color:"var(--text-dim)",textTransform:"uppercase",letterSpacing:".07em"}}>{label}</span>
      </div>
      <div style={{fontSize:28,fontWeight:800,color:"var(--text)",lineHeight:1,marginBottom:6,fontFamily:"var(--mono)"}}>{curr!=null?fmt(curr):"—"}</div>
      <div style={{fontSize:12,color:"var(--text-muted)",marginBottom:8}}>
        {prev>0?<>{prevLabel||"prev"}: <b>{fmt(prev)}</b></>:<span style={{color:"var(--text-dim)"}}>no previous data</span>}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:7}}>
        {diff!=null&&diff!==0&&<span style={{display:"flex",alignItems:"center",gap:2,color:diffColor(diff),fontSize:12,fontWeight:700}}>{up?I.up:I.down}{fmt(Math.abs(diff))}</span>}
        {pct!=null&&<span style={{background:up?"var(--green-dim)":dn?"var(--red-dim)":"var(--surface-2)",color:diffColor(diff),fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:10}}>{fmtPct(pct)}</span>}
      </div>
    </div>
  );
}

// ─── YEAR-MONTH TABLE ─────────────────────────────────────────────────────────
function YMTable({data,metric,hasFY}) {
  const rows = [...(data||[])].sort((a,b) => {
    if (hasFY) {
      const fyMo = m => m===12?1:m+1;
      return a.year!==b.year ? a.year-b.year : fyMo(a.month)-fyMo(b.month);
    }
    return b.year!==a.year ? b.year-a.year : b.month-a.month;
  });
  const curr  = r => metric==="pax"?r.currentPax  :metric==="revenue"?r.currentRevenue  :r.currentBookings;
  const prev  = r => metric==="pax"?r.previousPax :metric==="revenue"?r.previousRevenue :r.previousBookings;
  const diff  = r => metric==="pax"?r.diffPax      :metric==="revenue"?r.diffRevenue      :r.diffBookings;
  const pct   = r => metric==="pax"?r.diffPctPax   :metric==="revenue"?r.diffPctRevenue   :r.diffPctBookings;
  const fmt   = v => v==null?"—":metric==="revenue"?fmtEur(v):fmtN(v);

  return(
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:620}}>
        <thead><tr style={{background:"var(--bg-2)"}}>
          {["Period","Last Year","Current","Previous","Difference","Diff %"].map(h=>(
            <th key={h} style={{padding:"9px 14px",textAlign:h==="Period"?"left":"right",fontSize:10,fontWeight:700,color:"var(--text-dim)",textTransform:"uppercase",letterSpacing:".05em",borderBottom:"1px solid var(--border)",whiteSpace:"nowrap"}}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {!rows.length&&<tr><td colSpan={6} style={{padding:24,textAlign:"center",color:"var(--text-muted)"}}>No data — apply filters and refresh</td></tr>}
          {rows.map((r,i)=>{
            const d=diff(r), p=pct(r), up=d>0, dn=d<0;
            return(<tr key={i} style={{borderBottom:"1px solid var(--border)",background:i%2?"var(--bg-2)":"transparent"}}>
              <td style={{padding:"9px 14px",color:"var(--blue)",fontWeight:600,whiteSpace:"nowrap"}}>{MONTHS[(r.month||1)-1]}-{r.year}</td>
              <td style={{padding:"9px 14px",textAlign:"right",color:"var(--text-muted)"}}>{MONTHS[(r.month||1)-1]}-{(r.year||0)-1}</td>
              <td style={{padding:"9px 14px",textAlign:"right",fontWeight:600,color:"var(--text)"}}>{fmt(curr(r))}</td>
              <td style={{padding:"9px 14px",textAlign:"right",color:"var(--text-muted)"}}>{prev(r)!=null&&prev(r)>0?fmt(prev(r)):"€0"}</td>
              <td style={{padding:"9px 14px",textAlign:"right",color:diffColor(d),fontWeight:600}}>{d!=null?(up?"+":"")+fmt(d):"—"}</td>
              <td style={{padding:"9px 14px",textAlign:"right",color:diffColor(d)}}>{p!=null?fmtPct(p):"—"}</td>
            </tr>);
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── BUS KPI STRIP ───────────────────────────────────────────────────────────
function BusKpis({data}) {
  if (!data) return null;
  const cards = [
    {label:"Total PAX",    val:fmtN(data.total_pax),      c:"var(--blue)"},
    {label:"Total Bookings",val:fmtN(data.total_bookings), c:"var(--text)"},
    {label:"Royal Class",  val:fmtN(data.royal_pax),       c:"var(--purple)"},
    {label:"First Class",  val:fmtN(data.first_pax),       c:"var(--green)"},
    {label:"Premium",      val:fmtN(data.premium_pax),     c:"var(--amber)"},
    {label:"Confirmed",    val:fmtN(data.confirmed_pax),   c:"var(--green)"},
    {label:"Temporary",    val:fmtN(data.temp_pax),        c:"var(--amber)"},
    {label:"Lapsed",       val:fmtN(data.lapsed_pax),      c:"var(--red)"},
  ];
  return(
    <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
      {cards.map(k=>(
        <div key={k.label} style={{flex:1,minWidth:110,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"12px 14px"}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--text-dim)",marginBottom:6}}>{k.label}</div>
          <div style={{fontSize:20,fontWeight:800,color:k.c,fontFamily:"var(--mono)"}}>{k.val}</div>
        </div>
      ))}
    </div>
  );
}

// ─── BUS STATUS CHIPS ─────────────────────────────────────────────────────────
function BusStatusFilter({value,onChange}) {
  const opts=[{v:"all",l:"All"},{v:"confirmed",l:"Confirmed"},{v:"temporary",l:"Temporary"},{v:"lapsed",l:"Lapsed"},{v:"cancelled",l:"Cancelled"}];
  const colors={all:"var(--blue)",confirmed:"var(--green)",temporary:"var(--amber)",lapsed:"var(--red)",cancelled:"var(--text-muted)"};
  return(
    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
      {opts.map(o=>{
        const active=value===o.v;
        return(<button key={o.v} onClick={()=>onChange(o.v)} style={{padding:"5px 12px",borderRadius:20,border:`1px solid ${active?colors[o.v]:"var(--border)"}`,background:active?`${colors[o.v]}22`:"transparent",color:active?colors[o.v]:"var(--text-muted)",fontSize:12,fontWeight:active?700:400,cursor:"pointer"}}>{o.l}</button>);
      })}
    </div>
  );
}

// ─── MULTI-SELECT DROPDOWN ────────────────────────────────────────────────────
function MultiSelect({label, options, value, onChange, placeholder="All"}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const toggle = v => onChange(value.includes(v) ? value.filter(x=>x!==v) : [...value, v]);
  const display = value.length === 0 ? placeholder : value.length === 1 ? value[0] : `${value.length} selected`;

  return (
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",padding:"7px 10px",background:"var(--bg)",border:"1px solid var(--border)",borderRadius:"var(--radius)",color:value.length?"var(--text)":"var(--text-dim)",fontSize:12,textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",gap:6}}>
        <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{display}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius)",zIndex:200,maxHeight:220,overflowY:"auto",boxShadow:"var(--shadow-lg)"}}>
          {options.length===0 && <div style={{padding:"10px 12px",fontSize:12,color:"var(--text-dim)"}}>No options</div>}
          {value.length>0&&<button onClick={()=>onChange([])} style={{width:"100%",padding:"8px 12px",background:"none",border:"none",borderBottom:"1px solid var(--border)",color:"var(--red)",fontSize:11,textAlign:"left",cursor:"pointer",fontWeight:600}}>Clear all</button>}
          {options.map(o=>(
            <button key={o} onClick={()=>toggle(o)} style={{width:"100%",padding:"8px 12px",background:value.includes(o)?"var(--blue-dim)":"none",border:"none",color:value.includes(o)?"var(--blue)":"var(--text)",fontSize:12,textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
              <span style={{width:14,height:14,border:`1.5px solid ${value.includes(o)?"var(--blue)":"var(--border)"}`,borderRadius:3,background:value.includes(o)?"var(--blue)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {value.includes(o)&&<svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="2 6 5 9 10 3"/></svg>}
              </span>
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PENDEL TABLE ─────────────────────────────────────────────────────────────
function PendelTable({data}) {
  if (!data?.length) return <Empty msg="No pendel data — adjust date range and apply"/>;
  const cols=[
    {k:"StartDate",l:"Start Date",sticky:true,color:"var(--blue)"},
    {k:"EndDate",l:"End Date",color:"var(--blue)"},
    {k:"Outbound_Total",l:"Total OUT",right:true,bold:true,color:"var(--blue)"},
    {k:"ORC",l:"RC OUT",right:true,color:"var(--purple)"},
    {k:"OFC",l:"FC OUT",right:true,color:"var(--green)"},
    {k:"OPRE",l:"PRE OUT",right:true,color:"var(--amber)"},
    {k:"Inbound_Total",l:"Total IN",right:true,bold:true,color:"var(--green)"},
    {k:"RRC",l:"RC IN",right:true,color:"var(--purple)"},
    {k:"RFC",l:"FC IN",right:true,color:"var(--green)"},
    {k:"RPRE",l:"PRE IN",right:true,color:"var(--amber)"},
    {k:"Diff_Total",l:"Diff Total",right:true,bold:true},
    {k:"Diff_Royal",l:"Diff RC",right:true},
    {k:"Diff_First",l:"Diff FC",right:true},
    {k:"Diff_Premium",l:"Diff PRE",right:true},
  ];
  return(
    <div style={{overflowX:"auto",maxHeight:540}}>
      <table style={{borderCollapse:"collapse",fontSize:12,minWidth:1000}}>
        <thead style={{position:"sticky",top:0,zIndex:2}}>
          <tr style={{background:"var(--bg-2)"}}>
            {cols.map(c=><th key={c.k} style={{padding:"9px 12px",textAlign:c.right?"right":"left",fontSize:10,fontWeight:700,color:c.color||"var(--text-dim)",textTransform:"uppercase",letterSpacing:".05em",borderBottom:"1px solid var(--border)",whiteSpace:"nowrap",...(c.sticky?{position:"sticky",left:0,background:"var(--bg-2)",zIndex:3}:{})}}>{c.l}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.map((row,i)=>(
            <tr key={i} style={{borderBottom:"1px solid var(--border)",background:i%2?"var(--bg-2)":"transparent"}}>
              {cols.map(c=>{
                const v=row[c.k]; const isN=typeof v==="number";
                const dc=isN&&c.k.startsWith("Diff")?diffColor(v):c.color||"var(--text)";
                return(<td key={c.k} style={{padding:"8px 12px",textAlign:c.right?"right":"left",color:dc,fontWeight:c.bold?700:400,whiteSpace:"nowrap",fontFamily:isN?"var(--mono)":"var(--font)",...(c.sticky?{position:"sticky",left:0,background:i%2?"var(--bg-2)":"var(--surface)",zIndex:1}:{})}}>
                  {v!=null?(isN?(v>0&&c.k.startsWith("Diff")?"+":"")+fmtN(v):v):""}
                </td>);
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── FEEDER TABLE (flat list with grouping) ───────────────────────────────────
function FeederTable({data}) {
  if (!data?.length) return <Empty msg="No feeder data — adjust filters and apply"/>;
  return(
    <div style={{overflowX:"auto",maxHeight:540}}>
      <table style={{borderCollapse:"collapse",fontSize:12,minWidth:700}}>
        <thead style={{position:"sticky",top:0,zIndex:2}}>
          <tr style={{background:"var(--bg-2)"}}>
            {["Date","Label","Line","Route","Stop","Type","PAX","Bookings"].map(h=>(
              <th key={h} style={{padding:"9px 12px",textAlign:h==="PAX"||h==="Bookings"?"right":"left",fontSize:10,fontWeight:700,color:"var(--text-dim)",textTransform:"uppercase",borderBottom:"1px solid var(--border)",whiteSpace:"nowrap"}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((r,i)=>(
            <tr key={i} style={{borderBottom:"1px solid var(--border)",background:i%2?"var(--bg-2)":"transparent"}}>
              <td style={{padding:"8px 12px",color:"var(--blue)",fontWeight:600,whiteSpace:"nowrap",fontFamily:"var(--mono)"}}>{r.DepartureDate}</td>
              <td style={{padding:"8px 12px",color:"var(--text)",whiteSpace:"nowrap"}}>{r.LabelName}</td>
              <td style={{padding:"8px 12px",color:"var(--text-muted)",fontSize:11,whiteSpace:"nowrap"}}>{r.FeederLine}</td>
              <td style={{padding:"8px 12px",color:"var(--text-muted)"}}>{r.RouteNo} {r.RouteLabel}</td>
              <td style={{padding:"8px 12px",color:"var(--text)",fontWeight:500}}>{r.StopName}</td>
              <td style={{padding:"8px 12px",color:"var(--text-dim)",fontSize:11}}>{r.StopType}</td>
              <td style={{padding:"8px 12px",textAlign:"right",color:"var(--green)",fontWeight:700,fontFamily:"var(--mono)"}}>{fmtN(r.TotalPax)}</td>
              <td style={{padding:"8px 12px",textAlign:"right",color:"var(--text-muted)",fontFamily:"var(--mono)"}}>{fmtN(r.BookingCount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── DECK TABLE ───────────────────────────────────────────────────────────────
function DeckTable({data}) {
  if (!data?.length) return <Empty msg="No deck data — adjust filters and apply"/>;
  const allZero = data.every(r => !r.Total_Lower && !r.Total_Upper);
  const sections=[
    {k:"Total",label:"Total",color:"#3b82f6",cols:[{k:"Total",l:"Total",bold:true},{k:"Total_Lower",l:"Lower"},{k:"Total_Upper",l:"Upper"},{k:"Total_NoDeck",l:"No Deck"}]},
    {k:"Royal",label:"Royal Class",color:"#a855f7",cols:[{k:"Royal_Total",l:"Total",bold:true},{k:"Royal_Lower",l:"Lower"},{k:"Royal_Upper",l:"Upper"},{k:"Royal_NoDeck",l:"No Deck"}]},
    {k:"First",label:"First Class",color:"#10b981",cols:[{k:"First_Total",l:"Total",bold:true},{k:"First_Lower",l:"Lower"},{k:"First_Upper",l:"Upper"},{k:"First_NoDeck",l:"No Deck"}]},
    {k:"Premium",label:"Premium",color:"#f59e0b",cols:[{k:"Premium_Total",l:"Total",bold:true},{k:"Premium_Lower",l:"Lower"},{k:"Premium_Upper",l:"Upper"},{k:"Premium_NoDeck",l:"No Deck"}]},
  ];
  return(
    <div>
      {allZero&&<div style={{padding:"8px 16px",background:"var(--amber-dim)",borderBottom:"1px solid rgba(245,158,11,.3)",fontSize:11,color:"var(--amber)",display:"flex",alignItems:"center",gap:6}}>{I.warn} Lower / Upper deck not yet assigned for 2026 — pipeline pending (Samir aware)</div>}
      <div style={{overflowX:"auto",maxHeight:540}}>
        <table style={{borderCollapse:"collapse",fontSize:12,minWidth:900}}>
          <thead style={{position:"sticky",top:0,zIndex:3}}>
            <tr style={{background:"var(--bg-2)"}}>
              <th rowSpan={2} style={{padding:"9px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:"var(--text-dim)",textTransform:"uppercase",borderBottom:"1px solid var(--border)",whiteSpace:"nowrap",position:"sticky",left:0,background:"var(--bg-2)",zIndex:4}}>Datum</th>
              {sections.map(s=><th key={s.k} colSpan={4} style={{padding:"7px 14px",textAlign:"center",fontSize:10,fontWeight:700,color:s.color,textTransform:"uppercase",borderBottom:`2px solid ${s.color}`,borderLeft:`2px solid ${s.color}33`,background:`${s.color}11`,letterSpacing:".05em"}}>{s.label}</th>)}
            </tr>
            <tr style={{background:"var(--bg-2)",position:"sticky",top:33,zIndex:2}}>
              {sections.map(s=>s.cols.map((c,ci)=><th key={`${s.k}-${c.k}`} style={{padding:"6px 10px",textAlign:"right",fontSize:10,fontWeight:700,color:"var(--text-dim)",textTransform:"uppercase",borderBottom:"1px solid var(--border)",background:"var(--bg-2)",whiteSpace:"nowrap",...(ci===0?{borderLeft:`2px solid ${s.color}33`}:{})}}>{c.l}</th>))}
            </tr>
          </thead>
          <tbody>
            {data.map((row,i)=>(
              <tr key={i} style={{borderBottom:"1px solid var(--border)",background:i%2?"var(--bg-2)":"transparent"}}>
                <td style={{padding:"8px 14px",color:"var(--blue)",fontWeight:700,whiteSpace:"nowrap",position:"sticky",left:0,background:i%2?"var(--bg-2)":"var(--surface)",fontFamily:"var(--mono)"}}>{row.dateDeparture}</td>
                {sections.map(s=>s.cols.map((c,ci)=>{
                  const v=row[c.k]||0;
                  return(<td key={`${s.k}-${c.k}`} style={{padding:"8px 10px",textAlign:"right",fontWeight:c.bold?700:400,color:v>0?(c.bold?s.color:"var(--text)"):"var(--text-dim)",fontFamily:"var(--mono)",...(ci===0?{borderLeft:`2px solid ${s.color}33`}:{})}}>
                    {v>0?fmtN(v):""}
                  </td>);
                }))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{padding:"8px 16px",borderTop:"1px solid var(--border)",fontSize:10,color:"var(--text-dim)"}}>RC = Royal Class | FC = First Class | PRE = Premium · Deck: Garantie Onderdek = Lower | Garantie Bovendek = Upper | Geen garantie = No Deck</div>
    </div>
  );
}

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────
function Empty({msg}) {
  return <div style={{padding:40,textAlign:"center",color:"var(--text-muted)",fontSize:13}}>{msg||"No data"}</div>;
}

// ─── BUS OCCUPANCY TAB ────────────────────────────────────────────────────────
function BusTab() {
  const [sub,setSub]            = useState("pendel");
  const [busStatus,setBusStatus]= useState("all");
  const [dateFrom,setDateFrom]  = useState(`${new Date().getFullYear()}-01-01`);
  const [dateTo,setDateTo]      = useState(`${new Date().getFullYear()}-12-31`);
  const [kpis,setKpis]          = useState(null);
  const [pendel,setPendel]      = useState([]);
  const [feeder,setFeeder]      = useState([]);
  const [deck,setDeck]          = useState([]);
  const [loading,setLoading]    = useState(false);

  // Advanced slicer state
  const [slicers,setSlicers]    = useState({regions:[],pendels:[],weekdays:['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],feederLines:[],labels:[]});
  const [pendelFilter,setPendelFilter]  = useState([]);
  const [regionFilter,setRegionFilter]  = useState([]);
  const [weekdayFilter,setWeekdayFilter]= useState([]);
  const [feederLineFilter,setFeederLine]= useState([]);
  const [labelFilter,setLabelFilter]    = useState([]);
  const [directionFilter,setDirection]  = useState("");

  useEffect(()=>{
    apiFetch("/api/dashboard/bus-slicers").then(d=>{
      setSlicers(s=>({...s,...d}));
    }).catch(()=>{});
    // Also fetch feeder lines and labels
    apiFetch("/api/dashboard/feeder-slicers").then(d=>{
      setSlicers(s=>({...s,...d}));
    }).catch(()=>{});
  },[]);

  const load = useCallback(async()=>{
    setLoading(true);
    const base={dateFrom,dateTo,busStatus};
    const pendParams={dateFrom,dateTo,
      ...(weekdayFilter.length===1?{weekday:weekdayFilter[0]}:{}),
      ...(pendelFilter.length>0?{pendel:pendelFilter[0]}:{}),
      ...(regionFilter.length>0?{region:regionFilter[0]}:{}),
    };
    const feedParams={dateFrom,dateTo,
      ...(feederLineFilter.length===1?{feederLine:feederLineFilter[0]}:{}),
      ...(labelFilter.length===1?{label:labelFilter[0]}:{}),
      ...(directionFilter?{direction:directionFilter}:{}),
      ...(weekdayFilter.length===1?{weekday:weekdayFilter[0]}:{}),
    };
    try{
      const [k,p,f,d]=await Promise.allSettled([
        apiFetch("/api/dashboard/bus-kpis",base),
        apiFetch("/api/dashboard/bus-pendel",pendParams),
        apiFetch("/api/dashboard/bus-feeder",feedParams),
        apiFetch("/api/dashboard/bus-deck",base),
      ]);
      if(k.status==="fulfilled") setKpis(k.value);
      if(p.status==="fulfilled") setPendel(Array.isArray(p.value)?p.value:[]);
      if(f.status==="fulfilled") setFeeder(Array.isArray(f.value)?f.value:[]);
      if(d.status==="fulfilled") setDeck(Array.isArray(d.value)?d.value:[]);
    }catch{}finally{setLoading(false);}
  },[dateFrom,dateTo,busStatus,pendelFilter,regionFilter,weekdayFilter,feederLineFilter,labelFilter,directionFilter]);

  useEffect(()=>{load();},[load]);

  const iS={padding:"6px 10px",background:"var(--bg)",border:"1px solid var(--border)",borderRadius:"var(--radius)",color:"var(--text)",fontSize:12,outline:"none",width:"100%"};
  const lS={fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".05em",color:"var(--text-dim)",marginBottom:4,display:"block"};

  // Which filters are relevant per sub-tab
  const isPendel = sub==="pendel";
  const isFeeder = sub==="feeder";
  const isDeck   = sub==="deck";

  return(
    <div className="tab-content">
      {/* Top filter bar — always visible */}
      <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"14px 16px",display:"flex",gap:14,alignItems:"flex-end",flexWrap:"wrap"}}>
        <div style={{display:"flex",flexDirection:"column",gap:4}}>
          <label style={lS}>From</label>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{...iS,width:"auto"}}/>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:4}}>
          <label style={lS}>To</label>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{...iS,width:"auto"}}/>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:4}}>
          <label style={lS}>Status</label>
          <BusStatusFilter value={busStatus} onChange={setBusStatus}/>
        </div>
        <button onClick={load} disabled={loading} style={{padding:"7px 20px",borderRadius:"var(--radius)",background:"var(--blue)",border:"none",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",alignSelf:"flex-end",opacity:loading?.6:1}}>
          {loading?"Loading…":"Apply"}
        </button>
      </div>

      {/* KPI Cards */}
      <BusKpis data={kpis}/>

      {/* Sub-tabs + advanced filters + table */}
      <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",overflow:"hidden"}}>
        {/* Sub-tab nav */}
        <div style={{display:"flex",borderBottom:"1px solid var(--border)"}}>
          {[["pendel","Pendel Overview"],["feeder","Feeder Overview"],["deck","Deck Choice / Class"]].map(([k,l])=>(
            <button key={k} onClick={()=>setSub(k)} style={{padding:"11px 18px",background:"none",border:"none",borderBottom:`2px solid ${sub===k?"var(--blue)":"transparent"}`,color:sub===k?"var(--blue)":"var(--text-muted)",fontSize:13,fontWeight:sub===k?600:400,cursor:"pointer",whiteSpace:"nowrap"}}>{l}</button>
          ))}
        </div>

        {/* Per-tab advanced filters */}
        {isPendel&&(
          <div style={{display:"flex",gap:12,padding:"12px 16px",borderBottom:"1px solid var(--border)",flexWrap:"wrap",background:"var(--bg-2)"}}>
            <div style={{minWidth:140,flex:1}}>
              <label style={lS}>Pendel</label>
              <MultiSelect options={slicers.pendels||[]} value={pendelFilter} onChange={setPendelFilter} placeholder="All pendels"/>
            </div>
            <div style={{minWidth:140,flex:1}}>
              <label style={lS}>Region</label>
              <MultiSelect options={slicers.regions||[]} value={regionFilter} onChange={setRegionFilter} placeholder="All regions"/>
            </div>
            <div style={{minWidth:140,flex:1}}>
              <label style={lS}>Weekday (outbound)</label>
              <MultiSelect options={slicers.weekdays||[]} value={weekdayFilter} onChange={setWeekdayFilter} placeholder="All days"/>
            </div>
          </div>
        )}
        {isFeeder&&(
          <div style={{display:"flex",gap:12,padding:"12px 16px",borderBottom:"1px solid var(--border)",flexWrap:"wrap",background:"var(--bg-2)"}}>
            <div style={{minWidth:160,flex:1}}>
              <label style={lS}>Feeder Line</label>
              <MultiSelect options={slicers.feederLines||[]} value={feederLineFilter} onChange={setFeederLine} placeholder="All feeder lines"/>
            </div>
            <div style={{minWidth:140,flex:1}}>
              <label style={lS}>Label / Dataset</label>
              <MultiSelect options={slicers.labels||[]} value={labelFilter} onChange={setLabelFilter} placeholder="All labels"/>
            </div>
            <div style={{minWidth:120,flex:1}}>
              <label style={lS}>Direction</label>
              <select value={directionFilter} onChange={e=>setDirection(e.target.value)} style={iS}>
                <option value="">Both directions</option>
                <option value="Outbound">Outbound</option>
                <option value="Inbound">Inbound</option>
              </select>
            </div>
            <div style={{minWidth:140,flex:1}}>
              <label style={lS}>Weekday</label>
              <MultiSelect options={slicers.weekdays||[]} value={weekdayFilter} onChange={setWeekdayFilter} placeholder="All days"/>
            </div>
          </div>
        )}
        {isDeck&&(
          <div style={{display:"flex",gap:12,padding:"12px 16px",borderBottom:"1px solid var(--border)",flexWrap:"wrap",background:"var(--bg-2)"}}>
            <div style={{minWidth:140,flex:1}}>
              <label style={lS}>Pendel</label>
              <MultiSelect options={slicers.pendels||[]} value={pendelFilter} onChange={setPendelFilter} placeholder="All pendels"/>
            </div>
            <div style={{minWidth:140,flex:1}}>
              <label style={lS}>Weekday</label>
              <MultiSelect options={slicers.weekdays||[]} value={weekdayFilter} onChange={setWeekdayFilter} placeholder="All days"/>
            </div>
          </div>
        )}

        {sub==="pendel"&&<PendelTable data={pendel}/>}
        {sub==="feeder"&&<FeederTable data={feeder}/>}
        {sub==="deck"  &&<DeckTable   data={deck}/>}
      </div>
    </div>
  );
}

// ─── HOTEL TAB ────────────────────────────────────────────────────────────────
function HotelTab() {
  const [ratings,setRatings]=useState([]);
  const [stats,setStats]=useState(null);
  const [reviews,setReviews]=useState([]);
  const [revTotal,setRevTotal]=useState(0);
  const [revPage,setRevPage]=useState(1);
  const [selHotel,setSelHotel]=useState(null);
  const [search,setSearch]=useState("");
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    Promise.all([apiFetch("/api/dashboard/hotel-stats"),apiFetch("/api/dashboard/hotel-ratings")])
      .then(([s,r])=>{setStats(s);setRatings(Array.isArray(r)?r:[]);})
      .catch(()=>{}).finally(()=>setLoading(false));
  },[]);

  const loadReviews=(code,pg=1)=>{
    setSelHotel(code); setRevPage(pg);
    apiFetch("/api/dashboard/hotel-reviews",{code,page:pg,limit:20}).then(d=>{setReviews(d.rows||[]);setRevTotal(d.total||0);}).catch(()=>{});
  };

  const filtered=ratings.filter(r=>(r.accommodation_name||"").toLowerCase().includes(search.toLowerCase()));
  const sc=v=>v>=80?"var(--green)":v>=60?"var(--amber)":"var(--red)";

  if(loading) return <Empty msg="Loading hotel data…"/>;

  return(
    <div className="tab-content">
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:20}}>
        {[{l:"Total Hotels",v:fmtN(stats?.total_hotels)},{l:"Total Reviews",v:fmtN(stats?.total_reviews)},{l:"Avg Score",v:stats?.avg_rating?`${Math.round(stats.avg_rating)}/100`:"—"},{l:"High Rated ≥80",v:fmtN(stats?.high_rated)},{l:"Latest Review",v:stats?.latest_review?.split("T")[0]||"—"}].map(s=>(
          <div key={s.l} style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"14px 16px"}}>
            <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--text-dim)",marginBottom:6}}>{s.l}</div>
            <div style={{fontSize:20,fontWeight:800,color:"var(--text)",fontFamily:"var(--mono)"}}>{s.v||"—"}</div>
          </div>
        ))}
      </div>
      <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",overflow:"hidden",marginBottom:selHotel?20:0}}>
        <div style={{padding:"12px 16px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <span style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>{filtered.length} hotels</span>
          <div style={{position:"relative"}}>
            <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:"var(--text-dim)"}}>{I.search}</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search hotel…" style={{padding:"6px 12px 6px 28px",background:"var(--bg)",border:"1px solid var(--border)",borderRadius:"var(--radius)",color:"var(--text)",fontSize:12,outline:"none",width:200}}/>
          </div>
        </div>
        <div style={{overflowX:"auto",maxHeight:420}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead style={{position:"sticky",top:0,zIndex:1}}>
              <tr style={{background:"var(--bg-2)"}}>
                {["Hotel","Code","Overall","Location","Hygiene","Service","Reviews",""].map(h=>(
                  <th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:10,fontWeight:700,color:"var(--text-dim)",textTransform:"uppercase",borderBottom:"1px solid var(--border)",whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0,100).map((r,i)=>(
                <tr key={r.accommodation_code} style={{borderBottom:"1px solid var(--border)",background:i%2?"var(--bg-2)":"transparent"}}>
                  <td style={{padding:"8px 12px",color:"var(--text)",fontWeight:500,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.accommodation_name||"—"}</td>
                  <td style={{padding:"8px 12px",color:"var(--text-muted)",fontFamily:"var(--mono)",fontSize:11}}>{r.accommodation_code}</td>
                  <td style={{padding:"8px 12px",color:sc(r.avg_overall),fontWeight:700,fontFamily:"var(--mono)"}}>{r.avg_overall||"—"}</td>
                  <td style={{padding:"8px 12px",color:"var(--text-muted)"}}>{r.avg_location||"—"}</td>
                  <td style={{padding:"8px 12px",color:"var(--text-muted)"}}>{r.avg_cleanliness||"—"}</td>
                  <td style={{padding:"8px 12px",color:"var(--text-muted)"}}>{r.avg_service||"—"}</td>
                  <td style={{padding:"8px 12px",color:"var(--text-muted)",fontFamily:"var(--mono)"}}>{fmtN(r.total_reviews)}</td>
                  <td style={{padding:"8px 12px"}}><button onClick={()=>loadReviews(r.accommodation_code)} style={{padding:"4px 10px",borderRadius:6,border:"1px solid var(--border)",background:"transparent",color:"var(--blue)",fontSize:11,cursor:"pointer"}}>Reviews</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selHotel&&(
        <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",overflow:"hidden"}}>
          <div style={{padding:"12px 16px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>Reviews — {selHotel} <span style={{color:"var(--text-muted)",fontWeight:400,fontSize:12}}>({fmtN(revTotal)} total)</span></span>
            <button onClick={()=>setSelHotel(null)} style={{background:"none",border:"none",color:"var(--text-muted)",cursor:"pointer"}}>{I.close}</button>
          </div>
          <div style={{padding:16,display:"flex",flexDirection:"column",gap:12,maxHeight:420,overflowY:"auto"}}>
            {reviews.map((r,i)=>(
              <div key={i} style={{background:"var(--bg-2)",border:"1px solid var(--border)",borderRadius:"var(--radius)",padding:"12px 14px"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <span style={{fontSize:15,fontWeight:800,color:sc(r.overall_rating),fontFamily:"var(--mono)"}}>{r.overall_rating||"—"}</span>
                  <span style={{fontSize:13,fontWeight:600,color:"var(--text)",flex:1}}>{r.review_title||"—"}</span>
                  <span style={{fontSize:11,color:"var(--text-dim)",whiteSpace:"nowrap"}}>{r.review_date?.split("T")[0]}</span>
                </div>
                <p style={{fontSize:13,color:"var(--text-muted)",lineHeight:1.6,marginBottom:8}}>{r.review_text||"No text"}</p>
                <div style={{fontSize:11,color:"var(--text-dim)"}}>{r.reviewer_name} · {r.reviewer_country} · {r.travel_type}</div>
              </div>
            ))}
            {!reviews.length&&<Empty msg="No reviews"/>}
          </div>
          {revTotal>20&&(
            <div style={{padding:"10px 16px",borderTop:"1px solid var(--border)",display:"flex",gap:8,justifyContent:"center"}}>
              {revPage>1&&<button onClick={()=>loadReviews(selHotel,revPage-1)} style={{padding:"5px 14px",borderRadius:"var(--radius)",border:"1px solid var(--border)",background:"transparent",color:"var(--text-muted)",fontSize:12,cursor:"pointer"}}>Prev</button>}
              <span style={{fontSize:12,color:"var(--text-muted)",alignSelf:"center"}}>Page {revPage} of {Math.ceil(revTotal/20)}</span>
              {revPage<Math.ceil(revTotal/20)&&<button onClick={()=>loadReviews(selHotel,revPage+1)} style={{padding:"5px 14px",borderRadius:"var(--radius)",border:"1px solid var(--border)",background:"transparent",color:"var(--text-muted)",fontSize:12,cursor:"pointer"}}>Next</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── DATA TABLE TAB ───────────────────────────────────────────────────────────
function DataTableTab({applied}) {
  const [rows,setRows]      = useState([]);
  const [total,setTotal]    = useState(0);
  const [page,setPage]      = useState(1);
  const [loading,setLoading]= useState(false);
  const [search,setSearch]  = useState("");
  // Local filters (independent from overview)
  const [dsFilter,setDsFilter]       = useState([]);
  const [statusFilter,setStatusFilter]= useState("");
  const [bookFrom,setBookFrom]       = useState("");
  const [bookTo,setBookTo]           = useState("");
  const [depFrom,setDepFrom]         = useState("");
  const [depTo,setDepTo]             = useState("");

  const buildTableParams = useCallback((pg=1) => ({
    ...applied,
    ...(dsFilter.length?{dataset:dsFilter}:{}),
    ...(statusFilter?{status:statusFilter}:{}),
    ...(bookFrom?{bookingDateFrom:bookFrom}:{}),
    ...(bookTo?{bookingDateTo:bookTo}:{}),
    ...(depFrom?{departureDateFrom:depFrom}:{}),
    ...(depTo?{departureDateTo:depTo}:{}),
    page:pg,limit:50,
  }),[applied,dsFilter,statusFilter,bookFrom,bookTo,depFrom,depTo]);

  const load=useCallback(async(pg=1)=>{
    setLoading(true);
    try{
      const d=await apiFetch("/api/dashboard/bookings-table",buildTableParams(pg));
      setRows(d.rows||[]);setTotal(d.total||0);setPage(pg);
    }catch{}finally{setLoading(false);}
  },[buildTableParams]);

  useEffect(()=>{load(1);},[load]);

  const exportCSV=async()=>{
    try{
      const d=await apiFetch("/api/dashboard/bookings-table",{...buildTableParams(1),limit:10000});
      const r=d.rows||[];
      if(!r.length) return;
      const keys=Object.keys(r[0]);
      const csv=[keys.join(","),...r.map(row=>keys.map(k=>`"${String(row[k]??"")}"`).join(","))].join("\n");
      const a=document.createElement("a");a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv);a.download=`ttp-bookings-${new Date().toISOString().split("T")[0]}.csv`;a.click();
    }catch(e){alert("Export failed: "+e.message);}
  };

  const filtered=rows.filter(r=>!search||Object.values(r).some(v=>String(v).toLowerCase().includes(search.toLowerCase())));
  const statusColor=s=>s==="Confirmed"?"var(--green)":"var(--red)";
  const iS={padding:"6px 10px",background:"var(--bg)",border:"1px solid var(--border)",borderRadius:"var(--radius)",color:"var(--text)",fontSize:12,outline:"none"};
  const lS={fontSize:10,fontWeight:700,textTransform:"uppercase",color:"var(--text-dim)",marginBottom:3,display:"block"};

  return(
    <div className="tab-content">
      {/* Filters row */}
      <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"14px 16px",display:"flex",gap:14,flexWrap:"wrap",alignItems:"flex-end"}}>
        <div style={{minWidth:160,flex:1}}>
          <label style={lS}>Dataset</label>
          <MultiSelect options={["Solmar","Interbus","Solmar DE","Snowtravel"]} value={dsFilter} onChange={setDsFilter} placeholder="All datasets"/>
        </div>
        <div style={{flex:"0 0 auto"}}>
          <label style={lS}>Status</label>
          <div style={{display:"flex",gap:4}}>
            {[["","All"],["confirmed","Confirmed"],["cancelled","Cancelled"]].map(([v,l])=>(
              <button key={v} onClick={()=>setStatusFilter(v)} style={{padding:"5px 12px",borderRadius:20,border:`1px solid ${statusFilter===v?"var(--blue)":"var(--border)"}`,background:statusFilter===v?"var(--blue-dim)":"transparent",color:statusFilter===v?"var(--blue)":"var(--text-muted)",fontSize:11,fontWeight:statusFilter===v?700:400,cursor:"pointer"}}>{l}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={lS}>Booking Date</label>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <input type="date" value={bookFrom} onChange={e=>setBookFrom(e.target.value)} style={iS}/>
            <span style={{color:"var(--text-dim)",fontSize:11}}>→</span>
            <input type="date" value={bookTo} onChange={e=>setBookTo(e.target.value)} style={iS}/>
          </div>
        </div>
        <div>
          <label style={lS}>Departure Date</label>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <input type="date" value={depFrom} onChange={e=>setDepFrom(e.target.value)} style={iS}/>
            <span style={{color:"var(--text-dim)",fontSize:11}}>→</span>
            <input type="date" value={depTo} onChange={e=>setDepTo(e.target.value)} style={iS}/>
          </div>
        </div>
        <button onClick={()=>load(1)} style={{padding:"7px 18px",borderRadius:"var(--radius)",background:"var(--blue)",border:"none",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",alignSelf:"flex-end"}}>Apply</button>
        <button onClick={()=>{setDsFilter([]);setStatusFilter("");setBookFrom("");setBookTo("");setDepFrom("");setDepTo("");}} style={{padding:"7px 12px",borderRadius:"var(--radius)",background:"transparent",border:"1px solid var(--border)",color:"var(--text-muted)",fontSize:12,cursor:"pointer",alignSelf:"flex-end"}}>Reset</button>
      </div>

      <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",overflow:"hidden"}}>
        <div style={{padding:"12px 16px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <span style={{fontSize:13,fontWeight:700,color:"var(--text)",flex:1}}>Bookings — {fmtN(total)} records</span>
          <div style={{position:"relative"}}><span style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",color:"var(--text-dim)"}}>{I.search}</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" style={{padding:"6px 12px 6px 28px",background:"var(--bg)",border:"1px solid var(--border)",borderRadius:"var(--radius)",color:"var(--text)",fontSize:12,outline:"none",width:180}}/></div>
          <button onClick={()=>load(page)} style={{padding:"6px 12px",borderRadius:"var(--radius)",background:"var(--surface-2)",border:"1px solid var(--border)",color:"var(--text-muted)",fontSize:12,cursor:"pointer"}}>Refresh</button>
          <button onClick={exportCSV} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:"var(--radius)",background:"var(--blue-dim)",border:"1px solid rgba(77,158,255,.3)",color:"var(--blue)",fontSize:12,cursor:"pointer"}}>{I.download} Export CSV</button>
        </div>
        {loading&&<div style={{height:3,background:"linear-gradient(90deg,var(--blue),var(--green))"}}/>}
        <div style={{overflowX:"auto",maxHeight:520}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead style={{position:"sticky",top:0,zIndex:1}}>
              <tr style={{background:"var(--bg-2)"}}>
                {["Booking ID","Dataset","Status","Label","Booking Date","Departure","Return","PAX","Revenue","Transport","Class","City","Country"].map(h=>(
                  <th key={h} style={{padding:"9px 10px",textAlign:h==="PAX"||h==="Revenue"?"right":"left",fontSize:10,fontWeight:700,color:"var(--text-dim)",textTransform:"uppercase",letterSpacing:".05em",borderBottom:"1px solid var(--border)",whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!filtered.length&&!loading&&<tr><td colSpan={13} style={{padding:24,textAlign:"center",color:"var(--text-muted)"}}>No data — apply filters and click Apply</td></tr>}
              {filtered.map((r,i)=>(
                <tr key={i} style={{borderBottom:"1px solid var(--border)",background:i%2?"var(--bg-2)":"transparent"}}>
                  <td style={{padding:"7px 10px",color:"var(--text-muted)",fontFamily:"var(--mono)",fontSize:11,whiteSpace:"nowrap"}}>{r.BookingID}</td>
                  <td style={{padding:"7px 10px",color:"var(--blue)",fontWeight:500}}>{r.Dataset}</td>
                  <td style={{padding:"7px 10px"}}><span style={{background:`${statusColor(r.Status)}22`,color:statusColor(r.Status),padding:"2px 7px",borderRadius:10,fontSize:11,fontWeight:600}}>{r.Status}</span></td>
                  <td style={{padding:"7px 10px",color:"var(--text)",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.Label}</td>
                  <td style={{padding:"7px 10px",color:"var(--text-muted)",whiteSpace:"nowrap",fontFamily:"var(--mono)",fontSize:11}}>{r.BookingDate}</td>
                  <td style={{padding:"7px 10px",color:"var(--text)",whiteSpace:"nowrap",fontFamily:"var(--mono)",fontWeight:500}}>{r.DepartureDate}</td>
                  <td style={{padding:"7px 10px",color:"var(--text-muted)",whiteSpace:"nowrap",fontFamily:"var(--mono)",fontSize:11}}>{r.ReturnDate}</td>
                  <td style={{padding:"7px 10px",textAlign:"right",color:"var(--text)",fontFamily:"var(--mono)"}}>{fmtN(r.PAX)}</td>
                  <td style={{padding:"7px 10px",textAlign:"right",color:"var(--amber)",fontFamily:"var(--mono)",fontWeight:600}}>{fmtEur(r.Revenue)}</td>
                  <td style={{padding:"7px 10px",color:"var(--text-muted)",fontSize:11}}>{r.TransportType}</td>
                  <td style={{padding:"7px 10px",color:"var(--text-muted)",fontSize:11}}>{r.BusClass}</td>
                  <td style={{padding:"7px 10px",color:"var(--text-muted)",fontSize:11}}>{r.City}</td>
                  <td style={{padding:"7px 10px",color:"var(--text-muted)",fontSize:11}}>{r.Country}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{padding:"10px 16px",borderTop:"1px solid var(--border)",display:"flex",alignItems:"center",gap:8,fontSize:12,color:"var(--text-muted)"}}>
          <span>Page {page} · {rows.length} of {fmtN(total)}</span>
          <div style={{marginLeft:"auto",display:"flex",gap:6}}>
            {page>1&&<button onClick={()=>load(page-1)} style={{padding:"5px 12px",borderRadius:"var(--radius)",border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text-muted)",fontSize:12,cursor:"pointer"}}>Prev</button>}
            {rows.length===50&&<button onClick={()=>load(page+1)} style={{padding:"5px 12px",borderRadius:"var(--radius)",border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text-muted)",fontSize:12,cursor:"pointer"}}>Next</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AI TAB ───────────────────────────────────────────────────────────────────
function AiTab({user,kpiData}) {
  const [msgs,setMsgs]=useState([{role:"assistant",content:"Hi, I'm TTP AI — your analytics assistant.\n\nI have direct access to the live TTP Azure SQL database. I'll always verify data before answering, and if your question needs clarification I'll ask one focused question rather than guessing.\n\nWhat would you like to know?",ts:new Date()}]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const endRef=useRef(null),inputRef=useRef(null);

  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);

  const send=async(text)=>{
    const msg=(text||input).trim(); if(!msg||loading) return;
    setInput(""); setMsgs(p=>[...p,{role:"user",content:msg,ts:new Date()}]); setLoading(true);
    try{
      const r=await fetch(`${BASE}/api/ai/chat`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${getToken()}`},body:JSON.stringify({message:msg,history:msgs.slice(-10).map(m=>({role:m.role,content:m.content}))})});
      const d=await r.json();
      setMsgs(p=>[...p,{role:"assistant",content:d.reply||"No response.",source:d.source,ts:new Date()}]);
    }catch{setMsgs(p=>[...p,{role:"assistant",content:"Connection error. Please try again.",isError:true,ts:new Date()}]);}
    finally{setLoading(false);setTimeout(()=>inputRef.current?.focus(),100);}
  };

  const fmt=d=>`${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
  const SUGGESTED=["Total bookings 2026 vs 2025?","Revenue by dataset all time","Cancellation rate this year","Solmar confirmed PAX this year","Which month had most bookings in 2025?","Compare Solmar vs Snowtravel 2026 revenue"];

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 108px)",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-xl)",overflow:"hidden"}}>
      {kpiData&&(
        <div style={{display:"flex",alignItems:"center",gap:20,padding:"9px 20px",background:"var(--bg-2)",borderBottom:"1px solid var(--border)",overflowX:"auto",flexShrink:0}}>
          {[["Live DB","● Connected","var(--green)"],["2026 Bookings",fmtN(kpiData.currentBookings),null],["2026 Revenue",fmtEur(kpiData.currentRevenue),null],["2026 PAX",fmtN(kpiData.currentPax),null]].map(([l,v,c])=>(
            <div key={l} style={{display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap"}}>
              <span style={{fontSize:11,color:"var(--text-dim)"}}>{l}</span>
              <span style={{fontSize:12,fontWeight:600,fontFamily:"var(--mono)",color:c||"var(--text)"}}>{v}</span>
            </div>
          ))}
          <span style={{fontSize:11,color:"var(--text-dim)",marginLeft:"auto",whiteSpace:"nowrap"}}>AI asks one clarifying question if unsure</span>
        </div>
      )}
      <div style={{flex:1,overflowY:"auto",padding:20,display:"flex",flexDirection:"column",gap:18}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start",flexDirection:m.role==="user"?"row-reverse":"row"}}>
            <div style={{width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:600,flexShrink:0,background:m.role==="assistant"?"var(--blue-dim)":"var(--surface-3)",color:m.role==="assistant"?"var(--blue)":"var(--text-muted)",border:m.role==="assistant"?"1px solid rgba(77,158,255,.25)":"none"}}>
              {m.role==="assistant"?"✦":(user?.name||"U")[0].toUpperCase()}
            </div>
            <div style={{flex:1,maxWidth:680,display:"flex",flexDirection:"column",alignItems:m.role==="user"?"flex-end":"flex-start"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,flexDirection:m.role==="user"?"row-reverse":"row"}}>
                <span style={{fontSize:12,fontWeight:600,color:"var(--text)"}}>{m.role==="assistant"?"TTP AI":user?.name||"You"}</span>
                {m.source&&<span style={{fontSize:10,padding:"1px 6px",borderRadius:10,background:m.source==="openai"?"var(--green-dim)":"var(--amber-dim)",color:m.source==="openai"?"var(--green)":"var(--amber)"}}>{m.source==="openai"?"GPT-4o":"fallback"}</span>}
                <span style={{fontSize:11,color:"var(--text-dim)"}}>{fmt(m.ts)}</span>
              </div>
              <div style={{background:m.role==="user"?"var(--blue-dim)":m.isError?"var(--red-dim)":"var(--surface-2)",border:`1px solid ${m.role==="user"?"rgba(77,158,255,.2)":m.isError?"rgba(248,113,113,.2)":"var(--border)"}`,borderRadius:12,borderTopLeftRadius:m.role==="assistant"?3:12,borderTopRightRadius:m.role==="user"?3:12,padding:"11px 14px",fontSize:13,lineHeight:1.6,color:"var(--text)"}}>
                {m.content.split("\n").map((line,j)=><p key={j} style={{marginBottom:2}}>{line||"\u00A0"}</p>)}
              </div>
            </div>
          </div>
        ))}
        {loading&&(
          <div style={{display:"flex",gap:12}}>
            <div style={{width:32,height:32,borderRadius:"50%",background:"var(--blue-dim)",color:"var(--blue)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>✦</div>
            <div style={{background:"var(--surface-2)",border:"1px solid var(--border)",borderRadius:12,borderTopLeftRadius:3,padding:"13px 16px",display:"flex",gap:5,alignItems:"center"}}>
              {[0,200,400].map(d=><span key={d} style={{width:6,height:6,borderRadius:"50%",background:"var(--text-dim)",animation:`typingDot 1.4s ease ${d}ms infinite`,display:"block"}}/>)}
            </div>
          </div>
        )}
        <div ref={endRef}/>
      </div>
      {msgs.length===1&&(
        <div style={{padding:"0 20px 12px",flexShrink:0}}>
          <p style={{fontSize:11,color:"var(--text-dim)",marginBottom:8}}>Try asking:</p>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {SUGGESTED.map((s,i)=><button key={i} onClick={()=>send(s)} style={{padding:"6px 12px",borderRadius:20,background:"var(--surface-2)",border:"1px solid var(--border)",color:"var(--text-muted)",fontSize:12,cursor:"pointer"}}>{s}</button>)}
          </div>
        </div>
      )}
      <div style={{padding:"12px 16px",borderTop:"1px solid var(--border)",background:"var(--bg-2)",flexShrink:0}}>
        <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
          <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
            placeholder="Ask about bookings, revenue, PAX, trends… (Enter to send)"
            rows={1} disabled={loading}
            style={{flex:1,minHeight:40,maxHeight:120,resize:"none",padding:"10px 14px",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",color:"var(--text)",fontSize:13,outline:"none",lineHeight:1.5,overflowY:"auto"}}/>
          <button onClick={()=>send()} disabled={loading||!input.trim()} style={{width:40,height:40,borderRadius:"var(--radius-lg)",background:"var(--blue)",border:"none",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",opacity:loading||!input.trim()?0.45:1,cursor:loading||!input.trim()?"not-allowed":"pointer"}}>
            {I.send}
          </button>
        </div>
        <p style={{fontSize:11,color:"var(--text-dim)",textAlign:"center",marginTop:6}}>TTP AI uses live Azure SQL data. Validate critical figures in the dashboard.</p>
      </div>
    </div>
  );
}

// ─── SETTINGS TAB ─────────────────────────────────────────────────────────────
function SettingsTab({user,theme,setTheme}) {
  const [stab,setStab]=useState("users");
  const [users,setUsers]=useState([]);
  const [showAdd,setShowAdd]=useState(false);
  const [nu,setNu]=useState({name:"",username:"",email:"",password:"",role:"viewer"});
  const [showPw,setShowPw]=useState(false);
  const [uLoad,setULoad]=useState(false);

  useEffect(()=>{
    if(stab!=="users") return;
    setULoad(true);
    apiFetch("/api/auth/users").then(d=>setUsers(Array.isArray(d)?d:[])).catch(()=>{}).finally(()=>setULoad(false));
  },[stab]);

  const addUser=async()=>{
    if(!nu.name||!nu.username||!nu.password){alert("Name, username and password required");return;}
    try{const r=await fetch(`${BASE}/api/auth/users`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${getToken()}`},body:JSON.stringify(nu)});const d=await r.json();if(r.ok){setUsers(p=>[...p,d]);setNu({name:"",username:"",email:"",password:"",role:"viewer"});setShowAdd(false);}else alert(d.error||"Failed");}
    catch{alert("Connection error");}
  };
  const delUser=async id=>{if(!confirm("Delete this user?"))return;await fetch(`${BASE}/api/auth/users/${id}`,{method:"DELETE",headers:{Authorization:`Bearer ${getToken()}`}});setUsers(p=>p.filter(u=>u.id!==id));};

  const iS={width:"100%",padding:"9px 12px",background:"var(--bg)",border:"1px solid var(--border)",borderRadius:"var(--radius)",color:"var(--text)",fontSize:13,outline:"none",boxSizing:"border-box"};
  const lS={fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".05em",color:"var(--text-dim)",display:"block",marginBottom:6};

  return(
    <div className="tab-content">
      <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",overflow:"hidden"}}>
        <div style={{display:"flex",borderBottom:"1px solid var(--border)",overflowX:"auto"}}>
          {[["users","User Management"],["theme","Theme"],["api","API & Integrations"],["alerts","Email Alerts"],["ai_prompts","AI Prompts"]].map(([k,l])=>(
            <button key={k} onClick={()=>setStab(k)} style={{padding:"12px 16px",background:"none",border:"none",borderBottom:`2px solid ${stab===k?"var(--blue)":"transparent"}`,color:stab===k?"var(--blue)":"var(--text-muted)",fontSize:13,fontWeight:stab===k?600:400,cursor:"pointer",whiteSpace:"nowrap"}}>{l}</button>
          ))}
        </div>
        <div style={{padding:24}}>
          {stab==="users"&&(
            <div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                <span style={{fontSize:14,fontWeight:700,color:"var(--text)"}}>User Accounts ({users.length})</span>
                <button onClick={()=>setShowAdd(true)} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:"var(--radius)",background:"var(--blue)",border:"none",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>{I.plus} Add User</button>
              </div>
              {uLoad?<Empty msg="Loading…"/>:(
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                  <thead><tr style={{background:"var(--bg-2)"}}>
                    {["Name","Username","Email","Role",""].map(h=><th key={h} style={{padding:"9px 12px",textAlign:"left",fontSize:10,fontWeight:700,color:"var(--text-dim)",textTransform:"uppercase",letterSpacing:".05em",borderBottom:"1px solid var(--border)"}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {users.map((u,i)=>(
                      <tr key={u.id} style={{borderBottom:"1px solid var(--border)",background:i%2?"var(--bg-2)":"transparent"}}>
                        <td style={{padding:"10px 12px",fontWeight:600,color:"var(--text)"}}>{u.name}</td>
                        <td style={{padding:"10px 12px",color:"var(--text-muted)",fontFamily:"var(--mono)",fontSize:12}}>{u.username}</td>
                        <td style={{padding:"10px 12px",color:"var(--text-muted)",fontSize:12}}>{u.email||"—"}</td>
                        <td style={{padding:"10px 12px"}}><span style={{padding:"2px 8px",borderRadius:10,fontSize:11,fontWeight:600,background:u.role==="admin"?"var(--blue-dim)":"var(--surface-2)",color:u.role==="admin"?"var(--blue)":"var(--text-muted)"}}>{u.role}</span></td>
                        <td style={{padding:"10px 12px"}}>{u.id!==user?.id&&<button onClick={()=>delUser(u.id)} style={{background:"none",border:"1px solid var(--border)",borderRadius:6,color:"var(--red)",cursor:"pointer",padding:"4px 8px",fontSize:11}}>Delete</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {showAdd&&(
                <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowAdd(false)}>
                  <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:16,padding:28,width:380,boxShadow:"var(--shadow-lg)"}} onClick={e=>e.stopPropagation()}>
                    <div style={{fontSize:15,fontWeight:700,color:"var(--text)",marginBottom:20}}>Add New User</div>
                    {[["Full Name","name","text"],["Username","username","text"],["Email","email","email"]].map(([l,k,t])=>(
                      <div key={k} style={{marginBottom:14}}><label style={lS}>{l}</label><input type={t} value={nu[k]||""} onChange={e=>setNu(u=>({...u,[k]:e.target.value}))} style={iS}/></div>
                    ))}
                    <div style={{marginBottom:14}}><label style={lS}>Password</label>
                      <div style={{position:"relative"}}><input type={showPw?"text":"password"} value={nu.password||""} onChange={e=>setNu(u=>({...u,password:e.target.value}))} style={{...iS,paddingRight:40}}/>
                        <button type="button" onClick={()=>setShowPw(s=>!s)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"var(--text-dim)",cursor:"pointer"}}>{showPw?I.eyeOff:I.eye}</button>
                      </div>
                    </div>
                    <div style={{marginBottom:20}}><label style={lS}>Role</label><select value={nu.role} onChange={e=>setNu(u=>({...u,role:e.target.value}))} style={iS}><option value="viewer">Viewer — view only</option><option value="admin">Admin — full access</option></select></div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={addUser} style={{flex:1,padding:"10px",borderRadius:"var(--radius)",background:"var(--blue)",border:"none",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>Add User</button>
                      <button onClick={()=>setShowAdd(false)} style={{flex:1,padding:"10px",borderRadius:"var(--radius)",background:"transparent",border:"1px solid var(--border)",color:"var(--text-muted)",fontSize:13,cursor:"pointer"}}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {stab==="theme"&&(
            <div>
              <div style={{fontSize:14,fontWeight:700,color:"var(--text)",marginBottom:12}}>Appearance</div>
              <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                {[["dark","Dark (Default)","#0d1117"],["light","Light Silver","#f1f5f9"]].map(([id,label,bg])=>(
                  <button key={id} onClick={()=>setTheme(id)} style={{padding:"16px 20px",borderRadius:12,border:`2px solid ${theme===id?"var(--blue)":"var(--border)"}`,background:bg,color:id==="dark"?"#e2e8f0":"#1e293b",fontSize:13,fontWeight:theme===id?700:400,cursor:"pointer",display:"flex",flexDirection:"column",gap:6,alignItems:"flex-start",transition:"border-color .15s"}}>
                    <span style={{fontSize:18}}>{id==="dark"?"🌙":"☀️"}</span>
                    {label}
                    {theme===id&&<span style={{fontSize:10,color:"var(--blue)",fontWeight:700}}>Active</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
          {stab==="api"&&(
            <div>
              <div style={{fontSize:13,color:"var(--text-muted)",marginBottom:16}}>Connected data sources and integrations.</div>
              {[["Azure SQL","ttpserver.database.windows.net / TTPDatabase","Connected","var(--green)"],["TravelTrustIt API","421 hotels · 9,020 reviews loaded","Connected","var(--green)"],["OpenAI (GPT-4o)","TTP AI assistant","Connected","var(--green)"]].map(([n,d,s,c])=>(
                <div key={n} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:"var(--bg-2)",border:"1px solid var(--border)",borderRadius:"var(--radius)",marginBottom:8}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:c,flexShrink:0}}/>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{n}</div><div style={{fontSize:12,color:"var(--text-muted)"}}>{d}</div></div>
                  <span style={{fontSize:11,fontWeight:600,color:c,background:`${c}22`,padding:"3px 10px",borderRadius:10}}>{s}</span>
                </div>
              ))}
            </div>
          )}
          {stab==="alerts"&&(
            <div>
              <div style={{marginBottom:14}}><label style={lS}>Alert Email</label><input type="email" placeholder="datateamttpservices@gmail.com" style={iS}/></div>
              <button style={{padding:"9px 18px",borderRadius:"var(--radius)",background:"var(--blue)",border:"none",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>Save</button>
            </div>
          )}
          {stab==="ai_prompts"&&(
            <div>
              <div style={{fontSize:14,fontWeight:700,color:"var(--text)",marginBottom:6}}>AI System Prompt</div>
              <div style={{fontSize:12,color:"var(--text-muted)",marginBottom:12}}>Controls TTP AI behavior. Changes take effect on next conversation.</div>
              <textarea defaultValue={"You are TTP AI — analytics assistant for TTP Services (Belgian travel company).\nSOURCES: CustomerOverview (Solmar/Interbus/Solmar DE) + ST_Bookings (Snowtravel)\nRULES: Never guess. Ask ONE clarifying question if ambiguous. Dutch number format."} style={{width:"100%",minHeight:160,padding:"12px 14px",background:"var(--bg)",border:"1px solid var(--border)",borderRadius:"var(--radius)",color:"var(--text)",fontSize:12,fontFamily:"var(--mono)",resize:"vertical",outline:"none",lineHeight:1.6,boxSizing:"border-box"}}/>
              <div style={{marginTop:8,display:"flex",gap:8,alignItems:"center"}}>
                <button style={{padding:"8px 16px",borderRadius:"var(--radius)",background:"var(--blue)",border:"none",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>Save Prompt</button>
                <span style={{fontSize:11,color:"var(--text-dim)"}}>Stored in backend environment variables</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── FLOATING AI ──────────────────────────────────────────────────────────────
function FloatingAI({tab,setTab}) {
  const [open,setOpen]=useState(false);
  if(tab==="ai") return null;
  return(
    <div style={{position:"fixed",bottom:24,right:24,zIndex:500,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:10}}>
      {open&&(
        <div style={{width:300,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:16,boxShadow:"var(--shadow-lg)",overflow:"hidden"}}>
          <div style={{padding:"12px 14px",background:"var(--blue)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontSize:13,fontWeight:700,color:"#fff"}}>TTP AI Assistant</span>
            <button onClick={()=>setOpen(false)} style={{background:"none",border:"none",color:"rgba(255,255,255,.7)",cursor:"pointer"}}>{I.close}</button>
          </div>
          <div style={{padding:"10px 12px",fontSize:12,color:"var(--text-muted)"}}>Ask me anything about your data, or open the AI tab for a full conversation.</div>
          <div style={{padding:"0 12px 12px",display:"flex",gap:6}}>
            <input placeholder="Quick question…" style={{flex:1,padding:"7px 10px",background:"var(--bg)",border:"1px solid var(--border)",borderRadius:"var(--radius)",color:"var(--text)",fontSize:12,outline:"none"}} onKeyDown={e=>{if(e.key==="Enter"){setTab("ai");setOpen(false);}}}/>
            <button onClick={()=>{setTab("ai");setOpen(false);}} style={{padding:"7px 12px",background:"var(--blue)",border:"none",borderRadius:"var(--radius)",color:"#fff",fontSize:12,cursor:"pointer",fontWeight:700}}>Open</button>
          </div>
        </div>
      )}
      <button onClick={()=>setOpen(o=>!o)} title="TTP AI"
        style={{width:50,height:50,borderRadius:"50%",background:"var(--blue)",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 8px 24px rgba(77,158,255,.4)",transition:"transform .2s"}}
        onMouseEnter={e=>e.currentTarget.style.transform="scale(1.1)"}
        onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
          <circle cx="9" cy="14" r="1" fill="white"/><circle cx="15" cy="14" r="1" fill="white"/>
        </svg>
      </button>
    </div>
  );
}

// ─── DUBAI CLOCK ──────────────────────────────────────────────────────────────
function DubaiClock() {
  const [t,setT]=useState("");
  useEffect(()=>{
    const tick=()=>setT(new Date().toLocaleTimeString("en-GB",{timeZone:"Asia/Dubai",hour:"2-digit",minute:"2-digit"}));
    tick(); const id=setInterval(tick,60000); return()=>clearInterval(id);
  },[]);
  return <span style={{color:"var(--text-dim)",fontSize:11}}>{t} Dubai</span>;
}

// ─── TABS / CONSTANTS ─────────────────────────────────────────────────────────
const TABS=[
  {id:"overview",label:"Overview",icon:null},
  {id:"bus",label:"Bus Occupancy",icon:null},
  {id:"hotel",label:"Hotel Insights",icon:null},
  {id:"data",label:"Data Table",icon:null},
  {id:"ai",label:"TTP AI",icon:null},
  {id:"settings",label:"Settings",icon:null},
];
const TAB_ICONS={overview:null,bus:null,hotel:null,data:null,ai:null,settings:null};
const DATASETS=["Solmar","Interbus","Solmar DE","Snowtravel"];
const YEARS=["2022","2023","2024","2025","2026"];
const emptyF=()=>({datasets:[],year:[],departureDateFrom:"",departureDateTo:"",bookingDateFrom:"",bookingDateTo:"",transportType:"",status:""});

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user,setUser]=useState(()=>{
    try{
      // Session-only: token only persists within the current browser tab/session
      const t=sessionStorage.getItem("ttp_token");
      const u=sessionStorage.getItem("ttp_user");
      return t&&u?{...JSON.parse(u),token:t}:null;
    }catch{return null;}
  });
  const [theme,setTheme]=useState(()=>localStorage.getItem("ttp_theme")||"dark");
  const [tab,setTab]           = useState("overview");
  const [metric,setMetric]     = useState("bookings");
  const [filtersOpen,setFO]    = useState(false);
  const [filters,setFilters]   = useState(emptyF());
  const [applied,setApplied]   = useState({});
  const [hasFY,setHasFY]       = useState(false);
  const [kpiData,setKpiData]   = useState(null);
  const [ymData,setYmData]     = useState([]);
  const [revData,setRevData]   = useState([]);
  const [slicers,setSlicers]   = useState({transportTypes:[]});
  const [loading,setLoading]   = useState(false);
  const [spinning,setSpinning] = useState(false);
  const [lastSync,setLastSync] = useState(null);
  const [error,setError]       = useState("");

  // Persist theme
  useEffect(()=>{
    localStorage.setItem("ttp_theme",theme);
    document.documentElement.setAttribute("data-theme",theme);
  },[theme]);

  const handleLogin=(token,u)=>{
    // Store in sessionStorage only — clears when browser/tab is closed (security requirement)
    sessionStorage.setItem("ttp_token",token);
    sessionStorage.setItem("ttp_user",JSON.stringify(u));
    // Remove any old localStorage tokens to prevent stale login
    localStorage.removeItem("ttp_token");
    localStorage.removeItem("ttp_user");
    setUser({...u,token});
  };
  const handleLogout=()=>{
    ["ttp_token","ttp_user"].forEach(k=>{
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
    setUser(null);
  };

  const buildParams=f=>{
    const p={};
    if(f.datasets?.length)   p.dataset=f.datasets;
    if(f.year?.length)       p.year=f.year;
    if(f.departureDateFrom)  p.departureDateFrom=f.departureDateFrom;
    if(f.departureDateTo)    p.departureDateTo=f.departureDateTo;
    if(f.bookingDateFrom)    p.bookingDateFrom=f.bookingDateFrom;
    if(f.bookingDateTo)      p.bookingDateTo=f.bookingDateTo;
    if(f.transportType)      p.transportType=f.transportType;
    if(f.status&&f.status!=="all") p.status=f.status;
    return p;
  };

  const loadAll=useCallback(async(f={},quiet=false)=>{
    if(!user) return;
    if(!quiet){setLoading(true);} setSpinning(true); setError("");
    try{
      const p=buildParams(f);
      const [kpis,ym,rev]=await Promise.allSettled([
        apiFetch("/api/dashboard/kpis",p),
        apiFetch("/api/dashboard/year-month-comparison",p),
        apiFetch("/api/dashboard/revenue-by-year",p),
      ]);
      if(kpis.status==="fulfilled") setKpiData(kpis.value);
      if(ym.status==="fulfilled")   setYmData(Array.isArray(ym.value)?ym.value:[]);
      if(rev.status==="fulfilled")  setRevData(Array.isArray(rev.value)?rev.value:[]);
      setLastSync(new Date());
    }catch(e){
      if(e.message==="Unauthorized"){handleLogout();}
      else setError(e.message);
    }
    finally{setLoading(false);setSpinning(false);}
  },[user]);

  useEffect(()=>{apiFetch("/api/dashboard/slicers").then(setSlicers).catch(()=>{});},[user]);
  useEffect(()=>{loadAll(applied);},[applied,loadAll]);
  useEffect(()=>{if(!user)return;const id=setInterval(()=>loadAll(applied,true),5*60*1000);return()=>clearInterval(id);},[user,applied,loadAll]);

  if(!user) return <Login onLogin={handleLogin}/>;

  const hasFilters=applied.datasets?.length||applied.year?.length||applied.departureDateFrom||applied.status;
  const fmtSync=d=>d?`${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`:null;

  const applyFY=(preset)=>{
    const now=new Date(), y=now.getFullYear();
    if(preset==="solmar"){
      const from=`${y-1}-12-01`, to=`${y}-11-30`;
      const nf={...emptyF(),departureDateFrom:from,departureDateTo:to,datasets:["Solmar"]};
      setFilters(nf); setApplied(buildParams(nf)); setHasFY(true);
    } else if(preset==="snowtravel"){
      const from=`${y-1}-07-01`, to=`${y}-06-30`;
      const nf={...emptyF(),departureDateFrom:from,departureDateTo:to,datasets:["Snowtravel"]};
      setFilters(nf); setApplied(buildParams(nf)); setHasFY(true);
    } else if(preset==="thisyear"){
      const nf={...emptyF(),year:[String(y)]};
      setFilters(nf); setApplied(buildParams(nf)); setHasFY(false);
    } else if(preset==="lastyear"){
      const nf={...emptyF(),year:[String(y-1)]};
      setFilters(nf); setApplied(buildParams(nf)); setHasFY(false);
    } else {
      setFilters(emptyF()); setApplied({}); setHasFY(false);
    }
    setFO(false);
  };

  const tabIcons={overview:I.overview,bus:I.bus,hotel:I.hotel,data:I.table,ai:I.ai,settings:I.settings};
  const tabLabels={overview:"Overview",bus:"Bus Occupancy",hotel:"Hotel Insights",data:"Data Table",ai:"TTP AI",settings:"Settings"};

  return(
    <div className="app-shell" data-theme={theme}>
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo">
            <img src="/assets/logo.png" alt="TTP" style={{width:"100%",height:"100%",objectFit:"contain",padding:4}} onError={e=>{e.target.style.display="none";e.target.parentNode.innerHTML='<span style="color:#fff;font-weight:800;font-size:14px;">TTP</span>';}}/>
          </div>
          <div className="brand-info">
            <span className="brand-title">Analytics</span>
            <span className="brand-sub">Data Engine v2.1</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          {Object.entries(tabLabels).map(([id,label])=>(
            <button key={id} className={`nav-item ${tab===id?"active":""}`} onClick={()=>setTab(id)}>
              <span className="nav-icon">{tabIcons[id]}</span>{label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar">{(user.name||"U")[0].toUpperCase()}</div>
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="user-role">{user.role}</span>
            </div>
          </div>
          <DubaiClock/>
          {lastSync&&<div className="sync-status"><span className="sync-dot"/>Last sync {fmtSync(lastSync)}</div>}
          <button className="btn-logout" onClick={handleLogout}>Sign out</button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main-area">
        {/* TOPBAR */}
        <header className="topbar">
          <div className="topbar-left">
            <h1 className="page-title">{tabLabels[tab]}</h1>
            {hasFilters&&(
              <div className="active-filters-row">
                {applied.datasets?.map(d=><span key={d} className="filter-chip dataset">{d}</span>)}
                {applied.year?.map(y=><span key={y} className="filter-chip year">{y}</span>)}
                {applied.departureDateFrom&&<span className="filter-chip date">{applied.departureDateFrom.split("-").reverse().join("-")} → {applied.departureDateTo?.split("-").reverse().join("-")}</span>}
                {applied.status&&<span className="filter-chip status">{applied.status}</span>}
                <button className="chip-clear" onClick={()=>{setFilters(emptyF());setApplied({});setHasFY(false);}}>✕ Clear</button>
              </div>
            )}
          </div>
          <div className="topbar-actions">
            {tab==="overview"&&(
              <div className="metric-tabs">
                {[["bookings","Bookings"],["pax","PAX"],["revenue","Revenue"]].map(([id,l])=>(
                  <button key={id} className={`metric-tab ${metric===id?"active":""}`} onClick={()=>setMetric(id)}>{l}</button>
                ))}
              </div>
            )}
            {/* Theme toggle */}
            <button className="btn-icon" onClick={()=>setTheme(t=>t==="dark"?"light":"dark")} title={`Switch to ${theme==="dark"?"light":"dark"} mode`}>
              {theme==="dark"?I.sun:I.moon}
            </button>
            <button className={`btn-icon ${spinning?"spinning":""}`} onClick={()=>loadAll(applied,true)} title="Refresh">{I.refresh}</button>
            {tab==="overview"&&<button className={`btn-filter ${filtersOpen?"active":""} ${hasFilters?"has-active":""}`} onClick={()=>setFO(o=>!o)}>{I.filter} Filters{hasFilters&&<span className="filter-badge"/>}</button>}
          </div>
        </header>

        {/* FILTER DRAWER (Overview only) */}
        {tab==="overview"&&(
          <div className={`filter-drawer ${filtersOpen?"open":""}`}>
            <div className="filter-drawer-inner">
              <div className="filter-section">
                <label className="filter-label">Quick Select</label>
                <div className="chip-group">
                  {[["thisyear","This Year"],["lastyear","Last Year"],["all","All Time"]].map(([v,l])=>(
                    <button key={v} className="ds-chip" onClick={()=>applyFY(v)}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="filter-section">
                <label className="filter-label">Fiscal Year Presets</label>
                <div className="chip-group">
                  <button className="ds-chip" onClick={()=>applyFY("solmar")}>Solmar FY (Dec–Nov)</button>
                  <button className="ds-chip" onClick={()=>applyFY("snowtravel")}>Snowtravel FY (Jul–Jun)</button>
                </div>
              </div>
              <div className="filter-section">
                <label className="filter-label">Dataset</label>
                <div className="chip-group">
                  {DATASETS.map(ds=><button key={ds} className={`ds-chip ${filters.datasets?.includes(ds)?"active":""}`} onClick={()=>setFilters(f=>({...f,datasets:f.datasets?.includes(ds)?f.datasets.filter(x=>x!==ds):[...(f.datasets||[]),ds]}))}>{ds}</button>)}
                </div>
              </div>
              <div className="filter-section">
                <label className="filter-label">Year</label>
                <div className="chip-group">
                  {YEARS.map(y=><button key={y} className={`ds-chip ${filters.year?.includes(y)?"active":""}`} onClick={()=>setFilters(f=>({...f,year:f.year?.includes(y)?f.year.filter(x=>x!==y):[...(f.year||[]),y]}))}>{y}</button>)}
                </div>
              </div>
              <div className="filter-section">
                <label className="filter-label">Departure Date</label>
                <div className="date-range">
                  <input type="date" className="date-input" value={filters.departureDateFrom||""} onChange={e=>setFilters(f=>({...f,departureDateFrom:e.target.value}))}/>
                  <span className="date-sep">→</span>
                  <input type="date" className="date-input" value={filters.departureDateTo||""} onChange={e=>setFilters(f=>({...f,departureDateTo:e.target.value}))}/>
                </div>
              </div>
              <div className="filter-section">
                <label className="filter-label">Booking Date</label>
                <div className="date-range">
                  <input type="date" className="date-input" value={filters.bookingDateFrom||""} onChange={e=>setFilters(f=>({...f,bookingDateFrom:e.target.value}))}/>
                  <span className="date-sep">→</span>
                  <input type="date" className="date-input" value={filters.bookingDateTo||""} onChange={e=>setFilters(f=>({...f,bookingDateTo:e.target.value}))}/>
                </div>
              </div>
              <div className="filter-section">
                <label className="filter-label">Transport Type</label>
                <select value={filters.transportType||""} onChange={e=>setFilters(f=>({...f,transportType:e.target.value}))} style={{width:"100%",padding:"7px 10px",background:"var(--bg)",border:"1px solid var(--border)",borderRadius:"var(--radius)",color:"var(--text)",fontSize:12,outline:"none"}}>
                  <option value="">All types</option>
                  {(slicers.transportTypes||[]).map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="filter-section">
                <label className="filter-label">Status</label>
                <div className="chip-group">
                  {[{v:"",l:"All"},{v:"confirmed",l:"Confirmed"},{v:"cancelled",l:"Cancelled"}].map(s=><button key={s.v} className={`ds-chip ${(filters.status||"")===s.v?"active":""}`} onClick={()=>setFilters(f=>({...f,status:s.v}))}>{s.l}</button>)}
                </div>
              </div>
              <div className="filter-actions">
                <button className="btn-clear-filters" onClick={()=>{setFilters(emptyF());setHasFY(false);}}>Clear</button>
                <button className="btn-apply-filters" onClick={()=>{setApplied(buildParams(filters));setFO(false);}}>Apply</button>
              </div>
            </div>
          </div>
        )}

        {/* PAGE BODY */}
        <main className="page-body">
          {error&&<div className="error-banner">{I.warn} {error}</div>}
          {loading&&<div className="loading-bar"><div className="loading-bar-fill"/></div>}

          {tab==="overview"&&(
            <div className="tab-content">
              {kpiData?.periodLabel&&(
                <div style={{marginBottom:16,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontSize:11,color:"var(--text-dim)"}}>Showing:</span>
                  <span style={{fontSize:11,fontWeight:700,color:"var(--blue)",background:"var(--blue-dim)",padding:"3px 10px",borderRadius:20,border:"1px solid rgba(77,158,255,.3)"}}>{kpiData.periodLabel}</span>
                  {hasFilters&&<button onClick={()=>{setFilters(emptyF());setApplied({});setHasFY(false);}} style={{fontSize:11,color:"var(--amber)",background:"var(--amber-dim)",border:"1px solid rgba(245,158,11,.3)",borderRadius:12,padding:"2px 8px",cursor:"pointer",fontWeight:700}}>✕ Reset</button>}
                </div>
              )}
              <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:16}}>
                <KpiCard label="Total Bookings" curr={kpiData?.currentBookings} prev={kpiData?.previousBookings} diff={kpiData?.differenceBookings} pct={kpiData?.percentBookings} fmt={fmtN} color="var(--blue)" prevLabel={kpiData?.prevLabel}/>
                <KpiCard label="Total PAX" curr={kpiData?.currentPax} prev={kpiData?.previousPax} diff={kpiData?.differencePax} pct={kpiData?.percentPax} fmt={fmtN} color="var(--green)" prevLabel={kpiData?.prevLabel}/>
                <KpiCard label="Gross Revenue" curr={kpiData?.currentRevenue} prev={kpiData?.previousRevenue} diff={kpiData?.differenceRevenue} pct={kpiData?.percentRevenue} fmt={fmtEur} color="var(--amber)" prevLabel={kpiData?.prevLabel}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
                <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"16px 16px 10px"}}>
                  <div style={{fontSize:13,fontWeight:700,color:"var(--text)",marginBottom:12}}>Revenue by Year</div>
                  <LineChart data={revData}/>
                </div>
                <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"16px 16px 10px"}}>
                  <div style={{fontSize:13,fontWeight:700,color:"var(--text)",marginBottom:12}}>Bookings / PAX by Year</div>
                  <BarChart data={revData} metric={metric}/>
                </div>
              </div>
              <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",overflow:"hidden"}}>
                <div style={{padding:"12px 16px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontSize:13,fontWeight:700,color:"var(--text)",flex:1}}>Year-Month Comparison</span>
                  <span style={{fontSize:10,color:"var(--text-dim)",background:"var(--bg-2)",padding:"2px 8px",borderRadius:10,border:"1px solid var(--border)"}}>← scroll →</span>
                  {[["bookings","Bookings"],["pax","PAX"],["revenue","Revenue"]].map(([id,l])=>(
                    <button key={id} onClick={()=>setMetric(id)} style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${metric===id?"var(--blue)":"var(--border)"}`,background:metric===id?"var(--blue)":"transparent",color:metric===id?"#fff":"var(--text-muted)",fontSize:11,fontWeight:600,cursor:"pointer"}}>{l}</button>
                  ))}
                </div>
                <YMTable data={ymData} metric={metric} hasFY={hasFY}/>
              </div>
            </div>
          )}

          {tab==="bus"     &&<BusTab/>}
          {tab==="hotel"   &&<HotelTab/>}
          {tab==="data"    &&<DataTableTab applied={applied}/>}
          {tab==="ai"      &&<AiTab user={user} kpiData={kpiData}/>}
          {tab==="settings"&&(user.role==="admin"
            ?<SettingsTab user={user} theme={theme} setTheme={t=>{setTheme(t);localStorage.setItem("ttp_theme",t);}}/>
            :<div style={{padding:60,textAlign:"center"}}><div style={{fontSize:32,marginBottom:12}}>🔒</div><div style={{fontSize:16,fontWeight:600,color:"var(--text)"}}>Admin access required</div></div>
          )}
        </main>

        {/* STATUS BAR */}
        <div style={{background:"var(--bg-2)",borderTop:"1px solid var(--border)",padding:"4px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11,flexShrink:0}}>
          <div style={{display:"flex",gap:14,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{color:"var(--text-dim)"}}>Last sync: <span style={{color:"var(--blue)",fontWeight:600}}>{fmtSync(lastSync)||"—"}</span> Dubai</span>
            {[["Solmar","Live"],["Snowtravel","Live"],["Interbus","Live"],["Solmar DE","Live"]].map(([k,v])=>(
              <span key={k} style={{color:"var(--text-dim)"}}><span style={{color:"var(--text-muted)",fontWeight:600}}>{k}</span>: <span style={{color:"var(--green)"}}>{v}</span></span>
            ))}
          </div>
          <span style={{color:"var(--text-dim)"}}>TTP Analytics v2.1 · <span style={{color:"var(--green)"}}>●</span> Live</span>
        </div>
      </div>

      <FloatingAI tab={tab} setTab={setTab}/>

      <style>{`
        /* ═══ DARK THEME (default) ═══ */
        :root, [data-theme="dark"] {
          --bg:          #0d1117;
          --bg-2:        #161b22;
          --surface:     #1c2333;
          --surface-2:   #243047;
          --surface-3:   #2d3a50;
          --border:      #30363d;
          --text:        #e6edf3;
          --text-muted:  #8b949e;
          --text-dim:    #3d5a80;
          --blue:        #4d9eff;
          --blue-dim:    rgba(77,158,255,.12);
          --green:       #3fb950;
          --green-dim:   rgba(63,185,80,.12);
          --red:         #f85149;
          --red-dim:     rgba(248,81,73,.12);
          --amber:       #d29922;
          --amber-dim:   rgba(210,153,34,.12);
          --purple:      #bc8cff;
          --mono:        'SF Mono','Fira Code','Cascadia Code',monospace;
          --font:        'Segoe UI',system-ui,-apple-system,sans-serif;
          --radius:      8px;
          --radius-lg:   12px;
          --radius-xl:   16px;
          --shadow-lg:   0 20px 60px rgba(0,0,0,.6);
        }

        /* ═══ LIGHT SILVER THEME ═══ */
        [data-theme="light"] {
          --bg:          #f1f5f9;
          --bg-2:        #e8edf3;
          --surface:     #ffffff;
          --surface-2:   #f8fafc;
          --surface-3:   #f1f5f9;
          --border:      #cbd5e1;
          --text:        #0f172a;
          --text-muted:  #475569;
          --text-dim:    #94a3b8;
          --blue:        #1a3a7c;
          --blue-dim:    rgba(26,58,124,.1);
          --green:       #16a34a;
          --green-dim:   rgba(22,163,74,.1);
          --red:         #dc2626;
          --red-dim:     rgba(220,38,38,.1);
          --amber:       #b45309;
          --amber-dim:   rgba(180,83,9,.1);
          --purple:      #7c3aed;
          --shadow-lg:   0 20px 60px rgba(0,0,0,.15);
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: var(--font);
          background: var(--bg);
          color: var(--text);
          font-size: 14px;
          line-height: 1.5;
          -webkit-font-smoothing: antialiased;
        }

        /* ── LAYOUT ── */
        .app-shell { display: flex; height: 100vh; overflow: hidden; }

        .sidebar {
          width: 176px;
          flex-shrink: 0;
          background: var(--bg-2);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 16px 14px;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .brand-logo {
          width: 36px; height: 36px;
          border-radius: 8px;
          background: var(--blue);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          overflow: hidden;
        }
        .brand-info { display: flex; flex-direction: column; min-width: 0; }
        .brand-title { font-size: 13px; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .brand-sub   { font-size: 10px; color: var(--text-dim); }

        .sidebar-nav { flex: 1; padding: 10px 8px; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }

        .nav-item {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 10px;
          border-radius: var(--radius);
          background: none; border: none;
          color: var(--text-muted);
          font-size: 13px; font-weight: 500;
          cursor: pointer;
          text-align: left;
          width: 100%;
          transition: background .12s, color .12s;
          white-space: nowrap;
        }
        .nav-item:hover { background: var(--surface); color: var(--text); }
        .nav-item.active { background: var(--blue-dim); color: var(--blue); font-weight: 600; }
        .nav-icon { display: flex; align-items: center; flex-shrink: 0; }

        .sidebar-footer {
          padding: 12px;
          border-top: 1px solid var(--border);
          display: flex; flex-direction: column; gap: 8px;
          flex-shrink: 0;
        }
        .user-card { display: flex; align-items: center; gap: 8px; }
        .user-avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--blue); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
        .user-info { display: flex; flex-direction: column; min-width: 0; }
        .user-name { font-size: 12px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .user-role { font-size: 10px; color: var(--text-dim); }
        .sync-status { display: flex; align-items: center; gap: 5px; font-size: 10px; color: var(--text-dim); }
        .sync-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--green); flex-shrink: 0; }
        .btn-logout { padding: 6px 10px; border-radius: var(--radius); background: transparent; border: 1px solid var(--border); color: var(--text-muted); font-size: 11px; cursor: pointer; text-align: center; transition: background .12s; }
        .btn-logout:hover { background: var(--surface); }

        /* ── MAIN ── */
        .main-area { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }

        .topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 20px;
          height: 52px;
          border-bottom: 1px solid var(--border);
          background: var(--bg-2);
          flex-shrink: 0;
          gap: 12px;
        }
        .topbar-left { display: flex; align-items: center; gap: 10px; min-width: 0; overflow: hidden; }
        .page-title { font-size: 15px; font-weight: 700; color: var(--text); white-space: nowrap; }
        .topbar-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

        .active-filters-row { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; overflow: hidden; }
        .filter-chip { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text-muted); white-space: nowrap; }
        .filter-chip.dataset { background: var(--blue-dim); color: var(--blue); border-color: rgba(77,158,255,.25); }
        .filter-chip.year    { background: var(--amber-dim); color: var(--amber); border-color: rgba(210,153,34,.25); }
        .filter-chip.date    { background: var(--surface-2); color: var(--text-muted); }
        .filter-chip.status  { background: var(--green-dim); color: var(--green); border-color: rgba(63,185,80,.25); }
        .chip-clear { font-size: 10px; font-weight: 700; color: var(--amber); background: var(--amber-dim); border: 1px solid rgba(210,153,34,.3); border-radius: 10px; padding: 2px 8px; cursor: pointer; white-space: nowrap; }

        .metric-tabs { display: flex; gap: 2px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 2px; }
        .metric-tab { padding: 4px 10px; border-radius: 6px; border: none; background: transparent; color: var(--text-muted); font-size: 11px; font-weight: 500; cursor: pointer; transition: background .12s, color .12s; }
        .metric-tab.active { background: var(--blue); color: #fff; font-weight: 700; }

        .btn-icon { width: 32px; height: 32px; border-radius: var(--radius); background: transparent; border: 1px solid var(--border); color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background .12s, color .12s; }
        .btn-icon:hover { background: var(--surface); color: var(--text); }
        .btn-icon.spinning svg { animation: spin .7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .btn-filter { display: flex; align-items: center; gap: 5px; padding: 0 12px; height: 32px; border-radius: var(--radius); border: 1px solid var(--border); background: transparent; color: var(--text-muted); font-size: 12px; font-weight: 600; cursor: pointer; position: relative; transition: background .12s, color .12s; }
        .btn-filter:hover, .btn-filter.active { background: var(--surface); color: var(--text); }
        .btn-filter.has-active { border-color: var(--blue); color: var(--blue); }
        .filter-badge { width: 6px; height: 6px; border-radius: 50%; background: var(--blue); flex-shrink: 0; }

        /* ── FILTER DRAWER ── */
        .filter-drawer { overflow: hidden; max-height: 0; transition: max-height .25s ease; border-bottom: 0 solid var(--border); background: var(--surface); }
        .filter-drawer.open { max-height: 420px; border-bottom-width: 1px; }
        .filter-drawer-inner { padding: 14px 20px; display: flex; flex-wrap: wrap; gap: 16px 24px; overflow-y: auto; max-height: 400px; }
        .filter-section { display: flex; flex-direction: column; gap: 6px; min-width: 160px; }
        .filter-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-dim); }
        .chip-group { display: flex; flex-wrap: wrap; gap: 4px; }
        .ds-chip { padding: 4px 10px; border-radius: 20px; border: 1px solid var(--border); background: transparent; color: var(--text-muted); font-size: 11px; font-weight: 500; cursor: pointer; transition: all .12s; white-space: nowrap; }
        .ds-chip:hover { border-color: var(--blue); color: var(--blue); }
        .ds-chip.active { background: var(--blue-dim); border-color: var(--blue); color: var(--blue); font-weight: 700; }
        .date-range { display: flex; align-items: center; gap: 6px; }
        .date-input { padding: 6px 8px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); color: var(--text); font-size: 11px; outline: none; }
        .date-sep { color: var(--text-dim); font-size: 11px; }
        .filter-actions { display: flex; gap: 8px; align-items: flex-end; margin-top: 4px; }
        .btn-clear-filters { padding: 7px 14px; border-radius: var(--radius); background: transparent; border: 1px solid var(--border); color: var(--text-muted); font-size: 12px; cursor: pointer; }
        .btn-apply-filters { padding: 7px 18px; border-radius: var(--radius); background: var(--blue); border: none; color: #fff; font-size: 12px; font-weight: 700; cursor: pointer; }

        /* ── PAGE BODY ── */
        .page-body { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 0; }
        .tab-content { display: flex; flex-direction: column; gap: 16px; }

        /* ── MISC ── */
        .loading-bar { height: 3px; background: var(--surface); flex-shrink: 0; }
        .loading-bar-fill { height: 100%; width: 40%; background: linear-gradient(90deg,var(--blue),var(--green)); animation: slideBar 1.2s ease infinite; }
        @keyframes slideBar { from{transform:translateX(-100%)} to{transform:translateX(350%)} }
        .error-banner { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--red-dim); border: 1px solid rgba(248,113,113,.3); border-radius: var(--radius); font-size: 13px; color: var(--red); margin-bottom: 12px; }

        input[type="date"]::-webkit-calendar-picker-indicator { opacity: .5; cursor: pointer; }
        [data-theme="dark"] input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); }
        select option { background: var(--surface); color: var(--text); }

        @keyframes typingDot { 0%,80%,100%{transform:scale(.7);opacity:.4} 40%{transform:scale(1);opacity:1} }

        /* ── MOBILE ── */
        @media(max-width:768px){
          .sidebar{position:fixed;bottom:0;left:0;width:100%;height:52px;flex-direction:row;z-index:100;border-right:none;border-top:1px solid var(--border);}
          .sidebar-brand,.sidebar-footer{display:none;}
          .sidebar-nav{flex-direction:row;padding:0 8px;overflow-x:auto;align-items:center;}
          .nav-item{flex-direction:column;gap:2px;padding:5px 8px;font-size:10px;}
          .main-area{padding-bottom:52px;}
        }
      `}</style>
    </div>
  );
}
