import { useState, useEffect, useRef, useCallback } from "react";
import Login from "./components/Login.jsx";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const YEAR_COLORS = ["#a78bfa","#f59e0b","#34d399","#3b82f6"];
const BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://localhost:3001";

const GRAY = {
  bg:"#f0f2f5", card:"#ffffff", cardHover:"#f8fafc", border:"#e2e8f0",
  accent:"#0033cc", accentHover:"#1a4dd6", text:"#1a202c", muted:"#718096",
  muted2:"#a0aec0", success:"#38a169", danger:"#e53e3e", warning:"#d97706",
  headerBg:"#ffffff", headerBorder:"#e2e8f0", tableAlt:"#f7fafc",
  tableHover:"#ebf8ff", inputBg:"#f8fafc", inputBorder:"#e2e8f0",
  statusOk:"#c6f6d5", statusOkText:"#276749",
  statusCancel:"#fed7d7", statusCancelText:"#9b2c2c",
  shadow:"0 1px 3px rgba(0,0,0,0.08)", cardShadow:"0 2px 8px rgba(0,0,0,0.06)",
};
const DARK = {
  bg:"#050d1a", card:"#0a1628", cardHover:"#0d1f3c", border:"#0e2040",
  accent:"#60a5fa", accentHover:"#93c5fd", text:"#f8fafc", muted:"#94a3b8",
  muted2:"#64748b", success:"#34d399", danger:"#f87171", warning:"#fbbf24",
  headerBg:"#0a1628", headerBorder:"#0e2040", tableAlt:"#080c14",
  tableHover:"#0d1f3c", inputBg:"#050d1a", inputBorder:"#0e2040",
  statusOk:"#064e3b", statusOkText:"#34d399",
  statusCancel:"#450a0a", statusCancelText:"#f87171",
  shadow:"0 1px 3px rgba(0,0,0,0.4)", cardShadow:"0 2px 12px rgba(0,0,0,0.4)",
};

function dubaiTime() {
  return new Date().toLocaleTimeString("en-GB",{timeZone:"Asia/Dubai",hour:"2-digit",minute:"2-digit"});
}

function fmt(n, decimals=0) {
  if (n == null) return "-";
  if (Math.abs(n) >= 1e6) return "€" + (n/1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return "€" + (n/1e3).toFixed(0) + "K";
  return "€" + Number(n).toLocaleString("nl-BE", {minimumFractionDigits: decimals, maximumFractionDigits: decimals});
}
function fmtNum(n) {
  if (n == null) return "-";
  return Number(n).toLocaleString("nl-BE");
}
function diffColor(v, T) { return v > 0 ? T.success : v < 0 ? T.danger : T.muted; }

async function apiFetch(path, params={}, token) {
  const t = token || localStorage.getItem("ttp_token");
  const qs = Object.entries(params).filter(([,v])=>v!=null&&v!=="").flatMap(([k,v])=>Array.isArray(v)?v.map(x=>`${k}=${encodeURIComponent(x)}`):[[`${k}=${encodeURIComponent(v)}`]]).join("&");
  const url = `${BASE}${path}${qs?"?"+qs:""}`;
  const r = await fetch(url, {headers:{"Authorization":`Bearer ${t}`}});
  if (r.status===401) throw Object.assign(new Error("Unauthorized"),{status:401});
  return r.json();
}

// ── CANVAS CHARTS ────────────────────────────────────────────────────────────

function LineChart({ data, title, T }) {
  const ref = useRef(null);
  const ptsRef = useRef([]);
  const [tip, setTip] = useState(null);

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    const pad = {top:28, right:16, bottom:36, left:56};
    ctx.clearRect(0,0,W,H);
    if (!data || !data.length) { ctx.fillStyle=T.muted; ctx.font="13px sans-serif"; ctx.textAlign="center"; ctx.fillText("No data",W/2,H/2); return; }

    const byYear = {};
    data.forEach(d=>{ if(!byYear[d.year]) byYear[d.year]={}; byYear[d.year][d.month]=(d.revenue||0); });
    const years = Object.keys(byYear).sort();
    const allVals = data.map(d=>d.revenue||0);
    const maxV = Math.max(...allVals, 1);

    const scX = m => pad.left + (m-1)*(W-pad.left-pad.right)/11;
    const scY = v => H-pad.bottom - (v/maxV)*(H-pad.top-pad.bottom);

    // Grid
    for(let i=0;i<=4;i++){
      const y=H-pad.bottom-(i/4)*(H-pad.top-pad.bottom);
      ctx.strokeStyle=T.border; ctx.lineWidth=0.5; ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(W-pad.right,y); ctx.stroke();
      ctx.fillStyle=T.muted2; ctx.font="10px sans-serif"; ctx.textAlign="right";
      const v=maxV*i/4; ctx.fillText(v>=1e6?(v/1e6).toFixed(1)+"M":v>=1e3?(v/1e3).toFixed(0)+"K":Math.round(v), pad.left-4, y+3);
    }
    // X axis labels
    ctx.fillStyle=T.muted; ctx.font="10px sans-serif"; ctx.textAlign="center";
    [1,2,3,4,5,6,7,8,9,10,11,12].forEach(m=>ctx.fillText(MONTHS[m-1],scX(m),H-pad.bottom+14));

    ptsRef.current = [];
    years.forEach((y,i)=>{
      const color = YEAR_COLORS[i%YEAR_COLORS.length];
      ctx.strokeStyle=color; ctx.lineWidth=2; ctx.beginPath();
      let started=false;
      [1,2,3,4,5,6,7,8,9,10,11,12].forEach(m=>{
        const v=byYear[y][m]; if(!v) return;
        const x=scX(m), yy=scY(v);
        if(!started){ctx.moveTo(x,yy);started=true;}else ctx.lineTo(x,yy);
        ptsRef.current.push({x,y:yy,year:y,month:MONTHS[m-1],value:v,color});
      });
      ctx.stroke();
      // Dots
      ptsRef.current.filter(p=>p.year===y).forEach(p=>{
        ctx.fillStyle=color; ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2); ctx.fill();
      });
    });

    // Legend
    let lx=pad.left;
    years.forEach((y,i)=>{
      ctx.fillStyle=YEAR_COLORS[i%YEAR_COLORS.length]; ctx.fillRect(lx,6,10,8);
      ctx.fillStyle=T.muted; ctx.font="10px sans-serif"; ctx.textAlign="left"; ctx.fillText(y,lx+13,13);
      lx+=42;
    });
  }, [data, T]);

  const onMove = useCallback(e=>{
    const canvas=ref.current; if(!canvas) return;
    const rect=canvas.getBoundingClientRect();
    const mx=(e.clientX-rect.left)*(canvas.width/rect.width/(window.devicePixelRatio||1));
    const my=(e.clientY-rect.top)*(canvas.height/rect.height/(window.devicePixelRatio||1));
    let nearest=null, minD=25;
    ptsRef.current.forEach(p=>{const d=Math.sqrt((p.x-mx)**2+(p.y-my)**2);if(d<minD){minD=d;nearest=p;}});
    setTip(nearest?{...nearest,cx:e.clientX,cy:e.clientY}:null);
  },[]);

  return (
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"16px 18px",boxShadow:T.cardShadow,height:"100%",boxSizing:"border-box",position:"relative"}}>
      <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>{title}</div>
      <canvas ref={ref} style={{width:"100%",height:190,display:"block",cursor:"crosshair"}} onMouseMove={onMove} onMouseLeave={()=>setTip(null)}/>
      {tip&&<div style={{position:"fixed",left:tip.cx+14,top:tip.cy-52,background:T.headerBg,border:`1px solid ${tip.color}`,borderRadius:8,padding:"7px 12px",fontSize:12,color:T.text,pointerEvents:"none",zIndex:9999,boxShadow:T.cardShadow,whiteSpace:"nowrap"}}>
        <div style={{color:tip.color,fontWeight:700,marginBottom:2}}>{tip.month} {tip.year}</div>
        <div>{fmt(tip.value)}</div>
      </div>}
    </div>
  );
}

