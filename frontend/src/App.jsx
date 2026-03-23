import { useState, useEffect, useRef, useCallback } from "react";
import Login from "./components/Login.jsx";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const YEAR_COLORS = { 2023:"#8b5cf6", 2024:"#f59e0b", 2025:"#10b981", 2026:"#0033cc" };
const BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://localhost:3001";

const THEMES = {
  gray: {
    name:"Professional Gray", bg:"#f4f5f7", card:"#ffffff", border:"#e2e5ea",
    accent:"#0033cc", accentLt:"#eef1ff", text:"#1a1d23", muted:"#6b7280", muted2:"#9ca3af",
    success:"#059669", successLt:"#ecfdf5", danger:"#dc2626", dangerLt:"#fef2f2",
    warning:"#d97706", warningLt:"#fffbeb", header:"#ffffff", rowAlt:"#f8f9fb",
    gridLine:"#f0f1f3", inputBg:"#f9fafb",
  },
  blue: {
    name:"Light Blue", bg:"#eff6ff", card:"#ffffff", border:"#bfdbfe",
    accent:"#1d4ed8", accentLt:"#dbeafe", text:"#1e3a8a", muted:"#3b82f6", muted2:"#93c5fd",
    success:"#059669", successLt:"#ecfdf5", danger:"#dc2626", dangerLt:"#fef2f2",
    warning:"#d97706", warningLt:"#fffbeb", header:"#1d4ed8", rowAlt:"#eff6ff",
    gridLine:"#dbeafe", inputBg:"#f0f9ff",
  },
};

const fmtEur = v => {
  const n = Math.round(v||0);
  if(n>=1000000) return `€ ${(n/1000000).toFixed(2)}M`;
  if(n>=1000) return `€ ${(n/1000).toFixed(0)}K`;
  return `€ ${n.toLocaleString("nl-BE")}`;
};
const fmtNum = v => Math.round(v||0).toLocaleString("nl-BE");
const fmtPct = v => { if(v==null||isNaN(v)) return "—"; const n=parseFloat(v); return `${n>0?"+":""}${n.toFixed(1)} %`; };
const dubaiTime = () => new Date().toLocaleTimeString("en-GB",{timeZone:"Asia/Dubai",hour:"2-digit",minute:"2-digit"});
const normTr = t => (t||"").toLowerCase().replace("owntransport","own transport").trim();

async function apiFetch(path, params={}, token) {
  const tk = token||localStorage.getItem("ttp_token");
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k,v])=>{ if(Array.isArray(v)) v.forEach(i=>qs.append(k,i)); else if(v!==undefined&&v!=="") qs.set(k,v); });
  const url = `${BASE}${path}${qs.toString()?"?"+qs.toString():""}`;
  const r = await fetch(url,{headers:{Authorization:`Bearer ${tk}`}});
  if(r.status===401) throw new Error("UNAUTH");
  return r.json();
}

function buildParams(f={}) {
  const p={};
  if(f.departureDateFrom) p.departureDateFrom=f.departureDateFrom;
  if(f.departureDateTo) p.departureDateTo=f.departureDateTo;
  if(f.bookingDateFrom) p.bookingDateFrom=f.bookingDateFrom;
  if(f.bookingDateTo) p.bookingDateTo=f.bookingDateTo;
  if(f.datasets?.length) p.dataset=f.datasets;
  if(f.statuses?.length) p.status=f.statuses;
  if(f.transports?.length) p.transportType=f.transports;
  return p;
}

function Tip({x,y,title,value,T}) {
  if(!x||!y) return null;
  return <div style={{position:"fixed",left:x+14,top:y-54,pointerEvents:"none",zIndex:9999,background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 14px",fontSize:12,color:T.text,boxShadow:"0 4px 16px rgba(0,0,0,0.12)",whiteSpace:"nowrap"}}>
    <div style={{color:T.accent,fontWeight:700,marginBottom:2,fontSize:11}}>{title}</div>
    <div style={{fontWeight:600}}>{value}</div>
  </div>;
}

function useWidth(ref) {
  const [w,setW]=useState(0);
  useEffect(()=>{ if(!ref.current) return; const obs=new ResizeObserver(e=>setW(Math.round(e[0].contentRect.width))); obs.observe(ref.current); return()=>obs.disconnect(); },[ref]);
  return w;
}

function drawGrid(ctx,pad,W,H,maxV,isCur,T) {
  ctx.strokeStyle=T.gridLine; ctx.lineWidth=1;
  [0,0.25,0.5,0.75,1].forEach(t=>{
    const y=pad.top+t*(H-pad.top-pad.bottom);
    ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(W-pad.right,y); ctx.stroke();
    const v=maxV*(1-t);
    ctx.fillStyle=T.muted2; ctx.font="10px Inter,system-ui,sans-serif"; ctx.textAlign="right";
    ctx.fillText(isCur?(v>=1e6?`€${(v/1e6).toFixed(1)}M`:v>=1000?`€${Math.round(v/1000)}K`:`€${Math.round(v)}`):fmtNum(v),pad.left-5,y+3);
  });
}

function LineChart({data,title,metric="revenue",isCur=false,T}) {
  const wrap=useRef(null),ref=useRef(null),pts=useRef([]);
  const [tt,setTt]=useState(null); const w=useWidth(wrap);
  useEffect(()=>{
    const c=ref.current; if(!c||!data?.length) return;
    const dpr=window.devicePixelRatio||1,rect=c.getBoundingClientRect();
    const W=rect.width||500,H=200;
    c.width=W*dpr; c.height=H*dpr;
    const ctx=c.getContext("2d"); ctx.scale(dpr,dpr); ctx.clearRect(0,0,W,H);
    const pad={top:28,right:16,bottom:36,left:isCur?66:52};
    const years=[...new Set(data.map(d=>+d.year))].sort();
    const byY={}; years.forEach(y=>{byY[y]={};}); data.forEach(d=>{if(byY[+d.year]) byY[+d.year][+d.month]=(+d[metric]||0);});
    const allV=data.map(d=>+d[metric]||0).filter(Boolean); if(!allV.length) return;
    const maxV=Math.max(...allV)*1.12;
    const scX=m=>pad.left+(m-1)*(W-pad.left-pad.right)/11;
    const scY=v=>pad.top+(1-v/maxV)*(H-pad.top-pad.bottom);
    drawGrid(ctx,pad,W,H,maxV,isCur,T);
    ctx.fillStyle=T.muted2; ctx.font="10px Inter,system-ui,sans-serif"; ctx.textAlign="center";
    MONTHS.forEach((m,i)=>ctx.fillText(m,scX(i+1),H-pad.bottom+14));
    pts.current=[];
    years.forEach((y,yi)=>{
      const color=YEAR_COLORS[y]||["#0033cc","#10b981","#f59e0b","#8b5cf6"][yi%4];
      ctx.strokeStyle=color; ctx.lineWidth=2.5; ctx.lineJoin="round"; ctx.beginPath(); let first=true;
      for(let m=1;m<=12;m++){const v=byY[y][m];if(!v)continue;if(first){ctx.moveTo(scX(m),scY(v));first=false;}else ctx.lineTo(scX(m),scY(v));}
      ctx.stroke();
      for(let m=1;m<=12;m++){const v=byY[y][m];if(!v)continue;const x=scX(m),yy=scY(v);ctx.beginPath();ctx.arc(x,yy,3.5,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();pts.current.push({x,y:yy,year:y,month:MONTHS[m-1],value:v});}
    });
    let lx=pad.left; years.forEach((y,yi)=>{const color=YEAR_COLORS[y]||["#0033cc","#10b981","#f59e0b","#8b5cf6"][yi%4];ctx.fillStyle=color;ctx.fillRect(lx,6,14,4);ctx.fillStyle=T.muted;ctx.font="10px Inter,system-ui,sans-serif";ctx.textAlign="left";ctx.fillText(String(y),lx+18,13);lx+=54;});
  },[data,metric,w,T]);
  const onMove=useCallback(e=>{
    const c=ref.current;if(!c)return;const r=c.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
    const mx=(e.clientX-r.left)*(c.width/r.width/dpr),my=(e.clientY-r.top)*(c.height/r.height/dpr);
    let near=null,minD=28; pts.current.forEach(p=>{const d=Math.sqrt((p.x-mx)**2+(p.y-my)**2);if(d<minD){minD=d;near=p;}});
    if(near) setTt({x:e.clientX,y:e.clientY,title:`${near.month} ${near.year}`,value:isCur?fmtEur(near.value):fmtNum(near.value)});
    else setTt(null);
  },[isCur]);
  return <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"16px 18px"}}>
    {title&&<div style={{fontSize:11,fontWeight:600,color:T.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12}}>{title}</div>}
    <div ref={wrap} style={{position:"relative"}}><canvas ref={ref} style={{width:"100%",height:200,display:"block",cursor:"crosshair"}} onMouseMove={onMove} onMouseLeave={()=>setTt(null)}/><Tip {...tt} T={T}/></div>
  </div>;
}

function BarChart({data,title,metric="bookings",T}) {
  const wrap=useRef(null),ref=useRef(null),bars=useRef([]);
  const [tt,setTt]=useState(null); const w=useWidth(wrap);
  useEffect(()=>{
    const c=ref.current; if(!c||!data?.length) return;
    const dpr=window.devicePixelRatio||1,rect=c.getBoundingClientRect();
    const W=rect.width||500,H=200;
    c.width=W*dpr; c.height=H*dpr;
    const ctx=c.getContext("2d"); ctx.scale(dpr,dpr); ctx.clearRect(0,0,W,H);
    const pad={top:28,right:16,bottom:36,left:52};
    const years=[...new Set(data.map(d=>+d.year))].sort();
    const byY={}; years.forEach(y=>{byY[y]={};}); data.forEach(d=>{if(byY[+d.year]) byY[+d.year][+d.month]=(+d[metric]||0);});
    const allV=data.map(d=>+d[metric]||0); const maxV=Math.max(...allV,1)*1.12;
    const slotW=(W-pad.left-pad.right)/12; const bW=Math.max(3,(slotW/(years.length+0.5))-2);
    const sy=v=>pad.top+(1-v/maxV)*(H-pad.top-pad.bottom);
    drawGrid(ctx,pad,W,H,maxV,false,T);
    ctx.fillStyle=T.muted2; ctx.font="10px Inter,system-ui,sans-serif"; ctx.textAlign="center";
    MONTHS.forEach((m,i)=>ctx.fillText(m,pad.left+i*slotW+slotW/2,H-pad.bottom+14));
    bars.current=[];
    years.forEach((y,yi)=>{
      const color=YEAR_COLORS[y]||["#0033cc","#10b981","#f59e0b","#8b5cf6"][yi%4];
      for(let m=1;m<=12;m++){const v=byY[y][m]||0;if(!v)continue;const x=pad.left+(m-1)*slotW+yi*(bW+2)+(slotW-years.length*(bW+2))/2;const barH=(v/maxV)*(H-pad.top-pad.bottom);ctx.fillStyle=color+"dd";ctx.fillRect(x,sy(v),bW,barH);bars.current.push({x,y:sy(v),width:bW,height:barH,year:y,month:MONTHS[m-1],value:v});}
    });
    let lx=pad.left; years.forEach((y,yi)=>{const color=YEAR_COLORS[y]||["#0033cc","#10b981","#f59e0b","#8b5cf6"][yi%4];ctx.fillStyle=color;ctx.fillRect(lx,6,14,9);ctx.fillStyle=T.muted;ctx.font="10px Inter,system-ui,sans-serif";ctx.textAlign="left";ctx.fillText(String(y),lx+18,13);lx+=54;});
  },[data,metric,w,T]);
  const onMove=useCallback(e=>{
    const c=ref.current;if(!c)return;const r=c.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
    const mx=(e.clientX-r.left)*(c.width/r.width/dpr),my=(e.clientY-r.top)*(c.height/r.height/dpr);
    const bar=bars.current.find(b=>mx>=b.x&&mx<=b.x+b.width&&my>=b.y&&my<=b.y+b.height);
    if(bar) setTt({x:e.clientX,y:e.clientY,title:`${bar.month} ${bar.year}`,value:`${fmtNum(bar.value)} ${metric}`});
    else setTt(null);
  },[metric]);
  return <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"16px 18px"}}>
    {title&&<div style={{fontSize:11,fontWeight:600,color:T.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12}}>{title}</div>}
    <div ref={wrap} style={{position:"relative"}}><canvas ref={ref} style={{width:"100%",height:200,display:"block",cursor:"crosshair"}} onMouseMove={onMove} onMouseLeave={()=>setTt(null)}/><Tip {...tt} T={T}/></div>
  </div>;
}

