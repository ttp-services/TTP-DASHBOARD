import React, { useState, useEffect, useCallback } from "react";
import { LayoutDashboard, Bus, Briefcase, Settings, Users, BarChart2, TrendingUp, Package, Star, ArrowDown, ArrowUp, CircleDot, ChevronDown, ChevronUp, RotateCcw, Play, Filter, AlertCircle, CheckCircle, XCircle, Download, Search, Layers, Map, Table2, PieChart, CreditCard, Percent, FileText, Plane } from "lucide-react";

const BASE = import.meta.env?.VITE_API_URL || "https://ttp-dashboard-api.azurewebsites.net";
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DATASETS = ["Solmar","Interbus","Solmar DE","Snowtravel"];
const YEARS = [2023,2024,2025,2026];
const YC = {2023:"#10b981",2024:"#8b5cf6",2025:"#f97316",2026:"#3b82f6"};
const AUTH_KEY = "ttp_auth_v3";

function saveAuth(t,u){try{const d=JSON.stringify({token:t,user:u,ts:Date.now()});localStorage.setItem(AUTH_KEY,d);sessionStorage.setItem(AUTH_KEY,d);}catch{}}
function loadAuth(){try{const raw=localStorage.getItem(AUTH_KEY)||sessionStorage.getItem(AUTH_KEY);if(!raw)return null;const{token,user,ts}=JSON.parse(raw);if(Date.now()-ts>30*24*60*60*1000){clearAuth();return null;}return{token,...user};}catch{return null;}}
function clearAuth(){try{localStorage.removeItem(AUTH_KEY);sessionStorage.removeItem(AUTH_KEY);}catch{}}

async function api(path,params={},token){
  const qs=new URLSearchParams();
  Object.entries(params).filter(([,v])=>v!=null&&v!=="").forEach(([k,v])=>{
    if(Array.isArray(v)){v.forEach(i=>qs.append(k,i));}else{qs.set(k,v);}
  });
  const r=await fetch(`${BASE}${path}${qs.toString()?"?"+qs.toString():""}`,{headers:{Authorization:`Bearer ${token}`}});
  if(!r.ok)throw new Error(`HTTP ${r.status}`);
  return r.json();
}

const fmtM=v=>{const n=parseFloat(v)||0;return`€${Math.round(n).toLocaleString("nl-BE")}`;};
const fmtN=v=>v==null?"—":Number(v).toLocaleString("nl-BE");
const fmtPct=v=>v==null?"—":`${v>=0?"+":""}${parseFloat(v).toFixed(1)}%`;
const fmtEur=v=>{const n=parseFloat(v)||0;return`€${n.toLocaleString("nl-BE",{minimumFractionDigits:2,maximumFractionDigits:2})}`;};
const dc=v=>v==null?"#94a3b8":parseFloat(v)>=0?"#059669":"#dc2626";

const S={
  bg:"#f0f5ff",
  side:"#ffffff",
  card:"#ffffff",
  border:"#e2e8f0",
  border2:"#cbd5e1",
  accent:"#1a56db",
  accent2:"#1e40af",
  accentLight:"#eff6ff",
  text:"#1e293b",
  textLight:"#475569",
  muted:"#64748b",
  muted2:"#94a3b8",
  success:"#059669",
  successBg:"#ecfdf5",
  danger:"#dc2626",
  dangerBg:"#fef2f2",
  warn:"#d97706",
  warnBg:"#fffbeb",
  purple:"#7c3aed",
  orange:"#ea580c",
  headerBg:"#ffffff",
  shadow:"0 1px 3px rgba(0,0,0,0.08),0 1px 2px rgba(0,0,0,0.04)",
  shadowMd:"0 4px 6px -1px rgba(0,0,0,0.07),0 2px 4px -1px rgba(0,0,0,0.04)",
  shadowLg:"0 10px 15px -3px rgba(0,0,0,0.07),0 4px 6px -2px rgba(0,0,0,0.04)",
};

const cy=new Date().getFullYear();
const QUICK_DATES=[
  {l:"This Year",  from:`${cy}-01-01`,  to:`${cy}-12-31`},
  {l:"Last Year",  from:`${cy-1}-01-01`,to:`${cy-1}-12-31`},
  {l:"Last 3M",    from:new Date(Date.now()-90*864e5).toISOString().split("T")[0],to:new Date().toISOString().split("T")[0]},
  {l:"All Data",   from:"",             to:""},
  {l:`Solmar FY${cy}`,      from:`${cy-1}-12-01`,to:`${cy}-11-30`},
  {l:`Solmar FY${cy+1}`,    from:`${cy}-12-01`,  to:`${cy+1}-11-30`},
  {l:`Snow FY${cy}/${cy+1}`,from:`${cy}-07-01`,  to:`${cy+1}-06-30`},
];

function Badge({children,color=S.accent,bg=S.accentLight}){
  return<span style={{background:bg,color,padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:600,display:"inline-flex",alignItems:"center",gap:3}}>{children}</span>;
}

function Card({children,style={},p="18px 20px"}){
  return<div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:12,padding:p,boxShadow:S.shadow,...style}}>{children}</div>;
}

function Btn({children,onClick,variant="secondary",size="sm",style={},disabled=false}){
  const base={cursor:disabled?"not-allowed":"pointer",borderRadius:7,fontWeight:600,display:"inline-flex",alignItems:"center",gap:5,transition:"all 0.15s",fontFamily:"inherit",opacity:disabled?0.5:1,...style};
  const sizes={sm:{padding:"5px 12px",fontSize:12},md:{padding:"7px 16px",fontSize:13},lg:{padding:"9px 20px",fontSize:14}};
  const variants={
    primary:{background:S.accent,color:"#fff",border:"none",boxShadow:"0 1px 3px rgba(26,86,219,0.3)"},
    secondary:{background:"transparent",color:S.textLight,border:`1px solid ${S.border2}`},
    danger:{background:S.dangerBg,color:S.danger,border:`1px solid ${S.danger}44`},
    ghost:{background:"transparent",color:S.muted,border:"none"},
  };
  return<button onClick={onClick} disabled={disabled} style={{...base,...sizes[size],...variants[variant]}}>{children}</button>;
}

function LineChart({data}){
  const[tooltip,setTooltip]=useState(null);
  if(!data?.length)return<div style={{color:S.muted,textAlign:"center",padding:32,fontSize:12}}>No data</div>;
  const sorted=[...data].filter(r=>r.year>=2023&&r.year<=2026).sort((a,b)=>a.year!==b.year?a.year-b.year:a.month-b.month);
  const yrs=[...new Set(sorted.map(r=>r.year))];
  const byYear={};yrs.forEach(y=>{byYear[y]=Array(12).fill(null);});
  sorted.forEach(r=>{if(byYear[r.year])byYear[r.year][r.month-1]=Number(r.revenue)||0;});
  const allVals=sorted.map(r=>Number(r.revenue)||0);
  const maxV=Math.max(...allVals,1);
  const W=500,H=200,PL=68,PR=16,PT=12,PB=44,CW=W-PL-PR,CH=H-PT-PB;
  const mx=mo=>PL+(mo/11)*CW;
  const my=v=>PT+CH-(v/maxV)*CH;
  const fmtA=v=>v>=1e6?`€${(v/1e6).toFixed(1)}M`:v>=1e3?`€${(v/1e3).toFixed(0)}K`:`€${v}`;
  return(
    <div style={{position:"relative"}}>
      {tooltip&&(
        <div style={{position:"absolute",left:tooltip.x,top:tooltip.y,background:S.text,border:"none",borderRadius:8,padding:"8px 12px",fontSize:11,color:"#fff",pointerEvents:"none",zIndex:10,whiteSpace:"nowrap",transform:"translate(-50%,-110%)",boxShadow:S.shadowLg}}>
          <div style={{fontWeight:700,color:YC[tooltip.year]||S.accent,marginBottom:2}}>{tooltip.year} — {MONTHS[tooltip.month-1]}</div>
          <div>Revenue: <strong>{fmtA(tooltip.value)}</strong></div>
        </div>
      )}
      <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginBottom:6,flexWrap:"wrap"}}>
        {yrs.map(yr=>(
          <div key={yr} style={{display:"flex",alignItems:"center",gap:4}}>
            <div style={{width:10,height:10,borderRadius:2,background:YC[yr]||S.accent}}/>
            <span style={{fontSize:11,color:S.muted,fontWeight:600}}>{yr}</span>
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}} onMouseLeave={()=>setTooltip(null)}>
        {[0,1,2,3,4].map(i=>{const y=PT+(CH/4)*i,v=maxV*(1-i/4);return<g key={i}><line x1={PL} x2={W-PR} y1={y} y2={y} stroke={S.border} strokeWidth={0.7}/><text x={PL-5} y={y+4} textAnchor="end" fontSize={8} fill={S.muted2}>{fmtA(v)}</text></g>;})}
        {MONTHS.map((m,i)=><text key={i} x={mx(i)} y={H-PB+13} textAnchor="middle" fontSize={8} fill={S.muted2}>{m}</text>)}
        {yrs.map(yr=>{
          const pts=byYear[yr];
          const vi=pts.map((v,i)=>v!==null?i:-1).filter(i=>i>=0);
          if(!vi.length)return null;
          const d=vi.map((i,j)=>`${j===0?"M":"L"}${mx(i).toFixed(1)},${my(pts[i]).toFixed(1)}`).join(" ");
          return<g key={yr}>
            <path d={d} fill="none" stroke={YC[yr]||S.accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.9}/>
            {vi.map(i=>(
              <circle key={i} cx={mx(i)} cy={my(pts[i])} r={4.5} fill={YC[yr]||S.accent} stroke="#fff" strokeWidth={1.5} style={{cursor:"pointer"}}
                onMouseEnter={e=>{try{const sv=e.currentTarget.closest("svg")||e.target.closest("svg");if(!sv)return;const rc=sv.getBoundingClientRect();const sx=rc.width/W;const sy=rc.height/H;setTooltip({x:mx(i)*sx,y:my(pts[i])*sy,year:yr,month:i+1,value:pts[i]});}catch{}}}
                onClick={e=>{try{const sv=e.currentTarget.closest("svg")||e.target.closest("svg");if(!sv)return;const rc=sv.getBoundingClientRect();const sx=rc.width/W;const sy=rc.height/H;setTooltip({x:mx(i)*sx,y:my(pts[i])*sy,year:yr,month:i+1,value:pts[i]});}catch{}}}
              />
            ))}
          </g>;
        })}
      </svg>
    </div>
  );
}