function BarChart({ data, title, T }) {
  const ref = useRef(null);
  const barsRef = useRef([]);
  const [metric, setMetric] = useState("bookings");
  const [tip, setTip] = useState(null);

  useEffect(() => {
    const canvas=ref.current; if(!canvas) return;
    const dpr=window.devicePixelRatio||1;
    const rect=canvas.getBoundingClientRect();
    canvas.width=rect.width*dpr; canvas.height=rect.height*dpr;
    const ctx=canvas.getContext("2d"); ctx.scale(dpr,dpr);
    const W=rect.width, H=rect.height;
    const pad={top:28,right:16,bottom:36,left:50};
    ctx.clearRect(0,0,W,H);
    if(!data||!data.length){ctx.fillStyle=T.muted;ctx.font="13px sans-serif";ctx.textAlign="center";ctx.fillText("No data",W/2,H/2);return;}

    const byYear={};
    data.forEach(d=>{if(!byYear[d.year])byYear[d.year]={};byYear[d.year][d.month]=metric==="bookings"?(d.bookings||0):(d.pax||0);});
    const years=Object.keys(byYear).sort();
    const allVals=Object.values(byYear).flatMap(y=>Object.values(y));
    const maxV=Math.max(...allVals,1);
    const slotW=(W-pad.left-pad.right)/12;
    const bW=Math.max(4,Math.floor(slotW/years.length)-2);
    const sy=v=>H-pad.bottom-(v/maxV)*(H-pad.top-pad.bottom);

    for(let i=0;i<=4;i++){
      const yy=H-pad.bottom-(i/4)*(H-pad.top-pad.bottom);
      ctx.strokeStyle=T.border;ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(pad.left,yy);ctx.lineTo(W-pad.right,yy);ctx.stroke();
      const v=maxV*i/4;
      ctx.fillStyle=T.muted2;ctx.font="10px sans-serif";ctx.textAlign="right";
      ctx.fillText(v>=1e3?(v/1e3).toFixed(0)+"K":Math.round(v),pad.left-4,yy+3);
    }
    ctx.fillStyle=T.muted;ctx.font="10px sans-serif";ctx.textAlign="center";
    [1,2,3,4,5,6,7,8,9,10,11,12].forEach(m=>ctx.fillText(MONTHS[m-1],pad.left+(m-1)*slotW+slotW/2,H-pad.bottom+14));

    barsRef.current=[];
    years.forEach((y,i)=>{
      ctx.fillStyle=YEAR_COLORS[i%YEAR_COLORS.length]+"cc";
      [1,2,3,4,5,6,7,8,9,10,11,12].forEach(m=>{
        const v=byYear[y][m]||0; if(!v) return;
        const x=pad.left+(m-1)*slotW+i*(bW+1)+(slotW-years.length*(bW+1))/2;
        const barH=(v/maxV)*(H-pad.top-pad.bottom);
        ctx.fillRect(x,sy(v),bW,barH);
        barsRef.current.push({x,y:sy(v),width:bW,height:barH,year:y,month:MONTHS[m-1],value:v,metric});
      });
    });
    let lx=pad.left;
    years.forEach((y,i)=>{
      ctx.fillStyle=YEAR_COLORS[i%YEAR_COLORS.length];ctx.fillRect(lx,7,10,8);
      ctx.fillStyle=T.muted;ctx.font="10px sans-serif";ctx.textAlign="left";ctx.fillText(y,lx+13,14);
      lx+=42;
    });
  },[data,metric,T]);

  const onMove=useCallback(e=>{
    const canvas=ref.current;if(!canvas)return;
    const rect=canvas.getBoundingClientRect();
    const mx=(e.clientX-rect.left)*(canvas.width/rect.width/(window.devicePixelRatio||1));
    const my=(e.clientY-rect.top)*(canvas.height/rect.height/(window.devicePixelRatio||1));
    const bar=barsRef.current.find(b=>mx>=b.x&&mx<=b.x+b.width&&my>=b.y&&my<=b.y+b.height);
    setTip(bar?{...bar,cx:e.clientX,cy:e.clientY}:null);
  },[]);

  return (
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"16px 18px",boxShadow:T.cardShadow,height:"100%",boxSizing:"border-box",position:"relative"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.08em"}}>{title}</div>
        <div style={{display:"flex",gap:4}}>
          {["bookings","pax"].map(m=>(
            <button key={m} onClick={()=>setMetric(m)} style={{
              background:metric===m?T.accent:"transparent",color:metric===m?"#fff":T.muted,
              border:`1px solid ${metric===m?T.accent:T.border}`,borderRadius:6,
              padding:"3px 10px",fontSize:11,fontWeight:600,cursor:"pointer",
            }}>{m==="bookings"?"Bookings":"PAX"}</button>
          ))}
        </div>
      </div>
      <canvas ref={ref} style={{width:"100%",height:190,display:"block",cursor:"crosshair"}} onMouseMove={onMove} onMouseLeave={()=>setTip(null)}/>
      {tip&&<div style={{position:"fixed",left:tip.cx+14,top:tip.cy-52,background:T.headerBg,border:`1px solid ${T.accent}`,borderRadius:8,padding:"7px 12px",fontSize:12,color:T.text,pointerEvents:"none",zIndex:9999,boxShadow:T.cardShadow,whiteSpace:"nowrap"}}>
        <div style={{color:T.accent,fontWeight:700,marginBottom:2}}>{tip.month} {tip.year}</div>
        <div>{fmtNum(tip.value)} {tip.metric}</div>
      </div>}
    </div>
  );
}

function DonutChart({ data, T }) {
  const ref = useRef(null);
  const segsRef = useRef([]);
  const [tip, setTip] = useState(null);
  const COLORS = ["#3b82f6","#34d399","#f59e0b","#f87171","#a78bfa","#06b6d4"];

  const norm = (data||[]).reduce((acc,item)=>{
    const key=(item.transport_type||"").toLowerCase().replace("owntransport","own transport").trim();
    const ex=acc.find(x=>(x.transport_type||"").toLowerCase().trim()===key);
    if(ex){ex.bookings+=(item.bookings||0);}else acc.push({...item,transport_type:key});
    return acc;
  },[]).sort((a,b)=>(b.bookings||0)-(a.bookings||0));

  useEffect(()=>{
    const canvas=ref.current;if(!canvas)return;
    const dpr=window.devicePixelRatio||1;
    const rect=canvas.getBoundingClientRect();
    canvas.width=rect.width*dpr;canvas.height=rect.height*dpr;
    const ctx=canvas.getContext("2d");ctx.scale(dpr,dpr);
    const W=rect.width,H=rect.height;
    ctx.clearRect(0,0,W,H);
    if(!norm.length){return;}
    const total=norm.reduce((s,d)=>s+(d.bookings||0),0);
    const cx=W*0.42,cy=H/2,r=Math.min(cx,cy)-10,ir=r*0.6;
    let angle=-Math.PI/2;
    segsRef.current=[];
    norm.forEach((d,i)=>{
      const slice=((d.bookings||0)/total)*Math.PI*2;
      const color=COLORS[i%COLORS.length];
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,angle,angle+slice);ctx.closePath();
      ctx.fillStyle=color;ctx.fill();
      segsRef.current.push({start:angle,end:angle+slice,label:d.transport_type,value:d.bookings||0,pct:Math.round((d.bookings||0)/total*100),color});
      angle+=slice;
    });
    ctx.beginPath();ctx.arc(cx,cy,ir,0,Math.PI*2);ctx.fillStyle=T.card;ctx.fill();
    ctx.fillStyle=T.text;ctx.font=`bold 16px sans-serif`;ctx.textAlign="center";ctx.fillText(fmtNum(total),cx,cy+2);
    ctx.fillStyle=T.muted;ctx.font="10px sans-serif";ctx.fillText("bookings",cx,cy+16);
    // Legend
    const lx=W*0.72;
    norm.forEach((d,i)=>{
      const yy=16+i*22;
      if(yy>H-10)return;
      ctx.fillStyle=COLORS[i%COLORS.length];ctx.fillRect(lx,yy,10,10);
      ctx.fillStyle=T.text;ctx.font="11px sans-serif";ctx.textAlign="left";
      const label=d.transport_type.charAt(0).toUpperCase()+d.transport_type.slice(1);
      ctx.fillText(label.length>9?label.slice(0,9)+"..":label,lx+14,yy+9);
      ctx.fillStyle=T.muted;ctx.font="10px sans-serif";
      ctx.fillText(Math.round((d.bookings||0)/total*100)+"%",lx+14,yy+20);
    });
  },[norm,T]);

  const onMove=useCallback(e=>{
    const canvas=ref.current;if(!canvas)return;
    const rect=canvas.getBoundingClientRect();
    const mx=e.clientX-rect.left,my=e.clientY-rect.top;
    const W=rect.width,cx=W*0.42,cy=rect.height/2;
    const dx=mx-cx,dy=my-cy,dist=Math.sqrt(dx*dx+dy*dy);
    const r=Math.min(cx,cy)-10,ir=r*0.6;
    if(dist<ir||dist>r){setTip(null);return;}
    let angle=Math.atan2(dy,dx);
    if(angle<-Math.PI/2)angle+=Math.PI*2;
    const seg=segsRef.current.find(s=>angle>=s.start&&angle<s.end);
    if(seg)setTip({...seg,cx:e.clientX,cy:e.clientY});else setTip(null);
  },[]);

  return (
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"16px 18px",boxShadow:T.cardShadow,position:"relative"}}>
      <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>TRANSPORT TYPE</div>
      <canvas ref={ref} style={{width:"100%",height:160,display:"block",cursor:"crosshair"}} onMouseMove={onMove} onMouseLeave={()=>setTip(null)}/>
      {tip&&<div style={{position:"fixed",left:tip.cx+14,top:tip.cy-52,background:T.headerBg,border:`1px solid ${tip.color}`,borderRadius:8,padding:"7px 12px",fontSize:12,color:T.text,pointerEvents:"none",zIndex:9999,boxShadow:T.cardShadow,whiteSpace:"nowrap"}}>
        <div style={{color:tip.color,fontWeight:700,marginBottom:2}}>{tip.label}</div>
        <div>{fmtNum(tip.value)} bookings &middot; {tip.pct}%</div>
      </div>}
    </div>
  );
}