function DonutChart({data,title,T}) {
  const wrap=useRef(null),ref=useRef(null),segs=useRef([]);
  const [tt,setTt]=useState(null); const w=useWidth(wrap);
  const merged=(data||[]).reduce((acc,item)=>{
    const key=normTr(item.transport_type);
    const ex=acc.find(x=>normTr(x.transport_type)===key);
    if(ex){ex.bookings+=(+item.bookings||0);}
    else acc.push({...item,transport_type:key});
    return acc;
  },[]).filter(d=>d.bookings>0).sort((a,b)=>b.bookings-a.bookings);
  const COLORS=["#0033cc","#10b981","#f59e0b","#ef4444","#8b5cf6"];
  useEffect(()=>{
    const c=ref.current;if(!c||!merged.length)return;
    const dpr=window.devicePixelRatio||1,rect=c.getBoundingClientRect();
    const W=rect.width||280,H=220;
    c.width=W*dpr;c.height=H*dpr;
    const ctx=c.getContext("2d");ctx.scale(dpr,dpr);ctx.clearRect(0,0,W,H);
    const total=merged.reduce((s,d)=>s+(+d.bookings||0),0);
    const R=Math.min(W*0.38,H*0.42)-6,cx=W*0.42,cy=H/2;
    let angle=-Math.PI/2; segs.current=[];
    merged.forEach((d,i)=>{
      const slice=(+d.bookings||0)/total*Math.PI*2;
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,R,angle,angle+slice);
      ctx.fillStyle=COLORS[i%COLORS.length];ctx.fill();
      ctx.strokeStyle=T.card;ctx.lineWidth=2.5;ctx.stroke();
      segs.current.push({start:angle,end:angle+slice,label:d.transport_type,value:+d.bookings,pct:Math.round((+d.bookings||0)/total*100)});
      angle+=slice;
    });
    ctx.beginPath();ctx.arc(cx,cy,R*0.56,0,Math.PI*2);ctx.fillStyle=T.card;ctx.fill();
    ctx.fillStyle=T.text;ctx.font=`bold 14px Inter,system-ui,sans-serif`;ctx.textAlign="center";
    ctx.fillText(fmtNum(total),cx,cy+4);
    ctx.fillStyle=T.muted2;ctx.font="10px Inter,system-ui,sans-serif";ctx.fillText("bookings",cx,cy+17);
    const lx=W*0.68,ly0=18;
    merged.forEach((d,i)=>{
      const pct=Math.round((+d.bookings||0)/total*100);
      const lbl=d.transport_type.replace("own transport","own").slice(0,12);
      ctx.fillStyle=COLORS[i%COLORS.length];ctx.fillRect(lx,ly0+i*20,9,9);
      ctx.fillStyle=T.muted;ctx.font="10px Inter,system-ui,sans-serif";ctx.textAlign="left";
      ctx.fillText(`${lbl} (${pct}%)`,lx+13,ly0+i*20+8);
    });
  },[merged,w,T]);
  const onMove=useCallback(e=>{
    const c=ref.current;if(!c)return;
    const r=c.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
    const W=c.width/dpr,H=c.height/dpr,R=Math.min(W*0.38,H*0.42)-6,cx=W*0.42,cy=H/2;
    const mx=e.clientX-r.left,my=e.clientY-r.top,dx=mx-cx,dy=my-cy,rr=Math.sqrt(dx*dx+dy*dy);
    if(rr<R*0.56||rr>R){setTt(null);return;}
    let ang=Math.atan2(dy,dx);if(ang<-Math.PI/2)ang+=Math.PI*2;
    const seg=segs.current.find(s=>ang>=s.start&&ang<=s.end);
    if(seg) setTt({x:e.clientX,y:e.clientY,title:seg.label,value:`${fmtNum(seg.value)} bookings (${seg.pct}%)`});
    else setTt(null);
  },[]);
  return <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"16px 18px"}}>
    {title&&<div style={{fontSize:11,fontWeight:600,color:T.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12}}>{title}</div>}
    <div ref={wrap} style={{position:"relative"}}><canvas ref={ref} style={{width:"100%",height:220,display:"block",cursor:"crosshair"}} onMouseMove={onMove} onMouseLeave={()=>setTt(null)}/><Tip {...tt} T={T}/></div>
  </div>;
}

function BusBarChart({data,title,metric="bookings",T}) {
  const wrap=useRef(null),ref=useRef(null),bars=useRef([]);
  const [tt,setTt]=useState(null); const w=useWidth(wrap);
  const DS={Snowtravel:"#0033cc",Solmar:"#10b981",Interbus:"#f59e0b","Solmar DE":"#ef4444"};
  useEffect(()=>{
    const c=ref.current;if(!c||!data?.length)return;
    const dpr=window.devicePixelRatio||1,rect=c.getBoundingClientRect();
    const W=rect.width||400,H=230;
    c.width=W*dpr;c.height=H*dpr;
    const ctx=c.getContext("2d");ctx.scale(dpr,dpr);ctx.clearRect(0,0,W,H);
    const pad={top:28,right:16,bottom:54,left:60};
    const classes=[...new Set(data.map(d=>d.bus_class))].filter(Boolean);
    const datasets=[...new Set(data.map(d=>d.dataset))].filter(Boolean);
    const byCD={};
    data.forEach(d=>{if(!byCD[d.bus_class])byCD[d.bus_class]={};byCD[d.bus_class][d.dataset]=+d[metric]||0;});
    const maxV=Math.max(...data.map(d=>+d[metric]||0),1)*1.15;
    const slotW=(W-pad.left-pad.right)/classes.length;
    const bW=Math.max(6,(slotW/(datasets.length+0.5))-2);
    const sy=v=>pad.top+(1-v/maxV)*(H-pad.top-pad.bottom);
    drawGrid(ctx,pad,W,H,maxV,metric==="revenue",T);
    bars.current=[];
    classes.forEach((cls,ci)=>{
      datasets.forEach((ds,di)=>{
        const v=byCD[cls]?.[ds]||0;if(!v)return;
        const x=pad.left+ci*slotW+di*(bW+2)+(slotW-datasets.length*(bW+2))/2;
        const barH=(v/maxV)*(H-pad.top-pad.bottom);
        ctx.fillStyle=(DS[ds]||"#94a3b8")+"dd";ctx.fillRect(x,sy(v),bW,barH);
        bars.current.push({x,y:sy(v),width:bW,height:barH,cls,ds,value:v});
      });
      const shortCls=cls.replace(" Class","").replace("Sleep/Royal","S/R");
      ctx.fillStyle=T.muted2;ctx.font="10px Inter,system-ui,sans-serif";ctx.textAlign="center";
      ctx.fillText(shortCls,pad.left+ci*slotW+slotW/2,H-pad.bottom+14);
    });
    let lx=pad.left;
    datasets.forEach(ds=>{
      ctx.fillStyle=DS[ds]||"#94a3b8";ctx.fillRect(lx,H-22,9,9);
      ctx.fillStyle=T.muted;ctx.font="10px Inter,system-ui,sans-serif";ctx.textAlign="left";
      ctx.fillText(ds,lx+13,H-14);lx+=ctx.measureText(ds).width+22;
    });
  },[data,metric,w,T]);
  const onMove=useCallback(e=>{
    const c=ref.current;if(!c)return;const r=c.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
    const mx=(e.clientX-r.left)*(c.width/r.width/dpr),my=(e.clientY-r.top)*(c.height/r.height/dpr);
    const bar=bars.current.find(b=>mx>=b.x&&mx<=b.x+b.width&&my>=b.y&&my<=b.y+b.height);
    if(bar) setTt({x:e.clientX,y:e.clientY,title:`${bar.cls} — ${bar.ds}`,value:metric==="revenue"?fmtEur(bar.value):fmtNum(bar.value)+" "+metric});
    else setTt(null);
  },[metric]);
  return <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"16px 18px"}}>
    {title&&<div style={{fontSize:11,fontWeight:600,color:T.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12}}>{title}</div>}
    <div ref={wrap} style={{position:"relative"}}><canvas ref={ref} style={{width:"100%",height:230,display:"block",cursor:"crosshair"}} onMouseMove={onMove} onMouseLeave={()=>setTt(null)}/><Tip {...tt} T={T}/></div>
  </div>;
}