function BarChart({data,metric}){
  const[tooltip,setTooltip]=useState(null);
  if(!data?.length)return<div style={{color:S.muted,textAlign:"center",padding:32,fontSize:12}}>No chart data</div>;
  const filtered=[...data].filter(r=>r.year>=2023&&r.year<=2026);
  const yrs=[...new Set(filtered.map(r=>r.year))].sort((a,b)=>a-b);
  const grid={};
  for(let m=1;m<=12;m++){grid[m]={};yrs.forEach(y=>{grid[m][y]=0;});}
  filtered.forEach(r=>{if(grid[r.month])grid[r.month][r.year]=metric==="pax"?Number(r.pax)||0:Number(r.bookings)||0;});
  const allVals=Object.values(grid).flatMap(mv=>Object.values(mv));
  const maxV=Math.max(...allVals,1);
  const W=520,H=200,PL=52,PR=10,PT=12,PB=44,CW=W-PL-PR,CH=H-PT-PB;
  const groupW=CW/12;
  const gap=1.5;
  const bw=Math.max(3,Math.floor((groupW-gap*(yrs.length+1))/yrs.length));
  const groupPad=(groupW-(bw*yrs.length+gap*(yrs.length-1)))/2;
  return(
    <div style={{position:"relative"}}>
      {tooltip&&(
        <div style={{position:"absolute",left:tooltip.x,top:tooltip.y,background:S.text,border:"none",borderRadius:8,padding:"8px 12px",fontSize:11,color:"#fff",pointerEvents:"none",zIndex:10,whiteSpace:"nowrap",transform:"translate(-50%,-110%)",boxShadow:S.shadowLg}}>
          <div style={{fontWeight:700,color:YC[tooltip.year]||S.accent,marginBottom:2}}>{tooltip.year} — {MONTHS[tooltip.month-1]}</div>
          <div>{metric==="pax"?"PAX":"Bookings"}: <strong>{Number(tooltip.value).toLocaleString("nl-BE")}</strong></div>
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}} onMouseLeave={()=>setTooltip(null)}>
        {[0,1,2,3,4].map(i=>{const y=PT+(CH/4)*i,v=maxV*(1-i/4);return<g key={i}><line x1={PL} x2={W-PR} y1={y} y2={y} stroke={S.border} strokeWidth={0.7}/><text x={PL-4} y={y+4} textAnchor="end" fontSize={8} fill={S.muted2}>{fmtN(Math.round(v))}</text></g>;})}
        {Array.from({length:12},(_,mi)=>{
          const mo=mi+1;const gx=PL+mi*groupW;
          return<g key={mo}>
            {yrs.map((yr,yi)=>{
              const v=grid[mo][yr]||0;const bh=(v/maxV)*CH;
              const x=gx+groupPad+yi*(bw+gap);const y=PT+CH-bh;const color=YC[yr]||S.accent;
              return<rect key={yr} x={x} y={y} width={bw} height={Math.max(bh,0)} fill={color} rx={1.5} opacity={0.88} style={{cursor:"pointer"}}
                onMouseEnter={e=>{try{const sv=e.currentTarget.closest("svg")||e.target.closest("svg");if(!sv)return;const rc=sv.getBoundingClientRect();const sx=rc.width/W;const sy=rc.height/H;setTooltip({x:(x+bw/2)*sx,y:y*sy,year:yr,month:mo,value:v});}catch{}}}
                onClick={e=>{try{const sv=e.currentTarget.closest("svg")||e.target.closest("svg");if(!sv)return;const rc=sv.getBoundingClientRect();const sx=rc.width/W;const sy=rc.height/H;setTooltip({x:(x+bw/2)*sx,y:y*sy,year:yr,month:mo,value:v});}catch{}}}
              />;
            })}
            <text x={gx+groupW/2} y={H-PB+13} textAnchor="middle" fontSize={7.5} fill={S.muted2}>{MONTHS[mi]}</text>
          </g>;
        })}
      </svg>
      <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:6,flexWrap:"wrap"}}>
        {yrs.map(yr=>(
          <div key={yr} style={{display:"flex",alignItems:"center",gap:4}}>
            <div style={{width:10,height:10,borderRadius:2,background:YC[yr]||S.accent}}/>
            <span style={{fontSize:11,color:S.muted,fontWeight:600}}>{yr}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiCard({label,current,previous,pct,fmt="num",color=S.accent,icon}){
  const f=fmt==="eur"?fmtM:fmtN;
  const dif=current!=null&&previous!=null?(parseFloat(current)-parseFloat(previous)):null;
  const arrow=pct==null?"":pct>=0?"↑":"↓";
  return(
    <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:14,padding:"18px 20px",boxShadow:S.shadow,display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>{label}</div>
        {icon&&<div style={{width:32,height:32,borderRadius:8,background:`${color}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{icon}</div>}
      </div>
      <div style={{fontSize:28,fontWeight:800,color:S.text,letterSpacing:"-0.03em",lineHeight:1}}>{f(current)}</div>
      <div style={{display:"flex",flexDirection:"column",gap:4,borderTop:`1px solid ${S.border}`,paddingTop:10}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
          <span style={{color:S.muted}}>Previous</span>
          <span style={{color:S.textLight,fontWeight:500}}>{f(previous)}</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
          <span style={{color:S.muted}}>Difference</span>
          <span style={{color:dc(dif),fontWeight:600}}>{dif!=null?(dif>=0?"+":"")+f(Math.abs(dif)):"—"}</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
          <span style={{color:S.muted}}>Diff %</span>
          <span style={{color:dc(pct),fontWeight:700}}>{pct!=null?`${arrow} ${Math.abs(parseFloat(pct)).toFixed(1)}%`:"—"}</span>
        </div>
      </div>
    </div>
  );
}

function Login({onLogin}){
  const[u,setU]=useState(""),[ pw,setPw]=useState(""),[ show,setShow]=useState(false),[err,setErr]=useState(""),[busy,setBusy]=useState(false);
  async function submit(e){
    e.preventDefault();setBusy(true);setErr("");
    try{
      const r=await fetch(`${BASE}/api/auth/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:u,password:pw})});
      const d=await r.json();
      if(!r.ok||!d.token){setErr(d.error||"Invalid credentials");return;}
      saveAuth(d.token,d.user||{username:u,role:"user"});
      onLogin({token:d.token,...(d.user||{username:u,role:"user"})});
    }catch{setErr("Connection failed — check your connection.");}
    finally{setBusy(false);}
  }
  const inpStyle={width:"100%",background:S.bg,border:`1.5px solid ${S.border2}`,borderRadius:8,padding:"10px 14px",color:S.text,fontSize:13,boxSizing:"border-box",outline:"none",fontFamily:"inherit"};
  return(
    <div style={{display:"flex",height:"100vh",background:`linear-gradient(135deg, #e0f0ff 0%, #f0f5ff 40%, #e8f4ff 100%)`,alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-80,left:-80,width:300,height:300,borderRadius:"50%",background:"rgba(26,86,219,0.06)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:-60,right:-60,width:250,height:250,borderRadius:"50%",background:"rgba(26,86,219,0.04)",pointerEvents:"none"}}/>
      <div style={{width:400,background:S.card,borderRadius:20,padding:40,boxShadow:"0 20px 60px rgba(0,0,0,0.1)",border:`1px solid ${S.border}`,position:"relative",zIndex:1}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:64,height:64,background:`linear-gradient(135deg,${S.accent},#3b82f6)`,borderRadius:16,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:900,color:"#fff",marginBottom:16,boxShadow:"0 8px 24px rgba(26,86,219,0.35)"}}>TTP</div>
          <div style={{fontSize:22,fontWeight:800,color:S.text,letterSpacing:"-0.02em"}}>TTP Analytics</div>
          <div style={{fontSize:13,color:S.muted,marginTop:4}}>Internal Dashboard · TTP Services</div>
        </div>
        <form onSubmit={submit} style={{display:"flex",flexDirection:"column",gap:16}}>
          <div>
            <label style={{fontSize:11,color:S.muted,display:"block",marginBottom:6,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em"}}>Username</label>
            <input value={u} onChange={e=>setU(e.target.value)} autoFocus placeholder="Enter username" style={inpStyle}/>
          </div>
          <div>
            <label style={{fontSize:11,color:S.muted,display:"block",marginBottom:6,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em"}}>Password</label>
            <div style={{position:"relative"}}>
              <input value={pw} onChange={e=>setPw(e.target.value)} type={show?"text":"password"} placeholder="Enter password" style={{...inpStyle,paddingRight:50}}/>
              <button type="button" onClick={()=>setShow(!show)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:S.muted,fontSize:12,fontWeight:600}}>{show?"Hide":"Show"}</button>
            </div>
          </div>
          {err&&<div style={{background:S.dangerBg,border:`1px solid ${S.danger}33`,borderRadius:8,padding:"10px 14px",fontSize:12,color:S.danger,fontWeight:500}}>⚠ {err}</div>}
          <button type="submit" disabled={busy||!u||!pw} style={{background:`linear-gradient(135deg,${S.accent},#3b82f6)`,color:"#fff",border:"none",borderRadius:9,padding:"12px",fontSize:14,fontWeight:700,cursor:busy?"wait":"pointer",opacity:(!u||!pw)?0.5:1,marginTop:4,boxShadow:"0 4px 12px rgba(26,86,219,0.3)",letterSpacing:"0.01em"}}>
            {busy?"Signing in…":"Sign In"}
          </button>
        </form>
        <div style={{textAlign:"center",marginTop:20,fontSize:11,color:S.muted2}}>© 2024 TTP Services Middle East · Dubai</div>
      </div>
    </div>
  );
}

// ─── OVERVIEW TAB ──────────────────────────────────────────────────────────────

function OverviewTab({token}){
  const[f,setF]=useState({datasets:[],statuses:[],years:[],bookingFrom:"",bookingTo:"",depFrom:"",depTo:"",quickLabel:""});
  const[kpis,setKpis]=useState(null);
  const[chart,setChart]=useState([]);
  const[ym,setYm]=useState([]);
  const[metric,setMetric]=useState("bookings");
  const[ymMetric,setYmMetric]=useState("bookings");
  const[loading,setLoading]=useState(false);
  const[chips,setChips]=useState([]);
  const[filtersOpen,setFiltersOpen]=useState(true);

  const toParams=ap=>{const p={};if(ap.datasets?.length)p.dataset=ap.datasets;if(ap.statuses?.length)p.status=ap.statuses;if(ap.years?.length)p.year=ap.years;if(ap.bookingFrom)p.bookingDateFrom=ap.bookingFrom;if(ap.bookingTo)p.bookingDateTo=ap.bookingTo;if(ap.depFrom)p.departureDateFrom=ap.depFrom;if(ap.depTo)p.departureDateTo=ap.depTo;return p;};

  const loadData=useCallback((ap)=>{
    setLoading(true);
    const p=toParams(ap);
    Promise.all([
      api("/api/dashboard/kpis",p,token).catch(()=>null),
      api("/api/dashboard/revenue-by-year",p,token).catch(()=>[]),
      api("/api/dashboard/year-month-comparison",p,token).catch(()=>[])
    ]).then(([k,c,y])=>{
      if(k)setKpis(k);
      setChart(Array.isArray(c)?c:[]);
      setYm(Array.isArray(y)?y:[]);
    }).finally(()=>setLoading(false));
  },[token]);

  useEffect(()=>{loadData({});},[loadData]);

  function apply(){
    const cs=[];
    if(f.datasets.length)f.datasets.forEach(d=>cs.push({l:`Dataset: ${d}`,k:`ds_${d}`}));
    if(f.statuses.length)f.statuses.forEach(s=>cs.push({l:`Status: ${s==="ok"?"Confirmed":"Cancelled"}`,k:`st_${s}`}));
    if(f.years.length)f.years.forEach(y=>cs.push({l:`Year: ${y}`,k:`yr_${y}`}));
    if(f.depFrom||f.depTo)cs.push({l:`Dep: ${f.depFrom||"…"}–${f.depTo||"…"}`,k:"dep"});
    if(f.bookingFrom||f.bookingTo)cs.push({l:`Booked: ${f.bookingFrom||"…"}–${f.bookingTo||"…"}`,k:"bk"});
    if(f.quickLabel)cs.push({l:f.quickLabel,k:"qd"});
    setChips(cs);loadData(f);
  }
  function reset(){const e={datasets:[],statuses:[],years:[],bookingFrom:"",bookingTo:"",depFrom:"",depTo:"",quickLabel:""};setF(e);setChips([]);loadData({});}
  function tog(arr,v){return arr.includes(v)?arr.filter(x=>x!==v):[...arr,v];}
  function quick(q){setF(prev=>({...prev,depFrom:q.from,depTo:q.to,quickLabel:q.l}));}

  const sortedYm=[...ym].sort((a,b)=>b.currentYear!==a.currentYear?b.currentYear-a.currentYear:b.month-a.month);

  const chipBtn=(active,onClick,children,clr=S.accent)=>(
    <button onClick={onClick} style={{padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:600,cursor:"pointer",border:`1.5px solid ${active?clr:S.border2}`,background:active?`${clr}18`:"transparent",color:active?clr:S.textLight,transition:"all 0.15s"}}>
      {children}
    </button>
  );
  const dinp=(val,set)=>(
    <input type="date" value={val} onChange={e=>set(e.target.value)} style={{background:S.bg,border:`1px solid ${S.border2}`,borderRadius:6,padding:"4px 8px",color:S.text,fontSize:11,outline:"none"}}/>
  );

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden",background:S.bg}}>
      <div style={{background:S.card,borderBottom:`1px solid ${S.border}`,flexShrink:0,boxShadow:S.shadow}}>
        <div style={{padding:"8px 16px",display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
          <button onClick={()=>setFiltersOpen(p=>!p)} style={{padding:"4px 8px",borderRadius:6,fontSize:11,cursor:"pointer",border:`1px solid ${S.border2}`,background:"transparent",color:S.muted,display:"flex",alignItems:"center",gap:4}}>
            <span>⚙</span><span>{filtersOpen?"Hide":"Filters"}</span>
          </button>
          {filtersOpen&&<>
            <div style={{width:1,height:18,background:S.border2}}/>
            <span style={{fontSize:10,fontWeight:700,color:S.muted2,textTransform:"uppercase",letterSpacing:"0.06em"}}>Dataset</span>
            {DATASETS.map(d=>chipBtn(f.datasets.includes(d),()=>setF({...f,datasets:tog(f.datasets,d)}),d,S.accent))}
            <div style={{width:1,height:18,background:S.border2}}/>
            <span style={{fontSize:10,fontWeight:700,color:S.muted2,textTransform:"uppercase",letterSpacing:"0.06em"}}>Status</span>
            {chipBtn(f.statuses.includes("ok"),()=>setF({...f,statuses:tog(f.statuses,"ok")}),"✓ Confirmed",S.success)}
            {chipBtn(f.statuses.includes("cancelled"),()=>setF({...f,statuses:tog(f.statuses,"cancelled")}),"✗ Cancelled",S.danger)}
            <div style={{width:1,height:18,background:S.border2}}/>
            <span style={{fontSize:10,fontWeight:700,color:S.muted2,textTransform:"uppercase",letterSpacing:"0.06em"}}>Year</span>
            {YEARS.map(y=>chipBtn(f.years.includes(y),()=>setF({...f,years:tog(f.years,y)}),y,YC[y]))}
            <div style={{width:1,height:18,background:S.border2}}/>
            <span style={{fontSize:10,fontWeight:700,color:S.muted2,textTransform:"uppercase",letterSpacing:"0.06em"}}>Dep</span>
            {dinp(f.depFrom,v=>setF({...f,depFrom:v}))}
            <span style={{fontSize:10,color:S.muted2}}>–</span>
            {dinp(f.depTo,v=>setF({...f,depTo:v}))}
            <div style={{width:1,height:18,background:S.border2}}/>
            <span style={{fontSize:10,fontWeight:700,color:S.muted2,textTransform:"uppercase",letterSpacing:"0.06em"}}>Booked</span>
            {dinp(f.bookingFrom,v=>setF({...f,bookingFrom:v}))}
            <span style={{fontSize:10,color:S.muted2}}>–</span>
            {dinp(f.bookingTo,v=>setF({...f,bookingTo:v}))}
            <div style={{width:1,height:18,background:S.border2}}/>
            {QUICK_DATES.map(q=>(
              <button key={q.l} onClick={()=>quick(q)} style={{padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer",border:`1px solid ${f.quickLabel===q.l?"#d97706":S.border2}`,background:f.quickLabel===q.l?"#fffbeb":"transparent",color:f.quickLabel===q.l?S.warn:S.textLight,whiteSpace:"nowrap"}}>{q.l}</button>
            ))}
          </>}
          <div style={{marginLeft:"auto",display:"flex",gap:6}}>
            <Btn onClick={reset} variant="secondary" size="sm">Reset</Btn>
            <Btn onClick={apply} variant="primary" size="sm">Apply Filters</Btn>
          </div>
        </div>
        {chips.length>0&&(
          <div style={{padding:"4px 16px 8px",display:"flex",gap:5,flexWrap:"wrap"}}>
            {chips.map(c=><span key={c.k} style={{background:S.accentLight,color:S.accent,borderRadius:10,padding:"2px 8px",fontSize:10,fontWeight:600}}>● {c.l}</span>)}
          </div>
        )}
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:16}}>
        {loading&&<div style={{color:S.muted,textAlign:"center",padding:40,fontSize:13}}>Loading data…</div>}
        {kpis&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
            <KpiCard label="Total Bookings" current={kpis.currentBookings} previous={kpis.previousBookings} pct={kpis.percentBookings} color={S.accent} icon={<FileText size={16}/>}/>
            <KpiCard label="Total PAX" current={kpis.currentPax} previous={kpis.previousPax} pct={kpis.percentPax} color={S.success} icon={<Users size={16}/>}/>
            <KpiCard label="Gross Revenue" fmt="eur" current={kpis.currentRevenue} previous={kpis.previousRevenue} pct={kpis.percentRevenue} color={S.warn} icon={<BarChart2 size={16}/>}/>
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <Card>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:S.text}}>Revenue by Year</div>
                <div style={{fontSize:11,color:S.muted,marginTop:1}}>Monthly line per year</div>
              </div>
              <span style={{fontSize:10,color:S.muted2,background:S.bg,padding:"3px 8px",borderRadius:6,border:`1px solid ${S.border}`}}>2023–2026</span>
            </div>
            <LineChart data={chart}/>
          </Card>
          <Card>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:S.text}}>{metric==="pax"?"PAX":"Bookings"} by Month</div>
                <div style={{fontSize:11,color:S.muted,marginTop:1}}>Grouped by year</div>
              </div>
              <div style={{display:"flex",gap:4,background:S.bg,padding:3,borderRadius:7,border:`1px solid ${S.border}`}}>
                {["bookings","pax"].map(m=>(
                  <button key={m} onClick={()=>setMetric(m)} style={{padding:"3px 10px",borderRadius:5,fontSize:11,cursor:"pointer",border:"none",background:metric===m?S.accent:"transparent",color:metric===m?"#fff":S.muted,fontWeight:600,transition:"all 0.15s"}}>
                    {m==="pax"?"PAX":"Bookings"}
                  </button>
                ))}
              </div>
            </div>
            <BarChart data={chart} metric={metric}/>
          </Card>
        </div>
        <Card p="0">
          <div style={{padding:"14px 18px",borderBottom:`1px solid ${S.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:S.text}}>Year-on-Year Comparison</div>
              <div style={{fontSize:11,color:S.muted,marginTop:2}}>{sortedYm.length} months</div>
            </div>
            <div style={{display:"flex",gap:5,alignItems:"center"}}>
              <div style={{display:"flex",gap:3,background:S.bg,padding:3,borderRadius:7,border:`1px solid ${S.border}`}}>
                {["bookings","pax","revenue"].map(m=>(
                  <button key={m} onClick={()=>setYmMetric(m)} style={{padding:"3px 10px",borderRadius:5,fontSize:11,cursor:"pointer",border:"none",background:ymMetric===m?S.accent:"transparent",color:ymMetric===m?"#fff":S.muted,fontWeight:600,transition:"all 0.15s"}}>
                    {m==="pax"?"PAX":m.charAt(0).toUpperCase()+m.slice(1)}
                  </button>
                ))}
              </div>
              <button onClick={()=>{
                const cols=["Period","Current Year","Previous Year","Current Value","Previous Value","Difference","Diff %"];
                const rows=sortedYm.map(r=>{
                  const cy_=r.currentYear||r.year;
                  const cur=ymMetric==="revenue"?r.currentRevenue:ymMetric==="pax"?r.currentPax:r.currentBookings;
                  const prv=ymMetric==="revenue"?r.previousRevenue:ymMetric==="pax"?r.previousPax:r.previousBookings;
                  const dif=ymMetric==="revenue"?r.diffRevenue:ymMetric==="pax"?r.diffPax:r.diffBookings;
                  const pct=ymMetric==="revenue"?r.diffPctRevenue:ymMetric==="pax"?r.diffPctPax:r.diffPctBookings;
                  return[`${MONTHS[r.month-1]}-${cy_}`,cy_,cy_-1,cur,prv,dif,pct??''].join(",");
                });
                const csv=[cols.join(","),...rows].join("\n");
                const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="yoy.csv";a.click();
              }} style={{padding:"5px 10px",background:"transparent",border:`1px solid ${S.border2}`,borderRadius:6,color:S.muted,fontSize:11,cursor:"pointer",fontWeight:600}}>↓ CSV</button>
            </div>
          </div>
          <div style={{overflowX:"auto",maxHeight:400,overflowY:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead style={{position:"sticky",top:0,zIndex:5,background:"#f8faff"}}>
                <tr>
                  {[["Period","left"],["Current","right"],["Previous","right"],["Difference","right"],["Diff %","right"]].map(([h,a],i)=>(
                    <th key={i} style={{padding:"10px 14px",textAlign:a,color:S.muted,fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap",borderBottom:`1px solid ${S.border}`}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedYm.length===0&&!loading&&(
                  <tr><td colSpan={5} style={{padding:32,textAlign:"center",color:S.muted}}>No data — click Apply Filters</td></tr>
                )}
                {sortedYm.map((r,i)=>{
                  const cy_=r.currentYear||r.year;
                  const cur=ymMetric==="revenue"?r.currentRevenue:ymMetric==="pax"?r.currentPax:r.currentBookings;
                  const prv=ymMetric==="revenue"?r.previousRevenue:ymMetric==="pax"?r.previousPax:r.previousBookings;
                  const dif=ymMetric==="revenue"?r.diffRevenue:ymMetric==="pax"?r.diffPax:r.diffBookings;
                  const pct=ymMetric==="revenue"?r.diffPctRevenue:ymMetric==="pax"?r.diffPctPax:r.diffPctBookings;
                  const fmt=ymMetric==="revenue"?fmtM:fmtN;
                  return(
                    <tr key={i} style={{borderBottom:"1px solid #dbeafe",background:i%2===0?"#ffffff":"#f0f7ff"}}>
                      <td style={{padding:"9px 14px",fontWeight:600,color:S.text,whiteSpace:"nowrap"}}>
                        <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:YC[cy_]||S.accent,marginRight:8,verticalAlign:"middle"}}/>
                        {MONTHS[r.month-1]}-{cy_}
                      </td>
                      <td style={{padding:"9px 14px",textAlign:"right",color:S.text,fontWeight:600}}>{fmt(cur)}</td>
                      <td style={{padding:"9px 14px",textAlign:"right",color:S.muted}}>{fmt(prv)}</td>
                      <td style={{padding:"9px 14px",textAlign:"right",fontWeight:600,color:dc(dif)}}>
                        {dif!=null?(parseFloat(dif)>=0?"+":"-")+fmt(Math.abs(dif)):"—"}
                      </td>
                      <td style={{padding:"9px 14px",textAlign:"right"}}>
                        {pct!=null?(
                          <span style={{background:parseFloat(pct)>=0?S.successBg:S.dangerBg,color:parseFloat(pct)>=0?S.success:S.danger,padding:"2px 7px",borderRadius:5,fontSize:11,fontWeight:700}}>
                            {parseFloat(pct)>=0?"↑":"↓"} {Math.abs(parseFloat(pct)).toFixed(1)}%
                          </span>
                        ):"—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function BusTab({token}){
  const[view,setView]=useState("pendel");
  const[sl,setSl]=useState({pendels:[],deckPendels:[],regions:[],statuses:[],feederLines:[],feederLabels:[],statusesEnglish:[]});
  const[busK,setBusK]=useState(null);
  const[pendel,setPendel]=useState([]);
  const[feeder,setFeeder]=useState([]);
  const[deck,setDeck]=useState([]);
  const[loading,setLoading]=useState(false);
  const[f,setF]=useState({dateFrom:`${cy}-01-01`,dateTo:`${cy}-12-31`,pendel:[],region:[],label:[],feederLine:[],weekday:[],status:[],_collapsed:false});

  useEffect(()=>{
    api("/api/dashboard/bus-slicers",{},token).then(d=>{
      if(d&&!d.error){
        console.log("bus-slicers loaded:",d);
        setSl({...d, feederLabels: d.feederLabels||["Solmar","Interbus","Solmar DE"]});
      }
    }).catch(e=>console.error("bus-slicers error:",e));
  },[token]);

  function applyLoad(){
    setLoading(true);

    // Params for deck & kpis (solmar_bus_deck_choice — has Label, Region, Status, Pendel)
    const p={};
    if(f.dateFrom)p.dateFrom=f.dateFrom;
    if(f.dateTo)p.dateTo=f.dateTo;
    if(f.pendel?.length)p.pendel=f.pendel;
    if(f.region?.length)p.region=f.region;
    if(f.weekday?.length)p.weekday=f.weekday;
    if(f.status?.length)p.status=f.status;
    if(f.label?.length)p.label=f.label;

    // Params for pendel (BUStrips — status triggers ETL reload with those statuses)
    const pp={};
    if(f.dateFrom)pp.dateFrom=f.dateFrom;
    if(f.dateTo)pp.dateTo=f.dateTo;
    if(f.pendel?.length)pp.pendel=f.pendel;
    if(f.weekday?.length)pp.weekday=f.weekday;
    if(f.status?.length)pp.status=f.status;

    // Params for feeder (FeederOverview — has dateFrom, dateTo, feederLine, label, weekday)
    const fp={};
    if(f.dateFrom)fp.dateFrom=f.dateFrom;
    if(f.dateTo)fp.dateTo=f.dateTo;
    if(f.feederLine?.length)fp.feederLine=f.feederLine;
    if(f.label?.length)fp.label=f.label;
    if(f.weekday?.length)fp.weekday=f.weekday;

    Promise.all([
      api("/api/dashboard/bus-kpis",p,token).catch(()=>({})),
      api("/api/dashboard/pendel-overview",pp,token).catch(()=>[]),
      api("/api/dashboard/feeder-overview",fp,token).catch(()=>[]),
      api("/api/dashboard/deck-class",p,token).catch(()=>[])
    ]).then(([k,pd,fd,dc])=>{
      setBusK(k||{});
      setPendel(Array.isArray(pd)?pd:[]);
      setFeeder(Array.isArray(fd)?fd:[]);
      setDeck(Array.isArray(dc)?dc:[]);
    }).finally(()=>setLoading(false));
  }
  useEffect(()=>{applyLoad();},[token]);

  function resetFilters(){
    const e={dateFrom:`${cy}-01-01`,dateTo:`${cy}-12-31`,pendel:[],region:[],label:[],feederLine:[],weekday:[],status:[],_collapsed:false};
    setF(e);
    setLoading(true);
    Promise.all([
      api("/api/dashboard/bus-kpis",{dateFrom:`${cy}-01-01`,dateTo:`${cy}-12-31`},token).catch(()=>({})),
      api("/api/dashboard/pendel-overview",{dateFrom:`${cy}-01-01`,dateTo:`${cy}-12-31`},token).catch(()=>[]),
      api("/api/dashboard/feeder-overview",{dateFrom:`${cy}-01-01`,dateTo:`${cy}-12-31`},token).catch(()=>[]),
      api("/api/dashboard/deck-class",{dateFrom:`${cy}-01-01`,dateTo:`${cy}-12-31`},token).catch(()=>[])
    ]).then(([k,pd,fd,dc])=>{
      setBusK(k||{});
      setPendel(Array.isArray(pd)?pd:[]);
      setFeeder(Array.isArray(fd)?fd:[]);
      setDeck(Array.isArray(dc)?dc:[]);
    }).finally(()=>setLoading(false));
  }

  // Exclude "Totaal vertrek" stop rows — totals come from RouteTotal on route header
  const feederRows = feeder.filter(r => r.StopType !== 'TOTAL' && (r.StopName||'').toLowerCase() !== 'totaal vertrek');
  // Sort dates properly as real dates
  const fdates=[...new Set(feederRows.map(r=>r.DepartureDate))].sort((a,b)=>{
    const pa=a.split('-'),pb=b.split('-');
    const da=new Date(pa[2],pa[1]-1,pa[0]);
    const db=new Date(pb[2],pb[1]-1,pb[0]);
    return da-db;
  });
  const froutes={};
  const fgrand={}; // grand total per date across all routes
  feederRows.forEach(r=>{
    const rk=r.RouteNo+'||'+r.RouteLabel;
    if(!froutes[rk])froutes[rk]={no:r.RouteNo,label:r.RouteLabel,stops:{},totals:{}};
    if(!froutes[rk].stops[r.StopName])froutes[rk].stops[r.StopName]={};
    froutes[rk].stops[r.StopName][r.DepartureDate]=(froutes[rk].stops[r.StopName][r.DepartureDate]||0)+(r.TotalPax||0);
    froutes[rk].totals[r.DepartureDate]=(froutes[rk].totals[r.DepartureDate]||0)+(r.TotalPax||0);
    fgrand[r.DepartureDate]=(fgrand[r.DepartureDate]||0)+(r.TotalPax||0);
  });
  const rl=Object.values(froutes).sort((a,b)=>a.no-b.no);

  const TH={padding:"9px 12px",textAlign:"right",fontSize:11,fontWeight:700,color:"#ffffff",textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap",background:"#1e40af",borderRight:"1px solid #3b82f6"};
  const THL={...TH,textAlign:"left"};
  const TD={padding:"8px 12px",textAlign:"right",fontSize:12,color:S.text,whiteSpace:"nowrap",borderBottom:"1px solid #dbeafe",borderRight:"1px solid #e8f0fe"};
  const TDL={...TD,textAlign:"left"};
  const lbl=l=><label style={{fontSize:10,color:S.muted,display:"block",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>{l}</label>;
  const sel=(val,set,opts)=><select value={val} onChange={e=>set(e.target.value)} style={{width:"100%",background:S.bg,border:`1px solid ${S.border2}`,borderRadius:6,padding:"6px 8px",color:S.text,fontSize:11,outline:"none"}}><option value="">All</option>{opts.map(o=><option key={o} value={o}>{o}</option>)}</select>;
  const di=(val,set)=><input type="date" value={val} onChange={e=>set(e.target.value)} style={{width:"100%",background:S.bg,border:`1px solid ${S.border2}`,borderRadius:6,padding:"6px 8px",color:S.text,fontSize:11,boxSizing:"border-box",outline:"none"}}/>;
  const WEEKDAYS=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const deckTotals=deck.reduce((acc,r)=>{["Total","Total_Lower","Total_Upper","Total_NoDeck","Royal_Total","Royal_Lower","Royal_Upper","Royal_NoDeck","First_Total","First_Lower","First_Upper","First_NoDeck","Premium_Total","Premium_Lower","Premium_Upper","Premium_NoDeck"].forEach(k=>{acc[k]=(acc[k]||0)+(r[k]||0);});return acc;},{});
  const pct=(a,b)=>b>0?`${((a/b)*100).toFixed(1)}%`:"—";

  return(
    <div style={{display:"flex",flexDirection:"row",height:"100%",overflow:"hidden",background:S.bg}}>
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{background:S.card,borderBottom:`1px solid ${S.border}`,padding:"10px 16px",display:"flex",gap:6,flexShrink:0,boxShadow:S.shadow}}>
          {[["pendel","Pendel Overview",<Bus size={13}/>],["deck","Deck & Class",<Layers size={13}/>],["feeder","Feeder Routes",<Map size={13}/>]].map(([v,l,ic])=>(
            <button key={v} onClick={()=>setView(v)} style={{padding:"6px 14px",borderRadius:7,fontSize:12,cursor:"pointer",border:`1.5px solid ${view===v?S.accent:S.border2}`,background:view===v?S.accent:"transparent",color:view===v?"#fff":S.textLight,fontWeight:600,transition:"all 0.15s",display:"flex",alignItems:"center",gap:5}}>{ic}{l}</button>
          ))}
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
            {loading&&<span style={{fontSize:11,color:S.muted}}>Loading…</span>}
            <button onClick={applyLoad} style={{padding:"5px 12px",borderRadius:7,fontSize:11,cursor:"pointer",border:`1px solid ${S.border2}`,background:"transparent",color:S.muted,display:"flex",alignItems:"center",gap:4,fontWeight:600}}>
              <RotateCcw size={11}/>Refresh
            </button>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:18,display:"flex",flexDirection:"column",gap:14}}>
          {busK&&view==="deck"&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
              {[
                {l:"Total PAX",v:fmtN(busK.total_pax),c:S.accent,icon:<Users size={15}/>},
                {l:"Royal Class (RC)",v:fmtN(busK.royal_pax),c:S.warn,icon:<Star size={15}/>},
                {l:"First Class (FC)",v:fmtN(busK.first_pax),c:S.success,icon:<TrendingUp size={15}/>},
                {l:"Premium (PRE)",v:fmtN(busK.premium_pax),c:S.purple,icon:<CreditCard size={15}/>},
                {l:"Lower Deck",v:fmtN(busK.lower_pax),c:S.accent2,icon:<ArrowDown size={15}/>},
                {l:"Upper Deck",v:fmtN(busK.upper_pax),c:S.success,icon:<ArrowUp size={15}/>},
                {l:"No Deck Pref",v:fmtN(busK.no_deck_pax),c:S.muted,icon:<CircleDot size={15}/>},
              ].map(k=>(
                <div key={k.l} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:10,padding:"12px 14px",boxShadow:S.shadow}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <div style={{fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>{k.l}</div>
                    <span style={{fontSize:14}}>{k.icon}</span>
                  </div>
                  <div style={{fontSize:20,fontWeight:800,color:k.c}}>{k.v}</div>
                </div>
              ))}
            </div>
          )}
{view==="pendel"&&(
            <Card p="0">
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${S.border}`,fontSize:13,fontWeight:700,color:S.text,display:"flex",alignItems:"center",gap:6,justifyContent:"space-between"}}>
                <span style={{display:"flex",alignItems:"center",gap:6}}><Bus size={14} color={S.accent}/>Pendel Overview</span>
                <button onClick={()=>{
                  const statusParams = f.status?.length ? '&'+f.status.map(s=>`status=${s}`).join('&') : '';
                  fetch(`${BASE}/api/dashboard/reload-bustrips?${statusParams}`,{headers:{Authorization:`Bearer ${token}`}})
                    .then(r=>r.json()).then(d=>{
                      if(d.ok){console.log('[ETL] BUStrips reloaded:',d);applyLoad();}
                    }).catch(()=>{});
                }} style={{padding:"4px 10px",borderRadius:6,fontSize:11,cursor:"pointer",border:`1px solid ${S.accent}33`,background:S.accentLight,color:S.accent,fontWeight:600,display:"flex",alignItems:"center",gap:4}}>
                  <RotateCcw size={10}/>Reload ETL
                </button>
              </div>
              <div style={{overflowX:"auto",maxHeight:560,overflowY:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead>
                    <tr>
                      <th style={{padding:"8px 12px",textAlign:"left",background:"#1a56db",color:"#fff",fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap",borderRight:"1px solid #2563eb"}} rowSpan={2}>Start Date</th>
                      <th style={{padding:"8px 12px",textAlign:"center",background:"#1a56db",color:"#fff",fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:"0.05em",borderRight:"2px solid #fff"}} colSpan={4}>Outbound</th>
                      <th style={{padding:"8px 12px",textAlign:"left",background:"#1a56db",color:"#fff",fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap",borderRight:"1px solid #2563eb"}} rowSpan={2}>Return Date</th>
                      <th style={{padding:"8px 12px",textAlign:"center",background:"#1a56db",color:"#fff",fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:"0.05em",borderRight:"2px solid #fff"}} colSpan={4}>Inbound</th>
                      <th style={{padding:"8px 12px",textAlign:"center",background:"#d97706",color:"#fff",fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:"0.05em"}} colSpan={4}>Difference Outbound vs Inbound</th>
                    </tr>
                    <tr>
                      {["Total","Royal Class","First Class","Premium Class"].map((h,i)=>(
                        <th key={"o"+i} style={{padding:"7px 12px",textAlign:"right",background:"#dbeafe",color:"#1e40af",fontWeight:700,fontSize:10,borderBottom:"2px solid #93c5fd",borderRight:i===3?"2px solid #fff":"1px solid #bfdbfe",whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                      {["Total","Royal Class","First Class","Premium Class"].map((h,i)=>(
                        <th key={"i"+i} style={{padding:"7px 12px",textAlign:"right",background:"#dbeafe",color:"#1e40af",fontWeight:700,fontSize:10,borderBottom:"2px solid #93c5fd",borderRight:i===3?"2px solid #d97706":"1px solid #bfdbfe",whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                      {["Total","Royal Class","First Class","Premium Class"].map((h,i)=>(
                        <th key={"d"+i} style={{padding:"7px 12px",textAlign:"right",background:"#fef3c7",color:"#92400e",fontWeight:700,fontSize:10,borderBottom:"2px solid #fcd34d",borderRight:i<3?"1px solid #fde68a":"none",whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pendel.length===0&&<tr><td colSpan={13} style={{padding:28,textAlign:"center",color:S.muted}}>No data — click Apply Filters</td></tr>}
                    {[...pendel].sort((a,b)=>{const pa=a.StartDate.split('-'),pb=b.StartDate.split('-');return new Date(pa[2],pa[1]-1,pa[0])-new Date(pb[2],pb[1]-1,pb[0]);}).map((r,i)=>(
                      <tr key={i} style={{borderBottom:"1px solid #dbeafe",background:i%2===0?"#ffffff":"#f0f7ff"}}>
                        <td style={{padding:"8px 12px",fontWeight:600,color:S.accent,whiteSpace:"nowrap",borderRight:"1px solid #bfdbfe"}}>{r.StartDate}</td>
                        <td style={{padding:"8px 12px",textAlign:"right",fontWeight:700,color:S.text,borderRight:"1px solid #bfdbfe"}}>{fmtN(r.Outbound_Total)}</td>
                        <td style={{padding:"8px 12px",textAlign:"right",color:S.warn,borderRight:"1px solid #bfdbfe"}}>{fmtN(r.ORC)}</td>
                        <td style={{padding:"8px 12px",textAlign:"right",color:S.success,borderRight:"1px solid #bfdbfe"}}>{fmtN(r.OFC)}</td>
                        <td style={{padding:"8px 12px",textAlign:"right",color:S.purple,borderRight:"2px solid #93c5fd"}}>{fmtN(r.OPRE)}</td>
                        <td style={{padding:"8px 12px",fontWeight:600,color:S.muted,whiteSpace:"nowrap",borderRight:"1px solid #bfdbfe"}}>{r.EndDate}</td>
                        <td style={{padding:"8px 12px",textAlign:"right",fontWeight:700,color:S.text,borderRight:"1px solid #bfdbfe"}}>{fmtN(r.Inbound_Total)}</td>
                        <td style={{padding:"8px 12px",textAlign:"right",color:S.warn,borderRight:"1px solid #bfdbfe"}}>{fmtN(r.RRC)}</td>
                        <td style={{padding:"8px 12px",textAlign:"right",color:S.success,borderRight:"1px solid #bfdbfe"}}>{fmtN(r.RFC)}</td>
                        <td style={{padding:"8px 12px",textAlign:"right",color:S.purple,borderRight:"2px solid #fcd34d"}}>{fmtN(r.RPRE)}</td>
                        <td style={{padding:"8px 12px",textAlign:"right",fontWeight:700,color:dc(r.Diff_Total),borderRight:"1px solid #fde68a"}}>{r.Diff_Total>=0?"+":""}{fmtN(r.Diff_Total)}</td>
                        <td style={{padding:"8px 12px",textAlign:"right",color:dc(r.Diff_Royal),borderRight:"1px solid #fde68a"}}>{r.Diff_Royal>=0?"+":""}{fmtN(r.Diff_Royal)}</td>
                        <td style={{padding:"8px 12px",textAlign:"right",color:dc(r.Diff_First),borderRight:"1px solid #fde68a"}}>{r.Diff_First>=0?"+":""}{fmtN(r.Diff_First)}</td>
                        <td style={{padding:"8px 12px",textAlign:"right",color:dc(r.Diff_Premium)}}>{r.Diff_Premium>=0?"+":""}{fmtN(r.Diff_Premium)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          {view==="deck"&&(
            <Card p="0">
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${S.border}`,fontSize:13,fontWeight:700,color:S.text,display:"flex",alignItems:"center",gap:6}}><Layers size={14} color={S.accent}/>Deck & Class Distribution</div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr>
                    <th style={{padding:"9px 12px",textAlign:"left",background:"#1e40af",color:"#fff",fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap",borderRight:"1px solid #3b82f6"}}>Class</th>
                    <th style={{padding:"9px 12px",textAlign:"right",background:"#1e40af",color:"#fff",fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap",borderRight:"1px solid #3b82f6"}}>Total PAX</th>
                    <th style={{padding:"9px 12px",textAlign:"right",background:"#1e40af",color:"#ffffff",fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap",borderRight:"1px solid #3b82f6"}}>Lower</th>
                    <th style={{padding:"9px 12px",textAlign:"right",background:"#1e40af",color:"#ffffff",fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap",borderRight:"1px solid #3b82f6"}}>Upper</th>
                    <th style={{padding:"9px 12px",textAlign:"right",background:"#1e40af",color:"#ffffff",fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap",borderRight:"1px solid #3b82f6"}}>No Deck</th>
                    <th style={{padding:"9px 12px",textAlign:"right",background:"#1e40af",color:"#ffffff",fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap",borderRight:"1px solid #3b82f6"}}>Lower %</th>
                    <th style={{padding:"9px 12px",textAlign:"right",background:"#1e40af",color:"#ffffff",fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap"}}>Upper %</th>
                  </tr></thead>
                  <tbody>
                    {[
                      {label:"TOTAL",total:"Total",lower:"Total_Lower",upper:"Total_Upper",noDeck:"Total_NoDeck",c:S.text,bold:true},
                      {label:"Royal Class",total:"Royal_Total",lower:"Royal_Lower",upper:"Royal_Upper",noDeck:"Royal_NoDeck",c:S.warn},
                      {label:"First Class",total:"First_Total",lower:"First_Lower",upper:"First_Upper",noDeck:"First_NoDeck",c:S.success},
                      {label:"Premium Class",total:"Premium_Total",lower:"Premium_Lower",upper:"Premium_Upper",noDeck:"Premium_NoDeck",c:S.purple},
                    ].map((row,i)=>(
                      <tr key={i} style={{borderBottom:"1px solid #dbeafe",background:i===0?"#eff6ff":i%2===0?"#ffffff":"#f0f7ff"}}>
                        <td style={{padding:"9px 12px",textAlign:"left",fontWeight:i===0?800:600,color:row.c,borderRight:"1px solid #dbeafe",fontSize:12}}>{row.label}</td>
                        <td style={{padding:"9px 12px",textAlign:"right",fontWeight:700,color:row.c,borderRight:"1px solid #dbeafe",fontSize:12}}>{fmtN(deckTotals[row.total]||0)}</td>
                        <td style={{padding:"9px 12px",textAlign:"right",color:S.accent,borderRight:"1px solid #dbeafe",fontSize:12}}>{fmtN(deckTotals[row.lower]||0)}</td>
                        <td style={{padding:"9px 12px",textAlign:"right",color:S.success,borderRight:"1px solid #dbeafe",fontSize:12}}>{fmtN(deckTotals[row.upper]||0)}</td>
                        <td style={{padding:"9px 12px",textAlign:"right",color:S.muted,borderRight:"1px solid #dbeafe",fontSize:12}}>{fmtN(deckTotals[row.noDeck]||0)}</td>
                        <td style={{padding:"9px 12px",textAlign:"right",color:S.accent,borderRight:"1px solid #dbeafe",fontSize:12}}>{pct(deckTotals[row.lower]||0,deckTotals[row.total]||1)}</td>
                        <td style={{padding:"9px 12px",textAlign:"right",color:S.success,fontSize:12}}>{pct(deckTotals[row.upper]||0,deckTotals[row.total]||1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {deck.length>0&&(
                <>
                  <div style={{padding:"8px 16px",borderTop:`1px solid ${S.border}`,borderBottom:`1px solid ${S.border}`,fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.06em",background:"#f8faff"}}>By Departure Date — Pivot</div>
                  <div style={{overflowX:"auto",maxHeight:400,overflowY:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                      <thead style={{position:"sticky",top:0,background:"#f8faff",zIndex:5}}>
                        <tr>
                          <th style={{...THL,borderRight:"2px solid #2563eb"}} rowSpan={2}>Date</th>
                          <th style={{...TH,textAlign:"center",borderRight:`1px solid ${S.border2}`,color:"#ffffff"}} colSpan={4}>Total</th>
                          <th style={{...TH,textAlign:"center",borderRight:`1px solid ${S.border2}`,color:"#ffffff"}} colSpan={4}>Royal Class</th>
                          <th style={{...TH,textAlign:"center",borderRight:`1px solid ${S.border2}`,color:"#ffffff"}} colSpan={4}>First Class</th>
                          <th style={{...TH,textAlign:"center",borderRight:`1px solid ${S.border2}`,color:"#ffffff"}} colSpan={4}>Premium Class</th>
                          </tr>
                        <tr>
                          {["Total","Lower","Upper","No Deck","Total","Lower","Upper","No Deck","Total","Lower","Upper","No Deck","Total","Lower","Upper","No Deck"].map((h,i)=>(
                            <th key={i} style={{...TH,fontSize:9,borderRight:i===3||i===7||i===11?"2px solid #2563eb":"1px solid #2563eb"}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...deck].sort((a,b)=>{const pa=(a.BusStartDate||'').split('-'),pb=(b.BusStartDate||'').split('-');return new Date(pa[2],pa[1]-1,pa[0])-new Date(pb[2],pb[1]-1,pb[0]);}).map((r,i)=>(
                          <tr key={i} style={{borderBottom:"1px solid #dbeafe",background:i%2===0?"#ffffff":"#f0f7ff"}}>
                            <td style={{...TDL,fontSize:11,fontWeight:600,borderRight:`2px solid ${S.border2}`}}>{r.BusStartDate||''}</td>
                            <td style={{...TD,fontWeight:700}}>{fmtN(r.Total)}</td>
                            <td style={{...TD,color:S.accent}}>{fmtN(r.Total_Lower)}</td>
                            <td style={{...TD,color:S.success}}>{fmtN(r.Total_Upper)}</td>
                            <td style={{...TD,color:S.muted,borderRight:`1px solid ${S.border2}`}}>{fmtN(r.Total_NoDeck)}</td>
                            <td style={{...TD,fontWeight:600,color:S.warn}}>{fmtN(r.Royal_Total)}</td>
                            <td style={TD}>{fmtN(r.Royal_Lower)}</td>
                            <td style={TD}>{fmtN(r.Royal_Upper)}</td>
                            <td style={{...TD,borderRight:`1px solid ${S.border2}`}}>{fmtN(r.Royal_NoDeck)}</td>
                            <td style={{...TD,fontWeight:600,color:S.success}}>{fmtN(r.First_Total)}</td>
                            <td style={TD}>{fmtN(r.First_Lower)}</td>
                            <td style={TD}>{fmtN(r.First_Upper)}</td>
                            <td style={{...TD,borderRight:`1px solid ${S.border2}`}}>{fmtN(r.First_NoDeck)}</td>
                            <td style={{...TD,fontWeight:600,color:S.purple}}>{fmtN(r.Premium_Total)}</td>
                            <td style={TD}>{fmtN(r.Premium_Lower)}</td>
                            <td style={TD}>{fmtN(r.Premium_Upper)}</td>
                            <td style={{...TD,borderRight:`1px solid ${S.border2}`}}>{fmtN(r.Premium_NoDeck)}</td> 
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Card>
          )}
          {view==="feeder"&&(
            <Card p="0">
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${S.border}`,fontSize:13,fontWeight:700,color:S.text,display:"flex",alignItems:"center",gap:6,justifyContent:"space-between"}}>
                <span style={{display:"flex",alignItems:"center",gap:6}}><Map size={14} color={S.accent}/>Feeder Routes</span>
                <button onClick={()=>{
                  const statusParams = f.status?.length ? '&'+f.status.map(s=>`status=${s}`).join('&') : '';
                  fetch(`${BASE}/api/dashboard/reload-feeder?${statusParams}`,{headers:{Authorization:`Bearer ${token}`}})
                    .then(r=>r.json()).then(d=>{
                      if(d.ok){console.log('[ETL] Feeder reloaded:',d);applyLoad();}
                    }).catch(()=>{});
                }} style={{padding:"4px 10px",borderRadius:6,fontSize:11,cursor:"pointer",border:`1px solid ${S.accent}33`,background:S.accentLight,color:S.accent,fontWeight:600,display:"flex",alignItems:"center",gap:4}}>
                  <RotateCcw size={10}/>Reload ETL
                </button>
              </div>
              <div style={{overflowX:"auto",maxHeight:540,overflowY:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead style={{position:"sticky",top:0,zIndex:5}}><tr>
                    <th style={THL}>Route / Stop</th>
                    {fdates.map(d=><th key={d} style={TH}>{d}</th>)}
                    <th style={{...TH,color:S.warn}}>Total</th>
                  </tr></thead>
                  <tbody>
                    {rl.length===0&&<tr><td colSpan={fdates.length+2} style={{padding:28,textAlign:"center",color:S.muted}}>No feeder data</td></tr>}
                    {rl.length>0&&(
                      <tr style={{background:"#1e3a8a"}}>
                        <td style={{...TDL,fontWeight:800,color:"#fff",fontSize:12}}>ALL ROUTES — TOTAL</td>
                        {fdates.map(d=><td key={d} style={{...TD,fontWeight:800,color:"#fff",background:"#1e3a8a"}}>{fmtN(fgrand[d]||0)}</td>)}
                        <td style={{...TD,fontWeight:800,color:"#fbbf24",background:"#1e3a8a"}}>{fmtN(Object.values(fgrand).reduce((a,b)=>a+b,0))}</td>
                      </tr>
                    )}
                    {rl.map((route,ri)=>(
                      <React.Fragment key={ri}>
                        <tr style={{background:"#dbeafe"}}>
                          <td style={{...TDL,fontWeight:700,color:S.accent}}>Route {route.no} — {route.label}</td>
                          {fdates.map(d=><td key={d} style={{...TD,fontWeight:700,color:S.accent}}>{fmtN(route.totals[d]||0)}</td>)}
                          <td style={{...TD,fontWeight:700,color:S.warn}}>{fmtN(Object.values(route.totals).reduce((a,b)=>a+b,0))}</td>
                        </tr>
                        {Object.entries(route.stops).map(([stop,dates],si)=>(
                          <tr key={si} style={{borderBottom:"1px solid #dbeafe",background:si%2===0?"#ffffff":"#f0f7ff"}}>
                            <td style={{...TDL,paddingLeft:24,color:S.muted}}>{stop}</td>
                            {fdates.map(d=><td key={d} style={TD}>{dates[d]||"—"}</td>)}
                            <td style={{...TD,color:S.muted}}>{fmtN(Object.values(dates).reduce((a,b)=>a+b,0))}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
      <div style={{width:f._collapsed?44:260,background:S.card,borderLeft:`1px solid ${S.border}`,display:"flex",flexDirection:"column",flexShrink:0,transition:"width 0.2s",boxShadow:"-2px 0 8px rgba(0,0,0,0.04)"}}>
        {/* Header */}
        <div style={{padding:"12px 10px",borderBottom:`1px solid ${S.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",minHeight:44}} onClick={()=>setF(p=>({...p,_collapsed:!p._collapsed}))}>
          {!f._collapsed&&(
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <Filter size={13} color={S.accent}/>
              <span style={{fontSize:11,fontWeight:700,color:S.text,textTransform:"uppercase",letterSpacing:"0.08em"}}>Filters</span>
            </div>
          )}
          <span style={{marginLeft:"auto",color:S.muted,fontSize:16,lineHeight:1,fontWeight:300}}>{f._collapsed?"›":"‹"}</span>
        </div>

        {!f._collapsed&&(
          <>
            <div style={{flex:1,padding:"10px 12px",overflowY:"auto",display:"flex",flexDirection:"column",gap:12}}>

              {/* DATE RANGE */}
              <div style={{background:S.bg,borderRadius:8,padding:"10px 10px",border:`1px solid ${S.border}`}}>
                <div style={{fontSize:10,fontWeight:700,color:S.accent,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8,display:"flex",alignItems:"center",gap:4}}>
                  <span style={{width:3,height:12,background:S.accent,borderRadius:2,display:"inline-block"}}/>Date Range
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  <div>{lbl("From")}{di(f.dateFrom,v=>setF({...f,dateFrom:v}))}</div>
                  <div>{lbl("To")}{di(f.dateTo,v=>setF({...f,dateTo:v}))}</div>
                </div>
                <div style={{display:"flex",gap:4,marginTop:8,flexWrap:"wrap"}}>
                  {[
                    {l:"2024",from:"2024-01-01",to:"2024-12-31"},
                    {l:"2025",from:"2025-01-01",to:"2025-12-31"},
                    {l:"2026",from:"2026-01-01",to:"2026-12-31"},
                    {l:"All",from:"2020-01-01",to:`${cy}-12-31`},
                  ].map(q=>(
                    <button key={q.l} onClick={()=>setF({...f,dateFrom:q.from,dateTo:q.to})}
                      style={{padding:"2px 7px",borderRadius:4,fontSize:10,cursor:"pointer",border:`1px solid ${f.dateFrom===q.from&&f.dateTo===q.to?S.accent:S.border2}`,background:f.dateFrom===q.from&&f.dateTo===q.to?S.accentLight:"transparent",color:f.dateFrom===q.from&&f.dateTo===q.to?S.accent:S.textLight,fontWeight:600}}>
                      {q.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* STATUS — Pendel and Deck only, NOT Feeder */}
              {view!=="feeder"&&(
                <div style={{background:S.bg,borderRadius:8,padding:"10px 10px",border:`1px solid ${S.border}`}}>
                  <div style={{fontSize:10,fontWeight:700,color:S.accent,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:3,height:12,background:S.accent,borderRadius:2,display:"inline-block"}}/>Status</span>
                    {f.status?.length>0&&<span onClick={()=>setF({...f,status:[]})} style={{fontSize:9,color:S.danger,cursor:"pointer",fontWeight:600}}>✕ Clear</span>}
                  </div>
                  {[{v:"DEF",l:"DEF"},{v:"TIJD",l:"TIJD"},{v:"DEF-GEANNULEERD",l:"DEF-GEANNULEERD"},{v:"CTRL",l:"CTRL"},{v:"IN_AANVRAAG",l:"IN_AANVRAAG"},{v:"ACC AV NIET OK",l:"ACC AV NIET OK"}].map(({v,l})=>{
                    const active=f.status?.includes(v);
                    return<div key={v} onClick={()=>setF({...f,status:active?f.status.filter(x=>x!==v):[...(f.status||[]),v]})} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 6px",borderRadius:5,cursor:"pointer",background:active?`${S.accent}12`:"transparent",marginBottom:2}}>
                      <div style={{width:13,height:13,borderRadius:3,border:`1.5px solid ${active?S.accent:S.border2}`,background:active?S.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        {active&&<span style={{color:"#fff",fontSize:9,lineHeight:1}}>✓</span>}
                      </div>
                      <span style={{fontSize:10,color:active?S.accent:S.textLight,fontWeight:active?600:400}}>{l}</span>
                    </div>;
                  })}
                </div>
              )}

              {/* LABEL */}
              <div style={{background:S.bg,borderRadius:8,padding:"10px 10px",border:`1px solid ${S.border}`}}>
                <div style={{fontSize:10,fontWeight:700,color:S.accent,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:3,height:12,background:S.accent,borderRadius:2,display:"inline-block"}}/>Label</span>
                  {f.label?.length>0&&<span onClick={()=>setF({...f,label:[]})} style={{fontSize:9,color:S.danger,cursor:"pointer",fontWeight:600}}>✕ Clear</span>}
                </div>
                {(view==="deck"?["STANDAARD","ITB","DEU"]:view==="feeder"?(sl.feederLabels||[]):["STANDAARD","DEU"]).map(o=>{
                  const active=f.label?.includes(o);
                  return<div key={o} onClick={()=>setF({...f,label:active?f.label.filter(x=>x!==o):[...(f.label||[]),o]})} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 6px",borderRadius:5,cursor:"pointer",background:active?`${S.purple}12`:"transparent",marginBottom:2}}>
                    <div style={{width:13,height:13,borderRadius:3,border:`1.5px solid ${active?S.purple:S.border2}`,background:active?S.purple:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {active&&<span style={{color:"#fff",fontSize:9,lineHeight:1}}>✓</span>}
                    </div>
                    <span style={{fontSize:10,color:active?S.purple:S.textLight,fontWeight:active?600:400}}>{o}</span>
                  </div>;
                })}
              </div>

              {/* PENDEL + REGION + WEEKDAY — Pendel & Deck views */}
              {view!=="feeder"&&(
                <div style={{background:S.bg,borderRadius:8,padding:"10px 10px",border:`1px solid ${S.border}`}}>
                  <div style={{fontSize:10,fontWeight:700,color:S.accent,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8,display:"flex",alignItems:"center",gap:4}}>
                    <span style={{width:3,height:12,background:S.accent,borderRadius:2,display:"inline-block"}}/>Route & Schedule
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {/* PENDEL multi-select */}
                    <div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                        {lbl("Pendel")}
                        {f.pendel?.length>0&&<span onClick={()=>setF({...f,pendel:[]})} style={{fontSize:9,color:S.danger,cursor:"pointer",fontWeight:600}}>✕ Clear</span>}
                      </div>
                      <div style={{maxHeight:120,overflowY:"auto",border:`1px solid ${S.border2}`,borderRadius:6,background:S.card}}>
                        {(view==="deck"?sl.deckPendels:(sl.pendels?.length?sl.pendels:["ACB","BEN","CBL","CBR","CLP","COB","CSE","KRO","LES","LLO","PEN","SAL","SSE"])).map(o=>{
                          const active=f.pendel?.includes(o);
                          return<div key={o} onClick={()=>setF({...f,pendel:active?f.pendel.filter(x=>x!==o):[...(f.pendel||[]),o]})} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 8px",cursor:"pointer",background:active?`${S.success}10`:"transparent",borderBottom:`1px solid ${S.border}`}}>
                            <div style={{width:12,height:12,borderRadius:3,border:`1.5px solid ${active?S.success:S.border2}`,background:active?S.success:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                              {active&&<span style={{color:"#fff",fontSize:8,lineHeight:1}}>✓</span>}
                            </div>
                            <span style={{fontSize:10,color:active?S.success:S.textLight,fontWeight:active?600:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o}</span>
                          </div>;
                        })}
                      </div>
                    </div>
                    {/* REGION multi-select — Deck only */}
                    {view==="deck"&&(
                      <div>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                          {lbl("Region")}
                          {f.region?.length>0&&<span onClick={()=>setF({...f,region:[]})} style={{fontSize:9,color:S.danger,cursor:"pointer",fontWeight:600}}>✕ Clear</span>}
                        </div>
                        <div style={{maxHeight:100,overflowY:"auto",border:`1px solid ${S.border2}`,borderRadius:6,background:S.card}}>
                          {sl.regions.map(o=>{
                            const active=f.region?.includes(o);
                            return<div key={o} onClick={()=>setF({...f,region:active?f.region.filter(x=>x!==o):[...(f.region||[]),o]})} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 8px",cursor:"pointer",background:active?`${S.warn}10`:"transparent",borderBottom:`1px solid ${S.border}`}}>
                              <div style={{width:12,height:12,borderRadius:3,border:`1.5px solid ${active?S.warn:S.border2}`,background:active?S.warn:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                {active&&<span style={{color:"#fff",fontSize:8,lineHeight:1}}>✓</span>}
                              </div>
                              <span style={{fontSize:10,color:active?S.warn:S.textLight,fontWeight:active?600:400}}>{o}</span>
                            </div>;
                          })}
                        </div>
                      </div>
                    )}
                    {/* WEEKDAY multi-select */}
                    <div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                        {lbl("Weekday")}
                        {f.weekday?.length>0&&<span onClick={()=>setF({...f,weekday:[]})} style={{fontSize:9,color:S.danger,cursor:"pointer",fontWeight:600}}>✕ Clear</span>}
                      </div>
                      <div style={{border:`1px solid ${S.border2}`,borderRadius:6,background:S.card}}>
                        {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map(d=>{
                          const active=f.weekday?.includes(d);
                          return<div key={d} onClick={()=>setF({...f,weekday:active?f.weekday.filter(x=>x!==d):[...(f.weekday||[]),d]})} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 8px",cursor:"pointer",background:active?`${S.orange}10`:"transparent",borderBottom:`1px solid ${S.border}`}}>
                            <div style={{width:12,height:12,borderRadius:3,border:`1.5px solid ${active?S.orange:S.border2}`,background:active?S.orange:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                              {active&&<span style={{color:"#fff",fontSize:8,lineHeight:1}}>✓</span>}
                            </div>
                            <span style={{fontSize:10,color:active?S.orange:S.textLight,fontWeight:active?600:400}}>{d}</span>
                          </div>;
                        })}
                      </div>
                    </div>
                    {view==="pendel"&&(
                      <div style={{marginTop:2,padding:"5px 7px",background:S.warnBg,borderRadius:5,border:`1px solid ${S.warn}22`}}>
                        <div style={{fontSize:9,color:S.warn,fontWeight:600}}>⚠ Status filter reloads BUStrips data</div>
                        <div style={{fontSize:9,color:S.muted2,marginTop:1}}>VERV is always excluded</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* FEEDER LINE + WEEKDAY — Feeder view only */}
              {view==="feeder"&&(
                <div style={{background:S.bg,borderRadius:8,padding:"10px 10px",border:`1px solid ${S.border}`}}>
                  <div style={{fontSize:10,fontWeight:700,color:S.accent,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8,display:"flex",alignItems:"center",gap:4}}>
                    <span style={{width:3,height:12,background:S.accent,borderRadius:2,display:"inline-block"}}/>Feeder Filters
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {/* FEEDER LINE multi-select */}
                    <div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                        {lbl("Feeder Line")}
                        {f.feederLine?.length>0&&<span onClick={()=>setF({...f,feederLine:[]})} style={{fontSize:9,color:S.danger,cursor:"pointer",fontWeight:600}}>✕ Clear</span>}
                      </div>
                      <div style={{maxHeight:120,overflowY:"auto",border:`1px solid ${S.border2}`,borderRadius:6,background:S.card}}>
                        {sl.feederLines.map(o=>{
                          const active=f.feederLine?.includes(o);
                          return<div key={o} onClick={()=>setF({...f,feederLine:active?f.feederLine.filter(x=>x!==o):[...(f.feederLine||[]),o]})} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 8px",cursor:"pointer",background:active?`${S.accent}10`:"transparent",borderBottom:`1px solid ${S.border}`}}>
                            <div style={{width:12,height:12,borderRadius:3,border:`1.5px solid ${active?S.accent:S.border2}`,background:active?S.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                              {active&&<span style={{color:"#fff",fontSize:8,lineHeight:1}}>✓</span>}
                            </div>
                            <span style={{fontSize:10,color:active?S.accent:S.textLight,fontWeight:active?600:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o}</span>
                          </div>;
                        })}
                      </div>
                    </div>
                    {/* WEEKDAY multi-select */}
                    <div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                        {lbl("Weekday")}
                        {f.weekday?.length>0&&<span onClick={()=>setF({...f,weekday:[]})} style={{fontSize:9,color:S.danger,cursor:"pointer",fontWeight:600}}>✕ Clear</span>}
                      </div>
                      <div style={{border:`1px solid ${S.border2}`,borderRadius:6,background:S.card}}>
                        {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map(d=>{
                          const active=f.weekday?.includes(d);
                          return<div key={d} onClick={()=>setF({...f,weekday:active?f.weekday.filter(x=>x!==d):[...(f.weekday||[]),d]})} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 8px",cursor:"pointer",background:active?`${S.orange}10`:"transparent",borderBottom:`1px solid ${S.border}`}}>
                            <div style={{width:12,height:12,borderRadius:3,border:`1.5px solid ${active?S.orange:S.border2}`,background:active?S.orange:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                              {active&&<span style={{color:"#fff",fontSize:8,lineHeight:1}}>✓</span>}
                            </div>
                            <span style={{fontSize:10,color:active?S.orange:S.textLight,fontWeight:active?600:400}}>{d}</span>
                          </div>;
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ACTIVE FILTERS SUMMARY */}
              {(f.status?.length||f.label?.length||f.pendel?.length||f.region?.length||f.weekday?.length||f.feederLine?.length)&&(
                <div style={{background:`${S.accent}08`,borderRadius:8,padding:"8px 10px",border:`1px solid ${S.accent}22`}}>
                  <div style={{fontSize:9,fontWeight:700,color:S.accent,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5}}>Active Filters</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                    {f.status?.map(v=><span key={v} style={{background:S.accentLight,color:S.accent,borderRadius:8,padding:"1px 6px",fontSize:9,fontWeight:600}}>{v}</span>)}
                    {f.label?.map(v=><span key={v} style={{background:`${S.purple}15`,color:S.purple,borderRadius:8,padding:"1px 6px",fontSize:9,fontWeight:600}}>{v}</span>)}
                    {f.pendel?.map(v=><span key={v} style={{background:`${S.success}15`,color:S.success,borderRadius:8,padding:"1px 6px",fontSize:9,fontWeight:600}}>{v}</span>)}
                    {f.region?.map(v=><span key={v} style={{background:`${S.warn}15`,color:S.warn,borderRadius:8,padding:"1px 6px",fontSize:9,fontWeight:600}}>{v}</span>)}
                    {f.weekday?.map(v=><span key={v} style={{background:`${S.orange}15`,color:S.orange,borderRadius:8,padding:"1px 6px",fontSize:9,fontWeight:600}}>{v}</span>)}
                    {f.feederLine?.map(v=><span key={v} style={{background:`${S.purple}15`,color:S.purple,borderRadius:8,padding:"1px 6px",fontSize:9,fontWeight:600}}>{v}</span>)}
                  </div>
                </div>
              )}

            </div>

            {/* ACTION BUTTONS */}
            <div style={{padding:"10px 12px",borderTop:`1px solid ${S.border}`,display:"flex",flexDirection:"column",gap:7}}>
              <Btn onClick={applyLoad} variant="primary" size="sm" style={{width:"100%",justifyContent:"center",gap:6}}>
                <Play size={11}/>Apply Filters
              </Btn>
              <Btn onClick={resetFilters} variant="secondary" size="sm" style={{width:"100%",justifyContent:"center",gap:6}}>
                <RotateCcw size={11}/>Reset
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const CAT_COLORS={
  "Coach":"#3b82f6",
  "Hotel":"#f97316",
  "Other":"#8b5cf6",
  "Service Line":"#10b981",
};
const CAT_ICONS={
  "Coach":"🚌","Hotel":"🏨","Other":"📦","Service Line":"🛎",
};

function ElementMarginChart({trend}){
  const[tooltip,setTooltip]=useState(null);
  if(!trend?.length)return<div style={{color:S.muted,textAlign:"center",padding:32,fontSize:12}}>No trend data</div>;
  const months=[...new Set(trend.map(r=>r.year*100+r.month))].sort();
  const cats=[...new Set(trend.map(r=>r.category))].sort();
  const grid={};
  months.forEach(ym=>{grid[ym]={};cats.forEach(c=>{grid[ym][c]=0;});});
  trend.forEach(r=>{const ym=r.year*100+r.month;if(grid[ym])grid[ym][r.category]=parseFloat(r.margin)||0;});
  const allVals=months.map(ym=>cats.reduce((s,c)=>s+(grid[ym][c]||0),0));
  const maxV=Math.max(...allVals,1);
  const W=580,H=200,PL=70,PR=10,PT=12,PB=44,CW=W-PL-PR,CH=H-PT-PB;
  const bw=Math.max(4,Math.floor(CW/months.length)-3);
  const fmtA=v=>v>=1e6?`€${(v/1e6).toFixed(1)}M`:v>=1e3?`€${(v/1e3).toFixed(0)}K`:`€${Math.round(v)}`;
  return(
    <div style={{position:"relative"}}>
      {tooltip&&(
        <div style={{position:"absolute",left:tooltip.x,top:tooltip.y,background:S.text,borderRadius:8,padding:"8px 12px",fontSize:11,color:"#fff",pointerEvents:"none",zIndex:10,whiteSpace:"nowrap",transform:"translate(-50%,-110%)",boxShadow:S.shadowLg}}>
          <div style={{fontWeight:700,marginBottom:4}}>{MONTHS[tooltip.month-1]} {tooltip.year}</div>
          {tooltip.cats.map(c=><div key={c.cat} style={{color:CAT_COLORS[c.cat]||S.accent}}>{CAT_ICONS[c.cat]||"•"} {c.cat}: <strong>{fmtA(c.v)}</strong></div>)}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}} onMouseLeave={()=>setTooltip(null)}>
        {[0,1,2,3,4].map(i=>{const y=PT+(CH/4)*i,v=maxV*(1-i/4);return<g key={i}><line x1={PL} x2={W-PR} y1={y} y2={y} stroke={S.border} strokeWidth={0.7}/><text x={PL-5} y={y+4} textAnchor="end" fontSize={8} fill={S.muted2}>{fmtA(v)}</text></g>;})}
        {months.map((ym,mi)=>{
          const x=PL+(mi/months.length)*CW+(CW/months.length-bw)/2;
          const yr=Math.floor(ym/100),mo=ym%100;
          let stackY=PT+CH;
          const catData=cats.map(c=>({cat:c,v:grid[ym][c]||0})).filter(c=>c.v!==0);
          return<g key={ym}
            onMouseEnter={e=>{const sv=e.target.closest("svg");const rc=sv.getBoundingClientRect();const sx=rc.width/W;const sy=rc.height/H;setTooltip({x:(x+bw/2)*sx,y:stackY*sy,year:yr,month:mo,cats:catData});}}
            onClick={e=>{const sv=e.target.closest("svg");const rc=sv.getBoundingClientRect();const sx=rc.width/W;const sy=rc.height/H;setTooltip({x:(x+bw/2)*sx,y:stackY*sy,year:yr,month:mo,cats:catData});}}
          >
            {cats.map(c=>{
              const v=grid[ym][c]||0;if(!v)return null;
              const bh=Math.max(0,(v/maxV)*CH);stackY-=bh;
              return<rect key={c} x={x} y={stackY} width={bw} height={bh} fill={CAT_COLORS[c]||S.accent} rx={1} opacity={0.88} style={{cursor:"pointer"}}/>;
            })}
            <text x={x+bw/2} y={H-PB+13} textAnchor="middle" fontSize={6.5} fill={S.muted2}>{MONTHS[mo-1].slice(0,3)}{String(yr).slice(2)}</text>
          </g>;
        })}
        {cats.map((c,i)=><g key={c} transform={`translate(${PL+i*90},${H-6})`}><rect width={8} height={8} fill={CAT_COLORS[c]||S.accent} rx={2}/><text x={12} y={8} fontSize={8} fill={S.muted}>{c}</text></g>)}
      </svg>
    </div>
  );
}

function PurchaseTab({token}){
  const[subTab,setSubTab]=useState("summary");
  const[f,setF]=useState({departureFrom:"",departureTo:"",status:[],label:[],dataset:"",year:[],travelType:[]});
  const[sumData,setSumData]=useState([]);
  const[sumKpis,setSumKpis]=useState(null);
  const[sumLoading,setSumLoading]=useState(false);
  const[sumErr,setSumErr]=useState(null);
  const[sumPage,setSumPage]=useState(1);
  const[sumTotal,setSumTotal]=useState(0);
  const[sumSearch,setSumSearch]=useState("");
  const PAGE_SIZE=200;
  const[elData,setElData]=useState([]);
  const[elKpis,setElKpis]=useState(null);
  const[elCats,setElCats]=useState([]);
  const[elTrend,setElTrend]=useState([]);
  const[elLoading,setElLoading]=useState(false);
  const[elErr,setElErr]=useState(null);
  const[elPage,setElPage]=useState(1);
  const[elTotal,setElTotal]=useState(0);
  const[elSearch,setElSearch]=useState("");

  const togArr=(arr,v)=>arr.includes(v)?arr.filter(x=>x!==v):[...arr,v];

  function buildSumParams(p,pg=1){
    const out={page:pg,limit:PAGE_SIZE};
    if(p.departureFrom)out.departureFrom=p.departureFrom;
    if(p.departureTo)out.departureTo=p.departureTo;
    if(p.status?.length)out.status=p.status;
    if(p.label?.length)out.label=p.label;
    if(p.travelType?.length)out.travelType=p.travelType;
    return out;
  }

  function buildElParams(p,pg=1){
    const out={page:pg,limit:PAGE_SIZE};
    if(p.departureFrom)out.departureFrom=p.departureFrom;
    if(p.departureTo)out.departureTo=p.departureTo;
    if(p.status?.length)out.status=p.status;
    if(p.label?.length)out.labelCode=p.label;
    if(p.dataset)out.dataset=p.dataset;
    if(p.year?.length)out.year=p.year;
    return out;
  }

  function loadSummary(params,pg=1){
    setSumLoading(true);setSumErr(null);
    const ap=params!==undefined?{...params,page:pg,limit:PAGE_SIZE}:buildSumParams(f,pg);
    api("/api/dashboard/margin-overview",ap,token)
      .then(d=>{setSumKpis(d?.kpis||null);setSumData(Array.isArray(d?.data)?d.data:[]);setSumTotal(Number(d?.totalRows||0));setSumPage(pg);})
      .catch(e=>{setSumErr(e.message);setSumData([]);setSumKpis(null);})
      .finally(()=>setSumLoading(false));
  }

  function loadElements(params,pg=1){
    setElLoading(true);setElErr(null);
    const ap=params!==undefined?{...params,page:pg,limit:PAGE_SIZE}:buildElParams(f,pg);
    api("/api/dashboard/element-margin-overview",ap,token)
      .then(d=>{setElKpis(d?.kpis||null);setElCats(Array.isArray(d?.byCategory)?d.byCategory:[]);setElTrend(Array.isArray(d?.trend)?d.trend:[]);setElData(Array.isArray(d?.data)?d.data:[]);setElTotal(Number(d?.totalRows||0));setElPage(pg);})
      .catch(e=>{setElErr(e.message);setElData([]);setElKpis(null);})
      .finally(()=>setElLoading(false));
  }

  function applyFilters(){
    if(subTab==="summary")loadSummary(buildSumParams(f,1),1);
    else loadElements(buildElParams(f,1),1);
  }

  useEffect(()=>{
    loadSummary(buildSumParams({},1),1);
    loadElements(buildElParams({},1),1);
  },[token]);

  function reset(){
    const e={departureFrom:"",departureTo:"",status:[],label:[],dataset:"",year:[],travelType:[]};
    setF(e);setSumData([]);setSumKpis(null);setSumPage(1);setSumTotal(0);setSumSearch("");
    setElData([]);setElKpis(null);setElCats([]);setElTrend([]);setElPage(1);setElTotal(0);setElSearch("");
  }

  function exportSumCsv(){
    const cols=["BookingID","StatusCode","Label","TravelType","BookingDate","DepartureDate","ReturnDate","PAX","SalesBooking","PurchaseCalculation","PurchaseObligation","Margin","Commission","MarginIncludingCommission"];
    const filt=sumData.filter(r=>!sumSearch||String(r.BookingID||"").includes(sumSearch)||(r.Label||"").toLowerCase().includes(sumSearch.toLowerCase())||(r.DepartureDate||"").includes(sumSearch));
    const rows=filt.map(r=>cols.map(c=>{const v=r[c];if(v==null)return"";if(typeof v==="number")return v;return`"${String(v).replace(/"/g,'""')}"`;}).join(","));
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\uFEFF"+[cols.join(","),...rows].join("\n")],{type:"text/csv;charset=utf-8"}));a.download=`booking-summary-${new Date().toISOString().split("T")[0]}.csv`;a.click();
  }

  function exportElCsv(){
    const cols=["BookingId","MarginCategory","Dataset","Status","LabelName","BookingDate","DepartureDate","ReturnDate","PAXCount","ElementCount","BasePriceTotal","SoldAmount","PaidAmount","DepositAmount","CommissionAmount","Margin","MarginIncludingCommission"];
    const filt=elData.filter(r=>!elSearch||String(r.BookingId||"").includes(elSearch)||(r.MarginCategory||"").toLowerCase().includes(elSearch.toLowerCase())||(r.LabelName||"").toLowerCase().includes(elSearch.toLowerCase()));
    const rows=filt.map(r=>cols.map(c=>{const v=r[c];if(v==null)return"";if(typeof v==="number")return v;return`"${String(v).replace(/"/g,'""')}"`;}).join(","));
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\uFEFF"+[cols.join(","),...rows].join("\n")],{type:"text/csv;charset=utf-8"}));a.download=`element-margin-${new Date().toISOString().split("T")[0]}.csv`;a.click();
  }

  const selStyle={background:S.bg,border:`1.5px solid ${S.border2}`,borderRadius:7,padding:"6px 10px",color:S.text,fontSize:12,outline:"none",fontFamily:"inherit"};
  const activeCount=f.status.length+f.label.length+f.travelType.length+f.year.length+(f.departureFrom?1:0)+(f.departureTo?1:0);

  const FilterBar=(
    <div style={{background:S.card,borderBottom:`1px solid ${S.border}`,flexShrink:0,boxShadow:S.shadow}}>
      <div style={{padding:"10px 16px",display:"flex",alignItems:"flex-end",gap:12,flexWrap:"wrap"}}>
        {[["Dep From","departureFrom"],["Dep To","departureTo"]].map(([l,k])=>(
          <div key={k}>
            <label style={{fontSize:10,color:S.muted,display:"block",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>{l}</label>
            <input type="date" value={f[k]} onChange={e=>setF({...f,[k]:e.target.value})} style={{background:S.bg,border:`1.5px solid ${S.border2}`,borderRadius:7,padding:"5px 9px",color:S.text,fontSize:12,outline:"none"}}/>
          </div>
        ))}
        <div style={{width:1,height:32,background:S.border2}}/>
        <div>
          <label style={{fontSize:10,color:S.muted,display:"block",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>✅ Status</label>
          <div style={{display:"flex",gap:4}}>
            {[{v:"ok",l:"DEF"},{v:"cancelled",l:"DEF-GEANNULEERD"}].map(({v,l})=>{
              const active=f.status.includes(v);
              return<button key={v} type="button" onClick={()=>setF({...f,status:togArr(f.status,v)})} style={{padding:"4px 10px",borderRadius:12,fontSize:11,cursor:"pointer",border:`1.5px solid ${active?S.success:S.border2}`,background:active?`${S.success}18`:"transparent",color:active?S.success:S.textLight,fontWeight:active?700:400}}>{l}</button>;
            })}
          </div>
        </div>
        <div style={{width:1,height:32,background:S.border2}}/>
        <div>
          <label style={{fontSize:10,color:S.muted,display:"block",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>🏷 Label</label>
          <div style={{display:"flex",gap:4}}>
            {[{v:"STANDAARD",l:"STANDAARD"},{v:"ITB",l:"ITB"},{v:"DEU",l:"DEU"}].map(({v,l})=>{
              const active=f.label.includes(v);
              return<button key={v} type="button" onClick={()=>setF({...f,label:togArr(f.label,v)})} style={{padding:"4px 10px",borderRadius:12,fontSize:11,cursor:"pointer",border:`1.5px solid ${active?S.purple:S.border2}`,background:active?`${S.purple}18`:"transparent",color:active?S.purple:S.textLight,fontWeight:active?700:400}}>{l}</button>;
            })}
          </div>
        </div>
        <div style={{width:1,height:32,background:S.border2}}/>
        {subTab==="summary"&&(
          <div>
            <label style={{fontSize:10,color:S.muted,display:"block",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>🚗 Travel Type</label>
            <div style={{display:"flex",gap:4}}>
              {["BUS","OWN TRANSPORT","FLIGHT","ENKEL"].map(v=>{
                const active=f.travelType.includes(v);
                return<button key={v} type="button" onClick={()=>setF({...f,travelType:togArr(f.travelType,v)})} style={{padding:"4px 10px",borderRadius:12,fontSize:11,cursor:"pointer",border:`1.5px solid ${active?S.orange:S.border2}`,background:active?`${S.orange}18`:"transparent",color:active?S.orange:S.textLight,fontWeight:active?700:400}}>{v}</button>;
              })}
            </div>
          </div>
        )}
        {subTab==="elements"&&(
          <div>
            <label style={{fontSize:10,color:S.muted,display:"block",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>📅 Year</label>
            <div style={{display:"flex",gap:4}}>
              {[2022,2023,2024,2025,2026].map(y=>{
                const active=f.year.includes(y);
                return<button key={y} type="button" onClick={()=>setF({...f,year:togArr(f.year,y)})} style={{padding:"4px 10px",borderRadius:12,fontSize:11,cursor:"pointer",border:`1.5px solid ${active?S.accent:S.border2}`,background:active?S.accentLight:"transparent",color:active?S.accent:S.textLight,fontWeight:active?700:400}}>{y}</button>;
              })}
            </div>
          </div>
        )}
        <div style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"flex-end"}}>
          <Btn onClick={reset} variant="secondary" size="sm">↺ Reset</Btn>
          <Btn onClick={applyFilters} variant="primary" size="sm">▶ Apply</Btn>
        </div>
      </div>
      {activeCount>0&&(
        <div style={{padding:"4px 16px 8px",display:"flex",gap:5,flexWrap:"wrap"}}>
          {f.status.map(v=><span key={v} style={{background:S.successBg,color:S.success,borderRadius:10,padding:"2px 8px",fontSize:10,fontWeight:600}}>✓ {v==="ok"?"DEF":"DEF-GEANNULEERD"}</span>)}
          {f.label.map(v=><span key={v} style={{background:`${S.purple}15`,color:S.purple,borderRadius:10,padding:"2px 8px",fontSize:10,fontWeight:600}}>🏷 {v}</span>)}
          {f.travelType.map(v=><span key={v} style={{background:`${S.orange}15`,color:S.orange,borderRadius:10,padding:"2px 8px",fontSize:10,fontWeight:600}}>🚗 {v}</span>)}
          {f.year.map(v=><span key={v} style={{background:S.accentLight,color:S.accent,borderRadius:10,padding:"2px 8px",fontSize:10,fontWeight:600}}>📅 {v}</span>)}
          {(f.departureFrom||f.departureTo)&&<span style={{background:S.warnBg,color:S.warn,borderRadius:10,padding:"2px 8px",fontSize:10,fontWeight:600}}>📆 {f.departureFrom||"…"} → {f.departureTo||"…"}</span>}
        </div>
      )}
    </div>
  );

  const sumConfirmed=sumKpis?.confirmedCount??sumData.filter(r=>r.StatusCode==="DEF").length;
  const sumCancelled=sumKpis?.cancelledCount??sumData.filter(r=>r.StatusCode==="DEF-GEANNULEERD").length;
  const sumFiltered=sumData.filter(r=>!sumSearch||String(r.BookingID||"").includes(sumSearch)||(r.Label||"").toLowerCase().includes(sumSearch.toLowerCase())||(r.DepartureDate||"").includes(sumSearch));
  const elFiltered=elData.filter(r=>!elSearch||String(r.BookingId||"").includes(elSearch)||(r.MarginCategory||"").toLowerCase().includes(elSearch.toLowerCase())||(r.LabelName||"").toLowerCase().includes(elSearch.toLowerCase()));

  const SUM_TABLE_COLS=[
    ["Booking ID","left"],["Departure","left"],["Status","left"],["Label","left"],
    ["PAX","right"],["Sales (€)","right"],["Purchase (€)","right"],["Obligation (€)","right"],
    ["Margin (€)","right"],["Margin %","right"],["Commission (€)","right"],["Comm %","right"],["Margin+Comm (€)","right"],
  ];
  const EL_TABLE_COLS=[
    ["Booking ID","left"],["Category","left"],["Dataset","left"],["Status","left"],["LabelCode","left"],
    ["Departure","left"],["Return","left"],["PAX","right"],["Elements","right"],
    ["Base Price (€)","right"],["Sold (€)","right"],["Paid (€)","right"],["Deposit (€)","right"],
    ["Commission (€)","right"],["Margin (€)","right"],["Margin%","right"],["Margin+Comm (€)","right"],
  ];
  const TH={padding:"9px 12px",textAlign:"right",fontSize:11,fontWeight:700,color:"#ffffff",textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap",background:"#1e40af",borderRight:"1px solid #3b82f6"};
  const THL={...TH,textAlign:"left"};
  const TD={padding:"8px 12px",textAlign:"right",fontSize:12,color:S.text,whiteSpace:"nowrap",borderBottom:"1px solid #dbeafe",borderRight:"1px solid #e8f0fe"};
  const TDL={...TD,textAlign:"left"};

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden",background:S.bg}}>
      <div style={{background:S.card,borderBottom:`1px solid ${S.border}`,padding:"10px 20px",display:"flex",gap:6,flexShrink:0,boxShadow:S.shadow}}>
        {[
          ["summary","Booking Summary","solmar.MarginOverview"],
          ["elements","Element Breakdown","dbo.BookingElementMarginOverview"],
        ].map(([id,label,source])=>(
          <button key={id} onClick={()=>setSubTab(id)} style={{padding:"7px 16px",borderRadius:8,fontSize:12,cursor:"pointer",border:`1.5px solid ${subTab===id?S.accent:S.border2}`,background:subTab===id?S.accentLight:"transparent",color:subTab===id?S.accent:S.textLight,fontWeight:subTab===id?700:500,transition:"all 0.15s",display:"flex",flexDirection:"column",alignItems:"flex-start",gap:1}}>
            <span style={{display:"flex",alignItems:"center",gap:5}}>{id==="summary"?<FileText size={12}/>:<Layers size={12}/>}{label}</span>
            <span style={{fontSize:9,color:subTab===id?S.accent:S.muted2,fontFamily:"monospace",fontWeight:400}}>{source}</span>
          </button>
        ))}
      </div>
      {FilterBar}
      {subTab==="summary"&&(
        <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
          {sumErr&&<div style={{background:S.dangerBg,border:`1px solid ${S.danger}33`,borderRadius:10,padding:"10px 14px",fontSize:12,color:S.danger}}>⚠ {sumErr}</div>}
          {!sumKpis&&!sumLoading&&sumData.length===0&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 20px",color:S.muted}}>
              <div style={{fontSize:48,marginBottom:16}}>📋</div>
              <div style={{fontSize:16,fontWeight:600,color:S.textLight,marginBottom:8}}>Booking Summary</div>
              <div style={{fontSize:13,color:S.muted,textAlign:"center",maxWidth:360}}>Select filters and click <strong>Apply Filters</strong> to load booking data from <code>solmar.MarginOverview</code>.</div>
            </div>
          )}
          {sumLoading&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"60px 20px"}}><span style={{color:S.muted,fontSize:13}}>Loading data…</span></div>}
          {sumKpis&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12}}>
              {[
                {l:"Total Bookings",v:fmtN(sumKpis.totalBookings),c:S.accent,icon:<FileText size={15}/>},
                {l:"Confirmed",v:fmtN(sumConfirmed),c:S.success,icon:<CheckCircle size={15}/>},
                {l:"Cancelled",v:fmtN(sumCancelled),c:S.danger,icon:<XCircle size={15}/>},
                {l:"Total PAX",v:fmtN(sumKpis.totalPax),c:S.purple,icon:<Users size={15}/>},
                {l:"Total Sales",v:fmtM(sumKpis.totalSales),c:S.success,icon:<BarChart2 size={15}/>},
                {l:"Net Margin",v:fmtM(sumKpis.totalMargin),c:parseFloat(sumKpis.totalMargin||0)>=0?S.success:S.danger,icon:<TrendingUp size={15}/>},
                {l:"Commission",v:fmtM(sumKpis.totalCommission),c:S.warn,icon:<CreditCard size={15}/>},
                {l:"Commission %",v:parseFloat(sumKpis.totalSales||0)>0?`${((parseFloat(sumKpis.totalCommission||0)/parseFloat(sumKpis.totalSales))*100).toFixed(2)}%`:"—",c:S.warn,icon:<Percent size={15}/>},
                {l:"Obligations",v:fmtM(sumKpis.totalObligation),c:S.orange,icon:<AlertCircle size={15}/>},
                {l:"Margin+Comm",v:fmtM(sumKpis.totalMarginIncludingCommission),c:parseFloat(sumKpis.totalMarginIncludingCommission||0)>=0?S.success:S.danger,icon:<PieChart size={15}/>},
              ].map(k=>(
                <div key={k.l} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:12,padding:"14px 16px",boxShadow:S.shadow,display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:38,height:38,borderRadius:10,background:`${k.c}12`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>{k.icon}</div>
                  <div><div style={{fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>{k.l}</div><div style={{fontSize:18,fontWeight:800,color:k.c}}>{k.v}</div></div>
                </div>
              ))}
            </div>
          )}
          {sumData.length>0&&(
            <Card p="0">
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${S.border}`,display:"flex",gap:10,alignItems:"center"}}>
                <div style={{fontSize:13,fontWeight:700,color:S.text,flex:1}}>Booking Summary <span style={{fontSize:11,color:S.muted,fontWeight:400}}>({fmtN(sumFiltered.length)} of {fmtN(sumTotal)} rows)</span></div>
                <input value={sumSearch} onChange={e=>setSumSearch(e.target.value)} placeholder="Search booking / label…" style={{...selStyle,width:200,fontSize:11}}/>
                <Btn onClick={exportSumCsv} variant="secondary" size="sm">↓ CSV</Btn>
              </div>
              {sumTotal>PAGE_SIZE&&(
                <div style={{padding:"8px 16px",borderBottom:`1px solid ${S.border}`,display:"flex",alignItems:"center",gap:8,fontSize:12,background:"#f8faff"}}>
                  <span style={{color:S.muted}}>Page {sumPage} of {Math.ceil(sumTotal/PAGE_SIZE)} · {fmtN(sumTotal)} rows</span>
                  <div style={{marginLeft:"auto",display:"flex",gap:5}}>
                    <Btn disabled={sumPage<=1} onClick={()=>loadSummary(buildSumParams(f,sumPage-1),sumPage-1)} variant="secondary" size="sm">← Prev</Btn>
                    <Btn disabled={sumPage>=Math.ceil(sumTotal/PAGE_SIZE)} onClick={()=>loadSummary(buildSumParams(f,sumPage+1),sumPage+1)} variant="secondary" size="sm">Next →</Btn>
                  </div>
                </div>
              )}
              <div style={{maxHeight:460,overflowY:"auto",overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:1400}}>
                  <thead style={{position:"sticky",top:0,zIndex:5,background:"#f8faff"}}>
                    <tr>{SUM_TABLE_COLS.map(([h,a],i)=><th key={i} style={{...TH,textAlign:a}}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {sumFiltered.map((r,i)=>{
                      const confirmed=r.StatusCode==="DEF";
                      const margin=parseFloat(r.Margin||0);
                      const margComm=parseFloat(r.MarginIncludingCommission||0);
                      const mPct=parseFloat(r.SalesBooking||0)>0?((margin/parseFloat(r.SalesBooking))*100):null;
                      return(
                        <tr key={i} style={{borderBottom:"1px solid #dbeafe",background:i%2===0?"#ffffff":"#f0f7ff"}}>
                          <td style={{...TDL,color:S.accent,fontWeight:600,fontFamily:"monospace",fontSize:11}}>{r.BookingID||"—"}</td>
                          <td style={{...TDL,fontWeight:500}}>{r.DepartureDate||"—"}</td>
                          <td style={TDL}><span style={{background:confirmed?S.successBg:S.dangerBg,color:confirmed?S.success:S.danger,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:700}}>{confirmed?"DEF":"DEF-GEANNULEERD"}</span></td>
                          <td style={{...TDL,color:S.textLight,fontSize:11}}>{r.Label||"—"}</td>
                          <td style={TD}>{fmtN(r.PAX)}</td>
                          <td style={TD}>{fmtEur(r.SalesBooking)}</td>
                          <td style={TD}>{fmtEur(r.PurchaseCalculation)}</td>
                          <td style={{...TD,color:S.warn,fontWeight:600}}>{fmtEur(r.PurchaseObligation)}</td>
                          <td style={{...TD,fontWeight:700,color:margin>=0?S.success:S.danger}}>{fmtEur(r.Margin)}</td>
                          <td style={{...TD,fontWeight:700,color:mPct!=null?(mPct>=0?S.success:S.danger):S.muted}}>{mPct!=null?`${mPct.toFixed(1)}%`:"—"}</td>
                          <td style={{...TD,color:S.muted}}>{fmtEur(r.Commission)}</td>
                          <td style={{...TD,color:S.muted}}>{parseFloat(r.SalesBooking||0)>0?`${((parseFloat(r.Commission||0)/parseFloat(r.SalesBooking))*100).toFixed(1)}%`:"—"}</td>
                          <td style={{...TD,fontWeight:700,color:margComm>=0?S.success:S.danger}}>{fmtEur(r.MarginIncludingCommission)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
      {subTab==="elements"&&(
        <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
          {elErr&&<div style={{background:S.dangerBg,border:`1px solid ${S.danger}33`,borderRadius:10,padding:"10px 14px",fontSize:12,color:S.danger}}>⚠ {elErr}</div>}
          {!elKpis&&!elLoading&&elData.length===0&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 20px",color:S.muted}}>
              <div style={{fontSize:48,marginBottom:16}}>🔍</div>
              <div style={{fontSize:16,fontWeight:600,color:S.textLight,marginBottom:8}}>Element Breakdown</div>
              <div style={{fontSize:13,color:S.muted,textAlign:"center",maxWidth:400}}>
                Breaks down each booking by element category: <strong style={{color:CAT_COLORS["Coach"]}}>Coach</strong>, <strong style={{color:CAT_COLORS["Hotel"]}}>Hotel</strong>, <strong style={{color:CAT_COLORS["Other"]}}>Other</strong>, <strong style={{color:CAT_COLORS["Service Line"]}}>Service Line</strong>.<br/><br/>
                Apply filters and click <strong>Apply Filters</strong>.
              </div>
            </div>
          )}
          {elLoading&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"60px 20px"}}><span style={{color:S.muted,fontSize:13}}>Loading element data…</span></div>}
          {elKpis&&(
            <>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
                {(()=>{
                  const commPct=parseFloat(elKpis.totalSales||0)>0?((parseFloat(elKpis.totalCommission||0)/parseFloat(elKpis.totalSales))*100):null;
                  return[
                    {l:"Total Bookings",v:fmtN(elKpis.totalBookings),c:S.accent,icon:<FileText size={15}/>},
                    {l:"Total PAX",v:fmtN(elKpis.totalPax),c:S.purple,icon:<Users size={15}/>},
                    {l:"Total Sales",v:fmtM(elKpis.totalSales),c:S.success,icon:<BarChart2 size={15}/>},
                    {l:"Net Margin",v:fmtM(elKpis.totalMargin),c:parseFloat(elKpis.totalMargin||0)>=0?S.success:S.danger,icon:<TrendingUp size={15}/>},
                    {l:"Commission",v:fmtM(elKpis.totalCommission),c:S.warn,icon:<CreditCard size={15}/>},
                    {l:"Commission %",v:commPct!=null?`${commPct.toFixed(2)}%`:"—",c:S.warn,icon:<Percent size={15}/>},
                    {l:"Margin+Comm",v:fmtM(elKpis.totalMarginIncludingCommission),c:parseFloat(elKpis.totalMarginIncludingCommission||0)>=0?S.success:S.danger,icon:<PieChart size={15}/>},
                  ];
                })().map(k=>(
                  <div key={k.l} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:12,padding:"14px 16px",boxShadow:S.shadow,display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:38,height:38,borderRadius:10,background:`${k.c}12`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>{k.icon}</div>
                    <div><div style={{fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>{k.l}</div><div style={{fontSize:18,fontWeight:800,color:k.c}}>{k.v}</div></div>
                  </div>
                ))}
              </div>
              {elCats.length>0&&(
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
                  {elCats.map(cat=>{
                    const cc=CAT_COLORS[cat.MarginCategory]||S.accent;
                    const ci=CAT_ICONS[cat.MarginCategory]||"📦";
                    const margin=parseFloat(cat.margin||0);
                    const mPct=parseFloat(cat.sales||0)>0?((margin/parseFloat(cat.sales))*100):null;
                    return(
                      <Card key={cat.MarginCategory} style={{borderTop:`3px solid ${cc}`,borderRadius:12}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                          <div style={{fontSize:13,fontWeight:800,color:cc}}>{ci} {cat.MarginCategory}</div>
                          <span style={{background:`${cc}15`,color:cc,padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:700}}>{fmtN(cat.bookings)} bookings</span>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:11}}>
                          {[["PAX",fmtN(cat.pax)],["Elements",fmtN(cat.elements)],["Sales",fmtM(cat.sales)],["Base Price",fmtM(cat.basePrice)],["Paid",fmtM(cat.paid)],["Commission",fmtM(cat.commission)]].map(([l,v])=>(
                            <div key={l}>
                              <div style={{color:S.muted,fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.04em"}}>{l}</div>
                              <div style={{color:S.text,fontWeight:600}}>{v}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${S.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div style={{fontSize:11,color:S.muted}}>Margin</div>
                          <div>
                            <span style={{fontSize:16,fontWeight:800,color:margin>=0?S.success:S.danger}}>{fmtM(cat.margin)}</span>
                            {mPct!=null&&<span style={{fontSize:10,color:mPct>=0?S.success:S.danger,fontWeight:700,marginLeft:6}}>{mPct.toFixed(1)}%</span>}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
              {elTrend.length>0&&(
                <Card p="0">
                  <div style={{padding:"12px 16px",borderBottom:`1px solid ${S.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:S.text}}>Margin by Category — Monthly Pivot</div>
                      <div style={{fontSize:11,color:S.muted,marginTop:1}}>Rows = months · Columns = categories</div>
                    </div>
                  </div>
                  <div style={{overflowX:"auto",maxHeight:400,overflowY:"auto"}}>
                    {(()=>{
                      const months=[...new Set(elTrend.map(r=>r.year*100+r.month))].sort();
                      const cats=[...new Set(elTrend.map(r=>r.category))].sort();
                      const grid={};
                      months.forEach(ym=>{grid[ym]={};cats.forEach(c=>{grid[ym][c]={margin:0,sales:0,bookings:0};});});
                      elTrend.forEach(r=>{const ym=r.year*100+r.month;if(grid[ym]&&grid[ym][r.category]){grid[ym][r.category]={margin:parseFloat(r.margin)||0,sales:parseFloat(r.sales)||0,bookings:Number(r.bookings)||0};}});
                      const totals={};cats.forEach(c=>{totals[c]={margin:0,sales:0};});
                      months.forEach(ym=>cats.forEach(c=>{totals[c].margin+=grid[ym][c].margin;totals[c].sales+=grid[ym][c].sales;}));
                      const grandTotal={margin:cats.reduce((s,c)=>s+totals[c].margin,0),sales:cats.reduce((s,c)=>s+totals[c].sales,0)};
                      const THP={padding:"8px 12px",textAlign:"right",fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.04em",whiteSpace:"nowrap",borderBottom:`1px solid ${S.border}`,background:"#f8faff",borderRight:`1px solid ${S.border}`};
                      const TDP={padding:"7px 12px",textAlign:"right",fontSize:11,whiteSpace:"nowrap",borderBottom:`1px solid ${S.border}`,borderRight:`1px solid ${S.border}`};
                      return(
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                          <thead style={{position:"sticky",top:0,zIndex:5}}>
                            <tr>
                              <th style={{...THP,textAlign:"left",minWidth:80}}>Period</th>
                              {cats.map(c=>(
                                <th key={c} colSpan={2} style={{...THP,textAlign:"center",color:CAT_COLORS[c]||S.accent,borderRight:`2px solid ${S.border2}`}}>{CAT_ICONS[c]||""} {c}</th>
                              ))}
                              <th colSpan={2} style={{...THP,textAlign:"center",color:S.text,borderRight:"none"}}>TOTAL</th>
                            </tr>
                            <tr>
                              <th style={{...THP,textAlign:"left",background:"#f0f4ff"}}>Month</th>
                              {cats.map(c=>[
                                <th key={c+"s"} style={{...THP,fontSize:9,background:"#f0f4ff"}}>Sales</th>,
                                <th key={c+"m"} style={{...THP,fontSize:9,background:"#f0f4ff",borderRight:`2px solid ${S.border2}`}}>Margin</th>
                              ])}
                              <th style={{...THP,fontSize:9,background:"#f0f4ff"}}>Sales</th>
                              <th style={{...THP,fontSize:9,background:"#f0f4ff",borderRight:"none"}}>Margin</th>
                            </tr>
                          </thead>
                          <tbody>
                            {months.map((ym,mi)=>{
                              const yr=Math.floor(ym/100),mo=ym%100;
                              const rowSales=cats.reduce((s,c)=>s+(grid[ym][c].sales||0),0);
                              const rowMargin=cats.reduce((s,c)=>s+(grid[ym][c].margin||0),0);
                              return(
                                <tr key={ym} style={{background:mi%2===0?"transparent":"#f8faff"}}>
                                  <td style={{...TDP,textAlign:"left",fontWeight:600,color:S.text}}>{MONTHS[mo-1]} {yr}</td>
                                  {cats.map(c=>{
                                    const m=grid[ym][c].margin||0;
                                    const s=grid[ym][c].sales||0;
                                    return[
                                      <td key={c+"s"} style={{...TDP,color:S.textLight}}>{s?fmtM(s):"—"}</td>,
                                      <td key={c+"m"} style={{...TDP,fontWeight:600,color:m>=0?S.success:S.danger,borderRight:`2px solid ${S.border2}`}}>{s||m?fmtM(m):"—"}</td>
                                    ];
                                  })}
                                  <td style={{...TDP,fontWeight:700,color:S.text}}>{fmtM(rowSales)}</td>
                                  <td style={{...TDP,fontWeight:700,color:rowMargin>=0?S.success:S.danger,borderRight:"none"}}>{fmtM(rowMargin)}</td>
                                </tr>
                              );
                            })}
                            <tr style={{background:"#f0f4ff",borderTop:`2px solid ${S.border2}`}}>
                              <td style={{...TDP,textAlign:"left",fontWeight:800,color:S.text}}>TOTAL</td>
                              {cats.map(c=>[
                                <td key={c+"s"} style={{...TDP,fontWeight:700,color:S.text}}>{fmtM(totals[c].sales)}</td>,
                                <td key={c+"m"} style={{...TDP,fontWeight:800,color:totals[c].margin>=0?S.success:S.danger,borderRight:`2px solid ${S.border2}`}}>{fmtM(totals[c].margin)}</td>
                              ])}
                              <td style={{...TDP,fontWeight:800,color:S.text}}>{fmtM(grandTotal.sales)}</td>
                              <td style={{...TDP,fontWeight:800,color:grandTotal.margin>=0?S.success:S.danger,borderRight:"none"}}>{fmtM(grandTotal.margin)}</td>
                            </tr>
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                </Card>
              )}
              {elData.length>0&&(
                <Card p="0">
                  <div style={{padding:"12px 16px",borderBottom:`1px solid ${S.border}`,display:"flex",gap:10,alignItems:"center"}}>
                    <div style={{fontSize:13,fontWeight:700,color:S.text,flex:1}}>Element Detail <span style={{fontSize:11,color:S.muted,fontWeight:400}}>({fmtN(elFiltered.length)} of {fmtN(elTotal)} rows)</span></div>
                    <input value={elSearch} onChange={e=>setElSearch(e.target.value)} placeholder="Search booking / category…" style={{...selStyle,width:210,fontSize:11}}/>
                    <Btn onClick={exportElCsv} variant="secondary" size="sm">↓ CSV</Btn>
                  </div>
                  {elTotal>PAGE_SIZE&&(
                    <div style={{padding:"8px 16px",borderBottom:`1px solid ${S.border}`,display:"flex",alignItems:"center",gap:8,fontSize:12,background:"#f8faff"}}>
                      <span style={{color:S.muted}}>Page {elPage} of {Math.ceil(elTotal/PAGE_SIZE)} · {fmtN(elTotal)} rows</span>
                      <div style={{marginLeft:"auto",display:"flex",gap:5}}>
                        <Btn disabled={elPage<=1} onClick={()=>loadElements(buildElParams(f,elPage-1),elPage-1)} variant="secondary" size="sm">← Prev</Btn>
                        <Btn disabled={elPage>=Math.ceil(elTotal/PAGE_SIZE)} onClick={()=>loadElements(buildElParams(f,elPage+1),elPage+1)} variant="secondary" size="sm">Next →</Btn>
                      </div>
                    </div>
                  )}
                  <div style={{maxHeight:460,overflowY:"auto",overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:1600}}>
                      <thead style={{position:"sticky",top:0,zIndex:5,background:"#f8faff"}}>
                        <tr>{EL_TABLE_COLS.map(([h,a],i)=><th key={i} style={{...TH,textAlign:a}}>{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {elFiltered.map((r,i)=>{
                          const cc=CAT_COLORS[r.MarginCategory]||S.accent;
                          const margin=parseFloat(r.Margin||0);
                          const margComm=parseFloat(r.MarginIncludingCommission||0);
                          const mPct=parseFloat(r.SoldAmount||0)>0?((margin/parseFloat(r.SoldAmount))*100):null;
                          const confirmed=r.Status==="DEF";
                          return(
                            <tr key={i} style={{borderBottom:"1px solid #dbeafe",background:i%2===0?"#ffffff":"#f0f7ff"}}>
                              <td style={{...TDL,color:S.accent,fontWeight:600,fontFamily:"monospace",fontSize:11}}>{r.BookingId||"—"}</td>
                              <td style={TDL}><span style={{background:`${cc}15`,color:cc,padding:"2px 8px",borderRadius:5,fontSize:11,fontWeight:700,display:"inline-flex",alignItems:"center",gap:3}}>{CAT_ICONS[r.MarginCategory]||"📦"} {r.MarginCategory||"—"}</span></td>
                              <td style={{...TDL,color:S.textLight,fontSize:11}}>{r.Dataset||"—"}</td>
                              <td style={TDL}><span style={{background:confirmed?S.successBg:S.dangerBg,color:confirmed?S.success:S.danger,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:700}}>{confirmed?"DEF":"DEF-GEANNULEERD"}</span></td>
                              <td style={{...TDL,color:S.textLight,fontSize:11}}>{r.LabelCode||"—"}</td>
                              <td style={{...TDL,fontWeight:500}}>{r.DepartureDate||"—"}</td>
                              <td style={{...TDL,color:S.muted}}>{r.ReturnDate||"—"}</td>
                              <td style={TD}>{fmtN(r.PAXCount)}</td>
                              <td style={{...TD,color:S.muted}}>{fmtN(r.ElementCount)}</td>
                              <td style={TD}>{fmtEur(r.BasePriceTotal)}</td>
                              <td style={TD}>{fmtEur(r.SoldAmount)}</td>
                              <td style={TD}>{fmtEur(r.PaidAmount)}</td>
                              <td style={{...TD,color:S.muted}}>{fmtEur(r.DepositAmount)}</td>
                              <td style={{...TD,color:S.muted}}>{fmtEur(r.CommissionAmount)}</td>
                              <td style={{...TD,fontWeight:700,color:margin>=0?S.success:S.danger}}>{fmtEur(r.Margin)}</td>
                              <td style={{...TD,fontWeight:700,color:mPct!=null?(mPct>=0?S.success:S.danger):S.muted}}>{mPct!=null?`${mPct.toFixed(1)}%`:"—"}</td>
                              <td style={{...TD,fontWeight:700,color:margComm>=0?S.success:S.danger}}>{fmtEur(r.MarginIncludingCommission)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── REPLACE the entire HotelTab function in App.jsx ────────────────────────
// Also replace the ORDER BY block in dashboard.js /hotel-overview route (see above)

function HotelTab({token}){
  const[subTab,setSubTab]=useState("overview");

  // ── Overview state ──
  const[sl,setSl]=useState({destinations:[],transports:[],labels:[],datasets:[]});
  const[f,setF]=useState({depFrom:"",depTo:"",bkFrom:"",bkTo:"",region:"",destination:"",transport:"",label:[],status:[]});
  const[data,setData]=useState([]);
  const[kpis,setKpis]=useState(null);
  const[loading,setLoading]=useState(false);
  const[err,setErr]=useState(null);
  const[page,setPage]=useState(1);
  const[total,setTotal]=useState(0);
  const[sort,setSort]=useState({col:"pax",dir:"desc"});
  const[search,setSearch]=useState("");
  const PAGE_SIZE=50;

  // ── Reviews state ──
  const[ratings,setRatings]=useState([]);
  const[filteredRatings,setFilteredRatings]=useState([]);
  const[reviews,setReviews]=useState([]);
  const[revTotal,setRevTotal]=useState(0);
  const[revPage,setRevPage]=useState(1);
  const[revSearch,setRevSearch]=useState("");
  const[ratingSearch,setRatingSearch]=useState("");
  const[selectedHotel,setSelectedHotel]=useState(null); // {code, name}
  const[hotelStats,setHotelStats]=useState(null);
  const[revLoading,setRevLoading]=useState(false);

  useEffect(()=>{
    api("/api/dashboard/hotel-slicers",{},token).then(d=>{if(d&&!d.error)setSl(d);}).catch(()=>{});
  },[token]);

  useEffect(()=>{
    if(subTab==="reviews"){
      api("/api/dashboard/hotel-stats",{},token).then(d=>{if(d&&!d.error)setHotelStats(d);}).catch(()=>{});
      api("/api/dashboard/hotel-ratings",{},token).then(d=>{if(Array.isArray(d)){setRatings(d);setFilteredRatings(d);}}).catch(()=>{});
      loadReviews(1,selectedHotel?.code,"");
    }
  },[subTab,token]);

  // Filter ratings by search
  useEffect(()=>{
    if(!ratingSearch.trim()){setFilteredRatings(ratings);return;}
    const q=ratingSearch.toLowerCase();
    setFilteredRatings(ratings.filter(r=>(r.accommodation_name||"").toLowerCase().includes(q)));
  },[ratingSearch,ratings]);

  function buildParams(pg=1){
    const out={page:pg,limit:PAGE_SIZE,sort:sort.col,dir:sort.dir};
    if(f.depFrom)out.depFrom=f.depFrom;
    if(f.depTo)out.depTo=f.depTo;
    if(f.bkFrom)out.bkFrom=f.bkFrom;
    if(f.bkTo)out.bkTo=f.bkTo;
    if(f.region)out.region=f.region;
    if(f.destination)out.destination=f.destination;
    if(f.transport)out.transport=f.transport;
    if(f.label?.length)out.label=f.label;
    if(f.status?.length)out.status=f.status;
    return out;
  }

  function loadOverview(pg=1){
    setLoading(true);setErr(null);
    api("/api/dashboard/hotel-overview",buildParams(pg),token)
      .then(d=>{setKpis(d?.kpis||null);setData(Array.isArray(d?.data)?d.data:[]);setTotal(Number(d?.totalRows||0));setPage(pg);})
      .catch(e=>setErr(e.message))
      .finally(()=>setLoading(false));
  }

  function loadReviews(pg=1,code,searchTerm){
    setRevLoading(true);
    const p={page:pg,limit:20};
    if(code)p.code=code;
    if(searchTerm)p.search=searchTerm;
    api("/api/dashboard/hotel-reviews",p,token)
      .then(d=>{setReviews(Array.isArray(d?.rows)?d.rows:[]);setRevTotal(Number(d?.total||0));setRevPage(pg);})
      .catch(()=>{})
      .finally(()=>setRevLoading(false));
  }

  function reset(){
    const e={depFrom:"",depTo:"",bkFrom:"",bkTo:"",region:"",destination:"",transport:"",label:[],status:[]};
    setF(e);setData([]);setKpis(null);setPage(1);setTotal(0);setSearch("");
  }

  function handleSort(col){
    const dir=sort.col===col&&sort.dir==="desc"?"asc":"desc";
    setSort({col,dir});
  }
  useEffect(()=>{if(data.length>0)loadOverview(1);},[sort]);

  const togArr=(arr,v)=>arr.includes(v)?arr.filter(x=>x!==v):[...arr,v];
  const filtered=data.filter(r=>!search||r.hotel?.toLowerCase().includes(search.toLowerCase())||r.region?.toLowerCase().includes(search.toLowerCase()));

  const pctColor=v=>v==null?"#94a3b8":v>=0?"#059669":"#dc2626";
  const pctFmt=v=>v==null?"—":`${v>=0?"▲":"▼"} ${Math.abs(v).toFixed(1)}%`;

  // Score → color gradient
  const scoreColor=v=>{
    const n=parseFloat(v||0);
    if(n>=90)return{bg:"#ecfdf5",c:"#059669",bar:"#059669"};
    if(n>=70)return{bg:"#fffbeb",c:"#d97706",bar:"#f59e0b"};
    return{bg:"#fef2f2",c:"#dc2626",bar:"#ef4444"};
  };

  // Mini score bar
  const ScoreBar=({value,max=100})=>{
    const pct=Math.min(100,Math.max(0,(parseFloat(value||0)/max)*100));
    const sc=scoreColor(pct);
    return(
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <div style={{flex:1,height:5,background:"#e2e8f0",borderRadius:10,overflow:"hidden"}}>
          <div style={{width:`${pct}%`,height:"100%",background:sc.bar,borderRadius:10,transition:"width 0.3s"}}/>
        </div>
        <span style={{fontSize:11,fontWeight:700,color:sc.c,minWidth:32,textAlign:"right"}}>{parseFloat(value||0).toFixed(1)}</span>
      </div>
    );
  };

  const SortTH=({col,children,right=true})=>{
    const active=sort.col===col;
    return(
      <th onClick={()=>handleSort(col)} style={{padding:"10px 14px",textAlign:right?"right":"left",fontSize:11,fontWeight:700,color:"#ffffff",textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap",background:"#1e40af",borderRight:"1px solid #3b82f6",cursor:"pointer",userSelect:"none"}}>
        <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
          {children}
          <span style={{opacity:active?1:0.3,fontSize:10}}>{active?(sort.dir==="desc"?"↓":"↑"):"↕"}</span>
        </span>
      </th>
    );
  };

  const TH={padding:"10px 14px",textAlign:"right",fontSize:11,fontWeight:700,color:"#ffffff",textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap",background:"#1e40af",borderRight:"1px solid #3b82f6"};
  const THL={...TH,textAlign:"left"};
  const TD={padding:"9px 14px",textAlign:"right",fontSize:12,color:S.text,whiteSpace:"nowrap",borderBottom:"1px solid #dbeafe",borderRight:"1px solid #e8f0fe"};
  const TDL={...TD,textAlign:"left"};

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden",background:S.bg}}>

      {/* ── Sub-tab bar ── */}
      <div style={{background:S.card,borderBottom:`1px solid ${S.border}`,padding:"10px 20px",display:"flex",gap:8,flexShrink:0,boxShadow:S.shadow}}>
        {[
          ["overview","Hotel Overview","📊 Overview"],
          ["reviews","Hotel Reviews","⭐ Reviews"],
        ].map(([id,,label])=>(
          <button key={id} onClick={()=>setSubTab(id)} style={{
            padding:"8px 20px",borderRadius:9,fontSize:12,cursor:"pointer",
            border:`1.5px solid ${subTab===id?S.accent:S.border2}`,
            background:subTab===id?S.accent:"transparent",
            color:subTab===id?"#fff":S.textLight,
            fontWeight:600,transition:"all 0.15s",
          }}>{label}</button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════
          HOTEL OVERVIEW TAB
      ══════════════════════════════════════════════ */}
      {subTab==="overview"&&(
        <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>

          {/* Filter bar */}
          <div style={{background:S.card,borderBottom:`1px solid ${S.border}`,padding:"10px 20px",display:"flex",alignItems:"flex-end",gap:10,flexWrap:"wrap",flexShrink:0,boxShadow:S.shadow}}>
            {[["Dep From","depFrom"],["Dep To","depTo"],["Book From","bkFrom"],["Book To","bkTo"]].map(([l,k])=>(
              <div key={k}>
                <label style={{fontSize:10,color:S.muted,display:"block",marginBottom:3,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>{l}</label>
                <input type="date" value={f[k]} onChange={e=>setF({...f,[k]:e.target.value})} style={{background:S.bg,border:`1.5px solid ${S.border2}`,borderRadius:7,padding:"5px 9px",color:S.text,fontSize:12,outline:"none"}}/>
              </div>
            ))}
            <div style={{width:1,height:32,background:S.border2}}/>
            {[["Destination","destination",sl.destinations],["Transport","transport",sl.transports]].map(([l,k,opts])=>(
              <div key={k}>
                <label style={{fontSize:10,color:S.muted,display:"block",marginBottom:3,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>{l}</label>
                <select value={f[k]} onChange={e=>setF({...f,[k]:e.target.value})} style={{background:S.bg,border:`1.5px solid ${S.border2}`,borderRadius:7,padding:"5px 9px",color:S.text,fontSize:12,outline:"none",maxWidth:140}}>
                  <option value="">All</option>
                  {opts.map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <div style={{width:1,height:32,background:S.border2}}/>
            <div>
              <label style={{fontSize:10,color:S.muted,display:"block",marginBottom:3,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>Status</label>
              <div style={{display:"flex",gap:4}}>
                {[{v:"ok",l:"Confirmed"},{v:"cancelled",l:"Cancelled"}].map(({v,l})=>{
                  const active=f.status.includes(v);
                  return<button key={v} type="button" onClick={()=>setF({...f,status:togArr(f.status,v)})} style={{padding:"5px 12px",borderRadius:7,fontSize:11,cursor:"pointer",border:`1.5px solid ${active?(v==="ok"?S.success:S.danger):S.border2}`,background:active?(v==="ok"?`${S.success}18`:`${S.danger}18`):"transparent",color:active?(v==="ok"?S.success:S.danger):S.textLight,fontWeight:active?700:400}}>{l}</button>;
                })}
              </div>
            </div>
            <div style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"flex-end"}}>
              <Btn onClick={reset} variant="secondary" size="sm">↺ Reset</Btn>
              <Btn onClick={()=>loadOverview(1)} variant="primary" size="sm">▶ Apply</Btn>
            </div>
          </div>

          <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
            {err&&<div style={{background:S.dangerBg,border:`1px solid ${S.danger}33`,borderRadius:10,padding:"10px 14px",fontSize:12,color:S.danger}}>⚠ {err}</div>}

            {/* KPI Cards */}
            {kpis&&(
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
                {[
                  {l:"Hotels",v:fmtN(kpis.totalHotels),c:S.accent,sub:"destinations tracked",icon:(
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
                  )},
                  {l:"Bookings",v:fmtN(kpis.totalBookings),c:S.purple,sub:"total reservations",icon:(
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>
                  )},
                  {l:"Total PAX",v:fmtN(kpis.totalPax),c:S.success,sub:"guests travelling",icon:(
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                  )},
                  {l:"Total Margin",v:fmtM(kpis.totalMargin),c:S.success,sub:"hotel margin",icon:(
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                  )},
                ].map(k=>(
                  <div key={k.l} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:14,padding:"18px 20px",boxShadow:S.shadow,display:"flex",flexDirection:"column",gap:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div style={{width:44,height:44,borderRadius:12,background:`${k.c}12`,display:"flex",alignItems:"center",justifyContent:"center",color:k.c}}>{k.icon}</div>
                      <span style={{fontSize:10,color:S.muted2,background:S.bg,padding:"3px 8px",borderRadius:6,border:`1px solid ${S.border}`,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.04em"}}>{k.sub}</span>
                    </div>
                    <div>
                      <div style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>{k.l}</div>
                      <div style={{fontSize:28,fontWeight:800,color:k.c,letterSpacing:"-0.03em",lineHeight:1}}>{k.v}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!kpis&&!loading&&(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"80px 20px",color:S.muted}}>
                <div style={{width:80,height:80,borderRadius:20,background:`${S.accent}10`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:20,border:`2px dashed ${S.border2}`}}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={S.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
                </div>
                <div style={{fontSize:16,fontWeight:700,color:S.textLight,marginBottom:6}}>Hotel Overview</div>
                <div style={{fontSize:13,color:S.muted,textAlign:"center",maxWidth:360}}>Set filters above and click <strong>Apply</strong> to load hotel performance data.</div>
              </div>
            )}

            {loading&&(
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"60px 20px",gap:10}}>
                <div style={{width:20,height:20,border:`3px solid ${S.border2}`,borderTop:`3px solid ${S.accent}`,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
                <span style={{color:S.muted,fontSize:13}}>Loading hotel data…</span>
              </div>
            )}

            {/* Main Table */}
            {data.length>0&&(
              <Card p="0">
                <div style={{padding:"14px 18px",borderBottom:`1px solid ${S.border}`,display:"flex",gap:10,alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:S.text}}>Hotel Performance</div>
                    <div style={{fontSize:11,color:S.muted,marginTop:1}}>{fmtN(total)} hotels · sorted by {sort.col} {sort.dir}</div>
                  </div>
                  <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
                    <div style={{position:"relative"}}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={S.muted} strokeWidth="2" style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search hotel / region…" style={{background:S.bg,border:`1.5px solid ${S.border2}`,borderRadius:8,padding:"6px 10px 6px 30px",color:S.text,fontSize:12,outline:"none",width:210}}/>
                    </div>
                    <button onClick={()=>{
                      const cols=["Hotel","Region","First Dep","Last Dep","Bookings","Bk Last Yr","Bk Diff%","PAX","PAX Last Yr","PAX Diff%","Revenue","Rev Last Yr","Rev Diff%","Margin","Margin+Comm"];
                      const rows=filtered.map(r=>[`"${r.hotel||""}"`,r.region||"",r.firstDep||"",r.lastDep||"",r.bookingsCur,r.bookingsPrev,r.bookingsDiffPct??"",r.paxCur,r.paxPrev,r.paxDiffPct??"",r.revenueCur,r.revenuePrev,r.revenueDiffPct??"",r.margin,r.marginComm].join(","));
                      const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\uFEFF"+[cols.join(","),...rows].join("\n")],{type:"text/csv;charset=utf-8"}));a.download=`hotel-overview-${new Date().toISOString().split("T")[0]}.csv`;a.click();
                    }} style={{padding:"6px 12px",background:"transparent",border:`1.5px solid ${S.border2}`,borderRadius:8,color:S.muted,fontSize:12,cursor:"pointer",fontWeight:600,display:"flex",alignItems:"center",gap:5}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      CSV
                    </button>
                  </div>
                </div>
                {total>PAGE_SIZE&&(
                  <div style={{padding:"8px 18px",borderBottom:`1px solid ${S.border}`,display:"flex",alignItems:"center",gap:8,fontSize:12,background:"#f8faff"}}>
                    <span style={{color:S.muted}}>Page {page} of {Math.ceil(total/PAGE_SIZE)}</span>
                    <div style={{marginLeft:"auto",display:"flex",gap:5}}>
                      <Btn disabled={page<=1} onClick={()=>loadOverview(page-1)} variant="secondary" size="sm">← Prev</Btn>
                      <Btn disabled={page>=Math.ceil(total/PAGE_SIZE)} onClick={()=>loadOverview(page+1)} variant="secondary" size="sm">Next →</Btn>
                    </div>
                  </div>
                )}
                <div style={{overflowX:"auto",maxHeight:520,overflowY:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:1100}}>
                    <thead style={{position:"sticky",top:0,zIndex:5}}>
                      <tr>
                        <SortTH col="hotel" right={false}>Hotel Name</SortTH>
                        <th style={THL}>Resort</th>
                        <th style={THL}>Dataset</th>
                        <th style={THL}>First Dep</th>
                        <th style={THL}>Last Dep</th>
                        <SortTH col="bookings">Bookings</SortTH>
                        <th style={TH}>Last Year</th>
                        <th style={TH}>Diff %</th>
                        <SortTH col="pax">PAX</SortTH>
                        <th style={TH}>Last Year</th>
                        <th style={TH}>Diff %</th>
                        <SortTH col="revenue">Revenue</SortTH>
                        <th style={TH}>Last Year</th>
                        <th style={TH}>Diff %</th>
                        <SortTH col="margin">Margin</SortTH>
                        <th style={TH}>Margin+Comm</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length===0&&<tr><td colSpan={13} style={{padding:32,textAlign:"center",color:S.muted}}>No data</td></tr>}
                      {filtered.map((r,i)=>(
                        <tr key={i} style={{borderBottom:"1px solid #dbeafe",background:i%2===0?"#ffffff":"#f7f9ff",transition:"background 0.1s"}}
                          onMouseEnter={e=>e.currentTarget.style.background="#eef4ff"}
                          onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"#ffffff":"#f7f9ff"}>
                          <td style={{...TDL,fontWeight:600,color:S.accent,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis"}}>{r.hotel||"—"}</td>
                          <td style={{...TDL,color:S.textLight,fontSize:11,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis"}}>{r.resort||"—"}</td>
                          <td style={{...TDL,color:S.muted,fontSize:11}}>{r.dataset||"—"}</td>
                          <td style={{...TDL,color:S.muted,fontSize:11}}>{r.firstDep||"—"}</td>
                          <td style={{...TDL,color:S.muted,fontSize:11}}>{r.lastDep||"—"}</td>
                          <td style={{...TD,fontWeight:700}}>{fmtN(r.bookingsCur)}</td>
                          <td style={{...TD,color:S.muted}}>{fmtN(r.bookingsPrev)}</td>
                          <td style={{...TD,fontWeight:700}}>
                            {r.bookingsDiffPct!=null&&<span style={{background:r.bookingsDiffPct>=0?S.successBg:S.dangerBg,color:pctColor(r.bookingsDiffPct),padding:"2px 6px",borderRadius:4,fontSize:11}}>{pctFmt(r.bookingsDiffPct)}</span>}
                            {r.bookingsDiffPct==null&&<span style={{color:S.muted2}}>—</span>}
                          </td>
                          <td style={{...TD,fontWeight:700}}>{fmtN(r.paxCur)}</td>
                          <td style={{...TD,color:S.muted}}>{fmtN(r.paxPrev)}</td>
                          <td style={{...TD,fontWeight:700}}>
                            {r.paxDiffPct!=null&&<span style={{background:r.paxDiffPct>=0?S.successBg:S.dangerBg,color:pctColor(r.paxDiffPct),padding:"2px 6px",borderRadius:4,fontSize:11}}>{pctFmt(r.paxDiffPct)}</span>}
                            {r.paxDiffPct==null&&<span style={{color:S.muted2}}>—</span>}
                          </td>
                          <td style={{...TD,fontWeight:600,color:S.success}}>{fmtM(r.revenueCur)}</td>
                          <td style={{...TD,color:S.muted}}>{fmtM(r.revenuePrev)}</td>
                          <td style={{...TD,fontWeight:700}}>
                            {r.revenueDiffPct!=null&&<span style={{background:r.revenueDiffPct>=0?S.successBg:S.dangerBg,color:pctColor(r.revenueDiffPct),padding:"2px 6px",borderRadius:4,fontSize:11}}>{pctFmt(r.revenueDiffPct)}</span>}
                            {r.revenueDiffPct==null&&<span style={{color:S.muted2}}>—</span>}
                          </td>
                          <td style={{...TD,fontWeight:700,color:parseFloat(r.margin||0)>=0?S.success:S.danger}}>{fmtM(r.margin)}</td>
                          <td style={{...TD,fontWeight:700,color:parseFloat(r.marginComm||0)>=0?S.success:S.danger}}>{fmtM(r.marginComm)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          HOTEL REVIEWS TAB
      ══════════════════════════════════════════════ */}
      {subTab==="reviews"&&(
        <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:16}}>

          {/* Stats KPI Row */}
          {hotelStats&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
              {[
                {l:"Hotels Tracked",v:fmtN(hotelStats.total_hotels),c:S.accent,icon:(
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
                )},
                {l:"Total Reviews",v:fmtN(hotelStats.total_reviews),c:S.purple,icon:(
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                )},
                {l:"Avg Rating",v:parseFloat(hotelStats.avg_rating||0).toFixed(1),c:S.warn,icon:(
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
                ),sub:"/10"},
                {l:"High Rated ≥ 8",v:fmtN(hotelStats.high_rated),c:S.success,icon:(
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
                )},
              ].map(k=>(
                <div key={k.l} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:14,padding:"18px 20px",boxShadow:S.shadow}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                    <div style={{width:44,height:44,borderRadius:12,background:`${k.c}12`,display:"flex",alignItems:"center",justifyContent:"center",color:k.c}}>{k.icon}</div>
                  </div>
                  <div style={{fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>{k.l}</div>
                  <div style={{fontSize:28,fontWeight:800,color:k.c,letterSpacing:"-0.03em",lineHeight:1}}>{k.v}{k.sub&&<span style={{fontSize:14,fontWeight:500,color:S.muted}}>{k.sub}</span>}</div>
                </div>
              ))}
            </div>
          )}

          {/* Stacked layout: Ratings table on top, Reviews below */}
          <div style={{display:"flex",flexDirection:"column",gap:14}}>

            {/* ── LEFT: Ratings Table ── */}
            <Card p="0">
              <div style={{padding:"14px 16px",borderBottom:`1px solid ${S.border}`,display:"flex",gap:10,alignItems:"center"}}>
                <div style={{fontSize:13,fontWeight:700,color:S.text,flex:1}}>Hotel Ratings <span style={{fontSize:11,color:S.muted,fontWeight:400}}>({filteredRatings.length} hotels)</span></div>
                <div style={{position:"relative"}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={S.muted} strokeWidth="2" style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input value={ratingSearch} onChange={e=>setRatingSearch(e.target.value)} placeholder="Search hotel…" style={{background:S.bg,border:`1.5px solid ${S.border2}`,borderRadius:7,padding:"5px 10px 5px 28px",color:S.text,fontSize:11,outline:"none",width:180}}/>
                </div>
                {selectedHotel&&(
                  <button onClick={()=>{setSelectedHotel(null);loadReviews(1,null,"");}} style={{padding:"4px 10px",background:S.dangerBg,border:`1px solid ${S.danger}33`,borderRadius:6,color:S.danger,fontSize:11,cursor:"pointer",fontWeight:600,whiteSpace:"nowrap"}}>✕ Clear</button>
                )}
              </div>
              <div style={{overflowX:"auto",maxHeight:580,overflowY:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead style={{position:"sticky",top:0,zIndex:5}}>
                    <tr>
                      {[
                        ["Hotel Name","left"],
                        ["Overall","right"],
                        ["Sleep","right"],
                        ["Location","right"],
                        ["Cleanliness","right"],
                        ["Service","right"],
                        ["Facilities","right"],
                        ["Reviews","right"],
                        ["Recommend","right"],
                      ].map(([h,a],i)=>(
                        <th key={i} style={{
                          padding:"9px 12px",
                          textAlign:a,
                          fontSize:10,
                          fontWeight:700,
                          color:"#ffffff",
                          textTransform:"uppercase",
                          letterSpacing:"0.05em",
                          whiteSpace:"nowrap",
                          background:"#1e40af",
                          borderRight:"1px solid #3b82f6",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRatings.length===0&&(
                      <tr><td colSpan={9} style={{padding:24,textAlign:"center",color:S.muted}}>No hotels found</td></tr>
                    )}
                    {filteredRatings.map((r,i)=>{
                      const score=parseFloat(r.avg_overall||0);
                      const sc=scoreColor(score);
                      const isSelected=selectedHotel?.code===r.accommodation_code;
                      const TD2={
                        padding:"8px 12px",
                        textAlign:"right",
                        fontSize:12,
                        borderBottom:"1px solid #dbeafe",
                        borderRight:"1px solid #e8f0fe",
                        whiteSpace:"nowrap",
                      };
                      return(
                        <tr key={i}
                          onClick={()=>{
                            if(isSelected){setSelectedHotel(null);loadReviews(1,null,"");}
                            else{setSelectedHotel({code:r.accommodation_code,name:r.accommodation_name});loadReviews(1,r.accommodation_code,"");}
                          }}
                          style={{
                            borderBottom:"1px solid #dbeafe",
                            background:isSelected?"#eff6ff":i%2===0?"#ffffff":"#f7f9ff",
                            cursor:"pointer",
                            transition:"background 0.1s",
                          }}
                          onMouseEnter={e=>e.currentTarget.style.background="#eef4ff"}
                          onMouseLeave={e=>e.currentTarget.style.background=isSelected?"#eff6ff":i%2===0?"#ffffff":"#f7f9ff"}
                        >
                          {/* Hotel Name */}
                          <td style={{
                            padding:"8px 12px",
                            textAlign:"left",
                            fontSize:12,
                            fontWeight:600,
                            color:isSelected?S.accent:S.text,
                            borderBottom:"1px solid #dbeafe",
                            borderRight:"1px solid #e8f0fe",
                            maxWidth:200,
                            overflow:"hidden",
                            textOverflow:"ellipsis",
                            whiteSpace:"nowrap",
                          }}>{r.accommodation_name||"—"}</td>

                          {/* Overall */}
                          <td style={{...TD2}}>
                            <span style={{
                              background:sc.bg,
                              color:sc.c,
                              padding:"2px 8px",
                              borderRadius:5,
                              fontSize:12,
                              fontWeight:800,
                              display:"inline-block",
                            }}>{score.toFixed(1)}</span>
                          </td>

                          {/* Category scores */}
                          {["avg_sleep","avg_location","avg_cleanliness","avg_service","avg_facilities"].map(k=>{
                            const v=parseFloat(r[k]||0);
                            const cc=scoreColor(v);
                            return(
                              <td key={k} style={{...TD2,color:cc.c,fontWeight:600}}>{v.toFixed(1)}</td>
                            );
                          })}

                          {/* Reviews count */}
                          <td style={{...TD2,color:S.muted}}>{fmtN(r.total_reviews)}</td>

                          {/* Recommend % */}
                          <td style={{...TD2}}>
                            {r.recommendation_pct
                              ? <span style={{color:S.success,fontWeight:700}}>👍 {parseFloat(r.recommendation_pct).toFixed(0)}%</span>
                              : <span style={{color:S.muted2}}>—</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* ── RIGHT: Reviews Feed ── */}
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {/* Search bar for reviews */}
              <Card p="14px 16px">
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <div style={{position:"relative",flex:1}}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={S.muted} strokeWidth="2" style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input value={revSearch} onChange={e=>setRevSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&loadReviews(1,selectedHotel?.code,revSearch)} placeholder="Search reviews by keyword…" style={{background:S.bg,border:`1.5px solid ${S.border2}`,borderRadius:8,padding:"8px 12px 8px 34px",color:S.text,fontSize:12,outline:"none",width:"100%",boxSizing:"border-box"}}/>
                  </div>
                  <Btn onClick={()=>loadReviews(1,selectedHotel?.code,revSearch)} variant="primary" size="sm" style={{gap:5}}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    Search
                  </Btn>
                  {(revSearch||selectedHotel)&&<Btn onClick={()=>{setRevSearch("");setSelectedHotel(null);loadReviews(1,null,"");}} variant="secondary" size="sm">Clear</Btn>}
                  <span style={{fontSize:12,color:S.muted,whiteSpace:"nowrap",fontWeight:500}}>{fmtN(revTotal)} reviews</span>
                </div>
                {/* Pagination */}
                {revTotal>20&&(
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:10,paddingTop:10,borderTop:`1px solid ${S.border}`}}>
                    <span style={{fontSize:11,color:S.muted}}>Page {revPage} of {Math.ceil(revTotal/20)}</span>
                    <div style={{display:"flex",gap:5}}>
                      <Btn disabled={revPage<=1} onClick={()=>loadReviews(revPage-1,selectedHotel?.code,revSearch)} variant="secondary" size="sm">← Prev</Btn>
                      <Btn disabled={revPage>=Math.ceil(revTotal/20)} onClick={()=>loadReviews(revPage+1,selectedHotel?.code,revSearch)} variant="secondary" size="sm">Next →</Btn>
                    </div>
                  </div>
                )}
              </Card>

              {/* Review cards */}
              {revLoading&&(
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"40px 20px",gap:10}}>
                  <div style={{width:18,height:18,border:`3px solid ${S.border2}`,borderTop:`3px solid ${S.accent}`,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
                  <span style={{color:S.muted,fontSize:12}}>Loading reviews…</span>
                </div>
              )}

              {!revLoading&&reviews.length===0&&(
                <div style={{textAlign:"center",padding:"48px 20px",color:S.muted}}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={S.border2} strokeWidth="1.5" style={{display:"block",margin:"0 auto 12px"}}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                  <div style={{fontSize:13,fontWeight:500}}>No reviews found</div>
                </div>
              )}

              {!revLoading&&reviews.map((r,i)=>{
                const score=parseFloat(r.overall_rating||0);
                const sc=scoreColor(score);
                const catScores=[["Sleep",r.category_sleep],["Location",r.category_location],["Cleanliness",r.category_cleanliness],["Service",r.category_service],["Facilities",r.category_facilities]].filter(([,v])=>v!=null&&v!=="");
                return(
                  <div key={i} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:14,padding:"18px 20px",boxShadow:S.shadow,transition:"box-shadow 0.15s"}}
                    onMouseEnter={e=>e.currentTarget.style.boxShadow=S.shadowMd}
                    onMouseLeave={e=>e.currentTarget.style.boxShadow=S.shadow}>

                    {/* Review header */}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:S.text,marginBottom:3}}>{r.accommodation_name||"—"}</div>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                          {/* Reviewer avatar + name */}
                          <div style={{display:"flex",alignItems:"center",gap:5}}>
                            <div style={{width:24,height:24,borderRadius:"50%",background:`${S.accent}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:S.accent,flexShrink:0}}>
                              {(r.reviewer_name||"A")[0].toUpperCase()}
                            </div>
                            <span style={{fontSize:11,fontWeight:600,color:S.textLight}}>{r.reviewer_name||"Anonymous"}</span>
                          </div>
                          {(r.reviewer_city||r.reviewer_country)&&(
                            <div style={{display:"flex",alignItems:"center",gap:3,fontSize:11,color:S.muted}}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                              {[r.reviewer_city,r.reviewer_country].filter(Boolean).join(", ")}
                            </div>
                          )}
                          {r.review_date&&(
                            <div style={{display:"flex",alignItems:"center",gap:3,fontSize:11,color:S.muted}}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                              {r.review_date?.split("T")[0]}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Score badge + travel type */}
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5,flexShrink:0,marginLeft:12}}>
                        <div style={{background:sc.bg,border:`2px solid ${sc.c}33`,borderRadius:10,padding:"6px 12px",textAlign:"center"}}>
                          <div style={{fontSize:20,fontWeight:900,color:sc.c,lineHeight:1}}>{score.toFixed(1)}</div>
                          <div style={{fontSize:9,color:sc.c,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.04em",marginTop:1}}>/ 100</div>
                        </div>
                        {r.travel_type&&<span style={{background:`${S.purple}12`,color:S.purple,padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:600}}>{r.travel_type}</span>}
                        {r.language&&r.language!=="nl"&&<span style={{background:`${S.muted2}15`,color:S.muted,padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:600,textTransform:"uppercase"}}>{r.language}</span>}
                      </div>
                    </div>

                    {/* Review content */}
                    {r.review_title&&<div style={{fontSize:13,fontWeight:700,color:S.textLight,marginBottom:6,lineHeight:1.4}}>"{r.review_title}"</div>}
                    {r.review_text&&<div style={{fontSize:12,color:S.muted,lineHeight:1.65,marginBottom:12}}>{r.review_text.length>280?r.review_text.slice(0,280)+"…":r.review_text}</div>}

                    {/* Category score bars */}
                    {catScores.length>0&&(
                      <div style={{borderTop:`1px solid ${S.border}`,paddingTop:12,display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"6px 12px"}}>
                        {catScores.map(([l,v])=>(
                          <div key={l}>
                            <div style={{fontSize:9,color:S.muted2,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:3}}>{l}</div>
                            <ScoreBar value={v}/>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function FlightsTab({token}){
  const[slicers,setSlicers]=useState({departures:[],arrivals:[],statuses:[]});
  const[f,setF]=useState({dateFrom:"",dateTo:"",departure:[],arrival:[],status:[]});
  const[data,setData]=useState([]);
  const[loading,setLoading]=useState(false);
  const[err,setErr]=useState(null);

  useEffect(()=>{
    api("/api/dashboard/flight-slicers",{},token).then(d=>{if(d&&!d.error)setSlicers(d);}).catch(()=>{});
    loadData({});
  },[token]);

  function buildParams(filters){
    const p={};
    if(filters.dateFrom)p.dateFrom=filters.dateFrom;
    if(filters.dateTo)p.dateTo=filters.dateTo;
    if(filters.departure?.length)p.departure=filters.departure;
    if(filters.arrival?.length)p.arrival=filters.arrival;
    if(filters.status?.length)p.status=filters.status;
    return p;
  }

  function loadData(filters){
    setLoading(true);setErr(null);
    api("/api/dashboard/flights",buildParams(filters),token)
      .then(d=>setData(Array.isArray(d)?d:[]))
      .catch(e=>setErr(e.message))
      .finally(()=>setLoading(false));
  }

  function apply(){loadData(f);}
  function reset(){const e={dateFrom:"",dateTo:"",departure:[],arrival:[],status:[]};setF(e);loadData(e);}
  const tog=(arr,v)=>arr.includes(v)?arr.filter(x=>x!==v):[...arr,v];

  // Aggregate total PAX per flight date for the bar chart
  const chartData=(()=>{
    const byDate={};
    data.forEach(r=>{
      const d=r.FlightDate?.split("T")[0]||r.FlightDate||"";
      if(!d)return;
      byDate[d]=(byDate[d]||0)+Number(r.TotalPAX||0);
    });
    return Object.entries(byDate).sort(([a],[b])=>a.localeCompare(b)).map(([date,pax])=>({date,pax}));
  })();

  const totalPAX=data.reduce((s,r)=>s+Number(r.TotalPAX||0),0);

  // Grouped bar chart: PAX by month, grouped by year
  function FlightBarChart({data}){
    const[tooltip,setTooltip]=useState(null);
    if(!data?.length)return<div style={{color:S.muted,textAlign:"center",padding:32,fontSize:12}}>No chart data</div>;

    // Build month×year grid from raw flight rows
    const yrs=[...new Set(data.map(r=>{
      const d=r.FlightDate?.split('T')[0]||r.FlightDate||'';
      return d?new Date(d).getFullYear():null;
    }).filter(Boolean))].sort((a,b)=>a-b);

    const grid={};
    for(let m=1;m<=12;m++){grid[m]={};yrs.forEach(y=>{grid[m][y]=0;});}
    data.forEach(r=>{
      const d=r.FlightDate?.split('T')[0]||r.FlightDate||'';
      if(!d)return;
      const dt=new Date(d);
      const mo=dt.getMonth()+1;
      const yr=dt.getFullYear();
      if(grid[mo]&&grid[mo][yr]!==undefined)grid[mo][yr]+=Number(r.TotalPAX||0);
    });

    const allVals=Object.values(grid).flatMap(mv=>Object.values(mv));
    const maxV=Math.max(...allVals,1);
    const W=520,H=200,PL=52,PR=10,PT=12,PB=44,CW=W-PL-PR,CH=H-PT-PB;
    const groupW=CW/12;
    const gap=1.5;
    const bw=Math.max(3,Math.floor((groupW-gap*(yrs.length+1))/Math.max(yrs.length,1)));
    const groupPad=(groupW-(bw*yrs.length+gap*(yrs.length-1)))/2;

    return(
      <div style={{position:"relative"}}>
        {tooltip&&(
          <div style={{position:"absolute",left:tooltip.x,top:tooltip.y,background:S.text,borderRadius:8,padding:"8px 12px",fontSize:11,color:"#fff",pointerEvents:"none",zIndex:10,whiteSpace:"nowrap",transform:"translate(-50%,-110%)",boxShadow:S.shadowLg}}>
            <div style={{fontWeight:700,color:YC[tooltip.year]||S.accent,marginBottom:2}}>{tooltip.year} — {MONTHS[tooltip.month-1]}</div>
            <div>PAX: <strong>{fmtN(tooltip.value)}</strong></div>
          </div>
        )}
        <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginBottom:6,flexWrap:"wrap"}}>
          {yrs.map(yr=>(
            <div key={yr} style={{display:"flex",alignItems:"center",gap:4}}>
              <div style={{width:10,height:10,borderRadius:2,background:YC[yr]||S.accent}}/>
              <span style={{fontSize:11,color:S.muted,fontWeight:600}}>{yr}</span>
            </div>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}} onMouseLeave={()=>setTooltip(null)}>
          {[0,1,2,3,4].map(i=>{const y=PT+(CH/4)*i,v=maxV*(1-i/4);return<g key={i}><line x1={PL} x2={W-PR} y1={y} y2={y} stroke={S.border} strokeWidth={0.7}/><text x={PL-4} y={y+4} textAnchor="end" fontSize={8} fill={S.muted2}>{Math.round(v)}</text></g>;})}
          {Array.from({length:12},(_,mi)=>{
            const mo=mi+1;
            const gx=PL+mi*groupW;
            return<g key={mo}>
              {yrs.map((yr,yi)=>{
                const v=grid[mo][yr]||0;
                const bh=(v/maxV)*CH;
                const x=gx+groupPad+yi*(bw+gap);
                const y=PT+CH-bh;
                const color=YC[yr]||S.accent;
                return<rect key={yr} x={x} y={y} width={bw} height={Math.max(bh,0)} fill={color} rx={1.5} opacity={0.88} style={{cursor:"pointer"}}
                  onMouseEnter={e=>{const sv=e.currentTarget.closest("svg");const rc=sv.getBoundingClientRect();setTooltip({x:(x+bw/2)*(rc.width/W),y:y*(rc.height/H),year:yr,month:mo,value:v});}}
                  onClick={e=>{const sv=e.currentTarget.closest("svg");const rc=sv.getBoundingClientRect();setTooltip({x:(x+bw/2)*(rc.width/W),y:y*(rc.height/H),year:yr,month:mo,value:v});}}
                />;
              })}
              <text x={gx+groupW/2} y={H-PB+13} textAnchor="middle" fontSize={7.5} fill={S.muted2}>{MONTHS[mi]}</text>
            </g>;
          })}
        </svg>
      </div>
    );
  }

  const chipBtn=(active,onClick,label,clr=S.accent)=>(
    <button onClick={onClick} style={{padding:"3px 9px",borderRadius:20,fontSize:11,fontWeight:600,cursor:"pointer",border:`1.5px solid ${active?clr:S.border2}`,background:active?`${clr}18`:"transparent",color:active?clr:S.textLight,transition:"all 0.15s"}}>
      {label}
    </button>
  );

  const TH={padding:"9px 12px",textAlign:"right",fontSize:11,fontWeight:700,color:"#ffffff",textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap",background:"#1e40af",borderRight:"1px solid #3b82f6"};
  const THL={...TH,textAlign:"left"};
  const TD={padding:"8px 12px",textAlign:"right",fontSize:12,color:S.text,whiteSpace:"nowrap",borderBottom:"1px solid #dbeafe",borderRight:"1px solid #e8f0fe"};
  const TDL={...TD,textAlign:"left"};

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden",background:S.bg}}>
      {/* Filter bar */}
      <div style={{background:S.card,borderBottom:`1px solid ${S.border}`,flexShrink:0,boxShadow:S.shadow}}>
        <div style={{padding:"10px 16px",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{fontSize:10,fontWeight:700,color:S.muted2,textTransform:"uppercase",letterSpacing:"0.06em"}}>From</span>
          {slicers.departures.map(d=>chipBtn(f.departure.includes(d),()=>setF({...f,departure:tog(f.departure,d)}),d,S.accent))}
          <div style={{width:1,height:18,background:S.border2}}/>
          <span style={{fontSize:10,fontWeight:700,color:S.muted2,textTransform:"uppercase",letterSpacing:"0.06em"}}>To</span>
          {slicers.arrivals.map(a=>chipBtn(f.arrival.includes(a),()=>setF({...f,arrival:tog(f.arrival,a)}),a,S.success))}
          <div style={{width:1,height:18,background:S.border2}}/>
          <span style={{fontSize:10,fontWeight:700,color:S.muted2,textTransform:"uppercase",letterSpacing:"0.06em"}}>Status</span>
          {(slicers.statuses||[]).map(s=>chipBtn(
            f.status.includes(s),
            ()=>setF({...f,status:tog(f.status,s)}),
            s,
            s==='DEF'?S.success:s==='DEF-GEANNULEERD'?S.danger:s==='VERV'?S.muted:S.warn
          ))}
          <div style={{width:1,height:18,background:S.border2}}/>
          <span style={{fontSize:10,fontWeight:700,color:S.muted2,textTransform:"uppercase",letterSpacing:"0.06em"}}>Date</span>
          <input type="date" value={f.dateFrom} onChange={e=>setF({...f,dateFrom:e.target.value})} style={{background:S.bg,border:`1px solid ${S.border2}`,borderRadius:6,padding:"4px 8px",color:S.text,fontSize:11,outline:"none"}}/>
          <span style={{fontSize:10,color:S.muted2}}>–</span>
          <input type="date" value={f.dateTo} onChange={e=>setF({...f,dateTo:e.target.value})} style={{background:S.bg,border:`1px solid ${S.border2}`,borderRadius:6,padding:"4px 8px",color:S.text,fontSize:11,outline:"none"}}/>
          {[
            {l:"2025",from:"2025-01-01",to:"2025-12-31"},
            {l:"2026",from:"2026-01-01",to:"2026-12-31"},
            {l:"All",from:"",to:""},
          ].map(q=>(
            <button key={q.l} onClick={()=>setF({...f,dateFrom:q.from,dateTo:q.to})} style={{padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer",border:`1px solid ${f.dateFrom===q.from&&f.dateTo===q.to?S.warn:S.border2}`,background:f.dateFrom===q.from&&f.dateTo===q.to?S.warnBg:"transparent",color:f.dateFrom===q.from&&f.dateTo===q.to?S.warn:S.textLight,fontWeight:600}}>{q.l}</button>
          ))}
          <div style={{marginLeft:"auto",display:"flex",gap:6}}>
            <Btn onClick={reset} variant="secondary" size="sm">Reset</Btn>
            <Btn onClick={apply} variant="primary" size="sm">Apply Filters</Btn>
          </div>
        </div>
        {(f.departure.length>0||f.arrival.length>0||f.status.length>0)&&(
          <div style={{padding:"4px 16px 8px",display:"flex",gap:5,flexWrap:"wrap"}}>
            {f.departure.map(v=><span key={v} style={{background:S.accentLight,color:S.accent,borderRadius:10,padding:"2px 8px",fontSize:10,fontWeight:600}}>✈ From: {v}</span>)}
            {f.arrival.map(v=><span key={v} style={{background:`${S.success}15`,color:S.success,borderRadius:10,padding:"2px 8px",fontSize:10,fontWeight:600}}>✈ To: {v}</span>)}
            {f.status.map(v=><span key={v} style={{background:`${S.warn}15`,color:S.warn,borderRadius:10,padding:"2px 8px",fontSize:10,fontWeight:600}}>● {v}</span>)}
          </div>
        )}
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
        {err&&<div style={{background:S.dangerBg,border:`1px solid ${S.danger}33`,borderRadius:10,padding:"10px 14px",fontSize:12,color:S.danger}}>⚠ {err}</div>}
        {loading&&<div style={{color:S.muted,textAlign:"center",padding:40,fontSize:13}}>Loading flight data…</div>}

        {/* KPI */}
        {!loading&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
            {[
              {l:"Total PAX",v:fmtN(totalPAX),c:S.accent,icon:<Plane size={16}/>},
              {l:"Total Revenue",v:fmtM(data.reduce((s,r)=>s+Number(r.TotalRevenue||0),0)),c:S.success,icon:<BarChart2 size={16}/>},
              {l:"Routes",v:fmtN([...new Set(data.map(r=>r.ElementCode))].length),c:S.purple,icon:<Map size={16}/>},
            ].map(k=>(
              <div key={k.l} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:12,padding:"16px 18px",boxShadow:S.shadow,display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:38,height:38,borderRadius:10,background:`${k.c}12`,display:"flex",alignItems:"center",justifyContent:"center",color:k.c,flexShrink:0}}>{k.icon}</div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:2}}>{k.l}</div>
                  <div style={{fontSize:22,fontWeight:800,color:k.c}}>{k.v}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Chart */}
        {!loading&&chartData.length>0&&(
          <Card>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:S.text}}>Total PAX per Flight Date</div>
                <div style={{fontSize:11,color:S.muted,marginTop:1}}>All selected routes combined</div>
              </div>
              <span style={{fontSize:11,color:S.muted2,background:S.bg,padding:"3px 8px",borderRadius:6,border:`1px solid ${S.border}`}}>{chartData.length} dates</span>
            </div>
            <FlightBarChart data={data}/>
          </Card>
        )}

        {/* Table */}
        {!loading&&data.length>0&&(
          <Card p="0">
            <div style={{padding:"12px 16px",borderBottom:`1px solid ${S.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:13,fontWeight:700,color:S.text}}>Flight Routes — PAX per Date <span style={{fontSize:11,color:S.muted,fontWeight:400}}>({fmtN(data.length)} rows)</span></div>
              <button onClick={()=>{
                const cols=["Route","Name","From","To","Date","PAX","Revenue"];
                const rows=data.map(r=>[r.ElementCode,`"${(r.RouteName||"").replace(/"/g,'""')}"`,r.Departure,r.Arrival,r.FlightDate?.split("T")[0]||r.FlightDate,r.TotalPAX,r.TotalRevenue??0].join(","));
                const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\uFEFF"+[cols.join(","),...rows].join("\n")],{type:"text/csv;charset=utf-8"}));a.download=`flights-${new Date().toISOString().split("T")[0]}.csv`;a.click();
              }} style={{padding:"5px 10px",background:"transparent",border:`1px solid ${S.border2}`,borderRadius:6,color:S.muted,fontSize:11,cursor:"pointer",fontWeight:600}}>↓ CSV</button>
            </div>
            <div style={{overflowX:"auto",maxHeight:480,overflowY:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead style={{position:"sticky",top:0,zIndex:5}}>
                  <tr>
                    <th style={THL}>Route</th>
                    <th style={THL}>Route Name</th>
                    <th style={TH}>From</th>
                    <th style={TH}>To</th>
                    <th style={TH}>Flight Date</th>
                    <th style={TH}>PAX</th>
                    <th style={TH}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((r,i)=>(
                    <tr key={i} style={{borderBottom:"1px solid #dbeafe",background:i%2===0?"#ffffff":"#f0f7ff"}}>
                      <td style={{...TDL,fontWeight:700,color:S.accent,fontFamily:"monospace"}}>{r.ElementCode}</td>
                      <td style={{...TDL,color:S.textLight,fontSize:11}}>{r.RouteName||"—"}</td>
                      <td style={{...TD,fontWeight:600,color:S.accent}}>{r.Departure}</td>
                      <td style={{...TD,fontWeight:600,color:S.success}}>{r.Arrival}</td>
                      <td style={TD}>{r.FlightDate?.split("T")[0]||r.FlightDate}</td>
                      <td style={{...TD,fontWeight:700,color:S.text}}>{fmtN(r.TotalPAX)}</td>
                      <td style={{...TD,fontWeight:600,color:S.success}}>{fmtM(r.TotalRevenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function SettingsTab({token,session,onLogout}){
  const[tab,setTab]=useState("users");
  const[users,setUsers]=useState([]);
  const[loading,setLoading]=useState(false);
  const[userMsg,setUserMsg]=useState({text:"",type:""});
  const[showAdd,setShowAdd]=useState(false);
  const[newUser,setNewUser]=useState({username:"",password:"",role:"viewer",name:"",email:""});
  const[busy,setBusy]=useState(false);
  const[editUser,setEditUser]=useState(null);
  const[editForm,setEditForm]=useState({name:"",username:"",email:"",role:"viewer",password:""});
  const[editMsg,setEditMsg]=useState(null);
  const[editBusy,setEditBusy]=useState(false);
  const[showEditPw,setShowEditPw]=useState(false);
  const[apiStatus,setApiStatus]=useState({});
  const[settings,setSettings]=useState({aiPrompt:"",emailAlerts:{enabled:false,revenueDropThreshold:10,bookingSpikethreshold:20,recipients:""}});
  const[settingsMsg,setSettingsMsg]=useState("");

  function loadUsers(){
    setLoading(true);
    api("/api/dashboard/users",{},token).then(d=>setUsers(Array.isArray(d)?d:[])).catch(()=>{}).finally(()=>setLoading(false));
  }

  function openEdit(u){
    setEditUser(u);
    setEditForm({name:u.name||"",username:u.username||"",email:u.email||"",role:u.role||"viewer",password:""});
    setEditMsg(null);
    setShowEditPw(false);
  }

  async function saveEdit(){
    setEditBusy(true);setEditMsg(null);
    try{
      const body={name:editForm.name,username:editForm.username,email:editForm.email,role:editForm.role};
      if(editForm.password){
        if(editForm.password.length<6){setEditMsg({err:true,t:"Password min 6 characters"});setEditBusy(false);return;}
        body.password=editForm.password;
      }
      const r=await fetch(`${BASE}/api/dashboard/users/${editUser.id}`,{method:"PUT",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify(body)});
      const d=await r.json();
      if(!r.ok){setEditMsg({err:true,t:d.error||"Failed"});return;}
      setUsers(u=>u.map(x=>x.id===editUser.id?{...x,...d}:x));
      setEditMsg({err:false,t:"✓ User updated successfully"});
      setTimeout(()=>setEditUser(null),1200);
    }catch(e){setEditMsg({err:true,t:e.message});}
    finally{setEditBusy(false);}
  }

  useEffect(()=>{
    loadUsers();
    api("/api/dashboard/settings",{},token).then(d=>{if(d&&!d.error)setSettings(d);}).catch(()=>{});
    const eps=[
      {name:"Dashboard KPIs",path:"/api/dashboard/kpis"},
      {name:"Revenue by Year",path:"/api/dashboard/revenue-by-year"},
      {name:"Bus Slicers",path:"/api/dashboard/bus-slicers"},
      {name:"Margin Overview",path:"/api/dashboard/margin-overview"},
    ];
    eps.forEach(ep=>{
      const start=Date.now();
      fetch(`${BASE}${ep.path}`,{headers:{Authorization:`Bearer ${token}`}})
        .then(r=>setApiStatus(s=>({...s,[ep.name]:{ok:r.ok,ms:Date.now()-start,status:r.status}})))
        .catch(()=>setApiStatus(s=>({...s,[ep.name]:{ok:false,ms:0,status:"error"}})));
    });
  },[token]);

  async function addUser(e){
    e.preventDefault();setBusy(true);setUserMsg({text:"",type:""});
    try{
      const r=await fetch(`${BASE}/api/dashboard/users`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify(newUser)});
      const d=await r.json();if(!r.ok)throw new Error(d.error);
      setUsers(u=>[...u,d]);setNewUser({username:"",password:"",role:"viewer",name:"",email:""});
      setUserMsg({text:"User created successfully.",type:"success"});setShowAdd(false);
    }catch(e){setUserMsg({text:"Error: "+e.message,type:"error"});}
    finally{setBusy(false);}
  }

  async function deleteUser(id,username){
    if(!confirm(`Delete user "${username}"? This cannot be undone.`))return;
    try{
      await fetch(`${BASE}/api/dashboard/users/${id}`,{method:"DELETE",headers:{Authorization:`Bearer ${token}`}});
      setUsers(u=>u.filter(x=>x.id!==id));
      setUserMsg({text:"User deleted.",type:"success"});
    }catch(e){setUserMsg({text:"Error: "+e.message,type:"error"});}
  }

  async function updateUserRole(id,role){
    try{
      const r=await fetch(`${BASE}/api/dashboard/users/${id}`,{method:"PUT",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({role})});
      const d=await r.json();setUsers(u=>u.map(x=>x.id===id?{...x,...d}:x));
    }catch(e){setUserMsg({text:"Error: "+e.message,type:"error"});}
  }

  async function saveSettings(){
    setBusy(true);setSettingsMsg("");
    try{await fetch(`${BASE}/api/dashboard/settings`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify(settings)});setSettingsMsg("Settings saved.");}
    catch(e){setSettingsMsg("Error: "+e.message);}finally{setBusy(false);}
  }

  function testApi(name,path){
    const start=Date.now();
    setApiStatus(s=>({...s,[name]:{ok:null,ms:0,status:"testing…"}}));
    fetch(`${BASE}${path}`,{headers:{Authorization:`Bearer ${token}`}})
      .then(r=>setApiStatus(s=>({...s,[name]:{ok:r.ok,ms:Date.now()-start,status:r.status}})))
      .catch(()=>setApiStatus(s=>({...s,[name]:{ok:false,ms:0,status:"error"}})));
  }

  const inp2=(label,val,onChange,type="text",ph="")=>(
    <div>
      <label style={{fontSize:11,fontWeight:600,color:S.muted,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</label>
      <input type={type} value={val} onChange={e=>onChange(e.target.value)} placeholder={ph} style={{background:S.bg,border:`1.5px solid ${S.border2}`,borderRadius:7,padding:"8px 12px",color:S.text,fontSize:13,width:"100%",boxSizing:"border-box",outline:"none"}}/>
    </div>
  );

  const sTabBtn=(id,label,icon)=>(
    <button onClick={()=>setTab(id)} style={{padding:"8px 16px",borderRadius:7,fontSize:12,cursor:"pointer",border:`1.5px solid ${tab===id?S.accent:S.border2}`,background:tab===id?S.accentLight:"transparent",color:tab===id?S.accent:S.textLight,fontWeight:600,display:"flex",alignItems:"center",gap:5}}>
      {icon&&<span>{icon}</span>}{label}
    </button>
  );

  // ── Data Refresh state ──
  const TABLES=[
    {key:"CustomerOverview",label:"Customer Overview",desc:"Solmar · Interbus · Solmar DE bookings",icon:"📋",endpoint:"/api/dashboard/kpis"},
    {key:"ST_Bookings",label:"Snowtravel Bookings",desc:"Snowtravel dataset",icon:"❄️",endpoint:"/api/dashboard/kpis"},
    {key:"BUStrips",label:"Bus Pendel (BUStrips)",desc:"Pendel overview data — Samir's ETL",icon:"🚌",endpoint:"/api/dashboard/pendel-overview"},
    {key:"FeederOverview",label:"Feeder Routes",desc:"Pickup stop data per route",icon:"🗺️",endpoint:"/api/dashboard/feeder-overview"},
    {key:"HotelOverview",label:"Hotel Overview",desc:"Hotel performance table",icon:"🏨",endpoint:"/api/dashboard/hotel-overview"},
    {key:"solmar_bus_deck_choice",label:"Bus Deck & Class",desc:"Deck and class distribution",icon:"🪑",endpoint:"/api/dashboard/bus-kpis"},
    {key:"MarginOverview",label:"Purchase Obligations",desc:"Margins, commissions, obligations",icon:"💶",endpoint:"/api/dashboard/margin-overview"},
  ];
  const INTERVALS=[
    {v:0,l:"Manual only"},
    {v:1,l:"Every 1 hour"},
    {v:2,l:"Every 2 hours"},
    {v:6,l:"Every 6 hours"},
    {v:12,l:"Every 12 hours"},
    {v:24,l:"Every 24 hours"},
  ];
  const[refreshStatus,setRefreshStatus]=useState(()=>Object.fromEntries(TABLES.map(t=>[t.key,{lastSync:null,loading:false,ok:null,ms:null}])));
  const[refreshSchedule,setRefreshSchedule]=useState(()=>Object.fromEntries(TABLES.map(t=>[t.key,0])));
  const refreshTimers=React.useRef({});

  function pingTable(t){
    setRefreshStatus(s=>({...s,[t.key]:{...s[t.key],loading:true,ok:null}}));
    const start=Date.now();
    fetch(`${BASE}${t.endpoint}`,{headers:{Authorization:`Bearer ${token}`}})
      .then(r=>{
        setRefreshStatus(s=>({...s,[t.key]:{loading:false,ok:r.ok,ms:Date.now()-start,lastSync:new Date().toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}}));
      })
      .catch(()=>{
        setRefreshStatus(s=>({...s,[t.key]:{loading:false,ok:false,ms:null,lastSync:new Date().toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}}));
      });
  }

  function pingAll(){
    TABLES.forEach(t=>pingTable(t));
  }

  function setSchedule(key,hours){
    setRefreshSchedule(s=>({...s,[key]:hours}));
    if(refreshTimers.current[key]){clearInterval(refreshTimers.current[key]);}
    if(hours>0){
      const t=TABLES.find(x=>x.key===key);
      refreshTimers.current[key]=setInterval(()=>pingTable(t),hours*60*60*1000);
    }
  }

  // Cleanup timers on unmount
  React.useEffect(()=>{
    return()=>{Object.values(refreshTimers.current).forEach(clearInterval);};
  },[]);

  const roleColor=role=>role==="admin"?{bg:S.accentLight,c:S.accent}:{bg:"#f0fdf4",c:S.success};

  const EditModal = editUser&&(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(2px)"}}
      onClick={e=>{if(e.target===e.currentTarget)setEditUser(null);}}>
      <div style={{background:S.card,borderRadius:16,padding:32,width:420,boxShadow:"0 20px 60px rgba(0,0,0,0.2)",border:`1px solid ${S.border}`}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
          <div style={{width:44,height:44,borderRadius:12,background:`${S.accent}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:S.accent}}>
            {(editUser.name||editUser.username||"?")[0].toUpperCase()}
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:800,color:S.text}}>Edit User</div>
            <div style={{fontSize:11,color:S.muted}}>@{editUser.username}</div>
          </div>
          <button onClick={()=>setEditUser(null)} style={{background:"none",border:"none",cursor:"pointer",color:S.muted2,fontSize:22,lineHeight:1,padding:4}}>×</button>
        </div>

        {/* Fields */}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {[["Full Name","name","text","Enter full name"],["Username","username","text","Enter username"],["Email","email","email","Enter email"]].map(([label,field,type,ph])=>(
            <div key={field}>
              <label style={{fontSize:11,fontWeight:700,color:S.muted,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</label>
              <input type={type} value={editForm[field]} onChange={e=>setEditForm(p=>({...p,[field]:e.target.value}))}
                placeholder={ph}
                style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${S.border2}`,background:S.bg,color:S.text,fontSize:13,boxSizing:"border-box",outline:"none"}}/>
            </div>
          ))}

          {/* Role */}
          <div>
            <label style={{fontSize:11,fontWeight:700,color:S.muted,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>Role</label>
            <div style={{display:"flex",gap:8}}>
              {["viewer","admin"].map(r=>{
                const active=editForm.role===r;
                const c=r==="admin"?S.accent:S.success;
                return<button key={r} onClick={()=>setEditForm(p=>({...p,role:r}))} style={{flex:1,padding:"8px",borderRadius:8,border:`1.5px solid ${active?c:S.border2}`,background:active?`${c}15`:"transparent",color:active?c:S.textLight,fontWeight:active?700:400,cursor:"pointer",fontSize:13,transition:"all 0.15s"}}>
                  {r==="admin"?"🔑 Admin":"👁 Viewer"}
                </button>;
              })}
            </div>
          </div>

          {/* Password reset */}
          <div style={{borderTop:`1px solid ${S.border}`,paddingTop:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:showEditPw?8:0}}>
              <label style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.05em"}}>Reset Password</label>
              <button onClick={()=>{setShowEditPw(p=>!p);setEditForm(p=>({...p,password:""}));}} style={{fontSize:11,color:showEditPw?S.danger:S.accent,fontWeight:600,background:"none",border:"none",cursor:"pointer"}}>
                {showEditPw?"✕ Cancel":"+ Set New Password"}
              </button>
            </div>
            {showEditPw&&(
              <div style={{position:"relative"}}>
                <div style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:S.muted2,display:"flex",pointerEvents:"none"}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                </div>
                <input type="password" value={editForm.password} onChange={e=>setEditForm(p=>({...p,password:e.target.value}))}
                  placeholder="New password (min 6 chars)"
                  style={{width:"100%",padding:"9px 12px 9px 34px",borderRadius:8,border:`1.5px solid ${S.border2}`,background:S.bg,color:S.text,fontSize:13,boxSizing:"border-box",outline:"none"}}/>
              </div>
            )}
          </div>
        </div>

        {/* Message */}
        {editMsg&&(
          <div style={{marginTop:14,padding:"9px 12px",borderRadius:8,background:editMsg.err?"#fef2f2":"#f0fdf4",color:editMsg.err?S.danger:S.success,fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
            {editMsg.err?"⚠":"✓"} {editMsg.t}
          </div>
        )}

        {/* Actions */}
        <div style={{display:"flex",gap:8,marginTop:20}}>
          <button onClick={()=>setEditUser(null)} style={{flex:1,padding:"10px",borderRadius:8,border:`1.5px solid ${S.border2}`,background:"transparent",color:S.muted,cursor:"pointer",fontSize:13,fontWeight:600}}>Cancel</button>
          <button onClick={saveEdit} disabled={editBusy} style={{flex:2,padding:"10px",borderRadius:8,border:"none",background:S.accent,color:"#fff",cursor:editBusy?"wait":"pointer",fontSize:13,fontWeight:700,opacity:editBusy?0.7:1}}>
            {editBusy?"Saving…":"Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );

  const API_ENDPOINTS=[
    {name:"Dashboard KPIs",path:"/api/dashboard/kpis"},
    {name:"Revenue by Year",path:"/api/dashboard/revenue-by-year"},
    {name:"Bus Slicers",path:"/api/dashboard/bus-slicers"},
    {name:"Margin Overview",path:"/api/dashboard/margin-overview"},
  ];

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden",background:S.bg}}>
      {EditModal}
      <div style={{background:S.card,borderBottom:`1px solid ${S.border}`,padding:"10px 20px",display:"flex",gap:8,flexShrink:0,boxShadow:S.shadow}}>
        {sTabBtn("users","User Management",<Users size={14}/>)}
        {sTabBtn("api","API Status",<CircleDot size={14}/>)}
        {sTabBtn("refresh","Data Refresh",<RotateCcw size={14}/>)}
        {sTabBtn("ai","AI Prompts",<Layers size={14}/>)}
        {sTabBtn("alerts","Email Alerts",<AlertCircle size={14}/>)}
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
        {tab==="users"&&(
          <div style={{maxWidth:900}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div>
                <div style={{fontSize:16,fontWeight:800,color:S.text}}>User Accounts</div>
                <div style={{fontSize:12,color:S.muted,marginTop:2}}>{users.length} users registered</div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <Btn onClick={loadUsers} variant="secondary" size="sm">↻ Refresh</Btn>
                <Btn onClick={()=>setShowAdd(p=>!p)} variant="primary" size="sm">+ Add New User</Btn>
              </div>
            </div>
            {userMsg.text&&(
              <div style={{background:userMsg.type==="error"?S.dangerBg:S.successBg,border:`1px solid ${userMsg.type==="error"?S.danger:S.success}33`,borderRadius:8,padding:"10px 14px",fontSize:12,color:userMsg.type==="error"?S.danger:S.success,fontWeight:500,marginBottom:14}}>
                {userMsg.type==="success"?"✓":"⚠"} {userMsg.text}
              </div>
            )}
            {showAdd&&(
              <Card style={{marginBottom:16,border:`1.5px solid ${S.border2}`}}>
                <div style={{fontSize:14,fontWeight:700,color:S.text,marginBottom:14}}>➕ Add New User</div>
                <form onSubmit={addUser} style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  {inp2("Full Name",newUser.name,v=>setNewUser({...newUser,name:v}),"text","Full name")}
                  {inp2("Username",newUser.username,v=>setNewUser({...newUser,username:v}),"text","Username")}
                  {inp2("Email",newUser.email,v=>setNewUser({...newUser,email:v}),"email","email@example.com")}
                  {inp2("Password",newUser.password,v=>setNewUser({...newUser,password:v}),"password","Password")}
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:S.muted,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>Role</label>
                    <select value={newUser.role} onChange={e=>setNewUser({...newUser,role:e.target.value})} style={{background:S.bg,border:`1.5px solid ${S.border2}`,borderRadius:7,padding:"8px 12px",color:S.text,fontSize:13,width:"100%",outline:"none"}}>
                      <option value="viewer">Viewer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
                    <Btn onClick={()=>setShowAdd(false)} variant="secondary" size="sm" style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
                    <button type="submit" disabled={busy||!newUser.username||!newUser.password} style={{flex:1,padding:"8px",background:S.accent,border:"none",borderRadius:7,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",opacity:busy?0.7:1}}>
                      {busy?"Creating…":"Create User"}
                    </button>
                  </div>
                </form>
              </Card>
            )}
            <Card p="0">
              {loading&&<div style={{padding:20,textAlign:"center",color:S.muted}}>Loading users…</div>}
              {!loading&&(
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead>
                    <tr style={{background:"#f8faff"}}>
                      {["Name","Username","Email","Role","Status","Actions"].map((h,i)=>(
                        <th key={i} style={{padding:"10px 16px",textAlign:i===5?"right":"left",color:S.muted,fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:"0.05em",borderBottom:`1px solid ${S.border}`}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.length===0&&(
                      <tr><td colSpan={6} style={{padding:28,textAlign:"center",color:S.muted}}>No users found</td></tr>
                    )}
                    {users.map((u,i)=>{
                      const rc=roleColor(u.role);
                      const isSelf=u.id===session?.id||u.username===session?.username;
                      return(
                        <tr key={u.id} style={{borderBottom:`1px solid ${S.border}`,background:i%2===0?"transparent":"#f8faff"}}>
                          <td style={{padding:"12px 16px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:10}}>
                              <div style={{width:34,height:34,borderRadius:"50%",background:`${S.accent}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:S.accent,flexShrink:0}}>{(u.name||u.username||"?")[0].toUpperCase()}</div>
                              <div style={{fontSize:13,fontWeight:600,color:S.text}}>{u.name||u.username}</div>
                            </div>
                          </td>
                          <td style={{padding:"12px 16px",fontSize:12,color:S.textLight,fontFamily:"monospace"}}>{u.username}</td>
                          <td style={{padding:"12px 16px",fontSize:12,color:S.muted}}>{u.email||"—"}</td>
                          <td style={{padding:"12px 16px"}}>
                            <select value={u.role||"viewer"} onChange={e=>updateUserRole(u.id,e.target.value)} disabled={isSelf} style={{background:rc.bg,border:`1px solid ${rc.c}44`,borderRadius:6,padding:"3px 8px",color:rc.c,fontSize:11,fontWeight:700,outline:"none",cursor:isSelf?"default":"pointer"}}>
                              <option value="viewer">Viewer</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td style={{padding:"12px 16px"}}>
                            <span style={{background:S.successBg,color:S.success,padding:"2px 8px",borderRadius:5,fontSize:11,fontWeight:600}}>● Active</span>
                          </td>
                          <td style={{padding:"12px 16px",textAlign:"right",display:"flex",gap:6,justifyContent:"flex-end"}}>
                            <Btn onClick={()=>openEdit(u)} variant="secondary" size="sm">✏ Edit</Btn>
                            {!isSelf&&<Btn onClick={()=>deleteUser(u.id,u.username)} variant="danger" size="sm">🗑 Delete</Btn>}
                            {isSelf&&<span style={{fontSize:11,color:S.muted,fontStyle:"italic",alignSelf:"center"}}>You</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </Card>
            <Card style={{marginTop:16}}>
              <div style={{fontSize:13,fontWeight:700,color:S.text,marginBottom:12}}>Current Session</div>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:44,height:44,borderRadius:"50%",background:`${S.accent}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:S.accent}}>{(session?.username||"U")[0].toUpperCase()}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,color:S.text}}>{session?.username}</div>
                  <div style={{fontSize:12,color:S.muted}}>Role: {session?.role||"viewer"}</div>
                </div>
                <Btn onClick={onLogout} variant="danger" size="sm">Sign Out</Btn>
              </div>
            </Card>
          </div>
        )}
        {tab==="api"&&(
          <div style={{maxWidth:700}}>
            <div style={{fontSize:16,fontWeight:800,color:S.text,marginBottom:16}}>API Status</div>
            <Card p="0">
              {API_ENDPOINTS.map((ep,i)=>{
                const st=apiStatus[ep.name];
                return(
                  <div key={ep.name} style={{display:"flex",alignItems:"center",padding:"12px 16px",borderBottom:i<API_ENDPOINTS.length-1?`1px solid ${S.border}`:"none",gap:12}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:st==null?S.muted2:st.ok===null?S.warn:st.ok?S.success:S.danger,flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:S.text}}>{ep.name}</div>
                      <div style={{fontSize:11,color:S.muted,fontFamily:"monospace"}}>{ep.path}</div>
                    </div>
                    {st&&<span style={{fontSize:11,color:S.muted}}>{st.ms}ms · HTTP {st.status}</span>}
                    <Btn onClick={()=>testApi(ep.name,ep.path)} variant="secondary" size="sm">Test</Btn>
                  </div>
                );
              })}
            </Card>
            <Card style={{marginTop:14}}>
              <div style={{fontSize:13,fontWeight:700,color:S.text,marginBottom:10}}>System Info</div>
              {[["Backend URL",BASE],["Database","Azure SQL · ttpserver.database.windows.net"],["DB Name","TTPDatabase"],["Frontend","GitHub Pages · /TTP-DASHBOARD/"],["Version","v2.1 · Data Engine"]].map(([k,v])=>(
                <div key={k} style={{display:"flex",gap:16,padding:"7px 0",borderBottom:`1px solid ${S.border}`}}>
                  <div style={{width:120,fontSize:12,fontWeight:600,color:S.muted,flexShrink:0}}>{k}</div>
                  <div style={{fontSize:12,color:S.text,wordBreak:"break-all"}}>{v}</div>
                </div>
              ))}
            </Card>
          </div>
        )}
        {tab==="ai"&&(
          <div style={{maxWidth:600}}>
            <div style={{fontSize:16,fontWeight:800,color:S.text,marginBottom:16}}>AI Prompt Settings</div>
            {settingsMsg&&<div style={{background:settingsMsg.startsWith("Error")?S.dangerBg:S.successBg,border:`1px solid ${settingsMsg.startsWith("Error")?S.danger:S.success}33`,borderRadius:8,padding:"10px 14px",fontSize:12,color:settingsMsg.startsWith("Error")?S.danger:S.success,marginBottom:14}}>{settingsMsg}</div>}
            <Card>
              <div style={{fontSize:13,fontWeight:700,color:S.text,marginBottom:8}}>Custom AI System Prompt</div>
              <textarea value={settings.aiPrompt||""} onChange={e=>setSettings({...settings,aiPrompt:e.target.value})} rows={8} placeholder="We are a Belgian travel company. Revenue in EUR. Fiscal year Dec–Nov…" style={{width:"100%",background:S.bg,border:`1.5px solid ${S.border2}`,borderRadius:8,padding:"10px 12px",color:S.text,fontSize:13,resize:"vertical",boxSizing:"border-box",outline:"none"}}/>
              <Btn onClick={saveSettings} variant="primary" size="md" style={{marginTop:10}}>{busy?"Saving…":"Save Prompt"}</Btn>
            </Card>
          </div>
        )}
        {tab==="refresh"&&(
          <div style={{maxWidth:860}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div>
                <div style={{fontSize:16,fontWeight:800,color:S.text}}>Data Refresh</div>
                <div style={{fontSize:12,color:S.muted,marginTop:2}}>Manually refresh or set automatic schedule per table</div>
              </div>
              <Btn onClick={pingAll} variant="primary" size="md" style={{gap:6}}>
                <RotateCcw size={13}/>Refresh All Now
              </Btn>
            </div>

            {/* Schedule legend */}
            <div style={{background:S.accentLight,border:`1px solid ${S.accent}33`,borderRadius:10,padding:"10px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:8,fontSize:12}}>
              <span style={{fontSize:16}}>ℹ️</span>
              <span style={{color:S.accent,fontWeight:500}}>Automatic refresh pings the API endpoint to verify data is live. Set interval per table below. Timers reset when you reload the page.</span>
            </div>

            <Card p="0">
              {TABLES.map((t,i)=>{
                const st=refreshStatus[t.key];
                const sch=refreshSchedule[t.key];
                return(
                  <div key={t.key} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",borderBottom:i<TABLES.length-1?`1px solid ${S.border}`:"none",flexWrap:"wrap"}}>
                    {/* Icon + info */}
                    <div style={{fontSize:22,flexShrink:0}}>{t.icon}</div>
                    <div style={{flex:1,minWidth:180}}>
                      <div style={{fontSize:13,fontWeight:700,color:S.text}}>{t.label}</div>
                      <div style={{fontSize:11,color:S.muted,marginTop:1}}>{t.desc}</div>
                    </div>

                    {/* Status */}
                    <div style={{display:"flex",alignItems:"center",gap:6,minWidth:160}}>
                      <div style={{width:9,height:9,borderRadius:"50%",background:st.loading?S.warn:st.ok===null?S.muted2:st.ok?S.success:S.danger,flexShrink:0}}/>
                      <div>
                        <div style={{fontSize:11,fontWeight:600,color:st.loading?S.warn:st.ok===null?S.muted:st.ok?S.success:S.danger}}>
                          {st.loading?"Checking…":st.ok===null?"Not checked":st.ok?"✅ Online":"❌ Error"}
                        </div>
                        {st.lastSync&&<div style={{fontSize:10,color:S.muted2}}>Last: {st.lastSync}{st.ms?` · ${st.ms}ms`:""}</div>}
                        {sch>0&&!st.lastSync&&<div style={{fontSize:10,color:S.accent}}>⏱ Auto every {sch}h</div>}
                        {sch>0&&st.lastSync&&<div style={{fontSize:10,color:S.accent}}>⏱ Auto every {sch}h</div>}
                      </div>
                    </div>

                    {/* Interval selector */}
                    <div style={{display:"flex",flexDirection:"column",gap:3}}>
                      <label style={{fontSize:9,color:S.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>Auto Refresh</label>
                      <select value={sch} onChange={e=>setSchedule(t.key,Number(e.target.value))}
                        style={{background:sch>0?S.accentLight:S.bg,border:`1.5px solid ${sch>0?S.accent:S.border2}`,borderRadius:7,padding:"5px 10px",color:sch>0?S.accent:S.textLight,fontSize:11,fontWeight:sch>0?700:400,outline:"none",cursor:"pointer"}}>
                        {INTERVALS.map(iv=><option key={iv.v} value={iv.v}>{iv.l}</option>)}
                      </select>
                    </div>

                    {/* Manual refresh button */}
                    <button onClick={()=>pingTable(t)} disabled={st.loading}
                      style={{padding:"7px 14px",borderRadius:7,fontSize:12,cursor:st.loading?"wait":"pointer",border:`1.5px solid ${S.border2}`,background:st.loading?"#f8faff":"transparent",color:S.textLight,fontWeight:600,display:"flex",alignItems:"center",gap:5,opacity:st.loading?0.6:1,whiteSpace:"nowrap"}}>
                      <RotateCcw size={12}/>
                      {st.loading?"Checking…":"Refresh Now"}
                    </button>
                  </div>
                );
              })}
            </Card>

            {/* Summary row */}
            <div style={{marginTop:14,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
              {[
                {l:"Tables Online",v:TABLES.filter(t=>refreshStatus[t.key].ok===true).length+"/"+TABLES.length,c:S.success},
                {l:"Auto Scheduled",v:TABLES.filter(t=>refreshSchedule[t.key]>0).length+" tables",c:S.accent},
                {l:"Last Full Refresh",v:TABLES.every(t=>refreshStatus[t.key].lastSync)?[...TABLES].map(t=>refreshStatus[t.key].lastSync).sort().pop():"Not yet",c:S.muted},
              ].map(k=>(
                <div key={k.l} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:10,padding:"12px 16px",boxShadow:S.shadow,display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:k.c,flexShrink:0}}/>
                  <div>
                    <div style={{fontSize:10,color:S.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>{k.l}</div>
                    <div style={{fontSize:16,fontWeight:800,color:k.c}}>{k.v}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab==="alerts"&&(
          <div style={{maxWidth:600}}>
            <div style={{fontSize:16,fontWeight:800,color:S.text,marginBottom:16}}>Email Alert Settings</div>
            {settingsMsg&&<div style={{background:settingsMsg.startsWith("Error")?S.dangerBg:S.successBg,border:`1px solid ${settingsMsg.startsWith("Error")?S.danger:S.success}33`,borderRadius:8,padding:"10px 14px",fontSize:12,color:settingsMsg.startsWith("Error")?S.danger:S.success,marginBottom:14}}>{settingsMsg}</div>}
            <Card>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div style={{fontSize:13,fontWeight:700,color:S.text}}>Email Alerts</div>
                <div style={{position:"relative",width:44,height:24,cursor:"pointer"}} onClick={()=>setSettings({...settings,emailAlerts:{...settings.emailAlerts,enabled:!settings.emailAlerts?.enabled}})}>
                  <div style={{width:44,height:24,borderRadius:12,background:settings.emailAlerts?.enabled?S.accent:S.border2,transition:"background 0.2s"}}/>
                  <div style={{position:"absolute",top:3,left:settings.emailAlerts?.enabled?22:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {inp2("Recipients",settings.emailAlerts?.recipients||"",v=>setSettings({...settings,emailAlerts:{...settings.emailAlerts,recipients:v}}),"text","email@example.com")}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  {inp2("Revenue Drop %",String(settings.emailAlerts?.revenueDropThreshold||10),v=>setSettings({...settings,emailAlerts:{...settings.emailAlerts,revenueDropThreshold:+v}}),"number")}
                  {inp2("Booking Spike %",String(settings.emailAlerts?.bookingSpikethreshold||20),v=>setSettings({...settings,emailAlerts:{...settings.emailAlerts,bookingSpikethreshold:+v}}),"number")}
                </div>
                <Btn onClick={saveSettings} variant="primary" size="md" style={{alignSelf:"flex-start"}}>{busy?"Saving…":"Save Alert Settings"}</Btn>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App(){
  const[session,setSession]=useState(()=>loadAuth());
  const[tab,setTab]=useState("overview");
  const[navCollapsed,setNavCollapsed]=useState(false);
  const[showPwModal,setShowPwModal]=useState(false);
  const[pwForm,setPwForm]=useState({current:'',next:'',confirm:''});
  const[pwMsg,setPwMsg]=useState(null);
  const[pwBusy,setPwBusy]=useState(false);
  const[showCur,setShowCur]=useState(false);
  const[showNext,setShowNext]=useState(false);
  const[showConf,setShowConf]=useState(false);

  async function changePassword(){
    setPwMsg(null);
    if(pwForm.next!==pwForm.confirm){setPwMsg({err:true,t:'New passwords do not match'});return;}
    if(pwForm.next.length<6){setPwMsg({err:true,t:'Password must be at least 6 characters'});return;}
    setPwBusy(true);
    try{
      const r=await fetch(`${BASE}/api/auth/change-password`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.token}`},body:JSON.stringify({currentPassword:pwForm.current,newPassword:pwForm.next})});
      const d=await r.json();
      if(!r.ok)setPwMsg({err:true,t:d.error||'Failed'});
      else{setPwMsg({err:false,t:'✓ Password changed successfully!'});setPwForm({current:'',next:'',confirm:''});setTimeout(()=>{setShowPwModal(false);setPwMsg(null);},1800);}
    }catch{setPwMsg({err:true,t:'Network error'});}
    finally{setPwBusy(false);}
  }
  useEffect(()=>{if(tab==="settings"&&session?.role!=="admin")setTab("overview");},[tab,session]);

  useEffect(()=>{document.body.style.background=S.bg;},[]);

  if(!session?.token){
    return<Login onLogin={d=>{saveAuth(d.token,d);setSession(d);}}/>;
  }

  const pwInp=(field,show,setShow,placeholder)=>(
    <div style={{marginBottom:14}}>
      <label style={{fontSize:11,fontWeight:700,color:S.muted,display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.06em"}}>{placeholder}</label>
      <div style={{position:"relative"}}>
        <div style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:S.muted2,display:"flex",pointerEvents:"none"}}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        </div>
        <input type={show?"text":"password"} value={pwForm[field]} onChange={e=>setPwForm(p=>({...p,[field]:e.target.value}))}
          placeholder={placeholder}
          style={{width:"100%",padding:"9px 40px 9px 36px",borderRadius:8,border:`1.5px solid ${S.border2}`,background:S.bg,color:S.text,fontSize:13,boxSizing:"border-box",outline:"none",fontFamily:"inherit"}}/>
        <button type="button" onClick={()=>setShow(p=>!p)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:S.muted2,display:"flex",alignItems:"center",padding:2}}>
          {show
            ?<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            :<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          }
        </button>
      </div>
    </div>
  );

  const token=session.token;
  const isAdmin = session?.role === "admin";

  const PwModal = showPwModal&&(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(2px)"}}
      onClick={e=>{if(e.target===e.currentTarget){setShowPwModal(false);setPwMsg(null);setPwForm({current:'',next:'',confirm:''}); }}}>
      <div style={{background:S.card,borderRadius:16,padding:32,width:380,boxShadow:"0 20px 60px rgba(0,0,0,0.2)",border:`1px solid ${S.border}`,position:"relative"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:24}}>
          <div style={{width:40,height:40,borderRadius:10,background:`${S.accent}15`,display:"flex",alignItems:"center",justifyContent:"center",color:S.accent}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          </div>
          <div>
            <div style={{fontSize:16,fontWeight:800,color:S.text}}>Change Password</div>
            <div style={{fontSize:11,color:S.muted}}>Signed in as <strong>{session.username}</strong></div>
          </div>
          <button onClick={()=>{setShowPwModal(false);setPwMsg(null);setPwForm({current:'',next:'',confirm:''}); }} style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",color:S.muted2,fontSize:20,lineHeight:1,padding:4}}>×</button>
        </div>
        {pwInp("current",showCur,setShowCur,"Current Password")}
        {pwInp("next",showNext,setShowNext,"New Password")}
        {pwInp("confirm",showConf,setShowConf,"Confirm New Password")}
        {pwForm.next&&(()=>{
          const p=pwForm.next;
          const checks=[p.length>=8,/[A-Z]/.test(p),/[0-9]/.test(p),/[^A-Za-z0-9]/.test(p)];
          const score=checks.filter(Boolean).length;
          const colors=["#ef4444","#f97316","#eab308","#22c55e"];
          const labels=["Weak","Fair","Good","Strong"];
          return(
            <div style={{marginBottom:14}}>
              <div style={{display:"flex",gap:4,marginBottom:5}}>
                {[0,1,2,3].map(i=>(
                  <div key={i} style={{flex:1,height:4,borderRadius:4,background:i<score?colors[score-1]:"#e2e8f0",transition:"background 0.2s"}}/>
                ))}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10}}>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {[["8+ chars",p.length>=8],["Uppercase",/[A-Z]/.test(p)],["Number",/[0-9]/.test(p)],["Symbol",/[^A-Za-z0-9]/.test(p)]].map(([l,ok])=>(
                    <span key={l} style={{color:ok?"#22c55e":"#94a3b8",fontWeight:600}}>{ok?"✓":"○"} {l}</span>
                  ))}
                </div>
                <span style={{fontWeight:700,color:score>0?colors[score-1]:"#94a3b8"}}>{score>0?labels[score-1]:""}</span>
              </div>
            </div>
          );
        })()}
        {pwMsg&&(
          <div style={{padding:"9px 12px",borderRadius:8,background:pwMsg.err?"#fef2f2":"#f0fdf4",color:pwMsg.err?S.danger:S.success,fontSize:12,fontWeight:600,marginBottom:14,display:"flex",alignItems:"center",gap:6}}>
            {pwMsg.err
              ?<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              :<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20,6 9,17 4,12"/></svg>
            }
            {pwMsg.t}
          </div>
        )}
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{setShowPwModal(false);setPwMsg(null);setPwForm({current:'',next:'',confirm:''}); }} style={{flex:1,padding:"9px",borderRadius:8,border:`1.5px solid ${S.border2}`,background:"transparent",color:S.muted,cursor:"pointer",fontSize:13,fontWeight:600}}>Cancel</button>
          <button onClick={changePassword} disabled={pwBusy||!pwForm.current||!pwForm.next||!pwForm.confirm} style={{flex:2,padding:"9px",borderRadius:8,border:"none",background:S.accent,color:"#fff",cursor:pwBusy?"wait":"pointer",fontSize:13,fontWeight:700,opacity:pwBusy||!pwForm.current||!pwForm.next||!pwForm.confirm?0.6:1}}>
            {pwBusy?"Changing…":"Change Password"}
          </button>
        </div>
      </div>
    </div>
  );
  const NAV=[
    {id:"overview",l:"Overview",ic:<LayoutDashboard size={16}/>},
    {id:"bus",l:"Bus Occupancy",ic:<Bus size={16}/>},
    {id:"purchase",l:"Purchase Obligations",ic:<Briefcase size={16}/>},
    {id:"hotel",l:"Hotel Insights",ic:<Star size={16}/>},
    {id:"flights",l:"Flights",ic:<Plane size={16}/>},
    ...(isAdmin?[{id:"settings",l:"Settings",ic:<Settings size={16}/>}]:[]),
  ];

  const navW=navCollapsed?60:220;

  return(
    <div style={{display:"flex",height:"100vh",background:S.bg,color:S.text,fontFamily:"system-ui,-apple-system,sans-serif",letterSpacing:"0.01em",overflow:"hidden"}}>
      {PwModal}
      <div style={{width:navW,background:S.side,borderRight:`1px solid ${S.border}`,display:"flex",flexDirection:"column",flexShrink:0,transition:"width 0.2s",boxShadow:"2px 0 8px rgba(0,0,0,0.04)"}}>
        <div style={{padding:"16px 14px",borderBottom:`1px solid ${S.border}`,display:"flex",alignItems:"center",gap:10,minHeight:64}}>
          <div style={{width:36,height:36,borderRadius:9,background:`linear-gradient(135deg,${S.accent},#3b82f6)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:"#fff",flexShrink:0,cursor:"pointer",boxShadow:"0 2px 8px rgba(26,86,219,0.3)"}} onClick={()=>setNavCollapsed(p=>!p)}>
            <span style={{fontSize:13,fontWeight:900,color:"#fff"}}>TTP</span>
          </div>
          {!navCollapsed&&(
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:800,color:S.text,letterSpacing:"-0.01em"}}>TTP Analytics</div>
              <div style={{fontSize:10,color:S.muted}}>Data Engine v2.0</div>
            </div>
          )}
          {!navCollapsed&&(
            <button onClick={()=>setNavCollapsed(true)} style={{background:"none",border:"none",color:S.muted2,cursor:"pointer",padding:2,fontSize:16,lineHeight:1,flexShrink:0}}>‹</button>
          )}
        </div>
        <div style={{flex:1,padding:10,overflowY:"auto"}}>
          {NAV.map(n=>(
            <div key={n.id} onClick={()=>setTab(n.id)} title={navCollapsed?n.l:""} style={{display:"flex",alignItems:"center",justifyContent:navCollapsed?"center":"flex-start",gap:10,padding:navCollapsed?"10px 6px":"9px 12px",cursor:"pointer",borderRadius:9,background:tab===n.id?S.accentLight:"transparent",color:tab===n.id?S.accent:S.textLight,borderLeft:tab===n.id?`3px solid ${S.accent}`:"3px solid transparent",marginBottom:2,fontSize:13,fontWeight:tab===n.id?700:400,transition:"all 0.15s"}}>
              <span style={{flexShrink:0,display:"flex",alignItems:"center"}}>{n.ic}</span>
              {!navCollapsed&&<span>{n.l}</span>}
            </div>
          ))}
        </div>
        <div style={{padding:"10px 12px",borderTop:`1px solid ${S.border}`,display:"flex",alignItems:"center",gap:9,justifyContent:navCollapsed?"center":"flex-start"}}>
          <div style={{width:28,height:28,borderRadius:"50%",background:`${S.accent}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:S.accent,flexShrink:0}}>{(session.username||"U")[0].toUpperCase()}</div>
          {!navCollapsed&&(
            <>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:S.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{session.name||session.username}</div>
                <div style={{fontSize:10,color:S.muted,textTransform:"capitalize"}}>{session.role||"viewer"}</div>
              </div>
              <button onClick={()=>setShowPwModal(true)} title="Change password" style={{background:"none",border:"none",color:S.muted2,cursor:"pointer",padding:4,flexShrink:0,display:"flex",alignItems:"center"}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              </button>
              <button onClick={()=>{clearAuth();setSession(null);}} title="Sign out" style={{background:"none",border:"none",color:S.muted2,cursor:"pointer",padding:4,flexShrink:0,fontSize:14}}>→</button>
            </>
          )}
        </div>
        {navCollapsed&&(
          <div style={{padding:"6px",display:"flex",justifyContent:"center",borderTop:`1px solid ${S.border}`}}>
            <button onClick={()=>setNavCollapsed(false)} style={{background:"none",border:"none",color:S.muted2,cursor:"pointer",fontSize:16}}>›</button>
          </div>
        )}
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{height:52,padding:"0 20px",borderBottom:`1px solid ${S.border}`,background:S.card,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,boxShadow:S.shadow}}>
          <div style={{fontSize:15,fontWeight:800,color:S.text,letterSpacing:"-0.01em"}}>{NAV.find(n=>n.id===tab)?.l}</div>
          <div style={{display:"flex",alignItems:"center",gap:12,fontSize:11,color:S.muted}}>
            <span>{new Date().toLocaleDateString("nl-BE",{weekday:"short",year:"numeric",month:"short",day:"numeric"})}</span>
            <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:7,height:7,borderRadius:"50%",background:S.success,display:"inline-block"}}/>Live</span>
          </div>
        </div>
        <div style={{flex:1,overflow:"hidden"}}>
          {tab==="overview"  &&<OverviewTab  token={token}/>}
          {tab==="bus"       &&<BusTab       token={token}/>}
          {tab==="purchase"  &&<PurchaseTab  token={token}/>}
          {tab==="hotel"     &&<HotelTab     token={token}/>}
          {tab==="flights"   &&<FlightsTab   token={token}/>}
          {tab==="settings" && isAdmin &&<SettingsTab token={token} session={session} onLogout={()=>{clearAuth();setSession(null);}}/>}
        </div>
      </div>
    </div>
  );
}