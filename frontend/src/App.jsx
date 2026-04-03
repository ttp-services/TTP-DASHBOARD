import { useState, useEffect, useCallback } from "react";

const BASE = (typeof import !== "undefined" && typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL)
  || "https://ttp-dashboard-api.azurewebsites.net";

const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DATASETS = ["Solmar","Interbus","Solmar DE","Snowtravel"];
const YEARS = [2022,2023,2024,2025,2026];
const YC = {2022:"#f59e0b",2023:"#10b981",2024:"#8b5cf6",2025:"#f97316",2026:"#3b82f6"};
const AUTH_KEY = "ttp_auth_v3";

function saveAuth(token,user){try{const d=JSON.stringify({token,user,ts:Date.now()});localStorage.setItem(AUTH_KEY,d);sessionStorage.setItem(AUTH_KEY,d);}catch{}}
function loadAuth(){try{const raw=localStorage.getItem(AUTH_KEY)||sessionStorage.getItem(AUTH_KEY);if(!raw)return null;const{token,user,ts}=JSON.parse(raw);if(Date.now()-ts>30*24*60*60*1000){clearAuth();return null;}return{token,...user};}catch{return null;}}
function clearAuth(){try{localStorage.removeItem(AUTH_KEY);sessionStorage.removeItem(AUTH_KEY);}catch{}}

async function api(path,params={},token){
  const qs=new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v])=>v!=null&&v!==""))).toString();
  const r=await fetch(`${BASE}${path}${qs?"?"+qs:""}`,{headers:{Authorization:`Bearer ${token}`}});
  if(!r.ok)throw new Error(`HTTP ${r.status}`);
  return r.json();
}

const fmtM=v=>{const n=parseFloat(v)||0;if(Math.abs(n)>=1e6)return`€${(n/1e6).toFixed(2)}M`;if(Math.abs(n)>=1e3)return`€${(n/1e3).toFixed(1)}K`;return`€${Math.round(n).toLocaleString("nl-BE")}`;};
const fmtN=v=>v==null?"—":Number(v).toLocaleString("nl-BE");
const fmtPct=v=>v==null?"—":`${v>=0?"+":""}${parseFloat(v).toFixed(1)}%`;
const fmtEur=v=>{const n=parseFloat(v)||0;return`€${n.toLocaleString("nl-BE",{minimumFractionDigits:2,maximumFractionDigits:2})}`;};
const dc=v=>v==null?"#94a3b8":v>=0?"#10b981":"#ef4444";

const S={
  bg:"#0b1120",side:"#111827",card:"#161f2e",border:"#1e3048",border2:"#243552",
  accent:"#3b82f6",accent2:"#60a5fa",text:"#f0f6ff",muted:"#64748b",muted2:"#475569",
  success:"#10b981",danger:"#ef4444",warn:"#f59e0b",purple:"#8b5cf6",orange:"#f97316"
};

// Fiscal year helpers
const cy=new Date().getFullYear();
const QUICK_DATES=[
  {l:"This Year",   from:`${cy}-01-01`,   to:`${cy}-12-31`},
  {l:"Last Year",   from:`${cy-1}-01-01`, to:`${cy-1}-12-31`},
  {l:"Last 3M",     from:new Date(Date.now()-90*864e5).toISOString().split("T")[0], to:new Date().toISOString().split("T")[0]},
  {l:"All Data",    from:"",              to:""},
  {l:`Solmar FY${cy}`,   from:`${cy-1}-12-01`, to:`${cy}-11-30`},
  {l:`Solmar FY${cy+1}`, from:`${cy}-12-01`,   to:`${cy+1}-11-30`},
  {l:`Snow FY${cy}/${cy+1}`, from:`${cy}-07-01`, to:`${cy+1}-06-30`},
];

