import React, { useState, useEffect, useCallback } from "react";

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

const fmtM=v=>{const n=parseFloat(v)||0;if(Math.abs(n)>=1e6)return`€${(n/1e6).toFixed(2)}M`;if(Math.abs(n)>=1e3)return`€${(n/1e3).toFixed(1)}K`;return`€${Math.round(n).toLocaleString("nl-BE")}`;};
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
                onMouseEnter={e=>{const sv=e.target.closest("svg");const rc=sv.getBoundingClientRect();const sx=rc.width/W;const sy=rc.height/H;setTooltip({x:mx(i)*sx,y:my(pts[i])*sy,year:yr,month:i+1,value:pts[i]});}}
                onClick={e=>{const sv=e.target.closest("svg");const rc=sv.getBoundingClientRect();const sx=rc.width/W;const sy=rc.height/H;setTooltip({x:mx(i)*sx,y:my(pts[i])*sy,year:yr,month:i+1,value:pts[i]});}}
              />
            ))}
          </g>;
        })}
        {yrs.map((yr,i)=><g key={yr} transform={`translate(${PL+i*58},${H-6})`}><rect width={8} height={8} fill={YC[yr]||S.accent} rx={2}/><text x={12} y={8} fontSize={8} fill={S.muted}>{yr}</text></g>)}
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
                onMouseEnter={e=>{const sv=e.target.closest("svg");const rc=sv.getBoundingClientRect();const sx=rc.width/W;const sy=rc.height/H;setTooltip({x:(x+bw/2)*sx,y:y*sy,year:yr,month:mo,value:v});}}
                onClick={e=>{const sv=e.target.closest("svg");const rc=sv.getBoundingClientRect();const sx=rc.width/W;const sy=rc.height/H;setTooltip({x:(x+bw/2)*sx,y:y*sy,year:yr,month:mo,value:v});}}
              />;
            })}
            <text x={gx+groupW/2} y={H-PB+13} textAnchor="middle" fontSize={7.5} fill={S.muted2}>{MONTHS[mi]}</text>
          </g>;
        })}
        {yrs.map((yr,i)=><g key={yr} transform={`translate(${PL+i*58},${H-6})`}><rect width={8} height={8} fill={YC[yr]||S.accent} rx={2}/><text x={12} y={8} fontSize={8} fill={S.muted}>{yr}</text></g>)}
      </svg>
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
            <KpiCard label="Total Bookings" current={kpis.currentBookings} previous={kpis.previousBookings} pct={kpis.percentBookings} color={S.accent} icon="📋"/>
            <KpiCard label="Total PAX" current={kpis.currentPax} previous={kpis.previousPax} pct={kpis.percentPax} color={S.success} icon="👥"/>
            <KpiCard label="Gross Revenue" fmt="eur" current={kpis.currentRevenue} previous={kpis.previousRevenue} pct={kpis.percentRevenue} color={S.warn} icon="💶"/>
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
                    <tr key={i} style={{borderBottom:`1px solid ${S.border}`,background:i%2===0?"transparent":"#f8faff"}}>
                      <td style={{padding:"9px 14px",fontWeight:600,color:S.text,whiteSpace:"nowrap"}}>
                        <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:YC[cy_]||S.accent,marginRight:8,verticalAlign:"middle"}}/>
                        {MONTHS[r.month-1]}-{cy_}
                      </td>
                      <td style={{padding:"9px 14px",textAlign:"right",color:S.text,fontWeight:600}}>{fmt(cur)}</td>
                      <td style={{padding:"9px 14px",textAlign:"right",color:S.muted}}>{fmt(prv)}</td>
                      <td style={{padding:"9px 14px",textAlign:"right",fontWeight:600,color:dc(dif)}}>
                        {dif!=null?(parseFloat(dif)>=0?"+":"")+fmt(Math.abs(dif)):"—"}
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
  const[sl,setSl]=useState({pendels:[],regions:[],statuses:[],feederLines:[]});
  const[busK,setBusK]=useState(null);
  const[pendel,setPendel]=useState([]);
  const[feeder,setFeeder]=useState([]);
  const[deck,setDeck]=useState([]);
  const[loading,setLoading]=useState(false);
  const[f,setF]=useState({dateFrom:`${cy}-01-01`,dateTo:`${cy}-12-31`,pendel:"",region:"",label:"",feederLine:"",weekday:"",status:"",_collapsed:false});

  useEffect(()=>{api("/api/dashboard/bus-slicers",{},token).then(d=>{if(d&&!d.error)setSl(d);}).catch(()=>{});},[token]);

  function applyLoad(){
    setLoading(true);
    const p={};
    if(f.dateFrom)p.dateFrom=f.dateFrom;if(f.dateTo)p.dateTo=f.dateTo;
    if(f.pendel)p.pendel=f.pendel;if(f.region)p.region=f.region;
    if(f.weekday)p.weekday=f.weekday;if(f.status)p.status=f.status;
    if(f.label)p.label=f.label;
    const fp={...p};if(f.feederLine)fp.feederLine=f.feederLine;
    Promise.all([
      api("/api/dashboard/bus-kpis",p,token).catch(()=>({})),
      api("/api/dashboard/pendel-overview",p,token).catch(()=>[]),
      api("/api/dashboard/feeder-overview",fp,token).catch(()=>[]),
      api("/api/dashboard/deck-class",p,token).catch(()=>[])
    ]).then(([k,pd,fd,dc])=>{setBusK(k||{});setPendel(Array.isArray(pd)?pd:[]);setFeeder(Array.isArray(fd)?fd:[]);setDeck(Array.isArray(dc)?dc:[]);}).finally(()=>setLoading(false));
  }
  useEffect(()=>{applyLoad();},[token]);

  function resetFilters(){setF({dateFrom:`${cy}-01-01`,dateTo:`${cy}-12-31`,pendel:"",region:"",label:"",feederLine:"",weekday:"",status:"DEF",_collapsed:false});}

  const fdates=[...new Set(feeder.map(r=>r.DepartureDate))].sort();
  const froutes={};
  feeder.forEach(r=>{const rk=`${r.RouteNo}||${r.RouteLabel}`;if(!froutes[rk])froutes[rk]={no:r.RouteNo,label:r.RouteLabel,stops:{},totals:{}};if(!froutes[rk].stops[r.StopName])froutes[rk].stops[r.StopName]={};froutes[rk].stops[r.StopName][r.DepartureDate]=(froutes[rk].stops[r.StopName][r.DepartureDate]||0)+(r.TotalPax||0);froutes[rk].totals[r.DepartureDate]=(froutes[rk].totals[r.DepartureDate]||0)+(r.TotalPax||0);});
  const rl=Object.values(froutes).sort((a,b)=>a.no-b.no);

  const TH={padding:"9px 12px",textAlign:"right",fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap",borderBottom:`1px solid ${S.border}`,background:"#f8faff"};
  const THL={...TH,textAlign:"left"};
  const TD={padding:"8px 12px",textAlign:"right",fontSize:12,color:S.text,whiteSpace:"nowrap",borderBottom:`1px solid ${S.border}`};
  const TDL={...TD,textAlign:"left"};
  const lbl=l=><label style={{fontSize:10,color:S.muted,display:"block",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>{l}</label>;
  const sel=(val,set,opts)=><select value={val} onChange={e=>set(e.target.value)} style={{width:"100%",background:S.bg,border:`1px solid ${S.border2}`,borderRadius:6,padding:"6px 8px",color:S.text,fontSize:11,outline:"none"}}><option value="">All</option>{opts.map(o=><option key={o} value={o}>{o}</option>)}</select>;
  const di=(val,set)=><input type="date" value={val} onChange={e=>set(e.target.value)} style={{width:"100%",background:S.bg,border:`1px solid ${S.border2}`,borderRadius:6,padding:"6px 8px",color:S.text,fontSize:11,boxSizing:"border-box",outline:"none"}}/>;
  const WEEKDAYS=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const deckTotals=deck.reduce((acc,r)=>{["Total","Total_Lower","Total_Upper","Total_NoDeck","Royal_Total","Royal_Lower","Royal_Upper","Royal_NoDeck","First_Total","First_Lower","First_Upper","First_NoDeck","Premium_Total","Premium_Lower","Premium_Upper","Premium_NoDeck","Comfort_Total","Comfort_Lower","Comfort_Upper","Comfort_NoDeck"].forEach(k=>{acc[k]=(acc[k]||0)+(r[k]||0);});return acc;},{});
  const pct=(a,b)=>b>0?`${((a/b)*100).toFixed(1)}%`:"—";

  return(
    <div style={{display:"flex",flexDirection:"row",height:"100%",overflow:"hidden",background:S.bg}}>
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{background:S.card,borderBottom:`1px solid ${S.border}`,padding:"10px 16px",display:"flex",gap:6,flexShrink:0,boxShadow:S.shadow}}>
          {[["pendel","🚌 Pendel Overview"],["deck","🪑 Deck & Class"],["feeder","🗺 Feeder Routes"]].map(([v,l])=>(
            <button key={v} onClick={()=>setView(v)} style={{padding:"6px 14px",borderRadius:7,fontSize:12,cursor:"pointer",border:`1.5px solid ${view===v?S.accent:S.border2}`,background:view===v?S.accent:"transparent",color:view===v?"#fff":S.textLight,fontWeight:600,transition:"all 0.15s"}}>{l}</button>
          ))}
          {loading&&<span style={{marginLeft:"auto",fontSize:11,color:S.muted,alignSelf:"center"}}>Loading…</span>}
        </div>
        <div style={{flex:1,overflowY:"auto",padding:18,display:"flex",flexDirection:"column",gap:14}}>
          {busK&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
              {[
                {l:"Total PAX",v:fmtN(busK.total_pax),c:S.accent,icon:"👥"},
                {l:"Royal Class",v:fmtN(busK.royal_pax),c:S.warn,icon:"⭐"},
                {l:"First Class",v:fmtN(busK.first_pax),c:S.success,icon:"✈"},
                {l:"Premium",v:fmtN(busK.premium_pax),c:S.purple,icon:"💎"},
                {l:"Comfort",v:fmtN(busK.comfort_pax),c:S.orange,icon:"🛋"},
                {l:"Lower Deck",v:fmtN(busK.lower_pax),c:S.accent2,icon:"⬇"},
                {l:"Upper Deck",v:fmtN(busK.upper_pax),c:S.success,icon:"⬆"},
                {l:"No Deck Pref",v:fmtN(busK.no_deck_pax),c:S.muted,icon:"○"},
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
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${S.border}`,fontSize:13,fontWeight:700,color:S.text}}>🚌 Pendel Overview</div>
              <div style={{overflowX:"auto",maxHeight:500,overflowY:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr>
                    <th style={THL}>Start Date</th><th style={THL}>End Date</th>
                    <th style={TH}>ORC</th><th style={TH}>OFC</th><th style={TH}>OPRE</th>
                    <th style={{...TH,color:S.accent}}>Out Total</th>
                    <th style={TH}>RRC</th><th style={TH}>RFC</th><th style={TH}>RPRE</th>
                    <th style={{...TH,color:S.accent}}>In Total</th>
                    <th style={{...TH,color:S.warn}}>Δ Royal</th><th style={{...TH,color:S.warn}}>Δ First</th>
                    <th style={{...TH,color:S.warn}}>Δ Premium</th><th style={{...TH,color:S.warn}}>Δ Total</th>
                  </tr></thead>
                  <tbody>
                    {pendel.length===0&&<tr><td colSpan={14} style={{padding:28,textAlign:"center",color:S.muted}}>No data</td></tr>}
                    {pendel.map((r,i)=>(
                      <tr key={i} style={{borderBottom:`1px solid ${S.border}`,background:i%2===0?"transparent":"#f8faff"}}>
                        <td style={{...TDL,color:S.accent,fontWeight:600}}>{r.StartDate}</td>
                        <td style={{...TDL,color:S.muted}}>{r.EndDate}</td>
                        <td style={TD}>{fmtN(r.ORC)}</td><td style={TD}>{fmtN(r.OFC)}</td><td style={TD}>{fmtN(r.OPRE)}</td>
                        <td style={{...TD,fontWeight:700,color:S.accent}}>{fmtN(r.Outbound_Total)}</td>
                        <td style={TD}>{fmtN(r.RRC)}</td><td style={TD}>{fmtN(r.RFC)}</td><td style={TD}>{fmtN(r.RPRE)}</td>
                        <td style={{...TD,fontWeight:700,color:S.accent}}>{fmtN(r.Inbound_Total)}</td>
                        <td style={{...TD,color:dc(r.Diff_Royal)}}>{r.Diff_Royal>=0?"+":""}{fmtN(r.Diff_Royal)}</td>
                        <td style={{...TD,color:dc(r.Diff_First)}}>{r.Diff_First>=0?"+":""}{fmtN(r.Diff_First)}</td>
                        <td style={{...TD,color:dc(r.Diff_Premium)}}>{r.Diff_Premium>=0?"+":""}{fmtN(r.Diff_Premium)}</td>
                        <td style={{...TD,fontWeight:700,color:dc(r.Diff_Total)}}>{r.Diff_Total>=0?"+":""}{fmtN(r.Diff_Total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          {view==="deck"&&(
            <Card p="0">
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${S.border}`,fontSize:13,fontWeight:700,color:S.text}}>🪑 Deck & Class Distribution</div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr>
                    <th style={THL}>Class</th>
                    <th style={TH}>Total PAX</th>
                    <th style={{...TH,color:S.accent}}>Lower</th>
                    <th style={{...TH,color:S.success}}>Upper</th>
                    <th style={{...TH,color:S.muted}}>No Deck</th>
                    <th style={{...TH,color:S.accent}}>Lower %</th>
                    <th style={{...TH,color:S.success}}>Upper %</th>
                  </tr></thead>
                  <tbody>
                    {[
                      {label:"TOTAL",total:"Total",lower:"Total_Lower",upper:"Total_Upper",noDeck:"Total_NoDeck",c:S.text},
                      {label:"Royal Class",total:"Royal_Total",lower:"Royal_Lower",upper:"Royal_Upper",noDeck:"Royal_NoDeck",c:S.warn},
                      {label:"First Class",total:"First_Total",lower:"First_Lower",upper:"First_Upper",noDeck:"First_NoDeck",c:S.success},
                      {label:"Premium Class",total:"Premium_Total",lower:"Premium_Lower",upper:"Premium_Upper",noDeck:"Premium_NoDeck",c:S.purple},
                      {label:"Comfort Class",total:"Comfort_Total",lower:"Comfort_Lower",upper:"Comfort_Upper",noDeck:"Comfort_NoDeck",c:S.orange},
                    ].map((row,i)=>(
                      <tr key={i} style={{borderBottom:`1px solid ${S.border}`,background:i===0?"#f8faff":i%2===0?"transparent":"#fafcff"}}>
                        <td style={{...TDL,fontWeight:i===0?800:600,color:row.c}}>{row.label}</td>
                        <td style={{...TD,fontWeight:700,color:row.c}}>{fmtN(deckTotals[row.total]||0)}</td>
                        <td style={{...TD,color:S.accent}}>{fmtN(deckTotals[row.lower]||0)}</td>
                        <td style={{...TD,color:S.success}}>{fmtN(deckTotals[row.upper]||0)}</td>
                        <td style={{...TD,color:S.muted}}>{fmtN(deckTotals[row.noDeck]||0)}</td>
                        <td style={{...TD,color:S.accent}}>{pct(deckTotals[row.lower]||0,deckTotals[row.total]||1)}</td>
                        <td style={{...TD,color:S.success}}>{pct(deckTotals[row.upper]||0,deckTotals[row.total]||1)}</td>
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
                          <th style={{...THL,borderRight:`2px solid ${S.border2}`}} rowSpan={2}>Date</th>
                          <th style={{...TH,textAlign:"center",borderRight:`1px solid ${S.border2}`,color:S.text}} colSpan={4}>Total</th>
                          <th style={{...TH,textAlign:"center",borderRight:`1px solid ${S.border2}`,color:S.warn}} colSpan={4}>Royal Class</th>
                          <th style={{...TH,textAlign:"center",borderRight:`1px solid ${S.border2}`,color:S.success}} colSpan={4}>First Class</th>
                          <th style={{...TH,textAlign:"center",borderRight:`1px solid ${S.border2}`,color:S.purple}} colSpan={4}>Premium Class</th>
                          <th style={{...TH,textAlign:"center",color:S.orange}} colSpan={4}>Comfort Class</th>
                        </tr>
                        <tr>
                          {["Total","Lower","Upper","No Deck","Total","Lower","Upper","No Deck","Total","Lower","Upper","No Deck","Total","Lower","Upper","No Deck","Total","Lower","Upper","No Deck"].map((h,i)=>(
                            <th key={i} style={{...TH,fontSize:9,borderRight:i===3||i===7||i===11||i===15?`1px solid ${S.border2}`:"none"}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {deck.map((r,i)=>(
                          <tr key={i} style={{borderBottom:`1px solid ${S.border}`,background:i%2===0?"transparent":"#f8faff"}}>
                            <td style={{...TDL,fontSize:11,fontWeight:600,borderRight:`2px solid ${S.border2}`}}>{r.dateDeparture}</td>
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
                            <td style={{...TD,fontWeight:600,color:S.orange}}>{fmtN(r.Comfort_Total)}</td>
                            <td style={TD}>{fmtN(r.Comfort_Lower)}</td>
                            <td style={TD}>{fmtN(r.Comfort_Upper)}</td>
                            <td style={TD}>{fmtN(r.Comfort_NoDeck)}</td>
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
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${S.border}`,fontSize:13,fontWeight:700,color:S.text}}>🗺 Feeder Routes</div>
              <div style={{overflowX:"auto",maxHeight:540,overflowY:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead style={{position:"sticky",top:0,background:"#f8faff",zIndex:5}}><tr>
                    <th style={THL}>Route / Stop</th>
                    {fdates.map(d=><th key={d} style={TH}>{d}</th>)}
                    <th style={{...TH,color:S.warn}}>Total</th>
                  </tr></thead>
                  <tbody>
                    {rl.length===0&&<tr><td colSpan={fdates.length+2} style={{padding:28,textAlign:"center",color:S.muted}}>No feeder data</td></tr>}
                    {rl.map((route,ri)=>(
                      <React.Fragment key={ri}>
                        <tr style={{background:S.accentLight}}>
                          <td style={{...TDL,fontWeight:700,color:S.accent}}>Route {route.no} — {route.label}</td>
                          {fdates.map(d=><td key={d} style={{...TD,fontWeight:700,color:S.accent}}>{fmtN(route.totals[d]||0)}</td>)}
                          <td style={{...TD,fontWeight:700,color:S.warn}}>{fmtN(Object.values(route.totals).reduce((a,b)=>a+b,0))}</td>
                        </tr>
                        {Object.entries(route.stops).map(([stop,dates],si)=>(
                          <tr key={si} style={{borderBottom:`1px solid ${S.border}`,background:si%2===0?"transparent":"#f8faff"}}>
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
      <div style={{width:f._collapsed?40:230,background:S.card,borderLeft:`1px solid ${S.border}`,display:"flex",flexDirection:"column",flexShrink:0,transition:"width 0.2s",boxShadow:"-2px 0 8px rgba(0,0,0,0.04)"}}>
        <div style={{padding:"12px 10px",borderBottom:`1px solid ${S.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}} onClick={()=>setF(p=>({...p,_collapsed:!p._collapsed}))}>
          {!f._collapsed&&<span style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.08em"}}>Filters</span>}
          <span style={{marginLeft:"auto",color:S.muted,fontSize:14,lineHeight:1}}>{f._collapsed?"›":"‹"}</span>
        </div>
        {!f._collapsed&&(
          <>
            <div style={{flex:1,padding:12,overflowY:"auto",display:"flex",flexDirection:"column",gap:9}}>
              <div>{lbl("Date From")}{di(f.dateFrom,v=>setF({...f,dateFrom:v}))}</div>
              <div>{lbl("Date To")}{di(f.dateTo,v=>setF({...f,dateTo:v}))}</div>
              <div>{lbl("Label")}
                <select value={f.label||""} onChange={e=>setF({...f,label:e.target.value})} style={{width:"100%",background:S.bg,border:`1px solid ${S.border2}`,borderRadius:6,padding:"6px 8px",color:S.text,fontSize:11,outline:"none"}}>
                  <option value="">All Labels</option>
                  <option value="STANDAARD">STANDAARD</option>
                  <option value="DEU">DEU</option>
                  <option value="ITB">ITB</option>
                </select>
              </div>
              {view==="pendel"?(
                <div style={{background:S.warnBg,border:`1px solid ${S.warn}33`,borderRadius:6,padding:"8px 10px",fontSize:10,color:S.warn,lineHeight:1.5}}>
                  ⚠ Pendel data comes from <code>BUStrips</code> (ETL pre-filtered).<br/>
                  Default: DEF only · VERV &amp; DEF-GEANNULEERD excluded.<br/>
                  Ask Samir to run:<br/>
                  <code style={{fontSize:9}}>EXEC etl.usp_LoadBUStrips;</code>
                </div>
              ):(
                <div>{lbl("Status")}
                  <select multiple value={f.status?f.status.split(",").filter(Boolean):[]} onChange={e=>setF({...f,status:[...e.target.selectedOptions].map(o=>o.value).join(",")})} style={{width:"100%",background:S.bg,border:`1px solid ${S.border2}`,borderRadius:6,padding:"4px 6px",color:S.text,fontSize:11,outline:"none",height:100}}>
                    <option value="DEF">✓ Confirmed</option>
                    <option value="TIJD">Timed</option>
                    <option value="VERV">Replaced</option>
                    <option value="DEF-GEANNULEERD">✗ Cancelled</option>
                    <option value="ACC AV NIET OK">Accom. Not OK</option>
                    <option value="CTRL">Control</option>
                    <option value="IN_AANVRAAG">Requested</option>
                  </select>
                  <div style={{fontSize:9,color:S.muted2,marginTop:3}}>Hold Ctrl to select multiple</div>
                </div>
              )}
              {view!=="feeder"&&<>
                <div>{lbl("Pendel")}{sel(f.pendel,v=>setF({...f,pendel:v}),sl.pendels)}</div>
                <div>{lbl("Region")}{sel(f.region,v=>setF({...f,region:v}),sl.regions)}</div>
                <div>{lbl("Weekday")}{sel(f.weekday,v=>setF({...f,weekday:v}),["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"])}</div>
              </>}
              {view==="feeder"&&<div>{lbl("Feeder Line")}{sel(f.feederLine,v=>setF({...f,feederLine:v}),sl.feederLines)}</div>}
            </div>
            <div style={{padding:12,borderTop:`1px solid ${S.border}`,display:"flex",flexDirection:"column",gap:8}}>
              <Btn onClick={applyLoad} variant="primary" size="sm" style={{width:"100%",justifyContent:"center"}}>Apply Filters</Btn>
              <Btn onClick={resetFilters} variant="secondary" size="sm" style={{width:"100%",justifyContent:"center"}}>Reset</Btn>
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
  const[f,setF]=useState({departureFrom:"",departureTo:"",status:"all",label:"",dataset:"",year:""});

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

  function buildSumParams(p,pg=1){const out={page:pg,limit:PAGE_SIZE};if(p.departureFrom)out.departureFrom=p.departureFrom;if(p.departureTo)out.departureTo=p.departureTo;if(p.status&&p.status!=="all")out.status=p.status;if(p.label)out.label=p.label;return out;}
  function buildElParams(p,pg=1){const out={page:pg,limit:PAGE_SIZE};if(p.departureFrom)out.departureFrom=p.departureFrom;if(p.departureTo)out.departureTo=p.departureTo;if(p.status&&p.status!=="all")out.status=p.status;if(p.label)out.label=p.label;if(p.dataset)out.dataset=p.dataset;if(p.year)out.year=p.year;return out;}

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

  function reset(){
    const e={departureFrom:"",departureTo:"",status:"all",label:"",dataset:"",year:""};
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

  const FilterBar=(
    <div style={{background:S.card,borderBottom:`1px solid ${S.border}`,padding:"12px 20px",flexShrink:0,boxShadow:S.shadow}}>
      <div style={{display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap"}}>
        {[["Departure From","departureFrom"],["Departure To","departureTo"]].map(([l,k])=>(
          <div key={k}>
            <label style={{fontSize:10,color:S.muted,display:"block",marginBottom:5,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>{l}</label>
            <input type="date" value={f[k]} onChange={e=>setF({...f,[k]:e.target.value})} style={selStyle}/>
          </div>
        ))}
        <div>
          <label style={{fontSize:10,color:S.muted,display:"block",marginBottom:5,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>Status</label>
          <select value={f.status} onChange={e=>setF({...f,status:e.target.value})} style={selStyle}>
            <option value="all">All Statuses</option>
            <option value="ok">✓ Confirmed (DEF)</option>
            <option value="cancelled">✗ Cancelled</option>
          </select>
        </div>
        <div>
          <label style={{fontSize:10,color:S.muted,display:"block",marginBottom:5,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>Label</label>
          <select value={f.label} onChange={e=>setF({...f,label:e.target.value})} style={selStyle}>
            <option value="">All Labels</option>
            <option value="Solmar">Solmar</option>
            <option value="Solmar DE">Solmar DE</option>
            <option value="Interbus">Interbus</option>
          </select>
        </div>
        {subTab==="elements"&&<>
          <div>
            <label style={{fontSize:10,color:S.muted,display:"block",marginBottom:5,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>Dataset</label>
            <select value={f.dataset} onChange={e=>setF({...f,dataset:e.target.value})} style={selStyle}>
              <option value="">All</option>
              <option value="Solmar">Solmar</option>
              <option value="Interbus">Interbus</option>
              <option value="Snowtravel">Snowtravel</option>
            </select>
          </div>
          <div>
            <label style={{fontSize:10,color:S.muted,display:"block",marginBottom:5,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>Year</label>
            <select value={f.year} onChange={e=>setF({...f,year:e.target.value})} style={selStyle}>
              <option value="">All Years</option>
              {[2022,2023,2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </>}
        <div style={{marginLeft:"auto",display:"flex",gap:6,alignSelf:"flex-end"}}>
          <Btn onClick={reset} variant="secondary" size="sm">Reset</Btn>
          <Btn onClick={applyFilters} variant="primary" size="sm">Apply Filters</Btn>
        </div>
      </div>
      <div style={{fontSize:10,color:S.muted2,marginTop:6}}>Click Apply to load · Large dataset may take a moment</div>
    </div>
  );

  const sumConfirmed=sumKpis?.confirmedCount??sumData.filter(r=>r.StatusCode==="DEF").length;
  const sumCancelled=sumKpis?.cancelledCount??sumData.filter(r=>r.StatusCode==="DEF-GEANNULEERD").length;
  const sumFiltered=sumData.filter(r=>!sumSearch||String(r.BookingID||"").includes(sumSearch)||(r.Label||"").toLowerCase().includes(sumSearch.toLowerCase())||(r.DepartureDate||"").includes(sumSearch));
  const elFiltered=elData.filter(r=>!elSearch||String(r.BookingId||"").includes(elSearch)||(r.MarginCategory||"").toLowerCase().includes(elSearch.toLowerCase())||(r.LabelName||"").toLowerCase().includes(elSearch.toLowerCase()));

  const SUM_TABLE_COLS=[
    ["Booking ID","left"],["Departure","left"],["Return","left"],["Status","left"],["Label","left"],
    ["PAX","right"],["Sales (€)","right"],["Purchase (€)","right"],["Obligation (€)","right"],
    ["Margin (€)","right"],["Margin %","right"],["Commission (€)","right"],["Margin+Comm (€)","right"],
  ];

  const EL_TABLE_COLS=[
    ["Booking ID","left"],["Category","left"],["Dataset","left"],["Status","left"],["Label","left"],
    ["Departure","left"],["Return","left"],["PAX","right"],["Elements","right"],
    ["Base Price (€)","right"],["Sold (€)","right"],["Paid (€)","right"],["Deposit (€)","right"],
    ["Commission (€)","right"],["Margin (€)","right"],["Margin%","right"],["Margin+Comm (€)","right"],
  ];

  const TH={padding:"9px 12px",textAlign:"right",fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap",borderBottom:`1px solid ${S.border}`,background:"#f8faff"};
  const THL={...TH,textAlign:"left"};
  const TD={padding:"8px 12px",textAlign:"right",fontSize:12,color:S.text,whiteSpace:"nowrap",borderBottom:`1px solid ${S.border}`};
  const TDL={...TD,textAlign:"left"};

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden",background:S.bg}}>
      <div style={{background:S.card,borderBottom:`1px solid ${S.border}`,padding:"10px 20px",display:"flex",gap:6,flexShrink:0,boxShadow:S.shadow}}>
        {[
          ["summary","📋 Booking Summary","solmar.MarginOverview"],
          ["elements","🔍 Element Breakdown","dbo.BookingElementMarginOverview"],
        ].map(([id,label,source])=>(
          <button key={id} onClick={()=>setSubTab(id)} style={{padding:"7px 16px",borderRadius:8,fontSize:12,cursor:"pointer",border:`1.5px solid ${subTab===id?S.accent:S.border2}`,background:subTab===id?S.accentLight:"transparent",color:subTab===id?S.accent:S.textLight,fontWeight:subTab===id?700:500,transition:"all 0.15s",display:"flex",flexDirection:"column",alignItems:"flex-start",gap:1}}>
            <span>{label}</span>
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
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
              {[
                {l:"Total Bookings",v:fmtN(sumKpis.totalBookings),c:S.accent,icon:"📋"},
                {l:"Confirmed",v:fmtN(sumConfirmed),c:S.success,icon:"✅"},
                {l:"Cancelled",v:fmtN(sumCancelled),c:S.danger,icon:"❌"},
                {l:"Total PAX",v:fmtN(sumKpis.totalPax),c:S.purple,icon:"👥"},
                {l:"Total Sales",v:fmtM(sumKpis.totalSales),c:S.success,icon:"💰"},
                {l:"Net Margin",v:fmtM(sumKpis.totalMargin),c:parseFloat(sumKpis.totalMargin||0)>=0?S.success:S.danger,icon:"📈"},
                {l:"Commission",v:fmtM(sumKpis.totalCommission),c:S.warn,icon:"🤝"},
                {l:"Obligations",v:fmtM(sumKpis.totalObligation),c:S.orange,icon:"📌"},
                {l:"Margin+Comm",v:fmtM(sumKpis.totalMarginIncludingCommission),c:parseFloat(sumKpis.totalMarginIncludingCommission||0)>=0?S.success:S.danger,icon:"💎"},
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
                        <tr key={i} style={{borderBottom:`1px solid ${S.border}`,background:i%2===0?"transparent":"#f8faff"}}>
                          <td style={{...TDL,color:S.accent,fontWeight:600,fontFamily:"monospace",fontSize:11}}>{r.BookingID||"—"}</td>
                          <td style={{...TDL,fontWeight:500}}>{r.DepartureDate||"—"}</td>
                          <td style={{...TDL,color:S.muted}}>{r.ReturnDate||"—"}</td>
                          <td style={TDL}><span style={{background:confirmed?S.successBg:S.dangerBg,color:confirmed?S.success:S.danger,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:700}}>{confirmed?"✓ DEF":"✗ GEANN."}</span></td>
                          <td style={{...TDL,color:S.textLight,fontSize:11}}>{r.Label||"—"}</td>
                          <td style={TD}>{fmtN(r.PAX)}</td>
                          <td style={TD}>{fmtEur(r.SalesBooking)}</td>
                          <td style={TD}>{fmtEur(r.PurchaseCalculation)}</td>
                          <td style={{...TD,color:S.warn,fontWeight:600}}>{fmtEur(r.PurchaseObligation)}</td>
                          <td style={{...TD,fontWeight:700,color:margin>=0?S.success:S.danger}}>{fmtEur(r.Margin)}</td>
                          <td style={{...TD,fontWeight:700,color:mPct!=null?(mPct>=0?S.success:S.danger):S.muted}}>{mPct!=null?`${mPct.toFixed(1)}%`:"—"}</td>
                          <td style={{...TD,color:S.muted}}>{fmtEur(r.Commission)}</td>
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
                {[
                  {l:"Total Bookings",v:fmtN(elKpis.totalBookings),c:S.accent,icon:"📋"},
                  {l:"Total PAX",v:fmtN(elKpis.totalPax),c:S.purple,icon:"👥"},
                  {l:"Total Sales",v:fmtM(elKpis.totalSales),c:S.success,icon:"💰"},
                  {l:"Net Margin",v:fmtM(elKpis.totalMargin),c:parseFloat(elKpis.totalMargin||0)>=0?S.success:S.danger,icon:"📈"},
                ].map(k=>(
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
                <Card>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:S.text}}>Margin by Category — Monthly</div>
                      <div style={{fontSize:11,color:S.muted,marginTop:1}}>Stacked by element category</div>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      {Object.entries(CAT_COLORS).map(([cat,c])=>(
                        <span key={cat} style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:S.muted}}>
                          <span style={{width:8,height:8,borderRadius:2,background:c,display:"inline-block"}}/>{cat}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ElementMarginChart trend={elTrend}/>
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
                            <tr key={i} style={{borderBottom:`1px solid ${S.border}`,background:i%2===0?"transparent":"#f8faff"}}>
                              <td style={{...TDL,color:S.accent,fontWeight:600,fontFamily:"monospace",fontSize:11}}>{r.BookingId||"—"}</td>
                              <td style={TDL}><span style={{background:`${cc}15`,color:cc,padding:"2px 8px",borderRadius:5,fontSize:11,fontWeight:700,display:"inline-flex",alignItems:"center",gap:3}}>{CAT_ICONS[r.MarginCategory]||"📦"} {r.MarginCategory||"—"}</span></td>
                              <td style={{...TDL,color:S.textLight,fontSize:11}}>{r.Dataset||"—"}</td>
                              <td style={TDL}><span style={{background:confirmed?S.successBg:S.dangerBg,color:confirmed?S.success:S.danger,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:700}}>{confirmed?"✓ DEF":"✗"}</span></td>
                              <td style={{...TDL,color:S.textLight,fontSize:11}}>{r.LabelName||"—"}</td>
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

function SettingsTab({token,session,onLogout}){
  const[tab,setTab]=useState("users");
  const[users,setUsers]=useState([]);
  const[loading,setLoading]=useState(false);
  const[userMsg,setUserMsg]=useState({text:"",type:""});
  const[showAdd,setShowAdd]=useState(false);
  const[newUser,setNewUser]=useState({username:"",password:"",role:"viewer",name:"",email:""});
  const[busy,setBusy]=useState(false);
  const[apiStatus,setApiStatus]=useState({});
  const[settings,setSettings]=useState({aiPrompt:"",emailAlerts:{enabled:false,revenueDropThreshold:10,bookingSpikethreshold:20,recipients:""}});
  const[settingsMsg,setSettingsMsg]=useState("");

  function loadUsers(){
    setLoading(true);
    api("/api/dashboard/users",{},token).then(d=>setUsers(Array.isArray(d)?d:[])).catch(()=>{}).finally(()=>setLoading(false));
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

  const roleColor=role=>role==="admin"?{bg:S.accentLight,c:S.accent}:{bg:"#f0fdf4",c:S.success};

  const API_ENDPOINTS=[
    {name:"Dashboard KPIs",path:"/api/dashboard/kpis"},
    {name:"Revenue by Year",path:"/api/dashboard/revenue-by-year"},
    {name:"Bus Slicers",path:"/api/dashboard/bus-slicers"},
    {name:"Margin Overview",path:"/api/dashboard/margin-overview"},
  ];

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden",background:S.bg}}>
      <div style={{background:S.card,borderBottom:`1px solid ${S.border}`,padding:"10px 20px",display:"flex",gap:8,flexShrink:0,boxShadow:S.shadow}}>
        {sTabBtn("users","User Management","👥")}
        {sTabBtn("api","API Status","🔌")}
        {sTabBtn("ai","AI Prompts","🤖")}
        {sTabBtn("alerts","Email Alerts","📧")}
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
                          <td style={{padding:"12px 16px",textAlign:"right"}}>
                            {isSelf?<span style={{fontSize:11,color:S.muted,fontStyle:"italic"}}>You</span>:<Btn onClick={()=>deleteUser(u.id,u.username)} variant="danger" size="sm">🗑 Delete</Btn>}
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

  useEffect(()=>{document.body.style.background=S.bg;},[]);

  if(!session?.token){
    return<Login onLogin={d=>{saveAuth(d.token,d);setSession(d);}}/>;
  }

  const token=session.token;
  const NAV=[
    {id:"overview",l:"Overview",ic:"⊞"},
    {id:"bus",l:"Bus Occupancy",ic:"🚌"},
    {id:"purchase",l:"Purchase Obligations",ic:"$"},
    {id:"settings",l:"Settings",ic:"⚙"},
  ];

  const navW=navCollapsed?60:220;

  return(
    <div style={{display:"flex",height:"100vh",background:S.bg,color:S.text,fontFamily:"system-ui,-apple-system,sans-serif",letterSpacing:"0.01em",overflow:"hidden"}}>
      <div style={{width:navW,background:S.side,borderRight:`1px solid ${S.border}`,display:"flex",flexDirection:"column",flexShrink:0,transition:"width 0.2s",boxShadow:"2px 0 8px rgba(0,0,0,0.04)"}}>
        <div style={{padding:"16px 14px",borderBottom:`1px solid ${S.border}`,display:"flex",alignItems:"center",gap:10,minHeight:64}}>
          <div style={{width:36,height:36,borderRadius:9,background:`linear-gradient(135deg,${S.accent},#3b82f6)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:"#fff",flexShrink:0,cursor:"pointer",boxShadow:"0 2px 8px rgba(26,86,219,0.3)"}} onClick={()=>setNavCollapsed(p=>!p)}>
            <img src="/assets/logo.png" alt="TTP" style={{width:28,height:28,objectFit:"contain"}} onError={e=>{e.target.style.display="none";e.target.parentNode.innerHTML='<span style="font-size:13px;font-weight:900;color:#fff">TTP</span>';}}/>
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
              <span style={{fontSize:15,flexShrink:0}}>{n.ic}</span>
              {!navCollapsed&&<span>{n.l}</span>}
            </div>
          ))}
        </div>
        <div style={{padding:"10px 12px",borderTop:`1px solid ${S.border}`,display:"flex",alignItems:"center",gap:9,justifyContent:navCollapsed?"center":"flex-start"}}>
          <div style={{width:28,height:28,borderRadius:"50%",background:`${S.accent}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:S.accent,flexShrink:0}}>{(session.username||"U")[0].toUpperCase()}</div>
          {!navCollapsed&&(
            <>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:S.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{session.username}</div>
                <div style={{fontSize:10,color:S.muted}}>{session.role||"viewer"}</div>
              </div>
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
          {tab==="settings"  &&<SettingsTab  token={token} session={session} onLogout={()=>{clearAuth();setSession(null);}}/>}
        </div>
      </div>
    </div>
  );
}