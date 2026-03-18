import { useState, useEffect, useRef, useCallback } from "react";
import Login from "./components/Login.jsx";

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const YEAR_COLORS = ["#4f8ef7","#f59e0b","#34d399","#f87171"];
const BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://localhost:3001";

const THEME = {
  bg: "#050d1a",
  card: "#0a1628",
  cardHover: "#0d1f3c",
  border: "#0e2040",
  accent: "#38bdf8",
  text: "#f1f5f9",
  muted: "#64748b",
  muted2: "#475569",
  success: "#34d399",
  danger: "#f87171",
  warning: "#fbbf24",
};

const CITY_COORDS = {
  "Antwerpen":[51.2194,4.4025],"Gent":[51.0543,3.7174],"Brugge":[51.2093,3.2247],
  "Brussel":[50.8503,4.3517],"Leuven":[50.8798,4.7005],"Hasselt":[50.9307,5.3378],
  "Genk":[50.9651,5.4989],"Kortrijk":[50.8280,3.2648],"Mechelen":[51.0259,4.4776],
  "Turnhout":[51.3220,4.9510],"Geel":[51.1619,4.9870],"Lommel":[51.2289,5.3142],
  "Pelt":[51.2350,5.4160],"Dendermonde":[51.0280,4.1010],"Ieper":[50.8503,2.8768],
  "Waregem":[50.8827,3.4288],"Aalst":[50.9370,4.0390],"Puurs":[51.0720,4.2780],
  "Sint-Truiden":[50.8180,5.1870],"Thor Park Genk":[50.9651,5.4989],
  "Groot-Bijgaarden":[50.8790,4.2580],"Grimbergen":[50.9360,4.3730],
  "Wijnegem":[51.2280,4.5230],"Wevelgem":[50.8050,3.1810],
  "Lummen":[50.9870,5.2760],"Maasmechelen":[50.9670,5.6970],
  "Houthalen-Helchteren":[51.0330,5.3780],"Herentals":[51.1760,4.8370],
  "Zaventem":[50.8980,4.4670],"Sint-Niklaas":[51.1586,4.1427],
  "Roeselare":[50.9460,3.1220],"Kortemark":[51.0090,3.0380],
};

const PENDEL_MAP = {
  BEN:"Benidorm",CBR:"Costa Brava",SAL:"Salou",SSE:"Sierra Nevada",
  LLO:"Lloret de Mar",COB:"Costa Blanca",CSE:"Costa del Sol",PEN:"Peniscola"
};

// ── HELPERS ───────────────────────────────────────────────────────────────────
const fmt = (n, cur=false) => {
  if (n==null||isNaN(n)) return "—";
  return cur ? "€"+Number(n).toLocaleString("nl-BE",{maximumFractionDigits:0}) : Number(n).toLocaleString("nl-BE");
};
const fmtPct = n => { if(n==null||isNaN(n))return"—"; const v=parseFloat(n); return(v>0?"+":"")+v.toFixed(1)+"%"; };
const diffClr = v => (v==null||isNaN(v))?"#94a3b8":parseFloat(v)>=0?THEME.success:THEME.danger;
const arw = v => (v==null||isNaN(v))?"":parseFloat(v)>=0?"▲":"▼";
const dubaiTime = () => new Date().toLocaleTimeString("en-AE",{timeZone:"Asia/Dubai",hour:"2-digit",minute:"2-digit"});

// ── API FETCH ─────────────────────────────────────────────────────────────────
function apiFetch(url, params={}, onUnauth=()=>{}) {
  const t = localStorage.getItem("ttp_token");
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k,v])=>{
    if(v==null||v==="")return;
    if(Array.isArray(v))v.forEach(x=>sp.append(k,x));
    else sp.set(k,v);
  });
  const qs = sp.toString();
  return fetch(`${BASE}${url}${qs?"?"+qs:""}`,{
    headers:{"Authorization":`Bearer ${t}`,"Content-Type":"application/json"}
  }).then(r=>{
    if(r.status===401){onUnauth();throw new Error("Unauthorized");}
    return r.json();
  });
}

// ── TOOLTIP ───────────────────────────────────────────────────────────────────
function ChartTooltip({tooltip}) {
  if(!tooltip) return null;
  return (
    <div style={{
      position:"fixed",left:tooltip.x+14,top:tooltip.y-52,
      background:THEME.card,border:`1px solid ${THEME.accent}`,
      borderRadius:8,padding:"8px 14px",fontSize:12,
      color:THEME.text,pointerEvents:"none",zIndex:9999,
      boxShadow:"0 4px 20px rgba(0,0,0,0.6)",whiteSpace:"nowrap"
    }}>
      <div style={{color:THEME.accent,fontWeight:700,marginBottom:2}}>{tooltip.label}</div>
      <div>{tooltip.value}</div>
    </div>
  );
}

