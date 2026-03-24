import { useState, useEffect, useRef, useCallback } from "react";
import Login from "./components/Login.jsx";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg: "#f4f5f7",
  sidebar: "#ffffff",
  card: "#ffffff",
  cardHover: "#f8f9fb",
  border: "#e5e7eb",
  borderMid: "#d1d5db",
  accent: "#1d4ed8",
  accentLight: "#eff6ff",
  accentHover: "#1e40af",
  text: "#111827",
  textMuted: "#6b7280",
  textDim: "#9ca3af",
  success: "#16a34a",
  successBg: "#f0fdf4",
  danger: "#dc2626",
  dangerBg: "#fef2f2",
  warning: "#d97706",
  warningBg: "#fffbeb",
  headerBg: "#ffffff",
  tableAlt: "#f9fafb",
  tableHover: "#eff6ff",
  shadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  shadowMd: "0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04)",
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const YEAR_COLORS = ["#8b5cf6","#f59e0b","#10b981","#3b82f6"];
const DS_COLORS = { Solmar:"#10b981", Interbus:"#f59e0b", Snowtravel:"#3b82f6", "Solmar DE":"#ef4444" };
const BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://localhost:3001";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const dubaiTime = () => new Date().toLocaleTimeString("en-GB",{timeZone:"Asia/Dubai",hour:"2-digit",minute:"2-digit"});
const fmtEur = (n) => { if (n==null) return "—"; const v=Number(n); if(Math.abs(v)>=1e6) return "€"+(v/1e6).toFixed(2)+"M"; if(Math.abs(v)>=1e3) return "€"+(v/1e3).toFixed(0)+"K"; return "€"+v.toLocaleString("nl-BE"); };
const fmtN = (n) => { if (n==null) return "—"; return Number(n).toLocaleString("nl-BE"); };
const diffClr = (v) => v>0 ? C.success : v<0 ? C.danger : C.textMuted;
const diffBg  = (v) => v>0 ? C.successBg : v<0 ? C.dangerBg : "transparent";

async function apiFetch(path, params={}) {
  const t = localStorage.getItem("ttp_token");
  const qs = Object.entries(params).filter(([,v])=>v!=null&&v!=="")
    .flatMap(([k,v])=>Array.isArray(v)?v.map(x=>`${k}=${encodeURIComponent(x)}`):[[`${k}=${encodeURIComponent(v)}`]])
    .join("&");
  const r = await fetch(`${BASE}${path}${qs?"?"+qs:""}`,{headers:{"Authorization":`Bearer ${t}`}});
  if (r.status===401) throw Object.assign(new Error("Unauthorized"),{status:401});
  return r.json();
}

// ─── SVG ICONS ────────────────────────────────────────────────────────────────
const Icon = {
  chart: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
  bus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  table: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/></svg>,
  ai: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  settings: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  logout: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  refresh: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.04-5.44"/></svg>,
  filter: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  download: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  send: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  user: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  plus: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  edit: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  chevronDown: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>,
  close: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  dot: <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>,
  key: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
  database: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
  arrowUp: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>,
  arrowDown: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>,
  search: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
};

// ─── CANVAS: LINE CHART ───────────────────────────────────────────────────────
function LineChart({ data }) {
  const ref = useRef(null);
  const ptsRef = useRef([]);
  const [tip, setTip] = useState(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const dpr = window.devicePixelRatio||1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width*dpr; canvas.height = rect.height*dpr;
    const ctx = canvas.getContext("2d"); ctx.scale(dpr,dpr);
    const W=rect.width, H=rect.height, pad={top:28,right:20,bottom:36,left:58};
    ctx.clearRect(0,0,W,H);
    if (!data?.length) return;
    const byYear = {};
    data.forEach(d=>{ if(!byYear[d.year]) byYear[d.year]={}; byYear[d.year][d.month]=d.revenue||0; });
    const years = Object.keys(byYear).sort();
    const maxV = Math.max(...data.map(d=>d.revenue||0),1);
    const scX = m => pad.left+(m-1)*(W-pad.left-pad.right)/11;
    const scY = v => H-pad.bottom-(v/maxV)*(H-pad.top-pad.bottom);
    for(let i=0;i<=4;i++){
      const y=H-pad.bottom-(i/4)*(H-pad.top-pad.bottom);
      ctx.strokeStyle="#e5e7eb"; ctx.lineWidth=0.8; ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(W-pad.right,y); ctx.stroke();
      ctx.setLineDash([]);
      const v=maxV*i/4;
      ctx.fillStyle="#9ca3af"; ctx.font="10px 'Segoe UI',sans-serif"; ctx.textAlign="right";
      ctx.fillText(v>=1e6?(v/1e6).toFixed(1)+"M":v>=1e3?(v/1e3).toFixed(0)+"K":Math.round(v),pad.left-4,y+3);
    }
    ctx.fillStyle="#9ca3af"; ctx.font="10px 'Segoe UI',sans-serif"; ctx.textAlign="center";
    [1,2,3,4,5,6,7,8,9,10,11,12].forEach(m=>ctx.fillText(MONTHS[m-1],scX(m),H-pad.bottom+14));
    ptsRef.current=[];
    years.forEach((y,i)=>{
      const color=YEAR_COLORS[i%YEAR_COLORS.length];
      ctx.strokeStyle=color; ctx.lineWidth=2.5; ctx.beginPath();
      let started=false;
      [1,2,3,4,5,6,7,8,9,10,11,12].forEach(m=>{
        const v=byYear[y][m]; if(!v) return;
        const [x,yy]=[scX(m),scY(v)];
        if(!started){ctx.moveTo(x,yy);started=true;}else ctx.lineTo(x,yy);
        ptsRef.current.push({x,y:yy,year:y,month:MONTHS[m-1],value:v,color});
      });
      ctx.stroke();
      ptsRef.current.filter(p=>p.year===y).forEach(p=>{
        ctx.fillStyle="#fff"; ctx.strokeStyle=color; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(p.x,p.y,4,0,Math.PI*2);
        ctx.fill(); ctx.stroke();
      });
    });
    let lx=pad.left;
    years.forEach((y,i)=>{
      ctx.fillStyle=YEAR_COLORS[i%YEAR_COLORS.length]; ctx.fillRect(lx,7,12,3);
      ctx.fillStyle="#6b7280"; ctx.font="10px 'Segoe UI',sans-serif"; ctx.textAlign="left";
      ctx.fillText(y,lx+15,13); lx+=48;
    });
  },[data]);
  const onMove = useCallback(e=>{
    const canvas=ref.current; if(!canvas) return;
    const rect=canvas.getBoundingClientRect();
    const mx=(e.clientX-rect.left)*(canvas.width/rect.width/(window.devicePixelRatio||1));
    const my=(e.clientY-rect.top)*(canvas.height/rect.height/(window.devicePixelRatio||1));
    let nearest=null,minD=28;
    ptsRef.current.forEach(p=>{const d=Math.sqrt((p.x-mx)**2+(p.y-my)**2);if(d<minD){minD=d;nearest=p;}});
    setTip(nearest?{...nearest,cx:e.clientX,cy:e.clientY}:null);
  },[]);
  return (
    <div style={{position:"relative"}}>
      <canvas ref={ref} style={{width:"100%",height:200,display:"block",cursor:"crosshair"}} onMouseMove={onMove} onMouseLeave={()=>setTip(null)}/>
      {tip&&<div style={{position:"fixed",left:tip.cx+14,top:tip.cy-48,background:"#111827",border:`1px solid ${tip.color}`,borderRadius:8,padding:"7px 12px",fontSize:12,color:"#f9fafb",pointerEvents:"none",zIndex:9999,boxShadow:"0 4px 12px rgba(0,0,0,0.2)",whiteSpace:"nowrap"}}>
        <span style={{color:tip.color,fontWeight:700}}>{tip.month} {tip.year}</span><br/>{fmtEur(tip.value)}
      </div>}
    </div>
  );
}