function MultiSel({label,options=[],value=[],onChange,T}) {
  const [open,setOpen]=useState(false),ref=useRef(null);
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const sel=Array.isArray(value)?value:[];
  const display=sel.length===0?"All":sel.length===1?sel[0]:`${sel.length} selected`;
  return <div ref={ref} style={{position:"relative",minWidth:130}}>
    {label&&<div style={{fontSize:11,fontWeight:600,color:T.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</div>}
    <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",background:T.inputBg,border:`1px solid ${open?T.accent:T.border}`,borderRadius:6,color:sel.length?T.text:T.muted2,padding:"7px 10px",fontSize:12,cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",outline:"none"}}>
      <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{display}</span>
      <span style={{color:T.muted2,fontSize:9,marginLeft:4}}>{open?"▲":"▼"}</span>
    </button>
    {open&&<div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,zIndex:1000,background:T.card,border:`1px solid ${T.border}`,borderRadius:6,maxHeight:200,overflowY:"auto",boxShadow:"0 8px 24px rgba(0,0,0,0.1)"}}>
      <div onClick={()=>onChange([])} style={{padding:"8px 12px",fontSize:12,cursor:"pointer",color:sel.length===0?T.accent:T.muted,background:sel.length===0?T.accentLt:"transparent",fontWeight:sel.length===0?600:400}}>All</div>
      {options.map(opt=>{const active=sel.includes(opt);return <div key={opt} onClick={()=>onChange(active?sel.filter(v=>v!==opt):[...sel,opt])} style={{padding:"8px 12px",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:8,background:active?T.accentLt:"transparent",color:active?T.accent:T.text}}>
        <span style={{width:14,height:14,border:`1.5px solid ${active?T.accent:T.border}`,borderRadius:3,background:active?T.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{active&&<span style={{color:"#fff",fontSize:9,fontWeight:700}}>✓</span>}</span>
        {opt}
      </div>;})}
    </div>}
  </div>;
}

function KpiCard({title,current,previous,diff,pct,isCur,loading,icon,T}) {
  const fmt=v=>isCur?fmtEur(v||0):fmtNum(v||0);const up=(diff||0)>=0;
  return <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"18px 20px",flex:1,minWidth:0,boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
      <div style={{width:30,height:30,background:T.accentLt,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{icon}</div>
      <span style={{fontSize:11,fontWeight:600,color:T.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>{title}</span>
    </div>
    {loading?<div style={{height:32,background:T.border,borderRadius:6,marginBottom:8,animation:"pulse 1.5s infinite"}}/>:<>
      <div style={{fontSize:26,fontWeight:700,color:T.accent,marginBottom:3,letterSpacing:"-0.5px"}}>{fmt(current)}</div>
      <div style={{fontSize:11,color:T.muted2,marginBottom:8}}>prev year: {fmt(previous)}</div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:12,fontWeight:600,color:up?T.success:T.danger}}>{up?"▲":"▼"} {fmt(Math.abs(diff||0))}</span>
        {pct!=null&&<span style={{fontSize:11,background:up?T.successLt:T.dangerLt,color:up?T.success:T.danger,borderRadius:20,padding:"2px 8px",fontWeight:600}}>{up?"+":""}{pct}%</span>}
      </div>
    </>}
  </div>;
}

function PagBtn({label,onClick,disabled,active,T}) {
  return <button onClick={onClick} disabled={disabled} style={{minWidth:28,height:28,background:active?T.accent:"transparent",border:`1px solid ${active?T.accent:T.border}`,borderRadius:5,color:active?"#fff":disabled?T.muted2:T.muted,fontSize:12,cursor:disabled?"default":"pointer",opacity:disabled?0.4:1,padding:"0 6px"}}>{label}</button>;
}

function YMTable({data,T}) {
  const [page,setPage]=useState(0),[perPage,setPerPage]=useState(15),[hov,setHov]=useState(null);
  const rows=[...(data||[])].sort((a,b)=>b.year!==a.year?b.year-a.year:b.month-a.month);
  const total=rows.length,paged=rows.slice(page*perPage,(page+1)*perPage),totalPages=Math.max(1,Math.ceil(total/perPage));
  const TH=({c,a="right"})=><th style={{padding:"9px 12px",color:T.muted,fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:"0.05em",textAlign:a,borderBottom:`1px solid ${T.border}`,background:T.rowAlt,whiteSpace:"nowrap"}}>{c}</th>;
  const TD=({c,col,bold,a="right"})=><td style={{padding:"8px 12px",textAlign:a,color:col||T.text,fontWeight:bold?600:400,whiteSpace:"nowrap",fontSize:12}}>{c}</td>;
  return <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr>
          <TH c="Period" a="left"/><TH c="Last Year" a="left"/>
          <TH c="Bookings"/><TH c="Prev Bkg"/><TH c="PAX"/><TH c="Prev PAX"/>
          <TH c="Revenue"/><TH c="Prev Revenue"/><TH c="Difference"/><TH c="% Diff"/>
        </tr></thead>
        <tbody>{paged.map((row,i)=>{
          const diffRev=(row.currentRevenue||0)-(row.previousRevenue||0);
          const pctRev=row.previousRevenue?(diffRev/row.previousRevenue*100):null;
          const up=diffRev>=0;
          return <tr key={i} onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)}
            style={{background:hov===i?T.accentLt:i%2===0?T.card:T.rowAlt,borderBottom:`1px solid ${T.border}`,transition:"background 0.1s"}}>
            <TD c={`${MONTHS[(row.month||1)-1]}-${row.year||2026}`} a="left" bold/>
            <TD c={`${MONTHS[(row.month||1)-1]}-${(row.year||2026)-1}`} a="left" col={T.muted}/>
            <TD c={fmtNum(row.currentBookings)} bold/><TD c={fmtNum(row.previousBookings)} col={T.muted}/>
            <TD c={fmtNum(row.currentPax)} bold/><TD c={fmtNum(row.previousPax)} col={T.muted}/>
            <TD c={fmtEur(row.currentRevenue)} bold/><TD c={fmtEur(row.previousRevenue)} col={T.muted}/>
            <TD c={`${up?"+":""}${fmtEur(diffRev)}`} col={up?T.success:T.danger} bold/>
            <TD c={fmtPct(pctRev)} col={up?T.success:T.danger} bold/>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",borderTop:`1px solid ${T.border}`,flexWrap:"wrap",gap:8}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:12,color:T.muted2}}>Rows:</span>
        <select value={perPage} onChange={e=>{setPerPage(+e.target.value);setPage(0);}} style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:5,color:T.text,padding:"3px 8px",fontSize:12,outline:"none"}}>
          {[10,15,25,50].map(n=><option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:4}}>
        <PagBtn label="«" onClick={()=>setPage(0)} disabled={page===0} T={T}/>
        <PagBtn label="‹" onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} T={T}/>
        {[...Array(Math.min(5,totalPages))].map((_,i)=>{const pg=Math.max(0,Math.min(page-2,totalPages-5))+i;return <PagBtn key={pg} label={pg+1} onClick={()=>setPage(pg)} active={pg===page} T={T}/>;} )}
        <PagBtn label="›" onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))} disabled={page>=totalPages-1} T={T}/>
        <PagBtn label="»" onClick={()=>setPage(totalPages-1)} disabled={page>=totalPages-1} T={T}/>
      </div>
      <span style={{fontSize:12,color:T.muted2}}>{total} rows</span>
    </div>
  </div>;
}

function BusTripsTable({rows,loading,T}) {
  const [page,setPage]=useState(0),[hov,setHov]=useState(null);
  const PER=25; useEffect(()=>setPage(0),[rows]);
  if(loading) return <div style={{textAlign:"center",padding:40,color:T.muted}}>Loading...</div>;
  if(!rows?.length) return <div style={{textAlign:"center",padding:40,color:T.muted2}}>
    <div style={{fontSize:32,marginBottom:10}}>📋</div>
    <div style={{fontWeight:600,color:T.muted,marginBottom:6}}>No bus trip data</div>
    <div style={{fontSize:12}}>Click Apply without dates to load all trips from 2022.</div>
  </div>;
  const paged=rows.slice(page*PER,(page+1)*PER),totalPages=Math.max(1,Math.ceil(rows.length/PER));
  const TH=({c,border,bg})=><th style={{padding:"8px 9px",color:T.muted,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"center",borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap",borderLeft:border?`2px solid ${border}`:undefined,background:bg||T.rowAlt}}>{c}</th>;
  const TD=({v,border,bold})=><td style={{padding:"7px 9px",textAlign:"right",color:T.text,fontWeight:bold?700:400,borderLeft:border?`2px solid ${border}`:undefined,fontSize:12}}>{v??0}</td>;
  const DD=({v,border})=>{const n=parseInt(v);return isNaN(n)?<td style={{padding:"7px 9px",textAlign:"right",color:T.muted2,borderLeft:border?`2px solid ${border}`:undefined,fontSize:12}}>—</td>:<td style={{padding:"7px 9px",textAlign:"right",color:n===0?T.muted2:n>0?T.success:T.danger,fontWeight:700,borderLeft:border?`2px solid ${border}`:undefined,fontSize:12}}>{n>0?"+":""}{n}</td>;};
  return <div>
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead>
          <tr>
            <th colSpan={2} style={{padding:"8px 9px",color:T.muted,fontWeight:600,fontSize:10,textTransform:"uppercase",borderBottom:`1px solid ${T.border}`,textAlign:"center",background:T.rowAlt}}>Trip</th>
            <th colSpan={4} style={{padding:"8px 9px",color:"#1d4ed8",fontWeight:700,fontSize:10,textTransform:"uppercase",borderBottom:`1px solid ${T.border}`,borderLeft:"2px solid #3b82f6",textAlign:"center",background:"#eff6ff"}}>Outbound ↗</th>
            <th colSpan={4} style={{padding:"8px 9px",color:"#15803d",fontWeight:700,fontSize:10,textTransform:"uppercase",borderBottom:`1px solid ${T.border}`,borderLeft:"2px solid #22c55e",textAlign:"center",background:"#f0fdf4"}}>Return ↙</th>
            <th colSpan={4} style={{padding:"8px 9px",color:"#b45309",fontWeight:700,fontSize:10,textTransform:"uppercase",borderBottom:`1px solid ${T.border}`,borderLeft:"2px solid #f59e0b",textAlign:"center",background:"#fffbeb"}}>Difference</th>
          </tr>
          <tr style={{background:T.rowAlt}}>
            <TH c="Start"/><TH c="End"/>
            <TH c="RC" border="#3b82f6"/><TH c="FC"/><TH c="PRE"/><TH c="Total"/>
            <TH c="RC" border="#22c55e"/><TH c="FC"/><TH c="PRE"/><TH c="Total"/>
            <TH c="RC" border="#f59e0b"/><TH c="FC"/><TH c="PRE"/><TH c="Total"/>
          </tr>
        </thead>
        <tbody>{paged.map((row,idx)=><tr key={idx} onMouseEnter={()=>setHov(idx)} onMouseLeave={()=>setHov(null)}
          style={{background:hov===idx?T.accentLt:idx%2===0?T.card:T.rowAlt,borderBottom:`1px solid ${T.border}`,transition:"background 0.1s"}}>
          <td style={{padding:"7px 9px",color:T.accent,fontWeight:600,whiteSpace:"nowrap",fontSize:12}}>{row.StartDate}</td>
          <td style={{padding:"7px 9px",color:T.muted,whiteSpace:"nowrap",fontSize:12}}>{row.EndDate}</td>
          <TD v={row.ORC} border="#3b82f6"/><TD v={row.OFC}/><TD v={row.OPRE}/><TD v={row.OTotal} bold/>
          <TD v={row.RRC} border="#22c55e"/><TD v={row.RFC}/><TD v={row.RPRE}/><TD v={row.RTotal} bold/>
          <DD v={row.RC_Diff} border="#f59e0b"/><DD v={row.FC_Diff}/><DD v={row.PRE_Diff}/><DD v={row.Total_Difference}/>
        </tr>)}</tbody>
      </table>
    </div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",borderTop:`1px solid ${T.border}`,fontSize:12}}>
      <span style={{color:T.muted2}}>RC=Royal Class · FC=First Class · PRE=Premium · {rows.length} trips</span>
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        <PagBtn label="‹" onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} T={T}/>
        <span style={{color:T.muted,fontSize:11}}>Page {page+1} / {totalPages}</span>
        <PagBtn label="›" onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))} disabled={page>=totalPages-1} T={T}/>
      </div>
    </div>
  </div>;
}

