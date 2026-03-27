import { useState, useEffect, useRef, useCallback } from "react";
import Login from "./Login.jsx";

// ─── THEMES ───────────────────────────────────────────────────────────────────
const LIGHT = {
  bg:"#f0f2f5", sidebar:"#ffffff", card:"#ffffff", cardHover:"#f8f9fb",
  border:"#e2e8f0", borderMid:"#cbd5e1",
  accent:"#1d4ed8", accentLight:"#eff6ff", accentHover:"#1e40af",
  text:"#0f172a", textMuted:"#64748b", textDim:"#94a3b8",
  success:"#16a34a", successBg:"#f0fdf4",
  danger:"#dc2626",  dangerBg:"#fef2f2",
  warning:"#d97706", warningBg:"#fffbeb",
  headerBg:"#ffffff", tableAlt:"#f8fafc", tableHover:"#eff6ff",
  inputBg:"#f8fafc", inputBorder:"#e2e8f0",
  shadow:"0 1px 3px rgba(0,0,0,0.08)", cardShadow:"0 2px 12px rgba(0,0,0,0.06)",
  scrollbar:"#cbd5e1", navActive:"#eff6ff", navHover:"#f1f5f9",
};
const DARK = {
  bg:"#0f1115", sidebar:"#13161b", card:"#1a1d23", cardHover:"#1f2229",
  border:"#2d333d", borderMid:"#363d4a",
  accent:"#60a5fa", accentLight:"#1e3a5f", accentHover:"#3b82f6",
  text:"#f1f5f9", textMuted:"#cbd5e1", textDim:"#94a3b8",
  success:"#4ade80", successBg:"#14532d",
  danger:"#f87171",  dangerBg:"#450a0a",
  warning:"#fbbf24", warningBg:"#451a03",
  headerBg:"#13161b", tableAlt:"#0d1117", tableHover:"#1e3a5f",
  inputBg:"#0f1115", inputBorder:"#374151",
  shadow:"0 1px 3px rgba(0,0,0,0.3)", cardShadow:"0 2px 12px rgba(0,0,0,0.4)",
  scrollbar:"#374151", navActive:"#1e3a5f", navHover:"#1a1d23",
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const YEAR_COLORS = ["#8b5cf6","#f59e0b","#22c55e","#3b82f6"];
const DS_COLORS = { Solmar:"#22c55e", Interbus:"#f59e0b", Snowtravel:"#3b82f6", "Solmar DE":"#ef4444" };
const BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://localhost:3001";
const PENDELS = ["BEN","CBR","SAL","SSE","LLO","COB","CSE","PEN"];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const dubaiTime = () => new Date().toLocaleTimeString("en-GB",{timeZone:"Asia/Dubai",hour:"2-digit",minute:"2-digit"});
const fmtEur = n => { if(n==null) return "—"; const v=Number(n); if(Math.abs(v)>=1e6) return "€"+(v/1e6).toFixed(2)+"M"; if(Math.abs(v)>=1e3) return "€"+(v/1e3).toFixed(0)+"K"; return "€"+v.toLocaleString("nl-BE"); };
const fmtN   = n => { if(n==null) return "—"; return Number(n).toLocaleString("nl-BE"); };
const diffClr = (v,T) => v>0?T.success:v<0?T.danger:T.textMuted;
const diffBg  = (v,T) => v>0?T.successBg:v<0?T.dangerBg:"transparent";

async function apiFetch(path, params={}) {
  const t = localStorage.getItem("ttp_token") || sessionStorage.getItem("ttp_token") || "";
  const qs = Object.entries(params).filter(([,v])=>v!=null&&v!=="")
    .flatMap(([k,v])=>Array.isArray(v)?v.map(x=>`${k}=${encodeURIComponent(x)}`):[[`${k}=${encodeURIComponent(v)}`]])
    .join("&");
  const r = await fetch(`${BASE}${path}${qs?"?"+qs:""}`,{headers:{"Authorization":`Bearer ${t}`}});
  if(r.status===401) throw Object.assign(new Error("Unauthorized"),{status:401});
  return r.json();
}

// ─── SVG ICONS ────────────────────────────────────────────────────────────────
const Ic = {
  overview:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  bus:       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>,
  table:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>,
  ai:        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/><circle cx="9" cy="14" r="1" fill="currentColor"/><circle cx="15" cy="14" r="1" fill="currentColor"/></svg>,
  settings:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  logout:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  refresh:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.04-5.44"/></svg>,
  filter:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  download:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  send:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  plus:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  edit:      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  search:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  close:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  chevDown:  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>,
  arrowUp:   <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>,
  arrowDown: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>,
  sun:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  moon:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  key:       <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
  database:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
  user:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  bell:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
};

// ─── CANVAS: LINE CHART ───────────────────────────────────────────────────────
function LineChart({ data, T }) {
  const ref = useRef(null); const ptsRef = useRef([]); const [tip, setTip] = useState(null);
  useEffect(()=>{
    const c=ref.current; if(!c) return;
    const dpr=window.devicePixelRatio||1, rect=c.getBoundingClientRect();
    c.width=rect.width*dpr; c.height=rect.height*dpr;
    const ctx=c.getContext("2d"); ctx.scale(dpr,dpr);
    const W=rect.width,H=rect.height,pad={top:28,right:20,bottom:38,left:58};
    ctx.clearRect(0,0,W,H);
    if(!data?.length) return;
    const byY={}; data.forEach(d=>{if(!byY[d.year])byY[d.year]={};byY[d.year][d.month]=d.revenue||0;});
    const years=Object.keys(byY).sort();
    const maxV=Math.max(...data.map(d=>d.revenue||0),1);
    const scX=m=>pad.left+(m-1)*(W-pad.left-pad.right)/11;
    const scY=v=>H-pad.bottom-(v/maxV)*(H-pad.top-pad.bottom);
    for(let i=0;i<=4;i++){
      const y=H-pad.bottom-(i/4)*(H-pad.top-pad.bottom);
      ctx.strokeStyle=T.border;ctx.lineWidth=0.8;ctx.setLineDash([3,3]);
      ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(W-pad.right,y);ctx.stroke();ctx.setLineDash([]);
      const v=maxV*i/4;ctx.fillStyle=T.textDim;ctx.font="10px 'Segoe UI',sans-serif";ctx.textAlign="right";
      ctx.fillText(v>=1e6?(v/1e6).toFixed(1)+"M":v>=1e3?(v/1e3).toFixed(0)+"K":Math.round(v),pad.left-4,y+3);
    }
    ctx.fillStyle=T.textDim;ctx.font="10px 'Segoe UI',sans-serif";ctx.textAlign="center";
    [1,2,3,4,5,6,7,8,9,10,11,12].forEach(m=>ctx.fillText(MONTHS[m-1],scX(m),H-pad.bottom+14));
    ptsRef.current=[];
    years.forEach((y,i)=>{
      const color=YEAR_COLORS[i%YEAR_COLORS.length];
      ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.beginPath();let started=false;
      [1,2,3,4,5,6,7,8,9,10,11,12].forEach(m=>{
        const v=byY[y][m];if(!v)return;
        const[x,yy]=[scX(m),scY(v)];if(!started){ctx.moveTo(x,yy);started=true;}else ctx.lineTo(x,yy);
        ptsRef.current.push({x,y:yy,year:y,month:MONTHS[m-1],value:v,color});
      });
      ctx.stroke();
      ptsRef.current.filter(p=>p.year===y).forEach(p=>{
        ctx.fillStyle=T.card;ctx.strokeStyle=color;ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fill();ctx.stroke();
      });
    });
    let lx=pad.left;
    years.forEach((y,i)=>{ctx.fillStyle=YEAR_COLORS[i%YEAR_COLORS.length];ctx.fillRect(lx,7,12,3);ctx.fillStyle=T.textDim;ctx.font="10px 'Segoe UI',sans-serif";ctx.textAlign="left";ctx.fillText(y,lx+15,13);lx+=48;});
  },[data,T]);
  const onMove=useCallback(e=>{
    const c=ref.current;if(!c)return;
    const rect=c.getBoundingClientRect();
    const mx=(e.clientX-rect.left)*(c.width/rect.width/(window.devicePixelRatio||1));
    const my=(e.clientY-rect.top)*(c.height/rect.height/(window.devicePixelRatio||1));
    let n=null,d=28; ptsRef.current.forEach(p=>{const dd=Math.sqrt((p.x-mx)**2+(p.y-my)**2);if(dd<d){d=dd;n=p;}});
    setTip(n?{...n,cx:e.clientX,cy:e.clientY}:null);
  },[]);
  return(<div style={{position:"relative"}}><canvas ref={ref} style={{width:"100%",height:220,display:"block",cursor:"crosshair"}} onMouseMove={onMove} onMouseLeave={()=>setTip(null)}/>
    {tip&&<div style={{position:"fixed",left:tip.cx+14,top:tip.cy-48,background:tip.color,borderRadius:8,padding:"7px 12px",fontSize:12,color:"#fff",pointerEvents:"none",zIndex:9999,boxShadow:"0 4px 12px rgba(0,0,0,0.3)",whiteSpace:"nowrap"}}>
      <b>{tip.month} {tip.year}</b><br/>{fmtEur(tip.value)}</div>}</div>);
}

// ─── CANVAS: BAR CHART ────────────────────────────────────────────────────────
function BarChart({ data, metric, onMetric, T }) {
  const ref=useRef(null);const barsRef=useRef([]);const[tip,setTip]=useState(null);
  useEffect(()=>{
    const c=ref.current;if(!c)return;
    const dpr=window.devicePixelRatio||1,rect=c.getBoundingClientRect();
    c.width=rect.width*dpr;c.height=rect.height*dpr;
    const ctx=c.getContext("2d");ctx.scale(dpr,dpr);
    const W=rect.width,H=rect.height,pad={top:28,right:20,bottom:38,left:52};
    ctx.clearRect(0,0,W,H);if(!data?.length)return;
    const byY={};data.forEach(d=>{if(!byY[d.year])byY[d.year]={};byY[d.year][d.month]=metric==="bookings"?(d.bookings||0):metric==="pax"?(d.pax||0):(d.revenue||0);});
    const years=Object.keys(byY).sort();
    const allV=Object.values(byY).flatMap(y=>Object.values(y));
    const maxV=Math.max(...allV,1);
    const slotW=(W-pad.left-pad.right)/12;
    const bW=Math.max(4,Math.floor(slotW/years.length)-2);
    const sy=v=>H-pad.bottom-(v/maxV)*(H-pad.top-pad.bottom);
    for(let i=0;i<=4;i++){
      const yy=H-pad.bottom-(i/4)*(H-pad.top-pad.bottom);
      ctx.strokeStyle=T.border;ctx.lineWidth=0.8;ctx.setLineDash([3,3]);
      ctx.beginPath();ctx.moveTo(pad.left,yy);ctx.lineTo(W-pad.right,yy);ctx.stroke();ctx.setLineDash([]);
      const v=maxV*i/4;ctx.fillStyle=T.textDim;ctx.font="10px 'Segoe UI',sans-serif";ctx.textAlign="right";
      ctx.fillText(metric==="revenue"?(v>=1e6?(v/1e6).toFixed(1)+"M":v>=1e3?(v/1e3).toFixed(0)+"K":Math.round(v)):(v>=1e3?(v/1e3).toFixed(0)+"K":Math.round(v)),pad.left-4,yy+3);
    }
    ctx.fillStyle=T.textDim;ctx.font="10px 'Segoe UI',sans-serif";ctx.textAlign="center";
    [1,2,3,4,5,6,7,8,9,10,11,12].forEach(m=>ctx.fillText(MONTHS[m-1],pad.left+(m-1)*slotW+slotW/2,H-pad.bottom+14));
    barsRef.current=[];
    years.forEach((y,i)=>{
      const color=YEAR_COLORS[i%YEAR_COLORS.length];ctx.fillStyle=color+"cc";
      [1,2,3,4,5,6,7,8,9,10,11,12].forEach(m=>{
        const v=byY[y][m]||0;if(!v)return;
        const x=pad.left+(m-1)*slotW+i*(bW+1)+(slotW-years.length*(bW+1))/2;
        const barH=(v/maxV)*(H-pad.top-pad.bottom);
        ctx.fillRect(x,sy(v),bW,barH);
        barsRef.current.push({x,y:sy(v),width:bW,height:barH,year:y,month:MONTHS[m-1],value:v,color});
      });
    });
    let lx=pad.left;
    years.forEach((y,i)=>{ctx.fillStyle=YEAR_COLORS[i%YEAR_COLORS.length];ctx.fillRect(lx,7,12,8);ctx.fillStyle=T.textDim;ctx.font="10px 'Segoe UI',sans-serif";ctx.textAlign="left";ctx.fillText(y,lx+15,14);lx+=48;});
  },[data,metric,T]);
  const onMove=useCallback(e=>{
    const c=ref.current;if(!c)return;
    const rect=c.getBoundingClientRect();
    const mx=(e.clientX-rect.left)*(c.width/rect.width/(window.devicePixelRatio||1));
    const my=(e.clientY-rect.top)*(c.height/rect.height/(window.devicePixelRatio||1));
    const bar=barsRef.current.find(b=>mx>=b.x&&mx<=b.x+b.width&&my>=b.y&&my<=b.y+b.height);
    setTip(bar?{...bar,cx:e.clientX,cy:e.clientY}:null);
  },[]);
  return(<div style={{position:"relative"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
      <span style={{fontSize:11,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.07em"}}>BOOKINGS / PAX BY YEAR</span>
      <div style={{display:"flex",gap:3}}>
        {["bookings","pax"].map(m=>(
          <button key={m} onClick={()=>onMetric(m)} style={{background:metric===m?T.accent:"transparent",color:metric===m?"#fff":T.textMuted,border:`1px solid ${metric===m?T.accent:T.border}`,borderRadius:5,padding:"2px 9px",fontSize:11,fontWeight:600,cursor:"pointer",textTransform:"capitalize"}}>{m==="bookings"?"Bookings":"PAX"}</button>
        ))}
      </div>
    </div>
    <canvas ref={ref} style={{width:"100%",height:220,display:"block",cursor:"crosshair"}} onMouseMove={onMove} onMouseLeave={()=>setTip(null)}/>
    {tip&&<div style={{position:"fixed",left:tip.cx+14,top:tip.cy-48,background:tip.color,borderRadius:8,padding:"7px 12px",fontSize:12,color:"#fff",pointerEvents:"none",zIndex:9999,whiteSpace:"nowrap"}}>
      <b>{tip.month} {tip.year}</b><br/>{metric==="revenue"?fmtEur(tip.value):fmtN(tip.value)+" "+metric}</div>}
  </div>);
}

// ─── CANVAS: BUS BAR CHART ────────────────────────────────────────────────────
function BusBarChart({ data, metric, title, T }) {
  const ref=useRef(null);const barsRef=useRef([]);const[tip,setTip]=useState(null);
  useEffect(()=>{
    const c=ref.current;if(!c)return;
    const dpr=window.devicePixelRatio||1,rect=c.getBoundingClientRect();
    c.width=rect.width*dpr;c.height=rect.height*dpr;
    const ctx=c.getContext("2d");ctx.scale(dpr,dpr);
    const W=rect.width,H=rect.height,pad={top:24,right:16,bottom:42,left:54};
    ctx.clearRect(0,0,W,H);
    if(!data?.length){ctx.fillStyle=T.textMuted;ctx.font="12px sans-serif";ctx.textAlign="center";ctx.fillText("No data",W/2,H/2);return;}
    const classes=[...new Set(data.map(d=>d.bus_class||""))].filter(Boolean);
    const datasets=[...new Set(data.map(d=>d.dataset))].filter(Boolean);
    const maxV=Math.max(...data.map(d=>metric==="revenue"?(d.revenue||0):(d.bookings||0)),1);
    const slotW=(W-pad.left-pad.right)/Math.max(classes.length,1);
    const bW=Math.max(8,Math.floor(slotW/Math.max(datasets.length,1))-4);
    const sy=v=>H-pad.bottom-(v/maxV)*(H-pad.top-pad.bottom);
    for(let i=0;i<=4;i++){
      const yy=H-pad.bottom-(i/4)*(H-pad.top-pad.bottom);
      ctx.strokeStyle=T.border;ctx.lineWidth=0.8;ctx.setLineDash([3,3]);
      ctx.beginPath();ctx.moveTo(pad.left,yy);ctx.lineTo(W-pad.right,yy);ctx.stroke();ctx.setLineDash([]);
      const v=maxV*i/4;ctx.fillStyle=T.textDim;ctx.font="10px 'Segoe UI',sans-serif";ctx.textAlign="right";
      ctx.fillText(v>=1e6?(v/1e6).toFixed(1)+"M":v>=1e3?(v/1e3).toFixed(0)+"K":Math.round(v),pad.left-4,yy+3);
    }
    barsRef.current=[];
    classes.forEach((cls,ci)=>{
      const slotX=pad.left+ci*slotW;
      const totalW=datasets.length*(bW+3);
      datasets.forEach((ds,di)=>{
        const row=data.find(d=>d.bus_class===cls&&d.dataset===ds);if(!row)return;
        const v=metric==="revenue"?(row.revenue||0):(row.bookings||0);if(!v)return;
        const x=slotX+(slotW-totalW)/2+di*(bW+3);
        const barH=(v/maxV)*(H-pad.top-pad.bottom);
        const color=DS_COLORS[ds]||"#6b7280";ctx.fillStyle=color;
        ctx.beginPath();ctx.roundRect(x,sy(v),bW,barH,2);ctx.fill();
        barsRef.current.push({x,y:sy(v),width:bW,height:barH,ds,cls,value:v,color});
      });
      ctx.fillStyle=T.textDim;ctx.font="10px 'Segoe UI',sans-serif";ctx.textAlign="center";
      ctx.fillText(cls.length>8?cls.slice(0,8)+"..":cls,slotX+slotW/2,H-pad.bottom+13);
    });
    let lx=pad.left;
    datasets.forEach(ds=>{const color=DS_COLORS[ds]||"#6b7280";ctx.fillStyle=color;ctx.fillRect(lx,8,10,8);ctx.fillStyle=T.textDim;ctx.font="10px 'Segoe UI',sans-serif";ctx.textAlign="left";ctx.fillText(ds,lx+13,15);lx+=ds.length*5.5+24;});
  },[data,metric,T]);
  const onMove=useCallback(e=>{
    const c=ref.current;if(!c)return;const rect=c.getBoundingClientRect();
    const mx=(e.clientX-rect.left)*(c.width/rect.width/(window.devicePixelRatio||1));
    const my=(e.clientY-rect.top)*(c.height/rect.height/(window.devicePixelRatio||1));
    const bar=barsRef.current.find(b=>mx>=b.x&&mx<=b.x+b.width&&my>=b.y&&my<=b.y+b.height);
    setTip(bar?{...bar,cx:e.clientX,cy:e.clientY}:null);
  },[]);
  return(<div style={{position:"relative",flex:1}}>
    <div style={{fontSize:11,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>{title}</div>
    <canvas ref={ref} style={{width:"100%",height:200,display:"block",cursor:"crosshair"}} onMouseMove={onMove} onMouseLeave={()=>setTip(null)}/>
    {tip&&<div style={{position:"fixed",left:tip.cx+14,top:tip.cy-48,background:tip.color,borderRadius:8,padding:"7px 12px",fontSize:12,color:"#fff",pointerEvents:"none",zIndex:9999,whiteSpace:"nowrap"}}>
      <b>{tip.cls} · {tip.ds}</b><br/>{metric==="revenue"?fmtEur(tip.value):fmtN(tip.value)+" bookings"}</div>}
  </div>);
}

// ─── SHARED UI ────────────────────────────────────────────────────────────────
function Card({children,style={},T}){return <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,boxShadow:T.cardShadow,...style}}>{children}</div>;}
function CardHdr({title,right,T}){return <div style={{padding:"13px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
  <span style={{fontSize:11,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.07em"}}>{title}</span>{right}</div>;}
function Btn({children,variant="primary",size="md",onClick,disabled,style={},T}){
  const base={border:"none",borderRadius:7,cursor:disabled?"not-allowed":"pointer",fontWeight:600,display:"inline-flex",alignItems:"center",gap:5,transition:"all 0.15s",...style};
  const sz=size==="sm"?{padding:"4px 10px",fontSize:11}:{padding:"7px 14px",fontSize:13};
  const v=variant==="primary"?{background:T?.accent||"#1d4ed8",color:"#fff"}:variant==="danger"?{background:"transparent",color:T?.danger||"#dc2626",border:`1px solid ${T?.danger||"#dc2626"}44`}:{background:"transparent",color:T?.textMuted||"#6b7280",border:`1px solid ${T?.border||"#e5e7eb"}`};
  return <button onClick={onClick} disabled={disabled} style={{...base,...sz,...v,opacity:disabled?0.5:1}}>{children}</button>;}
function Badge({children,color="accent",T}){
  const m={accent:{bg:T.accentLight,text:T.accent},success:{bg:T.successBg,text:T.success},danger:{bg:T.dangerBg,text:T.danger},muted:{bg:T.tableAlt,text:T.textMuted}};
  const s=m[color]||m.muted;
  return <span style={{background:s.bg,color:s.text,fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:10,whiteSpace:"nowrap"}}>{children}</span>;}

// ─── TABLE COMPONENT ─────────────────────────────────────────────────────────
function DataTable({columns,rows,emptyMsg="No data",T,maxHeight=460}){
  const[hover,setHover]=useState(-1);
  return(<div className="table-scroll" style={{overflowX:"auto",overflowY:"auto",maxHeight}}>
    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:columns.length*80}}>
      <thead><tr style={{background:T.tableAlt,position:"sticky",top:0,zIndex:1}}>
        {columns.map((c,i)=><th key={i} style={{padding:"9px 12px",textAlign:c.right?"right":"left",fontSize:10,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.05em",borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>{c.label}</th>)}
      </tr></thead>
      <tbody>
        {!rows?.length&&<tr><td colSpan={columns.length} style={{padding:24,textAlign:"center",color:T.textMuted,fontSize:13}}>{emptyMsg}</td></tr>}
        {rows?.map((row,i)=>(
          <tr key={i} style={{background:hover===i?T.tableHover:i%2===0?T.card:T.tableAlt,borderBottom:`1px solid ${T.border}`,transition:"background 0.1s"}}
            onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(-1)}>
            {columns.map((c,j)=>{
              const val=c.render?c.render(row):row[c.key];
              return <td key={j} style={{padding:"8px 12px",textAlign:c.right?"right":"left",color:c.color?c.color(row,T):T.text,fontWeight:c.bold?"600":"400",whiteSpace:c.noWrap?"nowrap":"normal"}}>{val??""}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  </div>);
}


// ─── FEEDER PIVOT TABLE ───────────────────────────────────────────────────────
// Dates as columns with normal horizontal headers (no rotation)
// Matches Google Sheets exactly: Pick-up point | Pax (total) | date columns...
function FeederPivotTable({ data, T }) {
  if (!data?.length) return (
    <div style={{padding:32,textAlign:"center",color:T.textMuted,fontSize:13}}>
      No feeder data — select a date range and click Apply
    </div>
  );

  const parseDate = s => {
    if(!s)return 0;
    const sep=s.includes('/')?' /':'-';
    const[d,m,y]=s.split(s.includes('/')?'/':'-');
    if(!y)return 0;
    return new Date(`${y}-${(m||'01').padStart(2,'0')}-${(d||'01').padStart(2,'0')}`).getTime();
  };

  const allDates=[...new Set(data.map(d=>d.DepartureDate||'').filter(Boolean))].sort((a,b)=>parseDate(a)-parseDate(b));
  const dates=allDates.slice(0,15);

  const lookup={},routeStops={},routeTotals={},routeInfo={};
  data.forEach(d=>{
    const rk=String(d.RouteNo??'X'),sk=d.StopName||'—',dk=d.DepartureDate||'';
    if(!dates.includes(dk))return;
    routeInfo[rk]=d.RouteLabel||`Route ${rk}`;
    if(!lookup[rk])lookup[rk]={};
    if(!lookup[rk][sk])lookup[rk][sk]={};
    lookup[rk][sk][dk]=(lookup[rk][sk][dk]||0)+(d.TotalPax||0);
    if(!routeStops[rk])routeStops[rk]=[];
    if(!routeStops[rk].includes(sk))routeStops[rk].push(sk);
    if(!routeTotals[rk])routeTotals[rk]={};
    routeTotals[rk][dk]=(routeTotals[rk][dk]||0)+(d.TotalPax||0);
  });

  const routes=Object.keys(lookup).sort((a,b)=>a==='X'?1:b==='X'?-1:parseInt(a)-parseInt(b));
  const grandTotals={};
  dates.forEach(d=>{grandTotals[d]=Object.values(routeTotals).reduce((s,rt)=>s+(rt[d]||0),0);});
  const grandTotal=Object.values(grandTotals).reduce((a,b)=>a+b,0);

  // Format date for display: dd/mm/yyyy → dd-mm-yyyy
  const fmtDate=s=>{
    if(!s)return '';
    const sep=s.includes('/')?'/':'-';
    const parts=s.split(sep);
    if(parts.length>=3)return `${parts[0]}-${parts[1]}-${parts[2]}`;
    return s;
  };

  const COL_W=90;

  return (
    <div>
      {allDates.length>15&&<div style={{padding:"6px 14px",background:T.warningBg,borderBottom:`1px solid ${T.border}`,fontSize:11,color:T.warning}}>
        Showing first 15 of {allDates.length} dates. Use date filters to narrow the range.
      </div>}
      <div className="force-scroll" style={{overflowX:"auto",overflowY:"auto",maxHeight:560,paddingBottom:4}}>
        <table style={{borderCollapse:"collapse",fontSize:12,tableLayout:"fixed",width:`${180+80+(dates.length*COL_W)}px`}}>
          <thead style={{position:"sticky",top:0,zIndex:3}}>
            <tr style={{background:T.tableAlt}}>
              <th style={{width:180,padding:"10px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:T.textMuted,textTransform:"uppercase",borderBottom:`2px solid ${T.border}`,borderRight:`2px solid ${T.border}`,position:"sticky",left:0,background:T.tableAlt,zIndex:4}}>
                Pick-up point
              </th>
              <th style={{width:80,padding:"10px 10px",textAlign:"right",fontSize:11,fontWeight:700,color:T.textMuted,textTransform:"uppercase",borderBottom:`2px solid ${T.border}`,borderRight:`2px solid ${T.border}`,background:T.tableAlt}}>
                Pax (total)
              </th>
              {dates.map(d=>(
                <th key={d} style={{width:COL_W,padding:"10px 6px",textAlign:"right",fontSize:11,fontWeight:600,color:T.accent,borderBottom:`2px solid ${T.border}`,borderRight:`1px solid ${T.border}`,background:T.tableAlt,whiteSpace:"nowrap"}}>
                  {fmtDate(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Grand total row */}
            <tr style={{background:`${T.accent}18`}}>
              <td style={{padding:"9px 12px",fontWeight:700,color:T.accent,borderRight:`2px solid ${T.border}`,borderBottom:`1px solid ${T.border}`,position:"sticky",left:0,background:`${T.accent}18`,fontSize:12}}>
                Totaal vertrek
              </td>
              <td style={{padding:"9px 10px",textAlign:"right",fontWeight:700,color:T.accent,borderRight:`2px solid ${T.border}`,borderBottom:`1px solid ${T.border}`}}>
                {grandTotal.toLocaleString("nl-BE")}
              </td>
              {dates.map(d=>(
                <td key={d} style={{padding:"9px 6px",textAlign:"right",fontWeight:700,color:grandTotals[d]>0?T.accent:T.textDim,borderRight:`1px solid ${T.border}`,borderBottom:`1px solid ${T.border}`}}>
                  {grandTotals[d]>0?grandTotals[d]:""}
                </td>
              ))}
            </tr>
            {/* Routes and stops */}
            {routes.map(rk=>{
              const stops=routeStops[rk]||[];
              const routeTotal=stops.reduce((s,sk)=>s+Object.values(lookup[rk]?.[sk]||{}).reduce((a,b)=>a+b,0),0);
              return [
                <tr key={`r-${rk}`} style={{background:T.tableAlt,borderTop:`2px solid ${T.border}`}}>
                  <td style={{padding:"8px 12px",fontWeight:700,color:T.text,fontSize:12,borderRight:`2px solid ${T.border}`,borderBottom:`1px solid ${T.border}`,position:"sticky",left:0,background:T.tableAlt}}>
                    {routeInfo[rk]}
                  </td>
                  <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700,color:T.text,borderRight:`2px solid ${T.border}`,borderBottom:`1px solid ${T.border}`}}>
                    {routeTotal>0?routeTotal.toLocaleString("nl-BE"):""}
                  </td>
                  {dates.map(d=>{const v=routeTotals[rk]?.[d]||0;return(
                    <td key={d} style={{padding:"8px 6px",textAlign:"right",fontWeight:600,color:v>0?T.accent:T.textDim,borderRight:`1px solid ${T.border}`,borderBottom:`1px solid ${T.border}`}}>
                      {v>0?v:""}
                    </td>
                  );})}
                </tr>,
                ...stops.map((sk,si)=>(
                  <tr key={`${rk}-${sk}`} style={{background:si%2===0?T.card:T.tableAlt}}>
                    <td style={{padding:"7px 12px 7px 22px",color:T.textMuted,fontSize:11,borderRight:`2px solid ${T.border}`,borderBottom:`1px solid ${T.border}`,position:"sticky",left:0,background:si%2===0?T.card:T.tableAlt,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                      {sk}
                    </td>
                    <td style={{padding:"7px 10px",textAlign:"right",color:T.textMuted,fontSize:11,borderRight:`2px solid ${T.border}`,borderBottom:`1px solid ${T.border}`}}>
                      {Object.values(lookup[rk]?.[sk]||{}).reduce((a,b)=>a+b,0)||""}
                    </td>
                    {dates.map(d=>{const v=lookup[rk]?.[sk]?.[d]||0;return(
                      <td key={d} style={{padding:"7px 6px",textAlign:"right",color:v>0?T.text:T.textDim,fontSize:11,borderRight:`1px solid ${T.border}`,borderBottom:`1px solid ${T.border}`}}>
                        {v>0?v:""}
                      </td>
                    );})}
                  </tr>
                ))
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── DECK TABLE ───────────────────────────────────────────────────────────────
// Matches Google Sheets: Datum | Total(Total/Lower/Upper/NoDeck) | Royal Class(...) | First Class(...) | Premium(...)
function DeckTable({ data, T }) {
  const [hover, setHover] = useState(-1);
  if (!data?.length) return (
    <div style={{padding:24,textAlign:"center",color:T.textMuted,fontSize:13}}>
      No deck data — adjust filters and click Apply
    </div>
  );

  const sections = [
    {key:"Total", label:"Total", color:T.accent, cols:[
      {k:"Total",l:"Total",bold:true},{k:"Total_Lower",l:"Lower Deck"},{k:"Total_Upper",l:"Upper deck"},{k:"Total_NoDeck",l:"No deck"},
    ]},
    {key:"RC", label:"Royal Class", color:"#8b5cf6", cols:[
      {k:"Royal_Total",l:"Total",bold:true},{k:"Royal_Lower",l:"Lower Deck"},{k:"Royal_Upper",l:"Upper deck"},{k:"Royal_NoDeck",l:"No deck"},
    ]},
    {key:"FC", label:"First Class", color:"#22c55e", cols:[
      {k:"First_Total",l:"Total",bold:true},{k:"First_Lower",l:"Lower Deck"},{k:"First_Upper",l:"Upper deck"},{k:"First_NoDeck",l:"No deck"},
    ]},
    {key:"PRE", label:"Premium", color:"#f59e0b", cols:[
      {k:"Premium_Total",l:"Total",bold:true},{k:"Premium_Lower",l:"Lower Deck"},{k:"Premium_Upper",l:"Upper deck"},{k:"Premium_NoDeck",l:"No deck"},
    ]},
  ];

  // Format date: dd/mm/yyyy → d-m-yyyy (like Google Sheets)
  const fmtDate=s=>{
    if(!s)return s;
    const sep=s.includes('/')?'/':'-';
    const[d,m,y]=s.split(sep);
    if(!y)return s;
    return `${parseInt(d)}-${parseInt(m)}-${y}`;
  };

  return (
    <div className="force-scroll" style={{overflowX:"auto",overflowY:"auto",maxHeight:560,paddingBottom:4}}>
      <table style={{borderCollapse:"collapse",fontSize:12,width:"100%"}}>
        <thead>
          <tr style={{background:T.tableAlt,position:"sticky",top:0,zIndex:2}}>
            <th rowSpan={2} style={{padding:"10px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:T.textMuted,textTransform:"uppercase",borderBottom:`1px solid ${T.border}`,borderRight:`2px solid ${T.border}`,minWidth:110,verticalAlign:"bottom"}}>Datum</th>
            {sections.map(s=>(
              <th key={s.key} colSpan={4} style={{padding:"8px 12px",textAlign:"center",fontSize:11,fontWeight:700,color:s.color,textTransform:"uppercase",borderBottom:`1px solid ${s.color}44`,borderLeft:`2px solid ${s.color}`,background:`${s.color}11`}}>
                {s.label}
              </th>
            ))}
          </tr>
          <tr style={{background:T.tableAlt,position:"sticky",top:33,zIndex:2}}>
            {sections.map(s=>s.cols.map((c,ci)=>(
              <th key={`${s.key}-${c.k}`} style={{padding:"6px 10px",textAlign:"right",fontSize:10,fontWeight:700,color:T.textDim,textTransform:"uppercase",borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap",...(ci===0?{borderLeft:`2px solid ${s.color}`}:{})}}>
                {c.l}
              </th>
            )))}
          </tr>
        </thead>
        <tbody>
          {data.map((row,i)=>(
            <tr key={i} style={{background:hover===i?T.tableHover:i%2===0?T.card:T.tableAlt,borderBottom:`1px solid ${T.border}`,transition:"background 0.1s"}}
              onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(-1)}>
              <td style={{padding:"8px 12px",color:T.accent,fontWeight:700,whiteSpace:"nowrap",borderRight:`2px solid ${T.border}`}}>{fmtDate(row.dateDeparture)}</td>
              {sections.map(s=>s.cols.map((c,ci)=>{
                const v=row[c.k]||0;
                return (
                  <td key={`${s.key}-${c.k}`} style={{padding:"8px 10px",textAlign:"right",fontWeight:c.bold?"700":"400",color:v>0?(c.bold?s.color:T.text):T.textDim,...(ci===0?{borderLeft:`2px solid ${s.color}`}:{})}}>
                    {v>0?v.toLocaleString("nl-BE"):""}
                  </td>
                );
              }))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

// ─── HOTEL INSIGHTS TAB ───────────────────────────────────────────────────────
function HotelTab({token,T,API}) {
  const [stats,setStats]=useState(null);
  const [ratings,setRatings]=useState([]);
  const [reviews,setReviews]=useState([]);
  const [loading,setLoading]=useState(true);
  const [selHotel,setSelHotel]=useState(null);
  const [search,setSearch]=useState('');

  useEffect(()=>{
    const h={"Authorization":`Bearer ${token}`};
    Promise.all([
      fetch(`${API}/api/dashboard/hotel-stats`,{headers:h}).then(r=>r.json()),
      fetch(`${API}/api/dashboard/hotel-ratings`,{headers:h}).then(r=>r.json()),
    ]).then(([s,r])=>{
      setStats(s); setRatings(Array.isArray(r)?r:[]);
      setLoading(false);
    }).catch(()=>setLoading(false));
  },[token,API]);

  const loadReviews=(code)=>{
    setSelHotel(code);
    const h={"Authorization":`Bearer ${token}`};
    fetch(`${API}/api/dashboard/hotel-reviews?code=${code}&limit=20`,{headers:h})
      .then(r=>r.json()).then(d=>setReviews(d.rows||[]));
  };

  const stars=(r)=>{
    if(!r) return '—';
    const n=parseFloat(r);
    const full=Math.floor(n/2);
    return '★'.repeat(full)+'☆'.repeat(5-full)+` ${n.toFixed(1)}`;
  };

  const filtered=ratings.filter(r=>(r.accommodation_name||r.accommodation_code||'').toLowerCase().includes(search.toLowerCase()));

  if(loading) return <div style={{padding:40,textAlign:'center',color:T.textMuted}}>Loading hotel data...</div>;

  const noData=!stats?.total_hotels;

  return (
    <div style={{padding:"20px"}}>
      {noData ? (
        <div style={{textAlign:"center",padding:"60px 20px",background:T.cardBg,borderRadius:14,border:`1px solid ${T.border}`}}>
          <div style={{fontSize:44,marginBottom:16}}>🏨</div>
          <div style={{fontSize:20,fontWeight:800,color:T.text,marginBottom:8}}>Hotel Insights</div>
          <div style={{fontSize:13,color:T.textMuted,marginBottom:20,maxWidth:420,margin:"0 auto 20px"}}>
            TravelTrustIt reviews will appear here. Run the ETL script to load hotel review data.
          </div>
          <code style={{fontSize:11,background:T.tableAlt,padding:"8px 16px",borderRadius:8,color:T.accent,display:"block",maxWidth:500,margin:"0 auto"}}>
            node src/scripts/loadHotelReviews.js
          </code>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:20}}>
            {[
              {label:"Total Hotels",value:stats?.total_hotels?.toLocaleString('nl-BE')},
              {label:"Total Reviews",value:stats?.total_reviews?.toLocaleString('nl-BE')},
              {label:"Avg Rating",value:stats?.avg_rating?`${stats.avg_rating}/10`:'—'},
              {label:"High Rated",value:stats?.high_rated?.toLocaleString('nl-BE'),sub:"≥8.0"},
              {label:"Latest Review",value:stats?.latest_review?stats.latest_review.split('T')[0]:'—'},
            ].map(s=>(
              <Card key={s.label} style={{padding:"14px 16px"}} T={T}>
                <div style={{fontSize:10,fontWeight:700,color:T.textMuted,textTransform:"uppercase",marginBottom:6}}>{s.label}</div>
                <div style={{fontSize:20,fontWeight:800,color:T.text}}>{s.value||'—'}</div>
                {s.sub&&<div style={{fontSize:10,color:T.textDim}}>{s.sub}</div>}
              </Card>
            ))}
          </div>

          {/* Search + Table */}
          <div style={{background:T.cardBg,borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
              <span style={{fontSize:13,fontWeight:700,color:T.text}}>Hotel Ratings — {filtered.length} properties</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search hotel..."
                style={{padding:"6px 12px",background:T.inputBg,border:`1px solid ${T.inputBorder}`,borderRadius:8,color:T.text,fontSize:12,outline:"none",width:200}}/>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{background:T.tableAlt}}>
                    {["Hotel","Code","Overall","Sleep","Location","Cleanliness","Service","Reviews","Action"].map(h=>(
                      <th key={h} style={{padding:"8px 12px",textAlign:"left",color:T.textMuted,fontWeight:700,fontSize:11,whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0,50).map((r,i)=>(
                    <tr key={r.accommodation_code} style={{borderTop:`1px solid ${T.border}`,background:i%2?T.tableAlt:"transparent"}}>
                      <td style={{padding:"8px 12px",color:T.text,fontWeight:600,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.accommodation_name||'—'}</td>
                      <td style={{padding:"8px 12px",color:T.textMuted}}>{r.accommodation_code}</td>
                      <td style={{padding:"8px 12px",color:r.avg_overall>=8?T.success:r.avg_overall>=6?T.warning:T.danger,fontWeight:700}}>{r.avg_overall||'—'}</td>
                      <td style={{padding:"8px 12px",color:T.textMuted}}>{r.avg_sleep||'—'}</td>
                      <td style={{padding:"8px 12px",color:T.textMuted}}>{r.avg_location||'—'}</td>
                      <td style={{padding:"8px 12px",color:T.textMuted}}>{r.avg_cleanliness||'—'}</td>
                      <td style={{padding:"8px 12px",color:T.textMuted}}>{r.avg_service||'—'}</td>
                      <td style={{padding:"8px 12px",color:T.textMuted}}>{r.total_reviews||0}</td>
                      <td style={{padding:"8px 12px"}}>
                        <button onClick={()=>loadReviews(r.accommodation_code)}
                          style={{background:T.accent,color:"#fff",border:"none",borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer"}}>Reviews</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Reviews panel */}
          {selHotel&&reviews.length>0&&(
            <div style={{marginTop:16,background:T.cardBg,borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:13,fontWeight:700,color:T.text}}>Reviews — {selHotel}</span>
                <button onClick={()=>{setSelHotel(null);setReviews([]);}} style={{background:"transparent",border:"none",cursor:"pointer",color:T.textMuted,fontSize:16}}>✕</button>
              </div>
              <div style={{maxHeight:400,overflowY:"auto"}}>
                {reviews.map(r=>(
                  <div key={r.id} style={{padding:"14px 16px",borderTop:`1px solid ${T.border}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                      <span style={{fontSize:16,color:"#f59e0b",fontWeight:700}}>{r.overall_rating}/10</span>
                      <span style={{fontSize:13,fontWeight:600,color:T.text}}>{r.review_title||'Review'}</span>
                      <span style={{fontSize:11,color:T.textDim,marginLeft:"auto"}}>{r.review_date?.split('T')[0]||''}</span>
                    </div>
                    <div style={{fontSize:12,color:T.textMuted,marginBottom:6,lineHeight:1.5}}>{r.review_text||'—'}</div>
                    <div style={{fontSize:11,color:T.textDim}}>{r.reviewer_name} · {r.reviewer_city}, {r.reviewer_country} {r.reviewer_age?`· Age ${r.reviewer_age}`:''}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function App(){
  const[token,setToken]=useState(()=>localStorage.getItem("ttp_token")||"");
  const[user,setUser]=useState(null);
  const[tab,setTab]=useState("overview");
  const[themeKey,setThemeKey]=useState(()=>localStorage.getItem("ttp_theme")||"light");
  const T=themeKey==="dark"?DARK:LIGHT;

  // Overview
  const[kpis,setKpis]=useState(null);
  const[revData,setRevData]=useState([]);
  const[ymData,setYmData]=useState([]);
  const[ymMetric,setYmMetric]=useState("bookings");
  const[barMetric,setBarMetric]=useState("bookings");
  const[oLoad,setOLoad]=useState(false);

  // Filters
  const[filtersOpen,setFiltersOpen]=useState(false);
  const[filters,setFilters]=useState({depFrom:"",depTo:"",bkFrom:"",bkTo:"",dataset:[],status:[],transport:[],years:[]});
  const[applied,setApplied]=useState({});
  const[slicers,setSlicers]=useState({transportTypes:[],datasets:[],labels:[]});

  // Bus
  const[busLabel,setBusLabel]=useState("Solmar");
  const[busView,setBusView]=useState("pendel");
  const[busTrips,setBusTrips]=useState([]);
  const[busClass,setBusClass]=useState([]);
  const[stTrips,setStTrips]=useState([]);
  const[pendelData,setPendelData]=useState([]);
  const[feederData,setFeederData]=useState([]);
  const[deckData,setDeckData]=useState([]);
  const[busFiltersOpen,setBusFiltersOpen]=useState(false);
  const[busF,setBusF]=useState({dateFrom:`${new Date().getFullYear()}-01-01`,dateTo:`${new Date().getFullYear()}-12-31`,pendel:"",region:"",destination:"",weekday:""});
  const[busSlicers,setBusSlicers]=useState({pendels:[],regions:[],destinations:[]});
  const[bLoad,setBLoad]=useState(false);
  const[busKpis,setBusKpis]=useState({});

  // Data table
  const[tableRows,setTableRows]=useState([]);
  const[tableTotal,setTableTotal]=useState(0);
  const[tablePage,setTablePage]=useState(1);
  const[tableFilters,setTableFilters]=useState({dataset:"",status:"",depFrom:"",depTo:"",bkFrom:"",bkTo:"",search:""});
  const[tLoad,setTLoad]=useState(false);

  // AI
  const[msgs,setMsgs]=useState([{role:"assistant",text:"Hello! I'm your TTP Analytics AI. Ask me anything about bookings, PAX, revenue or trends."}]);
  const[aiInput,setAiInput]=useState("");const[aiLoad,setAiLoad]=useState(false);
  const chatRef=useRef(null);

  // Settings
  const[stTab,setStTab]=useState("users");
  const[users,setUsers]=useState([]);
  const[usersLoad,setUsersLoad]=useState(false);
  const[usersError,setUsersError]=useState("");
  const[showExportModal,setShowExportModal]=useState(false);
  const[exportOpts,setExportOpts]=useState({datasets:[],status:"",depFrom:"",depTo:"",bkFrom:"",bkTo:""});
  const[showAddUser,setShowAddUser]=useState(false);
  const[showNewPw,setShowNewPw]=useState(false);
  const[editUser,setEditUser]=useState(null);
  const[newUser,setNewUser]=useState({name:"",username:"",email:"",password:"",role:"viewer"});
  const[apiKeys,setApiKeys]=useState({openai:"",anthropic:"",emailAlert:""});
  const[sidebarOpen,setSidebarOpen]=useState(typeof window!=="undefined"?window.innerWidth>768:true);
  const[clock,setClock]=useState(dubaiTime());
  const[lastSync,setLastSync]=useState("");

  useEffect(()=>{const iv=setInterval(()=>setClock(dubaiTime()),1000);return()=>clearInterval(iv);},[]);
  useEffect(()=>{if(!token)return;try{const p=JSON.parse(atob(token.split(".")[1]));setUser(p.user||p);}catch{}},[token]);

  const switchTheme=k=>{setThemeKey(k);localStorage.setItem("ttp_theme",k);};
  const logout=()=>{localStorage.removeItem("ttp_token");sessionStorage.removeItem("ttp_token");setToken("");setUser(null);};
  const onLogin=(tok,u)=>{localStorage.setItem("ttp_token",tok);sessionStorage.setItem("ttp_token",tok);setToken(tok);setUser(u);};

  const buildP=useCallback(f=>{
    const p={};
    if(f.depFrom)p.departureDateFrom=f.depFrom;if(f.depTo)p.departureDateTo=f.depTo;
    if(f.bkFrom)p.bookingDateFrom=f.bkFrom;if(f.bkTo)p.bookingDateTo=f.bkTo;
    if((f.dataset||[]).length)p.dataset=f.dataset;
    if((f.status||[]).length)p.status=f.status;
    if((f.transport||[]).length)p.transportType=f.transport;
    if((f.years||[]).length)p.year=f.years;
    return p;
  },[]);

  const loadOverview=useCallback(f=>{
    if(!token)return;setOLoad(true);
    const p=buildP(f);
    Promise.all([
      apiFetch("/api/dashboard/kpis",p).catch(()=>null),
      apiFetch("/api/dashboard/revenue-by-year",p).catch(()=>[]),
      apiFetch("/api/dashboard/year-month-comparison",p).catch(()=>[]),
    ]).then(([k,r,ym])=>{
      if(k&&!k.error)setKpis(k);
      if(Array.isArray(r))setRevData(r);
      if(Array.isArray(ym))setYmData(ym);
      setLastSync(dubaiTime());
    }).catch(console.error).finally(()=>setOLoad(false));
  },[token,buildP]);

  // Load users from backend
  const loadUsers = useCallback(async()=>{
    if(!token||user?.role!=="admin") return;
    setUsersLoad(true); setUsersError("");
    try {
      const t = localStorage.getItem("ttp_token");
      const r = await fetch(`${BASE}/api/auth/users`,{headers:{"Authorization":`Bearer ${t}`}});
      if(r.ok){ const d=await r.json(); if(Array.isArray(d)) setUsers(d); }
      else setUsersError("Failed to load users");
    } catch { setUsersError("Cannot connect to server"); }
    finally { setUsersLoad(false); }
  },[token,user]);

  useEffect(()=>{
    if(!token)return;
    apiFetch("/api/dashboard/slicers",{}).then(d=>{if(d&&!d.error)setSlicers(d);}).catch(()=>{});
    loadOverview({});
  },[token]);

  useEffect(()=>{ if(token&&user?.role==="admin") loadUsers(); },[token,user]);
  useEffect(()=>{if(token)loadOverview(applied);},[applied]);

  const loadBus=useCallback(f=>{
    if(!token)return;setBLoad(true);
    const p={};
    if(f.dateFrom)    p.dateFrom=f.dateFrom;
    if(f.dateTo)      p.dateTo=f.dateTo;
    if(f.pendel)      p.pendel=f.pendel;
    if(f.region)      p.region=f.region;
    if(f.destination) p.destination=f.destination;
    if(f.weekday)     p.weekday=f.weekday;
    if(f.feederLabel)  p.label=f.feederLabel;
    if(f.feederLine)   p.feederLine=f.feederLine;
    if((f.datasets||[]).length) p.dataset=f.datasets;
    Promise.all([
      apiFetch("/api/dashboard/bus-kpis",p).catch(()=>({})),
      apiFetch("/api/dashboard/pendel-overview",p).catch(()=>[]),
      apiFetch("/api/dashboard/feeder-overview",p).catch(()=>[]),
      apiFetch("/api/dashboard/deck-class",p).catch(()=>[]),
    ]).then(([bk,pd,fd,dc])=>{
      if(bk&&!bk.error)setBusKpis(bk);
      if(Array.isArray(pd))setPendelData(pd);
      if(Array.isArray(fd))setFeederData(fd);
      if(Array.isArray(dc))setDeckData(dc);
    }).finally(()=>setBLoad(false));
  },[token]);

  useEffect(()=>{
    if(token){
      const y=new Date().getFullYear();
      const initF={dateFrom:`${y}-01-01`,dateTo:`${y}-12-31`,pendel:"",region:"",destination:"",weekday:""};
      setBusF(initF);
      loadBus(initF);
      apiFetch("/api/dashboard/bus-slicers",{}).then(d=>{if(d&&!d.error)setBusSlicers(d);}).catch(()=>{});
    }
  },[token]);

  const loadTable=useCallback(()=>{
    if(!token)return;setTLoad(true);
    const p={...tableFilters,page:tablePage,limit:50};
    const endpoint=tableFilters.dataset==="Snowtravel"?"/api/dashboard/snowtravel-table":"/api/dashboard/bookings-table";
    apiFetch(endpoint,p).then(d=>{
      if(d?.rows){setTableRows(d.rows);setTableTotal(d.total||0);}
    }).catch(()=>[]).finally(()=>setTLoad(false));
  },[token,tableFilters,tablePage]);

  useEffect(()=>{if(token&&tab==="table"){setTablePage(1);loadTable();};},[token,tab]);
  useEffect(()=>{if(token&&tab==="table")loadTable();},[tablePage]);


  useEffect(()=>{if(chatRef.current)chatRef.current.scrollTop=chatRef.current.scrollHeight;},[msgs]);
  const sendAI=async msg=>{
    if(!msg.trim()||aiLoad)return;
    setMsgs(m=>[...m,{role:"user",text:msg}]);setAiInput("");setAiLoad(true);
    try{
      const r=await fetch(`${BASE}/api/ai/chat`,{method:"POST",headers:{"Authorization":`Bearer ${localStorage.getItem("ttp_token")}`,"Content-Type":"application/json"},body:JSON.stringify({message:msg})});
      if(r.status===401){setMsgs(m=>[...m,{role:"assistant",text:"Session expired. Please refresh the page."}]);setAiLoad(false);return;}
      const d=await r.json();
      setMsgs(m=>[...m,{role:"assistant",text:d.reply||"No response."}]);
    }catch{setMsgs(m=>[...m,{role:"assistant",text:"Connection error. Please try again."}]);}
    finally{setAiLoad(false);}
  };
  const doExport=(type)=>{
    const p={};
    if(exportOpts.dataset)p.dataset=exportOpts.dataset;
    if(exportOpts.status&&exportOpts.status!=="all")p.status=exportOpts.status;
    if(exportOpts.depFrom)p.departureDateFrom=exportOpts.depFrom;
    if(exportOpts.depTo)p.departureDateTo=exportOpts.depTo;
    if(exportOpts.bkFrom)p.bookingDateFrom=exportOpts.bkFrom;
    if(exportOpts.bkTo)p.bookingDateTo=exportOpts.bkTo;
    const qs=new URLSearchParams({...p,token}).toString();
    if(type==="excel"){window.open(`${API}/api/dashboard/export-excel?${qs}`,"_blank");setShowExportModal(false);return;}
    if(type==="csv"){window.open(`${API}/api/dashboard/export?${qs}`,"_blank");setShowExportModal(false);return;}
    if(type==="print"){setShowExportModal(false);setTimeout(()=>window.print(),100);return;}
    setShowExportModal(false);
  };
  const exportCSV=()=>setShowExportModal(true);

  const QUICK=[
    {l:"This Year",fn:()=>{const y=new Date().getFullYear();setFilters(f=>({...f,depFrom:`${y}-01-01`,depTo:`${y}-12-31`}));}},
    {l:"Last Year",fn:()=>{const y=new Date().getFullYear()-1;setFilters(f=>({...f,depFrom:`${y}-01-01`,depTo:`${y}-12-31`}));}},
    {l:"Last 3M",fn:()=>{const to=new Date(),fr=new Date();fr.setMonth(fr.getMonth()-3);setFilters(f=>({...f,depFrom:fr.toISOString().split("T")[0],depTo:to.toISOString().split("T")[0]}));}},
    {l:"All",fn:()=>setFilters(f=>({...f,depFrom:"",depTo:"",bkFrom:"",bkTo:""}))},
    {l:"Solmar FY",fn:()=>{const y=new Date().getFullYear();setFilters(f=>({...f,depFrom:`${y-1}-12-01`,depTo:`${y}-11-30`,dataset:["Solmar"]}));},fiscal:true},
    {l:"ST FY",fn:()=>{const y=new Date().getFullYear();setFilters(f=>({...f,depFrom:`${y-1}-07-01`,depTo:`${y}-06-30`,dataset:["Snowtravel"]}));},fiscal:true},
  ];

  const isAdmin=user?.role==="admin";
  const isSnow=false; // Solmar only — bus data from solmar_bus_bookings_modified
  const busClassFiltered=busClass; // already filtered DEF only in backend
  const handleTabClick = (newTab) => {
    setTab(newTab);
    if (newTab === "bus") setBusFiltersOpen(true);
  };
  const NAV=[
    {id:"overview",label:"Overview",icon:Ic.overview},
    {id:"bus",label:"Bus Occupancy",icon:Ic.bus},
    {id:"table",label:"Data Table",icon:Ic.table},
    {id:"hotel",label:"Hotel",icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>},
    {id:"ai",label:"TTP AI",icon:Ic.ai},
    ...(isAdmin?[{id:"settings",label:"Settings",icon:Ic.settings}]:[]),
  ];

  if(!token)return <Login onLogin={onLogin} themeKey={themeKey} onTheme={switchTheme}/>;

  const inputStyle={width:"100%",boxSizing:"border-box",background:T.inputBg,border:`1px solid ${T.inputBorder}`,borderRadius:7,padding:"7px 10px",fontSize:13,color:T.text,outline:"none"};
  const labelStyle={fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.04em",display:"block"};

  // ─── YoY TABLE COLUMNS ───────────────────────────────────────────────────────
  const ymCols = [
    {label:"PERIOD",key:"period",noWrap:true,bold:true,color:(_,T)=>T.accent,render:r=>`${MONTHS[(r.month||1)-1]}-${r.year}`},
    {label:"LAST YEAR",key:"ly",noWrap:true,color:(_,T)=>T.textMuted,render:r=>`${MONTHS[(r.month||1)-1]}-${(r.year||0)-1}`},
    {label:"CURRENT",key:"curr",right:true,bold:true,render:r=>ymMetric==="bookings"?fmtN(r.currentBookings):ymMetric==="pax"?fmtN(r.currentPax):fmtEur(r.currentRevenue)},
    {label:"PREVIOUS",key:"prev",right:true,color:(_,T)=>T.textMuted,render:r=>ymMetric==="bookings"?fmtN(r.previousBookings):ymMetric==="pax"?fmtN(r.previousPax):fmtEur(r.previousRevenue)},
    {label:"DIFFERENCE",key:"diff",right:true,bold:true,noWrap:true,color:(r,T)=>diffClr(ymMetric==="bookings"?r.diffBookings:ymMetric==="pax"?r.diffPax:r.diffRevenue,T),render:r=>{const d=ymMetric==="bookings"?r.diffBookings:ymMetric==="pax"?r.diffPax:r.diffRevenue;return(d>0?"+":"")+( ymMetric==="revenue"?fmtEur(d):fmtN(d));}},
    {label:"DIFF %",key:"pct",right:true,noWrap:true,color:(r,T)=>{const d=ymMetric==="bookings"?r.diffBookings:ymMetric==="pax"?r.diffPax:r.diffRevenue;return diffClr(d,T);},render:r=>{const p=ymMetric==="bookings"?r.diffPctBookings:ymMetric==="pax"?r.diffPctPax:r.diffPctRevenue;return p!=null?(p>0?"+":"")+Number(p).toFixed(1)+"%":"—";}},
  ];

  // ─── BUS COLUMNS ─────────────────────────────────────────────────────────────
  const busCols=[
    {label:"START DATE",key:"StartDate",noWrap:true,bold:true,color:(_,T)=>T.accent},
    {label:"END DATE",key:"EndDate",noWrap:true,color:(_,T)=>T.textMuted},
    {label:"RC OUT",key:"ORC",right:true},{label:"FC",key:"OFC",right:true},{label:"PRE",key:"OPRE",right:true},
    {label:"TOTAL OUT",key:"OTotal",right:true,bold:true},
    {label:"RC",key:"RRC",right:true},{label:"FC",key:"RFC",right:true},{label:"PRE",key:"RPRE",right:true},
    {label:"TOTAL RET",key:"RTotal",right:true,bold:true},
    {label:"RC DIFF",key:"RC_Diff",right:true,bold:true,noWrap:true,color:(r,T)=>diffClr(r.RC_Diff,T),render:r=>(r.RC_Diff>0?"+":"")+r.RC_Diff},
    {label:"FC DIFF",key:"FC_Diff",right:true,bold:true,noWrap:true,color:(r,T)=>diffClr(r.FC_Diff,T),render:r=>(r.FC_Diff>0?"+":"")+r.FC_Diff},
    {label:"PRE DIFF",key:"PRE_Diff",right:true,bold:true,noWrap:true,color:(r,T)=>diffClr(r.PRE_Diff,T),render:r=>(r.PRE_Diff>0?"+":"")+r.PRE_Diff},
    {label:"TOTAL DIFF",key:"Total_Difference",right:true,bold:true,noWrap:true,color:(r,T)=>diffClr(r.Total_Difference,T),render:r=>(r.Total_Difference>0?"+":"")+r.Total_Difference},
  ];

  const pendelCols=[
    {label:"START DATE",key:"StartDate",noWrap:true,bold:true,color:(_,T)=>T.accent},
    {label:"END DATE",key:"EndDate",noWrap:true,color:(_,T)=>T.textMuted},
    {label:"OUT TOTAL",key:"Outbound_Total",right:true,bold:true,color:(_,T)=>T.success},
    {label:"OUT RC",key:"Outbound_Royal",right:true,color:(_,T)=>T.success},
    {label:"OUT FC",key:"Outbound_First",right:true,color:(_,T)=>T.success},
    {label:"OUT PRE",key:"Outbound_Premium",right:true,color:(_,T)=>T.success},
    {label:"IN TOTAL",key:"Inbound_Total",right:true,bold:true,color:(_,T)=>T.warning},
    {label:"IN RC",key:"Inbound_Royal",right:true,color:(_,T)=>T.warning},
    {label:"IN FC",key:"Inbound_First",right:true,color:(_,T)=>T.warning},
    {label:"IN PRE",key:"Inbound_Premium",right:true,color:(_,T)=>T.warning},
    {label:"DIFF RC",key:"Diff_Royal",right:true,bold:true,noWrap:true,color:(r,T)=>diffClr(r.Diff_Royal,T),render:r=>{const v=r.Diff_Royal||0;return v!==0?(v>0?"+":"")+v:"";}},
    {label:"DIFF FC",key:"Diff_First",right:true,bold:true,noWrap:true,color:(r,T)=>diffClr(r.Diff_First,T),render:r=>{const v=r.Diff_First||0;return v!==0?(v>0?"+":"")+v:"";}},
    {label:"DIFF PRE",key:"Diff_Premium",right:true,bold:true,noWrap:true,color:(r,T)=>diffClr(r.Diff_Premium,T),render:r=>{const v=r.Diff_Premium||0;return v!==0?(v>0?"+":"")+v:"";}},
  ];

  const feederCols=[
    {label:"DEP DATE",key:"DepartureDate",noWrap:true,bold:true,color:(_,T)=>T.accent},
    {label:"LABEL",key:"LabelName",noWrap:true},
    {label:"FEEDER LINE",key:"FeederLine",noWrap:true},
    {label:"DIRECTION",key:"Direction",noWrap:true,render:r=>{const d=r.Direction;return <span style={{color:d==="Outbound"?"#22c55e":"#f59e0b",fontWeight:600,fontSize:11}}>{d}</span>;}},
    {label:"ROUTE",key:"RouteLabel",noWrap:true},
    {label:"STOP",key:"StopName",noWrap:true},
    {label:"STOP TYPE",key:"StopType",noWrap:true,color:(_,T)=>T.textMuted},
    {label:"PAX",key:"TotalPax",right:true,bold:true},
    {label:"BOOKINGS",key:"BookingCount",right:true},
  ];

  const deckCols=[
    {label:"DEPARTURE",key:"dateDeparture",noWrap:true,bold:true,color:(_,T)=>T.accent},
    {label:"TOTAL",key:"Total",right:true,bold:true},
    {label:"RC LOWER",key:"Royal_Lower",right:true},{label:"RC UPPER",key:"Royal_Upper",right:true},{label:"RC NO",key:"Royal_NoDeck",right:true},
    {label:"FC LOWER",key:"First_Lower",right:true},{label:"FC UPPER",key:"First_Upper",right:true},{label:"FC NO",key:"First_NoDeck",right:true},
    {label:"PRE LOWER",key:"Premium_Lower",right:true},{label:"PRE UPPER",key:"Premium_Upper",right:true},{label:"PRE NO",key:"Premium_NoDeck",right:true},
  ];

  const tableCols=[
    {label:"BOOKING ID",key:"BookingID",noWrap:true,bold:true,color:(_,T)=>T.accent},
    {label:"DATASET",key:"Dataset",noWrap:true,render:r=><span style={{background:DS_COLORS[r.Dataset]+"22",color:DS_COLORS[r.Dataset]||T.textMuted,fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:10}}>{r.Dataset}</span>},
    {label:"STATUS",key:"Status",noWrap:true,render:r=><Badge color={r.Status==="ok"?"success":r.Status==="cancelled"?"danger":"muted"} T={T}>{r.Status}</Badge>},
    {label:"LABEL",key:"Label",noWrap:true,color:(_,T)=>T.textMuted},
    {label:"BOOKING DATE",key:"BookingDate",noWrap:true,color:(_,T)=>T.textMuted},
    {label:"DEP DATE",key:"DepartureDate",noWrap:true,bold:true},
    {label:"RET DATE",key:"ReturnDate",noWrap:true,color:(_,T)=>T.textMuted},
    {label:"DAYS",key:"Duration",right:true,color:(_,T)=>T.textMuted},
    {label:"PAX",key:"PAXCount",right:true,bold:true},
    {label:"REVENUE",key:"TotalRevenue",right:true,bold:true,render:r=>fmtEur(r.TotalRevenue)},
    {label:"REV/PAX",key:"RevenuePerPax",right:true,color:(_,T)=>T.textMuted,render:r=>fmtEur(r.RevenuePerPax)},
    {label:"TRANSPORT",key:"TransportType",noWrap:true},
    {label:"BUS CLASS",key:"BusType",noWrap:true},
    {label:"DEP PLACE",key:"DeparturePlace",noWrap:true},
    {label:"CITY",key:"City",noWrap:true},
    {label:"COUNTRY",key:"Country",noWrap:true},
    {label:"DESTINATION",key:"Destination",noWrap:true},
    {label:"YEAR",key:"Year",right:true,color:(_,T)=>T.textMuted},
    {label:"RESELLER",key:"Reseller",noWrap:true,color:(_,T)=>T.textMuted},
  ];

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return(
    <div style={{display:"flex",minHeight:"100vh",background:T.bg,fontFamily:"'Segoe UI',system-ui,sans-serif",color:T.text}}>

      {/* SIDEBAR */}
      <aside style={{width:sidebarOpen?240:64,flexShrink:0,background:T.sidebar,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",position:"fixed",top:0,left:0,height:"100vh",zIndex:100,transition:"width 0.2s",overflow:"hidden",boxShadow:T.cardShadow}}>
        <div style={{padding:"16px 14px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:10,minHeight:64}}>
          <div style={{width:32,height:32,background:T.accent,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <span style={{color:"#fff",fontWeight:800,fontSize:13,letterSpacing:"-0.5px"}}>TTP</span>
          </div>
          {sidebarOpen&&<div><div style={{fontSize:12,fontWeight:800,color:T.text,letterSpacing:"0.03em"}}>TTP ANALYTICS</div><div style={{fontSize:10,color:T.textDim}}>Data Engine v2.0</div></div>}
        </div>
        <nav style={{flex:1,padding:"8px 6px",overflowY:"auto"}}>
          {NAV.map(n=>(
            <button key={n.id} onClick={()=>{handleTabClick(n.id);if(window.innerWidth<=768)setSidebarOpen(false);}} title={!sidebarOpen?n.label:undefined} style={{display:"flex",alignItems:"center",gap:10,width:"100%",background:tab===n.id?T.navActive:"transparent",color:tab===n.id?T.accent:T.textMuted,border:"none",borderRadius:8,padding:"9px 11px",fontSize:13,fontWeight:tab===n.id?600:400,cursor:"pointer",textAlign:"left",marginBottom:2,transition:"all 0.15s"}}
              onMouseEnter={e=>{if(tab!==n.id){e.currentTarget.style.background=T.navHover;e.currentTarget.style.color=T.text;}}}
              onMouseLeave={e=>{if(tab!==n.id){e.currentTarget.style.background="transparent";e.currentTarget.style.color=T.textMuted;}}}>
              <span style={{flexShrink:0,opacity:tab===n.id?1:0.7}}>{n.icon}</span>
              {sidebarOpen&&n.label}
            </button>
          ))}
        </nav>
        <div style={{padding:"10px 10px",borderTop:`1px solid ${T.border}`}}>
          {sidebarOpen&&<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <div style={{width:28,height:28,background:T.accentLight,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",color:T.accent,flexShrink:0}}>{Ic.user}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.name||user?.username||"User"}</div>
              <div style={{fontSize:10,color:T.textDim,textTransform:"capitalize"}}>{user?.role||"viewer"}</div>
            </div>
          </div>}
          {sidebarOpen&&<div className="hide-mobile" style={{fontSize:10,color:T.textDim,fontFamily:"monospace",marginBottom:8,textAlign:"center"}}>{clock} DXB</div>}
          <button onClick={logout} title="Logout" style={{display:"flex",alignItems:"center",gap:6,width:"100%",background:"transparent",border:`1px solid ${T.border}`,borderRadius:7,padding:"6px 10px",fontSize:12,color:T.textMuted,cursor:"pointer",justifyContent:sidebarOpen?"flex-start":"center"}}>
            {Ic.logout}{sidebarOpen&&"Logout"}
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{marginLeft:sidebarOpen?240:64,flex:1,display:"flex",flexDirection:"column",minHeight:"100vh",transition:"margin-left 0.2s"}} className="main-content">

        {/* HEADER */}
        <header style={{background:T.headerBg,borderBottom:`1px solid ${T.border}`,padding:"0 20px",height:52,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:90,boxShadow:T.shadow}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={()=>setSidebarOpen(o=>!o)} style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:6,padding:"4px 7px",cursor:"pointer",color:T.textMuted,display:"flex",alignItems:"center",fontSize:16,lineHeight:1}}>☰</button>
            <span style={{fontSize:14,fontWeight:700,color:T.text}}>{NAV.find(n=>n.id===tab)?.label}</span>
          </div>
          <div className="header-btns" style={{display:"flex",alignItems:"center",gap:8}}>
            {lastSync&&<span style={{fontSize:11,color:T.textDim,display:"none"}}>Last sync: {lastSync}</span>}
            <button onClick={()=>switchTheme(themeKey==="dark"?"light":"dark")} style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:7,padding:"5px 8px",cursor:"pointer",color:T.textMuted,display:"flex",alignItems:"center",gap:4,fontSize:11}}>
              {themeKey==="dark"?Ic.sun:Ic.moon} {themeKey==="dark"?"Light":"Dark"}
            </button>
            <button onClick={()=>loadOverview(applied)} style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:7,padding:"5px 8px",cursor:"pointer",color:T.textMuted,display:"flex"}}>{Ic.refresh}</button>
            {tab!=="bus"&&tab!=="overview"&&<button onClick={()=>setFiltersOpen(o=>!o)} style={{background:filtersOpen?T.accent:"transparent",color:filtersOpen?"#fff":T.textMuted,border:`1px solid ${filtersOpen?T.accent:T.border}`,borderRadius:7,padding:"5px 11px",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
              {Ic.filter} Filters
            </button>}
            {tab==="overview"&&<button onClick={()=>setFiltersOpen(o=>!o)} style={{background:filtersOpen?T.accent:"transparent",color:filtersOpen?"#fff":T.textMuted,border:`1px solid ${filtersOpen?T.accent:T.border}`,borderRadius:7,padding:"5px 11px",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
              {Ic.filter} Filters
            </button>}
            {tab==="table"&&<button onClick={exportCSV} style={{background:T.accent,color:"#fff",border:"none",borderRadius:7,padding:"6px 13px",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>{Ic.download} Export</button>}
          </div>
        </header>

        {/* FILTER PANEL */}
        {filtersOpen&&tab!=="bus"&&(
          <div style={{background:T.headerBg,borderBottom:`1px solid ${T.border}`,padding:"13px 20px",boxShadow:T.shadow}}>
            <div style={{display:"flex",gap:6,marginBottom:10,alignItems:"center",flexWrap:"wrap"}}>
              <span style={{fontSize:11,color:T.textMuted,fontWeight:600}}>Quick:</span>
              {QUICK.filter(q=>!q.fiscal).map(q=><button key={q.l} onClick={()=>{q.fn();}} style={{background:T.tableAlt,border:`1px solid ${T.border}`,borderRadius:16,color:T.textMuted,padding:"3px 11px",fontSize:11,cursor:"pointer"}}>{q.l}</button>)}
              <span style={{color:T.textDim,fontSize:10}}>FY:</span>
              {QUICK.filter(q=>q.fiscal).map(q=><button key={q.l} onClick={()=>{q.fn();}} style={{background:T.accentLight,border:`1px solid ${T.accent}44`,borderRadius:16,color:T.accent,padding:"3px 11px",fontSize:11,cursor:"pointer",fontWeight:600}}>{q.l}</button>)}
              {Object.values(applied).some(v=>v&&(Array.isArray(v)?v.length:true))&&(
                <span style={{marginLeft:4,fontSize:11,color:T.warning,fontWeight:600,display:"flex",alignItems:"center",gap:5}}>
                  ⚠ Filters active —
                  <button onClick={()=>{setFilters({depFrom:"",depTo:"",bkFrom:"",bkTo:"",dataset:[],status:[],transport:[],years:[]});setApplied({});}} style={{background:T.warningBg,border:`1px solid ${T.warning}`,borderRadius:10,color:T.warning,padding:"2px 9px",fontSize:11,cursor:"pointer",fontWeight:700}}>Reset All</button>
                </span>
              )}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,alignItems:"end"}}>
              {[["Departure From","depFrom"],["Departure To","depTo"],["Booking From","bkFrom"],["Booking To","bkTo"]].map(([l,k])=>(
                <div key={k}><label style={labelStyle}>{l}</label><input type="date" value={filters[k]||""} onChange={e=>setFilters(f=>({...f,[k]:e.target.value}))} style={{...inputStyle,colorScheme:themeKey==="dark"?"dark":"light"}}/></div>
              ))}
              <div><label style={labelStyle}>Dataset</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {["Solmar","Interbus","Solmar DE","Snowtravel"].map(d=>{
                    const sel=(filters.dataset||[]).includes(d);
                    const col=DS_COLORS[d]||T.textMuted;
                    return <button key={d} onClick={()=>setFilters(f=>({...f,dataset:sel?(f.dataset||[]).filter(x=>x!==d):[...(f.dataset||[]),d]}))}
                      style={{background:sel?`${col}22`:"transparent",border:`1px solid ${sel?col:T.border}`,borderRadius:20,color:sel?col:T.textMuted,padding:"4px 10px",fontSize:11,fontWeight:sel?700:400,cursor:"pointer"}}>
                      {d}
                    </button>;
                  })}
                </div>
                {(filters.dataset||[]).length>0&&<div style={{fontSize:10,color:T.accent,marginTop:2}}>{filters.dataset.join(' + ')}</div>}
              </div>
              <div><label style={labelStyle}>Transport</label>
                <select value={(filters.transport||[])[0]||""} onChange={e=>setFilters(f=>({...f,transport:e.target.value?[e.target.value]:[]}))} style={inputStyle}>
                  <option value="">All</option>
                  {[...new Set((slicers.transportTypes||[]).map(t=>(t||"").toLowerCase().replace("owntransport","own transport").trim()))].filter(Boolean).map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Year</label>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {[2023,2024,2025,2026].map(y=>{
                    const sel=(filters.years||[]).includes(y);
                    return <button key={y} onClick={()=>setFilters(f=>({...f,years:sel?(f.years||[]).filter(x=>x!==y):[...(f.years||[]),y]}))}
                      style={{background:sel?T.accent:"transparent",color:sel?"#fff":T.textMuted,border:`1px solid ${sel?T.accent:T.border}`,borderRadius:6,padding:"4px 10px",fontSize:12,fontWeight:sel?700:400,cursor:"pointer",flex:1}}>
                      {y}
                    </button>;
                  })}
                </div>
                {(filters.years||[]).length>0&&<div style={{fontSize:10,color:T.accent,marginTop:3}}>Selected: {filters.years.join(", ")}</div>}
              </div>
              <div><label style={labelStyle}>Status</label>
                <div style={{display:"flex",gap:5}}>
                  {[["","All"],["ok","OK"],["cancelled","Cancelled"]].map(([v,l])=>{
                    const active=v===""?(filters.status||[]).length===0:(filters.status||[]).includes(v);
                    const col=v==="ok"?T.success:v==="cancelled"?T.danger:T.textMuted;
                    return <button key={v} onClick={()=>setFilters(f=>({...f,status:v?[v]:[]}))} style={{flex:1,background:active?`${col}22`:"transparent",border:`1px solid ${active?col:T.border}`,borderRadius:6,color:active?col:T.textMuted,padding:"6px 4px",fontSize:11,cursor:"pointer",fontWeight:active?700:400,textAlign:"center"}}>{l}</button>;
                  })}
                </div>
              </div>
              <div style={{display:"flex",gap:8,paddingTop:18}}>
                <Btn onClick={()=>{setApplied({...filters});setFiltersOpen(false);}} T={T} style={{flex:1,justifyContent:"center"}}>Apply</Btn>
                <Btn variant="ghost" onClick={()=>{setFilters({depFrom:"",depTo:"",bkFrom:"",bkTo:"",dataset:[],status:[],transport:[],years:[]});setApplied({});}} T={T} style={{flex:1,justifyContent:"center"}}>Reset</Btn>
              </div>
            </div>
          </div>
        )}

        {/* PAGE CONTENT */}
        <div id="dashboard-content" style={{flex:1,padding:"18px 20px 50px",overflowY:"auto",overflowX:"hidden"}}>

          {/* ══ OVERVIEW ═══════════════════════════════════════════════════════ */}
          {tab==="overview"&&(
            <div>
              {oLoad&&<div style={{textAlign:"center",padding:16,color:T.textMuted,fontSize:13}}>Loading...</div>}
              {/* KPI Cards */}
              <div className="kpi-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:16}}>
                {/* Period badge above cards */}
              {kpis?.periodLabel&&(
                <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:6,marginBottom:-6}}>
                  <span style={{fontSize:11,color:T.textDim}}>Showing:</span>
                  <span style={{fontSize:11,fontWeight:700,color:T.accent,background:T.accentLight,padding:"3px 10px",borderRadius:20,border:`1px solid ${T.accent}33`}}>{kpis.periodLabel}</span>
                  {Object.values(applied).some(v=>v&&(Array.isArray(v)?v.length:true))&&(
                    <button onClick={()=>{setFilters({depFrom:"",depTo:"",bkFrom:"",bkTo:"",dataset:[],status:[],transport:[],years:[]});setApplied({});loadOverview({});}}
                      style={{fontSize:11,color:T.warning,background:T.warningBg,border:`1px solid ${T.warning}44`,borderRadius:12,padding:"2px 8px",cursor:"pointer",fontWeight:600}}>✕ Reset filters</button>
                  )}
                </div>
              )}
              {[
                {label:"Total Bookings",curr:kpis?.currentBookings,prev:kpis?.previousBookings,diff:kpis?.differenceBookings,pct:kpis?.percentBookings,f:fmtN,c:"#3b82f6"},
                {label:"Total PAX",curr:kpis?.currentPax,prev:kpis?.previousPax,diff:kpis?.differencePax,pct:kpis?.percentPax,f:fmtN,c:"#22c55e"},
                {label:"Gross Revenue",curr:kpis?.currentRevenue,prev:kpis?.previousRevenue,diff:kpis?.differenceRevenue,pct:kpis?.percentRevenue,f:fmtEur,c:"#f59e0b"},
              ].map(({label,curr,prev,diff,pct,f,c})=>(
                <Card key={label} style={{padding:"18px 20px"}} T={T}>
                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:12}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:c,flexShrink:0}}/>
                    <span style={{fontSize:11,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.07em"}}>{label}</span>
                  </div>
                  <div className="kpi-value" style={{fontSize:28,fontWeight:800,color:T.text,lineHeight:1,marginBottom:5}}>{curr!=null?f(curr):"—"}</div>
                  <div style={{fontSize:12,color:T.textMuted,marginBottom:8}}>
                    {prev!=null&&prev>0
                      ? <>{kpis?.prevLabel||"prev"}: <span style={{fontWeight:600}}>{f(prev)}</span></>
                      : <span style={{color:T.textDim}}>no previous data</span>
                    }
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:7}}>
                    {diff!=null&&diff!==0&&<span style={{display:"flex",alignItems:"center",gap:2,color:diffClr(diff,T),fontSize:12,fontWeight:700}}>{diff>=0?Ic.arrowUp:Ic.arrowDown}{f(Math.abs(diff))}</span>}
                    {pct!=null&&<span style={{background:diffBg(diff,T),color:diffClr(diff,T),fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:10,border:`1px solid ${diffClr(diff,T)}33`}}>{diff>=0?"+":""}{Number(pct).toFixed(1)}%</span>}
                  </div>
                </Card>
              ))}
              </div>
              {/* Charts */}
              <div className="chart-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
                <Card T={T}><CardHdr title="Revenue by Year" T={T}/><div style={{padding:"14px 16px 12px"}}><LineChart data={revData} T={T}/></div></Card>
                <Card T={T}><div style={{padding:"14px 16px 0"}}><BarChart data={revData} metric={barMetric} onMetric={setBarMetric} T={T}/></div><div style={{height:12}}/></Card>
              </div>
              {/* YoY Table */}
              <Card T={T}>
                <CardHdr title={`Year-Month Comparison ${Object.values(applied).some(v=>v&&(Array.isArray(v)?v.length:true))?"(filtered — reset for all data)":""}`} T={T} right={
                  <div style={{display:"flex",gap:4,alignItems:"center"}}>
                    <span style={{fontSize:11,color:T.textDim,marginRight:6}}>{ymData.length} rows</span>
                    {["bookings","pax","revenue"].map(m=>(
                      <button key={m} onClick={()=>setYmMetric(m)} style={{background:ymMetric===m?T.accent:"transparent",color:ymMetric===m?"#fff":T.textMuted,border:`1px solid ${ymMetric===m?T.accent:T.border}`,borderRadius:5,padding:"3px 9px",fontSize:11,fontWeight:600,cursor:"pointer",textTransform:"capitalize"}}>{m==="revenue"?"Revenue":m==="bookings"?"Bookings":"PAX"}</button>
                    ))}
                  </div>}/>
                <DataTable columns={ymCols} rows={ymData} emptyMsg="No data — apply filters or refresh" T={T}/>
              </Card>
            </div>
          )}

          {/* ══ BUS OCCUPANCY ══════════════════════════════════════════════════ */}
          {tab==="bus"&&(
            <div>
              {/* Top bar */}
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
                <div style={{background:T.accent,color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",gap:5}}>
                  🚌 Solmar Bus Occupancy
                </div>
                <div style={{display:"flex",background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:3,gap:2}}>
                  {[["pendel","Pendel overview"],["feeder","Feeder overview"],["deck","Deck choice / class"]].map(([k,l])=>(
                    <button key={k} onClick={()=>setBusView(k)} style={{background:busView===k?T.accent:"transparent",color:busView===k?"#fff":T.textMuted,border:"none",borderRadius:6,padding:"6px 13px",fontSize:12,fontWeight:busView===k?600:400,cursor:"pointer",whiteSpace:"nowrap"}}>{l}</button>
                  ))}
                </div>
                <div style={{flex:1}}/>
                <button onClick={()=>setBusFiltersOpen(o=>!o)} style={{background:busFiltersOpen?T.accent:T.accentLight,color:busFiltersOpen?"#fff":T.accent,border:`1px solid ${T.accent}`,borderRadius:7,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                  {Ic.filter} {busFiltersOpen?"Hide Filters":"Show Filters"}
                </button>
              </div>

              <div style={{display:"flex",gap:0,alignItems:"flex-start"}}>
                <div style={{flex:1,minWidth:0}}>
                  {bLoad&&<div style={{textAlign:"center",padding:20,color:T.textMuted}}>Loading bus data...</div>}

                  {/* Bus KPI Cards */}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:14}}>
                    {[
                      {label:"Total PAX",val:busKpis.total_pax,c:"#3b82f6"},
                      {label:"Royal Class",val:busKpis.royal_pax,c:"#8b5cf6"},
                      {label:"First Class",val:busKpis.first_pax,c:"#22c55e"},
                      {label:"Premium",val:busKpis.premium_pax,c:"#f59e0b"},
                      {label:"Total Bookings",val:busKpis.total_bookings,c:"#06b6d4"},
                    ].map(({label,val,c})=>(
                      <Card key={label} style={{padding:"14px 16px"}} T={T}>
                        <div style={{fontSize:10,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>{label}</div>
                        <div style={{fontSize:22,fontWeight:800,color:c,lineHeight:1}}>{val!=null?Number(val).toLocaleString("nl-BE"):"—"}</div>
                      </Card>
                    ))}
                  </div>
                  {/* Deck split KPIs */}
                  {busView==="deck"&&(
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
                      {[
                        {label:"Lower Deck",val:busKpis.lower_pax,c:"#ef4444"},
                        {label:"Upper Deck",val:busKpis.upper_pax,c:"#f97316"},
                        {label:"No Guarantee",val:busKpis.no_deck_pax,c:"#6b7280"},
                      ].map(({label,val,c})=>(
                        <Card key={label} style={{padding:"12px 16px"}} T={T}>
                          <div style={{fontSize:10,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>{label}</div>
                          <div style={{fontSize:20,fontWeight:800,color:c}}>{val!=null?Number(val).toLocaleString("nl-BE"):"—"}</div>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Pendel overview */}
                  {busView==="pendel"&&(
                    <Card T={T}>
                      <CardHdr title="Pendel Overview — Solmar" T={T}
                        right={<div style={{display:"flex",gap:12,alignItems:"center"}}>
                          <span style={{fontSize:11,color:T.success,fontWeight:600}}>⬆ OUT</span>
                          <span style={{fontSize:11,color:T.warning,fontWeight:600}}>⬇ IN</span>
                          <span style={{fontSize:11,color:T.textDim}}>{pendelData.length} trips</span>
                        </div>}/>
                      {pendelData.length>0&&(
                        <div style={{padding:"8px 16px",background:T.accentLight,borderBottom:`1px solid ${T.border}`,display:"flex",gap:24,flexWrap:"wrap"}}>
                          <span style={{fontSize:11,fontWeight:700,color:T.accent}}>TOTAL: {pendelData.length} trips</span>
                          <span style={{fontSize:11,color:T.success}}>OUT: {pendelData.reduce((s,r)=>s+(r.Outbound_Total||0),0).toLocaleString("nl-BE")}</span>
                          <span style={{fontSize:11,color:T.warning}}>IN: {pendelData.reduce((s,r)=>s+(r.Inbound_Total||0),0).toLocaleString("nl-BE")}</span>
                        </div>
                      )}
                      <DataTable columns={[
                        {label:"START DATE",key:"StartDate",noWrap:true,bold:true,color:(_,T)=>T.accent},
                        {label:"RETURN DATE",key:"EndDate",noWrap:true,color:(_,T)=>T.textMuted},
                        {label:"PENDEL",key:"Pendel",noWrap:true,color:(_,T)=>T.textMuted},
                        {label:"OUT TOTAL",key:"Outbound_Total",right:true,bold:true,color:(_,T)=>T.success},
                        {label:"OUT RC",key:"ORC",right:true,color:(_,T)=>T.success},
                        {label:"OUT FC",key:"OFC",right:true,color:(_,T)=>T.success},
                        {label:"OUT PRE",key:"OPRE",right:true,color:(_,T)=>T.success},
                        {label:"IN TOTAL",key:"Inbound_Total",right:true,bold:true,color:(_,T)=>T.warning},
                        {label:"IN RC",key:"RRC",right:true,color:(_,T)=>T.warning},
                        {label:"IN FC",key:"RFC",right:true,color:(_,T)=>T.warning},
                        {label:"IN PRE",key:"RPRE",right:true,color:(_,T)=>T.warning},
                        {label:"DIFF RC",key:"Diff_Royal",right:true,bold:true,noWrap:true,color:(r,T)=>diffClr(r.Diff_Royal,T),render:r=>{const v=r.Diff_Royal||0;return v!==0?(v>0?"+":"")+v:"";}},
                        {label:"DIFF FC",key:"Diff_First",right:true,bold:true,noWrap:true,color:(r,T)=>diffClr(r.Diff_First,T),render:r=>{const v=r.Diff_First||0;return v!==0?(v>0?"+":"")+v:"";}},
                        {label:"DIFF PRE",key:"Diff_Premium",right:true,bold:true,noWrap:true,color:(r,T)=>diffClr(r.Diff_Premium,T),render:r=>{const v=r.Diff_Premium||0;return v!==0?(v>0?"+":"")+v:"";}},
                        {label:"DIFF TOTAL",key:"Diff_Total",right:true,bold:true,noWrap:true,color:(r,T)=>diffClr(r.Diff_Total,T),render:r=>{const v=r.Diff_Total||0;return v!==0?(v>0?"+":"")+v:"";}},
                      ]} rows={pendelData} emptyMsg="No pendel data — set date range and click Apply" T={T}/>
                      <div style={{padding:"7px 14px",borderTop:`1px solid ${T.border}`,fontSize:10,color:T.textDim}}>
                        RC = Royal Class &nbsp;|&nbsp; FC = First Class &nbsp;|&nbsp; PRE = Premium &nbsp;|&nbsp;
                        <span style={{color:T.success}}>OUT = Outbound</span> &nbsp;|&nbsp;
                        <span style={{color:T.warning}}>IN = Inbound</span> &nbsp;|&nbsp;
                        DIFF = Outbound minus Inbound (negative = more inbound than outbound)
                      </div>
                    </Card>
                  )}
                  {busView==="pendel"&&false&&(
                    <Card T={T}>
                      <CardHdr title="Snowtravel Bus Occupancy" T={T} right={<span style={{fontSize:11,color:T.textDim}}>{stTrips.length} rows</span>}/>
                      <DataTable columns={[
                        {label:"DEPARTURE",key:"departure_date",noWrap:true,bold:true,color:(_,T)=>T.accent},

                        {label:"DREAM CLASS",key:"dream_class",right:true,bold:true},
                        {label:"FIRST CLASS",key:"first_class",right:true,bold:true},
                        {label:"SLEEP/ROYAL",key:"sleep_royal_class",right:true,bold:true},
                        {label:"TOTAL PAX",key:"total_pax",right:true,bold:true,color:(_,T)=>T.accent},
                      ]} rows={stTrips} emptyMsg="No Snowtravel bus data" T={T}/>
                    </Card>
                  )}

                  {/* Feeder overview — pivot table only, no charts */}
                  {busView==="feeder"&&(
                    <Card T={T}>
                      <CardHdr title={`Feeder Overview — Solmar${busF.feederLabel?' — '+busF.feederLabel:''}`} T={T}
                        right={<span style={{fontSize:11,color:T.textDim}}>{feederData.length} stops</span>}/>
                      <FeederPivotTable data={feederData} T={T}/>
                    </Card>
                  )}

                  {/* Deck choice/class */}
                  {busView==="deck"&&(
                    <Card T={T}>
                      <CardHdr title="Deck Choice / Class — Solmar" T={T} right={
                        <div style={{display:"flex",gap:8,alignItems:"center"}}>
                          <span style={{fontSize:10,color:T.warning,background:T.warningBg,padding:"2px 8px",borderRadius:10,border:`1px solid ${T.warning}`}}>⚠ Lower/Upper deck data pending from pipeline</span>
                          <span style={{fontSize:11,color:T.textDim}}>{deckData.length} rows</span>
                        </div>}/>
                      <DeckTable data={deckData} T={T}/>
                      <div style={{padding:"7px 14px",borderTop:`1px solid ${T.border}`,fontSize:10,color:T.textDim}}>RC = Royal Class &nbsp;|&nbsp; FC = First Class &nbsp;|&nbsp; PRE = Premium &nbsp;|&nbsp; Lwr = Lower Deck &nbsp;|&nbsp; Upr = Upper Deck &nbsp;|&nbsp; No = No Deck</div>
                    </Card>
                  )}
                </div>

                {/* Bus filter panel - overlay drawer */}
                {busFiltersOpen&&(
                  <div style={{position:"fixed",top:52,right:0,width:260,height:"calc(100vh - 52px)",background:T.card,borderLeft:`1px solid ${T.border}`,boxShadow:"-4px 0 20px rgba(0,0,0,0.15)",zIndex:200,overflowY:"auto",display:"flex",flexDirection:"column",gap:11,padding:"16px 14px"}}>

                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingBottom:10,borderBottom:`1px solid ${T.border}`}}>
                      <span style={{fontSize:13,fontWeight:700,color:T.text}}>Filters</span>
                      <button onClick={()=>setBusFiltersOpen(false)} style={{background:"transparent",border:"none",cursor:"pointer",color:T.textMuted,fontSize:18,lineHeight:1,padding:0}}>×</button>
                    </div>

                    {/* Dataset chips */}
                    <div>
                      <label style={labelStyle}>Dataset</label>
                      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                        {[["Solmar","#22c55e"],["Interbus","#f59e0b"],["Solmar DE","#ef4444"],["Snowtravel","#3b82f6"]].map(([ds,c])=>{
                          const sel=(busF.datasets||[]).includes(ds);
                          return <button key={ds} onClick={()=>setBusF(f=>({...f,datasets:sel?(f.datasets||[]).filter(x=>x!==ds):[...(f.datasets||[]),ds]}))}
                            style={{background:sel?`${c}22`:"transparent",border:`1px solid ${sel?c:T.border}`,borderRadius:20,color:sel?c:T.textMuted,padding:"4px 10px",fontSize:11,fontWeight:sel?700:400,cursor:"pointer",whiteSpace:"nowrap"}}>
                            {ds}
                          </button>;
                        })}
                      </div>
                      {(busF.datasets||[]).length>0&&<div style={{fontSize:10,color:T.accent,marginTop:2}}>{busF.datasets.join(' + ')}</div>}
                    </div>

                    {/* Quick year buttons */}
                    <div>
                      <label style={labelStyle}>Quick Select</label>
                      <div style={{display:"flex",gap:4}}>
                        {[["This Year",`${new Date().getFullYear()}-01-01`,`${new Date().getFullYear()}-12-31`],
                          ["Last Year",`${new Date().getFullYear()-1}-01-01`,`${new Date().getFullYear()-1}-12-31`],
                          ["All","",""]].map(([l,f,t])=>(
                          <button key={l} onClick={()=>setBusF(p=>({...p,dateFrom:f,dateTo:t}))}
                            style={{flex:1,background:busF.dateFrom===f&&busF.dateTo===t?T.accent:T.tableAlt,color:busF.dateFrom===f&&busF.dateTo===t?"#fff":T.textMuted,border:`1px solid ${T.border}`,borderRadius:6,padding:"5px 2px",fontSize:10,fontWeight:600,cursor:"pointer"}}>{l}</button>
                        ))}
                      </div>
                    </div>

                    <div><label style={labelStyle}>Departure From</label>
                      <input type="date" value={busF.dateFrom||""} onChange={e=>setBusF(f=>({...f,dateFrom:e.target.value}))} style={{...inputStyle,colorScheme:themeKey==="dark"?"dark":"light"}}/>
                    </div>
                    <div><label style={labelStyle}>Departure To</label>
                      <input type="date" value={busF.dateTo||""} onChange={e=>setBusF(f=>({...f,dateTo:e.target.value}))} style={{...inputStyle,colorScheme:themeKey==="dark"?"dark":"light"}}/>
                    </div>

                    {/* Pendel route */}
                    <div><label style={labelStyle}>Pendel Route</label>
                      <select value={busF.pendel||""} onChange={e=>setBusF(f=>({...f,pendel:e.target.value}))} style={inputStyle}>
                        <option value="">All Routes</option>
                        {(busSlicers.pendels||[]).map(p=><option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>

                    {/* Feeder Line filter — for feeder view */}
                    {busView==="feeder"&&<div><label style={labelStyle}>Feeder Line</label>
                      <select value={busF.feederLine||""} onChange={e=>setBusF(f=>({...f,feederLine:e.target.value}))} style={inputStyle}>
                        <option value="">All Lines</option>
                        {(busSlicers.feederLines||[]).map(l=><option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>}
                    {/* Label — for feeder */}
                    {busView==="feeder"&&<div><label style={labelStyle}>Label / Dataset</label>
                      <select value={busF.feederLabel||""} onChange={e=>setBusF(f=>({...f,feederLabel:e.target.value}))} style={inputStyle}>
                        <option value="">All Labels</option>
                        {["Solmar","Interbus","Solmar DE"].map(l=><option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>}

                    <div><label style={labelStyle}>Region</label>
                      <select value={busF.region||""} onChange={e=>setBusF(f=>({...f,region:e.target.value}))} style={inputStyle}>
                        <option value="">All Regions</option>
                        {(busSlicers.regions||[]).map(r=><option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>

                    <div><label style={labelStyle}>Destination</label>
                      <select value={busF.destination||""} onChange={e=>setBusF(f=>({...f,destination:e.target.value}))} style={inputStyle}>
                        <option value="">All Destinations</option>
                        {(busSlicers.destinations||[]).map(d=><option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>

                    <div><label style={labelStyle}>Weekday (Outbound)</label>
                      <select value={busF.weekday||""} onChange={e=>setBusF(f=>({...f,weekday:e.target.value}))} style={inputStyle}>
                        <option value="">All Days</option>
                        {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map(d=><option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>

                    <div style={{display:"flex",gap:8,paddingTop:4,borderTop:`1px solid ${T.border}`}}>
                      <Btn onClick={()=>loadBus(busF)} T={T} style={{flex:1,justifyContent:"center"}}>Apply</Btn>
                      <Btn variant="ghost" onClick={()=>{
                        const y=new Date().getFullYear();
                        const f={dateFrom:`${y}-01-01`,dateTo:`${y}-12-31`,pendel:"",region:"",destination:"",weekday:"",feederLabel:"",datasets:[]};
                        setBusF(f);loadBus(f);
                      }} T={T} style={{flex:1,justifyContent:"center"}}>Reset</Btn>
                    </div>
                  </div>
                )}              </div>
            </div>
          )}

          {/* ══ DATA TABLE ═════════════════════════════════════════════════════ */}
          {tab==="table"&&(
            <div>
              <Card T={T} style={{padding:"13px 16px",marginBottom:14}}>
                <div style={{display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap"}}>
                  <div>
                    <label style={labelStyle}>Search Booking ID</label>
                    <div style={{position:"relative"}}>
                      <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:T.textDim}}>{Ic.search}</span>
                      <input value={tableFilters.search||""} onChange={e=>setTableFilters(f=>({...f,search:e.target.value}))} placeholder="e.g. booking number..."
                        style={{...inputStyle,paddingLeft:30}}/>
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Dataset</label>
                    <select value={tableFilters.dataset||""} onChange={e=>setTableFilters(f=>({...f,dataset:e.target.value}))} style={inputStyle}>
                      <option value="">All datasets</option>
                      {["Snowtravel","Solmar","Interbus","Solmar DE"].map(d=><option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Status</label>
                    <select value={tableFilters.status||""} onChange={e=>setTableFilters(f=>({...f,status:e.target.value}))} style={inputStyle}>
                      <option value="">All</option>
                      <option value="ok">OK</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Booking From</label>
                    <input type="date" value={tableFilters.bkFrom||""} onChange={e=>setTableFilters(f=>({...f,bkFrom:e.target.value}))} style={{...inputStyle,colorScheme:themeKey==="dark"?"dark":"light"}}/>
                  </div>
                  <div>
                    <label style={labelStyle}>Booking To</label>
                    <input type="date" value={tableFilters.bkTo||""} onChange={e=>setTableFilters(f=>({...f,bkTo:e.target.value}))} style={{...inputStyle,colorScheme:themeKey==="dark"?"dark":"light"}}/>
                  </div>
                  <div>
                    <label style={labelStyle}>Departure From</label>
                    <input type="date" value={tableFilters.depFrom||""} onChange={e=>setTableFilters(f=>({...f,depFrom:e.target.value}))} style={{...inputStyle,colorScheme:themeKey==="dark"?"dark":"light"}}/>
                  </div>
                  <div>
                    <label style={labelStyle}>Departure To</label>
                    <input type="date" value={tableFilters.depTo||""} onChange={e=>setTableFilters(f=>({...f,depTo:e.target.value}))} style={{...inputStyle,colorScheme:themeKey==="dark"?"dark":"light"}}/>
                  </div>
                  <div style={{display:"flex",gap:7,alignItems:"flex-end",paddingTop:18,flexShrink:0}}>
                    <Btn onClick={()=>{setTablePage(1);loadTable();}} T={T}>Apply</Btn>
                    <Btn onClick={exportCSV} T={T} style={{background:T.successBg,color:T.success,fontWeight:700}}>{Ic.download} CSV</Btn>
                    <Btn onClick={()=>window.print()} T={T} variant="ghost">Print</Btn>
                    <Btn onClick={async()=>{
                      try{
                        const h2c=(await import('html2canvas')).default;
                        const el=document.getElementById('dashboard-content');
                        if(!el){alert('Content not found');return;}
                        const canvas=await h2c(el,{scale:2,useCORS:true,backgroundColor:T.bg});
                        const link=document.createElement('a');
                        link.download=`ttp-dashboard-${new Date().toISOString().split('T')[0]}.jpg`;
                        link.href=canvas.toDataURL('image/jpeg',0.92);link.click();
                      }catch(e){alert('PDF/Image export: '+e.message);}
                    }} T={T} variant="ghost">Save JPG</Btn>
                  </div>
                </div>
              </Card>
              <Card T={T}>
                <CardHdr title="Bookings" T={T} right={
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:11,color:T.textDim}}>{fmtN(tableTotal)} total</span>
                    <div style={{display:"flex",gap:4}}>
                      <button onClick={()=>setTablePage(p=>Math.max(1,p-1))} disabled={tablePage===1} style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:5,padding:"3px 8px",fontSize:12,cursor:"pointer",color:T.textMuted}}>‹</button>
                      <span style={{padding:"3px 8px",fontSize:12,color:T.textMuted,border:`1px solid ${T.border}`,borderRadius:5,background:T.tableAlt}}>{tablePage}</span>
                      <button onClick={()=>setTablePage(p=>p+1)} disabled={tableRows.length<50} style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:5,padding:"3px 8px",fontSize:12,cursor:"pointer",color:T.textMuted}}>›</button>
                    </div>
                  </div>}/>
                {tLoad?<div style={{padding:24,textAlign:"center",color:T.textMuted}}>Loading...</div>:<DataTable columns={tableCols} rows={tableRows} emptyMsg="No bookings — adjust filters and click Apply" T={T}/>}
              </Card>
            </div>
          )}

          {/* ══ AI ═══════════════════════════════════════════════════════════════ */}
          {tab==="ai"&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 270px",gap:14,height:"calc(100vh - 160px)"}}>
              <Card T={T} style={{display:"flex",flexDirection:"column",overflow:"hidden"}}>
                <CardHdr title="TTP AI Assistant" T={T} right={<div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:7,height:7,borderRadius:"50%",background:T.success}}/><span style={{fontSize:11,color:T.textMuted}}>OpenAI · Live data</span></div>}/>
                <div ref={chatRef} style={{flex:1,overflowY:"auto",padding:"14px 18px",display:"flex",flexDirection:"column",gap:10}}>
                  {msgs.map((m,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                      <div style={{maxWidth:"76%",background:m.role==="user"?T.accent:T.tableAlt,color:m.role==="user"?"#fff":T.text,borderRadius:m.role==="user"?"14px 14px 2px 14px":"14px 14px 14px 2px",padding:"9px 13px",fontSize:13,lineHeight:1.6,boxShadow:T.shadow}}>{m.text}</div>
                    </div>
                  ))}
                  {aiLoad&&<div style={{display:"flex",gap:3,padding:"6px 0"}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:T.textDim,animation:`bounce 1s ${i*0.2}s infinite`}}/>)}</div>}
                </div>
                <div style={{padding:"10px 14px",borderTop:`1px solid ${T.border}`,display:"flex",gap:7}}>
                  <input value={aiInput} onChange={e=>setAiInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendAI(aiInput)}
                    placeholder="Ask about bookings, revenue, PAX..." style={{...inputStyle,flex:1}}/>
                  <Btn onClick={()=>sendAI(aiInput)} disabled={aiLoad||!aiInput.trim()} T={T} style={{flexShrink:0}}>{Ic.send} Send</Btn>
                </div>
              </Card>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <Card T={T} style={{padding:14}}>
                  <div style={{fontSize:11,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10}}>Quick Questions</div>
                  {["What is total revenue for 2026?","Compare Solmar vs Snowtravel bookings","Which month had the most PAX?","How many cancellations in 2025?","Revenue breakdown by dataset","Year-on-year growth rate?","Average revenue per booking?"].map((q,i)=>(
                    <button key={i} onClick={()=>sendAI(q)} style={{display:"block",width:"100%",textAlign:"left",background:"transparent",border:`1px solid ${T.border}`,borderRadius:7,padding:"7px 10px",fontSize:12,color:T.text,cursor:"pointer",marginBottom:5,lineHeight:1.4}}
                      onMouseEnter={e=>{e.target.style.background=T.accentLight;e.target.style.borderColor=T.accent;e.target.style.color=T.accent;}}
                      onMouseLeave={e=>{e.target.style.background="transparent";e.target.style.borderColor=T.border;e.target.style.color=T.text;}}>{q}</button>
                  ))}
                </Card>
                <Card T={T} style={{padding:14}}>
                  <div style={{fontSize:11,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10}}>Data Sources</div>
                  {[["Snowtravel","#3b82f6"],["Solmar","#22c55e"],["Interbus","#f59e0b"],["Solmar DE","#ef4444"]].map(([ds,c])=>(
                    <div key={ds} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:`1px solid ${T.border}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:7,height:7,borderRadius:"50%",background:c}}/><span style={{fontSize:13,color:T.text}}>{ds}</span></div>
                      <Badge color="success" T={T}>Live</Badge>
                    </div>
                  ))}
                </Card>
              </div>
            </div>
          )}

          {/* ══ HOTEL INSIGHTS ══════════════════════════════════════════════ */}
          {tab==="hotel"&&<HotelTab token={token} T={T} API={API}/>}

          {/* ══ SETTINGS ══════════════════════════════════════════════════════ */}
          {tab==="settings"&&isAdmin&&(
            <div>
              <div style={{display:"flex",gap:0,borderBottom:`1px solid ${T.border}`,marginBottom:18}}>
                {[["users","User Management"],["theme","Theme"],["api","API & Integrations"],["alerts","Email Alerts"]].map(([k,l])=>(
                  <button key={k} onClick={()=>setStTab(k)} style={{background:"transparent",border:"none",borderBottom:`2px solid ${stTab===k?T.accent:"transparent"}`,color:stTab===k?T.accent:T.textMuted,padding:"9px 16px",fontSize:13,fontWeight:stTab===k?600:400,cursor:"pointer"}}>{l}</button>
                ))}
              </div>

              {stTab==="users"&&(
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <span style={{fontSize:15,fontWeight:700,color:T.text}}>User Accounts ({users.length}){usersLoad&&<span style={{fontSize:12,color:T.textMuted,fontWeight:400,marginLeft:8}}>Loading...</span>}</span>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      {usersError&&<span style={{fontSize:12,color:T.danger}}>{usersError}</span>}
                      <Btn size="sm" variant="ghost" onClick={loadUsers} T={T}>{Ic.refresh} Refresh</Btn>
                      <Btn onClick={()=>setShowAddUser(true)} T={T}>{Ic.plus} Add New User</Btn>
                    </div>
                  </div>
                  <Card T={T}>
                    <DataTable T={T} maxHeight={600} columns={[
                      {label:"NAME",key:"name",bold:true},{label:"USERNAME",key:"username",color:(_,T)=>T.textMuted,noWrap:true},
                      {label:"EMAIL",key:"email",color:(_,T)=>T.textMuted},
                      {label:"ROLE",key:"role",render:r=><Badge color={r.role==="admin"?"accent":"muted"} T={T}>{r.role==="admin"?"Admin":"Viewer"}</Badge>},
                      {label:"STATUS",key:"s",render:()=><Badge color="success" T={T}>Active</Badge>},
                      {label:"ACTIONS",key:"a",render:r=>(
                        <div style={{display:"flex",gap:5}}>
                          <Btn size="sm" variant="ghost" onClick={()=>setEditUser({...r})} T={T}>{Ic.edit} Edit</Btn>
                          <Btn size="sm" variant="danger" onClick={async()=>{
                            if(!window.confirm(`Delete ${r.name}? This cannot be undone.`)) return;
                            try{
                              const t=localStorage.getItem("ttp_token");
                              const res=await fetch(`${BASE}/api/auth/users/${r.id}`,{method:"DELETE",headers:{"Authorization":`Bearer ${t}`}});
                              if(res.ok) setUsers(p=>p.filter(x=>x.id!==r.id));
                              else { const d=await res.json(); alert(d.error||"Failed to delete"); }
                            }catch{alert("Connection error");}
                          }} T={T}>{Ic.trash} Delete</Btn>
                        </div>
                      )},
                    ]} rows={users}/>
                  </Card>
                </div>
              )}

              {stTab==="theme"&&(
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:14}}>Theme Selection</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,maxWidth:520}}>
                    {[["light","Light Gray","#f4f5f7","#ffffff","#1d4ed8"],["dark","Dark (Corporate Blue)","#0f1115","#1a1d23","#3b82f6"]].map(([k,l,bg,card,acc])=>(
                      <div key={k} onClick={()=>switchTheme(k)} style={{border:`2px solid ${themeKey===k?T.accent:T.border}`,borderRadius:12,padding:18,cursor:"pointer",background:T.card,boxShadow:themeKey===k?`0 0 0 3px ${T.accent}33`:T.cardShadow,transition:"all 0.2s"}}>
                        <div style={{background:bg,borderRadius:8,padding:12,marginBottom:12,border:`1px solid ${T.border}`}}>
                          <div style={{background:card,borderRadius:6,padding:8,marginBottom:5,display:"flex",gap:5}}>
                            {[acc,"#f59e0b","#22c55e"].map((c,i)=><div key={i} style={{flex:1,background:c,borderRadius:3,height:14,opacity:0.8}}/>)}
                          </div>
                          <div style={{background:card,borderRadius:3,height:5,opacity:0.6}}/><div style={{background:card,borderRadius:3,height:3,marginTop:3,opacity:0.4,width:"70%"}}/>
                        </div>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                          <span style={{fontSize:13,fontWeight:600,color:T.text}}>{l}</span>
                          {themeKey===k&&<span style={{color:T.accent,fontSize:12,fontWeight:700}}>✓ Active</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stTab==="api"&&(
                <div style={{maxWidth:500}}>
                  <div style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:14}}>API Configuration</div>
                  {[["OpenAI API Key","openai","sk-proj-...","Powers TTP AI assistant"],["Anthropic API Key","anthropic","sk-ant-...","Alternative AI provider"],].map(([l,k,ph,desc])=>(
                    <Card key={k} T={T} style={{padding:"15px 16px",marginBottom:10}}>
                      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:10}}>
                        <span style={{color:T.accent}}>{Ic.key}</span>
                        <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:T.text}}>{l}</div><div style={{fontSize:11,color:T.textMuted}}>{desc}</div></div>
                        <Badge color={apiKeys[k]?"success":"muted"} T={T}>{apiKeys[k]?"Connected":"Not set"}</Badge>
                      </div>
                      <div style={{display:"flex",gap:7}}>
                        <input type="password" value={apiKeys[k]||""} onChange={e=>setApiKeys(a=>({...a,[k]:e.target.value}))} placeholder={ph} style={{...inputStyle,flex:1}}/>
                        <Btn size="sm" onClick={()=>alert("Update backend .env to apply in production.")} T={T}>Save</Btn>
                      </div>
                    </Card>
                  ))}
                  <Card T={T} style={{padding:"15px 16px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:10}}>
                      <span style={{color:T.accent}}>{Ic.database}</span>
                      <div><div style={{fontSize:13,fontWeight:600,color:T.text}}>Azure SQL Database</div><div style={{fontSize:11,color:T.textMuted}}>ttpserver.database.windows.net / TTPDatabase</div></div>
                      <Badge color="success" T={T}>Connected</Badge>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:12}}>
                      {[["Snowtravel",6720],["Solmar",10345],["Interbus",2824],["Solmar DE",64]].map(([ds,cnt])=>(
                        <div key={ds} style={{display:"flex",justifyContent:"space-between",padding:"5px 8px",background:T.tableAlt,borderRadius:6,border:`1px solid ${T.border}`}}>
                          <span style={{color:T.textMuted}}>{ds}</span><span style={{fontWeight:700,color:T.accent}}>{fmtN(cnt)}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}

              {stTab==="alerts"&&(
                <div style={{maxWidth:460}}>
                  <div style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:14}}>Email Alerts</div>
                  <Card T={T} style={{padding:"16px 18px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:14}}>
                      <span style={{color:T.accent}}>{Ic.bell}</span>
                      <div><div style={{fontSize:13,fontWeight:600,color:T.text}}>Notification Email</div><div style={{fontSize:11,color:T.textMuted}}>Receive daily summary and error alerts</div></div>
                    </div>
                    <div style={{marginBottom:12}}><label style={labelStyle}>Email Address</label>
                      <input type="email" value={apiKeys.emailAlert||""} onChange={e=>setApiKeys(a=>({...a,emailAlert:e.target.value}))} placeholder="e.g. datateamttpservices@gmail.com" style={inputStyle}/>
                    </div>
                    <Btn onClick={()=>alert("Email alert saved. Configure SMTP in backend to activate.")} T={T}>Save Email</Btn>
                    <div style={{marginTop:14,padding:"10px 12px",background:T.tableAlt,borderRadius:8,fontSize:12,color:T.textMuted,border:`1px solid ${T.border}`}}>
                      <div style={{fontWeight:600,color:T.text,marginBottom:4}}>Auto-refresh: Daily at 00:00 Dubai time</div>
                      <div>Dashboard data refreshes automatically every night. Email alerts require SMTP configuration in backend.</div>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          )}
        </div>

        {/* STATUS BAR */}
        <div style={{background:T.headerBg,borderTop:`1px solid ${T.border}`,padding:"4px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11,flexShrink:0}}>
          <div style={{display:"flex",gap:14,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{color:T.textDim}}>Last sync: <span style={{color:T.accent,fontWeight:600}}>{lastSync||"—"}</span> Dubai</span>
            {[["Solmar",kpis?.currentBookings!=null?"Live":"—"],["Snowtravel","Live"],["Interbus","Live"],["Solmar DE","Live"]].map(([k,v])=>(
              <span key={k} style={{color:T.textDim}}><span style={{color:T.textMuted,fontWeight:600}}>{k}</span>: <span style={{color:T.success}}>{v}</span></span>
            ))}
          </div>
          <span style={{color:T.textDim}}>Auto-refresh 00:00 Dubai · TTP Analytics v2.1 · <span style={{color:T.success}}>●</span> Live</span>
        </div>
      </main>

      {/* EXPORT MODAL */}
      {showExportModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowExportModal(false)}>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:28,width:460,boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
              <span style={{fontSize:16,fontWeight:700,color:T.text}}>Export Data</span>
              <button onClick={()=>setShowExportModal(false)} style={{background:"transparent",border:"none",cursor:"pointer",color:T.textMuted}}>{Ic.close}</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
              {[["Booking From","bkFrom"],["Booking To","bkTo"],["Departure From","depFrom"],["Departure To","depTo"]].map(([l,k])=>(
                <div key={k}><label style={labelStyle}>{l}</label>
                  <input type="date" value={exportOpts[k]||""} onChange={e=>setExportOpts(o=>({...o,[k]:e.target.value}))}
                    style={{...inputStyle,colorScheme:themeKey==="dark"?"dark":"light"}}/>
                </div>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
              <div><label style={labelStyle}>Dataset</label>
                <select value={exportOpts.dataset||""} onChange={e=>setExportOpts(o=>({...o,dataset:e.target.value}))} style={inputStyle}>
                  <option value="">All Datasets</option>
                  {["Snowtravel","Solmar","Interbus","Solmar DE"].map(d=><option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>Status</label>
                <select value={exportOpts.status||""} onChange={e=>setExportOpts(o=>({...o,status:e.target.value}))} style={inputStyle}>
                  <option value="">All Status</option>
                  <option value="ok">OK only</option>
                  <option value="cancelled">Cancelled only</option>
                </select>
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>doExport("csv")} style={{flex:1,background:T.success,color:"#fff",border:"none",borderRadius:8,padding:"10px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>{Ic.download} CSV</button>
              <button onClick={()=>doExport("excel")} style={{flex:1,background:"#0e7490",color:"#fff",border:"none",borderRadius:8,padding:"10px",fontSize:13,fontWeight:700,cursor:"pointer"}}>📊 Excel</button>
              <button onClick={()=>doExport("print")} style={{flex:1,background:T.accent,color:"#fff",border:"none",borderRadius:8,padding:"10px",fontSize:13,fontWeight:600,cursor:"pointer"}}>Print</button>
              <button onClick={()=>doExport("pdf")} style={{flex:1,background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,padding:"10px",fontSize:13,fontWeight:600,cursor:"pointer",color:T.textMuted}}>📄 Save PDF</button>
            </div>
          </div>
        </div>
      )}


      {/* EXPORT MODAL */}
      {showExportModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowExportModal(false)}>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:28,width:460,boxShadow:"0 20px 60px rgba(0,0,0,0.3)",maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
              <span style={{fontSize:16,fontWeight:700,color:T.text}}>Export Data</span>
              <button onClick={()=>setShowExportModal(false)} style={{background:"transparent",border:"none",cursor:"pointer",color:T.textMuted}}>{Ic.close}</button>
            </div>
            {/* Dataset */}
            <div style={{marginBottom:14}}>
              <label style={{fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em",display:"block"}}>Dataset</label>
              <div style={{display:"flex",flexDirection:"column",gap:4,background:T.inputBg,border:`1px solid ${T.inputBorder}`,borderRadius:8,padding:"10px 12px"}}>
                {["Snowtravel","Solmar","Interbus","Solmar DE"].map(d=>{
                  const sel=(exportOpts.datasets||[]).includes(d);
                  return <label key={d} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:T.text,cursor:"pointer"}}>
                    <input type="checkbox" checked={sel} onChange={e=>setExportOpts(o=>({...o,datasets:e.target.checked?[...o.datasets,d]:o.datasets.filter(x=>x!==d)}))} style={{accentColor:T.accent}}/>
                    <span style={{color:DS_COLORS[d]||T.text,fontWeight:sel?600:400}}>{d}</span>
                  </label>;
                })}
                <div style={{marginTop:4,fontSize:11,color:T.textDim}}>{(exportOpts.datasets||[]).length===0?"All datasets selected":exportOpts.datasets.join(", ")}</div>
              </div>
            </div>
            {/* Status */}
            <div style={{marginBottom:14}}>
              <label style={{fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em",display:"block"}}>Status</label>
              <div style={{display:"flex",gap:6}}>
                {[["","All"],["ok","OK only"],["cancelled","Cancelled only"]].map(([v,l])=>{
                  const active=exportOpts.status===v;
                  const col=v==="ok"?T.success:v==="cancelled"?T.danger:T.textMuted;
                  return <button key={v} onClick={()=>setExportOpts(o=>({...o,status:v}))} style={{flex:1,background:active?`${col}22`:"transparent",border:`1px solid ${active?col:T.border}`,borderRadius:7,color:active?col:T.textMuted,padding:"7px 6px",fontSize:12,fontWeight:active?700:400,cursor:"pointer"}}>{l}</button>;
                })}
              </div>
            </div>
            {/* Date ranges */}
            {[["Departure Date","depFrom","depTo"],["Booking Date","bkFrom","bkTo"]].map(([label,fromK,toK])=>(
              <div key={label} style={{marginBottom:14}}>
                <label style={{fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em",display:"block"}}>{label}</label>
                <div style={{display:"flex",gap:8}}>
                  <div style={{flex:1}}>
                    <input type="date" value={exportOpts[fromK]||""} onChange={e=>setExportOpts(o=>({...o,[fromK]:e.target.value}))}
                      placeholder="From" style={{width:"100%",boxSizing:"border-box",background:T.inputBg,border:`1px solid ${T.inputBorder}`,borderRadius:7,padding:"8px 10px",fontSize:13,color:T.text,outline:"none",colorScheme:themeKey==="dark"?"dark":"light"}}/>
                  </div>
                  <div style={{flex:1}}>
                    <input type="date" value={exportOpts[toK]||""} onChange={e=>setExportOpts(o=>({...o,[toK]:e.target.value}))}
                      placeholder="To" style={{width:"100%",boxSizing:"border-box",background:T.inputBg,border:`1px solid ${T.inputBorder}`,borderRadius:7,padding:"8px 10px",fontSize:13,color:T.text,outline:"none",colorScheme:themeKey==="dark"?"dark":"light"}}/>
                  </div>
                </div>
              </div>
            ))}
            {/* Export buttons */}
            <div style={{display:"flex",gap:8,marginTop:8,paddingTop:16,borderTop:`1px solid ${T.border}`}}>
              <button onClick={doExportCSV} style={{flex:1,background:T.success,color:"#fff",border:"none",borderRadius:8,padding:"10px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                {Ic.download} Download CSV
              </button>
              <button onClick={()=>{setShowExportModal(false);setTimeout(()=>window.print(),100);}} style={{flex:1,background:T.accent,color:"#fff",border:"none",borderRadius:8,padding:"10px",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                Print
              </button>
              <button onClick={async()=>{
                setShowExportModal(false);
                try{
                  const h2c=(await import('html2canvas')).default;
                  const el=document.getElementById('dashboard-content');
                  if(!el)return;
                  const canvas=await h2c(el,{scale:1.5,useCORS:true,backgroundColor:T.bg});
                  const link=document.createElement('a');
                  link.download=`ttp-${new Date().toISOString().split('T')[0]}.jpg`;
                  link.href=canvas.toDataURL('image/jpeg',0.9);link.click();
                }catch(e){alert('Export error: '+e.message);}
              }} style={{flex:1,background:T.warning,color:"#fff",border:"none",borderRadius:8,padding:"10px",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                Save JPG
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ADD USER MODAL */}
      {showAddUser&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowAddUser(false)}>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:26,width:380,boxShadow:"0 20px 60px rgba(0,0,0,0.25)"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:18}}>Add New User</div>
            {[["Full Name","name","text"],["Username","username","text"],["Email","email","email"],["Password","password","password"]].map(([l,k,t])=>(
              <div key={k} style={{marginBottom:11}}><label style={labelStyle}>{l}</label><input type={t} value={newUser[k]||""} onChange={e=>setNewUser(u=>({...u,[k]:e.target.value}))} style={inputStyle}/></div>
            ))}
            <div style={{marginBottom:16}}><label style={labelStyle}>Role</label>
              <select value={newUser.role} onChange={e=>setNewUser(u=>({...u,role:e.target.value}))} style={inputStyle}>
                <option value="viewer">Viewer — can view dashboards only</option>
                <option value="admin">Admin — can access Settings</option>
              </select>
            </div>
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={async()=>{
                if(!newUser.name||!newUser.username||!newUser.password)return;
                try{
                  const t=localStorage.getItem("ttp_token");
                  const r=await fetch(`${BASE}/api/auth/users`,{method:"POST",headers:{"Authorization":`Bearer ${t}`,"Content-Type":"application/json"},body:JSON.stringify(newUser)});
                  const d=await r.json();
                  if(r.ok){setUsers(p=>[...p,d]);setNewUser({name:"",username:"",email:"",password:"",role:"viewer"});setShowAddUser(false);}
                  else alert(d.error||"Failed to add user");
                }catch{alert("Connection error");}
              }} T={T} style={{flex:1,justifyContent:"center"}}>Add User</Btn>
              <Btn variant="ghost" onClick={()=>setShowAddUser(false)} T={T} style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editUser&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setEditUser(null)}>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:26,width:380,boxShadow:"0 20px 60px rgba(0,0,0,0.25)"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:18}}>Edit User — {editUser.name}</div>
            {[["Full Name","name","text"],["Email","email","email"]].map(([l,k,t])=>(
              <div key={k} style={{marginBottom:11}}><label style={labelStyle}>{l}</label><input type={t} value={editUser[k]||""} onChange={e=>setEditUser(u=>({...u,[k]:e.target.value}))} style={inputStyle}/></div>
            ))}
            <div style={{marginBottom:16}}><label style={labelStyle}>Role</label>
              <select value={editUser.role} onChange={e=>setEditUser(u=>({...u,role:e.target.value}))} style={inputStyle}>
                <option value="viewer">Viewer</option><option value="admin">Admin</option>
              </select>
            </div>
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={async()=>{
                try{
                  const t=localStorage.getItem("ttp_token");
                  const r=await fetch(`${BASE}/api/auth/users/${editUser.id}`,{method:"PUT",headers:{"Authorization":`Bearer ${t}`,"Content-Type":"application/json"},body:JSON.stringify(editUser)});
                  const d=await r.json();
                  if(r.ok){setUsers(p=>p.map(u=>u.id===editUser.id?d:u));setEditUser(null);}
                  else alert(d.error||"Failed to update user");
                }catch{alert("Connection error");}
              }} T={T} style={{flex:1,justifyContent:"center"}}>Save Changes</Btn>
              <Btn variant="ghost" onClick={()=>setEditUser(null)} T={T} style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print{
          aside,header,.no-print{display:none!important;}
          main{margin-left:0!important;}
          #dashboard-content{padding:0!important;}
          body{background:white!important;}
          .card{break-inside:avoid;}
        }
        @media (max-width:768px){
          aside{width:100%!important;height:52px!important;position:fixed!important;top:0!important;left:0!important;z-index:200!important;flex-direction:row!important;align-items:center!important;padding:0!important;overflow:hidden!important;border-right:none!important;border-bottom:1px solid #e2e8f0!important;}
          aside nav{display:flex!important;flex-direction:row!important;flex:1!important;padding:0 6px!important;overflow-x:auto!important;gap:2px!important;scrollbar-width:none!important;}
          aside nav::-webkit-scrollbar{display:none!important;}
          aside nav button{flex-shrink:0!important;padding:6px 10px!important;font-size:11px!important;}
          aside > div:last-child{display:none!important;}
          aside > div:first-child{width:48px!important;flex-shrink:0!important;border-right:1px solid #e2e8f0!important;}
          main{margin-left:0!important;margin-top:52px!important;}
          .kpi-grid{grid-template-columns:1fr 1fr!important;}
          .chart-grid{grid-template-columns:1fr!important;}
          header{height:44px!important;padding:0 10px!important;}
          #dashboard-content{padding:10px!important;overflow-x:hidden!important;}
          .kpi-value{font-size:22px!important;}
          .hide-mobile{display:none!important;}
          .table-scroll{-webkit-overflow-scrolling:touch!important;max-width:calc(100vw - 20px)!important;}
        }
        @media (max-width:480px){
          .kpi-grid{grid-template-columns:1fr!important;}
          header .header-btns > *:not(:last-child):not(:nth-last-child(2)){display:none!important;}
        }
        @keyframes bounce{0%,80%,100%{transform:scale(0.4);opacity:0.4}40%{transform:scale(1);opacity:1}}
        ::-webkit-scrollbar{width:6px;height:10px}
        ::-webkit-scrollbar-track{background:${T.border};border-radius:10px}
        ::-webkit-scrollbar-thumb{background:${T.accent};border-radius:10px;border:2px solid ${T.border}}
        ::-webkit-scrollbar-thumb:hover{background:${T.accentHover}}
        ::-webkit-scrollbar-corner{background:transparent}
        /* No page-level horizontal scroll */
        body,html{overflow-x:hidden}
        /* Always show horizontal scrollbar */
        .force-scroll{overflow-x:auto!important;-webkit-overflow-scrolling:touch}
        .force-scroll::-webkit-scrollbar{height:8px!important;display:block!important}
        .force-scroll::-webkit-scrollbar-track{background:${T.tableAlt};border-radius:4px}
        .force-scroll::-webkit-scrollbar-thumb{background:${T.accent};border-radius:4px;min-width:40px}
        /* Table scroll - allow both directions */
        .table-scroll{overflow-x:auto;overflow-y:auto;-webkit-overflow-scrolling:touch}
        .table-scroll::-webkit-scrollbar{height:8px;width:6px}
        .table-scroll::-webkit-scrollbar-track{background:${T.tableAlt};border-radius:0 0 8px 8px}
        .table-scroll::-webkit-scrollbar-thumb{background:${T.accent};border-radius:6px;border:3px solid ${T.tableAlt}}
        .table-scroll::-webkit-scrollbar-thumb:hover{background:${T.accentHover}}
        input[type="date"]::-webkit-calendar-picker-indicator{opacity:0.5;cursor:pointer;filter:${themeKey==="dark"?"invert(1)":"none"}}
        select option{background:${T.card};color:${T.text}}
      `}</style>
    </div>
  );
}