// ─── CANVAS: BAR CHART ────────────────────────────────────────────────────────
function BarChart({ data, metric, onMetric }) {
  const ref = useRef(null);
  const barsRef = useRef([]);
  const [tip, setTip] = useState(null);
  useEffect(()=>{
    const canvas=ref.current; if(!canvas) return;
    const dpr=window.devicePixelRatio||1;
    const rect=canvas.getBoundingClientRect();
    canvas.width=rect.width*dpr; canvas.height=rect.height*dpr;
    const ctx=canvas.getContext("2d"); ctx.scale(dpr,dpr);
    const W=rect.width,H=rect.height,pad={top:28,right:20,bottom:36,left:52};
    ctx.clearRect(0,0,W,H);
    if(!data?.length) return;
    const byYear={};
    data.forEach(d=>{if(!byYear[d.year]) byYear[d.year]={}; byYear[d.year][d.month]=metric==="bookings"?(d.bookings||0):(d.pax||0);});
    const years=Object.keys(byYear).sort();
    const allV=Object.values(byYear).flatMap(y=>Object.values(y));
    const maxV=Math.max(...allV,1);
    const slotW=(W-pad.left-pad.right)/12;
    const bW=Math.max(4,Math.floor(slotW/years.length)-2);
    const sy=v=>H-pad.bottom-(v/maxV)*(H-pad.top-pad.bottom);
    for(let i=0;i<=4;i++){
      const yy=H-pad.bottom-(i/4)*(H-pad.top-pad.bottom);
      ctx.strokeStyle="#e5e7eb"; ctx.lineWidth=0.8; ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.moveTo(pad.left,yy); ctx.lineTo(W-pad.right,yy); ctx.stroke();
      ctx.setLineDash([]);
      const v=maxV*i/4;
      ctx.fillStyle="#9ca3af"; ctx.font="10px 'Segoe UI',sans-serif"; ctx.textAlign="right";
      ctx.fillText(v>=1e3?(v/1e3).toFixed(0)+"K":Math.round(v),pad.left-4,yy+3);
    }
    ctx.fillStyle="#9ca3af"; ctx.font="10px 'Segoe UI',sans-serif"; ctx.textAlign="center";
    [1,2,3,4,5,6,7,8,9,10,11,12].forEach(m=>ctx.fillText(MONTHS[m-1],pad.left+(m-1)*slotW+slotW/2,H-pad.bottom+14));
    barsRef.current=[];
    years.forEach((y,i)=>{
      const color=YEAR_COLORS[i%YEAR_COLORS.length];
      ctx.fillStyle=color+"cc";
      [1,2,3,4,5,6,7,8,9,10,11,12].forEach(m=>{
        const v=byYear[y][m]||0; if(!v) return;
        const x=pad.left+(m-1)*slotW+i*(bW+1)+(slotW-years.length*(bW+1))/2;
        const barH=(v/maxV)*(H-pad.top-pad.bottom);
        ctx.fillRect(x,sy(v),bW,barH);
        barsRef.current.push({x,y:sy(v),width:bW,height:barH,year:y,month:MONTHS[m-1],value:v,color});
      });
    });
    let lx=pad.left;
    years.forEach((y,i)=>{
      ctx.fillStyle=YEAR_COLORS[i%YEAR_COLORS.length]; ctx.fillRect(lx,7,12,8);
      ctx.fillStyle="#6b7280"; ctx.font="10px 'Segoe UI',sans-serif"; ctx.textAlign="left";
      ctx.fillText(y,lx+15,14); lx+=48;
    });
  },[data,metric]);
  const onMove=useCallback(e=>{
    const canvas=ref.current; if(!canvas) return;
    const rect=canvas.getBoundingClientRect();
    const mx=(e.clientX-rect.left)*(canvas.width/rect.width/(window.devicePixelRatio||1));
    const my=(e.clientY-rect.top)*(canvas.height/rect.height/(window.devicePixelRatio||1));
    const bar=barsRef.current.find(b=>mx>=b.x&&mx<=b.x+b.width&&my>=b.y&&my<=b.y+b.height);
    setTip(bar?{...bar,cx:e.clientX,cy:e.clientY}:null);
  },[]);
  return (
    <div style={{position:"relative"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <span style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.07em"}}>BOOKINGS / PAX BY YEAR</span>
        <div style={{display:"flex",gap:4}}>
          {["bookings","pax"].map(m=>(
            <button key={m} onClick={()=>onMetric(m)} style={{background:metric===m?C.accent:"transparent",color:metric===m?"#fff":C.textMuted,border:`1px solid ${metric===m?C.accent:C.border}`,borderRadius:6,padding:"3px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>
              {m==="bookings"?"Bookings":"PAX"}
            </button>
          ))}
        </div>
      </div>
      <canvas ref={ref} style={{width:"100%",height:200,display:"block",cursor:"crosshair"}} onMouseMove={onMove} onMouseLeave={()=>setTip(null)}/>
      {tip&&<div style={{position:"fixed",left:tip.cx+14,top:tip.cy-48,background:"#111827",border:`1px solid ${tip.color}`,borderRadius:8,padding:"7px 12px",fontSize:12,color:"#f9fafb",pointerEvents:"none",zIndex:9999,boxShadow:"0 4px 12px rgba(0,0,0,0.2)",whiteSpace:"nowrap"}}>
        <span style={{color:tip.color,fontWeight:700}}>{tip.month} {tip.year}</span><br/>{fmtN(tip.value)} {metric}
      </div>}
    </div>
  );
}

// ─── CANVAS: BUS BAR CHART ────────────────────────────────────────────────────
function BusBarChart({ data, metric, title }) {
  const ref = useRef(null);
  const barsRef = useRef([]);
  const [tip, setTip] = useState(null);
  useEffect(()=>{
    const canvas=ref.current; if(!canvas) return;
    const dpr=window.devicePixelRatio||1;
    const rect=canvas.getBoundingClientRect();
    canvas.width=rect.width*dpr; canvas.height=rect.height*dpr;
    const ctx=canvas.getContext("2d"); ctx.scale(dpr,dpr);
    const W=rect.width,H=rect.height,pad={top:24,right:16,bottom:40,left:52};
    ctx.clearRect(0,0,W,H);
    if(!data?.length){ctx.fillStyle="#9ca3af";ctx.font="12px sans-serif";ctx.textAlign="center";ctx.fillText("No data",W/2,H/2);return;}
    const classes=[...new Set(data.map(d=>d.bus_class||d.bus_type_name||""))].filter(Boolean);
    const datasets=[...new Set(data.map(d=>d.dataset))].filter(Boolean);
    const maxV=Math.max(...data.map(d=>metric==="revenue"?(d.revenue||0):(d.bookings||0)),1);
    const slotW=(W-pad.left-pad.right)/Math.max(classes.length,1);
    const bW=Math.max(8,Math.floor(slotW/Math.max(datasets.length,1))-4);
    const sy=v=>H-pad.bottom-(v/maxV)*(H-pad.top-pad.bottom);
    for(let i=0;i<=4;i++){
      const yy=H-pad.bottom-(i/4)*(H-pad.top-pad.bottom);
      ctx.strokeStyle="#e5e7eb";ctx.lineWidth=0.8;ctx.setLineDash([3,3]);
      ctx.beginPath();ctx.moveTo(pad.left,yy);ctx.lineTo(W-pad.right,yy);ctx.stroke();ctx.setLineDash([]);
      const v=maxV*i/4;ctx.fillStyle="#9ca3af";ctx.font="10px 'Segoe UI',sans-serif";ctx.textAlign="right";
      ctx.fillText(v>=1e6?(v/1e6).toFixed(1)+"M":v>=1e3?(v/1e3).toFixed(0)+"K":Math.round(v),pad.left-4,yy+3);
    }
    barsRef.current=[];
    classes.forEach((cls,ci)=>{
      const slotX=pad.left+ci*slotW;
      const totalW=datasets.length*(bW+3);
      datasets.forEach((ds,di)=>{
        const row=data.find(d=>(d.bus_class||d.bus_type_name||"")===(cls)&&d.dataset===ds);
        if(!row) return;
        const v=metric==="revenue"?(row.revenue||0):(row.bookings||0);
        if(!v) return;
        const x=slotX+(slotW-totalW)/2+di*(bW+3);
        const barH=(v/maxV)*(H-pad.top-pad.bottom);
        const color=DS_COLORS[ds]||"#6b7280";
        ctx.fillStyle=color;
        ctx.beginPath();
        ctx.roundRect(x,sy(v),bW,barH,2);
        ctx.fill();
        barsRef.current.push({x,y:sy(v),width:bW,height:barH,ds,cls,value:v,metric,color});
      });
      ctx.fillStyle="#6b7280";ctx.font="10px 'Segoe UI',sans-serif";ctx.textAlign="center";
      const label=cls.length>9?cls.slice(0,9)+"..":cls;
      ctx.fillText(label,slotX+slotW/2,H-pad.bottom+13);
    });
    let lx=pad.left;
    datasets.forEach(ds=>{
      const color=DS_COLORS[ds]||"#6b7280";
      ctx.fillStyle=color;ctx.fillRect(lx,8,10,8);
      ctx.fillStyle="#6b7280";ctx.font="10px 'Segoe UI',sans-serif";ctx.textAlign="left";ctx.fillText(ds,lx+13,15);
      lx+=ds.length*5.5+24;
    });
  },[data,metric]);
  const onMove=useCallback(e=>{
    const canvas=ref.current;if(!canvas) return;
    const rect=canvas.getBoundingClientRect();
    const mx=(e.clientX-rect.left)*(canvas.width/rect.width/(window.devicePixelRatio||1));
    const my=(e.clientY-rect.top)*(canvas.height/rect.height/(window.devicePixelRatio||1));
    const bar=barsRef.current.find(b=>mx>=b.x&&mx<=b.x+b.width&&my>=b.y&&my<=b.y+b.height);
    setTip(bar?{...bar,cx:e.clientX,cy:e.clientY}:null);
  },[]);
  return (
    <div style={{position:"relative"}}>
      <canvas ref={ref} style={{width:"100%",height:180,display:"block",cursor:"crosshair"}} onMouseMove={onMove} onMouseLeave={()=>setTip(null)}/>
      {tip&&<div style={{position:"fixed",left:tip.cx+14,top:tip.cy-48,background:"#111827",border:`1px solid ${tip.color}`,borderRadius:8,padding:"7px 12px",fontSize:12,color:"#f9fafb",pointerEvents:"none",zIndex:9999,whiteSpace:"nowrap"}}>
        <span style={{color:tip.color,fontWeight:700}}>{tip.cls} · {tip.ds}</span><br/>{tip.metric==="revenue"?fmtEur(tip.value):fmtN(tip.value)+" bookings"}
      </div>}
    </div>
  );
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
function Card({ children, style={} }) {
  return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,boxShadow:C.shadow,...style}}>{children}</div>;
}
function CardHeader({ title, right }) {
  return <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
    <span style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.07em"}}>{title}</span>
    {right}
  </div>;
}
function Btn({ children, variant="primary", size="md", onClick, disabled, style={} }) {
  const base = {border:"none",borderRadius:8,cursor:disabled?"not-allowed":"pointer",fontWeight:600,display:"inline-flex",alignItems:"center",gap:6,transition:"all 0.15s",...style};
  const sz = size==="sm"?{padding:"5px 12px",fontSize:12}:{padding:"8px 16px",fontSize:13};
  const v = variant==="primary"?{background:C.accent,color:"#fff"}:variant==="ghost"?{background:"transparent",color:C.textMuted,border:`1px solid ${C.border}`}:{background:"transparent",color:C.danger,border:`1px solid ${C.dangerBg}`};
  return <button onClick={onClick} disabled={disabled} style={{...base,...sz,...v}}>{children}</button>;
}
function Badge({ children, color="accent" }) {
  const colors={accent:{bg:C.accentLight,text:C.accent},success:{bg:C.successBg,text:C.success},danger:{bg:C.dangerBg,text:C.danger},muted:{bg:"#f3f4f6",text:C.textMuted}};
  const s=colors[color]||colors.muted;
  return <span style={{background:s.bg,color:s.text,fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:10}}>{children}</span>;
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [token, setToken] = useState(()=>localStorage.getItem("ttp_token")||"");
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("overview");

  // Overview state
  const [kpis, setKpis] = useState(null);
  const [revData, setRevData] = useState([]);
  const [ymData, setYmData] = useState([]);
  const [barMetric, setBarMetric] = useState("bookings");
  const [oLoad, setOLoad] = useState(false);

  // Global filters
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({ depFrom:"", depTo:"", bkFrom:"", bkTo:"", dataset:[], status:[], transport:[] });
  const [applied, setApplied] = useState({});
  const [slicers, setSlicers] = useState({ transportTypes:[], datasets:[] });

  // Bus state
  const [busLabel, setBusLabel] = useState("Solmar");
  const [busView, setBusView] = useState("pendel");
  const [busTrips, setBusTrips] = useState([]);
  const [busClass, setBusClass] = useState([]);
  const [stTrips, setStTrips] = useState([]);
  const [busFiltersOpen, setBusFiltersOpen] = useState(false);
  const [busFilters, setBusFilters] = useState({ dateFrom:"", dateTo:"", pendel:"", region:"", destination:"" });
  const [bLoad, setBLoad] = useState(false);

  // AI state
  const [msgs, setMsgs] = useState([{role:"assistant",text:"Hello! I'm your TTP Analytics AI. Ask me anything about bookings, PAX, revenue, or trends across Snowtravel, Solmar, Interbus and Solmar DE."}]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoad, setAiLoad] = useState(false);
  const chatRef = useRef(null);

  // Data table state
  const [tableData, setTableData] = useState([]);
  const [tableSearch, setTableSearch] = useState("");
  const [tableDS, setTableDS] = useState("");
  const [tableSt, setTableSt] = useState("");
  const [tLoad, setTLoad] = useState(false);

  // Settings state
  const [stTab, setStTab] = useState("users");
  const [users, setUsers] = useState([
    {id:1,name:"Abdul Rahman",username:"abdulrahman",email:"abdrah1264@gmail.com",role:"admin"},
    {id:2,name:"TTP Admin",username:"ttp_admin",email:"admin@ttp-services.com",role:"admin"},
    {id:3,name:"Robbert Jan",username:"robbert",email:"robbert@ttp-services.com",role:"viewer"},
    {id:4,name:"Samir",username:"samir",email:"samir@ttp-services.com",role:"viewer"},
  ]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [newUser, setNewUser] = useState({name:"",username:"",email:"",password:"",role:"viewer"});
  const [apiKeys, setApiKeys] = useState({ openai: "", grip: "", traveltrustit: "" });

  const [clock, setClock] = useState(dubaiTime());
  const [lastSync, setLastSync] = useState("");

  useEffect(()=>{ const iv=setInterval(()=>setClock(dubaiTime()),1000); return()=>clearInterval(iv); },[]);
  useEffect(()=>{ if(!token) return; try{ const p=JSON.parse(atob(token.split(".")[1])); setUser(p.user||p); }catch{} },[token]);

  // Build query params
  const buildP = useCallback((f)=>{
    const p={};
    if(f.depFrom) p.departureDateFrom=f.depFrom;
    if(f.depTo)   p.departureDateTo=f.depTo;
    if(f.bkFrom)  p.bookingDateFrom=f.bkFrom;
    if(f.bkTo)    p.bookingDateTo=f.bkTo;
    if((f.dataset||[]).length)   p.dataset=f.dataset;
    if((f.status||[]).length)    p.status=f.status;
    if((f.transport||[]).length) p.transportType=f.transport;
    return p;
  },[]);

  // Load overview
  const loadOverview = useCallback((f={})=>{
    if(!token) return;
    setOLoad(true);
    const p=buildP(f);
    Promise.all([
      apiFetch("/api/dashboard/kpis",p).catch(()=>null),
      apiFetch("/api/dashboard/revenue-by-year",p).catch(()=>[]),
      apiFetch("/api/dashboard/year-month-comparison",p).catch(()=>[]),
    ]).then(([k,r,ym])=>{
      if(k&&!k.error) setKpis(k);
      if(Array.isArray(r)) setRevData(r);
      if(Array.isArray(ym)) setYmData(ym);
      setLastSync(dubaiTime());
    }).catch(console.error).finally(()=>setOLoad(false));
  },[token,buildP]);

  useEffect(()=>{
    if(!token) return;
    apiFetch("/api/dashboard/slicers",{}).then(d=>{ if(d&&!d.error) setSlicers(d); }).catch(()=>{});
    loadOverview({});
  },[token]);
  useEffect(()=>{ if(token) loadOverview(applied); },[applied]);

  // Load bus data
  const loadBus = useCallback((f={})=>{
    if(!token) return;
    setBLoad(true);
    const p={};
    if(f.dateFrom) p.dateFrom=f.dateFrom;
    if(f.dateTo)   p.dateTo=f.dateTo;
    if(f.pendel)   p.pendel=f.pendel;
    Promise.all([
      apiFetch("/api/dashboard/bustrips",p).catch(()=>[]),
      apiFetch("/api/dashboard/bus-class-summary",{}).catch(()=>[]),
      apiFetch("/api/dashboard/snowtravel-bus",p).catch(()=>[]),
    ]).then(([bt,bc,st])=>{
      const btR=Array.isArray(bt)?bt:(bt?.rows||[]);
      setBusTrips(btR);
      if(Array.isArray(bc)) setBusClass(bc);
      const stR=Array.isArray(st)?st:(st?.rows||[]);
      setStTrips(stR);
    }).finally(()=>setBLoad(false));
  },[token]);

  useEffect(()=>{ if(token) loadBus({}); },[token]);

  // Load table
  const loadTable = useCallback(()=>{
    if(!token) return;
    setTLoad(true);
    const p={};
    if(tableDS) p.dataset=tableDS;
    if(tableSt) p.status=tableSt;
    apiFetch("/api/dashboard/year-month-comparison",p)
      .then(d=>{ if(Array.isArray(d)) setTableData(d); })
      .catch(()=>[]).finally(()=>setTLoad(false));
  },[token,tableDS,tableSt]);

  useEffect(()=>{ if(token&&tab==="table") loadTable(); },[token,tab]);

  const logout = ()=>{ localStorage.removeItem("ttp_token"); setToken(""); setUser(null); };
  const onLogin = (tok,u)=>{ localStorage.setItem("ttp_token",tok); setToken(tok); setUser(u); };

  const exportCSV = ()=>{
    const p=new URLSearchParams();
    p.set("token",localStorage.getItem("ttp_token")||"");
    const af=applied;
    if(af.depFrom) p.set("departureDateFrom",af.depFrom);
    if(af.depTo)   p.set("departureDateTo",af.depTo);
    if((af.dataset||[]).length) af.dataset.forEach(d=>p.append("dataset",d));
    if((af.status||[]).length)  af.status.forEach(s=>p.append("status",s));
    window.open(`${BASE}/api/dashboard/export?${p.toString()}`,"_blank");
  };

  const sendAI = async(msg)=>{
    if(!msg.trim()||aiLoad) return;
    setMsgs(m=>[...m,{role:"user",text:msg}]);
    setAiInput(""); setAiLoad(true);
    try{
      const r=await fetch(`${BASE}/api/ai/chat`,{
        method:"POST",
        headers:{"Authorization":`Bearer ${localStorage.getItem("ttp_token")}`,"Content-Type":"application/json"},
        body:JSON.stringify({message:msg})
      });
      if(r.status===401){logout();return;}
      const d=await r.json();
      setMsgs(m=>[...m,{role:"assistant",text:d.reply||"Sorry, no response."}]);
    }catch{
      setMsgs(m=>[...m,{role:"assistant",text:"Connection error. Please try again."}]);
    }finally{setAiLoad(false);}
  };

  useEffect(()=>{ if(chatRef.current) chatRef.current.scrollTop=chatRef.current.scrollHeight; },[msgs]);

  const QUICK=[
    {l:"This Year",fn:()=>{const y=new Date().getFullYear();setFilters(f=>({...f,depFrom:`${y}-01-01`,depTo:`${y}-12-31`}));}},
    {l:"Last Year",fn:()=>{const y=new Date().getFullYear()-1;setFilters(f=>({...f,depFrom:`${y}-01-01`,depTo:`${y}-12-31`}));}},
    {l:"Last 3M",fn:()=>{const to=new Date(),fr=new Date();fr.setMonth(fr.getMonth()-3);setFilters(f=>({...f,depFrom:fr.toISOString().split("T")[0],depTo:to.toISOString().split("T")[0]}));}},
    {l:"All",fn:()=>setFilters(f=>({...f,depFrom:"",depTo:"",bkFrom:"",bkTo:""}))},
  ];

  const NAV = [
    {id:"overview",label:"Overview",icon:Icon.chart},
    {id:"bus",label:"Bus Occupancy",icon:Icon.bus},
    {id:"table",label:"Data Table",icon:Icon.table},
    {id:"ai",label:"TTP AI",icon:Icon.ai},
    ...(user?.role==="admin"?[{id:"settings",label:"Settings",icon:Icon.settings}]:[]),
  ];

  const isSnow = busLabel==="Snowtravel";
  const busClassFiltered = busClass.filter(d=> isSnow ? d.dataset==="Snowtravel" : d.dataset!=="Snowtravel");

  if (!token) return <Login onLogin={onLogin}/>;

  // ─── LAYOUT ──────────────────────────────────────────────────────────────────
  return (
    <div style={{display:"flex",minHeight:"100vh",background:C.bg,fontFamily:"'Segoe UI',system-ui,sans-serif",color:C.text}}>

      {/* SIDEBAR */}
      <aside style={{width:220,flexShrink:0,background:C.sidebar,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",position:"fixed",top:0,left:0,height:"100vh",zIndex:100}}>
        {/* Brand */}
        <div style={{padding:"20px 18px 16px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,background:C.accent,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <img src="/assets/logo.png" alt="TTP" style={{height:22,objectFit:"contain",filter:"brightness(0) invert(1)"}}
                onError={e=>{e.target.style.display="none";e.target.nextSibling.style.display="flex";}}
              />
              <span style={{display:"none",color:"#fff",fontWeight:800,fontSize:12}}>TTP</span>
            </div>
            <div>
              <div style={{fontSize:13,fontWeight:800,color:C.text,letterSpacing:"0.03em"}}>TTP ANALYTICS</div>
              <div style={{fontSize:10,color:C.textDim,fontWeight:500}}>Data Engine v2.0</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{flex:1,padding:"10px 8px",overflowY:"auto"}}>
          {NAV.map(n=>(
            <button key={n.id} onClick={()=>setTab(n.id)} style={{
              display:"flex",alignItems:"center",gap:10,width:"100%",
              background:tab===n.id?C.accentLight:"transparent",
              color:tab===n.id?C.accent:C.textMuted,
              border:"none",borderRadius:8,padding:"9px 12px",
              fontSize:13,fontWeight:tab===n.id?600:400,cursor:"pointer",
              textAlign:"left",marginBottom:2,transition:"all 0.15s",
            }}
              onMouseEnter={e=>{if(tab!==n.id){e.currentTarget.style.background="#f3f4f6";e.currentTarget.style.color=C.text;}}}
              onMouseLeave={e=>{if(tab!==n.id){e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.textMuted;}}}
            >
              <span style={{opacity:tab===n.id?1:0.7,flexShrink:0}}>{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>

        {/* Bottom: user + clock */}
        <div style={{padding:"12px 14px",borderTop:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <div style={{width:30,height:30,background:C.accentLight,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",color:C.accent,flexShrink:0}}>{Icon.user}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.name||user?.username||"User"}</div>
              <div style={{fontSize:10,color:C.textDim,textTransform:"capitalize"}}>{user?.role||"viewer"}</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <span style={{fontSize:11,color:C.textDim,fontFamily:"monospace"}}>{clock} <span style={{color:C.textMuted}}>DXB</span></span>
          </div>
          <button onClick={logout} style={{display:"flex",alignItems:"center",gap:6,width:"100%",background:"transparent",border:`1px solid ${C.border}`,borderRadius:7,padding:"7px 10px",fontSize:12,color:C.textMuted,cursor:"pointer",fontWeight:500}}>
            {Icon.logout} Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main style={{marginLeft:220,flex:1,display:"flex",flexDirection:"column",minHeight:"100vh"}}>

        {/* Top bar */}
        <header style={{background:C.headerBg,borderBottom:`1px solid ${C.border}`,padding:"0 24px",height:52,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:90,boxShadow:C.shadow}}>
          <div style={{fontSize:15,fontWeight:700,color:C.text}}>
            {NAV.find(n=>n.id===tab)?.label||"Dashboard"}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {lastSync&&<span style={{fontSize:11,color:C.textDim}}>Last sync: <span style={{color:C.textMuted,fontWeight:500}}>{lastSync}</span></span>}
            <button onClick={()=>loadOverview(applied)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 8px",cursor:"pointer",color:C.textMuted,display:"flex",alignItems:"center"}}>{Icon.refresh}</button>
            {tab!=="bus"&&<button onClick={()=>setFiltersOpen(o=>!o)} style={{background:filtersOpen?C.accent:"transparent",color:filtersOpen?"#fff":C.textMuted,border:`1px solid ${filtersOpen?C.accent:C.border}`,borderRadius:7,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
              {Icon.filter} Filters {Object.keys(applied).length>0&&<span style={{background:filtersOpen?"rgba(255,255,255,0.3)":C.accentLight,color:filtersOpen?"#fff":C.accent,fontSize:10,fontWeight:700,padding:"1px 5px",borderRadius:8}}>{Object.keys(applied).filter(k=>applied[k]&&(Array.isArray(applied[k])?applied[k].length:true)).length}</span>}
            </button>}
            <button onClick={exportCSV} style={{background:C.accent,color:"#fff",border:"none",borderRadius:7,padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>{Icon.download} Export</button>
          </div>
        </header>

        {/* Global filter panel */}
        {filtersOpen&&tab!=="bus"&&(
          <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,padding:"14px 24px",boxShadow:"0 2px 4px rgba(0,0,0,0.04)"}}>
            <div style={{display:"flex",gap:6,marginBottom:12,alignItems:"center"}}>
              <span style={{fontSize:11,color:C.textMuted,fontWeight:600}}>Quick:</span>
              {QUICK.map(q=>(
                <button key={q.l} onClick={q.fn} style={{background:"#f3f4f6",border:`1px solid ${C.border}`,borderRadius:16,color:C.textMuted,padding:"3px 12px",fontSize:11,cursor:"pointer",fontWeight:500}}>{q.l}</button>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,alignItems:"end"}}>
              {[["Departure From","depFrom"],["Departure To","depTo"],["Booking From","bkFrom"],["Booking To","bkTo"]].map(([l,k])=>(
                <div key={k}>
                  <div style={{fontSize:11,fontWeight:600,color:C.textMuted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.04em"}}>{l}</div>
                  <input type="date" value={filters[k]||""} onChange={e=>setFilters(f=>({...f,[k]:e.target.value}))}
                    style={{width:"100%",boxSizing:"border-box",background:"#f9fafb",border:`1px solid ${C.border}`,borderRadius:7,padding:"7px 10px",fontSize:13,color:C.text,outline:"none"}}/>
                </div>
              ))}
              <div>
                <div style={{fontSize:11,fontWeight:600,color:C.textMuted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.04em"}}>Dataset</div>
                <select value={(filters.dataset||[])[0]||""} onChange={e=>setFilters(f=>({...f,dataset:e.target.value?[e.target.value]:[]}))}
                  style={{width:"100%",background:"#f9fafb",border:`1px solid ${C.border}`,borderRadius:7,padding:"7px 10px",fontSize:13,color:C.text,outline:"none"}}>
                  <option value="">All</option>
                  {["Snowtravel","Solmar","Interbus","Solmar DE"].map(d=><option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:11,fontWeight:600,color:C.textMuted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.04em"}}>Status</div>
                <div style={{display:"flex",gap:5}}>
                  {[["","All"],["ok","OK"],["cancelled","Cancelled"]].map(([v,l])=>{
                    const active=v===""?(filters.status||[]).length===0:(filters.status||[]).includes(v);
                    const col=v==="ok"?C.success:v==="cancelled"?C.danger:C.textMuted;
                    return <button key={v} onClick={()=>setFilters(f=>({...f,status:v?[v]:[]}))} style={{flex:1,background:active?`${col}18`:"transparent",border:`1px solid ${active?col:C.border}`,borderRadius:6,color:active?col:C.textMuted,padding:"6px 6px",fontSize:11,cursor:"pointer",fontWeight:active?700:400,textAlign:"center"}}>{l}</button>;
                  })}
                </div>
              </div>
              <div style={{display:"flex",gap:8,paddingTop:20}}>
                <Btn onClick={()=>{setApplied({...filters});setFiltersOpen(false);}}>Apply</Btn>
                <Btn variant="ghost" onClick={()=>{setFilters({depFrom:"",depTo:"",bkFrom:"",bkTo:"",dataset:[],status:[],transport:[]});setApplied({});}}>Reset</Btn>
              </div>
            </div>
          </div>
        )}

        {/* PAGE CONTENT */}
        <div style={{flex:1,padding:"20px 24px 40px",overflowY:"auto"}}>

          {/* ══ OVERVIEW ══════════════════════════════════════════════════════ */}
          {tab==="overview"&&(
            <div>
              {oLoad&&<div style={{textAlign:"center",padding:16,color:C.textMuted,fontSize:13}}>Loading data...</div>}

              {/* KPI Cards */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:20}}>
                {[
                  {label:"Total Bookings",curr:kpis?.currentBookings,prev:kpis?.previousBookings,diff:kpis?.differenceBookings,pct:kpis?.percentBookings,fmt:fmtN,color:"#3b82f6"},
                  {label:"Total PAX",curr:kpis?.currentPax,prev:kpis?.previousPax,diff:kpis?.differencePax,pct:kpis?.percentPax,fmt:fmtN,color:"#10b981"},
                  {label:"Gross Revenue",curr:kpis?.currentRevenue,prev:kpis?.previousRevenue,diff:kpis?.differenceRevenue,pct:kpis?.percentRevenue,fmt:fmtEur,color:"#f59e0b"},
                ].map(({label,curr,prev,diff,pct,fmt,color})=>(
                  <Card key={label} style={{padding:"20px 22px"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                      <span style={{fontSize:12,fontWeight:600,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</span>
                      <div style={{width:8,height:8,borderRadius:"50%",background:color}}/>
                    </div>
                    <div style={{fontSize:30,fontWeight:800,color:C.text,marginBottom:6,lineHeight:1}}>{curr!=null?fmt(curr):"—"}</div>
                    <div style={{fontSize:12,color:C.textMuted,marginBottom:10}}>prev year: <span style={{fontWeight:600}}>{prev!=null?fmt(prev):"—"}</span></div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      {diff!=null&&<span style={{display:"flex",alignItems:"center",gap:3,color:diffClr(diff),fontSize:13,fontWeight:700}}>
                        {diff>=0?Icon.arrowUp:Icon.arrowDown}{fmt(Math.abs(diff))}
                      </span>}
                      {pct!=null&&<span style={{background:diffBg(diff),color:diffClr(diff),fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:10,border:`1px solid ${diffClr(diff)}22`}}>
                        {diff>=0?"+":""}{Number(pct).toFixed(1)}%
                      </span>}
                    </div>
                  </Card>
                ))}
              </div>

              {/* Charts */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
                <Card>
                  <CardHeader title="Revenue by Year"/>
                  <div style={{padding:"16px 18px 12px"}}>
                    <LineChart data={revData}/>
                  </div>
                </Card>
                <Card>
                  <div style={{padding:"16px 18px 0"}}>
                    <BarChart data={revData} metric={barMetric} onMetric={setBarMetric}/>
                  </div>
                  <div style={{height:12}}/>
                </Card>
              </div>

              {/* YoY Table */}
              <Card>
                <CardHeader title="Year-Month Comparison" right={<span style={{fontSize:11,color:C.textDim}}>{ymData.length} rows</span>}/>
                <div style={{overflowX:"auto",maxHeight:440,overflowY:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                    <thead>
                      <tr style={{background:C.tableAlt,position:"sticky",top:0,zIndex:1}}>
                        {["PERIOD","LAST YEAR","BOOKINGS","PREV BKG","PAX","PREV PAX","REVENUE","PREV REVENUE","DIFFERENCE","% DIFF"].map((h,i)=>(
                          <th key={h} style={{padding:"10px 14px",textAlign:i<2?"left":"right",fontSize:10,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.05em",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ymData.length===0&&<tr><td colSpan={10} style={{padding:24,textAlign:"center",color:C.textMuted,fontSize:13}}>No data — apply filters or refresh</td></tr>}
                      {ymData.map((row,i)=>{
                        const d=row.diffRevenue||row.difference||0;
                        const p=row.diffPct||row.percentRevenue||0;
                        return (
                          <tr key={i} style={{borderBottom:`1px solid ${C.border}`,background:i%2===0?"#fff":C.tableAlt}}
                            onMouseEnter={e=>e.currentTarget.style.background=C.tableHover}
                            onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"#fff":C.tableAlt}>
                            <td style={{padding:"10px 14px",fontWeight:700,color:C.accent,whiteSpace:"nowrap"}}>{MONTHS[(row.month||1)-1]}-{row.year}</td>
                            <td style={{padding:"10px 14px",color:C.textMuted,whiteSpace:"nowrap"}}>{MONTHS[(row.month||1)-1]}-{(row.year||0)-1}</td>
                            <td style={{padding:"10px 14px",textAlign:"right",fontWeight:600}}>{fmtN(row.currentBookings||row.bookings)}</td>
                            <td style={{padding:"10px 14px",textAlign:"right",color:C.textMuted}}>{fmtN(row.previousBookings||row.prevBookings)}</td>
                            <td style={{padding:"10px 14px",textAlign:"right",fontWeight:600}}>{fmtN(row.currentPax||row.pax)}</td>
                            <td style={{padding:"10px 14px",textAlign:"right",color:C.textMuted}}>{fmtN(row.previousPax||row.prevPax)}</td>
                            <td style={{padding:"10px 14px",textAlign:"right",fontWeight:600}}>{fmtEur(row.currentRevenue||row.revenue)}</td>
                            <td style={{padding:"10px 14px",textAlign:"right",color:C.textMuted}}>{fmtEur(row.previousRevenue||row.prevRevenue)}</td>
                            <td style={{padding:"10px 14px",textAlign:"right",color:diffClr(d),fontWeight:700}}>{d>0?"+":""}{fmtEur(d)}</td>
                            <td style={{padding:"10px 14px",textAlign:"right",color:diffClr(p),fontWeight:700}}>{d>0?"+":""}{Number(p||0).toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ══ BUS OCCUPANCY ═════════════════════════════════════════════════ */}
          {tab==="bus"&&(
            <div style={{position:"relative"}}>
              {/* Top bar: Label + sub-tabs + filter icon */}
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
                {/* Label dropdown */}
                <div style={{position:"relative"}}>
                  <button onClick={()=>setBusLabel(l=>l)} style={{background:C.accent,color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                    {busLabel} {Icon.chevronDown}
                  </button>
                  <select value={busLabel} onChange={e=>{setBusLabel(e.target.value);loadBus(busFilters);}}
                    style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",opacity:0,cursor:"pointer"}}>
                    {["Solmar","Snowtravel","Interbus"].map(l=><option key={l} value={l}>{l}</option>)}
                  </select>
                </div>

                {/* Sub-tabs */}
                <div style={{display:"flex",gap:4,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:3}}>
                  {[["pendel","Pendel overview"],["feeder","Feeder overview"],["deck","Deck choice / class"]].map(([k,l])=>(
                    <button key={k} onClick={()=>setBusView(k)} style={{background:busView===k?C.accent:"transparent",color:busView===k?"#fff":C.textMuted,border:"none",borderRadius:6,padding:"6px 14px",fontSize:12,fontWeight:busView===k?600:400,cursor:"pointer",whiteSpace:"nowrap",transition:"all 0.15s"}}>{l}</button>
                  ))}
                </div>

                {/* Spacer */}
                <div style={{flex:1}}/>

                {/* Filter icon */}
                <button onClick={()=>setBusFiltersOpen(o=>!o)} style={{background:busFiltersOpen?C.accent:"transparent",color:busFiltersOpen?"#fff":C.textMuted,border:`1px solid ${busFiltersOpen?C.accent:C.border}`,borderRadius:7,padding:"7px 12px",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                  {Icon.filter} Filters
                </button>
              </div>

              <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
                {/* Main bus content */}
                <div style={{flex:1,minWidth:0}}>
                  {bLoad&&<div style={{textAlign:"center",padding:20,color:C.textMuted}}>Loading bus data...</div>}

                  {/* Charts */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
                    <Card>
                      <CardHeader title={`Bookings by Bus Class — ${busLabel}`}/>
                      <div style={{padding:"16px 18px"}}>
                        <BusBarChart data={busClassFiltered} metric="bookings" title="Bookings"/>
                      </div>
                    </Card>
                    <Card>
                      <CardHeader title={`Revenue by Bus Class — ${busLabel}`}/>
                      <div style={{padding:"16px 18px"}}>
                        <BusBarChart data={busClassFiltered} metric="revenue" title="Revenue"/>
                      </div>
                    </Card>
                  </div>

                  {/* Bus trips table */}
                  {!isSnow&&busView==="pendel"&&(
                    <Card>
                      <CardHeader title={`Bus Occupancy — ${busLabel} — Outbound vs Return`} right={<span style={{fontSize:11,color:C.textDim}}>{busTrips.length} trips</span>}/>
                      <div style={{overflowX:"auto",maxHeight:480,overflowY:"auto"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead>
                            <tr style={{background:C.tableAlt,position:"sticky",top:0,zIndex:1}}>
                              <th colSpan={2} style={{padding:"9px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:C.textMuted,textTransform:"uppercase",borderBottom:`1px solid ${C.border}`}}>TRIP</th>
                              <th colSpan={4} style={{padding:"9px 14px",textAlign:"center",fontSize:10,fontWeight:700,color:"#1d4ed8",textTransform:"uppercase",borderBottom:`1px solid ${C.border}`,borderLeft:`2px solid ${C.border}`}}>OUTBOUND</th>
                              <th colSpan={4} style={{padding:"9px 14px",textAlign:"center",fontSize:10,fontWeight:700,color:C.success,textTransform:"uppercase",borderBottom:`1px solid ${C.border}`,borderLeft:`2px solid ${C.border}`}}>RETURN</th>
                              <th colSpan={4} style={{padding:"9px 14px",textAlign:"center",fontSize:10,fontWeight:700,color:C.warning,textTransform:"uppercase",borderBottom:`1px solid ${C.border}`,borderLeft:`2px solid ${C.border}`}}>DIFFERENCE</th>
                            </tr>
                            <tr style={{background:C.tableAlt,position:"sticky",top:33,zIndex:1}}>
                              {["START","END","RC","FC","PRE","TOTAL","RC","FC","PRE","TOTAL","RC","FC","PRE","TOTAL"].map((h,i)=>(
                                <th key={i} style={{padding:"6px 10px",textAlign:i<2?"left":"right",fontSize:10,color:C.textDim,fontWeight:700,borderBottom:`1px solid ${C.border}`,...(i===2||i===6||i===10?{borderLeft:`2px solid ${C.border}`}:{})}}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {busTrips.length===0&&<tr><td colSpan={14} style={{padding:24,textAlign:"center",color:C.textMuted,fontSize:13}}>No trips found — adjust filters</td></tr>}
                            {busTrips.map((r,i)=>(
                              <tr key={i} style={{borderBottom:`1px solid ${C.border}`,background:i%2===0?"#fff":C.tableAlt}}
                                onMouseEnter={e=>e.currentTarget.style.background=C.tableHover}
                                onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"#fff":C.tableAlt}>
                                <td style={{padding:"9px 10px",color:C.accent,fontWeight:700,whiteSpace:"nowrap"}}>{r.StartDate}</td>
                                <td style={{padding:"9px 10px",color:C.textMuted,whiteSpace:"nowrap"}}>{r.EndDate}</td>
                                {[r.ORC,r.OFC,r.OPRE,r.OTotal].map((v,j)=>(
                                  <td key={j} style={{padding:"9px 10px",textAlign:"right",fontWeight:j===3?700:400,...(j===0?{borderLeft:`2px solid ${C.border}`}:{})}}>{v||0}</td>
                                ))}
                                {[r.RRC,r.RFC,r.RPRE,r.RTotal].map((v,j)=>(
                                  <td key={j} style={{padding:"9px 10px",textAlign:"right",fontWeight:j===3?700:400,...(j===0?{borderLeft:`2px solid ${C.border}`}:{})}}>{v||0}</td>
                                ))}
                                {[r.RC_Diff,r.FC_Diff,r.PRE_Diff,r.Total_Difference].map((v,j)=>(
                                  <td key={j} style={{padding:"9px 10px",textAlign:"right",fontWeight:700,color:v>0?C.success:v<0?C.danger:C.textMuted,...(j===0?{borderLeft:`2px solid ${C.border}`}:{})}}>{v>0?"+":""}{v||0}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div style={{padding:"8px 16px",borderTop:`1px solid ${C.border}`,fontSize:11,color:C.textDim}}>RC = Royal Class &nbsp;|&nbsp; FC = First Class &nbsp;|&nbsp; PRE = Premium</div>
                    </Card>
                  )}

                  {/* Snowtravel table */}
                  {isSnow&&(
                    <Card>
                      <CardHeader title="Snowtravel Bus Occupancy" right={<span style={{fontSize:11,color:C.textDim}}>{stTrips.length} rows</span>}/>
                      <div style={{overflowX:"auto",maxHeight:480,overflowY:"auto"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead>
                            <tr style={{background:C.tableAlt,position:"sticky",top:0,zIndex:1}}>
                              {["DEPARTURE","RETURN","DREAM CLASS","FIRST CLASS","SLEEP/ROYAL","TOTAL PAX"].map(h=>(
                                <th key={h} style={{padding:"9px 14px",textAlign:h.includes("DATE")||h==="DEPARTURE"||h==="RETURN"?"left":"right",fontSize:10,fontWeight:700,color:C.textMuted,textTransform:"uppercase",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {stTrips.length===0&&<tr><td colSpan={6} style={{padding:24,textAlign:"center",color:C.textMuted}}>No Snowtravel bus data</td></tr>}
                            {stTrips.map((r,i)=>(
                              <tr key={i} style={{borderBottom:`1px solid ${C.border}`,background:i%2===0?"#fff":C.tableAlt}}
                                onMouseEnter={e=>e.currentTarget.style.background=C.tableHover}
                                onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"#fff":C.tableAlt}>
                                <td style={{padding:"9px 14px",color:C.accent,fontWeight:700}}>{r.departure_date}</td>
                                <td style={{padding:"9px 14px",color:C.textMuted}}>{r.return_date}</td>
                                <td style={{padding:"9px 14px",textAlign:"right"}}>{r.dream_class||0}</td>
                                <td style={{padding:"9px 14px",textAlign:"right"}}>{r.first_class||0}</td>
                                <td style={{padding:"9px 14px",textAlign:"right"}}>{r.sleep_royal_class||0}</td>
                                <td style={{padding:"9px 14px",textAlign:"right",fontWeight:700,color:C.accent}}>{r.total_pax||0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}
                </div>

                {/* Bus filter slide-out panel */}
                {busFiltersOpen&&(
                  <div style={{width:260,flexShrink:0,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:18,boxShadow:C.shadowMd,position:"sticky",top:72}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                      <span style={{fontSize:13,fontWeight:700,color:C.text}}>Filters</span>
                      <button onClick={()=>setBusFiltersOpen(false)} style={{background:"transparent",border:"none",cursor:"pointer",color:C.textMuted,display:"flex"}}>{Icon.close}</button>
                    </div>
                    {[["Label","label",["Solmar","Snowtravel","Interbus","Solmar DE"]],["Pendel","pendel",null],["Region","region",null],["Destination","destination",null]].map(([l,k,opts])=>(
                      <div key={k} style={{marginBottom:14}}>
                        <div style={{fontSize:11,fontWeight:600,color:C.textMuted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.04em"}}>{l}</div>
                        {opts?(
                          <select value={busFilters[k]||""} onChange={e=>setBusFilters(f=>({...f,[k]:e.target.value}))}
                            style={{width:"100%",background:"#f9fafb",border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 10px",fontSize:13,color:C.text,outline:"none"}}>
                            <option value="">All</option>
                            {opts.map(o=><option key={o} value={o}>{o}</option>)}
                          </select>
                        ):(
                          <input value={busFilters[k]||""} onChange={e=>setBusFilters(f=>({...f,[k]:e.target.value}))}
                            style={{width:"100%",boxSizing:"border-box",background:"#f9fafb",border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 10px",fontSize:13,color:C.text,outline:"none"}}/>
                        )}
                      </div>
                    ))}
                    <div style={{marginBottom:14}}>
                      <div style={{fontSize:11,fontWeight:600,color:C.textMuted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.04em"}}>Departure Date From</div>
                      <input type="date" value={busFilters.dateFrom||""} onChange={e=>setBusFilters(f=>({...f,dateFrom:e.target.value}))}
                        style={{width:"100%",boxSizing:"border-box",background:"#f9fafb",border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 10px",fontSize:13,color:C.text,outline:"none"}}/>
                    </div>
                    <div style={{marginBottom:18}}>
                      <div style={{fontSize:11,fontWeight:600,color:C.textMuted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.04em"}}>Departure Date To</div>
                      <input type="date" value={busFilters.dateTo||""} onChange={e=>setBusFilters(f=>({...f,dateTo:e.target.value}))}
                        style={{width:"100%",boxSizing:"border-box",background:"#f9fafb",border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 10px",fontSize:13,color:C.text,outline:"none"}}/>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <Btn onClick={()=>loadBus(busFilters)} style={{flex:1,justifyContent:"center"}}>Apply</Btn>
                      <Btn variant="ghost" onClick={()=>{setBusFilters({dateFrom:"",dateTo:"",pendel:"",region:"",destination:""});loadBus({});}} style={{flex:1,justifyContent:"center"}}>Reset</Btn>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ DATA TABLE ════════════════════════════════════════════════════ */}
          {tab==="table"&&(
            <div>
              <Card style={{padding:"14px 18px",marginBottom:16}}>
                <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"flex-end"}}>
                  <div style={{flex:1,minWidth:200}}>
                    <div style={{fontSize:11,fontWeight:600,color:C.textMuted,marginBottom:4,textTransform:"uppercase"}}>Search booking number</div>
                    <div style={{position:"relative"}}>
                      <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:C.textDim}}>{Icon.search}</span>
                      <input value={tableSearch} onChange={e=>setTableSearch(e.target.value)} placeholder="e.g. 202401999..."
                        style={{width:"100%",boxSizing:"border-box",background:"#f9fafb",border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 10px 8px 32px",fontSize:13,color:C.text,outline:"none"}}/>
                    </div>
                  </div>
                  {[["Dataset","tableDS",["Snowtravel","Solmar","Interbus","Solmar DE"]],["Status","tableSt",["ok","cancelled"]]].map(([l,k,opts])=>(
                    <div key={k}>
                      <div style={{fontSize:11,fontWeight:600,color:C.textMuted,marginBottom:4,textTransform:"uppercase"}}>{l}</div>
                      <select value={k==="tableDS"?tableDS:tableSt} onChange={e=>k==="tableDS"?setTableDS(e.target.value):setTableSt(e.target.value)}
                        style={{background:"#f9fafb",border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 10px",fontSize:13,color:C.text,outline:"none",minWidth:130}}>
                        <option value="">All</option>
                        {opts.map(o=><option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                  <Btn onClick={loadTable}>Apply</Btn>
                  <Btn onClick={exportCSV} style={{background:"#f0fdf4",color:C.success,border:`1px solid ${C.successBg}`,fontWeight:700}}>
                    {Icon.download} Download CSV
                  </Btn>
                </div>
              </Card>
              <Card>
                <CardHeader title="Year-Month Summary" right={<Badge color="muted">{tableData.length} rows</Badge>}/>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                    <thead>
                      <tr style={{background:C.tableAlt}}>
                        {["PERIOD","BOOKINGS","PREV BKG","PAX","PREV PAX","REVENUE","PREV REV","DIFF","% DIFF"].map((h,i)=>(
                          <th key={h} style={{padding:"10px 14px",textAlign:i===0?"left":"right",fontSize:10,fontWeight:700,color:C.textMuted,textTransform:"uppercase",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tLoad&&<tr><td colSpan={9} style={{padding:24,textAlign:"center",color:C.textMuted}}>Loading...</td></tr>}
                      {!tLoad&&tableData.filter(r=>{
                        const period=`${MONTHS[(r.month||1)-1]}-${r.year}`.toLowerCase();
                        return !tableSearch||period.includes(tableSearch.toLowerCase());
                      }).map((row,i)=>{
                        const d=row.diffRevenue||row.difference||0;
                        const p=row.diffPct||0;
                        return (
                          <tr key={i} style={{borderBottom:`1px solid ${C.border}`,background:i%2===0?"#fff":C.tableAlt}}
                            onMouseEnter={e=>e.currentTarget.style.background=C.tableHover}
                            onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"#fff":C.tableAlt}>
                            <td style={{padding:"9px 14px",fontWeight:700,color:C.accent}}>{MONTHS[(row.month||1)-1]}-{row.year}</td>
                            <td style={{padding:"9px 14px",textAlign:"right",fontWeight:600}}>{fmtN(row.currentBookings||row.bookings)}</td>
                            <td style={{padding:"9px 14px",textAlign:"right",color:C.textMuted}}>{fmtN(row.previousBookings)}</td>
                            <td style={{padding:"9px 14px",textAlign:"right",fontWeight:600}}>{fmtN(row.currentPax||row.pax)}</td>
                            <td style={{padding:"9px 14px",textAlign:"right",color:C.textMuted}}>{fmtN(row.previousPax)}</td>
                            <td style={{padding:"9px 14px",textAlign:"right",fontWeight:600}}>{fmtEur(row.currentRevenue||row.revenue)}</td>
                            <td style={{padding:"9px 14px",textAlign:"right",color:C.textMuted}}>{fmtEur(row.previousRevenue)}</td>
                            <td style={{padding:"9px 14px",textAlign:"right",color:diffClr(d),fontWeight:700}}>{d>0?"+":""}{fmtEur(d)}</td>
                            <td style={{padding:"9px 14px",textAlign:"right",color:diffClr(p),fontWeight:700}}>{d>0?"+":""}{Number(p||0).toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ══ TTP AI ════════════════════════════════════════════════════════ */}
          {tab==="ai"&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:16,height:"calc(100vh - 160px)"}}>
              <Card style={{display:"flex",flexDirection:"column",overflow:"hidden"}}>
                <CardHeader title="TTP AI Assistant" right={<div style={{display:"flex",alignItems:"center",gap:6}}><span style={{width:7,height:7,borderRadius:"50%",background:C.success,display:"inline-block"}}/>  <span style={{fontSize:11,color:C.textMuted}}>Powered by OpenAI · Live data</span></div>}/>
                <div ref={chatRef} style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:12}}>
                  {msgs.map((m,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                      <div style={{maxWidth:"75%",background:m.role==="user"?C.accent:C.tableAlt,color:m.role==="user"?"#fff":C.text,borderRadius:m.role==="user"?"14px 14px 2px 14px":"14px 14px 14px 2px",padding:"10px 14px",fontSize:13,lineHeight:1.6,boxShadow:C.shadow}}>
                        {m.text}
                      </div>
                    </div>
                  ))}
                  {aiLoad&&(
                    <div style={{display:"flex",gap:4,padding:"8px 0",alignItems:"center"}}>
                      {[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:C.textDim,animation:`bounce 1s ${i*0.2}s infinite`}}/>)}
                    </div>
                  )}
                </div>
                <div style={{padding:"12px 16px",borderTop:`1px solid ${C.border}`,display:"flex",gap:8}}>
                  <input value={aiInput} onChange={e=>setAiInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendAI(aiInput)}
                    placeholder="Ask about bookings, revenue, PAX trends..." style={{flex:1,background:"#f9fafb",border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 14px",fontSize:13,color:C.text,outline:"none"}}/>
                  <Btn onClick={()=>sendAI(aiInput)} disabled={aiLoad||!aiInput.trim()} style={{opacity:aiLoad||!aiInput.trim()?0.5:1}}>
                    {Icon.send} Send
                  </Btn>
                </div>
              </Card>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <Card style={{padding:16}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12}}>Quick Questions</div>
                  {["What is total revenue for 2026?","Compare Solmar vs Snowtravel","Which month had the most PAX?","How many cancellations in 2025?","Show revenue breakdown by dataset","Year-on-year growth rate?","Average revenue per booking?"].map((q,i)=>(
                    <button key={i} onClick={()=>sendAI(q)} style={{display:"block",width:"100%",textAlign:"left",background:"transparent",border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 12px",fontSize:12,color:C.text,cursor:"pointer",marginBottom:5,lineHeight:1.4,transition:"all 0.15s"}}
                      onMouseEnter={e=>{e.target.style.background=C.accentLight;e.target.style.borderColor=C.accent;e.target.style.color=C.accent;}}
                      onMouseLeave={e=>{e.target.style.background="transparent";e.target.style.borderColor=C.border;e.target.style.color=C.text;}}
                    >{q}</button>
                  ))}
                </Card>
                <Card style={{padding:16}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10}}>Data Sources</div>
                  {[["Snowtravel","#3b82f6"],["Solmar","#10b981"],["Interbus","#f59e0b"],["Solmar DE","#ef4444"]].map(([ds,color])=>(
                    <div key={ds} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:color}}/>
                        <span style={{fontSize:13,color:C.text}}>{ds}</span>
                      </div>
                      <Badge color="success">Live</Badge>
                    </div>
                  ))}
                </Card>
              </div>
            </div>
          )}

          {/* ══ SETTINGS ══════════════════════════════════════════════════════ */}
          {tab==="settings"&&user?.role==="admin"&&(
            <div>
              <div style={{display:"flex",gap:0,borderBottom:`1px solid ${C.border}`,marginBottom:20}}>
                {[["users","User Management"],["api","API Configuration"],["db","Database Status"]].map(([k,l])=>(
                  <button key={k} onClick={()=>setStTab(k)} style={{background:"transparent",border:"none",borderBottom:`2px solid ${stTab===k?C.accent:"transparent"}`,color:stTab===k?C.accent:C.textMuted,padding:"10px 18px",fontSize:13,fontWeight:stTab===k?600:400,cursor:"pointer",transition:"all 0.15s"}}>{l}</button>
                ))}
              </div>

              {/* Users */}
              {stTab==="users"&&(
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                    <span style={{fontSize:15,fontWeight:700,color:C.text}}>User Accounts ({users.length})</span>
                    <Btn onClick={()=>setShowAddUser(true)}>{Icon.plus} Add New User</Btn>
                  </div>
                  <Card>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                      <thead>
                        <tr style={{background:C.tableAlt}}>
                          {["NAME","USERNAME","EMAIL","ROLE","STATUS","ACTIONS"].map(h=>(
                            <th key={h} style={{padding:"11px 16px",textAlign:"left",fontSize:10,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.06em",borderBottom:`1px solid ${C.border}`}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u,i)=>(
                          <tr key={u.id} style={{borderBottom:`1px solid ${C.border}`,background:i%2===0?"#fff":C.tableAlt}}
                            onMouseEnter={e=>e.currentTarget.style.background=C.tableHover}
                            onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"#fff":C.tableAlt}>
                            <td style={{padding:"12px 16px",fontWeight:600,color:C.text}}>{u.name}</td>
                            <td style={{padding:"12px 16px",fontFamily:"monospace",fontSize:12,color:C.textMuted}}>{u.username}</td>
                            <td style={{padding:"12px 16px",color:C.textMuted}}>{u.email}</td>
                            <td style={{padding:"12px 16px"}}><Badge color={u.role==="admin"?"accent":"muted"}>{u.role==="admin"?"Admin":"Viewer"}</Badge></td>
                            <td style={{padding:"12px 16px"}}><Badge color="success">Active</Badge></td>
                            <td style={{padding:"12px 16px"}}>
                              <div style={{display:"flex",gap:6}}>
                                <Btn size="sm" variant="ghost" onClick={()=>setEditUser({...u})}>{Icon.edit} Edit</Btn>
                                <Btn size="sm" variant="danger" onClick={()=>{if(window.confirm(`Delete ${u.name}?`)) setUsers(p=>p.filter(x=>x.id!==u.id));}}>{Icon.trash} Delete</Btn>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                </div>
              )}

              {/* API Config */}
              {stTab==="api"&&(
                <div style={{maxWidth:520}}>
                  <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:16}}>API Configuration</div>
                  {[["OpenAI API Key","openai","sk-...","Powers the TTP AI assistant"],["Grip CRM Endpoint","grip","https://api.grip.com/...","Grip CRM integration"],["TravelTrustIt Key","traveltrustit","API key...","TravelTrustIt API"]].map(([l,k,ph,desc])=>(
                    <Card key={k} style={{padding:"16px 18px",marginBottom:12}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                        <span style={{color:C.accent}}>{Icon.key}</span>
                        <div>
                          <div style={{fontSize:13,fontWeight:600,color:C.text}}>{l}</div>
                          <div style={{fontSize:11,color:C.textMuted}}>{desc}</div>
                        </div>
                        <div style={{marginLeft:"auto"}}><Badge color={apiKeys[k]?"success":"muted"}>{apiKeys[k]?"Connected":"Not set"}</Badge></div>
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <input type="password" value={apiKeys[k]||""} onChange={e=>setApiKeys(a=>({...a,[k]:e.target.value}))} placeholder={ph}
                          style={{flex:1,background:"#f9fafb",border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 12px",fontSize:13,color:C.text,outline:"none"}}/>
                        <Btn size="sm" onClick={()=>alert("Key saved locally. Update backend .env for production.")}>Save</Btn>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* DB Status */}
              {stTab==="db"&&(
                <div style={{maxWidth:520}}>
                  <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:16}}>Database Status</div>
                  <Card style={{padding:"20px 22px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
                      <span style={{color:C.accent}}>{Icon.database}</span>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:C.text}}>Azure SQL — TTPDatabase</div>
                        <div style={{fontSize:11,color:C.textMuted}}>ttpserver.database.windows.net</div>
                      </div>
                      <div style={{marginLeft:"auto"}}><Badge color="success">Connected</Badge></div>
                    </div>
                    {[["Snowtravel","ST_Bookings",6720],["Solmar","CustomerOverview",9119],["Interbus","CustomerOverview",2824],["Solmar DE","CustomerOverview",64]].map(([ds,tbl,cnt])=>(
                      <div key={ds} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                        <div>
                          <div style={{fontSize:13,fontWeight:600,color:C.text}}>{ds}</div>
                          <div style={{fontSize:11,color:C.textMuted}}>{tbl}</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:13,fontWeight:700,color:C.accent}}>{fmtN(cnt)}</div>
                          <div style={{fontSize:10,color:C.textDim}}>bookings</div>
                        </div>
                      </div>
                    ))}
                    <div style={{marginTop:16}}>
                      <Btn onClick={()=>loadOverview(applied)}>{Icon.refresh} Force Refresh Cache</Btn>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status bar */}
        <div style={{background:C.card,borderTop:`1px solid ${C.border}`,padding:"5px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11,flexShrink:0}}>
          <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{color:C.textDim}}>Last sync: <span style={{color:C.accent,fontWeight:600}}>{lastSync||"—"}</span> Dubai</span>
            {[["Solmar",10345],["Snowtravel",6720],["Interbus",2824],["Solmar DE",64]].map(([k,v])=>(
              <span key={k} style={{color:C.textDim}}><span style={{color:C.textMuted,fontWeight:600}}>{k}</span>: {fmtN(v)}</span>
            ))}
          </div>
          <span style={{color:C.textDim}}>Auto-refresh 00:00 Dubai · TTP Analytics v2.0</span>
        </div>
      </main>

      {/* Add User Modal */}
      {showAddUser&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowAddUser(false)}>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:28,width:400,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:20}}>Add New User</div>
            {[["Full Name","name","text"],["Username","username","text"],["Email","email","email"],["Password","password","password"]].map(([l,k,t])=>(
              <div key={k} style={{marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:600,color:C.textMuted,marginBottom:4,textTransform:"uppercase"}}>{l}</div>
                <input type={t} value={newUser[k]||""} onChange={e=>setNewUser(u=>({...u,[k]:e.target.value}))}
                  style={{width:"100%",boxSizing:"border-box",background:"#f9fafb",border:`1px solid ${C.border}`,borderRadius:7,padding:"9px 12px",fontSize:13,color:C.text,outline:"none"}}/>
              </div>
            ))}
            <div style={{marginBottom:18}}>
              <div style={{fontSize:11,fontWeight:600,color:C.textMuted,marginBottom:4,textTransform:"uppercase"}}>Role</div>
              <select value={newUser.role} onChange={e=>setNewUser(u=>({...u,role:e.target.value}))}
                style={{width:"100%",background:"#f9fafb",border:`1px solid ${C.border}`,borderRadius:7,padding:"9px 12px",fontSize:13,color:C.text,outline:"none"}}>
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div style={{display:"flex",gap:10}}>
              <Btn onClick={()=>{if(!newUser.name||!newUser.username||!newUser.password) return; setUsers(p=>[...p,{...newUser,id:Date.now()}]); setNewUser({name:"",username:"",email:"",password:"",role:"viewer"}); setShowAddUser(false);}} style={{flex:1,justifyContent:"center"}}>Add User</Btn>
              <Btn variant="ghost" onClick={()=>setShowAddUser(false)} style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setEditUser(null)}>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:28,width:400,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:20}}>Edit User — {editUser.name}</div>
            {[["Full Name","name","text"],["Email","email","email"]].map(([l,k,t])=>(
              <div key={k} style={{marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:600,color:C.textMuted,marginBottom:4,textTransform:"uppercase"}}>{l}</div>
                <input type={t} value={editUser[k]||""} onChange={e=>setEditUser(u=>({...u,[k]:e.target.value}))}
                  style={{width:"100%",boxSizing:"border-box",background:"#f9fafb",border:`1px solid ${C.border}`,borderRadius:7,padding:"9px 12px",fontSize:13,color:C.text,outline:"none"}}/>
              </div>
            ))}
            <div style={{marginBottom:18}}>
              <div style={{fontSize:11,fontWeight:600,color:C.textMuted,marginBottom:4,textTransform:"uppercase"}}>Role</div>
              <select value={editUser.role} onChange={e=>setEditUser(u=>({...u,role:e.target.value}))}
                style={{width:"100%",background:"#f9fafb",border:`1px solid ${C.border}`,borderRadius:7,padding:"9px 12px",fontSize:13,color:C.text,outline:"none"}}>
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div style={{display:"flex",gap:10}}>
              <Btn onClick={()=>{setUsers(p=>p.map(u=>u.id===editUser.id?{...editUser}:u));setEditUser(null);}} style={{flex:1,justifyContent:"center"}}>Save Changes</Btn>
              <Btn variant="ghost" onClick={()=>setEditUser(null)} style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          aside { width: 60px !important; }
          aside span { display: none !important; }
          main { margin-left: 60px !important; }
        }
        @keyframes bounce { 0%,80%,100%{transform:scale(0.4);opacity:0.4} 40%{transform:scale(1);opacity:1} }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
        input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.5; cursor: pointer; }
      `}</style>
    </div>
  );
}