function SnowTable({rows,loading,T}) {
  const [hov,setHov]=useState(null);
  if(loading) return <div style={{textAlign:"center",padding:40,color:T.muted}}>Loading...</div>;
  if(!rows?.length) return <div style={{textAlign:"center",padding:40,color:T.muted2}}>No data. Click Apply to load.</div>;
  return <div style={{overflowX:"auto"}}>
    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
      <thead><tr style={{background:T.rowAlt,borderBottom:`1px solid ${T.border}`}}>
        {["Departure","Return","Dream Class","First Class","Sleep/Royal","Total PAX"].map((h,i)=><th key={i} style={{padding:"9px 12px",color:T.muted,fontWeight:600,fontSize:11,textTransform:"uppercase",textAlign:i<2?"left":"right",whiteSpace:"nowrap"}}>{h}</th>)}
      </tr></thead>
      <tbody>{rows.map((row,idx)=><tr key={idx} onMouseEnter={()=>setHov(idx)} onMouseLeave={()=>setHov(null)}
        style={{background:hov===idx?T.accentLt:idx%2===0?T.card:T.rowAlt,borderBottom:`1px solid ${T.border}`,transition:"background 0.1s"}}>
        <td style={{padding:"7px 12px",color:T.accent,fontWeight:600}}>{row.departure_date}</td>
        <td style={{padding:"7px 12px",color:T.muted}}>{row.return_date}</td>
        <td style={{padding:"7px 12px",textAlign:"right"}}>{row.dream_class||0}</td>
        <td style={{padding:"7px 12px",textAlign:"right"}}>{row.first_class||0}</td>
        <td style={{padding:"7px 12px",textAlign:"right"}}>{row.sleep_royal||0}</td>
        <td style={{padding:"7px 12px",textAlign:"right",fontWeight:700,color:T.accent}}>{row.total_pax||0}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}

function UserModal({user,onSave,onClose,T}) {
  const [form,setForm]=useState({name:user?.name||"",username:user?.username||"",email:user?.email||"",password:"",role:user?.role||"viewer"});
  const isNew=!user?.id;
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const inp={width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,padding:"8px 12px",fontSize:13,outline:"none",boxSizing:"border-box"};
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:28,width:420,boxShadow:"0 20px 60px rgba(0,0,0,0.18)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <span style={{fontSize:15,fontWeight:700,color:T.text}}>{isNew?"Add User":"Edit User"}</span>
        <button onClick={onClose} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:20}}>×</button>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {[["Full Name","name","text"],["Username","username","text"],["Email","email","email"],["Password","password","password"]].map(([l,k,tp])=><div key={k}>
          <div style={{fontSize:11,fontWeight:600,color:T.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}{!isNew&&k==="password"?" (blank=keep)":""}</div>
          <input type={tp} value={form[k]} onChange={e=>set(k,e.target.value)} style={inp} placeholder={!isNew&&k==="password"?"Leave blank to keep":""}/>
        </div>)}
        <div>
          <div style={{fontSize:11,fontWeight:600,color:T.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>Role</div>
          <div style={{display:"flex",gap:8}}>
            {["admin","viewer"].map(r=><button key={r} onClick={()=>set("role",r)}
              style={{flex:1,background:form.role===r?T.accentLt:"transparent",border:`1.5px solid ${form.role===r?T.accent:T.border}`,borderRadius:6,color:form.role===r?T.accent:T.muted,padding:"8px",fontSize:13,cursor:"pointer",fontWeight:form.role===r?700:400,textTransform:"capitalize"}}>{r}</button>)}
          </div>
          <div style={{fontSize:11,color:T.muted2,marginTop:5}}>Admin: full access. Viewer: read-only.</div>
        </div>
      </div>
      <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
        <button onClick={onClose} style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:7,color:T.muted,padding:"9px 18px",fontSize:13,cursor:"pointer"}}>Cancel</button>
        <button onClick={()=>{
          if(!form.name||!form.username||!form.email){alert("Name, username and email required");return;}
          if(isNew&&!form.password){alert("Password required for new users");return;}
          onSave({...user,...form,id:user?.id||Date.now(),active:user?.active!==false});
        }} style={{background:T.accent,border:"none",borderRadius:7,color:"#fff",padding:"9px 22px",fontSize:13,fontWeight:700,cursor:"pointer"}}>{isNew?"Add User":"Save Changes"}</button>
      </div>
    </div>
  </div>;
}

const QUICK_Q=["What is total revenue for 2026?","Compare Solmar vs Snowtravel bookings","Which month had the most PAX in 2025?","How many cancellations in 2025?","Show revenue breakdown by dataset","Which city has the most bookings?","What is year-on-year revenue growth?","Average revenue per booking?"];

export default function App() {
  const [token,setToken]=useState(()=>localStorage.getItem("ttp_token"));
  const [user,setUser]=useState(()=>{try{const t=localStorage.getItem("ttp_token");if(!t)return null;const p=JSON.parse(atob(t.split(".")[1]));if(p.exp*1000<Date.now()){localStorage.removeItem("ttp_token");return null;}return p.user;}catch{return null;}});
  const [themeKey,setThemeKey]=useState(()=>localStorage.getItem("ttp_theme")||"gray");
  const T=THEMES[themeKey]||THEMES.gray;
  const changeTheme=k=>{setThemeKey(k);localStorage.setItem("ttp_theme",k);};
  const logout=useCallback(()=>{localStorage.removeItem("ttp_token");setToken(null);setUser(null);},[]);
  const handleLogin=(tok,u)=>{localStorage.setItem("ttp_token",tok);setToken(tok);setUser(u);};
  const handleUnauth=useCallback(()=>logout(),[logout]);
  const fetch_=useCallback((url,params={})=>apiFetch(url,params,token),[token]);

  const [tab,setTab]=useState("overview");
  const [showFilters,setShowFilters]=useState(true);
  const [showExport,setShowExport]=useState(false);
  const [clock,setClock]=useState(dubaiTime());
  const [lastR,setLastR]=useState("");
  const [dashStatus,setDashStatus]=useState(null);
  const [notifOpen,setNotifOpen]=useState(false);
  const [notifEmail,setNotifEmail]=useState("");
  const [notifSaved,setNotifSaved]=useState(false);

  const [filters,setFilters]=useState({});
  const [applied,setApplied]=useState({});
  const [slicers,setSlicers]=useState({datasets:[],transportTypes:[],busTypes:[]});

  const [kpis,setKpis]=useState(null);
  const [revData,setRevData]=useState([]);
  const [ymData,setYmData]=useState([]);
  const [trData,setTrData]=useState([]);
  const [oLoad,setOLoad]=useState(false);
  const [barMetric,setBarMetric]=useState("bookings");

  const [busView,setBusView]=useState("solmar");
  const [busFilters,setBusFilters]=useState({});
  const [busApplied,setBusApplied]=useState({});
  const [busTrips,setBusTrips]=useState([]);
  const [busClass,setBusClass]=useState([]);
  const [stBus,setStBus]=useState([]);
  const [stMonthly,setStMonthly]=useState([]);
  const [bLoad,setBLoad]=useState(false);

  const [msgs,setMsgs]=useState([{role:"assistant",text:"Hello! I am your TTP Analytics AI. Ask me anything about bookings, revenue, PAX or trends across Snowtravel, Solmar, Interbus and Solmar DE."}]);
  const [aiInput,setAiInput]=useState("");
  const [aiLoad,setAiLoad]=useState(false);
  const msgEnd=useRef(null);

  const [tableData,setTableData]=useState([]);
  const [tableSearch,setTableSearch]=useState("");
  const [tableDs,setTableDs]=useState([]);
  const [tableSt,setTableSt]=useState([]);
  const [tableDpF,setTableDpF]=useState("");
  const [tableDpT,setTableDpT]=useState("");
  const [tableBkF,setTableBkF]=useState("");
  const [tableBkT,setTableBkT]=useState("");
  const [tableSortCol,setTableSortCol]=useState("Departure Date");
  const [tableSortDir,setTableSortDir]=useState("desc");
  const [tablePage,setTablePage]=useState(0);
  const [tableLoad,setTableLoad]=useState(false);
  const TPER=50;

  const [stTab,setStTab]=useState("users");
  const [users,setUsers]=useState([
    {id:1,name:"Abdul Rahman",username:"abdulrahman",email:"abdrah1264@gmail.com",role:"admin",active:true},
    {id:2,name:"TTP Admin",username:"ttp_admin",email:"admin@ttp-services.com",role:"admin",active:true},
    {id:3,name:"Robbert Jan",username:"robbert",email:"robbert@ttp-services.com",role:"viewer",active:true},
    {id:4,name:"Samir",username:"samir",email:"samir@ttp-services.com",role:"viewer",active:true},
  ]);
  const [editUser,setEditUser]=useState(null);
  const [showNewUser,setShowNewUser]=useState(false);
  const [expDs,setExpDs]=useState([]);
  const [expSt,setExpSt]=useState("all");
  const [expBF,setExpBF]=useState(""),[expBT,setExpBT]=useState("");
  const [expDF,setExpDF]=useState(""),[expDT,setExpDT]=useState("");

  const isAdmin=user?.role==="admin";

  useEffect(()=>{
    const id=setInterval(()=>{setClock(dubaiTime());const now=new Date();if((now.getUTCHours()+4)%24===0&&now.getUTCMinutes()===0)setApplied(a=>({...a}));},60000);
    return()=>clearInterval(id);
  },[]);

  useEffect(()=>{
    if(!token)return;
    fetch_("/api/dashboard/slicers").then(d=>{if(d&&!d.error)setSlicers(d);}).catch(()=>{});
    fetch_("/api/ai/status").then(d=>setDashStatus(d)).catch(()=>{});
  },[token]);

  const loadOverview=useCallback(p=>{
    if(!token)return;setOLoad(true);
    Promise.all([
      fetch_("/api/dashboard/kpis",p),
      fetch_("/api/dashboard/revenue-by-year",p),
      fetch_("/api/dashboard/year-month-comparison",p),
      fetch_("/api/dashboard/transport-breakdown",p).catch(()=>[]),
    ]).then(([k,r,ym,tr])=>{
      if(k&&!k.error)setKpis(k);
      if(Array.isArray(r))setRevData(r);
      if(Array.isArray(ym))setYmData(ym);
      if(Array.isArray(tr))setTrData(tr);
      setLastR(dubaiTime());
    }).catch(e=>{if(e.message==="UNAUTH")handleUnauth();}).finally(()=>setOLoad(false));
  },[token]);

  useEffect(()=>{if(token)loadOverview({});},[token]);
  useEffect(()=>{loadOverview(buildParams(applied));},[applied]);

  const loadBus=useCallback(()=>{
    if(!token)return;setBLoad(true);
    const p=buildParams(busApplied);
    if(busView==="solmar"){
      Promise.all([
        fetch_("/api/dashboard/bustrips",p).catch(()=>({rows:[]})),
        fetch_("/api/dashboard/bus-class-summary",{}).catch(()=>[]),
      ]).then(([bt,bc])=>{
        const btRows=Array.isArray(bt)?bt:(bt?.rows||[]);
        if(btRows.length>0)setBusTrips([...btRows]);
        if(Array.isArray(bc))setBusClass(bc);
      }).finally(()=>setBLoad(false));
    }else{
      Promise.all([
        fetch_("/api/dashboard/snowtravel-bus",p).catch(()=>[]),
        fetch_("/api/dashboard/snowtravel-monthly",p).catch(()=>[]),
      ]).then(([sb,sm])=>{
        if(Array.isArray(sb))setStBus(sb);
        if(Array.isArray(sm))setStMonthly(sm);
      }).finally(()=>setBLoad(false));
    }
  },[token,busView,busApplied]);

  useEffect(()=>{if(token)loadBus();},[token,busView,busApplied]);

  useEffect(()=>{
    if(!token)return;
    fetch_("/api/dashboard/bustrips",{}).then(d=>{const rows=Array.isArray(d)?d:(d?.rows||[]);if(rows.length>0)setBusTrips([...rows]);}).catch(()=>{});
    fetch_("/api/dashboard/bus-class-summary",{}).then(d=>{if(Array.isArray(d))setBusClass(d);}).catch(()=>{});
  },[token]);

  const loadTable=useCallback(()=>{
    if(!token)return;setTableLoad(true);
    const p=new URLSearchParams();p.set("token",token);
    if(tableDs.length)tableDs.forEach(d=>p.append("dataset",d));
    if(tableSt.length)tableSt.forEach(s=>p.append("status",s));
    if(tableDpF)p.set("departureDateFrom",tableDpF);
    if(tableDpT)p.set("departureDateTo",tableDpT);
    if(tableBkF)p.set("bookingDateFrom",tableBkF);
    if(tableBkT)p.set("bookingDateTo",tableBkT);
    fetch(`${BASE}/api/dashboard/export?${p.toString()}`,{headers:{Authorization:`Bearer ${token}`}})
      .then(r=>r.text()).then(csv=>{
        const lines=csv.split("\n").filter(Boolean);if(lines.length<2){setTableData([]);return;}
        const headers=lines[0].split(",").map(h=>h.trim().replace(/^"|"$/g,""));
        const rows=lines.slice(1).map(line=>{
          const vals=[];let cur="",inQ=false;
          for(const ch of line){if(ch==='"')inQ=!inQ;else if(ch===","&&!inQ){vals.push(cur.trim());cur="";}else cur+=ch;}
          vals.push(cur.trim());
          const obj={};headers.forEach((h,i)=>{obj[h]=(vals[i]||"").replace(/^"|"$/g,"");});return obj;
        });setTableData(rows);
      }).catch(()=>{}).finally(()=>setTableLoad(false));
  },[token,tableDs,tableSt,tableDpF,tableDpT,tableBkF,tableBkT]);

  useEffect(()=>{if(tab==="table"&&token)loadTable();},[tab]);

  const sendAI=useCallback(async q=>{
    const msg=q||aiInput.trim();if(!msg)return;
    setAiInput("");setMsgs(m=>[...m,{role:"user",text:msg}]);setAiLoad(true);
    try{
      const r=await fetch(`${BASE}/api/ai/chat`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({message:msg})});
      if(r.status===401){handleUnauth();return;}
      const d=await r.json();setMsgs(m=>[...m,{role:"assistant",text:d.reply||"No response."}]);
    }catch{setMsgs(m=>[...m,{role:"assistant",text:"Connection error. Please try again."}]);}
    finally{setAiLoad(false);}
  },[aiInput,token,handleUnauth]);

  useEffect(()=>{msgEnd.current?.scrollIntoView({behavior:"smooth"});},[msgs]);

  const downloadCSV=useCallback(()=>{
    const p=new URLSearchParams();p.set("token",token);
    if(expDs.length)expDs.forEach(d=>p.append("dataset",d));
    if(expSt!=="all")p.set("status",expSt);
    if(expBF)p.set("bookingDateFrom",expBF);if(expBT)p.set("bookingDateTo",expBT);
    if(expDF)p.set("departureDateFrom",expDF);if(expDT)p.set("departureDateTo",expDT);
    window.open(`${BASE}/api/dashboard/export?${p.toString()}`,"_blank");setShowExport(false);
  },[token,expDs,expSt,expBF,expBT,expDF,expDT]);

  const tableFiltered=tableData.filter(row=>{
    if(tableSearch&&!Object.values(row).some(v=>String(v).toLowerCase().includes(tableSearch.toLowerCase())))return false;
    return true;
  }).sort((a,b)=>{const av=a[tableSortCol]||"",bv=b[tableSortCol]||"";const cmp=av.localeCompare(bv,undefined,{numeric:true});return tableSortDir==="asc"?cmp:-cmp;});

  if(!token)return <Login onLogin={handleLogin}/>;

  const cy=new Date().getFullYear();
  const presets=[
    {label:"This Year",from:`${cy}-01-01`,to:`${cy}-12-31`},
    {label:"Last Year",from:`${cy-1}-01-01`,to:`${cy-1}-12-31`},
    {label:"Last 3M",from:(()=>{const d=new Date();d.setMonth(d.getMonth()-3);return d.toISOString().split("T")[0];})(),to:new Date().toISOString().split("T")[0]},
    {label:"Last 30D",from:(()=>{const d=new Date();d.setDate(d.getDate()-30);return d.toISOString().split("T")[0]})(),to:new Date().toISOString().split("T")[0]},
    {label:"All",from:"",to:""},
  ];

  const TABS=[["overview","Overview"],["bus","Bus Occupancy"],["ai","AI Assistant"],["table","Data Table"],["settings","Settings"]];
  const TAB_S=t=>({background:"transparent",border:"none",cursor:"pointer",color:tab===t?T.accent:T.muted,borderBottom:`2px solid ${tab===t?T.accent:"transparent"}`,padding:"0 14px",height:52,fontSize:13,fontWeight:tab===t?700:500,transition:"all 0.15s",whiteSpace:"nowrap"});

  const SvgBkg=()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
  const SvgPax=()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
  const SvgRev=()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;

  const inp={background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,padding:"7px 10px",fontSize:12,outline:"none",colorScheme:"light"};
  const lbl={fontSize:11,fontWeight:600,color:T.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.06em",display:"block"};

  return <div style={{background:T.bg,color:T.text,minHeight:"100vh",fontFamily:"Inter,system-ui,-apple-system,sans-serif",display:"flex",flexDirection:"column"}}>
    <style>{`*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:${T.bg}}::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}@media(max-width:768px){.kpi-row{flex-direction:column!important}.chart2{grid-template-columns:1fr!important}.bus2{grid-template-columns:1fr!important}.ai-grid{grid-template-columns:1fr!important}.ai-sb{display:none!important}.tab-nav{overflow-x:auto;-webkit-overflow-scrolling:touch}}input[type="date"]::-webkit-calendar-picker-indicator{opacity:0.5;cursor:pointer}`}</style>

    {/* HEADER */}
    <header style={{background:T.header,borderBottom:`1px solid ${T.border}`,height:52,display:"flex",alignItems:"center",padding:"0 16px",gap:12,position:"sticky",top:0,zIndex:200,boxShadow:"0 1px 3px rgba(0,0,0,0.06)",flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0,marginRight:8}}>
        <img src="/assets/logo.png" alt="TTP" style={{height:26,objectFit:"contain",filter:themeKey==="blue"?"brightness(0) invert(1)":"none"}}/>
        <span style={{fontSize:10,fontWeight:700,color:themeKey==="blue"?"rgba(255,255,255,0.8)":T.muted2,letterSpacing:"0.12em",textTransform:"uppercase"}}>ANALYTICS</span>
      </div>
      <nav className="tab-nav" style={{display:"flex",height:52,flex:1,overflowX:"auto"}}>
        {TABS.map(([t,l])=><button key={t} style={{...TAB_S(t),color:themeKey==="blue"&&tab!==t?"rgba(255,255,255,0.8)":TAB_S(t).color,borderBottomColor:themeKey==="blue"&&tab===t?"#fff":TAB_S(t).borderBottom.split(" ")[2]}} onClick={()=>setTab(t)}>{l}</button>)}
      </nav>
      <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
        <span style={{fontSize:11,color:themeKey==="blue"?"rgba(255,255,255,0.8)":T.muted2,whiteSpace:"nowrap"}}>{clock} DXB</span>
        <button onClick={()=>setApplied(a=>({...a}))} style={{background:"transparent",border:`1px solid ${themeKey==="blue"?"rgba(255,255,255,0.4)":T.border}`,borderRadius:6,color:themeKey==="blue"?"#fff":T.muted,width:30,height:30,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}} title="Refresh">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4"/></svg>
        </button>
        {tab==="overview"&&<button onClick={()=>setShowFilters(s=>!s)} style={{background:showFilters?T.accentLt:"transparent",border:`1px solid ${showFilters?T.accent:themeKey==="blue"?"rgba(255,255,255,0.4)":T.border}`,borderRadius:6,color:showFilters?T.accent:themeKey==="blue"?"#fff":T.muted,padding:"5px 10px",fontSize:11,cursor:"pointer",fontWeight:showFilters?600:400}}>Filters</button>}
        <button onClick={()=>setShowExport(true)} style={{background:themeKey==="blue"?"rgba(255,255,255,0.2)":T.accent,border:`1px solid ${themeKey==="blue"?"rgba(255,255,255,0.5)":"transparent"}`,borderRadius:6,color:"#fff",padding:"5px 14px",fontSize:11,fontWeight:700,cursor:"pointer"}}>Export</button>
        <div style={{position:"relative"}}>
          <button onClick={()=>setNotifOpen(o=>!o)} style={{background:"transparent",border:`1px solid ${themeKey==="blue"?"rgba(255,255,255,0.4)":T.border}`,borderRadius:6,color:themeKey==="blue"?"#fff":T.muted,width:30,height:30,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            {dashStatus&&<span style={{position:"absolute",top:4,right:4,width:6,height:6,background:"#ef4444",borderRadius:"50%"}}/>}
          </button>
          {notifOpen&&<div style={{position:"absolute",top:"calc(100% + 8px)",right:0,width:280,background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:16,zIndex:9999,boxShadow:"0 8px 32px rgba(0,0,0,0.12)"}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:10,color:T.text}}>Dataset Status</div>
            {dashStatus?.datasets?.map(d=><div key={d.dataset} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${T.border}`,fontSize:12}}><span style={{color:T.muted}}>{d.dataset}</span><span style={{color:T.accent,fontWeight:600}}>{fmtNum(d.total_bookings)}</span></div>)}
            <div style={{fontSize:11,color:T.muted2,margin:"10px 0 6px",textTransform:"uppercase",fontWeight:600,letterSpacing:"0.06em"}}>Email Notifications</div>
            {notifSaved?<div style={{fontSize:12,color:T.success,fontWeight:600}}>Enabled for {notifEmail}</div>:<div style={{display:"flex",gap:6}}>
              <input type="email" value={notifEmail} onChange={e=>setNotifEmail(e.target.value)} placeholder="your@email.com" style={{flex:1,background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,padding:"6px 10px",fontSize:11,outline:"none"}}/>
              <button onClick={async()=>{if(!notifEmail.includes("@"))return;const r=await fetch(`${BASE}/api/ai/notify`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({email:notifEmail})});const d=await r.json();if(d.success)setNotifSaved(true);}} style={{background:T.accent,border:"none",borderRadius:6,color:"#fff",padding:"6px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>Save</button>
            </div>}
          </div>}
        </div>
        <div style={{width:1,height:20,background:T.border}}/>
        <span style={{fontSize:12,color:themeKey==="blue"?"rgba(255,255,255,0.8)":T.muted,whiteSpace:"nowrap"}}>{user?.username}</span>
        <button onClick={logout} style={{background:"transparent",border:`1px solid ${themeKey==="blue"?"rgba(255,255,255,0.4)":T.border}`,borderRadius:6,color:themeKey==="blue"?"#fca5a5":T.danger,padding:"5px 10px",fontSize:11,cursor:"pointer"}}>Logout</button>
      </div>
    </header>

    {/* FILTERS — Overview only */}
    {showFilters&&tab==="overview"&&<div style={{background:T.card,borderBottom:`1px solid ${T.border}`,padding:"12px 20px"}}>
      <div style={{display:"flex",gap:6,marginBottom:10,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:11,color:T.muted2,marginRight:2}}>Quick:</span>
        {presets.map(p=><button key={p.label} onClick={()=>{setFilters(f=>({...f,departureDateFrom:p.from,departureDateTo:p.to}));setTimeout(()=>setApplied(f=>({...f,departureDateFrom:p.from,departureDateTo:p.to})),60);}}
          style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:14,color:T.muted,padding:"3px 12px",fontSize:11,cursor:"pointer",fontWeight:500}}>{p.label}</button>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:10}}>
        {[["Departure From","departureDateFrom"],["Departure To","departureDateTo"],["Booking From","bookingDateFrom"],["Booking To","bookingDateTo"]].map(([l,k])=><div key={k}><span style={lbl}>{l}</span><input type="date" lang="en-GB" style={inp} value={filters[k]||""} onChange={e=>setFilters(f=>({...f,[k]:e.target.value}))}/></div>)}
      </div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
        <MultiSel label="Dataset" options={slicers.datasets||[]} value={filters.datasets||[]} onChange={v=>setFilters(f=>({...f,datasets:v}))} T={T}/>
        <MultiSel label="Transport" options={slicers.transportTypes||[]} value={filters.transports||[]} onChange={v=>setFilters(f=>({...f,transports:v}))} T={T}/>
        <div>
          <div style={lbl}>Status</div>
          <div style={{display:"flex",gap:6}}>
            {[["","All",T.muted],["ok","OK",T.success],["cancelled","Cancelled",T.danger]].map(([v,l,c])=>{
              const active=v===""?(filters.statuses||[]).length===0:(filters.statuses||[]).includes(v);
              return <button key={v} onClick={()=>setFilters(f=>({...f,statuses:v?[v]:[]}))}
                style={{background:active?(v==="ok"?T.successLt:v==="cancelled"?T.dangerLt:T.accentLt):"transparent",border:`1.5px solid ${active?c:T.border}`,borderRadius:6,color:active?c:T.muted2,padding:"6px 14px",fontSize:12,cursor:"pointer",fontWeight:active?700:400}}>{l}</button>;
            })}
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
          <button onClick={()=>setApplied({...filters})} style={{background:T.accent,border:"none",borderRadius:6,color:"#fff",padding:"8px 20px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Apply</button>
          <button onClick={()=>{setFilters({});setApplied({});}} style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:6,color:T.muted,padding:"8px 16px",fontSize:12,cursor:"pointer"}}>Reset</button>
        </div>
      </div>
    </div>}

    {/* MAIN */}
    <main style={{flex:1,padding:"18px 20px",overflowY:"auto",paddingBottom:44}}>

      {/* ══ OVERVIEW ══ */}
      {tab==="overview"&&<div>
        {/* Row 1: 3 KPI cards */}
        <div className="kpi-row" style={{display:"flex",gap:14,marginBottom:16}}>
          <KpiCard title="Bookings" current={kpis?.currentBookings} previous={kpis?.previousBookings} diff={kpis?.differenceBookings} pct={kpis?.percentBookings} loading={oLoad} icon={<SvgBkg/>} T={T}/>
          <KpiCard title="PAX" current={kpis?.currentPax} previous={kpis?.previousPax} diff={kpis?.differencePax} pct={kpis?.percentPax} loading={oLoad} icon={<SvgPax/>} T={T}/>
          <KpiCard title="Revenue" current={kpis?.currentRevenue} previous={kpis?.previousRevenue} diff={kpis?.differenceRevenue} pct={kpis?.percentRevenue} isCur loading={oLoad} icon={<SvgRev/>} T={T}/>
        </div>
        {/* Row 2: Line chart + Bar chart */}
        <div className="chart2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
          <LineChart data={revData} title="Revenue by Year" metric="revenue" isCur T={T}/>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"16px 18px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <span style={{fontSize:11,fontWeight:600,color:T.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>Bookings / PAX by Year</span>
              <div style={{display:"flex",gap:4}}>
                {["bookings","pax"].map(m=><button key={m} onClick={()=>setBarMetric(m)} style={{background:barMetric===m?T.accentLt:"transparent",border:`1px solid ${barMetric===m?T.accent:T.border}`,borderRadius:4,color:barMetric===m?T.accent:T.muted2,padding:"3px 10px",fontSize:11,cursor:"pointer",textTransform:"capitalize",fontWeight:barMetric===m?600:400}}>{m}</button>)}
              </div>
            </div>
            <BarChart data={revData} metric={barMetric} T={T}/>
          </div>
        </div>
        {/* Row 3: Year-Month table (wide left) + Donut (right corner) */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:14,marginBottom:14}}>
          <div>
            <div style={{fontSize:11,fontWeight:600,color:T.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10}}>Year-Month Comparison</div>
            <YMTable data={ymData} T={T}/>
          </div>
          <DonutChart data={trData} title="Transport Type" T={T}/>
        </div>
      </div>}

      {/* ══ BUS OCCUPANCY ══ */}
      {tab==="bus"&&<div>
        {/* Toggle */}
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {[["solmar","Solmar / Interbus"],["snowtravel","Snowtravel"]].map(([v,l])=><button key={v} onClick={()=>setBusView(v)}
            style={{background:busView===v?T.accent:T.card,border:`1px solid ${busView===v?T.accent:T.border}`,borderRadius:8,color:busView===v?"#fff":T.muted,padding:"8px 24px",fontSize:13,cursor:"pointer",fontWeight:busView===v?700:500}}>{l}</button>)}
        </div>
        {/* Bus filters */}
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"14px 18px",marginBottom:16,display:"flex",gap:12,flexWrap:"wrap",alignItems:"flex-end"}}>
          {[["Date From","dateFrom"],["Date To","dateTo"]].map(([l,k])=><div key={k}>
            <div style={lbl}>{l}</div>
            <input type="date" lang="en-GB" value={busFilters[k]||""} onChange={e=>setBusFilters(f=>({...f,[k]:e.target.value}))} style={inp}/>
          </div>)}
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setBusApplied({...busFilters})} style={{background:T.accent,border:"none",borderRadius:6,color:"#fff",padding:"8px 20px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Apply</button>
            <button onClick={()=>{setBusFilters({});setBusApplied({});}} style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:6,color:T.muted,padding:"8px 16px",fontSize:12,cursor:"pointer"}}>Reset</button>
          </div>
        </div>

        {busView==="solmar"?<>
          {/* Charts */}
          <div className="bus2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
            <BusBarChart data={busClass} title="Bookings by Bus Class" metric="bookings" T={T}/>
            <BusBarChart data={busClass} title="Revenue by Bus Class" metric="revenue" T={T}/>
          </div>
          {/* Robbert's table */}
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:11,fontWeight:600,color:T.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>BUS OCCUPANCY — OUTBOUND VS RETURN</span>
              <span style={{fontSize:11,color:T.muted2}}>{busTrips.length} trips</span>
            </div>
            <BusTripsTable rows={busTrips} loading={bLoad} T={T}/>
          </div>
        </>:<>
          <div className="bus2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
            <LineChart data={stMonthly} title="Revenue by Bus Type (Snowtravel)" metric="revenue" isCur T={T}/>
            <BarChart data={stMonthly} title="PAX by Bus Type (Snowtravel)" metric="pax" T={T}/>
          </div>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`}}>
              <span style={{fontSize:11,fontWeight:600,color:T.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>SNOWTRAVEL BUS OCCUPANCY — {stBus.length} rows</span>
            </div>
            <SnowTable rows={stBus} loading={bLoad} T={T}/>
          </div>
        </>}
      </div>}

      {/* ══ AI ASSISTANT ══ */}
      {tab==="ai"&&<div className="ai-grid" style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:16,height:"calc(100vh - 160px)"}}>
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,background:T.accentLt,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><circle cx="12" cy="5" r="4"/><line x1="12" y1="9" x2="12" y2="11"/></svg>
            </div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:T.text}}>TTP AI Assistant</div>
              <div style={{fontSize:11,color:T.muted2,display:"flex",alignItems:"center",gap:5}}><span style={{width:6,height:6,borderRadius:"50%",background:T.success,display:"inline-block"}}/>Powered by OpenAI · Live Azure SQL data</div>
            </div>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"16px 18px",display:"flex",flexDirection:"column",gap:10}}>
            {msgs.map((m,i)=><div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
              <div style={{maxWidth:"80%",background:m.role==="user"?T.accent:T.inputBg,border:m.role==="user"?"none":`1px solid ${T.border}`,borderRadius:m.role==="user"?"12px 12px 2px 12px":"12px 12px 12px 2px",padding:"10px 14px",fontSize:13,color:m.role==="user"?"#fff":T.text,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{m.text}</div>
            </div>)}
            {aiLoad&&<div style={{display:"flex",justifyContent:"flex-start"}}><div style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:"12px 12px 12px 2px",padding:"10px 14px",fontSize:13,color:T.muted2}}>Analysing data...</div></div>}
            <div ref={msgEnd}/>
          </div>
          <div style={{padding:"12px 16px",borderTop:`1px solid ${T.border}`,display:"flex",gap:10}}>
            <input value={aiInput} onChange={e=>setAiInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendAI()} placeholder="Ask about your data..." style={{flex:1,background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,padding:"10px 14px",fontSize:13,outline:"none"}}/>
            <button onClick={()=>sendAI()} disabled={aiLoad} style={{background:T.accent,border:"none",borderRadius:8,color:"#fff",padding:"10px 20px",fontSize:13,fontWeight:700,cursor:"pointer",opacity:aiLoad?0.7:1}}>Send</button>
          </div>
        </div>
        <div className="ai-sb" style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"16px 18px",flex:1,overflowY:"auto"}}>
            <div style={{fontSize:11,fontWeight:600,color:T.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10}}>Quick Questions</div>
            {QUICK_Q.map((q,i)=><button key={i} onClick={()=>sendAI(q)} style={{display:"block",width:"100%",textAlign:"left",background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,color:T.muted,padding:"8px 12px",fontSize:12,cursor:"pointer",marginBottom:7}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=T.accent;e.currentTarget.style.color=T.accent;e.currentTarget.style.background=T.accentLt;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.muted;e.currentTarget.style.background="transparent";}}>{q}</button>)}
          </div>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"16px 18px"}}>
            <div style={{fontSize:11,fontWeight:600,color:T.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10}}>Data Sources</div>
            {(dashStatus?.datasets||[{dataset:"Snowtravel"},{dataset:"Solmar"},{dataset:"Interbus"},{dataset:"Solmar DE"}]).map(d=><div key={d.dataset} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${T.border}`}}>
              <span style={{fontSize:12,color:T.text}}>{d.dataset}</span>
              <span style={{fontSize:10,background:T.successLt,color:T.success,borderRadius:10,padding:"2px 8px",fontWeight:600}}>Live</span>
            </div>)}
          </div>
        </div>
      </div>}

      {/* ══ DATA TABLE ══ */}
      {tab==="table"&&<div>
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"14px 18px",marginBottom:14,display:"flex",gap:12,flexWrap:"wrap",alignItems:"flex-end"}}>
          <div style={{flex:"0 0 220px"}}>
            <div style={lbl}>Search</div>
            <input value={tableSearch} onChange={e=>setTableSearch(e.target.value)} placeholder="Booking ID, city, status..." style={{width:"100%",...inp}}/>
          </div>
          <MultiSel label="Dataset" options={["Snowtravel","Solmar","Interbus","Solmar DE"]} value={tableDs} onChange={v=>setTableDs(v)} T={T}/>
          <div>
            <div style={lbl}>Status</div>
            <div style={{display:"flex",gap:6}}>
              {[["","All",T.muted],["ok","OK",T.success],["cancelled","Cancelled",T.danger]].map(([v,l,c])=>{
                const active=v===""?tableSt.length===0:tableSt.includes(v);
                return <button key={v} onClick={()=>setTableSt(v?[v]:[])}
                  style={{background:active?(v==="ok"?T.successLt:v==="cancelled"?T.dangerLt:T.accentLt):"transparent",border:`1.5px solid ${active?c:T.border}`,borderRadius:6,color:active?c:T.muted2,padding:"6px 12px",fontSize:12,cursor:"pointer",fontWeight:active?700:400}}>{l}</button>;
              })}
            </div>
          </div>
          {[["Dep From",tableDpF,setTableDpF],["Dep To",tableDpT,setTableDpT],["Bkg From",tableBkF,setTableBkF],["Bkg To",tableBkT,setTableBkT]].map(([l,v,fn])=><div key={l}>
            <div style={lbl}>{l}</div>
            <input type="date" lang="en-GB" value={v} onChange={e=>fn(e.target.value)} style={inp}/>
          </div>)}
          <div style={{display:"flex",gap:8}}>
            <button onClick={loadTable} style={{background:T.accent,border:"none",borderRadius:6,color:"#fff",padding:"8px 18px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Refresh</button>
            <button onClick={()=>setShowExport(true)} style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:6,color:T.muted,padding:"8px 14px",fontSize:12,cursor:"pointer"}}>Export CSV</button>
          </div>
          <span style={{fontSize:12,color:T.muted2,alignSelf:"flex-end",paddingBottom:2}}>{tableFiltered.length.toLocaleString()} rows</span>
        </div>
        {tableLoad?<div style={{textAlign:"center",padding:48,color:T.muted}}>Loading data...</div>:<div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
          <div style={{overflowX:"auto",maxHeight:"calc(100vh - 340px)"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead style={{position:"sticky",top:0,zIndex:10}}>
                <tr style={{background:T.rowAlt,borderBottom:`2px solid ${T.border}`}}>
                  {tableData[0]&&Object.keys(tableData[0]).map(h=><th key={h} onClick={()=>{setTableSortCol(h);setTableSortDir(d=>tableSortCol===h?(d==="asc"?"desc":"asc"):"asc");}}
                    style={{padding:"9px 10px",color:T.muted,fontWeight:600,textAlign:"left",whiteSpace:"nowrap",cursor:"pointer",userSelect:"none",fontSize:11,background:T.rowAlt}}>
                    {h} {tableSortCol===h?(tableSortDir==="asc"?"↑":"↓"):""}
                  </th>)}
                </tr>
              </thead>
              <tbody>{tableFiltered.slice(tablePage*TPER,(tablePage+1)*TPER).map((row,i)=><tr key={i} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?T.card:T.rowAlt}}
                onMouseEnter={e=>e.currentTarget.style.background=T.accentLt}
                onMouseLeave={e=>e.currentTarget.style.background=i%2===0?T.card:T.rowAlt}>
                {Object.entries(row).map(([k,v],j)=><td key={j} style={{padding:"7px 10px",whiteSpace:"nowrap",color:k==="Status"?(v==="ok"?T.success:v==="cancelled"?T.danger:T.muted):k==="Dataset"?T.accent:T.text,fontWeight:k==="Status"||k==="Dataset"?600:400}}>{v||"—"}</td>)}
              </tr>)}</tbody>
            </table>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",borderTop:`1px solid ${T.border}`}}>
            <span style={{fontSize:11,color:T.muted2}}>Showing {Math.min((tablePage+1)*TPER,tableFiltered.length)} of {tableFiltered.length}</span>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <PagBtn label="‹" onClick={()=>setTablePage(p=>Math.max(0,p-1))} disabled={tablePage===0} T={T}/>
              <span style={{fontSize:11,color:T.muted}}>Page {tablePage+1} / {Math.max(1,Math.ceil(tableFiltered.length/TPER))}</span>
              <PagBtn label="›" onClick={()=>setTablePage(p=>p+1)} disabled={(tablePage+1)*TPER>=tableFiltered.length} T={T}/>
            </div>
          </div>
        </div>}
      </div>}

      {/* ══ SETTINGS ══ */}
      {tab==="settings"&&<div style={{maxWidth:860}}>
        <div style={{fontSize:18,fontWeight:700,marginBottom:20,color:T.text}}>Settings</div>
        <div style={{display:"flex",gap:0,marginBottom:20,borderBottom:`1px solid ${T.border}`}}>
          {[["users","Users & Access"],["theme","Theme"],["api","API Keys & Integrations"],["about","About"]].map(([t,l])=><button key={t} onClick={()=>setStTab(t)} style={{background:"transparent",border:"none",borderBottom:`2px solid ${stTab===t?T.accent:"transparent"}`,color:stTab===t?T.accent:T.muted,padding:"10px 18px",fontSize:13,fontWeight:stTab===t?700:500,cursor:"pointer"}}>{l}</button>)}
        </div>

        {stTab==="users"&&<div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:14,fontWeight:600,color:T.text}}>User Accounts ({users.length})</div>
            {isAdmin&&<button onClick={()=>setShowNewUser(true)} style={{background:T.accent,border:"none",borderRadius:6,color:"#fff",padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Add User</button>}
          </div>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr style={{background:T.rowAlt,borderBottom:`1px solid ${T.border}`}}>
                {["Name","Username","Email","Role","Status","Actions"].map(h=><th key={h} style={{padding:"10px 14px",color:T.muted,fontWeight:600,textAlign:"left",fontSize:11,textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</th>)}
              </tr></thead>
              <tbody>{users.map((u,i)=><tr key={u.id} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?T.card:T.rowAlt}}>
                <td style={{padding:"10px 14px",fontWeight:600,color:T.text}}>{u.name}</td>
                <td style={{padding:"10px 14px",color:T.muted,fontFamily:"monospace",fontSize:12}}>{u.username}</td>
                <td style={{padding:"10px 14px",color:T.muted,fontSize:12}}>{u.email}</td>
                <td style={{padding:"10px 14px"}}><span style={{background:u.role==="admin"?T.accentLt:T.inputBg,color:u.role==="admin"?T.accent:T.muted,borderRadius:10,padding:"2px 10px",fontSize:11,fontWeight:600,textTransform:"capitalize"}}>{u.role}</span></td>
                <td style={{padding:"10px 14px"}}><span style={{background:u.active?T.successLt:T.dangerLt,color:u.active?T.success:T.danger,borderRadius:10,padding:"2px 10px",fontSize:11,fontWeight:600}}>{u.active?"Active":"Inactive"}</span></td>
                <td style={{padding:"10px 14px"}}><div style={{display:"flex",gap:6}}>
                  {isAdmin&&<button onClick={()=>setEditUser(u)} style={{background:T.accentLt,border:`1px solid ${T.accent}`,borderRadius:5,color:T.accent,padding:"4px 10px",fontSize:11,cursor:"pointer",fontWeight:600}}>Edit</button>}
                  {isAdmin&&u.username!=="ttp_admin"&&<button onClick={()=>setUsers(us=>us.map(x=>x.id===u.id?{...x,active:!x.active}:x))} style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:5,color:T.muted,padding:"4px 10px",fontSize:11,cursor:"pointer"}}>{u.active?"Deactivate":"Activate"}</button>}
                  {isAdmin&&u.id!==1&&u.username!=="ttp_admin"&&<button onClick={()=>{if(window.confirm(`Delete ${u.name}?`))setUsers(us=>us.filter(x=>x.id!==u.id));}} style={{background:T.dangerLt,border:`1px solid ${T.danger}`,borderRadius:5,color:T.danger,padding:"4px 10px",fontSize:11,cursor:"pointer",fontWeight:600}}>Delete</button>}
                </div></td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>}

        {stTab==="theme"&&<div>
          <div style={{fontSize:14,fontWeight:600,color:T.text,marginBottom:14}}>Theme & Display</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            {Object.entries(THEMES).map(([key,th])=><div key={key} onClick={()=>changeTheme(key)}
              style={{border:`2px solid ${themeKey===key?T.accent:T.border}`,borderRadius:12,padding:16,cursor:"pointer",background:themeKey===key?T.accentLt:T.card,transition:"all 0.15s"}}>
              <div style={{borderRadius:8,overflow:"hidden",marginBottom:10,border:`1px solid ${T.border}`}}>
                <div style={{background:th.header,height:22,display:"flex",alignItems:"center",padding:"0 10px",gap:6}}>
                  <div style={{width:24,height:5,background:th.accent,borderRadius:2}}/>
                  <div style={{width:14,height:5,background:th.muted2,borderRadius:2}}/>
                </div>
                <div style={{background:th.bg,padding:8,display:"flex",gap:5}}>
                  {[th.accent,th.success,th.warning].map((c,i)=><div key={i} style={{flex:1,height:22,background:th.card,border:`1px solid ${th.border}`,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <div style={{width:"60%",height:4,background:c,borderRadius:2}}/>
                  </div>)}
                </div>
              </div>
              <div style={{fontSize:13,fontWeight:themeKey===key?700:500,color:themeKey===key?T.accent:T.text}}>{th.name}</div>
              {themeKey===key&&<div style={{fontSize:10,color:T.accent,marginTop:2,fontWeight:600}}>✓ Active</div>}
            </div>)}
          </div>
          <div style={{background:T.inputBg,borderRadius:8,padding:12,fontSize:12,color:T.muted}}>Theme is saved to your browser and persists across sessions.</div>
        </div>}

        {stTab==="api"&&<div>
          <div style={{fontSize:14,fontWeight:600,color:T.text,marginBottom:14}}>API Keys & Integrations</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[
              {name:"Azure SQL Database",desc:"ttpserver.database.windows.net / TTPDatabase",status:"Connected",ok:true},
              {name:"OpenAI GPT-4o-mini",desc:"AI assistant — sk-proj-NZitJYGtq...  (configured)",status:"Connected",ok:true},
              {name:"TravelNote API (Snowtravel)",desc:"Pipeline by Samir — syncs ST_Bookings",status:"Synced",ok:true},
              {name:"GRIP API (Solmar/Interbus)",desc:"Pipeline by Samir — syncs CustomerOverview",status:"Synced",ok:true},
              {name:"GitHub Actions CI/CD",desc:"Auto-deploy on push to main branch",status:"Active",ok:true},
              {name:"Azure Static Web Apps",desc:"Frontend hosting — Belgium Central",status:"Live",ok:true},
              {name:"Azure App Service",desc:"Backend API — Belgium Central",status:"Live",ok:true},
              {name:"Hotel Data Integration",desc:"Future: hotel booking data",status:"Planned",ok:false},
              {name:"Eurotours Pipeline",desc:"Future: Eurotours data integration",status:"Planned",ok:false},
            ].map(item=><div key={item.name} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:2}}>{item.name}</div>
                <div style={{fontSize:12,color:T.muted}}>{item.desc}</div>
              </div>
              <span style={{background:item.ok?T.successLt:T.inputBg,color:item.ok?T.success:T.muted2,borderRadius:10,padding:"3px 12px",fontSize:11,fontWeight:600,flexShrink:0,marginLeft:16}}>{item.status}</span>
            </div>)}
          </div>
        </div>}

        {stTab==="about"&&<div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:24}}>
          <img src="/assets/logo.png" alt="TTP" style={{height:36,marginBottom:16}}/>
          <div style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:8}}>TTP Analytics Platform</div>
          <div style={{fontSize:13,color:T.muted,lineHeight:1.8,marginBottom:20}}>Professional analytics dashboard for TTP Services — live Azure SQL data for the entire team.</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
            {[["Version","1.3.0 — March 2026"],["Frontend","React 18 + Vite"],["Backend","Node.js 20 + Express"],["Database","Azure SQL — TTPDatabase"],["AI","OpenAI GPT-4o-mini"],["Hosting","Azure — Belgium Central"],["Datasets","Snowtravel, Solmar, Interbus, Solmar DE"],["Auto-refresh","Daily 00:00 Dubai time"]].map(([k,v])=><div key={k} style={{padding:"10px 0",borderBottom:`1px solid ${T.border}`}}>
              <div style={{fontSize:10,color:T.muted2,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>{k}</div>
              <div style={{fontSize:12,color:T.text,fontWeight:500}}>{v}</div>
            </div>)}
          </div>
        </div>}
      </div>}
    </main>

    {/* STATUS BAR */}
    <div style={{position:"fixed",bottom:0,left:0,right:0,background:T.card,borderTop:`1px solid ${T.border}`,padding:"4px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:10,zIndex:50,flexWrap:"wrap",gap:8}}>
      <div style={{display:"flex",gap:14,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{color:T.muted2}}>Last sync: <span style={{color:T.accent,fontWeight:600}}>{lastR||"—"} Dubai</span></span>
        {dashStatus?.datasets?.map(d=><span key={d.dataset} style={{color:T.muted2}}><span style={{color:T.accent,fontWeight:600}}>{d.dataset}</span>: {fmtNum(d.total_bookings)}</span>)}
      </div>
      <span style={{color:T.muted2}}>Auto-refresh 00:00 Dubai · TTP Analytics v1.3</span>
    </div>

    {/* EXPORT MODAL */}
    {showExport&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget)setShowExport(false);}}>
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:28,width:460,boxShadow:"0 20px 60px rgba(0,0,0,0.18)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <span style={{fontSize:15,fontWeight:700,color:T.text}}>Export Data</span>
          <button onClick={()=>setShowExport(false)} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:20}}>×</button>
        </div>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:600,color:T.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>Dataset</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {["Snowtravel","Solmar","Interbus","Solmar DE"].map(d=>{const sel=expDs.includes(d);return <button key={d} onClick={()=>setExpDs(s=>sel?s.filter(x=>x!==d):[...s,d])} style={{background:sel?T.accentLt:"transparent",border:`1.5px solid ${sel?T.accent:T.border}`,borderRadius:6,color:sel?T.accent:T.muted,padding:"5px 12px",fontSize:12,cursor:"pointer",fontWeight:sel?600:400}}>{d}</button>;})}
          </div>
        </div>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:600,color:T.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>Status</div>
          <div style={{display:"flex",gap:6}}>
            {[["all","All",T.muted],["ok","OK",T.success],["cancelled","Cancelled",T.danger]].map(([v,l,c])=><button key={v} onClick={()=>setExpSt(v)} style={{background:expSt===v?(v==="ok"?T.successLt:v==="cancelled"?T.dangerLt:T.accentLt):"transparent",border:`1.5px solid ${expSt===v?c:T.border}`,borderRadius:6,color:expSt===v?c:T.muted,padding:"5px 14px",fontSize:12,cursor:"pointer",fontWeight:expSt===v?600:400}}>{l}</button>)}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
          {[["Booking From",expBF,setExpBF],["Booking To",expBT,setExpBT],["Departure From",expDF,setExpDF],["Departure To",expDT,setExpDT]].map(([l,v,fn])=><div key={l}>
            <div style={{fontSize:11,fontWeight:600,color:T.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}</div>
            <input type="date" lang="en-GB" value={v} onChange={e=>fn(e.target.value)} style={{width:"100%",...inp}}/>
          </div>)}
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={downloadCSV} style={{background:T.accent,border:"none",borderRadius:8,color:"#fff",padding:"10px 22px",fontSize:13,fontWeight:700,cursor:"pointer"}}>Download CSV</button>
          <button onClick={()=>window.print()} style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,color:T.muted,padding:"10px 16px",fontSize:13,cursor:"pointer"}}>Print / PDF</button>
        </div>
      </div>
    </div>}

    {/* USER MODALS */}
    {(editUser||showNewUser)&&<UserModal user={editUser||null} T={T}
      onClose={()=>{setEditUser(null);setShowNewUser(false);}}
      onSave={u=>{if(editUser)setUsers(us=>us.map(x=>x.id===u.id?u:x));else setUsers(us=>[...us,{...u,id:Date.now(),active:true}]);setEditUser(null);setShowNewUser(false);}}/>}
  </div>;
}