// ── MULTI-SELECT ──────────────────────────────────────────────────────────────
function MultiSelect({label,options=[],value=[],onChange,placeholder="All"}) {
  const [open,setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(()=>{
    const h = e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[]);
  const sel = Array.isArray(value)?value:[];
  const toggle = o => onChange(sel.includes(o)?sel.filter(x=>x!==o):[...sel,o]);
  const lbl = sel.length===0?placeholder:sel.length===1?sel[0]:`${sel.length} selected`;
  return (
    <div ref={ref} style={{position:"relative",minWidth:140}}>
      {label&&<div style={{fontSize:11,color:THEME.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</div>}
      <button onClick={()=>setOpen(o=>!o)} style={{
        width:"100%",background:"#111827",border:`1px solid ${THEME.border}`,
        borderRadius:6,color:sel.length?THEME.text:THEME.muted,
        padding:"7px 10px",fontSize:13,cursor:"pointer",
        display:"flex",justifyContent:"space-between",alignItems:"center",gap:4
      }}>
        <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lbl}</span>
        <span style={{fontSize:9,opacity:0.5}}>{open?"▲":"▼"}</span>
      </button>
      {open&&(
        <div style={{
          position:"absolute",top:"calc(100% + 4px)",left:0,right:0,
          background:"#0f1623",border:`1px solid ${THEME.border}`,
          borderRadius:6,zIndex:9999,maxHeight:220,overflowY:"auto",
          boxShadow:"0 10px 30px rgba(0,0,0,0.6)"
        }}>
          {sel.length>0&&<div onClick={()=>onChange([])} style={{padding:"7px 12px",fontSize:12,color:THEME.danger,cursor:"pointer",borderBottom:`1px solid ${THEME.border}`}}>✕ Clear</div>}
          {options.map(o=>(
            <div key={o} onClick={()=>toggle(o)} style={{
              padding:"7px 12px",fontSize:13,cursor:"pointer",
              display:"flex",alignItems:"center",gap:8,
              background:sel.includes(o)?"#1a2a4a":"transparent",
              color:sel.includes(o)?"#93c5fd":THEME.text
            }}>
              <span style={{
                width:14,height:14,border:`1px solid ${THEME.accent}`,
                borderRadius:3,flexShrink:0,
                background:sel.includes(o)?THEME.accent:"transparent",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:10
              }}>{sel.includes(o)?"✓":""}</span>
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── KPI CARD ──────────────────────────────────────────────────────────────────
function KpiCard({title,icon,current,previous,diff,pct,isCurrency,loading}) {
  return (
    <div style={{
      background:THEME.card,border:`1px solid ${THEME.border}`,
      borderRadius:12,padding:"20px 22px",flex:1,minWidth:200,
      boxShadow:"0 4px 24px rgba(0,0,0,0.4)",transition:"all 0.2s"
    }}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
        {icon}
        <span style={{fontSize:11,color:THEME.muted,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>{title}</span>
      </div>
      {loading ? (
        <div style={{height:40,background:"#0e2040",borderRadius:6,animation:"pulse 1.5s infinite"}}/>
      ) : (
        <div style={{fontSize:28,fontWeight:800,color:THEME.accent,letterSpacing:"-0.02em"}}>
          {isCurrency?fmt(current,true):fmt(current)}
        </div>
      )}
      <div style={{fontSize:12,color:THEME.muted2,marginTop:4}}>prev year: {isCurrency?fmt(previous,true):fmt(previous)}</div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:10}}>
        <span style={{color:diffClr(diff),fontSize:13,fontWeight:700}}>
          {arw(diff)} {isCurrency?fmt(Math.abs(diff||0),true):fmt(Math.abs(diff||0))}
        </span>
        <span style={{
          background:parseFloat(pct)>=0?"rgba(52,211,153,0.15)":"rgba(248,113,113,0.15)",
          color:diffClr(pct),fontSize:11,padding:"2px 8px",borderRadius:20,fontWeight:700
        }}>{fmtPct(pct)}</span>
      </div>
    </div>
  );
}

// ── SVG ICONS ─────────────────────────────────────────────────────────────────
const IconBookings = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={THEME.accent} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IconPax = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={THEME.accent} strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IconRevenue = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={THEME.accent} strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;

// ── CANVAS CHARTS ─────────────────────────────────────────────────────────────
function LineChart({data,title,yIsCurrency,metricKey="revenue"}) {
  const canvasRef = useRef(null);
  const pointsRef = useRef([]);
  const [tooltip,setTooltip] = useState(null);

  useEffect(()=>{
    if(!canvasRef.current||!data||!data.length)return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio||1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width*dpr; canvas.height = rect.height*dpr;
    ctx.scale(dpr,dpr);
    const W=rect.width, H=rect.height;
    const pad={top:28,right:16,bottom:44,left:yIsCurrency?76:52};
    ctx.clearRect(0,0,W,H);
    pointsRef.current=[];

    const years=[...new Set(data.map(d=>d.year))].sort();
    const byY={};
    years.forEach(y=>{byY[y]={};});
    data.forEach(d=>{if(byY[d.year])byY[d.year][d.month]=d[metricKey];});
    const vals=data.map(d=>d[metricKey]).filter(v=>v!=null&&v>0);
    if(!vals.length)return;
    const maxV=Math.max(...vals)*1.12;
    const sx=m=>pad.left+((m-1)/11)*(W-pad.left-pad.right);
    const sy=v=>H-pad.bottom-(v/maxV)*(H-pad.top-pad.bottom);

    ctx.strokeStyle="#0e2040"; ctx.lineWidth=1;
    for(let i=0;i<=4;i++){
      const yy=sy(maxV*i/4);
      ctx.beginPath();ctx.moveTo(pad.left,yy);ctx.lineTo(W-pad.right,yy);ctx.stroke();
      ctx.fillStyle=THEME.muted;ctx.font="10px sans-serif";ctx.textAlign="right";
      const v=maxV*i/4;
      ctx.fillText(yIsCurrency?(v>=1e6?(v/1e6).toFixed(1)+"M":Math.round(v/1000)+"k"):Math.round(v),pad.left-4,yy+3);
    }
    ctx.fillStyle=THEME.muted;ctx.font="10px sans-serif";ctx.textAlign="center";
    [1,2,3,4,5,6,7,8,9,10,11,12].forEach(m=>ctx.fillText(MONTHS[m-1],sx(m),H-pad.bottom+13));

    years.forEach((y,i)=>{
      const col=YEAR_COLORS[i%YEAR_COLORS.length];
      ctx.strokeStyle=col;ctx.lineWidth=2;ctx.beginPath();let started=false;
      [1,2,3,4,5,6,7,8,9,10,11,12].forEach(m=>{
        const v=byY[y][m];if(v==null)return;
        if(!started){ctx.moveTo(sx(m),sy(v));started=true;}else ctx.lineTo(sx(m),sy(v));
      });
      ctx.stroke();
      [1,2,3,4,5,6,7,8,9,10,11,12].forEach(m=>{
        const v=byY[y][m];if(v==null)return;
        ctx.beginPath();ctx.arc(sx(m),sy(v),3,0,Math.PI*2);
        ctx.fillStyle=col;ctx.fill();
        pointsRef.current.push({x:sx(m),y:sy(v),year:y,month:MONTHS[m-1],value:v});
      });
    });

    let lx=pad.left;
    years.forEach((y,i)=>{
      ctx.fillStyle=YEAR_COLORS[i%YEAR_COLORS.length];ctx.fillRect(lx,8,14,3);
      ctx.fillStyle="#94a3b8";ctx.font="11px sans-serif";ctx.textAlign="left";
      ctx.fillText(y,lx+18,13);lx+=54;
    });
  },[data,metricKey]);

  const handleMouseMove = e => {
    const rect=e.target.getBoundingClientRect();
    const dpr=window.devicePixelRatio||1;
    const mx=(e.clientX-rect.left)*(e.target.width/rect.width/dpr);
    const my=(e.clientY-rect.top)*(e.target.height/rect.height/dpr);
    let nearest=null,minDist=25;
    pointsRef.current.forEach(p=>{
      const d=Math.sqrt((p.x-mx)**2+(p.y-my)**2);
      if(d<minDist){minDist=d;nearest=p;}
    });
    if(nearest) setTooltip({x:e.clientX,y:e.clientY,label:`${nearest.month} ${nearest.year}`,value:yIsCurrency?fmt(nearest.value,true):fmt(nearest.value)});
    else setTooltip(null);
  };

  return (
    <div style={{background:THEME.card,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"16px 18px",position:"relative"}}>
      <div style={{fontSize:12,color:THEME.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,fontWeight:600}}>{title}</div>
      <canvas ref={canvasRef} style={{width:"100%",height:200,display:"block",cursor:"crosshair"}}
        onMouseMove={handleMouseMove} onMouseLeave={()=>setTooltip(null)}/>
      <ChartTooltip tooltip={tooltip}/>
    </div>
  );
}

function BarChart({data,title,metric="bookings"}) {
  const canvasRef = useRef(null);
  const barsRef = useRef([]);
  const [tooltip,setTooltip] = useState(null);

  useEffect(()=>{
    if(!canvasRef.current||!data||!data.length)return;
    const canvas=canvasRef.current;
    const ctx=canvas.getContext("2d");
    const dpr=window.devicePixelRatio||1;
    const rect=canvas.getBoundingClientRect();
    canvas.width=rect.width*dpr;canvas.height=rect.height*dpr;
    ctx.scale(dpr,dpr);
    const W=rect.width,H=rect.height;
    const pad={top:28,right:16,bottom:44,left:52};
    ctx.clearRect(0,0,W,H);
    barsRef.current=[];

    const years=[...new Set(data.map(d=>d.year))].sort();
    const byY={};years.forEach(y=>{byY[y]={};});
    data.forEach(d=>{if(byY[d.year])byY[d.year][d.month]=d[metric]||0;});
    const vals=data.map(d=>d[metric]||0);
    const maxV=Math.max(...vals,1)*1.15;
    const sy=v=>H-pad.bottom-(v/maxV)*(H-pad.top-pad.bottom);
    const slotW=(W-pad.left-pad.right)/12;
    const bW=Math.min((slotW/years.length)-2,13);

    ctx.strokeStyle="#0e2040";ctx.lineWidth=1;
    for(let i=0;i<=4;i++){
      const yy=sy(maxV*i/4);
      ctx.beginPath();ctx.moveTo(pad.left,yy);ctx.lineTo(W-pad.right,yy);ctx.stroke();
      ctx.fillStyle=THEME.muted;ctx.font="10px sans-serif";ctx.textAlign="right";
      ctx.fillText(Math.round(maxV*i/4),pad.left-4,yy+3);
    }
    ctx.fillStyle=THEME.muted;ctx.font="10px sans-serif";ctx.textAlign="center";
    [1,2,3,4,5,6,7,8,9,10,11,12].forEach(m=>ctx.fillText(MONTHS[m-1],pad.left+(m-1)*slotW+slotW/2,H-pad.bottom+13));

    years.forEach((y,i)=>{
      ctx.fillStyle=YEAR_COLORS[i%YEAR_COLORS.length]+"cc";
      [1,2,3,4,5,6,7,8,9,10,11,12].forEach(m=>{
        const v=byY[y][m]||0;if(!v)return;
        const x=pad.left+(m-1)*slotW+i*(bW+2)+(slotW-years.length*(bW+2))/2;
        const barH=(v/maxV)*(H-pad.top-pad.bottom);
        ctx.fillRect(x,sy(v),bW,barH);
        barsRef.current.push({x,y:sy(v),width:bW,height:barH,year:y,month:MONTHS[m-1],value:v});
      });
    });

    let lx=pad.left;
    years.forEach((y,i)=>{
      ctx.fillStyle=YEAR_COLORS[i%YEAR_COLORS.length];ctx.fillRect(lx,8,13,9);
      ctx.fillStyle="#94a3b8";ctx.font="11px sans-serif";ctx.textAlign="left";
      ctx.fillText(y,lx+17,15);lx+=52;
    });
  },[data,metric]);

  const handleMouseMove = e => {
    const rect=e.target.getBoundingClientRect();
    const dpr=window.devicePixelRatio||1;
    const mx=(e.clientX-rect.left)*(e.target.width/rect.width/dpr);
    const my=(e.clientY-rect.top)*(e.target.height/rect.height/dpr);
    const bar=barsRef.current.find(b=>mx>=b.x&&mx<=b.x+b.width&&my>=b.y&&my<=b.y+b.height);
    if(bar) setTooltip({x:e.clientX,y:e.clientY,label:`${bar.month} ${bar.year}`,value:`${fmt(bar.value)} ${metric}`});
    else setTooltip(null);
  };

  return (
    <div style={{background:THEME.card,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"16px 18px",position:"relative"}}>
      <div style={{fontSize:12,color:THEME.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,fontWeight:600}}>{title}</div>
      <canvas ref={canvasRef} style={{width:"100%",height:195,display:"block",cursor:"crosshair"}}
        onMouseMove={handleMouseMove} onMouseLeave={()=>setTooltip(null)}/>
      <ChartTooltip tooltip={tooltip}/>
    </div>
  );
}

function DonutChart({data,title}) {
  const canvasRef = useRef(null);
  const segRef = useRef([]);
  const [tooltip,setTooltip] = useState(null);

  useEffect(()=>{
    if(!canvasRef.current||!data||!data.length)return;
    const canvas=canvasRef.current;
    const ctx=canvas.getContext("2d");
    const dpr=window.devicePixelRatio||1;
    const rect=canvas.getBoundingClientRect();
    canvas.width=rect.width*dpr;canvas.height=rect.height*dpr;
    ctx.scale(dpr,dpr);
    const W=rect.width,H=rect.height;
    ctx.clearRect(0,0,W,H);
    segRef.current=[];

    const cols=["#4f8ef7","#f59e0b","#34d399","#f87171","#a78bfa","#fb7185","#38bdf8"];
    const merged=data.reduce((a,item)=>{
      const key=(item.transport_type||"").toLowerCase().trim();
      const ex=a.find(x=>(x.transport_type||"").toLowerCase().trim()===key);
      if(ex){ex.bookings+=(item.bookings||0);}
      else a.push({...item,transport_type:item.transport_type||"Unknown"});
      return a;
    },[]).sort((a,b)=>(b.bookings||0)-(a.bookings||0));

    const total=merged.reduce((s,d)=>s+(d.bookings||0),0);
    if(!total)return;
    const cx=W*0.36,cy=H/2,r=Math.min(cy,cx)-14,inn=r*0.55;
    let ang=-Math.PI/2;

    merged.forEach((d,i)=>{
      const sl=(d.bookings/total)*Math.PI*2;
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,ang,ang+sl);ctx.closePath();
      ctx.fillStyle=cols[i%cols.length];ctx.fill();
      segRef.current.push({startAngle:ang,endAngle:ang+sl,label:d.transport_type,value:d.bookings,pct:((d.bookings/total)*100).toFixed(1)});
      ang+=sl;
    });

    ctx.beginPath();ctx.arc(cx,cy,inn,0,Math.PI*2);ctx.fillStyle=THEME.card;ctx.fill();
    ctx.fillStyle=THEME.text;ctx.font="bold 14px sans-serif";ctx.textAlign="center";
    ctx.fillText(total.toLocaleString(),cx,cy+4);
    ctx.fillStyle=THEME.muted;ctx.font="10px sans-serif";ctx.fillText("bookings",cx,cy+16);

    let ly=12;
    merged.slice(0,7).forEach((d,i)=>{
      ctx.fillStyle=cols[i%cols.length];ctx.fillRect(W*0.63,ly,10,10);
      ctx.fillStyle="#94a3b8";ctx.font="11px sans-serif";ctx.textAlign="left";
      ctx.fillText(`${d.transport_type} (${((d.bookings/total)*100).toFixed(0)}%)`,W*0.63+14,ly+8);
      ly+=19;
    });
  },[data]);

  const handleMouseMove = e => {
    const rect=e.target.getBoundingClientRect();
    const dpr=window.devicePixelRatio||1;
    const mx=(e.clientX-rect.left)*(e.target.width/rect.width/dpr);
    const my=(e.clientY-rect.top)*(e.target.height/rect.height/dpr);
    const W=rect.width,H=rect.height;
    const cx=W*0.36,cy=H/2;
    const angle=Math.atan2(my-cy,mx-cx);
    const normAngle=angle<-Math.PI/2?angle+Math.PI*2:angle;
    const seg=segRef.current.find(s=>normAngle>=s.startAngle&&normAngle<=s.endAngle);
    if(seg) setTooltip({x:e.clientX,y:e.clientY,label:seg.label,value:`${fmt(seg.value)} bookings (${seg.pct}%)`});
    else setTooltip(null);
  };

  return (
    <div style={{background:THEME.card,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"16px 18px",position:"relative"}}>
      <div style={{fontSize:12,color:THEME.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,fontWeight:600}}>{title}</div>
      <canvas ref={canvasRef} style={{width:"100%",height:190,display:"block",cursor:"crosshair"}}
        onMouseMove={handleMouseMove} onMouseLeave={()=>setTooltip(null)}/>
      <ChartTooltip tooltip={tooltip}/>
    </div>
  );
}

function BusClassChart({data,title,metric="bookings"}) {
  const canvasRef = useRef(null);
  const barsRef = useRef([]);
  const [tooltip,setTooltip] = useState(null);
  const CLASSES=["Royal Class","First Class","Dream Class","Sleep/Royal Class","Premium Class"];
  const DS_COLORS={Snowtravel:"#4f8ef7",Solmar:"#34d399",Interbus:"#f59e0b","Solmar DE":"#f87171"};

  useEffect(()=>{
    if(!canvasRef.current||!data||!data.length)return;
    const canvas=canvasRef.current;
    const ctx=canvas.getContext("2d");
    const dpr=window.devicePixelRatio||1;
    const rect=canvas.getBoundingClientRect();
    canvas.width=rect.width*dpr;canvas.height=rect.height*dpr;
    ctx.scale(dpr,dpr);
    const W=rect.width,H=rect.height;
    const pad={top:28,right:20,bottom:60,left:60};
    ctx.clearRect(0,0,W,H);
    barsRef.current=[];

    const classes=[...new Set(data.map(d=>d.bus_class))].filter(Boolean);
    const datasets=[...new Set(data.map(d=>d.dataset))].filter(Boolean);
    const lookup={};
    data.forEach(d=>{if(!lookup[d.bus_class])lookup[d.bus_class]={};lookup[d.bus_class][d.dataset]=d[metric]||0;});

    const vals=data.map(d=>d[metric]||0);
    const maxV=Math.max(...vals,1)*1.15;
    const sy=v=>H-pad.bottom-(v/maxV)*(H-pad.top-pad.bottom);
    const slotW=(W-pad.left-pad.right)/classes.length;
    const bW=Math.min((slotW/datasets.length)-3,18);

    ctx.strokeStyle="#0e2040";ctx.lineWidth=1;
    for(let i=0;i<=4;i++){
      const yy=sy(maxV*i/4);
      ctx.beginPath();ctx.moveTo(pad.left,yy);ctx.lineTo(W-pad.right,yy);ctx.stroke();
      ctx.fillStyle=THEME.muted;ctx.font="10px sans-serif";ctx.textAlign="right";
      const v=maxV*i/4;
      ctx.fillText(v>=1e6?(v/1e6).toFixed(1)+"M":v>=1000?Math.round(v/1000)+"k":Math.round(v),pad.left-4,yy+3);
    }

    classes.forEach((cls,ci)=>{
      ctx.fillStyle=THEME.muted;ctx.font="10px sans-serif";ctx.textAlign="center";
      const clsX=pad.left+ci*slotW+slotW/2;
      const shortCls=cls.replace(" Class","").replace("Sleep/Royal","Slp/Ryl");
      ctx.fillText(shortCls,clsX,H-pad.bottom+14);

      datasets.forEach((ds,di)=>{
        const v=lookup[cls]?.[ds]||0;if(!v)return;
        const x=pad.left+ci*slotW+(slotW-datasets.length*(bW+3))/2+di*(bW+3);
        const barH=(v/maxV)*(H-pad.top-pad.bottom);
        ctx.fillStyle=(DS_COLORS[ds]||"#64748b")+"cc";
        ctx.fillRect(x,sy(v),bW,barH);
        barsRef.current.push({x,y:sy(v),width:bW,height:barH,cls,ds,value:v});
      });
    });

    let lx=pad.left;
    datasets.forEach(ds=>{
      ctx.fillStyle=DS_COLORS[ds]||"#64748b";ctx.fillRect(lx,H-24,12,10);
      ctx.fillStyle="#94a3b8";ctx.font="10px sans-serif";ctx.textAlign="left";
      ctx.fillText(ds,lx+15,H-16);lx+=ds.length*6+30;
    });
  },[data,metric]);

  const handleMouseMove = e => {
    const rect=e.target.getBoundingClientRect();
    const dpr=window.devicePixelRatio||1;
    const mx=(e.clientX-rect.left)*(e.target.width/rect.width/dpr);
    const my=(e.clientY-rect.top)*(e.target.height/rect.height/dpr);
    const bar=barsRef.current.find(b=>mx>=b.x&&mx<=b.x+b.width&&my>=b.y&&my<=b.y+b.height);
    if(bar) setTooltip({x:e.clientX,y:e.clientY,label:`${bar.cls} · ${bar.ds}`,value:`${fmt(bar.value)} ${metric}`});
    else setTooltip(null);
  };

  return (
    <div style={{background:THEME.card,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"16px 18px",position:"relative"}}>
      <div style={{fontSize:12,color:THEME.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,fontWeight:600}}>{title}</div>
      <canvas ref={canvasRef} style={{width:"100%",height:260,display:"block",cursor:"crosshair"}}
        onMouseMove={handleMouseMove} onMouseLeave={()=>setTooltip(null)}/>
      <ChartTooltip tooltip={tooltip}/>
    </div>
  );
}

// ── LEAFLET MAP ───────────────────────────────────────────────────────────────
function LeafletMap({departureData,metric,appliedFilters}) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);

  useEffect(()=>{
    if(!document.getElementById("leaflet-css")){
      const link=document.createElement("link");
      link.id="leaflet-css";link.rel="stylesheet";
      link.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const initMap=()=>{
      if(!mapRef.current||mapInstance.current)return;
      const L=window.L;
      const map=L.map(mapRef.current,{center:[50.85,4.35],zoom:8});
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{
        attribution:"© OpenStreetMap © CARTO",maxZoom:19
      }).addTo(map);
      mapInstance.current=map;
    };
    if(window.L){initMap();return;}
    const script=document.createElement("script");
    script.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload=()=>initMap();
    document.head.appendChild(script);
  },[]);

  useEffect(()=>{
    const timer=setTimeout(()=>{if(window.L&&mapInstance.current)updateMarkers();},500);
    return()=>clearTimeout(timer);
  },[departureData,metric,appliedFilters]);

  function getColor(ratio,status) {
    if(status==="ok"){
      if(ratio<0.25)return"#bbf7d0";if(ratio<0.5)return"#4ade80";
      if(ratio<0.75)return"#16a34a";return"#166534";
    }
    if(status==="cancelled"){
      if(ratio<0.25)return"#fecaca";if(ratio<0.5)return"#f87171";
      if(ratio<0.75)return"#dc2626";return"#991b1b";
    }
    if(ratio<0.25)return"#bfdbfe";if(ratio<0.5)return"#60a5fa";
    if(ratio<0.75)return"#2563eb";return"#1e3a8a";
  }

  function updateMarkers() {
    const L=window.L;const map=mapInstance.current;
    if(!map||!L)return;
    markersRef.current.forEach(m=>map.removeLayer(m));markersRef.current=[];
    if(!departureData||!departureData.length)return;
    const vals=departureData.map(d=>d[metric]||0).filter(Boolean);
    const maxVal=Math.max(...vals,1);
    const statusFilter=(appliedFilters?.statuses||[])[0]||"";

    departureData.forEach(d=>{
      const key=Object.keys(CITY_COORDS).find(k=>
        d.destination?.toLowerCase()===k.toLowerCase()||
        d.destination?.toLowerCase().includes(k.toLowerCase().split(" ")[0].toLowerCase())
      );
      if(!key)return;
      const [lat,lng]=CITY_COORDS[key];
      const val=d[metric]||0;if(!val)return;
      const ratio=val/maxVal;
      const radius=Math.max(8,Math.round(ratio*38));

      const marker=L.circleMarker([lat,lng],{
        radius,fillColor:getColor(ratio,statusFilter),
        color:"rgba(255,255,255,0.3)",weight:1,fillOpacity:0.8
      }).bindPopup(`
        <div style="font-family:'Segoe UI',sans-serif;min-width:160px;padding:4px;">
          <div style="font-size:14px;font-weight:700;color:#38bdf8;margin-bottom:6px;">${d.destination}</div>
          <div style="font-size:12px;line-height:1.8;color:#e2e8f0;">
            📋 Bookings: <b>${(d.bookings||0).toLocaleString()}</b><br/>
            👥 PAX: <b>${(d.pax||0).toLocaleString()}</b><br/>
            💰 Revenue: <b>€${Math.round(d.revenue||0).toLocaleString()}</b>
          </div>
        </div>
      `,{maxWidth:220});

      marker.bindTooltip(d.destination,{
        permanent:true,direction:"top",
        offset:[0,-radius-4],className:"ttp-map-label"
      });

      marker.addTo(map);
      markersRef.current.push(marker);
    });
  }

  return <div ref={mapRef} style={{width:"100%",height:420,borderRadius:8,overflow:"hidden"}}/>;
}

// ── YEAR-MONTH TABLE ──────────────────────────────────────────────────────────
function YMTable({data}) {
  const [hovered,setHovered] = useState(null);
  if(!data||!data.length) return <div style={{textAlign:"center",color:THEME.muted,padding:32,fontSize:13}}>Apply filters to load data</div>;
  return (
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead>
          <tr style={{background:"#080c14"}}>
            {["Date","Bookings","Prev","Δ","Δ%","PAX","Prev","Δ","Δ%","Revenue","Prev Revenue","Δ Revenue","Δ%"].map((h,i)=>(
              <th key={i} style={{padding:"9px 10px",color:THEME.muted,fontWeight:600,fontSize:11,
                textTransform:"uppercase",letterSpacing:"0.05em",
                textAlign:i===0?"left":"right",borderBottom:`1px solid ${THEME.border}`,whiteSpace:"nowrap"}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row,idx)=>{
            const bp=row.previousBookings?((row.currentBookings-row.previousBookings)/row.previousBookings*100):null;
            const pp=row.previousPax?((row.currentPax-row.previousPax)/row.previousPax*100):null;
            const rp=row.previousRevenue?((row.currentRevenue-row.previousRevenue)/row.previousRevenue*100):null;
            return (
              <tr key={idx}
                onMouseEnter={()=>setHovered(idx)}
                onMouseLeave={()=>setHovered(null)}
                style={{background:hovered===idx?THEME.cardHover:idx%2===0?THEME.card:"#080c14",transition:"background 0.15s"}}>
                <td style={{padding:"7px 10px",color:"#93c5fd",fontWeight:600,whiteSpace:"nowrap"}}>{MONTHS[(row.month||1)-1]}-{row.year}</td>
                <td style={{padding:"7px 10px",textAlign:"right",color:THEME.text}}>{fmt(row.currentBookings)}</td>
                <td style={{padding:"7px 10px",textAlign:"right",color:THEME.muted2}}>{fmt(row.previousBookings)}</td>
                <td style={{padding:"7px 10px",textAlign:"right",color:diffClr(row.diffBookings),fontWeight:600}}>{arw(row.diffBookings)}{fmt(Math.abs(row.diffBookings||0))}</td>
                <td style={{padding:"7px 10px",textAlign:"right",color:diffClr(bp)}}>{fmtPct(bp)}</td>
                <td style={{padding:"7px 10px",textAlign:"right",color:THEME.text}}>{fmt(row.currentPax)}</td>
                <td style={{padding:"7px 10px",textAlign:"right",color:THEME.muted2}}>{fmt(row.previousPax)}</td>
                <td style={{padding:"7px 10px",textAlign:"right",color:diffClr(row.diffPax),fontWeight:600}}>{arw(row.diffPax)}{fmt(Math.abs(row.diffPax||0))}</td>
                <td style={{padding:"7px 10px",textAlign:"right",color:diffClr(pp)}}>{fmtPct(pp)}</td>
                <td style={{padding:"7px 10px",textAlign:"right",color:THEME.text}}>{fmt(row.currentRevenue,true)}</td>
                <td style={{padding:"7px 10px",textAlign:"right",color:THEME.muted2}}>{fmt(row.previousRevenue,true)}</td>
                <td style={{padding:"7px 10px",textAlign:"right",color:diffClr(row.diffRevenue),fontWeight:600}}>{arw(row.diffRevenue)}{fmt(Math.abs(row.diffRevenue||0),true)}</td>
                <td style={{padding:"7px 10px",textAlign:"right",color:diffClr(rp)}}>{fmtPct(rp)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── BUS TRIPS TABLE ───────────────────────────────────────────────────────────
function BusTripsTable({rows,loading}) {
  const [page,setPage] = useState(0);
  const [hovered,setHovered] = useState(null);
  const PAGE=50;
  useEffect(()=>setPage(0),[rows]);
  if(loading) return <div style={{textAlign:"center",color:THEME.muted,padding:32}}>Loading…</div>;
  if(!rows||!rows.length) return <div style={{textAlign:"center",color:THEME.muted,padding:32}}>No data — apply filters</div>;
  const pr=rows.slice(page*PAGE,(page+1)*PAGE);
  const TH=({border,children})=>(<th style={{padding:"8px 9px",color:THEME.muted,fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:"0.04em",textAlign:"center",borderBottom:`1px solid ${THEME.border}`,whiteSpace:"nowrap",borderLeft:border?`2px solid ${border}`:undefined}}>{children}</th>);
  const TD=({v,bold,border})=>(<td style={{padding:"7px 9px",textAlign:"right",color:bold?THEME.text:THEME.text,fontWeight:bold?700:400,borderLeft:border?`2px solid ${border}`:undefined}}>{v??0}</td>);
  const DD=({v,border})=>{const n=parseInt(v);return isNaN(n)?<td style={{padding:"7px 9px",textAlign:"right",color:THEME.muted2,borderLeft:border?`2px solid ${border}`:undefined}}>—</td>:<td style={{padding:"7px 9px",textAlign:"right",color:n===0?"#94a3b8":n>0?THEME.success:THEME.danger,fontWeight:700,borderLeft:border?`2px solid ${border}`:undefined}}>{n>0?"+":""}{n}</td>;};

  return (
    <div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr style={{background:"#080c14"}}>
              <th colSpan={2} style={{padding:"8px 9px",color:THEME.muted,fontWeight:600,fontSize:11,textTransform:"uppercase",borderBottom:`1px solid ${THEME.border}`,textAlign:"center"}}>Trip Dates</th>
              <th colSpan={4} style={{padding:"8px 9px",color:"#93c5fd",fontWeight:600,fontSize:11,textTransform:"uppercase",borderBottom:`1px solid ${THEME.border}`,borderLeft:"2px solid #4f8ef7",textAlign:"center",background:"rgba(79,142,247,0.04)"}}>Outbound ↗</th>
              <th colSpan={4} style={{padding:"8px 9px",color:THEME.success,fontWeight:600,fontSize:11,textTransform:"uppercase",borderBottom:`1px solid ${THEME.border}`,borderLeft:`2px solid ${THEME.success}`,textAlign:"center",background:"rgba(52,211,153,0.04)"}}>Return ↙</th>
              <th colSpan={4} style={{padding:"8px 9px",color:THEME.warning,fontWeight:600,fontSize:11,textTransform:"uppercase",borderBottom:`1px solid ${THEME.border}`,borderLeft:`2px solid ${THEME.warning}`,textAlign:"center",background:"rgba(251,191,36,0.04)"}}>Difference</th>
            </tr>
            <tr style={{background:"#0a0e18"}}>
              <TH>Start</TH><TH>End</TH>
              <TH border="#4f8ef7">RC</TH><TH>FC</TH><TH>PRE</TH><TH>Total</TH>
              <TH border={THEME.success}>RC</TH><TH>FC</TH><TH>PRE</TH><TH>Total</TH>
              <TH border={THEME.warning}>RC</TH><TH>FC</TH><TH>PRE</TH><TH>Total</TH>
            </tr>
          </thead>
          <tbody>
            {pr.map((row,idx)=>(
              <tr key={idx}
                onMouseEnter={()=>setHovered(idx)}
                onMouseLeave={()=>setHovered(null)}
                style={{background:hovered===idx?THEME.cardHover:idx%2===0?THEME.card:"#080c14",transition:"background 0.15s"}}>
                <td style={{padding:"7px 9px",color:"#93c5fd",whiteSpace:"nowrap",fontWeight:600}}>{row.StartDate}</td>
                <td style={{padding:"7px 9px",color:THEME.muted,whiteSpace:"nowrap"}}>{row.EndDate}</td>
                <TD v={row.ORC} border="#4f8ef7"/><TD v={row.OFC}/><TD v={row.OPRE}/><TD v={row.OTotal} bold/>
                <TD v={row.RRC} border={THEME.success}/><TD v={row.RFC}/><TD v={row.RPRE}/><TD v={row.RTotal} bold/>
                <DD v={row.RC_Diff} border={THEME.warning}/><DD v={row.FC_Diff}/><DD v={row.PRE_Diff}/><DD v={row.Total_Difference}/>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length>PAGE&&(
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderTop:`1px solid ${THEME.border}`,fontSize:12}}>
          <span style={{color:THEME.muted}}>{page*PAGE+1}–{Math.min((page+1)*PAGE,rows.length)} of {rows.length}</span>
          <button disabled={page===0} onClick={()=>setPage(p=>p-1)} style={{padding:"4px 12px",background:page===0?"#111827":"#1a2a4a",border:`1px solid ${THEME.border}`,borderRadius:5,color:page===0?THEME.muted:"#93c5fd",cursor:page===0?"default":"pointer"}}>← Prev</button>
          <button disabled={(page+1)*PAGE>=rows.length} onClick={()=>setPage(p=>p+1)} style={{padding:"4px 12px",background:(page+1)*PAGE>=rows.length?"#111827":"#1a2a4a",border:`1px solid ${THEME.border}`,borderRadius:5,color:(page+1)*PAGE>=rows.length?THEME.muted:"#93c5fd",cursor:(page+1)*PAGE>=rows.length?"default":"pointer"}}>Next →</button>
        </div>
      )}
    </div>
  );
}

// ── SNOWTRAVEL TABLE ──────────────────────────────────────────────────────────
function SnowTravelTable({rows,loading}) {
  const [hovered,setHovered] = useState(null);
  if(loading) return <div style={{textAlign:"center",color:THEME.muted,padding:32}}>Loading…</div>;
  if(!rows||!rows.length) return <div style={{textAlign:"center",color:THEME.muted,padding:32}}>No data</div>;
  return (
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead>
          <tr style={{background:"#080c14"}}>
            {["Departure","Return","Dream Class","First Class","Sleep/Royal","Total PAX"].map((h,i)=>(
              <th key={i} style={{padding:"9px 12px",color:THEME.muted,fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:"0.05em",textAlign:i<2?"left":"right",borderBottom:`1px solid ${THEME.border}`,whiteSpace:"nowrap"}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row,idx)=>(
            <tr key={idx}
              onMouseEnter={()=>setHovered(idx)}
              onMouseLeave={()=>setHovered(null)}
              style={{background:hovered===idx?THEME.cardHover:idx%2===0?THEME.card:"#080c14",transition:"background 0.15s"}}>
              <td style={{padding:"7px 12px",color:"#93c5fd",fontWeight:600}}>{row.departure_date}</td>
              <td style={{padding:"7px 12px",color:THEME.muted}}>{row.return_date}</td>
              <td style={{padding:"7px 12px",textAlign:"right",color:THEME.text}}>{row.dream_class||0}</td>
              <td style={{padding:"7px 12px",textAlign:"right",color:THEME.text}}>{row.first_class||0}</td>
              <td style={{padding:"7px 12px",textAlign:"right",color:THEME.text}}>{row.sleep_royal||"—"}</td>
              <td style={{padding:"7px 12px",textAlign:"right",color:THEME.text,fontWeight:700}}>{row.total_pax||0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── AI ASSISTANT ──────────────────────────────────────────────────────────────
const SUGGESTIONS=[
  "What is the total revenue for Solmar in 2025?",
  "Compare bookings between 2024 and 2025",
  "Which departure city has the most PAX?",
  "What is the bus occupancy for Royal Class?",
  "Show revenue breakdown by transport type",
  "Which month has highest bookings in 2026?",
  "What is the difference between Snowtravel and Solmar revenue?",
  "How many PAX travelled in February 2025?",
];

function AiAssistant({onUnauth}) {
  const [msgs,setMsgs] = useState([{role:"assistant",text:"Hi! I'm TTP AI Assistant. Ask me anything about your booking data — revenue, PAX, trends, or comparisons across Snowtravel, Solmar, and Interbus."}]);
  const [input,setInput] = useState("");
  const [loading,setLoading] = useState(false);
  const bottomRef = useRef(null);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);

  const send = async text => {
    const q=text||input;if(!q.trim())return;
    setInput("");setMsgs(m=>[...m,{role:"user",text:q}]);setLoading(true);
    try {
      const t=localStorage.getItem("ttp_token");
      const r=await fetch(`${BASE}/api/ai/chat`,{
        method:"POST",
        headers:{"Authorization":`Bearer ${t}`,"Content-Type":"application/json"},
        body:JSON.stringify({message:q})
      });
      if(r.status===401){onUnauth();return;}
      const d=await r.json();
      setMsgs(m=>[...m,{role:"assistant",text:d.reply||"No response."}]);
    } catch(e) {
      setMsgs(m=>[...m,{role:"assistant",text:"Sorry, I could not connect. Make sure the backend is running."}]);
    }
    setLoading(false);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:THEME.card,border:`1px solid ${THEME.border}`,borderRadius:10,overflow:"hidden"}}>
      <div style={{padding:"14px 18px",borderBottom:`1px solid ${THEME.border}`,display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:32,height:32,background:"linear-gradient(135deg,#4f8ef7,#a78bfa)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🤖</div>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:THEME.text}}>TTP AI Assistant</div>
          <div style={{fontSize:11,color:THEME.muted}}>Powered by Claude · Live data</div>
        </div>
        <div style={{marginLeft:"auto",width:8,height:8,borderRadius:"50%",background:THEME.success}}/>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
            <div style={{
              maxWidth:"85%",padding:"10px 14px",
              borderRadius:m.role==="user"?"10px 10px 2px 10px":"10px 10px 10px 2px",
              background:m.role==="user"?"#1e3a6e":"#111827",
              color:m.role==="user"?"#bfdbfe":THEME.text,
              fontSize:13,lineHeight:1.55,
              border:m.role==="assistant"?`1px solid ${THEME.border}`:undefined,
              whiteSpace:"pre-wrap"
            }}>{m.text}</div>
          </div>
        ))}
        {loading&&<div style={{display:"flex",justifyContent:"flex-start"}}><div style={{background:"#111827",border:`1px solid ${THEME.border}`,borderRadius:"10px 10px 10px 2px",padding:"10px 16px",color:THEME.muted,fontSize:13}}>⟳ Analysing data…</div></div>}
        <div ref={bottomRef}/>
      </div>
      <div style={{padding:"8px 14px",borderTop:`1px solid ${THEME.border}`,display:"flex",gap:6,flexWrap:"wrap"}}>
        {SUGGESTIONS.slice(0,3).map((s,i)=>(
          <button key={i} onClick={()=>send(s)} style={{background:"#111827",border:`1px solid ${THEME.border}`,borderRadius:20,color:THEME.muted,fontSize:11,padding:"4px 10px",cursor:"pointer",whiteSpace:"nowrap"}}>{s}</button>
        ))}
      </div>
      <div style={{padding:"10px 14px",borderTop:`1px solid ${THEME.border}`,display:"flex",gap:8}}>
        <input value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
          placeholder="Ask about revenue, bookings, PAX, trends…"
          style={{flex:1,background:"#080c14",border:`1px solid ${THEME.border}`,borderRadius:7,color:THEME.text,padding:"9px 12px",fontSize:13,outline:"none"}}/>
        <button onClick={()=>send()} disabled={!input.trim()||loading} style={{
          background:input.trim()&&!loading?THEME.accent:"#111827",border:"none",
          borderRadius:7,color:input.trim()&&!loading?THEME.bg:THEME.muted2,
          padding:"9px 16px",fontSize:13,cursor:input.trim()&&!loading?"pointer":"default",fontWeight:700
        }}>Send</button>
      </div>
    </div>
  );
}

// ── FILTERS PANEL ─────────────────────────────────────────────────────────────
function FiltersPanel({filters,setFilters,slicers,onApply,onReset}) {
  const set=(k,v)=>setFilters(p=>({...p,[k]:v}));
  const inputStyle={background:"#111827",border:`1px solid ${THEME.border}`,borderRadius:6,color:THEME.text,padding:"7px 10px",fontSize:13,width:136};
  const Group=({label,children})=>(<div><div style={{fontSize:11,color:THEME.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</div><div style={{display:"flex",gap:5}}>{children}</div></div>);
  return (
    <div style={{background:"#080c14",borderBottom:`1px solid ${THEME.border}`,padding:"12px 24px"}}>
      <div style={{display:"flex",flexWrap:"wrap",gap:12,alignItems:"flex-end"}}>
        <Group label="Booking Date">
          <input type="date" value={filters.bookingDateFrom||""} onChange={e=>set("bookingDateFrom",e.target.value)} style={inputStyle}/>
          <input type="date" value={filters.bookingDateTo||""} onChange={e=>set("bookingDateTo",e.target.value)} style={inputStyle}/>
        </Group>
        <Group label="Departure Date">
          <input type="date" value={filters.departureDateFrom||""} onChange={e=>set("departureDateFrom",e.target.value)} style={inputStyle}/>
          <input type="date" value={filters.departureDateTo||""} onChange={e=>set("departureDateTo",e.target.value)} style={inputStyle}/>
        </Group>
        <Group label="Return Date">
          <input type="date" value={filters.returnDateFrom||""} onChange={e=>set("returnDateFrom",e.target.value)} style={inputStyle}/>
          <input type="date" value={filters.returnDateTo||""} onChange={e=>set("returnDateTo",e.target.value)} style={inputStyle}/>
        </Group>
        <MultiSelect label="Dataset" options={slicers.datasets||[]} value={filters.datasets||[]} onChange={v=>set("datasets",v)}/>
        <MultiSelect label="Transport" options={slicers.transportTypes||[]} value={filters.transportTypes||[]} onChange={v=>set("transportTypes",v)}/>
        <MultiSelect label="Bus Type" options={slicers.busTypes||[]} value={filters.busTypes||[]} onChange={v=>set("busTypes",v)}/>
        <MultiSelect label="Status" options={["ok","cancelled"]} value={filters.statuses||[]} onChange={v=>set("statuses",v)} placeholder="All statuses"/>
        <div style={{display:"flex",gap:8,alignSelf:"flex-end"}}>
          <button onClick={onApply} style={{background:THEME.accent,border:"none",borderRadius:7,color:THEME.bg,padding:"8px 18px",fontWeight:700,fontSize:13,cursor:"pointer"}}>Apply</button>
          <button onClick={onReset} style={{background:"#111827",border:`1px solid ${THEME.border}`,borderRadius:7,color:"#94a3b8",padding:"8px 13px",fontSize:13,cursor:"pointer"}}>Reset</button>
        </div>
      </div>
    </div>
  );
}

// ── EXPORT MODAL ──────────────────────────────────────────────────────────────
function ExportModal({onClose,applied}) {
  const [datasets,setDatasets] = useState([]);
  const [status,setStatus] = useState("all");
  const [bookingFrom,setBookingFrom] = useState("");
  const [bookingTo,setBookingTo] = useState("");
  const [departureFrom,setDepartureFrom] = useState("");
  const [departureTo,setDepartureTo] = useState("");

  const DATASETS=["Snowtravel","Solmar","Interbus","Solmar DE"];
  const toggleDS=d=>setDatasets(prev=>prev.includes(d)?prev.filter(x=>x!==d):[...prev,d]);

  const buildParams=()=>{
    const p=new URLSearchParams();
    p.set("token",localStorage.getItem("ttp_token"));
    if(datasets.length)datasets.forEach(d=>p.append("dataset",d));
    if(status!=="all")p.set("status",status);
    if(bookingFrom)p.set("bookingDateFrom",bookingFrom);
    if(bookingTo)p.set("bookingDateTo",bookingTo);
    if(departureFrom)p.set("departureDateFrom",departureFrom);
    if(departureTo)p.set("departureDateTo",departureTo);
    return p.toString();
  };

  const downloadCSV=()=>{window.open(`${BASE}/api/dashboard/export?${buildParams()}`,"_blank");onClose();};
  const exportPDF=()=>window.print();
  const exportJPG=async()=>{
    try{
      const h2c=(await import("html2canvas")).default;
      const el=document.getElementById("dashboard-content");
      if(!el)return;
      const canvas=await h2c(el,{backgroundColor:THEME.bg,scale:2,useCORS:true});
      const link=document.createElement("a");
      link.download=`ttp-dashboard-${new Date().toISOString().split("T")[0]}.jpg`;
      link.href=canvas.toDataURL("image/jpeg",0.92);link.click();
    }catch(e){console.error(e);}
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
      <div style={{background:THEME.card,border:`1px solid ${THEME.border}`,borderRadius:14,padding:28,width:460,maxWidth:"90vw",boxShadow:"0 24px 80px rgba(0,0,0,0.7)"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:16,fontWeight:700,color:THEME.text}}>Export Data</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:THEME.muted,cursor:"pointer",fontSize:18}}>✕</button>
        </div>

        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,color:THEME.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8,fontWeight:600}}>Dataset</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {DATASETS.map(d=>(
              <label key={d} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:THEME.text}}>
                <input type="checkbox" checked={datasets.includes(d)} onChange={()=>toggleDS(d)} style={{accentColor:THEME.accent}}/>
                {d}
              </label>
            ))}
          </div>
        </div>

        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,color:THEME.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8,fontWeight:600}}>Status</div>
          <div style={{display:"flex",gap:16}}>
            {[["all","All"],["ok","OK only"],["cancelled","Cancelled only"]].map(([v,l])=>(
              <label key={v} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:13,color:THEME.text}}>
                <input type="radio" name="status" value={v} checked={status===v} onChange={()=>setStatus(v)} style={{accentColor:THEME.accent}}/>
                {l}
              </label>
            ))}
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
          <div>
            <div style={{fontSize:11,color:THEME.muted,marginBottom:6,textTransform:"uppercase"}}>Booking From</div>
            <input type="date" value={bookingFrom} onChange={e=>setBookingFrom(e.target.value)} style={{width:"100%",background:"#080c14",border:`1px solid ${THEME.border}`,borderRadius:6,color:THEME.text,padding:"7px 10px",fontSize:13}}/>
          </div>
          <div>
            <div style={{fontSize:11,color:THEME.muted,marginBottom:6,textTransform:"uppercase"}}>Booking To</div>
            <input type="date" value={bookingTo} onChange={e=>setBookingTo(e.target.value)} style={{width:"100%",background:"#080c14",border:`1px solid ${THEME.border}`,borderRadius:6,color:THEME.text,padding:"7px 10px",fontSize:13}}/>
          </div>
          <div>
            <div style={{fontSize:11,color:THEME.muted,marginBottom:6,textTransform:"uppercase"}}>Departure From</div>
            <input type="date" value={departureFrom} onChange={e=>setDepartureFrom(e.target.value)} style={{width:"100%",background:"#080c14",border:`1px solid ${THEME.border}`,borderRadius:6,color:THEME.text,padding:"7px 10px",fontSize:13}}/>
          </div>
          <div>
            <div style={{fontSize:11,color:THEME.muted,marginBottom:6,textTransform:"uppercase"}}>Departure To</div>
            <input type="date" value={departureTo} onChange={e=>setDepartureTo(e.target.value)} style={{width:"100%",background:"#080c14",border:`1px solid ${THEME.border}`,borderRadius:6,color:THEME.text,padding:"7px 10px",fontSize:13}}/>
          </div>
        </div>

        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={downloadCSV} style={{flex:1,background:THEME.accent,border:"none",borderRadius:8,color:THEME.bg,padding:"11px 16px",fontWeight:700,fontSize:13,cursor:"pointer"}}>↓ Download CSV</button>
          <button onClick={exportPDF} style={{flex:1,background:"#1e2a4a",border:`1px solid ${THEME.border}`,borderRadius:8,color:THEME.text,padding:"11px 16px",fontSize:13,cursor:"pointer"}}>PDF</button>
          <button onClick={exportJPG} style={{flex:1,background:"#1e2a4a",border:`1px solid ${THEME.border}`,borderRadius:8,color:THEME.text,padding:"11px 16px",fontSize:13,cursor:"pointer"}}>JPG</button>
          <button onClick={()=>{window.print();}} style={{flex:1,background:"#1e2a4a",border:`1px solid ${THEME.border}`,borderRadius:8,color:THEME.text,padding:"11px 16px",fontSize:13,cursor:"pointer"}}>Print</button>
        </div>
      </div>
    </div>
  );
}

// ── NOTIFICATION PANEL ────────────────────────────────────────────────────────
function NotifPanel({dashStatus,onClose}) {
  const [email,setEmail] = useState("");
  const [saved,setSaved] = useState(false);
  const [saving,setSaving] = useState(false);

  const saveEmail=async()=>{
    if(!email.includes("@"))return;
    setSaving(true);
    try{
      const t=localStorage.getItem("ttp_token");
      const r=await fetch(`${BASE}/api/ai/notify`,{
        method:"POST",
        headers:{"Authorization":`Bearer ${t}`,"Content-Type":"application/json"},
        body:JSON.stringify({email})
      });
      const d=await r.json();
      if(d.success)setSaved(true);
    }catch(e){}
    setSaving(false);
  };

  return (
    <div style={{position:"absolute",top:"calc(100% + 8px)",right:0,width:300,background:THEME.card,border:`1px solid ${THEME.border}`,borderRadius:12,padding:18,zIndex:9999,boxShadow:"0 16px 48px rgba(0,0,0,0.6)"}}>
      <div style={{fontSize:13,fontWeight:700,color:THEME.text,marginBottom:12}}>Dashboard Status</div>
      {dashStatus&&(
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:THEME.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.06em"}}>Last Checked</div>
          <div style={{fontSize:12,color:THEME.accent,marginBottom:10}}>{dashStatus.dubaiTime}</div>
          <div style={{fontSize:11,color:THEME.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.06em"}}>Datasets</div>
          {(dashStatus.datasets||[]).map(d=>(
            <div key={d.dataset} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${THEME.border}`,fontSize:12}}>
              <span style={{color:THEME.text}}>{d.dataset}</span>
              <span style={{color:THEME.accent}}>{Number(d.total_bookings).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{fontSize:11,color:THEME.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.06em"}}>Email Notifications</div>
      {saved?(
        <div style={{fontSize:12,color:THEME.success}}>✓ Notifications enabled for {email}</div>
      ):(
        <div style={{display:"flex",gap:6}}>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com"
            style={{flex:1,background:"#050d1a",border:`1px solid ${THEME.border}`,borderRadius:6,color:THEME.text,padding:"7px 10px",fontSize:12,outline:"none"}}/>
          <button onClick={saveEmail} disabled={saving||!email.includes("@")} style={{background:THEME.accent,border:"none",borderRadius:6,color:THEME.bg,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
            {saving?"...":"Save"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [token,setToken] = useState(()=>localStorage.getItem("ttp_token"));
  const [user,setUser] = useState(()=>{
    try{
      const t=localStorage.getItem("ttp_token");if(!t)return null;
      const p=JSON.parse(atob(t.split(".")[1]));
      if(p.exp*1000<Date.now()){localStorage.removeItem("ttp_token");return null;}
      return p.user;
    }catch{return null;}
  });

  const logout=useCallback(()=>{localStorage.removeItem("ttp_token");setToken(null);setUser(null);},[]);
  const loginFn=(tok,usr)=>{localStorage.setItem("ttp_token",tok);setToken(tok);setUser(usr);};
  const fetch_=(url,params={})=>apiFetch(url,params,logout);

  const [tab,setTab] = useState("overview");
  const [showFilters,setShowFilters] = useState(true);
  const [showExport,setShowExport] = useState(false);
  const [showNotif,setShowNotif] = useState(false);
  const [lastR,setLastR] = useState(dubaiTime());

  const [filters,setFilters] = useState({});
  const [applied,setApplied] = useState({});
  const [slicers,setSlicers] = useState({datasets:[],transportTypes:[],busTypes:[]});

  const [kpis,setKpis] = useState(null);
  const [revData,setRevData] = useState([]);
  const [ymData,setYmData] = useState([]);
  const [trData,setTrData] = useState([]);
  const [depData,setDepData] = useState([]);
  const [busClassData,setBusClassData] = useState([]);
  const [mapMetric,setMapMetric] = useState("bookings");
  const [oLoad,setOLoad] = useState(false);
  const [dashStatus,setDashStatus] = useState(null);

  const [busTab,setBusTab] = useState("solmar");
  const [busFilters,setBusFilters] = useState({});
  const [busApplied,setBusApplied] = useState({});
  const [trips,setTrips] = useState([]);
  const [stTrips,setStTrips] = useState([]);
  const [stMonthly,setStMonthly] = useState([]);
  const [pendels,setPendels] = useState([]);
  const [bLoad,setBLoad] = useState(false);

  function buildP(f){
    const p={};
    if(f.departureDateFrom)p.departureDateFrom=f.departureDateFrom;
    if(f.departureDateTo)p.departureDateTo=f.departureDateTo;
    if(f.returnDateFrom)p.returnDateFrom=f.returnDateFrom;
    if(f.returnDateTo)p.returnDateTo=f.returnDateTo;
    if(f.bookingDateFrom)p.bookingDateFrom=f.bookingDateFrom;
    if(f.bookingDateTo)p.bookingDateTo=f.bookingDateTo;
    if(f.transportTypes?.length)p.transportType=f.transportTypes;
    if(f.busTypes?.length)p.busType=f.busTypes;
    if(f.statuses?.length)p.status=f.statuses;
    if(f.datasets?.length)p.dataset=f.datasets;
    return p;
  }

  // Load slicers
  useEffect(()=>{
    if(!token)return;
    fetch_("/api/dashboard/slicers").then(d=>{if(d&&!d.error)setSlicers(d);}).catch(()=>{});
    fetch_("/api/dashboard/bus-class-summary").then(d=>{if(Array.isArray(d))setBusClassData(d);}).catch(()=>{});
    const t=localStorage.getItem("ttp_token");
    fetch(`${BASE}/api/ai/status`,{headers:{"Authorization":`Bearer ${t}`}})
      .then(r=>r.json()).then(d=>setDashStatus(d)).catch(()=>{});
  },[token]);

  // Load overview data
  useEffect(()=>{
    if(!token)return;
    setOLoad(true);
    const p=buildP(applied);
    Promise.all([
      fetch_("/api/dashboard/kpis",p),
      fetch_("/api/dashboard/revenue-by-year",p),
      fetch_("/api/dashboard/year-month-comparison",p),
      fetch_("/api/dashboard/transport-breakdown",p).catch(()=>[]),
      fetch_("/api/dashboard/departure-places",p).catch(()=>[]),
    ]).then(([k,r,ym,tr,dep])=>{
      if(k&&!k.error)setKpis(k);
      if(Array.isArray(r))setRevData(r);
      if(Array.isArray(ym))setYmData(ym);
      if(Array.isArray(tr))setTrData(tr);
      if(Array.isArray(dep))setDepData(dep);
      setLastR(dubaiTime());
    }).catch(console.error).finally(()=>setOLoad(false));
  },[token,applied]);

  // Load bus trips
  useEffect(()=>{
    if(!token)return;
    setBLoad(true);
    const p={};
    if(busApplied.pendel)p.pendel=busApplied.pendel;
    if(busApplied.dateFrom)p.dateFrom=busApplied.dateFrom;
    if(busApplied.dateTo)p.dateTo=busApplied.dateTo;
    Promise.all([
      fetch_("/api/dashboard/bustrips",p),
      fetch_("/api/dashboard/snowtravel-bus",{dateFrom:busApplied.dateFrom,dateTo:busApplied.dateTo}),
      fetch_("/api/dashboard/snowtravel-monthly",{dateFrom:busApplied.dateFrom,dateTo:busApplied.dateTo}),
    ]).then(([bt,st,stm])=>{
      setTrips(bt?.rows||[]);setPendels(bt?.pendels||[]);
      if(Array.isArray(st))setStTrips(st);
      if(Array.isArray(stm))setStMonthly(stm);
    }).catch(()=>{}).finally(()=>setBLoad(false));
  },[token,busApplied]);

  // Auto-refresh midnight Dubai
  useEffect(()=>{
    const iv=setInterval(()=>{
      const now=new Date().toLocaleTimeString("en-AE",{timeZone:"Asia/Dubai",hour:"2-digit",minute:"2-digit",hour12:false});
      if(now==="00:00")setApplied(a=>({...a}));
      setLastR(dubaiTime());
    },60000);
    return()=>clearInterval(iv);
  },[]);

  // Close notif on outside click
  const notifRef = useRef(null);
  useEffect(()=>{
    const h=e=>{if(notifRef.current&&!notifRef.current.contains(e.target))setShowNotif(false);};
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[]);

  if(!token||!user) return <Login onLogin={loginFn}/>;

  const SEC={background:THEME.card,border:`1px solid ${THEME.border}`,borderRadius:10};
  const HB=(ex={})=>({background:"transparent",border:`1px solid ${THEME.border}`,borderRadius:6,color:THEME.muted,padding:"5px 12px",fontSize:12,cursor:"pointer",...ex});
  const busTableTitle=busApplied.label?`BUS OCCUPANCY — ${busApplied.label.toUpperCase()} — OUTBOUND VS RETURN`:"BUS OCCUPANCY — ALL LABELS — OUTBOUND VS RETURN";

  // Build stMonthly for charts
  const stRevenueData=stMonthly.map(d=>({year:d.year,month:d.month,revenue:d.revenue,bookings:d.bookings,pax:d.pax,bus_class:d.bus_class}));

  return (
    <div style={{background:THEME.bg,minHeight:"100vh",fontFamily:"'Segoe UI',system-ui,sans-serif",color:THEME.text,paddingBottom:36}}>

      {/* HEADER */}
      <div style={{background:"#0b0f18",borderBottom:`1px solid ${THEME.border}`,padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52,position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <a href="https://www.ttp-services.com" target="_blank" rel="noreferrer" style={{textDecoration:"none"}}>
            <span style={{fontSize:15,fontWeight:800,color:THEME.text}}><span style={{color:THEME.accent}}>TTP</span> Analytics</span>
          </a>
          <div style={{display:"flex",gap:2}}>
            {[["overview","Overview"],["map","Map"],["bus","Bus Occupancy"],["ai","AI Assistant"]].map(([id,lbl])=>(
              <button key={id} onClick={()=>{setTab(id);if(id==="map"&&depData.length===0)setApplied(a=>({...a}));}} style={{
                background:tab===id?"#162038":"transparent",
                border:tab===id?`1px solid #2a4a7f`:"1px solid transparent",
                borderRadius:6,color:tab===id?"#93c5fd":THEME.muted,
                padding:"5px 14px",fontSize:13,cursor:"pointer",fontWeight:tab===id?600:400
              }}>
                {lbl}
                {id==="ai"&&<span style={{marginLeft:5,fontSize:10,background:"rgba(79,142,247,0.2)",color:"#4f8ef7",padding:"1px 5px",borderRadius:8}}>AI</span>}
              </button>
            ))}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:11,color:THEME.muted2}}>🕐 {lastR} Dubai</span>
          <button onClick={()=>setApplied(a=>({...a}))} style={HB()} title="Refresh data">↻</button>
          {tab!=="ai"&&<button onClick={()=>setShowFilters(v=>!v)} style={HB({color:showFilters?"#93c5fd":THEME.muted})}>⚙ Filters</button>}
          <button onClick={()=>setShowExport(true)} style={HB()}>↓ Export</button>
          <button onClick={()=>window.print()} style={HB()}>🖨</button>
          <div style={{width:1,height:20,background:THEME.border}}/>
          <div ref={notifRef} style={{position:"relative"}}>
            <button onClick={()=>setShowNotif(v=>!v)} style={{...HB(),position:"relative"}} title="Notifications">
              🔔
              {dashStatus&&<span style={{position:"absolute",top:-2,right:-2,width:7,height:7,background:THEME.accent,borderRadius:"50%"}}/>}
            </button>
            {showNotif&&<NotifPanel dashStatus={dashStatus} onClose={()=>setShowNotif(false)}/>}
          </div>
          <span style={{fontSize:12,color:THEME.muted}}>{user?.name||user?.username}</span>
          <button onClick={logout} style={HB({color:THEME.danger})}>Logout</button>
        </div>
      </div>

      {/* FILTERS */}
      {showFilters&&tab!=="ai"&&tab!=="bus"&&(
        <FiltersPanel f={filters} setF={setFilters} slicers={slicers}
          filters={filters} setFilters={setFilters}
          onApply={()=>setApplied({...filters})}
          onReset={()=>{setFilters({});setApplied({});}}/>
      )}

      {/* EXPORT MODAL */}
      {showExport&&<ExportModal onClose={()=>setShowExport(false)} applied={applied}/>}

      <div id="dashboard-content">

        {/* ── OVERVIEW ── */}
        {tab==="overview"&&(
          <div style={{padding:"18px 24px",display:"flex",flexDirection:"column",gap:14}}>
            {oLoad&&<div style={{color:THEME.accent,fontSize:12,textAlign:"center"}}>⟳ Loading…</div>}
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              <KpiCard title="Bookings" icon={<IconBookings/>} current={kpis?.currentBookings} previous={kpis?.previousBookings} diff={kpis?.differenceBookings} pct={kpis?.percentBookings} loading={oLoad}/>
              <KpiCard title="PAX" icon={<IconPax/>} current={kpis?.currentPax} previous={kpis?.previousPax} diff={kpis?.differencePax} pct={kpis?.percentPax} loading={oLoad}/>
              <KpiCard title="Revenue" icon={<IconRevenue/>} current={kpis?.currentRevenue} previous={kpis?.previousRevenue} diff={kpis?.differenceRevenue} pct={kpis?.percentRevenue} isCurrency loading={oLoad}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <LineChart data={revData} title="Revenue by Year & Month" yIsCurrency metricKey="revenue"/>
              <BarChart data={revData} title="Bookings by Year & Month" metric="bookings"/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <BarChart data={revData} title="PAX by Year & Month" metric="pax"/>
              <DonutChart data={trData} title="Transport Type Breakdown"/>
            </div>
            <div style={SEC}>
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${THEME.border}`,fontSize:12,color:THEME.muted,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>Year-Month Comparison</div>
              <YMTable data={ymData}/>
            </div>
          </div>
        )}

        {/* ── MAP ── */}
        {tab==="map"&&(
          <div style={{padding:"18px 24px",display:"flex",flexDirection:"column",gap:14}}>
            {showFilters&&<FiltersPanel filters={filters} setFilters={setFilters} slicers={slicers} onApply={()=>setApplied({...filters})} onReset={()=>{setFilters({});setApplied({});}}/>}
            <div style={SEC}>
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${THEME.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                <div>
                  <span style={{fontSize:12,color:THEME.muted,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>Departure Cities Map</span>
                  <span style={{fontSize:11,color:THEME.muted2,marginLeft:10}}>Click markers for details</span>
                </div>
                <div style={{display:"flex",gap:6}}>
                  {["bookings","pax","revenue"].map(m=>(
                    <button key={m} onClick={()=>setMapMetric(m)} style={{
                      background:mapMetric===m?"#162038":"#111827",
                      border:mapMetric===m?`1px solid #2a4a7f`:`1px solid ${THEME.border}`,
                      borderRadius:5,color:mapMetric===m?"#93c5fd":THEME.muted,
                      padding:"4px 12px",fontSize:12,cursor:"pointer",textTransform:"capitalize"
                    }}>{m}</button>
                  ))}
                </div>
              </div>
              <div style={{padding:"16px 18px"}}>
                {depData.length===0
                  ?<div style={{height:420,display:"flex",alignItems:"center",justifyContent:"center",color:THEME.muted,fontSize:13,flexDirection:"column",gap:8}}><span style={{fontSize:32}}>🗺️</span><span>Apply filters to load map data</span></div>
                  :<LeafletMap departureData={depData} metric={mapMetric} appliedFilters={applied}/>
                }
              </div>
              <div style={{padding:"0 18px 14px",display:"flex",gap:16,fontSize:11,color:THEME.muted,alignItems:"center"}}>
                <span>Low</span>
                <div style={{flex:1,maxWidth:200,height:5,borderRadius:3,background:"linear-gradient(to right,#bfdbfe,#60a5fa,#1e3a8a)"}}/>
                <span>High</span>
                <span style={{marginLeft:16,color:THEME.muted2}}>{depData.length} cities</span>
              </div>
            </div>
            {depData.length>0&&(
              <div style={SEC}>
                <div style={{padding:"12px 16px",borderBottom:`1px solid ${THEME.border}`,fontSize:12,color:THEME.muted,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>City Breakdown</div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr style={{background:"#080c14"}}>
                      {["#","City","Bookings","PAX","Revenue"].map((h,i)=>(
                        <th key={i} style={{padding:"9px 12px",color:THEME.muted,fontWeight:600,fontSize:11,textTransform:"uppercase",textAlign:i<=1?"left":"right",borderBottom:`1px solid ${THEME.border}`}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {[...depData].sort((a,b)=>(b[mapMetric]||0)-(a[mapMetric]||0)).map((d,i)=>(
                        <tr key={i} style={{background:i%2===0?THEME.card:"#080c14"}}>
                          <td style={{padding:"7px 12px",color:THEME.muted2,fontSize:11}}>{i+1}</td>
                          <td style={{padding:"7px 12px",color:"#93c5fd",fontWeight:500}}>{d.destination}</td>
                          <td style={{padding:"7px 12px",textAlign:"right",color:THEME.text}}>{fmt(d.bookings)}</td>
                          <td style={{padding:"7px 12px",textAlign:"right",color:THEME.text}}>{fmt(d.pax)}</td>
                          <td style={{padding:"7px 12px",textAlign:"right",color:THEME.text}}>{fmt(d.revenue,true)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── BUS OCCUPANCY ── */}
        {tab==="bus"&&(
          <div style={{padding:"18px 24px",display:"flex",flexDirection:"column",gap:14}}>
            <div style={{display:"flex",gap:8}}>
              {[["solmar","Solmar / Interbus"],["snowtravel","Snowtravel"]].map(([id,lbl])=>(
                <button key={id} onClick={()=>setBusTab(id)} style={{
                  background:busTab===id?THEME.accent:"#111827",
                  border:`1px solid ${busTab===id?THEME.accent:THEME.border}`,
                  borderRadius:8,color:busTab===id?THEME.bg:THEME.muted,
                  padding:"8px 20px",fontSize:13,cursor:"pointer",fontWeight:busTab===id?700:400
                }}>{lbl}</button>
              ))}
            </div>

            {/* Bus Filters */}
            <div style={{...SEC,padding:"14px 18px"}}>
              <div style={{fontSize:11,color:THEME.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:12,fontWeight:600}}>Bus Filters</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:12,alignItems:"flex-end"}}>
                {[["dateFrom","Date From"],["dateTo","Date To"]].map(([k,l])=>(
                  <div key={k}>
                    <div style={{fontSize:11,color:THEME.muted,marginBottom:4,textTransform:"uppercase"}}>{l}</div>
                    <input type="date" value={busFilters[k]||""} onChange={e=>setBusFilters(f=>({...f,[k]:e.target.value}))}
                      style={{background:"#111827",border:`1px solid ${THEME.border}`,borderRadius:6,color:THEME.text,padding:"7px 10px",fontSize:13}}/>
                  </div>
                ))}
                {busTab==="solmar"&&(
                  <div>
                    <div style={{fontSize:11,color:THEME.muted,marginBottom:4,textTransform:"uppercase"}}>Route</div>
                    <select value={busFilters.pendel||""} onChange={e=>setBusFilters(f=>({...f,pendel:e.target.value}))}
                      style={{background:"#111827",border:`1px solid ${THEME.border}`,borderRadius:6,color:THEME.text,padding:"7px 10px",fontSize:13}}>
                      <option value="">All routes</option>
                      {pendels.map(p=><option key={p} value={p}>{PENDEL_MAP[p]||p} ({p})</option>)}
                    </select>
                  </div>
                )}
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>setBusApplied({...busFilters})} style={{background:THEME.accent,border:"none",borderRadius:7,color:THEME.bg,padding:"8px 18px",fontWeight:700,fontSize:13,cursor:"pointer"}}>Apply</button>
                  <button onClick={()=>{setBusFilters({});setBusApplied({});}} style={{background:"#111827",border:`1px solid ${THEME.border}`,borderRadius:7,color:"#94a3b8",padding:"8px 13px",fontSize:13,cursor:"pointer"}}>Reset</button>
                </div>
              </div>
            </div>

            {busTab==="solmar"&&(
              <>
                <div style={{display:"flex",gap:14,fontSize:12,color:THEME.muted,flexWrap:"wrap",alignItems:"center"}}>
                  <span><b style={{color:THEME.text}}>RC</b> = Royal Class</span>
                  <span><b style={{color:THEME.text}}>FC</b> = First Class</span>
                  <span><b style={{color:THEME.text}}>PRE</b> = Premium Class</span>
                  <span style={{color:THEME.muted2}}>Green = outbound &gt; return · Red = more return than outbound</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                  <BusClassChart data={busClassData} title="Bookings by Bus Class" metric="bookings"/>
                  <BusClassChart data={busClassData} title="Revenue by Bus Class" metric="revenue"/>
                </div>
                <div style={SEC}>
                  <div style={{padding:"12px 16px",borderBottom:`1px solid ${THEME.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <span style={{fontSize:12,color:THEME.muted,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>{busTableTitle}</span>
                    <span style={{fontSize:12,color:THEME.muted2}}>{trips.length} distinct trip dates</span>
                  </div>
                  <BusTripsTable rows={trips} loading={bLoad}/>
                </div>
              </>
            )}

            {busTab==="snowtravel"&&(
              <>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                  <LineChart data={stMonthly.filter(d=>d.bus_class==="Dream Class")} title="Dream Class Revenue by Month" yIsCurrency metricKey="revenue"/>
                  <BarChart data={stMonthly.filter(d=>d.bus_class==="Dream Class")} title="Dream Class PAX by Month" metric="pax"/>
                </div>
                <div style={SEC}>
                  <div style={{padding:"12px 16px",borderBottom:`1px solid ${THEME.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <span style={{fontSize:12,color:THEME.muted,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>Snowtravel Bus Occupancy</span>
                    <span style={{fontSize:12,color:THEME.muted2}}>{stTrips.length} rows</span>
                  </div>
                  <SnowTravelTable rows={stTrips} loading={bLoad}/>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── AI ASSISTANT ── */}
        {tab==="ai"&&(
          <div style={{padding:"18px 24px",height:"calc(100vh - 88px)",display:"flex",flexDirection:"column"}}>
            <div style={{flex:1,display:"grid",gridTemplateColumns:"1fr 340px",gap:14,overflow:"hidden"}}>
              <AiAssistant onUnauth={logout}/>
              <div style={{...SEC,padding:"16px 18px",overflowY:"auto",display:"flex",flexDirection:"column",gap:12}}>
                <div style={{fontSize:12,color:THEME.muted,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>Suggested Questions</div>
                {SUGGESTIONS.map((s,i)=>(
                  <div key={i} style={{background:"#111827",border:`1px solid ${THEME.border}`,borderRadius:8,padding:"10px 13px",fontSize:13,color:"#94a3b8",lineHeight:1.4,cursor:"default"}}>
                    <span style={{color:THEME.accent,marginRight:8}}>→</span>{s}
                  </div>
                ))}
                <div style={{padding:"12px",background:"#080c14",borderRadius:8,border:`1px solid ${THEME.border}`}}>
                  <div style={{fontSize:11,color:THEME.muted,marginBottom:6,fontWeight:600}}>DATA SOURCES</div>
                  {["Snowtravel (TravelNote API)","Solmar","Interbus","Solmar DE"].map(d=>(
                    <div key={d} style={{fontSize:12,color:THEME.muted2,padding:"3px 0",display:"flex",alignItems:"center",gap:6}}>
                      <span style={{width:6,height:6,borderRadius:"50%",background:THEME.success,flexShrink:0}}/>{d}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* STATUS BAR */}
      {dashStatus&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#080c14",borderTop:`1px solid ${THEME.border}`,padding:"5px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:11,zIndex:50}}>
          <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{color:THEME.muted}}>Last sync:</span>
            <span style={{color:THEME.accent}}>{dashStatus.dubaiTime}</span>
            {(dashStatus.datasets||[]).map(d=>(
              <span key={d.dataset} style={{color:THEME.muted2}}>
                <span style={{color:THEME.text}}>{d.dataset}</span>: {Number(d.total_bookings).toLocaleString()}
              </span>
            ))}
          </div>
          <span style={{color:"#1e3a5f"}}>Auto-refresh at 00:00 Dubai time</span>
        </div>
      )}

      <style>{`
        * { box-sizing: border-box; }
        @media print { button, .no-print, nav { display: none !important; } #dashboard-content { padding: 0 !important; } body { background: white !important; } }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #050d1a; }
        ::-webkit-scrollbar-thumb { background: #0e2040; border-radius: 3px; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.4); }
        .ttp-map-label { background: transparent !important; border: none !important; box-shadow: none !important; color: #94a3b8 !important; font-size: 10px !important; font-weight: 600 !important; padding: 0 !important; white-space: nowrap !important; }
        .leaflet-tooltip-top.ttp-map-label::before { display: none !important; }
        .leaflet-popup-content-wrapper { background: #0a1628 !important; border: 1px solid #0e2040 !important; color: #e2e8f0 !important; border-radius: 8px !important; }
        .leaflet-popup-tip { background: #0a1628 !important; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