function BusBarChart({ data, metric, title, T }) {
  const ref = useRef(null);
  const barsRef = useRef([]);
  const [tip, setTip] = useState(null);
  const DS_COLORS = {"Solmar":"#34d399","Interbus":"#f59e0b","Snowtravel":"#60a5fa","Solmar DE":"#f87171"};

  useEffect(()=>{
    const canvas=ref.current;if(!canvas)return;
    const dpr=window.devicePixelRatio||1;
    const rect=canvas.getBoundingClientRect();
    canvas.width=rect.width*dpr;canvas.height=rect.height*dpr;
    const ctx=canvas.getContext("2d");ctx.scale(dpr,dpr);
    const W=rect.width,H=rect.height;
    const pad={top:28,right:16,bottom:48,left:50};
    ctx.clearRect(0,0,W,H);
    if(!data||!data.length){ctx.fillStyle=T.muted;ctx.font="13px sans-serif";ctx.textAlign="center";ctx.fillText("No data",W/2,H/2);return;}

    const classes=[...new Set(data.map(d=>d.bus_class||d.bus_type_name||""))].filter(Boolean);
    const datasets=[...new Set(data.map(d=>d.dataset))].filter(Boolean);
    const maxV=Math.max(...data.map(d=>metric==="revenue"?(d.revenue||0):(d.bookings||0)),1);
    const slotW=(W-pad.left-pad.right)/Math.max(classes.length,1);
    const bW=Math.max(6,Math.floor(slotW/Math.max(datasets.length,1))-3);
    const sy=v=>H-pad.bottom-(v/maxV)*(H-pad.top-pad.bottom);

    for(let i=0;i<=4;i++){
      const yy=H-pad.bottom-(i/4)*(H-pad.top-pad.bottom);
      ctx.strokeStyle=T.border;ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(pad.left,yy);ctx.lineTo(W-pad.right,yy);ctx.stroke();
      const v=maxV*i/4;
      ctx.fillStyle=T.muted2;ctx.font="10px sans-serif";ctx.textAlign="right";
      ctx.fillText(v>=1e6?(v/1e6).toFixed(1)+"M":v>=1e3?(v/1e3).toFixed(0)+"K":Math.round(v),pad.left-4,yy+3);
    }

    barsRef.current=[];
    classes.forEach((cls,ci)=>{
      const slotX=pad.left+ci*slotW;
      const totalW=datasets.length*(bW+2);
      datasets.forEach((ds,di)=>{
        const row=data.find(d=>(d.bus_class||d.bus_type_name||"")===(cls)&&d.dataset===ds);
        if(!row)return;
        const v=metric==="revenue"?(row.revenue||0):(row.bookings||0);
        if(!v)return;
        const x=slotX+(slotW-totalW)/2+di*(bW+2);
        const barH=(v/maxV)*(H-pad.top-pad.bottom);
        const color=DS_COLORS[ds]||"#94a3b8";
        ctx.fillStyle=color;
        ctx.fillRect(x,sy(v),bW,barH);
        barsRef.current.push({x,y:sy(v),width:bW,height:barH,ds,cls,value:v,metric,color});
      });
      ctx.fillStyle=T.muted;ctx.font="10px sans-serif";ctx.textAlign="center";
      const label=cls.length>8?cls.slice(0,8)+"..":cls;
      ctx.fillText(label,slotX+slotW/2,H-pad.bottom+13);
    });

    let lx=pad.left;
    datasets.forEach(ds=>{
      const color=DS_COLORS[ds]||"#94a3b8";
      ctx.fillStyle=color;ctx.fillRect(lx,8,10,8);
      ctx.fillStyle=T.muted;ctx.font="10px sans-serif";ctx.textAlign="left";ctx.fillText(ds,lx+13,15);
      lx+=ds.length*6+24;
    });
  },[data,metric,T]);

  const onMove=useCallback(e=>{
    const canvas=ref.current;if(!canvas)return;
    const rect=canvas.getBoundingClientRect();
    const mx=(e.clientX-rect.left)*(canvas.width/rect.width/(window.devicePixelRatio||1));
    const my=(e.clientY-rect.top)*(canvas.height/rect.height/(window.devicePixelRatio||1));
    const bar=barsRef.current.find(b=>mx>=b.x&&mx<=b.x+b.width&&my>=b.y&&my<=b.y+b.height);
    setTip(bar?{...bar,cx:e.clientX,cy:e.clientY}:null);
  },[]);

  return (
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"16px 18px",boxShadow:T.cardShadow,position:"relative",flex:1}}>
      <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>{title}</div>
      <canvas ref={ref} style={{width:"100%",height:200,display:"block",cursor:"crosshair"}} onMouseMove={onMove} onMouseLeave={()=>setTip(null)}/>
      {tip&&<div style={{position:"fixed",left:tip.cx+14,top:tip.cy-52,background:T.headerBg,border:`1px solid ${tip.color}`,borderRadius:8,padding:"7px 12px",fontSize:12,color:T.text,pointerEvents:"none",zIndex:9999,boxShadow:T.cardShadow,whiteSpace:"nowrap"}}>
        <div style={{color:tip.color,fontWeight:700,marginBottom:2}}>{tip.cls} &middot; {tip.ds}</div>
        <div>{tip.metric==="revenue"?fmt(tip.value):fmtNum(tip.value)+" bookings"}</div>
      </div>}
    </div>
  );
}

// ── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [token, setToken] = useState(()=>localStorage.getItem("ttp_token")||"");
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("overview");
  const [busTab, setBusTab] = useState("solmar");
  const [themeKey, setThemeKey] = useState(()=>localStorage.getItem("ttp_theme")||"gray");
  const T = themeKey==="blue" ? DARK : GRAY;

  // Filters
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({departureDateFrom:"",departureDateTo:"",bookingDateFrom:"",bookingDateTo:"",datasets:[],transports:[],statuses:[]});
  const [applied, setApplied] = useState({});

  // Overview data
  const [kpis, setKpis] = useState(null);
  const [revData, setRevData] = useState([]);
  const [ymData, setYmData] = useState([]);
  const [trData, setTrData] = useState([]);
  const [slicers, setSlicers] = useState({transportTypes:[],busTypes:[],datasets:[]});
  const [oLoad, setOLoad] = useState(false);
  const [lastR, setLastR] = useState("");

  // Bus data
  const [busTrips, setBusTrips] = useState([]);
  const [busClass, setBusClass] = useState([]);
  const [stTrips, setStTrips] = useState([]);
  const [bLoad, setBLoad] = useState(false);
  const [busFilters, setBusFilters] = useState({dateFrom:"",dateTo:""});

  // AI
  const [msgs, setMsgs] = useState([{role:"assistant",text:"Hello! I am your TTP Analytics AI. Ask me anything about bookings, revenue, PAX or trends across Snowtravel, Solmar, Interbus and Solmar DE."}]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoad, setAiLoad] = useState(false);
  const chatRef = useRef(null);

  // Data Table
  const [tableData, setTableData] = useState([]);
  const [tableSearch, setTableSearch] = useState("");
  const [tableDataset, setTableDataset] = useState("");
  const [tableStatus, setTableStatus] = useState("");
  const [tablePage, setTablePage] = useState(1);
  const [tLoad, setTLoad] = useState(false);

  // Settings
  const [users, setUsers] = useState([]);
  const [settingsTab, setSettingsTab] = useState("users");
  const [showAddUser, setShowAddUser] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [newUser, setNewUser] = useState({name:"",username:"",email:"",password:"",role:"viewer"});

  // Dubai clock
  const [clock, setClock] = useState(dubaiTime());
  useEffect(()=>{const iv=setInterval(()=>setClock(dubaiTime()),1000);return()=>clearInterval(iv);},[]);

  // Parse token
  useEffect(()=>{
    if(!token)return;
    try{const p=JSON.parse(atob(token.split(".")[1]));setUser(p.user||p);}catch{}
  },[token]);

  const logout = ()=>{ localStorage.removeItem("ttp_token"); setToken(""); setUser(null); };
  const onLogin = (tok,u)=>{ localStorage.setItem("ttp_token",tok); setToken(tok); setUser(u); };

  const switchTheme = (k)=>{ setThemeKey(k); localStorage.setItem("ttp_theme",k); };

  // Build params
  const buildP = useCallback((f)=>{
    const p={};
    if(f.departureDateFrom)p.departureDateFrom=f.departureDateFrom;
    if(f.departureDateTo)p.departureDateTo=f.departureDateTo;
    if(f.bookingDateFrom)p.bookingDateFrom=f.bookingDateFrom;
    if(f.bookingDateTo)p.bookingDateTo=f.bookingDateTo;
    if((f.datasets||[]).length)p.dataset=f.datasets;
    if((f.transports||[]).length)p.transportType=f.transports;
    if((f.statuses||[]).length)p.status=f.statuses;
    return p;
  },[]);

  // Load overview
  const loadOverview = useCallback((f)=>{
    if(!token)return;
    setOLoad(true);
    const p=buildP(f);
    Promise.all([
      apiFetch("/api/dashboard/kpis",p).catch(()=>null),
      apiFetch("/api/dashboard/revenue-by-year",p).catch(()=>[]),
      apiFetch("/api/dashboard/year-month-comparison",p).catch(()=>[]),
      apiFetch("/api/dashboard/transport-breakdown",p).catch(()=>[]),
    ]).then(([k,r,ym,tr])=>{
      if(k&&!k.error)setKpis(k);
      if(Array.isArray(r))setRevData(r);
      if(Array.isArray(ym))setYmData(ym);
      if(Array.isArray(tr))setTrData(tr);
      setLastR(dubaiTime());
    }).catch(console.error).finally(()=>setOLoad(false));
  },[token,buildP]);

  useEffect(()=>{
    if(!token)return;
    apiFetch("/api/dashboard/slicers",{}).then(d=>{ if(d&&!d.error)setSlicers(d); }).catch(()=>{});
    loadOverview({});
  },[token]);

  useEffect(()=>{if(token)loadOverview(applied);},[applied]);

  // Load bus data
  const loadBus = useCallback((f={})=>{
    if(!token)return;
    setBLoad(true);
    const p={};
    if(f.dateFrom)p.dateFrom=f.dateFrom;
    if(f.dateTo)p.dateTo=f.dateTo;
    Promise.all([
      apiFetch("/api/dashboard/bustrips",p).catch(()=>[]),
      apiFetch("/api/dashboard/bus-class-summary",{}).catch(()=>[]),
      apiFetch("/api/dashboard/snowtravel-bus",p).catch(()=>[]),
    ]).then(([bt,bc,st])=>{
      const btRows=Array.isArray(bt)?bt:(bt?.rows||[]);
      setBusTrips(btRows);
      if(Array.isArray(bc))setBusClass(bc);
      const stRows=Array.isArray(st)?st:(st?.rows||[]);
      setStTrips(stRows);
    }).catch(console.error).finally(()=>setBLoad(false));
  },[token]);

  useEffect(()=>{if(token)loadBus({});},[token]);

  // Load table data
  const loadTable = useCallback(()=>{
    if(!token)return;
    setTLoad(true);
    const p={};
    if(tableDataset)p.dataset=tableDataset;
    if(tableStatus)p.status=tableStatus;
    apiFetch("/api/dashboard/export",{...p,token},token)
      .then(d=>{ /* CSV - handled differently */ })
      .catch(()=>{});
    apiFetch("/api/dashboard/year-month-comparison",p)
      .then(d=>{ if(Array.isArray(d))setTableData(d); })
      .catch(()=>[]).finally(()=>setTLoad(false));
  },[token,tableDataset,tableStatus]);

  useEffect(()=>{if(token&&tab==="table")loadTable();},[token,tab]);

  // Load users
  useEffect(()=>{
    if(!token||!user||(user.role!=="admin"))return;
    apiFetch("/api/auth/users",{}).then(d=>{ if(Array.isArray(d))setUsers(d); }).catch(()=>{
      setUsers([
        {id:1,name:"Abdul Rahman",username:"abdulrahman",email:"abdrah1264@gmail.com",role:"admin",active:true},
        {id:2,name:"TTP Admin",username:"ttp_admin",email:"admin@ttp-services.com",role:"admin",active:true},
        {id:3,name:"Robbert Jan",username:"robbert",email:"robbert@ttp-services.com",role:"viewer",active:true},
        {id:4,name:"Samir",username:"samir",email:"samir@ttp-services.com",role:"viewer",active:true},
      ]);
    });
  },[token,user]);

  // AI send
  const sendAI = async (msg)=>{
    if(!msg.trim()||aiLoad)return;
    setMsgs(m=>[...m,{role:"user",text:msg}]);
    setAiInput("");
    setAiLoad(true);
    try{
      const t=localStorage.getItem("ttp_token");
      const r=await fetch(`${BASE}/api/ai/chat`,{
        method:"POST",
        headers:{"Authorization":`Bearer ${t}`,"Content-Type":"application/json"},
        body:JSON.stringify({message:msg})
      });
      if(r.status===401){logout();return;}
      const d=await r.json();
      setMsgs(m=>[...m,{role:"assistant",text:d.reply||"Sorry, I could not get a response."}]);
    }catch{
      setMsgs(m=>[...m,{role:"assistant",text:"Connection error. Please check the server is running."}]);
    }finally{setAiLoad(false);}
  };

  useEffect(()=>{
    if(chatRef.current)chatRef.current.scrollTop=chatRef.current.scrollHeight;
  },[msgs]);

  const exportCSV = ()=>{
    const p=new URLSearchParams();
    p.set("token",localStorage.getItem("ttp_token")||"");
    const af=applied;
    if(af.departureDateFrom)p.set("departureDateFrom",af.departureDateFrom);
    if(af.departureDateTo)p.set("departureDateTo",af.departureDateTo);
    if((af.datasets||[]).length)af.datasets.forEach(d=>p.append("dataset",d));
    if((af.statuses||[]).length)af.statuses.forEach(s=>p.append("status",s));
    window.open(`${BASE}/api/dashboard/export?${p.toString()}`,"_blank");
  };

  const QUICK_DATES = [
    {label:"This Year",fn:()=>{const y=new Date().getFullYear();setFilters(f=>({...f,departureDateFrom:`${y}-01-01`,departureDateTo:`${y}-12-31`}));}},
    {label:"Last Year",fn:()=>{const y=new Date().getFullYear()-1;setFilters(f=>({...f,departureDateFrom:`${y}-01-01`,departureDateTo:`${y}-12-31`}));}},
    {label:"Last 3M",fn:()=>{const to=new Date(),from=new Date();from.setMonth(from.getMonth()-3);setFilters(f=>({...f,departureDateFrom:from.toISOString().split("T")[0],departureDateTo:to.toISOString().split("T")[0]}));}},
    {label:"All",fn:()=>setFilters(f=>({...f,departureDateFrom:"",departureDateTo:"",bookingDateFrom:"",bookingDateTo:""}))},
  ];

  if(!token) return <Login onLogin={onLogin}/>;

  const isAdmin = user?.role==="admin";

  // ── RENDER ─────────────────────────────────────────────────────────────────

  const TABS = [
    {id:"overview",label:"Overview"},
    {id:"bus",label:"Bus Occupancy"},
    {id:"ai",label:"AI Assistant"},
    {id:"table",label:"Data Table"},
    ...(isAdmin?[{id:"settings",label:"Settings"}]:[]),
  ];

  return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"'Segoe UI',system-ui,sans-serif",color:T.text}}>
      {/* HEADER */}
      <div style={{background:T.headerBg,borderBottom:`1px solid ${T.headerBorder}`,boxShadow:T.shadow,position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:1400,margin:"0 auto",padding:"0 20px",display:"flex",alignItems:"center",gap:0,height:52}}>
          {/* Logo */}
          <div style={{display:"flex",alignItems:"center",gap:8,marginRight:28,flexShrink:0}}>
            <div style={{width:30,height:30,background:T.accent,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <img src="/assets/logo.png" alt="TTP" style={{height:20,objectFit:"contain",filter:"brightness(0) invert(1)"}}
                onError={e=>{e.target.style.display="none";e.target.nextSibling.style.display="block";}}
              />
              <span style={{display:"none",color:"#fff",fontWeight:800,fontSize:11}}>TTP</span>
            </div>
            <span style={{fontSize:13,fontWeight:700,color:T.accent,letterSpacing:"0.06em"}}>ANALYTICS</span>
          </div>

          {/* Tabs */}
          <div style={{display:"flex",alignItems:"center",gap:0,flex:1,overflowX:"auto"}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{
                background:"transparent",border:"none",borderBottom:`2px solid ${tab===t.id?T.accent:"transparent"}`,
                color:tab===t.id?T.accent:T.muted,padding:"0 14px",height:52,fontSize:14,
                fontWeight:tab===t.id?600:400,cursor:"pointer",whiteSpace:"nowrap",
                transition:"all 0.15s",flexShrink:0,
              }}>{t.label}</button>
            ))}
          </div>

          {/* Right controls */}
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            <span style={{fontSize:12,color:T.muted,fontFamily:"monospace"}}>{clock} DXB</span>
            <button onClick={()=>loadOverview(applied)} title="Refresh" style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:7,padding:"5px 8px",cursor:"pointer",color:T.muted,display:"flex",alignItems:"center"}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.04-5.44"/></svg>
            </button>
            <button onClick={()=>setFiltersOpen(o=>!o)} style={{background:filtersOpen?T.accent:"transparent",color:filtersOpen?"#fff":T.muted,border:`1px solid ${filtersOpen?T.accent:T.border}`,borderRadius:7,padding:"5px 12px",fontSize:13,fontWeight:600,cursor:"pointer"}}>Filters</button>
            <button onClick={exportCSV} style={{background:T.accent,color:"#fff",border:"none",borderRadius:7,padding:"6px 14px",fontSize:13,fontWeight:600,cursor:"pointer"}}>Export</button>
            <span style={{fontSize:13,color:T.muted,marginLeft:4}}>{user?.username||"user"}</span>
            <button onClick={logout} style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:7,padding:"5px 10px",fontSize:12,color:T.muted,cursor:"pointer"}}>Logout</button>
          </div>
        </div>

        {/* Filters panel */}
        {filtersOpen&&(
          <div style={{borderTop:`1px solid ${T.border}`,background:T.headerBg,padding:"14px 20px"}}>
            <div style={{maxWidth:1400,margin:"0 auto"}}>
              {/* Quick date presets */}
              <div style={{display:"flex",gap:6,marginBottom:12,alignItems:"center"}}>
                <span style={{fontSize:11,color:T.muted,fontWeight:600,marginRight:4}}>Quick:</span>
                {QUICK_DATES.map(q=>(
                  <button key={q.label} onClick={()=>{q.fn();}} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,color:T.muted,padding:"3px 12px",fontSize:12,cursor:"pointer",fontWeight:500}}>{q.label}</button>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,alignItems:"end"}}>
                {[
                  {label:"Departure From",key:"departureDateFrom"},
                  {label:"Departure To",key:"departureDateTo"},
                  {label:"Booking From",key:"bookingDateFrom"},
                  {label:"Booking To",key:"bookingDateTo"},
                ].map(({label,key})=>(
                  <div key={key}>
                    <div style={{fontSize:11,color:T.muted,fontWeight:600,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.04em"}}>{label}</div>
                    <input type="date" value={filters[key]||""} onChange={e=>setFilters(f=>({...f,[key]:e.target.value}))}
                      style={{width:"100%",boxSizing:"border-box",background:T.inputBg,border:`1px solid ${T.inputBorder}`,borderRadius:7,padding:"7px 10px",fontSize:13,color:T.text,outline:"none",colorScheme:themeKey==="blue"?"dark":"light"}}
                    />
                  </div>
                ))}
                {/* Dataset */}
                <div>
                  <div style={{fontSize:11,color:T.muted,fontWeight:600,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.04em"}}>Dataset</div>
                  <select value={(filters.datasets||[])[0]||""} onChange={e=>setFilters(f=>({...f,datasets:e.target.value?[e.target.value]:[]}))}
                    style={{width:"100%",background:T.inputBg,border:`1px solid ${T.inputBorder}`,borderRadius:7,padding:"7px 10px",fontSize:13,color:T.text,outline:"none"}}>
                    <option value="">All</option>
                    {["Snowtravel","Solmar","Interbus","Solmar DE"].map(d=><option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                {/* Transport */}
                <div>
                  <div style={{fontSize:11,color:T.muted,fontWeight:600,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.04em"}}>Transport</div>
                  <select value={(filters.transports||[])[0]||""} onChange={e=>setFilters(f=>({...f,transports:e.target.value?[e.target.value]:[]}))}
                    style={{width:"100%",background:T.inputBg,border:`1px solid ${T.inputBorder}`,borderRadius:7,padding:"7px 10px",fontSize:13,color:T.text,outline:"none"}}>
                    <option value="">All</option>
                    {(slicers.transportTypes||[]).map(d=><option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                {/* Status */}
                <div>
                  <div style={{fontSize:11,color:T.muted,fontWeight:600,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.04em"}}>Status</div>
                  <div style={{display:"flex",gap:5}}>
                    {[["","All",T.muted],["ok","OK",T.success],["cancelled","Cancelled",T.danger]].map(([v,l,c])=>{
                      const active=v===""?(filters.statuses||[]).length===0:(filters.statuses||[]).includes(v);
                      return <button key={v} onClick={()=>setFilters(f=>({...f,statuses:v?[v]:[]}))} style={{background:active?`${c}22`:"transparent",border:`1px solid ${active?c:T.border}`,borderRadius:6,color:active?c:T.muted,padding:"6px 12px",fontSize:12,cursor:"pointer",fontWeight:active?700:400}}>{l}</button>;
                    })}
                  </div>
                </div>
                {/* Buttons */}
                <div style={{display:"flex",gap:8,paddingTop:20}}>
                  <button onClick={()=>{setApplied({...filters});setFiltersOpen(false);}} style={{flex:1,background:T.accent,color:"#fff",border:"none",borderRadius:7,padding:"8px",fontSize:13,fontWeight:600,cursor:"pointer"}}>Apply</button>
                  <button onClick={()=>{setFilters({departureDateFrom:"",departureDateTo:"",bookingDateFrom:"",bookingDateTo:"",datasets:[],transports:[],statuses:[]});setApplied({});}} style={{flex:1,background:"transparent",border:`1px solid ${T.border}`,borderRadius:7,padding:"8px",fontSize:13,color:T.muted,cursor:"pointer"}}>Reset</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div style={{maxWidth:1400,margin:"0 auto",padding:"20px 20px 60px"}}>

        {/* ── OVERVIEW TAB ── */}
        {tab==="overview"&&(
          <div>
            {oLoad&&<div style={{textAlign:"center",padding:20,color:T.muted,fontSize:13}}>Loading data...</div>}
            {/* KPI Cards */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:20}} className="kpi-grid">
              {[
                {label:"BOOKINGS",curr:kpis?.currentBookings,prev:kpis?.previousBookings,diff:kpis?.differenceBookings,pct:kpis?.percentBookings,fmt:fmtNum,icon:(
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                )},
                {label:"PAX",curr:kpis?.currentPax,prev:kpis?.previousPax,diff:kpis?.differencePax,pct:kpis?.percentPax,fmt:fmtNum,icon:(
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                )},
                {label:"REVENUE",curr:kpis?.currentRevenue,prev:kpis?.previousRevenue,diff:kpis?.differenceRevenue,pct:kpis?.percentRevenue,fmt:fmt,icon:(
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                )},
              ].map(({label,curr,prev,diff,pct,fmt:f,icon})=>(
                <div key={label} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"20px 24px",boxShadow:T.cardShadow,transition:"box-shadow 0.15s"}}
                  onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 4px 16px rgba(0,51,204,0.12)`}
                  onMouseLeave={e=>e.currentTarget.style.boxShadow=T.cardShadow}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                    <div style={{color:T.accent}}>{icon}</div>
                    <span style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.08em"}}>{label}</span>
                  </div>
                  <div style={{fontSize:32,fontWeight:800,color:T.accent,marginBottom:6,lineHeight:1}}>{curr!=null?f(curr):"—"}</div>
                  <div style={{fontSize:12,color:T.muted,marginBottom:8}}>prev year: {prev!=null?f(prev):"—"}</div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{color:diffColor(diff,T),fontSize:13,fontWeight:700}}>
                      {diff!=null?(diff>0?"▲ ":"▼ ")+f(Math.abs(diff)):"—"}
                    </span>
                    {pct!=null&&<span style={{background:diffColor(diff,T)+"22",color:diffColor(diff,T),fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:20}}>
                      {diff>0?"+":""}{Number(pct).toFixed(1)}%
                    </span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}} className="chart-grid">
              <LineChart data={revData} title="REVENUE BY YEAR" T={T}/>
              <BarChart data={revData} title="BOOKINGS / PAX BY YEAR" T={T}/>
            </div>

            {/* Table + Donut */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 260px",gap:16,alignItems:"start"}}>
              {/* Year-Month table */}
              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden",boxShadow:T.cardShadow}}>
                <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`,fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.08em"}}>
                  YEAR-MONTH COMPARISON
                </div>
                <div style={{overflowX:"auto",maxHeight:420,overflowY:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                    <thead>
                      <tr style={{background:T.tableAlt,position:"sticky",top:0}}>
                        {["PERIOD","LAST YEAR","BOOKINGS","PREV BKG","PAX","PREV PAX","REVENUE","PREV REV","DIFFERENCE","% DIFF"].map(h=>(
                          <th key={h} style={{padding:"9px 12px",textAlign:"right",fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap",borderBottom:`1px solid ${T.border}`,...(h==="PERIOD"||h==="LAST YEAR"?{textAlign:"left"}:{})}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ymData.length===0&&<tr><td colSpan={10} style={{padding:20,textAlign:"center",color:T.muted,fontSize:12}}>No data — apply filters or click refresh</td></tr>}
                      {ymData.map((row,i)=>{
                        const d=row.diffRevenue||row.difference||0;
                        const pct=row.diffPct||row.percentRevenue||0;
                        return (
                          <tr key={i} style={{background:i%2===0?T.card:T.tableAlt,borderBottom:`1px solid ${T.border}`}}
                            onMouseEnter={e=>e.currentTarget.style.background=T.tableHover}
                            onMouseLeave={e=>e.currentTarget.style.background=i%2===0?T.card:T.tableAlt}>
                            <td style={{padding:"9px 12px",fontWeight:600,color:T.accent,whiteSpace:"nowrap"}}>{MONTHS[(row.month||1)-1]}-{row.year}</td>
                            <td style={{padding:"9px 12px",color:T.muted,whiteSpace:"nowrap"}}>{MONTHS[(row.month||1)-1]}-{(row.year||0)-1}</td>
                            <td style={{padding:"9px 12px",textAlign:"right",fontWeight:600}}>{fmtNum(row.currentBookings||row.bookings)}</td>
                            <td style={{padding:"9px 12px",textAlign:"right",color:T.muted}}>{fmtNum(row.previousBookings||row.prevBookings)}</td>
                            <td style={{padding:"9px 12px",textAlign:"right",fontWeight:600}}>{fmtNum(row.currentPax||row.pax)}</td>
                            <td style={{padding:"9px 12px",textAlign:"right",color:T.muted}}>{fmtNum(row.previousPax||row.prevPax)}</td>
                            <td style={{padding:"9px 12px",textAlign:"right",fontWeight:600}}>{fmt(row.currentRevenue||row.revenue)}</td>
                            <td style={{padding:"9px 12px",textAlign:"right",color:T.muted}}>{fmt(row.previousRevenue||row.prevRevenue)}</td>
                            <td style={{padding:"9px 12px",textAlign:"right",color:diffColor(d,T),fontWeight:700}}>{d>0?"+":""}{fmt(d)}</td>
                            <td style={{padding:"9px 12px",textAlign:"right",color:diffColor(pct,T),fontWeight:700}}>{d>0?"+":""}{Number(pct||0).toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* Donut */}
              <DonutChart data={trData} T={T}/>
            </div>
          </div>
        )}

        {/* ── BUS OCCUPANCY TAB ── */}
        {tab==="bus"&&(
          <div>
            {/* Solmar/Snowtravel toggle */}
            <div style={{display:"flex",gap:8,marginBottom:16}}>
              {[["solmar","Solmar / Interbus"],["snowtravel","Snowtravel"]].map(([k,l])=>(
                <button key={k} onClick={()=>setBusTab(k)} style={{background:busTab===k?T.accent:"transparent",color:busTab===k?"#fff":T.muted,border:`1px solid ${busTab===k?T.accent:T.border}`,borderRadius:8,padding:"8px 20px",fontSize:13,fontWeight:600,cursor:"pointer"}}>{l}</button>
              ))}
            </div>

            {/* Bus date filter */}
            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"14px 18px",marginBottom:16,display:"flex",gap:12,alignItems:"flex-end",flexWrap:"wrap"}}>
              {[["Date From","dateFrom"],["Date To","dateTo"]].map(([l,k])=>(
                <div key={k}>
                  <div style={{fontSize:11,color:T.muted,fontWeight:600,marginBottom:4}}>{l}</div>
                  <input type="date" value={busFilters[k]||""} onChange={e=>setBusFilters(f=>({...f,[k]:e.target.value}))}
                    style={{background:T.inputBg,border:`1px solid ${T.inputBorder}`,borderRadius:7,padding:"7px 10px",fontSize:13,color:T.text,outline:"none",colorScheme:themeKey==="blue"?"dark":"light"}}
                  />
                </div>
              ))}
              <button onClick={()=>loadBus(busFilters)} style={{background:T.accent,color:"#fff",border:"none",borderRadius:7,padding:"8px 18px",fontSize:13,fontWeight:600,cursor:"pointer"}}>Apply</button>
              <button onClick={()=>{setBusFilters({dateFrom:"",dateTo:""});loadBus({});}} style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:7,padding:"8px 14px",fontSize:13,color:T.muted,cursor:"pointer"}}>Reset</button>
            </div>

            {bLoad&&<div style={{textAlign:"center",padding:20,color:T.muted}}>Loading bus data...</div>}

            {/* Solmar charts */}
            {busTab==="solmar"&&(
              <div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
                  <BusBarChart data={busClass.filter(d=>d.dataset!=="Snowtravel")} metric="bookings" title="BOOKINGS BY BUS CLASS" T={T}/>
                  <BusBarChart data={busClass.filter(d=>d.dataset!=="Snowtravel")} metric="revenue" title="REVENUE BY BUS CLASS" T={T}/>
                </div>
                {/* BUStrips table */}
                <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden",boxShadow:T.cardShadow}}>
                  <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.08em"}}>
                      BUS OCCUPANCY — OUTBOUND VS RETURN
                    </span>
                    <span style={{fontSize:12,color:T.muted}}>{busTrips.length} trips</span>
                  </div>
                  <div style={{overflowX:"auto",maxHeight:480,overflowY:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead>
                        <tr style={{background:T.tableAlt,position:"sticky",top:0}}>
                          <th colSpan={2} style={{padding:"8px 12px",textAlign:"left",fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",borderBottom:`1px solid ${T.border}`}}>TRIP</th>
                          <th colSpan={4} style={{padding:"8px 12px",textAlign:"center",fontSize:10,fontWeight:700,color:"#2563eb",textTransform:"uppercase",borderBottom:`1px solid ${T.border}`,borderLeft:`2px solid ${T.border}`}}>OUTBOUND</th>
                          <th colSpan={4} style={{padding:"8px 12px",textAlign:"center",fontSize:10,fontWeight:700,color:T.success,textTransform:"uppercase",borderBottom:`1px solid ${T.border}`,borderLeft:`2px solid ${T.border}`}}>RETURN</th>
                          <th colSpan={4} style={{padding:"8px 12px",textAlign:"center",fontSize:10,fontWeight:700,color:T.warning,textTransform:"uppercase",borderBottom:`1px solid ${T.border}`,borderLeft:`2px solid ${T.border}`}}>DIFFERENCE</th>
                        </tr>
                        <tr style={{background:T.tableAlt,position:"sticky",top:33}}>
                          {["START","END","RC","FC","PRE","TOTAL","RC","FC","PRE","TOTAL","RC","FC","PRE","TOTAL"].map((h,i)=>(
                            <th key={i} style={{padding:"6px 10px",textAlign:i<2?"left":"right",fontSize:10,color:T.muted2,fontWeight:600,borderBottom:`1px solid ${T.border}`,...(i===2||i===6||i===10?{borderLeft:`2px solid ${T.border}`}:{})}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {busTrips.length===0&&<tr><td colSpan={14} style={{padding:20,textAlign:"center",color:T.muted,fontSize:12}}>No trips found</td></tr>}
                        {busTrips.map((r,i)=>(
                          <tr key={i} style={{background:i%2===0?T.card:T.tableAlt,borderBottom:`1px solid ${T.border}`}}
                            onMouseEnter={e=>e.currentTarget.style.background=T.tableHover}
                            onMouseLeave={e=>e.currentTarget.style.background=i%2===0?T.card:T.tableAlt}>
                            <td style={{padding:"8px 10px",color:T.accent,fontWeight:600,whiteSpace:"nowrap"}}>{r.StartDate}</td>
                            <td style={{padding:"8px 10px",color:T.muted,whiteSpace:"nowrap"}}>{r.EndDate}</td>
                            {[r.ORC,r.OFC,r.OPRE,r.OTotal].map((v,j)=><td key={j} style={{padding:"8px 10px",textAlign:"right",...(j===0?{borderLeft:`2px solid ${T.border}`}:{})}}>{v||0}</td>)}
                            {[r.RRC,r.RFC,r.RPRE,r.RTotal].map((v,j)=><td key={j} style={{padding:"8px 10px",textAlign:"right",...(j===0?{borderLeft:`2px solid ${T.border}`}:{})}}>{v||0}</td>)}
                            {[r.RC_Diff,r.FC_Diff,r.PRE_Diff,r.Total_Difference].map((v,j)=>(
                              <td key={j} style={{padding:"8px 10px",textAlign:"right",fontWeight:600,color:v>0?T.success:v<0?T.danger:T.muted,...(j===0?{borderLeft:`2px solid ${T.border}`}:{})}}>{v>0?"+":""}{v||0}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{padding:"8px 18px",borderTop:`1px solid ${T.border}`,fontSize:11,color:T.muted}}>
                    RC = Royal Class &nbsp;|&nbsp; FC = First Class &nbsp;|&nbsp; PRE = Premium
                  </div>
                </div>
              </div>
            )}

            {/* Snowtravel */}
            {busTab==="snowtravel"&&(
              <div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
                  <BusBarChart data={busClass.filter(d=>d.dataset==="Snowtravel")} metric="bookings" title="BOOKINGS BY BUS CLASS (SNOWTRAVEL)" T={T}/>
                  <BusBarChart data={busClass.filter(d=>d.dataset==="Snowtravel")} metric="revenue" title="REVENUE BY BUS CLASS (SNOWTRAVEL)" T={T}/>
                </div>
                <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden",boxShadow:T.cardShadow}}>
                  <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.08em"}}>SNOWTRAVEL BUS OCCUPANCY</span>
                    <span style={{fontSize:12,color:T.muted}}>{stTrips.length} rows</span>
                  </div>
                  <div style={{overflowX:"auto",maxHeight:480,overflowY:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead>
                        <tr style={{background:T.tableAlt,position:"sticky",top:0}}>
                          {["DEPARTURE","RETURN","DREAM CLASS","FIRST CLASS","SLEEP/ROYAL","TOTAL PAX"].map(h=>(
                            <th key={h} style={{padding:"9px 12px",textAlign:h.includes("DATE")||h==="DEPARTURE"||h==="RETURN"?"left":"right",fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {stTrips.length===0&&<tr><td colSpan={6} style={{padding:20,textAlign:"center",color:T.muted,fontSize:12}}>No Snowtravel bus data</td></tr>}
                        {stTrips.map((r,i)=>(
                          <tr key={i} style={{background:i%2===0?T.card:T.tableAlt,borderBottom:`1px solid ${T.border}`}}
                            onMouseEnter={e=>e.currentTarget.style.background=T.tableHover}
                            onMouseLeave={e=>e.currentTarget.style.background=i%2===0?T.card:T.tableAlt}>
                            <td style={{padding:"8px 12px",color:T.accent,fontWeight:600}}>{r.departure_date}</td>
                            <td style={{padding:"8px 12px",color:T.muted}}>{r.return_date}</td>
                            <td style={{padding:"8px 12px",textAlign:"right"}}>{r.dream_class||0}</td>
                            <td style={{padding:"8px 12px",textAlign:"right"}}>{r.first_class||0}</td>
                            <td style={{padding:"8px 12px",textAlign:"right"}}>{r.sleep_royal_class||0}</td>
                            <td style={{padding:"8px 12px",textAlign:"right",fontWeight:700,color:T.accent}}>{r.total_pax||0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── AI ASSISTANT TAB ── */}
        {tab==="ai"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:16,height:"calc(100vh - 160px)"}}>
            {/* Chat */}
            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:T.cardShadow}}>
              <div style={{padding:"16px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:"#22c55e"}}/>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:T.text}}>TTP AI Assistant</div>
                  <div style={{fontSize:11,color:T.muted}}>Powered by OpenAI &middot; Live Azure SQL data</div>
                </div>
              </div>
              <div ref={chatRef} style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:12}}>
                {msgs.map((m,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                    <div style={{maxWidth:"75%",background:m.role==="user"?T.accent:T.tableAlt,color:m.role==="user"?"#fff":T.text,borderRadius:m.role==="user"?"14px 14px 2px 14px":"14px 14px 14px 2px",padding:"10px 14px",fontSize:13,lineHeight:1.5}}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {aiLoad&&<div style={{display:"flex",gap:4,padding:"8px 0",alignItems:"center"}}>
                  {[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:T.muted,animation:`bounce 1s ${i*0.2}s infinite`}}/>)}
                </div>}
              </div>
              <div style={{padding:"12px 16px",borderTop:`1px solid ${T.border}`,display:"flex",gap:8}}>
                <input value={aiInput} onChange={e=>setAiInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendAI(aiInput)}
                  placeholder="Ask about your data..." style={{flex:1,background:T.inputBg,border:`1px solid ${T.inputBorder}`,borderRadius:8,padding:"9px 14px",fontSize:13,color:T.text,outline:"none"}}
                />
                <button onClick={()=>sendAI(aiInput)} disabled={aiLoad||!aiInput.trim()} style={{background:T.accent,color:"#fff",border:"none",borderRadius:8,padding:"9px 18px",fontSize:13,fontWeight:600,cursor:"pointer",opacity:aiLoad||!aiInput.trim()?0.6:1}}>Send</button>
              </div>
            </div>
            {/* Sidebar */}
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"16px",boxShadow:T.cardShadow}}>
                <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:12}}>QUICK QUESTIONS</div>
                {["What is total revenue for 2026?","Compare Solmar vs Snowtravel bookings","Which month had the most PAX in 2025?","How many cancellations in 2025?","Show revenue breakdown by dataset","What is year-on-year growth?","Average revenue per booking?","Which departure city has most bookings?"].map((q,i)=>(
                  <button key={i} onClick={()=>sendAI(q)} style={{display:"block",width:"100%",textAlign:"left",background:"transparent",border:`1px solid ${T.border}`,borderRadius:7,padding:"8px 12px",fontSize:12,color:T.text,cursor:"pointer",marginBottom:6,lineHeight:1.4}}
                    onMouseEnter={e=>{e.target.style.background=T.tableHover;e.target.style.borderColor=T.accent;}}
                    onMouseLeave={e=>{e.target.style.background="transparent";e.target.style.borderColor=T.border;}}
                  >{q}</button>
                ))}
              </div>
              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"16px",boxShadow:T.cardShadow}}>
                <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>DATA SOURCES</div>
                {["Snowtravel","Solmar","Interbus","Solmar DE"].map(ds=>(
                  <div key={ds} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${T.border}`}}>
                    <span style={{fontSize:13,color:T.text}}>{ds}</span>
                    <span style={{fontSize:11,color:T.success,fontWeight:600,background:`${T.success}22`,padding:"2px 8px",borderRadius:10}}>Live</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── DATA TABLE TAB ── */}
        {tab==="table"&&(
          <div>
            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"14px 18px",marginBottom:16,display:"flex",gap:12,alignItems:"flex-end",flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:200}}>
                <div style={{fontSize:11,color:T.muted,fontWeight:600,marginBottom:4,textTransform:"uppercase"}}>Search</div>
                <input value={tableSearch} onChange={e=>setTableSearch(e.target.value)} placeholder="Search period, dataset..."
                  style={{width:"100%",boxSizing:"border-box",background:T.inputBg,border:`1px solid ${T.inputBorder}`,borderRadius:7,padding:"7px 10px",fontSize:13,color:T.text,outline:"none"}}
                />
              </div>
              {[["Dataset","tableDataset",["Snowtravel","Solmar","Interbus","Solmar DE"]],["Status","tableStatus",["ok","cancelled"]]].map(([l,k,opts])=>(
                <div key={k}>
                  <div style={{fontSize:11,color:T.muted,fontWeight:600,marginBottom:4,textTransform:"uppercase"}}>{l}</div>
                  <select value={k==="tableDataset"?tableDataset:tableStatus} onChange={e=>{k==="tableDataset"?setTableDataset(e.target.value):setTableStatus(e.target.value);}}
                    style={{background:T.inputBg,border:`1px solid ${T.inputBorder}`,borderRadius:7,padding:"7px 10px",fontSize:13,color:T.text,outline:"none",minWidth:130}}>
                    <option value="">All</option>
                    {opts.map(o=><option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <button onClick={loadTable} style={{background:T.accent,color:"#fff",border:"none",borderRadius:7,padding:"8px 16px",fontSize:13,fontWeight:600,cursor:"pointer"}}>Apply</button>
              <button onClick={exportCSV} style={{background:"transparent",border:`1px solid ${T.accent}`,borderRadius:7,padding:"8px 16px",fontSize:13,fontWeight:600,color:T.accent,cursor:"pointer"}}>Export CSV</button>
            </div>
            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden",boxShadow:T.cardShadow}}>
              <div style={{padding:"12px 18px",borderBottom:`1px solid ${T.border}`,fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.08em"}}>
                DATA — YEAR-MONTH SUMMARY
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                  <thead>
                    <tr style={{background:T.tableAlt}}>
                      {["PERIOD","BOOKINGS","PREV BKG","PAX","PREV PAX","REVENUE","PREV REVENUE","DIFF","% DIFF"].map(h=>(
                        <th key={h} style={{padding:"10px 14px",textAlign:h==="PERIOD"?"left":"right",fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tLoad&&<tr><td colSpan={9} style={{padding:20,textAlign:"center",color:T.muted}}>Loading...</td></tr>}
                    {!tLoad&&tableData.filter(r=>{
                      const period=`${MONTHS[(r.month||1)-1]}-${r.year}`.toLowerCase();
                      return !tableSearch||period.includes(tableSearch.toLowerCase());
                    }).slice((tablePage-1)*20,tablePage*20).map((row,i)=>{
                      const d=row.diffRevenue||row.difference||0;
                      const pct=row.diffPct||0;
                      return (
                        <tr key={i} style={{background:i%2===0?T.card:T.tableAlt,borderBottom:`1px solid ${T.border}`}}
                          onMouseEnter={e=>e.currentTarget.style.background=T.tableHover}
                          onMouseLeave={e=>e.currentTarget.style.background=i%2===0?T.card:T.tableAlt}>
                          <td style={{padding:"9px 14px",fontWeight:600,color:T.accent}}>{MONTHS[(row.month||1)-1]}-{row.year}</td>
                          <td style={{padding:"9px 14px",textAlign:"right"}}>{fmtNum(row.currentBookings||row.bookings)}</td>
                          <td style={{padding:"9px 14px",textAlign:"right",color:T.muted}}>{fmtNum(row.previousBookings)}</td>
                          <td style={{padding:"9px 14px",textAlign:"right"}}>{fmtNum(row.currentPax||row.pax)}</td>
                          <td style={{padding:"9px 14px",textAlign:"right",color:T.muted}}>{fmtNum(row.previousPax)}</td>
                          <td style={{padding:"9px 14px",textAlign:"right",fontWeight:600}}>{fmt(row.currentRevenue||row.revenue)}</td>
                          <td style={{padding:"9px 14px",textAlign:"right",color:T.muted}}>{fmt(row.previousRevenue)}</td>
                          <td style={{padding:"9px 14px",textAlign:"right",color:diffColor(d,T),fontWeight:700}}>{d>0?"+":""}{fmt(d)}</td>
                          <td style={{padding:"9px 14px",textAlign:"right",color:diffColor(pct,T),fontWeight:700}}>{d>0?"+":""}{Number(pct||0).toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {tab==="settings"&&isAdmin&&(
          <div>
            {/* Settings sub-tabs */}
            <div style={{display:"flex",gap:0,borderBottom:`1px solid ${T.border}`,marginBottom:20}}>
              {[["users","Users & Access"],["theme","Theme"],["api","API Keys & Integrations"],["about","About"]].map(([k,l])=>(
                <button key={k} onClick={()=>setSettingsTab(k)} style={{background:"transparent",border:"none",borderBottom:`2px solid ${settingsTab===k?T.accent:"transparent"}`,color:settingsTab===k?T.accent:T.muted,padding:"10px 18px",fontSize:14,fontWeight:settingsTab===k?600:400,cursor:"pointer"}}>{l}</button>
              ))}
            </div>

            {/* Users */}
            {settingsTab==="users"&&(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div style={{fontSize:15,fontWeight:700,color:T.text}}>User Accounts ({users.length})</div>
                  <button onClick={()=>setShowAddUser(true)} style={{background:T.accent,color:"#fff",border:"none",borderRadius:8,padding:"8px 18px",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add User
                  </button>
                </div>
                <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden",boxShadow:T.cardShadow}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                    <thead>
                      <tr style={{background:T.tableAlt}}>
                        {["NAME","USERNAME","EMAIL","ROLE","STATUS","ACTIONS"].map(h=>(
                          <th key={h} style={{padding:"11px 16px",textAlign:"left",fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.06em",borderBottom:`1px solid ${T.border}`}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u,i)=>(
                        <tr key={u.id||i} style={{background:i%2===0?T.card:T.tableAlt,borderBottom:`1px solid ${T.border}`}}
                          onMouseEnter={e=>e.currentTarget.style.background=T.tableHover}
                          onMouseLeave={e=>e.currentTarget.style.background=i%2===0?T.card:T.tableAlt}>
                          <td style={{padding:"12px 16px",fontWeight:600,color:T.text}}>{u.name}</td>
                          <td style={{padding:"12px 16px",color:T.muted,fontFamily:"monospace",fontSize:12}}>{u.username}</td>
                          <td style={{padding:"12px 16px",color:T.muted}}>{u.email}</td>
                          <td style={{padding:"12px 16px"}}>
                            <span style={{background:u.role==="admin"?`${T.accent}22`:T.tableAlt,color:u.role==="admin"?T.accent:T.muted,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:12,border:`1px solid ${u.role==="admin"?T.accent:T.border}`}}>{u.role==="admin"?"Admin":"Viewer"}</span>
                          </td>
                          <td style={{padding:"12px 16px"}}>
                            <span style={{background:`${T.success}22`,color:T.success,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:12}}>Active</span>
                          </td>
                          <td style={{padding:"12px 16px"}}>
                            <div style={{display:"flex",gap:6}}>
                              <button onClick={()=>setEditUser({...u})} style={{background:`${T.accent}15`,border:`1px solid ${T.accent}40`,borderRadius:6,color:T.accent,padding:"5px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Edit</button>
                              <button onClick={()=>{if(window.confirm(`Delete ${u.name}?`))setUsers(prev=>prev.filter(x=>x.id!==u.id));}} style={{background:`${T.danger}15`,border:`1px solid ${T.danger}40`,borderRadius:6,color:T.danger,padding:"5px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Theme */}
            {settingsTab==="theme"&&(
              <div>
                <div style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:16}}>Theme Selection</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,maxWidth:600}}>
                  {[["gray","Gray (Light)","#f0f2f5","#ffffff","#0033cc"],["blue","Blue (Dark)","#050d1a","#0a1628","#60a5fa"]].map(([k,l,bg,card,acc])=>(
                    <div key={k} onClick={()=>switchTheme(k)} style={{
                      border:`2px solid ${themeKey===k?T.accent:T.border}`,borderRadius:14,padding:20,cursor:"pointer",
                      background:T.card,boxShadow:themeKey===k?`0 0 0 3px ${T.accent}33`:T.cardShadow,
                      transition:"all 0.2s",
                    }}>
                      {/* Preview */}
                      <div style={{background:bg,borderRadius:8,padding:12,marginBottom:12,border:`1px solid ${T.border}`}}>
                        <div style={{background:card,borderRadius:6,padding:8,marginBottom:6,display:"flex",gap:6}}>
                          {[acc,"#f59e0b","#34d399"].map((c,i)=><div key={i} style={{flex:1,background:c,borderRadius:4,height:16,opacity:0.8}}/>)}
                        </div>
                        <div style={{background:card,borderRadius:4,height:6,opacity:0.6}}/>
                        <div style={{background:card,borderRadius:4,height:4,marginTop:4,opacity:0.4,width:"70%"}}/>
                      </div>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <span style={{fontSize:14,fontWeight:600,color:T.text}}>{l}</span>
                        {themeKey===k&&<span style={{color:T.accent,fontSize:12,fontWeight:700}}>✓ Active</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* API Keys */}
            {settingsTab==="api"&&(
              <div>
                <div style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:16}}>API Integrations</div>
                {[{name:"OpenAI GPT-4o-mini",desc:"Powers the AI Assistant chat",status:"Connected",color:T.success},{name:"Azure SQL Database",desc:"ttpserver.database.windows.net / TTPDatabase",status:"Connected",color:T.success},{name:"Anthropic Claude",desc:"Alternative AI provider",status:"Not configured",color:T.muted}].map((item,i)=>(
                  <div key={i} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"16px 20px",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:T.cardShadow}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:600,color:T.text,marginBottom:3}}>{item.name}</div>
                      <div style={{fontSize:12,color:T.muted}}>{item.desc}</div>
                    </div>
                    <span style={{background:`${item.color}22`,color:item.color,fontSize:12,fontWeight:600,padding:"4px 12px",borderRadius:12,border:`1px solid ${item.color}40`}}>{item.status}</span>
                  </div>
                ))}
              </div>
            )}

            {/* About */}
            {settingsTab==="about"&&(
              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"28px 32px",maxWidth:500,boxShadow:T.cardShadow}}>
                <div style={{width:56,height:56,background:T.accent,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16}}>
                  <img src="/assets/logo.png" alt="TTP" style={{height:34,objectFit:"contain",filter:"brightness(0) invert(1)"}} onError={e=>e.target.style.display="none"}/>
                </div>
                <div style={{fontSize:20,fontWeight:700,color:T.text,marginBottom:4}}>TTP Analytics Platform</div>
                <div style={{fontSize:13,color:T.muted,marginBottom:16}}>Version 1.3 &middot; TTP Services</div>
                <div style={{fontSize:13,color:T.muted,lineHeight:1.8}}>
                  <div>Backend: Node.js + Express on Azure App Service</div>
                  <div>Frontend: React + Vite on GitHub Pages</div>
                  <div>Database: Azure SQL (TTPDatabase)</div>
                  <div>AI: OpenAI GPT-4o-mini</div>
                  <div style={{marginTop:8}}>Auto-refresh: Daily at 00:00 Dubai time</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddUser&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowAddUser(false)}>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:32,width:420,boxShadow:"0 24px 64px rgba(0,0,0,0.4)"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:20}}>Add New User</div>
            {[["Full Name","name","text"],["Username","username","text"],["Email","email","email"],["Password","password","password"]].map(([l,k,t])=>(
              <div key={k} style={{marginBottom:14}}>
                <div style={{fontSize:11,color:T.muted,fontWeight:600,marginBottom:4,textTransform:"uppercase"}}>{l}</div>
                <input type={t} value={newUser[k]||""} onChange={e=>setNewUser(u=>({...u,[k]:e.target.value}))}
                  style={{width:"100%",boxSizing:"border-box",background:T.inputBg,border:`1px solid ${T.inputBorder}`,borderRadius:7,padding:"9px 12px",fontSize:13,color:T.text,outline:"none"}}
                />
              </div>
            ))}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:11,color:T.muted,fontWeight:600,marginBottom:4,textTransform:"uppercase"}}>Role</div>
              <select value={newUser.role} onChange={e=>setNewUser(u=>({...u,role:e.target.value}))}
                style={{width:"100%",background:T.inputBg,border:`1px solid ${T.inputBorder}`,borderRadius:7,padding:"9px 12px",fontSize:13,color:T.text,outline:"none"}}>
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{
                if(!newUser.name||!newUser.username||!newUser.password)return;
                const u={...newUser,id:Date.now(),active:true};
                setUsers(prev=>[...prev,u]);
                setNewUser({name:"",username:"",email:"",password:"",role:"viewer"});
                setShowAddUser(false);
              }} style={{flex:1,background:T.accent,color:"#fff",border:"none",borderRadius:8,padding:10,fontSize:13,fontWeight:600,cursor:"pointer"}}>Add User</button>
              <button onClick={()=>setShowAddUser(false)} style={{flex:1,background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,padding:10,fontSize:13,color:T.muted,cursor:"pointer"}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setEditUser(null)}>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:32,width:420,boxShadow:"0 24px 64px rgba(0,0,0,0.4)"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:20}}>Edit User — {editUser.name}</div>
            {[["Full Name","name","text"],["Email","email","email"]].map(([l,k,t])=>(
              <div key={k} style={{marginBottom:14}}>
                <div style={{fontSize:11,color:T.muted,fontWeight:600,marginBottom:4,textTransform:"uppercase"}}>{l}</div>
                <input type={t} value={editUser[k]||""} onChange={e=>setEditUser(u=>({...u,[k]:e.target.value}))}
                  style={{width:"100%",boxSizing:"border-box",background:T.inputBg,border:`1px solid ${T.inputBorder}`,borderRadius:7,padding:"9px 12px",fontSize:13,color:T.text,outline:"none"}}
                />
              </div>
            ))}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:11,color:T.muted,fontWeight:600,marginBottom:4,textTransform:"uppercase"}}>Role</div>
              <select value={editUser.role} onChange={e=>setEditUser(u=>({...u,role:e.target.value}))}
                style={{width:"100%",background:T.inputBg,border:`1px solid ${T.inputBorder}`,borderRadius:7,padding:"9px 12px",fontSize:13,color:T.text,outline:"none"}}>
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{
                setUsers(prev=>prev.map(u=>u.id===editUser.id?{...editUser}:u));
                setEditUser(null);
              }} style={{flex:1,background:T.accent,color:"#fff",border:"none",borderRadius:8,padding:10,fontSize:13,fontWeight:600,cursor:"pointer"}}>Save Changes</button>
              <button onClick={()=>setEditUser(null)} style={{flex:1,background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,padding:10,fontSize:13,color:T.muted,cursor:"pointer"}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Status bar */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:T.headerBg,borderTop:`1px solid ${T.headerBorder}`,padding:"5px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11,zIndex:50}}>
        <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{color:T.muted}}>Last sync: <span style={{color:T.accent,fontWeight:600}}>{lastR} Dubai</span></span>
          {[{k:"Solmar",v:10345},{k:"Snowtravel",v:6720},{k:"Interbus",v:2824},{k:"Solmar DE",v:64}].map(({k,v})=>(
            <span key={k} style={{color:T.muted2}}><span style={{color:T.text,fontWeight:600}}>{k}</span>: {fmtNum(v)}</span>
          ))}
        </div>
        <span style={{color:T.muted2}}>Auto-refresh 00:00 Dubai &middot; TTP Analytics v1.3</span>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .kpi-grid { grid-template-columns: 1fr !important; }
          .chart-grid { grid-template-columns: 1fr !important; }
        }
        @keyframes bounce { 0%,80%,100%{transform:scale(0)} 40%{transform:scale(1)} }
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#94a3b855;border-radius:10px}
      `}</style>
    </div>
  );
}