// ── Bar chart ─────────────────────────────────────────────────────────────────
function BarChart({data,metric}){
  if(!data?.length)return<div style={{color:S.muted,textAlign:"center",padding:32,fontSize:12}}>No chart data available</div>;
  const sorted=[...data].sort((a,b)=>a.year!==b.year?a.year-b.year:a.month-b.month);
  const vals=sorted.map(r=>metric==="revenue"?r.revenue:metric==="pax"?r.pax:r.bookings);
  const maxV=Math.max(...vals,1);
  const W=880,H=200,PL=55,PR=10,PT=10,PB=50,CW=W-PL-PR,CH=H-PT-PB;
  const bw=Math.max(6,Math.floor(CW/sorted.length)-2);
  const yrs=[...new Set(sorted.map(r=>r.year))];
  return(
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}}>
      {[0,1,2,3,4].map(i=>{const y=PT+(CH/4)*i,v=maxV*(1-i/4);return<g key={i}><line x1={PL} x2={W-PR} y1={y} y2={y} stroke={S.border} strokeWidth={0.5}/><text x={PL-4} y={y+4} textAnchor="end" fontSize={9} fill={S.muted}>{metric==="revenue"?fmtM(v):fmtN(v)}</text></g>;})}
      {sorted.map((r,i)=>{const v=vals[i],bh=(v/maxV)*CH,x=PL+(i/sorted.length)*CW+(CW/sorted.length-bw)/2,y=PT+CH-bh,color=YC[r.year]||S.accent,lbl=`${MONTHS[r.month-1]}'${String(r.year).slice(2)}`;return<g key={i}><rect x={x} y={y} width={bw} height={bh} fill={color} rx={2} opacity={0.85}/><text x={x+bw/2} y={H-PB+13} textAnchor="middle" fontSize={8} fill={S.muted} transform={`rotate(-40,${x+bw/2},${H-PB+13})`}>{lbl}</text></g>;})}
      {yrs.map((yr,i)=><g key={yr} transform={`translate(${PL+i*70},${H-7})`}><rect width={10} height={10} fill={YC[yr]||S.accent} rx={2}/><text x={14} y={9} fontSize={9} fill={S.muted}>{yr}</text></g>)}
    </svg>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({label,current,previous,pct,prevLabel,fmt="num",color=S.accent}){
  const f=fmt==="eur"?fmtM:fmtN,arrow=pct==null?"":pct>=0?"↑":"↓";
  return(
    <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:12,padding:"16px 18px",display:"flex",flexDirection:"column",gap:6}}>
      <div style={{fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.08em"}}>{label}</div>
      <div style={{fontSize:26,fontWeight:800,color:S.text,letterSpacing:"-0.02em"}}>{f(current)}</div>
      <div style={{fontSize:11,color:S.muted,display:"flex",alignItems:"center",gap:6}}>
        <span>{prevLabel||"prev"}: {f(previous)}</span>
        {pct!=null&&<span style={{fontWeight:700,color:dc(pct)}}>{arrow} {Math.abs(pct).toFixed(1)}%</span>}
      </div>
    </div>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────
function Login({onLogin}){
  const[u,setU]=useState(""),[ pw,setPw]=useState(""),[ show,setShow]=useState(false),[err,setErr]=useState(""),[busy,setBusy]=useState(false);
  async function submit(e){e.preventDefault();setBusy(true);setErr("");try{const r=await fetch(`${BASE}/api/auth/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:u,password:pw})});const d=await r.json();if(!r.ok||!d.token){setErr(d.error||"Invalid credentials");return;}saveAuth(d.token,d.user||{username:u,role:"user"});onLogin({token:d.token,...(d.user||{username:u,role:"user"})});}catch{setErr("Connection failed");}finally{setBusy(false);}}
  const inp={width:"100%",background:S.bg,border:`1px solid ${S.border2}`,borderRadius:8,padding:"10px 12px",color:S.text,fontSize:13,boxSizing:"border-box"};
  return(
    <div style={{display:"flex",height:"100vh",background:S.bg,alignItems:"center",justifyContent:"center",fontFamily:"Inter,system-ui,sans-serif"}}>
      <div style={{width:380,background:S.side,border:`1px solid ${S.border}`,borderRadius:16,padding:40}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:52,height:52,background:S.accent,borderRadius:12,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:800,color:"#fff",marginBottom:12}}>TTP</div>
          <div style={{fontSize:20,fontWeight:700,color:S.text}}>TTP Analytics</div>
          <div style={{fontSize:12,color:S.muted,marginTop:4}}>Internal Dashboard · TTP Services</div>
        </div>
        <form onSubmit={submit} style={{display:"flex",flexDirection:"column",gap:14}}>
          <div><label style={{fontSize:11,color:S.muted,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.06em"}}>Username</label><input value={u} onChange={e=>setU(e.target.value)} autoFocus placeholder="Enter username" style={inp}/></div>
          <div><label style={{fontSize:11,color:S.muted,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.06em"}}>Password</label>
            <div style={{position:"relative"}}>
              <input value={pw} onChange={e=>setPw(e.target.value)} type={show?"text":"password"} placeholder="Enter password" style={{...inp,paddingRight:36}}/>
              <button type="button" onClick={()=>setShow(!show)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",padding:4,color:S.muted,fontSize:12}}>{show?"Hide":"Show"}</button>
            </div>
          </div>
          {err&&<div style={{background:"#450a0a",border:`1px solid ${S.danger}`,borderRadius:8,padding:"9px 12px",fontSize:12,color:"#fca5a5"}}>{err}</div>}
          <button type="submit" disabled={busy||!u||!pw} style={{background:S.accent,color:"#fff",border:"none",borderRadius:8,padding:"11px",fontSize:14,fontWeight:600,cursor:busy?"wait":"pointer",opacity:(!u||!pw)?0.5:1,marginTop:4}}>{busy?"Signing in…":"Sign In"}</button>
        </form>
      </div>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────
function OverviewTab({token}){
  const[f,setF]=useState({datasets:[],statuses:[],years:[],bookingFrom:"",bookingTo:"",depFrom:"",depTo:"",quickLabel:""});
  const[applied,setApplied]=useState({});
  const[kpis,setKpis]=useState(null);
  const[chart,setChart]=useState([]);
  const[ym,setYm]=useState([]);
  const[metric,setMetric]=useState("revenue");
  const[ymMetric,setYmMetric]=useState("bookings");
  const[loading,setLoading]=useState(false);
  const[chips,setChips]=useState([]);

  const toParams=ap=>{const p={};if(ap.datasets?.length)p.dataset=ap.datasets;if(ap.statuses?.length)p.status=ap.statuses;if(ap.years?.length)p.year=ap.years;if(ap.bookingFrom)p.bookingDateFrom=ap.bookingFrom;if(ap.bookingTo)p.bookingDateTo=ap.bookingTo;if(ap.depFrom)p.departureDateFrom=ap.depFrom;if(ap.depTo)p.departureDateTo=ap.depTo;return p;};

  const load=useCallback(ap=>{setLoading(true);const p=toParams(ap);Promise.all([api("/api/dashboard/kpis",p,token).catch(()=>null),api("/api/dashboard/revenue-by-year",p,token).catch(()=>[]),api("/api/dashboard/year-month-comparison",p,token).catch(()=>[])]).then(([k,c,y])=>{if(k)setKpis(k);setChart(Array.isArray(c)?c:[]);setYm(Array.isArray(y)?y:[]);}).finally(()=>setLoading(false));},[token]);

  useEffect(()=>{load({});},[load]);

  function apply(){const cs=[];if(f.datasets.length)f.datasets.forEach(d=>cs.push({l:`Dataset: ${d}`,k:`ds_${d}`}));if(f.statuses.length)f.statuses.forEach(s=>cs.push({l:`Status: ${s==="ok"?"Confirmed":"Cancelled"}`,k:`st_${s}`}));if(f.years.length)f.years.forEach(y=>cs.push({l:`Year: ${y}`,k:`yr_${y}`}));if(f.depFrom||f.depTo)cs.push({l:`Dep: ${f.depFrom||"…"} – ${f.depTo||"…"}`,k:"dep"});if(f.bookingFrom||f.bookingTo)cs.push({l:`Booked: ${f.bookingFrom||"…"} – ${f.bookingTo||"…"}`,k:"bk"});if(f.quickLabel)cs.push({l:f.quickLabel,k:"qd"});setChips(cs);setApplied({...f});load(f);}
  function reset(){const empty={datasets:[],statuses:[],years:[],bookingFrom:"",bookingTo:"",depFrom:"",depTo:"",quickLabel:""};setF(empty);setApplied({});setChips([]);load({});}
  function tog(arr,v){return arr.includes(v)?arr.filter(x=>x!==v):[...arr,v];}
  function quick(q){const nf={...f,depFrom:q.from,depTo:q.to,quickLabel:q.l};setF(nf);setApplied(nf);setChips([{l:q.l,k:"qd"}]);load(nf);}

  const prevLabel=kpis?.prevLabel||String(cy-1);
  const sortedYm=[...ym].sort((a,b)=>{if(applied.depFrom){const sy=+applied.depFrom.split("-")[0],sm=+applied.depFrom.split("-")[1];return(a.year-sy)*12+(a.month-sm)-(b.year-sy)*12-(b.month-sm);}return b.year!==a.year?b.year-a.year:b.month-a.month;});

  const btn=(active,onClick,children,clr=S.accent)=>(<button onClick={onClick} style={{padding:"4px 11px",borderRadius:20,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${active?clr:S.border2}`,background:active?`${clr}22`:"transparent",color:active?clr:S.muted}}>{children}</button>);
  const inp=(val,set,type="date")=>(<input type={type} value={val} onChange={e=>set(e.target.value)} style={{background:S.bg,border:`1px solid ${S.border2}`,borderRadius:6,padding:"4px 7px",color:S.text,fontSize:12}}/>);

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      {/* Filters */}
      <div style={{background:S.side,borderBottom:`1px solid ${S.border}`,padding:"12px 18px",flexShrink:0}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>Dataset</span>
          {DATASETS.map(d=>btn(f.datasets.includes(d),()=>setF({...f,datasets:tog(f.datasets,d)}),d,S.accent))}
          <span style={{marginLeft:4,fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>Status</span>
          {btn(f.statuses.includes("ok"),()=>setF({...f,statuses:tog(f.statuses,"ok")}),"Confirmed",S.success)}
          {btn(f.statuses.includes("cancelled"),()=>setF({...f,statuses:tog(f.statuses,"cancelled")}),"Cancelled",S.danger)}
          <span style={{marginLeft:4,fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>Year</span>
          {YEARS.map(y=>btn(f.years.includes(y),()=>setF({...f,years:tog(f.years,y)}),y,YC[y]))}
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>Departure</span>
          {inp(f.depFrom,v=>setF({...f,depFrom:v}))}
          <span style={{fontSize:11,color:S.muted}}>–</span>
          {inp(f.depTo,v=>setF({...f,depTo:v}))}
          <span style={{marginLeft:6,fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>Booked</span>
          {inp(f.bookingFrom,v=>setF({...f,bookingFrom:v}))}
          <span style={{fontSize:11,color:S.muted}}>–</span>
          {inp(f.bookingTo,v=>setF({...f,bookingTo:v}))}
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
          {QUICK_DATES.map(q=>(
            <button key={q.l} onClick={()=>quick(q)} style={{padding:"3px 9px",borderRadius:6,fontSize:11,cursor:"pointer",border:`1px solid ${f.quickLabel===q.l?S.orange:S.border2}`,background:f.quickLabel===q.l?"rgba(249,115,22,0.15)":"transparent",color:f.quickLabel===q.l?S.orange:S.muted}}>{q.l}</button>
          ))}
          <div style={{marginLeft:"auto",display:"flex",gap:6}}>
            <button onClick={reset} style={{padding:"5px 12px",background:"transparent",border:`1px solid ${S.border2}`,borderRadius:6,color:S.muted,fontSize:12,cursor:"pointer"}}>Reset</button>
            <button onClick={apply} style={{padding:"5px 16px",background:S.accent,border:"none",borderRadius:6,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>Apply Filters</button>
          </div>
        </div>
        {chips.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>{chips.map(c=><span key={c.k} style={{background:"rgba(59,130,246,0.15)",color:S.accent2,borderRadius:12,padding:"2px 9px",fontSize:11,fontWeight:600}}>{c.l}</span>)}</div>}
      </div>

      <div style={{flex:1,overflowY:"auto",padding:18}}>
        {loading&&<div style={{color:S.muted,textAlign:"center",padding:40}}>Loading…</div>}
        {kpis&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:18}}>
            <KpiCard label="Total Bookings" current={kpis.currentBookings} previous={kpis.previousBookings} pct={kpis.percentBookings} prevLabel={prevLabel} color={S.accent}/>
            <KpiCard label="Total PAX" current={kpis.currentPax} previous={kpis.previousPax} pct={kpis.percentPax} prevLabel={prevLabel} color={S.success}/>
            <KpiCard label="Gross Revenue" fmt="eur" current={kpis.currentRevenue} previous={kpis.previousRevenue} pct={kpis.percentRevenue} prevLabel={prevLabel} color={S.warn}/>
          </div>
        )}
        {/* Chart */}
        <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:12,padding:18,marginBottom:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:700,color:S.text}}>Revenue by Year</div>
            <div style={{display:"flex",gap:6}}>
              {["revenue","pax","bookings"].map(m=>(
                <button key={m} onClick={()=>setMetric(m)} style={{padding:"4px 12px",borderRadius:6,fontSize:11,cursor:"pointer",border:`1px solid ${metric===m?S.accent:S.border2}`,background:metric===m?S.accent:"transparent",color:metric===m?"#fff":S.muted,fontWeight:600}}>
                  {m==="pax"?"PAX":m.charAt(0).toUpperCase()+m.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <BarChart data={chart} metric={metric}/>
        </div>
        {/* YM Table */}
        <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:12,overflow:"hidden"}}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${S.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:13,fontWeight:700,color:S.text}}>Year-on-Year Comparison</div>
            <div style={{display:"flex",gap:6}}>
              {["bookings","pax","revenue"].map(m=>(
                <button key={m} onClick={()=>setYmMetric(m)} style={{padding:"4px 11px",borderRadius:6,fontSize:11,cursor:"pointer",border:`1px solid ${ymMetric===m?S.accent:S.border2}`,background:ymMetric===m?S.accent:"transparent",color:ymMetric===m?"#fff":S.muted,fontWeight:600}}>
                  {m==="pax"?"PAX":m.charAt(0).toUpperCase()+m.slice(1)}
                </button>
              ))}
              <button onClick={()=>{const csv=["Period,LastYear,Current,"+prevLabel+",Difference,Diff%",...sortedYm.map(r=>`${MONTHS_FULL[r.month-1]} ${r.year},${MONTHS_FULL[r.month-1]} ${r.year-1},${r.currentBookings},${r.previousBookings},${r.diffBookings},${r.diffPctBookings||""}`)].join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="yoy.csv";a.click();}} style={{padding:"4px 10px",background:"transparent",border:`1px solid ${S.border2}`,borderRadius:6,color:S.muted,fontSize:11,cursor:"pointer"}}>↓ CSV</button>
            </div>
          </div>
          <div style={{overflowX:"auto",maxHeight:400,overflowY:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:700}}>
              <thead>
                <tr style={{background:S.bg,position:"sticky",top:0,zIndex:5}}>
                  {["Period","Last Year","Current",prevLabel,"Difference","Diff %"].map((h,i)=>(
                    <th key={i} style={{padding:"9px 13px",textAlign:i===0?"left":"right",color:S.muted,fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap",borderBottom:`1px solid ${S.border}`}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedYm.map((r,i)=>{
                  const cur=ymMetric==="revenue"?r.currentRevenue:ymMetric==="pax"?r.currentPax:r.currentBookings;
                  const prv=ymMetric==="revenue"?r.previousRevenue:ymMetric==="pax"?r.previousPax:r.previousBookings;
                  const dif=ymMetric==="revenue"?r.diffRevenue:ymMetric==="pax"?r.diffPax:r.diffBookings;
                  const pct=ymMetric==="revenue"?r.diffPctRevenue:ymMetric==="pax"?r.diffPctPax:r.diffPctBookings;
                  const fmt=ymMetric==="revenue"?fmtM:fmtN;
                  return(
                    <tr key={i} style={{borderBottom:`1px solid ${S.border}`,background:i%2===0?"transparent":"rgba(255,255,255,0.012)"}}>
                      <td style={{padding:"8px 13px",fontWeight:600,color:S.text,whiteSpace:"nowrap"}}>
                        <span style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:YC[r.year]||S.accent,marginRight:8}}/>
                        {MONTHS_FULL[r.month-1]} {r.year}
                      </td>
                      <td style={{padding:"8px 13px",textAlign:"right",color:S.muted}}>{`${MONTHS_FULL[r.month-1]} ${r.year-1}`}</td>
                      <td style={{padding:"8px 13px",textAlign:"right",color:S.text,fontWeight:600}}>{fmt(cur)}</td>
                      <td style={{padding:"8px 13px",textAlign:"right",color:S.muted}}>{fmt(prv)}</td>
                      <td style={{padding:"8px 13px",textAlign:"right",color:dc(dif),fontWeight:600}}>{dif>=0?"+":""}{fmt(dif)}</td>
                      <td style={{padding:"8px 13px",textAlign:"right",color:dc(pct),fontWeight:700}}>{fmtPct(pct)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Bus Tab ───────────────────────────────────────────────────────────────────
function BusTab({token}){
  const[view,setView]=useState("pendel");
  const[sl,setSl]=useState({pendels:[],regions:[],destinations:[],feederLines:[]});
  const[busK,setBusK]=useState(null);
  const[pendel,setPendel]=useState([]);
  const[feeder,setFeeder]=useState([]);
  const[deck,setDeck]=useState([]);
  const[loading,setLoading]=useState(false);
  const[f,setF]=useState({dateFrom:`${cy}-01-01`,dateTo:`${cy}-12-31`,region:"",destination:"",feederLabel:"",feederLine:"",weekday:""});

  useEffect(()=>{api("/api/dashboard/bus-slicers",{},token).then(d=>{if(d&&!d.error)setSl(d);}).catch(()=>{});},[token]);

  const load=useCallback(()=>{
    setLoading(true);
    const p={};if(f.dateFrom)p.dateFrom=f.dateFrom;if(f.dateTo)p.dateTo=f.dateTo;if(f.region)p.region=f.region;if(f.destination)p.destination=f.destination;if(f.weekday)p.weekday=f.weekday;
    const fp={...p};if(f.feederLabel)fp.label=f.feederLabel;if(f.feederLine)fp.feederLine=f.feederLine;
    Promise.all([api("/api/dashboard/bus-kpis",p,token).catch(()=>({})),api("/api/dashboard/pendel-overview",p,token).catch(()=>[]),api("/api/dashboard/feeder-overview",fp,token).catch(()=>[]),api("/api/dashboard/deck-class",p,token).catch(()=>[])]).then(([k,pd,fd,dc])=>{setBusK(k);setPendel(Array.isArray(pd)?pd:[]);setFeeder(Array.isArray(fd)?fd:[]);setDeck(Array.isArray(dc)?dc:[]);}).finally(()=>setLoading(false));
  },[token,f]);

  useEffect(()=>{load();},[load]);

  const fdates=[...new Set(feeder.map(r=>r.DepartureDate))].sort();
  const froutes={};feeder.forEach(r=>{const rk=`${r.RouteNo}||${r.RouteLabel}`;if(!froutes[rk])froutes[rk]={no:r.RouteNo,label:r.RouteLabel,stops:{},totals:{}};if(!froutes[rk].stops[r.StopName])froutes[rk].stops[r.StopName]={};froutes[rk].stops[r.StopName][r.DepartureDate]=(froutes[rk].stops[r.StopName][r.DepartureDate]||0)+(r.TotalPax||0);froutes[rk].totals[r.DepartureDate]=(froutes[rk].totals[r.DepartureDate]||0)+(r.TotalPax||0);});
  const rl=Object.values(froutes).sort((a,b)=>a.no-b.no);
  const TH={padding:"8px 10px",textAlign:"right",fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap",borderBottom:`1px solid ${S.border}`,background:S.bg};
  const THL={...TH,textAlign:"left"};
  const TD={padding:"7px 10px",textAlign:"right",fontSize:12,color:S.text,whiteSpace:"nowrap",borderBottom:`1px solid ${S.border}`};
  const TDL={...TD,textAlign:"left"};

  const sel=(val,set,opts)=>(<select value={val} onChange={e=>set(e.target.value)} style={{width:"100%",background:S.bg,border:`1px solid ${S.border2}`,borderRadius:6,padding:"5px 7px",color:S.text,fontSize:11}}><option value="">{opts[0]}</option>{opts.slice(1).map(o=><option key={o} value={o}>{o}</option>)}</select>);
  const di=(val,set)=>(<input type="date" value={val} onChange={e=>set(e.target.value)} style={{width:"100%",background:S.bg,border:`1px solid ${S.border2}`,borderRadius:6,padding:"5px 7px",color:S.text,fontSize:11,boxSizing:"border-box"}}/>);
  const lbl=l=>(<label style={{fontSize:10,color:S.muted,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>{l}</label>);

  return(
    <div style={{display:"flex",height:"100%",overflow:"hidden"}}>
      {/* Filter sidebar */}
      <div style={{width:200,background:S.side,borderRight:`1px solid ${S.border}`,padding:12,overflowY:"auto",flexShrink:0}}>
        <div style={{fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Filters</div>
        <div style={{marginBottom:9}}>{lbl("Date From")}{di(f.dateFrom,v=>setF({...f,dateFrom:v}))}</div>
        <div style={{marginBottom:9}}>{lbl("Date To")}{di(f.dateTo,v=>setF({...f,dateTo:v}))}</div>
        {view==="feeder"&&<>
          <div style={{marginBottom:9}}>{lbl("Label")}{sel(f.feederLabel,v=>setF({...f,feederLabel:v}),["All Labels","Solmar","Interbus","Solmar DE"])}</div>
          <div style={{marginBottom:9}}>{lbl("Feeder Line")}{sel(f.feederLine,v=>setF({...f,feederLine:v}),["All Lines",...sl.feederLines])}</div>
        </>}
        {view!=="feeder"&&<>
          <div style={{marginBottom:9}}>{lbl("Region")}{sel(f.region,v=>setF({...f,region:v}),["All Regions",...sl.regions])}</div>
          <div style={{marginBottom:9}}>{lbl("Destination")}{sel(f.destination,v=>setF({...f,destination:v}),["All Destinations",...sl.destinations])}</div>
        </>}
        <div style={{marginBottom:12}}>{lbl("Weekday")}{sel(f.weekday,v=>setF({...f,weekday:v}),["All Days","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"])}</div>
        <button onClick={load} style={{width:"100%",padding:"7px",background:S.accent,border:"none",borderRadius:6,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>Apply</button>
        <button onClick={()=>setF({dateFrom:`${cy}-01-01`,dateTo:`${cy}-12-31`,region:"",destination:"",feederLabel:"",feederLine:"",weekday:""})} style={{width:"100%",padding:"6px",background:"transparent",border:`1px solid ${S.border2}`,borderRadius:6,color:S.muted,fontSize:12,cursor:"pointer",marginTop:5}}>Reset</button>
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {busK&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,padding:"10px 14px",borderBottom:`1px solid ${S.border}`,flexShrink:0}}>
            {[{l:"Total PAX",v:busK.total_pax,c:S.accent},{l:"Royal Class",v:busK.royal_pax,c:S.warn},{l:"First Class",v:busK.first_pax,c:S.success},{l:"Premium",v:busK.premium_pax,c:S.purple},{l:"Bookings",v:busK.total_bookings,c:S.orange}].map(k=>(
              <div key={k.l} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:9,padding:"9px 12px"}}>
                <div style={{fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>{k.l}</div>
                <div style={{fontSize:20,fontWeight:800,color:k.c,marginTop:3}}>{fmtN(k.v)}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{display:"flex",background:S.side,borderBottom:`1px solid ${S.border}`,flexShrink:0}}>
          {[{id:"pendel",l:"Pendel Overview"},{id:"feeder",l:"Feeder Overview"},{id:"deck",l:"Deck / Class"}].map(t=>(
            <button key={t.id} onClick={()=>setView(t.id)} style={{padding:"10px 16px",background:"none",border:"none",borderBottom:view===t.id?`2px solid ${S.accent}`:"2px solid transparent",color:view===t.id?S.accent2:S.muted,cursor:"pointer",fontSize:12,fontWeight:view===t.id?700:400}}>
              {t.l}
            </button>
          ))}
          {loading&&<span style={{padding:"12px 14px",fontSize:11,color:S.muted}}>Loading…</span>}
        </div>
        <div style={{flex:1,overflowX:"auto",overflowY:"auto"}}>
          {/* PENDEL */}
          {view==="pendel"&&(
            <table style={{borderCollapse:"collapse",fontSize:12,width:"100%",minWidth:900}}>
              <thead style={{position:"sticky",top:0,zIndex:5}}>
                <tr>{["Start","End","OUT Total","OUT RC","OUT FC","OUT PRE","IN Total","IN RC","IN FC","IN PRE","DIFF RC","DIFF FC","DIFF PRE","DIFF Total"].map((h,i)=><th key={i} style={i<2?THL:TH}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {pendel.length===0&&!loading&&<tr><td colSpan={14} style={{padding:40,textAlign:"center",color:S.muted}}>No data</td></tr>}
                {pendel.map((r,i)=>(
                  <tr key={i} style={{background:i%2===0?"transparent":"rgba(255,255,255,0.012)"}}>
                    <td style={{...TDL,fontWeight:600}}>{r.StartDate}</td><td style={TDL}>{r.EndDate}</td>
                    <td style={{...TD,fontWeight:700,color:S.accent2}}>{fmtN(r.Outbound_Total)}</td>
                    <td style={TD}>{fmtN(r.ORC)}</td><td style={TD}>{fmtN(r.OFC)}</td><td style={TD}>{fmtN(r.OPRE)}</td>
                    <td style={{...TD,fontWeight:700,color:S.success}}>{fmtN(r.Inbound_Total)}</td>
                    <td style={TD}>{fmtN(r.RRC)}</td><td style={TD}>{fmtN(r.RFC)}</td><td style={TD}>{fmtN(r.RPRE)}</td>
                    <td style={{...TD,color:dc(r.Diff_Royal)}}>{r.Diff_Royal}</td>
                    <td style={{...TD,color:dc(r.Diff_First)}}>{r.Diff_First}</td>
                    <td style={{...TD,color:dc(r.Diff_Premium)}}>{r.Diff_Premium}</td>
                    <td style={{...TD,fontWeight:700,color:dc(r.Diff_Total)}}>{r.Diff_Total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {/* FEEDER */}
          {view==="feeder"&&(
            <table style={{borderCollapse:"collapse",fontSize:12}}>
              <thead style={{position:"sticky",top:0,zIndex:5}}>
                <tr>
                  <th style={{...THL,minWidth:160,position:"sticky",left:0,zIndex:6,background:S.bg}}>Pick-up Point</th>
                  <th style={{...TH,minWidth:70}}>Total PAX</th>
                  {fdates.map(d=><th key={d} style={{...TH,minWidth:60}}><div style={{writingMode:"vertical-lr",transform:"rotate(180deg)",fontSize:10}}>{d}</div></th>)}
                </tr>
              </thead>
              <tbody>
                {rl.length===0&&!loading&&<tr><td colSpan={fdates.length+2} style={{padding:40,textAlign:"center",color:S.muted}}>No data</td></tr>}
                {rl.map(rt=>{const rt_total=fdates.reduce((s,d)=>s+(rt.totals[d]||0),0);return[
                  <tr key={`r${rt.no}`} style={{background:"rgba(59,130,246,0.08)"}}>
                    <td style={{...TDL,fontWeight:700,color:S.accent2,position:"sticky",left:0,background:"rgba(59,130,246,0.08)",zIndex:4}}>{rt.label||`Route ${rt.no}`}</td>
                    <td style={{...TD,fontWeight:700,color:S.accent2}}>{fmtN(rt_total)}</td>
                    {fdates.map(d=><td key={d} style={{...TD,fontWeight:700,color:rt.totals[d]?S.accent2:S.muted}}>{rt.totals[d]||"—"}</td>)}
                  </tr>,
                  ...Object.entries(rt.stops).map(([sn,dp])=>{const st=fdates.reduce((s,d)=>s+(dp[d]||0),0);return(
                    <tr key={`${rt.no}-${sn}`}><td style={{...TDL,paddingLeft:22,color:S.muted,position:"sticky",left:0,background:S.card,zIndex:4}}>· {sn}</td><td style={{...TD,color:S.muted}}>{fmtN(st)}</td>{fdates.map(d=><td key={d} style={{...TD,color:dp[d]?S.text:S.border2}}>{dp[d]||"—"}</td>)}</tr>
                  );})
                ];})}
              </tbody>
            </table>
          )}
          {/* DECK */}
          {view==="deck"&&(
            <table style={{borderCollapse:"collapse",fontSize:12,width:"100%",minWidth:860}}>
              <thead style={{position:"sticky",top:0,zIndex:5}}>
                <tr>
                  <th rowSpan={2} style={{...THL,verticalAlign:"middle",background:S.bg}}>Date</th>
                  <th colSpan={4} style={{...TH,textAlign:"center",borderBottom:`1px solid ${S.border2}`}}>TOTAL</th>
                  <th colSpan={4} style={{...TH,textAlign:"center",borderBottom:`1px solid ${S.border2}`,background:"rgba(245,158,11,0.06)",color:S.warn}}>ROYAL CLASS</th>
                  <th colSpan={4} style={{...TH,textAlign:"center",borderBottom:`1px solid ${S.border2}`,background:"rgba(16,185,129,0.06)",color:S.success}}>FIRST CLASS</th>
                  <th colSpan={4} style={{...TH,textAlign:"center",borderBottom:`1px solid ${S.border2}`,background:"rgba(139,92,246,0.06)",color:S.purple}}>PREMIUM</th>
                </tr>
                <tr>
                  {["Tot","Low","Up","No","Tot","Low","Up","No","Tot","Low","Up","No","Tot","Low","Up","No"].map((l,i)=><th key={i} style={{...TH,fontSize:9,background:i<4?S.bg:i<8?"rgba(245,158,11,0.04)":i<12?"rgba(16,185,129,0.04)":"rgba(139,92,246,0.04)"}}>{l}</th>)}
                </tr>
              </thead>
              <tbody>
                {deck.length===0&&!loading&&<tr><td colSpan={17} style={{padding:40,textAlign:"center",color:S.muted}}>No data</td></tr>}
                {deck.map((r,i)=>(
                  <tr key={i} style={{background:i%2===0?"transparent":"rgba(255,255,255,0.01)"}}>
                    <td style={{...TDL,fontWeight:600}}>{r.dateDeparture}</td>
                    <td style={{...TD,fontWeight:700}}>{fmtN(r.Total)}</td><td style={TD}>{fmtN(r.Total_Lower)}</td><td style={TD}>{fmtN(r.Total_Upper)}</td><td style={{...TD,color:S.muted}}>{fmtN(r.Total_NoDeck)}</td>
                    <td style={{...TD,color:S.warn,fontWeight:600}}>{fmtN(r.Royal_Total)}</td><td style={TD}>{fmtN(r.Royal_Lower)}</td><td style={TD}>{fmtN(r.Royal_Upper)}</td><td style={TD}>{fmtN(r.Royal_NoDeck)}</td>
                    <td style={{...TD,color:S.success,fontWeight:600}}>{fmtN(r.First_Total)}</td><td style={TD}>{fmtN(r.First_Lower)}</td><td style={TD}>{fmtN(r.First_Upper)}</td><td style={TD}>{fmtN(r.First_NoDeck)}</td>
                    <td style={{...TD,color:S.purple,fontWeight:600}}>{fmtN(r.Premium_Total)}</td><td style={TD}>{fmtN(r.Premium_Lower)}</td><td style={TD}>{fmtN(r.Premium_Upper)}</td><td style={TD}>{fmtN(r.Premium_NoDeck)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Purchase Obligations ──────────────────────────────────────────────────────
function PurchaseTab({token}){
  const[f,setF]=useState({departureFrom:"",departureTo:"",returnFrom:"",returnTo:"",status:"all",transportType:"all"});
  const[data,setData]=useState([]);
  const[kpis,setKpis]=useState(null);
  const[ttypes,setTtypes]=useState([]);
  const[loading,setLoading]=useState(false);
  const[err,setErr]=useState(null);
  const[search,setSearch]=useState("");

  function load(params){setLoading(true);setErr(null);api("/api/dashboard/margin-overview",params||f,token).then(d=>{setKpis(d.kpis);setData(d.data);setTtypes(d.transportTypes||[]);}).catch(e=>setErr(e.message)).finally(()=>setLoading(false));}
  useEffect(()=>{load({});},[token]);
  function reset(){setF({departureFrom:"",departureTo:"",returnFrom:"",returnTo:"",status:"all",transportType:"all"});setSearch("");load({});}

  const filtered=data.filter(r=>!search||String(r.BookingID).includes(search)||(r.TransportType||"").toLowerCase().includes(search.toLowerCase()));
  const inpS={background:S.bg,border:`1px solid ${S.border2}`,borderRadius:6,padding:"5px 8px",color:S.text,fontSize:12};

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      {/* Filters */}
      <div style={{background:S.side,borderBottom:`1px solid ${S.border}`,padding:"12px 18px",flexShrink:0}}>
        <div style={{display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap"}}>
          {[["Departure From","departureFrom"],["Departure To","departureTo"],["Return From","returnFrom"],["Return To","returnTo"]].map(([l,k])=>(
            <div key={k}><label style={{fontSize:10,color:S.muted,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>{l}</label><input type="date" value={f[k]} onChange={e=>setF({...f,[k]:e.target.value})} style={inpS}/></div>
          ))}
          <div><label style={{fontSize:10,color:S.muted,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>Status</label>
            <select value={f.status} onChange={e=>setF({...f,status:e.target.value})} style={inpS}>
              <option value="all">All</option><option value="ok">Confirmed (ok)</option><option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div><label style={{fontSize:10,color:S.muted,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>Transport</label>
            <select value={f.transportType} onChange={e=>setF({...f,transportType:e.target.value})} style={inpS}>
              <option value="all">All</option>{ttypes.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button onClick={reset} style={{padding:"6px 12px",background:"transparent",border:`1px solid ${S.border2}`,borderRadius:6,color:S.muted,fontSize:12,cursor:"pointer",alignSelf:"flex-end"}}>Reset</button>
          <button onClick={()=>load(f)} style={{padding:"6px 16px",background:S.accent,border:"none",borderRadius:6,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",alignSelf:"flex-end"}}>Apply</button>
        </div>
        <div style={{fontSize:10,color:S.muted2,marginTop:6}}>Filters only apply on click · data does not auto-refresh</div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:14}}>
        {err&&<div style={{background:"#450a0a",border:`1px solid ${S.danger}`,borderRadius:8,padding:"9px 12px",fontSize:12,color:"#fca5a5",marginBottom:12}}>Error: {err}</div>}
        {loading&&<div style={{color:S.muted,textAlign:"center",padding:40}}>Loading…</div>}
        {kpis&&(
          <>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:12}}>
              {[{l:"Total Bookings",v:fmtN(kpis.totalBookings),c:S.accent},{l:"Total Sales",v:fmtM(kpis.totalSales),c:S.success},{l:"Total Purchase",v:fmtM(kpis.totalPurchase),c:S.warn},{l:"Obligations",v:fmtM(kpis.totalObligation),c:S.orange}].map(k=>(
                <div key={k.l} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:11,padding:"13px 15px"}}><div style={{fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>{k.l}</div><div style={{fontSize:22,fontWeight:800,color:k.c,marginTop:4}}>{k.v}</div></div>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:14}}>
              {[{l:"Margin",v:fmtM(kpis.totalMargin),c:kpis.totalMargin>=0?S.success:S.danger},{l:"Commission",v:fmtM(kpis.totalCommission),c:S.purple},{l:"Margin incl. Commission",v:fmtM(kpis.totalMarginWithCommission),c:kpis.totalMarginWithCommission>=0?S.success:S.danger}].map(k=>(
                <div key={k.l} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:11,padding:"13px 15px"}}><div style={{fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>{k.l}</div><div style={{fontSize:22,fontWeight:800,color:k.c,marginTop:4}}>{k.v}</div></div>
              ))}
            </div>
          </>
        )}
        <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:12,overflow:"hidden"}}>
          <div style={{padding:"11px 14px",borderBottom:`1px solid ${S.border}`,display:"flex",gap:10,alignItems:"center"}}>
            <div style={{fontSize:13,fontWeight:700,color:S.text,flex:1}}>Purchase Obligations <span style={{fontSize:11,color:S.muted,fontWeight:400}}>({fmtN(filtered.length)} rows)</span></div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search booking ID…" style={{...inpS,width:180}}/>
            <button onClick={()=>{const cols=["BookingID","StatusCode","BookingDate","DepartureDate","ReturnDate","SalesBooking","PurchaseCalculation","PurchaseObligation","Margin","Commission","MarginIncludingCommission","TransportType"];const csv=[cols.join(","),...filtered.map(r=>cols.map(c=>String(r[c]??"")))].join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="purchase-obligations.csv";a.click();}} style={{padding:"5px 12px",background:"transparent",border:`1px solid ${S.border2}`,borderRadius:6,color:S.muted,fontSize:11,cursor:"pointer"}}>↓ CSV</button>
          </div>
          <div style={{maxHeight:460,overflowY:"auto",overflowX:"auto"}}>
            {!loading&&filtered.length===0?<div style={{padding:40,textAlign:"center",color:S.muted}}>No matching records</div>:(
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead style={{position:"sticky",top:0,zIndex:5,background:S.bg}}>
                  <tr>{[["Booking ID","left"],["Status","left"],["Booking Date","left"],["Departure","left"],["Return","left"],["Sales","right"],["Purchase","right"],["Obligation","right"],["Margin","right"],["Commission","right"],["Margin+Comm.","right"],["Transport","left"]].map(([h,a],i)=><th key={i} style={{padding:"8px 11px",textAlign:a,color:S.muted,fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap",borderBottom:`1px solid ${S.border}`}}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {filtered.map((r,i)=>(
                    <tr key={i} style={{borderBottom:`1px solid ${S.border}`,background:i%2===0?"transparent":"rgba(255,255,255,0.012)"}}>
                      <td style={{padding:"7px 11px",color:S.text,fontWeight:600,whiteSpace:"nowrap"}}>{r.BookingID}</td>
                      <td style={{padding:"7px 11px",whiteSpace:"nowrap"}}><span style={{background:r.StatusCode==="ok"?"rgba(16,185,129,0.15)":"rgba(239,68,68,0.12)",color:r.StatusCode==="ok"?S.success:S.danger,padding:"2px 8px",borderRadius:10,fontSize:11,fontWeight:600}}>{r.StatusCode==="ok"?"Confirmed":"Cancelled"}</span></td>
                      <td style={{padding:"7px 11px",color:S.muted,whiteSpace:"nowrap"}}>{r.BookingDate}</td>
                      <td style={{padding:"7px 11px",color:S.muted,whiteSpace:"nowrap"}}>{r.DepartureDate}</td>
                      <td style={{padding:"7px 11px",color:S.muted,whiteSpace:"nowrap"}}>{r.ReturnDate}</td>
                      <td style={{padding:"7px 11px",textAlign:"right",color:S.text,whiteSpace:"nowrap"}}>{fmtEur(r.SalesBooking)}</td>
                      <td style={{padding:"7px 11px",textAlign:"right",color:S.text,whiteSpace:"nowrap"}}>{fmtEur(r.PurchaseCalculation)}</td>
                      <td style={{padding:"7px 11px",textAlign:"right",color:S.warn,whiteSpace:"nowrap"}}>{fmtEur(r.PurchaseObligation)}</td>
                      <td style={{padding:"7px 11px",textAlign:"right",fontWeight:600,color:r.Margin>=0?S.success:S.danger,whiteSpace:"nowrap"}}>{fmtEur(r.Margin)}</td>
                      <td style={{padding:"7px 11px",textAlign:"right",color:S.purple,whiteSpace:"nowrap"}}>{fmtEur(r.Commission)}</td>
                      <td style={{padding:"7px 11px",textAlign:"right",fontWeight:600,color:r.MarginIncludingCommission>=0?S.success:S.danger,whiteSpace:"nowrap"}}>{fmtEur(r.MarginIncludingCommission)}</td>
                      <td style={{padding:"7px 11px",color:S.muted,whiteSpace:"nowrap"}}>{r.TransportType||"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Data Table ────────────────────────────────────────────────────────────────
function DataTab({token}){
  const[rows,setRows]=useState([]),[ total,setTotal]=useState(0),[page,setPage]=useState(1),[loading,setLoading]=useState(false);
  const[search,setSearch]=useState(""),[ dataset,setDataset]=useState(""),[ status,setStatus]=useState("");
  const[depFrom,setDepFrom]=useState(""),[ depTo,setDepTo]=useState(""),[ bkFrom,setBkFrom]=useState(""),[ bkTo,setBkTo]=useState("");
  const LIMIT=50;
  const load=useCallback((pg=1)=>{setLoading(true);const p={page:pg,limit:LIMIT};if(search)p.search=search;if(dataset)p.dataset=dataset;if(status)p.status=status;if(depFrom)p.depFrom=depFrom;if(depTo)p.depTo=depTo;if(bkFrom)p.bkFrom=bkFrom;if(bkTo)p.bkTo=bkTo;api("/api/dashboard/bookings-table",p,token).then(d=>{setRows(d.rows||[]);setTotal(d.total||0);}).catch(()=>{}).finally(()=>setLoading(false));},[token,search,dataset,status,depFrom,depTo,bkFrom,bkTo]);
  useEffect(()=>{load(page);},[load,page]);
  const totalPages=Math.ceil(total/LIMIT);
  const COLS=[{k:"BookingID",l:"Booking ID",w:100},{k:"Dataset",l:"Dataset",w:90},{k:"Status",l:"Status",w:80},{k:"Label",l:"Label",w:90},{k:"BookingDate",l:"Booked",w:90},{k:"DepartureDate",l:"Departure",w:90},{k:"ReturnDate",l:"Return",w:90},{k:"Duration",l:"Days",w:55},{k:"PAX",l:"PAX",w:50},{k:"Revenue",l:"Revenue",w:90},{k:"City",l:"City",w:90},{k:"Country",l:"Country",w:70},{k:"Destination",l:"Resort",w:110}];
  const inpS={background:S.bg,border:`1px solid ${S.border2}`,borderRadius:6,padding:"4px 7px",color:S.text,fontSize:12};
  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      <div style={{padding:"9px 14px",background:S.side,borderBottom:`1px solid ${S.border}`,display:"flex",gap:7,flexWrap:"wrap",alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search ID / Label…" style={{...inpS,width:150}}/>
        <select value={dataset} onChange={e=>setDataset(e.target.value)} style={inpS}><option value="">All Datasets</option>{DATASETS.map(d=><option key={d} value={d}>{d}</option>)}</select>
        <select value={status} onChange={e=>setStatus(e.target.value)} style={inpS}><option value="">All Status</option><option value="ok">Confirmed</option><option value="cancelled">Cancelled</option></select>
        <span style={{fontSize:11,color:S.muted}}>Dep</span>
        <input type="date" value={depFrom} onChange={e=>setDepFrom(e.target.value)} style={inpS}/>
        <span style={{fontSize:11,color:S.muted}}>–</span>
        <input type="date" value={depTo} onChange={e=>setDepTo(e.target.value)} style={inpS}/>
        <span style={{fontSize:11,color:S.muted}}>Booked</span>
        <input type="date" value={bkFrom} onChange={e=>setBkFrom(e.target.value)} style={inpS}/>
        <span style={{fontSize:11,color:S.muted}}>–</span>
        <input type="date" value={bkTo} onChange={e=>setBkTo(e.target.value)} style={inpS}/>
        <button onClick={()=>{setPage(1);load(1);}} style={{padding:"5px 12px",background:S.accent,border:"none",borderRadius:6,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>Apply</button>
        <button onClick={()=>{setSearch("");setDataset("");setStatus("");setDepFrom("");setDepTo("");setBkFrom("");setBkTo("");setPage(1);}} style={{padding:"5px 10px",background:"transparent",border:`1px solid ${S.border2}`,borderRadius:6,color:S.muted,fontSize:12,cursor:"pointer"}}>Reset</button>
        <div style={{marginLeft:"auto",display:"flex",gap:6}}>
          <button onClick={()=>window.open(`${BASE}/api/dashboard/export?dataset=${dataset}&status=${status}&depFrom=${depFrom}&depTo=${depTo}`,"_blank")} style={{padding:"5px 12px",background:S.success,border:"none",borderRadius:6,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>↓ CSV</button>
          <button onClick={()=>window.open(`${BASE}/api/dashboard/export-excel?dataset=${dataset}&status=${status}&depFrom=${depFrom}&depTo=${depTo}`,"_blank")} style={{padding:"5px 12px",background:"#166534",border:`1px solid ${S.success}`,borderRadius:6,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>↓ Excel</button>
          <button onClick={()=>window.print()} style={{padding:"5px 10px",background:"transparent",border:`1px solid ${S.border2}`,borderRadius:6,color:S.muted,fontSize:12,cursor:"pointer"}}>Print</button>
        </div>
      </div>
      <div style={{flex:1,overflowX:"auto",overflowY:"auto"}}>
        {loading?<div style={{color:S.muted,padding:40,textAlign:"center"}}>Loading…</div>:(
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead style={{position:"sticky",top:0,background:S.bg,zIndex:10}}>
              <tr>{COLS.map(c=><th key={c.k} style={{padding:"8px 10px",textAlign:"left",color:S.muted,fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap",minWidth:c.w,borderBottom:`1px solid ${S.border}`}}>{c.l}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row,i)=>(
                <tr key={i} style={{borderBottom:`1px solid ${S.border}`,background:i%2===0?"transparent":"rgba(255,255,255,0.012)"}}>
                  {COLS.map(c=>{let v=row[c.k],color=S.text;if(c.k==="Status")color=v==="ok"?S.success:S.danger;if(c.k==="Revenue"){v=v!=null?`€${Number(v).toLocaleString("nl-BE")}`:"—";color=S.warn;}return<td key={c.k} style={{padding:"7px 10px",color,whiteSpace:"nowrap"}}>{v??"-"}</td>;})}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div style={{padding:"7px 14px",background:S.side,borderTop:`1px solid ${S.border}`,display:"flex",alignItems:"center",gap:10,fontSize:12}}>
        <span style={{color:S.muted}}>{fmtN(total)} records</span>
        <div style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"center"}}>
          <button onClick={()=>{const p=Math.max(1,page-1);setPage(p);load(p);}} disabled={page<=1} style={{padding:"3px 11px",background:"transparent",border:`1px solid ${S.border2}`,borderRadius:6,color:page<=1?S.border:S.text,cursor:page<=1?"default":"pointer",fontSize:12}}>‹</button>
          <span style={{padding:"3px 8px",color:S.muted,fontSize:12}}>{page} / {totalPages||1}</span>
          <button onClick={()=>{const p=Math.min(totalPages,page+1);setPage(p);load(p);}} disabled={page>=totalPages} style={{padding:"3px 11px",background:"transparent",border:`1px solid ${S.border2}`,borderRadius:6,color:page>=totalPages?S.border:S.text,cursor:page>=totalPages?"default":"pointer",fontSize:12}}>›</button>
        </div>
      </div>
    </div>
  );
}

// ── App Shell ─────────────────────────────────────────────────────────────────
export default function App(){
  const[session,setSession]=useState(()=>loadAuth());
  const[tab,setTab]=useState("overview");
  if(!session?.token)return<Login onLogin={d=>{saveAuth(d.token,d);setSession(d);}}/>;
  const token=session.token;
  const NAV=[
    {id:"overview", l:"Overview",
     ic:<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>},
    {id:"bus",      l:"Bus Occupancy",
     ic:<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M8 6v6M3 16V8a4 4 0 014-4h10a4 4 0 014 4v8m0 0H3m18 0v4H3v-4"/><circle cx="7.5" cy="16.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/></svg>},
    {id:"purchase", l:"Purchase Obligations",
     ic:<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>},
    {id:"data",     l:"Data Table",
     ic:<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 3h18v4H3zM3 10h18v4H3zM3 17h18v4H3z"/></svg>},
  ];
  return(
    <div style={{display:"flex",height:"100vh",background:S.bg,color:S.text,fontFamily:"Inter,system-ui,sans-serif",overflow:"hidden"}}>
      {/* Sidebar */}
      <div style={{width:220,background:S.side,borderRight:`1px solid ${S.border}`,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"18px 14px 14px",borderBottom:`1px solid ${S.border}`,display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,background:S.accent,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff",flexShrink:0}}>TTP</div>
          <div><div style={{fontSize:13,fontWeight:700,color:S.text}}>TTP Analytics</div><div style={{fontSize:10,color:S.muted}}>Data Engine v2.0</div></div>
        </div>
        <div style={{flex:1,padding:"10px 8px",overflowY:"auto"}}>
          {NAV.map(n=>(
            <div key={n.id} onClick={()=>setTab(n.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 11px",cursor:"pointer",borderRadius:8,background:tab===n.id?"rgba(59,130,246,0.15)":"transparent",color:tab===n.id?S.accent2:S.muted,borderLeft:tab===n.id?`3px solid ${S.accent}`:"3px solid transparent",marginBottom:2,fontSize:13,fontWeight:tab===n.id?600:400}}>
              {n.ic}<span>{n.l}</span>
            </div>
          ))}
        </div>
        <div style={{padding:"11px 13px",borderTop:`1px solid ${S.border}`,display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:28,height:28,borderRadius:"50%",background:S.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#fff",flexShrink:0}}>{(session.username||session.name||"U")[0].toUpperCase()}</div>
          <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:600,color:S.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{session.username||session.name||"User"}</div><div style={{fontSize:10,color:S.muted}}>{session.role||"viewer"}</div></div>
          <button onClick={()=>{clearAuth();setSession(null);}} title="Sign out" style={{background:"none",border:"none",color:S.muted,cursor:"pointer",padding:4,flexShrink:0}}>
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          </button>
        </div>
      </div>
      {/* Content */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"11px 18px",borderBottom:`1px solid ${S.border}`,background:S.side,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div style={{fontSize:14,fontWeight:700,color:S.text}}>{NAV.find(n=>n.id===tab)?.l}</div>
          <div style={{fontSize:11,color:S.muted}}>{new Date().toLocaleDateString("nl-BE",{weekday:"short",year:"numeric",month:"short",day:"numeric"})} · <span style={{color:S.success}}>● Live</span></div>
        </div>
        <div style={{flex:1,overflow:"hidden"}}>
          {tab==="overview" &&<OverviewTab  token={token}/>}
          {tab==="bus"      &&<BusTab       token={token}/>}
          {tab==="purchase" &&<PurchaseTab  token={token}/>}
          {tab==="data"     &&<DataTab      token={token}/>}
        </div>
      </div>
    </div>
  );
}
