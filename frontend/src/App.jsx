import { useState, useEffect, useCallback } from "react";

const BASE = import.meta.env?.VITE_API_URL || "https://ttp-dashboard-api.azurewebsites.net";

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
  bg:"#0f172a",side:"#1a2540",card:"#1e293b",border:"#253352",border2:"#2e3f60",
  accent:"#3b82f6",accent2:"#60a5fa",text:"#f1f5f9",muted:"#64748b",muted2:"#475569",
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
  const[kpis,setKpis]=useState(null);
  const[chart,setChart]=useState([]);
  const[ym,setYm]=useState([]);
  const[metric,setMetric]=useState("revenue");
  const[ymMetric,setYmMetric]=useState("bookings");
  const[loading,setLoading]=useState(false);
  const[chips,setChips]=useState([]);
  const[applied,setApplied]=useState({});

  const toParams=ap=>{
    const p={};
    if(ap.datasets?.length)p.dataset=ap.datasets;
    if(ap.statuses?.length)p.status=ap.statuses;
    if(ap.years?.length)p.year=ap.years;
    if(ap.bookingFrom)p.bookingDateFrom=ap.bookingFrom;
    if(ap.bookingTo)p.bookingDateTo=ap.bookingTo;
    if(ap.depFrom)p.departureDateFrom=ap.depFrom;
    if(ap.depTo)p.departureDateTo=ap.depTo;
    return p;
  };

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

  // Load on mount only
  useEffect(()=>{loadData({});},[loadData]);

  function apply(){
    const cs=[];
    if(f.datasets.length)f.datasets.forEach(d=>cs.push({l:`Dataset: ${d}`,k:`ds_${d}`}));
    if(f.statuses.length)f.statuses.forEach(s=>cs.push({l:`Status: ${s==="ok"?"Confirmed":"Cancelled"}`,k:`st_${s}`}));
    if(f.years.length)f.years.forEach(y=>cs.push({l:`Year: ${y}`,k:`yr_${y}`}));
    if(f.depFrom||f.depTo)cs.push({l:`Dep: ${f.depFrom||"…"} – ${f.depTo||"…"}`,k:"dep"});
    if(f.bookingFrom||f.bookingTo)cs.push({l:`Booked: ${f.bookingFrom||"…"} – ${f.bookingTo||"…"}`,k:"bk"});
    if(f.quickLabel)cs.push({l:f.quickLabel,k:"qd"});
    setChips(cs);
    setApplied({...f});
    loadData(f);
  }

  function reset(){
    const empty={datasets:[],statuses:[],years:[],bookingFrom:"",bookingTo:"",depFrom:"",depTo:"",quickLabel:""};
    setF(empty);setApplied({});setChips([]);
    loadData({});
  }

  function tog(arr,v){return arr.includes(v)?arr.filter(x=>x!==v):[...arr,v];}
  function quick(q){setF(prev=>({...prev,depFrom:q.from,depTo:q.to,quickLabel:q.l}));}

  const prevLabel=kpis?.prevLabel||String(cy-1);
  const sortedYm=[...ym].sort((a,b)=>b.currentYear!==a.currentYear?b.currentYear-a.currentYear:b.month-a.month);

  const btn=(active,onClick,children,clr=S.accent)=>(
    <button onClick={onClick} style={{padding:"4px 11px",borderRadius:20,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${active?clr:S.border2}`,background:active?`${clr}22`:"transparent",color:active?clr:S.muted}}>
      {children}
    </button>
  );
  const inp=(val,set,type="date")=>(
    <input type={type} value={val} onChange={e=>set(e.target.value)} style={{background:S.bg,border:`1px solid ${S.border2}`,borderRadius:6,padding:"4px 7px",color:S.text,fontSize:12}}/>
  );

  const metricLabel={revenue:"Revenue",pax:"PAX",bookings:"Bookings"};

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
            <button onClick={apply} style={{padding:"5px 18px",background:S.accent,border:"none",borderRadius:6,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>Apply Filters</button>
          </div>
        </div>
        {chips.length>0&&(
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
            {chips.map(c=><span key={c.k} style={{background:"rgba(59,130,246,0.15)",color:S.accent2,borderRadius:12,padding:"2px 9px",fontSize:11,fontWeight:600}}>{c.l}</span>)}
          </div>
        )}
      </div>

      <div style={{flex:1,overflowY:"auto",padding:18}}>
        {loading&&<div style={{color:S.muted,textAlign:"center",padding:40,fontSize:13}}>Loading data…</div>}

        {/* KPI Cards */}
        {kpis&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:18}}>
            <KpiCard label="Total Bookings" current={kpis.currentBookings} previous={kpis.previousBookings} pct={kpis.percentBookings} prevLabel={prevLabel} color={S.accent}/>
            <KpiCard label="Total PAX" current={kpis.currentPax} previous={kpis.previousPax} pct={kpis.percentPax} prevLabel={prevLabel} color={S.success}/>
            <KpiCard label="Gross Revenue" fmt="eur" current={kpis.currentRevenue} previous={kpis.previousRevenue} pct={kpis.percentRevenue} prevLabel={prevLabel} color={S.warn}/>
          </div>
        )}

        {/* Interactive Bar Chart */}
        <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:12,padding:18,marginBottom:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:S.text}}>{metricLabel[metric]} by Month</div>
              <div style={{fontSize:11,color:S.muted,marginTop:2}}>Click a metric button to change the chart</div>
            </div>
            <div style={{display:"flex",gap:6}}>
              {["revenue","pax","bookings"].map(m=>(
                <button key={m} onClick={()=>setMetric(m)} style={{padding:"5px 14px",borderRadius:6,fontSize:12,cursor:"pointer",border:`1px solid ${metric===m?S.accent:S.border2}`,background:metric===m?S.accent:"transparent",color:metric===m?"#fff":S.muted,fontWeight:600,transition:"all 0.15s"}}>
                  {m==="pax"?"PAX":m.charAt(0).toUpperCase()+m.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <BarChart data={chart} metric={metric}/>
        </div>

        {/* YoY Table */}
        <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:12,overflow:"hidden"}}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${S.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:13,fontWeight:700,color:S.text}}>Year-on-Year Comparison
              <span style={{fontSize:11,color:S.muted,fontWeight:400,marginLeft:8}}>({sortedYm.length} months)</span>
            </div>
            <div style={{display:"flex",gap:6}}>
              {["bookings","pax","revenue"].map(m=>(
                <button key={m} onClick={()=>setYmMetric(m)} style={{padding:"4px 11px",borderRadius:6,fontSize:11,cursor:"pointer",border:`1px solid ${ymMetric===m?S.accent:S.border2}`,background:ymMetric===m?S.accent:"transparent",color:ymMetric===m?"#fff":S.muted,fontWeight:600}}>
                  {m==="pax"?"PAX":m.charAt(0).toUpperCase()+m.slice(1)}
                </button>
              ))}
              <button onClick={()=>{
                const cols=["Month","Current Year","Previous Year","Current Value","Previous Value","Difference","Diff %"];
                const rows=sortedYm.map(r=>{
                  const cur=ymMetric==="revenue"?r.currentRevenue:ymMetric==="pax"?r.currentPax:r.currentBookings;
                  const prv=ymMetric==="revenue"?r.previousRevenue:ymMetric==="pax"?r.previousPax:r.previousBookings;
                  const dif=ymMetric==="revenue"?r.diffRevenue:ymMetric==="pax"?r.diffPax:r.diffBookings;
                  const pct=ymMetric==="revenue"?r.diffPctRevenue:ymMetric==="pax"?r.diffPctPax:r.diffPctBookings;
                  return[`${MONTHS[r.month-1]}-${r.currentYear}`,r.currentYear,r.previousYear,cur,prv,dif,pct??''].join(",");
                });
                const csv=[cols.join(","),...rows].join("\n");
                const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="yoy.csv";a.click();
              }} style={{padding:"4px 10px",background:"transparent",border:`1px solid ${S.border2}`,borderRadius:6,color:S.muted,fontSize:11,cursor:"pointer"}}>↓ CSV</button>
            </div>
          </div>
          <div style={{overflowX:"auto",maxHeight:420,overflowY:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:750}}>
              <thead style={{position:"sticky",top:0,zIndex:5,background:S.bg}}>
                <tr>
                  {[["Month","left"],["Curr. Year","center"],["Prev. Year","center"],["Current","right"],["Previous","right"],["Difference","right"],["Diff %","right"]].map(([h,a],i)=>(
                    <th key={i} style={{padding:"9px 12px",textAlign:a,color:S.muted,fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap",borderBottom:`1px solid ${S.border}`}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedYm.length===0&&!loading&&(
                  <tr><td colSpan={7} style={{padding:32,textAlign:"center",color:S.muted}}>No data — apply filters and click Apply</td></tr>
                )}
                {sortedYm.map((r,i)=>{
                  const cur=ymMetric==="revenue"?r.currentRevenue:ymMetric==="pax"?r.currentPax:r.currentBookings;
                  const prv=ymMetric==="revenue"?r.previousRevenue:ymMetric==="pax"?r.previousPax:r.previousBookings;
                  const dif=ymMetric==="revenue"?r.diffRevenue:ymMetric==="pax"?r.diffPax:r.diffBookings;
                  const pct=ymMetric==="revenue"?r.diffPctRevenue:ymMetric==="pax"?r.diffPctPax:r.diffPctBookings;
                  const fmt=ymMetric==="revenue"?fmtM:fmtN;
                  const cy_=r.currentYear||r.year;
                  const py_=r.previousYear||(cy_-1);
                  return(
                    <tr key={i} style={{borderBottom:`1px solid ${S.border}`,background:i%2===0?"transparent":"rgba(255,255,255,0.018)"}}>
                      <td style={{padding:"8px 12px",fontWeight:600,color:S.text,whiteSpace:"nowrap"}}>
                        <span style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:YC[cy_]||S.accent,marginRight:7,verticalAlign:"middle"}}/>
                        {MONTHS[r.month-1]}-{cy_}
                      </td>
                      <td style={{padding:"8px 12px",textAlign:"center",color:S.accent2,fontWeight:600}}>{cy_}</td>
                      <td style={{padding:"8px 12px",textAlign:"center",color:S.muted}}>{py_}</td>
                      <td style={{padding:"8px 12px",textAlign:"right",color:S.text,fontWeight:600}}>{fmt(cur)}</td>
                      <td style={{padding:"8px 12px",textAlign:"right",color:S.muted}}>{fmt(prv)}</td>
                      <td style={{padding:"8px 12px",textAlign:"right",fontWeight:600,color:dc(dif)}}>{dif!=null?(parseFloat(dif)>=0?"+":"")+fmt(Math.abs(dif)):"—"}</td>
                      <td style={{padding:"8px 12px",textAlign:"right",fontWeight:700,color:dc(pct)}}>{pct!=null?fmtPct(pct):"—"}</td>
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

function BusTab({token}){
  const[view,setView]=useState("pendel");
  const[sl,setSl]=useState({pendels:[],regions:[],statuses:[],feederLines:[]});
  const[busK,setBusK]=useState(null);
  const[pendel,setPendel]=useState([]);
  const[feeder,setFeeder]=useState([]);
  const[deck,setDeck]=useState([]);
  const[loading,setLoading]=useState(false);
  // Pending filter state (not yet applied)
  const[f,setF]=useState({dateFrom:`${cy}-01-01`,dateTo:`${cy}-12-31`,pendel:"",region:"",feederLabel:"",feederLine:"",weekday:"",status:"DEF"});

  useEffect(()=>{
    api("/api/dashboard/bus-slicers",{},token)
      .then(d=>{if(d&&!d.error)setSl(d);})
      .catch(()=>{});
  },[token]);

  function applyLoad(){
    setLoading(true);
    const p={};
    if(f.dateFrom)p.dateFrom=f.dateFrom;
    if(f.dateTo)p.dateTo=f.dateTo;
    if(f.pendel)p.pendel=f.pendel;
    if(f.region)p.region=f.region;
    if(f.weekday)p.weekday=f.weekday;
    if(f.status)p.status=f.status;
    const fp={...p};
    if(f.feederLabel)fp.label=f.feederLabel;
    if(f.feederLine)fp.feederLine=f.feederLine;
    Promise.all([
      api("/api/dashboard/bus-kpis",p,token).catch(()=>({})),
      api("/api/dashboard/pendel-overview",p,token).catch(()=>[]),
      api("/api/dashboard/feeder-overview",fp,token).catch(()=>[]),
      api("/api/dashboard/deck-class",p,token).catch(()=>[])
    ]).then(([k,pd,fd,dc])=>{
      setBusK(k);
      setPendel(Array.isArray(pd)?pd:[]);
      setFeeder(Array.isArray(fd)?fd:[]);
      setDeck(Array.isArray(dc)?dc:[]);
    }).finally(()=>setLoading(false));
  }

  // Initial load
  useEffect(()=>{applyLoad();},[token]);

  function resetFilters(){
    const def={dateFrom:`${cy}-01-01`,dateTo:`${cy}-12-31`,pendel:"",region:"",feederLabel:"",feederLine:"",weekday:"",status:"DEF"};
    setF(def);
  }

  const fdates=[...new Set(feeder.map(r=>r.DepartureDate))].sort();
  const froutes={};
  feeder.forEach(r=>{
    const rk=`${r.RouteNo}||${r.RouteLabel}`;
    if(!froutes[rk])froutes[rk]={no:r.RouteNo,label:r.RouteLabel,stops:{},totals:{}};
    if(!froutes[rk].stops[r.StopName])froutes[rk].stops[r.StopName]={};
    froutes[rk].stops[r.StopName][r.DepartureDate]=(froutes[rk].stops[r.StopName][r.DepartureDate]||0)+(r.TotalPax||0);
    froutes[rk].totals[r.DepartureDate]=(froutes[rk].totals[r.DepartureDate]||0)+(r.TotalPax||0);
  });
  const rl=Object.values(froutes).sort((a,b)=>a.no-b.no);

  const TH={padding:"8px 10px",textAlign:"right",fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap",borderBottom:`1px solid ${S.border}`,background:S.bg};
  const THL={...TH,textAlign:"left"};
  const TD={padding:"7px 10px",textAlign:"right",fontSize:12,color:S.text,whiteSpace:"nowrap",borderBottom:`1px solid ${S.border}`};
  const TDL={...TD,textAlign:"left"};

  const lbl=l=>(<label style={{fontSize:10,color:S.muted,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>{l}</label>);
  const sel=(val,set,opts,labels)=>(
    <select value={val} onChange={e=>set(e.target.value)} style={{width:"100%",background:S.bg,border:`1px solid ${S.border2}`,borderRadius:6,padding:"5px 7px",color:S.text,fontSize:11}}>
      <option value="">{labels?labels[0]:"All"}</option>
      {opts.map((o,i)=><option key={o} value={o}>{labels?labels[i+1]:o}</option>)}
    </select>
  );
  const di=(val,set)=>(
    <input type="date" value={val} onChange={e=>set(e.target.value)} style={{width:"100%",background:S.bg,border:`1px solid ${S.border2}`,borderRadius:6,padding:"5px 7px",color:S.text,fontSize:11,boxSizing:"border-box"}}/>
  );

  const WEEKDAYS=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const BUS_STATUSES=["DEF","TIJD","VERV","DEF-GEANNULEERD","ACC AV NIET OK","CTRL","IN_AANVRAAG"];

  // Deck summary aggregation across all dates
  const deckTotals=deck.reduce((acc,r)=>{
    acc.Total=(acc.Total||0)+r.Total;
    acc.Total_Lower=(acc.Total_Lower||0)+r.Total_Lower;
    acc.Total_Upper=(acc.Total_Upper||0)+r.Total_Upper;
    acc.Total_NoDeck=(acc.Total_NoDeck||0)+r.Total_NoDeck;
    acc.Royal_Total=(acc.Royal_Total||0)+r.Royal_Total;
    acc.Royal_Lower=(acc.Royal_Lower||0)+r.Royal_Lower;
    acc.Royal_Upper=(acc.Royal_Upper||0)+r.Royal_Upper;
    acc.Royal_NoDeck=(acc.Royal_NoDeck||0)+r.Royal_NoDeck;
    acc.First_Total=(acc.First_Total||0)+r.First_Total;
    acc.First_Lower=(acc.First_Lower||0)+r.First_Lower;
    acc.First_Upper=(acc.First_Upper||0)+r.First_Upper;
    acc.First_NoDeck=(acc.First_NoDeck||0)+r.First_NoDeck;
    acc.Premium_Total=(acc.Premium_Total||0)+r.Premium_Total;
    acc.Premium_Lower=(acc.Premium_Lower||0)+r.Premium_Lower;
    acc.Premium_Upper=(acc.Premium_Upper||0)+r.Premium_Upper;
    acc.Premium_NoDeck=(acc.Premium_NoDeck||0)+r.Premium_NoDeck;
    acc.Comfort_Total=(acc.Comfort_Total||0)+r.Comfort_Total;
    acc.Comfort_Lower=(acc.Comfort_Lower||0)+r.Comfort_Lower;
    acc.Comfort_Upper=(acc.Comfort_Upper||0)+r.Comfort_Upper;
    acc.Comfort_NoDeck=(acc.Comfort_NoDeck||0)+r.Comfort_NoDeck;
    return acc;
  },{});

  const pct=(a,b)=>b>0?`${((a/b)*100).toFixed(1)}%`:"—";

  return(
    <div style={{display:"flex",height:"100%",overflow:"hidden"}}>
      {/* Filter sidebar */}
      <div style={{width:210,background:S.side,borderRight:`1px solid ${S.border}`,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{flex:1,padding:12,overflowY:"auto"}}>
          <div style={{fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Filters</div>
          <div style={{marginBottom:9}}>{lbl("Date From")}{di(f.dateFrom,v=>setF({...f,dateFrom:v}))}</div>
          <div style={{marginBottom:9}}>{lbl("Date To")}{di(f.dateTo,v=>setF({...f,dateTo:v}))}</div>
          <div style={{marginBottom:9}}>{lbl("Status")}
            <select value={f.status} onChange={e=>setF({...f,status:e.target.value})} style={{width:"100%",background:S.bg,border:`1px solid ${S.border2}`,borderRadius:6,padding:"5px 7px",color:S.text,fontSize:11}}>
              <option value="">All Statuses</option>
              <option value="all">All (incl. cancelled)</option>
              {(sl.statuses.length>0?sl.statuses:BUS_STATUSES).map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {view!=="feeder"&&<>
            <div style={{marginBottom:9}}>{lbl("Pendel")}
              {sel(f.pendel,v=>setF({...f,pendel:v}),sl.pendels)}
            </div>
            <div style={{marginBottom:9}}>{lbl("Region")}
              {sel(f.region,v=>setF({...f,region:v}),sl.regions)}
            </div>
            <div style={{marginBottom:9}}>{lbl("Weekday")}
              {sel(f.weekday,v=>setF({...f,weekday:v}),WEEKDAYS)}
            </div>
          </>}
          {view==="feeder"&&<>
            <div style={{marginBottom:9}}>{lbl("Label")}
              {sel(f.feederLabel,v=>setF({...f,feederLabel:v}),["Solmar","Interbus","Solmar DE"])}
            </div>
            <div style={{marginBottom:9}}>{lbl("Feeder Line")}
              {sel(f.feederLine,v=>setF({...f,feederLine:v}),sl.feederLines)}
            </div>
          </>}
        </div>
        <div style={{padding:12,borderTop:`1px solid ${S.border}`,display:"flex",flexDirection:"column",gap:6}}>
          <button onClick={applyLoad} style={{padding:"7px",background:S.accent,border:"none",borderRadius:6,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>Apply Filters</button>
          <button onClick={resetFilters} style={{padding:"6px",background:"transparent",border:`1px solid ${S.border2}`,borderRadius:6,color:S.muted,fontSize:12,cursor:"pointer"}}>Reset</button>
        </div>
      </div>

      {/* Main content */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {/* View tabs */}
        <div style={{background:S.side,borderBottom:`1px solid ${S.border}`,padding:"10px 16px",display:"flex",gap:6,flexShrink:0}}>
          {[["pendel","Pendel Overview"],["deck","Deck & Class"],["feeder","Feeder Routes"]].map(([v,l])=>(
            <button key={v} onClick={()=>setView(v)} style={{padding:"6px 14px",borderRadius:6,fontSize:12,cursor:"pointer",border:`1px solid ${view===v?S.accent:S.border2}`,background:view===v?S.accent:"transparent",color:view===v?"#fff":S.muted,fontWeight:600}}>{l}</button>
          ))}
          {loading&&<span style={{marginLeft:"auto",fontSize:11,color:S.muted,alignSelf:"center"}}>Loading…</span>}
        </div>

        <div style={{flex:1,overflowY:"auto",padding:16}}>
          {/* Bus KPI Cards */}
          {busK&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:14}}>
              {[
                {l:"Total PAX",v:fmtN(busK.total_pax),c:S.accent},
                {l:"Royal Class",v:fmtN(busK.royal_pax),c:"#f59e0b"},
                {l:"First Class",v:fmtN(busK.first_pax),c:S.success},
                {l:"Premium Class",v:fmtN(busK.premium_pax),c:S.purple},
                {l:"Comfort Class",v:fmtN(busK.comfort_pax),c:S.orange},
              ].map(k=>(
                <div key={k.l} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:10,padding:"11px 13px"}}>
                  <div style={{fontSize:9,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>{k.l}</div>
                  <div style={{fontSize:20,fontWeight:800,color:k.c,marginTop:4}}>{k.v}</div>
                </div>
              ))}
            </div>
          )}
          {busK&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
              {[
                {l:"Lower Deck (Onderdek)",v:fmtN(busK.lower_pax),c:S.accent},
                {l:"Upper Deck (Bovendek)",v:fmtN(busK.upper_pax),c:S.success},
                {l:"No Deck Preference",v:fmtN(busK.no_deck_pax),c:S.muted},
              ].map(k=>(
                <div key={k.l} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:10,padding:"11px 13px"}}>
                  <div style={{fontSize:9,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>{k.l}</div>
                  <div style={{fontSize:20,fontWeight:800,color:k.c,marginTop:4}}>{k.v}</div>
                </div>
              ))}
            </div>
          )}

          {/* PENDEL VIEW */}
          {view==="pendel"&&(
            <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"11px 14px",borderBottom:`1px solid ${S.border}`,fontSize:13,fontWeight:700,color:S.text}}>Pendel Overview</div>
              <div style={{overflowX:"auto",maxHeight:500,overflowY:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr>
                    <th style={THL}>Period</th>
                    <th style={TH}>ORC</th><th style={TH}>OFC</th><th style={TH}>OPRE</th><th style={TH}>Out Total</th>
                    <th style={TH}>RRC</th><th style={TH}>RFC</th><th style={TH}>RPRE</th><th style={TH}>In Total</th>
                    <th style={{...TH,color:S.warn}}>Δ Royal</th><th style={{...TH,color:S.warn}}>Δ First</th>
                    <th style={{...TH,color:S.warn}}>Δ Premium</th><th style={{...TH,color:S.warn}}>Δ Total</th>
                  </tr></thead>
                  <tbody>
                    {pendel.length===0&&<tr><td colSpan={13} style={{padding:24,textAlign:"center",color:S.muted}}>No data</td></tr>}
                    {pendel.map((r,i)=>(
                      <tr key={i} style={{borderBottom:`1px solid ${S.border}`,background:i%2===0?"transparent":"rgba(255,255,255,0.018)"}}>
                        <td style={TDL}>{r.StartDate} – {r.EndDate}</td>
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
            </div>
          )}

          {/* DECK & CLASS VIEW */}
          {view==="deck"&&(
            <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"11px 14px",borderBottom:`1px solid ${S.border}`,fontSize:13,fontWeight:700,color:S.text}}>Deck & Class Distribution</div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr>
                    <th style={THL}>Class</th>
                    <th style={TH}>Total PAX</th>
                    <th style={{...TH,color:S.accent}}>Lower (Onderdek)</th>
                    <th style={{...TH,color:S.success}}>Upper (Bovendek)</th>
                    <th style={{...TH,color:S.muted}}>No Deck</th>
                    <th style={{...TH,color:S.accent}}>Lower %</th>
                    <th style={{...TH,color:S.success}}>Upper %</th>
                  </tr></thead>
                  <tbody>
                    {[
                      {label:"TOTAL",total:"Total",lower:"Total_Lower",upper:"Total_Upper",noDeck:"Total_NoDeck",c:S.text},
                      {label:"Royal Class",total:"Royal_Total",lower:"Royal_Lower",upper:"Royal_Upper",noDeck:"Royal_NoDeck",c:"#f59e0b"},
                      {label:"First Class",total:"First_Total",lower:"First_Lower",upper:"First_Upper",noDeck:"First_NoDeck",c:S.success},
                      {label:"Premium Class",total:"Premium_Total",lower:"Premium_Lower",upper:"Premium_Upper",noDeck:"Premium_NoDeck",c:S.purple},
                      {label:"Comfort Class",total:"Comfort_Total",lower:"Comfort_Lower",upper:"Comfort_Upper",noDeck:"Comfort_NoDeck",c:S.orange},
                    ].map((row,i)=>(
                      <tr key={i} style={{borderBottom:`1px solid ${S.border}`,background:i===0?S.bg:i%2===0?"transparent":"rgba(255,255,255,0.018)"}}>
                        <td style={{...TDL,fontWeight:i===0?800:600,color:row.c,fontSize:i===0?13:12}}>{row.label}</td>
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
                  <div style={{padding:"10px 14px",borderTop:`1px solid ${S.border}`,borderBottom:`1px solid ${S.border}`,fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>By Departure Date</div>
                  <div style={{overflowX:"auto",maxHeight:350,overflowY:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                      <thead style={{position:"sticky",top:0,background:S.bg,zIndex:5}}><tr>
                        <th style={THL}>Date</th>
                        <th style={TH}>Total</th>
                        <th style={{...TH,color:S.accent}}>Lower</th>
                        <th style={{...TH,color:S.success}}>Upper</th>
                        <th style={{...TH,color:S.muted}}>NoDeck</th>
                        <th style={{...TH,color:"#f59e0b"}}>Royal</th>
                        <th style={{...TH,color:S.success}}>First</th>
                        <th style={{...TH,color:S.purple}}>Premium</th>
                        <th style={{...TH,color:S.orange}}>Comfort</th>
                      </tr></thead>
                      <tbody>
                        {deck.map((r,i)=>(
                          <tr key={i} style={{borderBottom:`1px solid ${S.border}`,background:i%2===0?"transparent":"rgba(255,255,255,0.018)"}}>
                            <td style={{...TDL,fontSize:11}}>{r.dateDeparture}</td>
                            <td style={{...TD,fontWeight:700,fontSize:11}}>{fmtN(r.Total)}</td>
                            <td style={{...TD,color:S.accent,fontSize:11}}>{fmtN(r.Total_Lower)}</td>
                            <td style={{...TD,color:S.success,fontSize:11}}>{fmtN(r.Total_Upper)}</td>
                            <td style={{...TD,color:S.muted,fontSize:11}}>{fmtN(r.Total_NoDeck)}</td>
                            <td style={{...TD,color:"#f59e0b",fontSize:11}}>{fmtN(r.Royal_Total)}</td>
                            <td style={{...TD,color:S.success,fontSize:11}}>{fmtN(r.First_Total)}</td>
                            <td style={{...TD,color:S.purple,fontSize:11}}>{fmtN(r.Premium_Total)}</td>
                            <td style={{...TD,color:S.orange,fontSize:11}}>{fmtN(r.Comfort_Total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* FEEDER VIEW */}
          {view==="feeder"&&(
            <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"11px 14px",borderBottom:`1px solid ${S.border}`,fontSize:13,fontWeight:700,color:S.text}}>Feeder Routes</div>
              <div style={{overflowX:"auto",maxHeight:540,overflowY:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead style={{position:"sticky",top:0,background:S.bg,zIndex:5}}><tr>
                    <th style={THL}>Route / Stop</th>
                    {fdates.map(d=><th key={d} style={TH}>{d}</th>)}
                    <th style={{...TH,color:S.warn}}>Total</th>
                  </tr></thead>
                  <tbody>
                    {rl.length===0&&<tr><td colSpan={fdates.length+2} style={{padding:24,textAlign:"center",color:S.muted}}>No feeder data</td></tr>}
                    {rl.map((route,ri)=>(
                      <>
                        <tr key={`r${ri}`} style={{background:"rgba(59,130,246,0.08)"}}>
                          <td style={{...TDL,fontWeight:700,color:S.accent2}}>Route {route.no} — {route.label}</td>
                          {fdates.map(d=><td key={d} style={{...TD,fontWeight:700,color:S.accent}}>{fmtN(route.totals[d]||0)}</td>)}
                          <td style={{...TD,fontWeight:700,color:S.warn}}>{fmtN(Object.values(route.totals).reduce((a,b)=>a+b,0))}</td>
                        </tr>
                        {Object.entries(route.stops).map(([stop,dates],si)=>(
                          <tr key={`s${ri}_${si}`} style={{borderBottom:`1px solid ${S.border}`,background:si%2===0?"transparent":"rgba(255,255,255,0.018)"}}>
                            <td style={{...TDL,paddingLeft:22,color:S.muted}}>{stop}</td>
                            {fdates.map(d=><td key={d} style={TD}>{dates[d]||"—"}</td>)}
                            <td style={{...TD,color:S.muted}}>{fmtN(Object.values(dates).reduce((a,b)=>a+b,0))}</td>
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ── Purchase Obligations ──────────────────────────────────────────────────────
function PurchaseTab({token}){
  const[f,setF]=useState({departureFrom:"",departureTo:"",returnFrom:"",returnTo:"",status:"all"});
  const[data,setData]=useState([]);
  const[kpis,setKpis]=useState(null);
  
  const[loading,setLoading]=useState(false);
  const[err,setErr]=useState(null);
  const[search,setSearch]=useState("");

  function load(params){setLoading(true);setErr(null);api("/api/dashboard/margin-overview",params||f,token).then(d=>{setKpis(d.kpis);setData(d.data);}).catch(e=>setErr(e.message)).finally(()=>setLoading(false));}
  useEffect(()=>{load({});},[token]);
  function reset(){setF({departureFrom:"",departureTo:"",returnFrom:"",returnTo:"",status:"all"});setSearch("");load({});}

  const filtered=data.filter(r=>!search||String(r.BookingID).includes(search)||String(r.StatusCode||"").toLowerCase().includes(search.toLowerCase())||(r.DepartureDate||"").includes(search));
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
              {[{l:"Total Bookings",v:fmtN(kpis.totalBookings),c:S.accent},{l:"Confirmed",v:fmtN(kpis.confirmedCount),c:S.success},{l:"Cancelled",v:fmtN(kpis.cancelledCount),c:S.danger},{l:"Total Sales",v:fmtM(kpis.totalSales),c:S.success},{l:"Purchase Calc",v:fmtM(kpis.totalPurchase),c:S.warn},{l:"Obligations",v:fmtM(kpis.totalObligation),c:S.orange},{l:"Net Margin",v:fmtM(kpis.totalMargin),c:parseFloat(kpis.totalMargin||0)>=0?S.success:S.danger}].map(k=>(
                <div key={k.l} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:11,padding:"13px 15px"}}><div style={{fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>{k.l}</div><div style={{fontSize:22,fontWeight:800,color:k.c,marginTop:4}}>{k.v}</div></div>
              ))}
            </div>

          </>
        )}
        <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:12,overflow:"hidden"}}>
          <div style={{padding:"11px 14px",borderBottom:`1px solid ${S.border}`,display:"flex",gap:10,alignItems:"center"}}>
            <div style={{fontSize:13,fontWeight:700,color:S.text,flex:1}}>Purchase Obligations <span style={{fontSize:11,color:S.muted,fontWeight:400}}>({fmtN(filtered.length)} rows)</span></div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search booking ID…" style={{...inpS,width:180}}/>
            <button onClick={()=>{const cols=["StatusCode","BookingDate","DepartureDate","ReturnDate","SalesBooking","PurchaseCalculation","PurchaseObligation","Margin"];const csv=[cols.join(","),...filtered.map(r=>cols.map(c=>String(r[c]??"")))].join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="purchase-obligations.csv";a.click();}} style={{padding:"5px 12px",background:"transparent",border:`1px solid ${S.border2}`,borderRadius:6,color:S.muted,fontSize:11,cursor:"pointer"}}>↓ CSV</button>
          </div>
          <div style={{maxHeight:460,overflowY:"auto",overflowX:"auto"}}>
            {!loading&&filtered.length===0?<div style={{padding:40,textAlign:"center",color:S.muted}}>No matching records</div>:(
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead style={{position:"sticky",top:0,zIndex:5,background:S.bg}}>
                  <tr>{[["Status","left"],["Booking Date","left"],["Departure","left"],["Return","left"],["Sales (€)","right"],["Purchase (€)","right"],["Obligation (€)","right"],["Margin (€)","right"]].map(([h,a],i)=><th key={i} style={{padding:"8px 11px",textAlign:a,color:S.muted,fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap",borderBottom:`1px solid ${S.border}`}}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {filtered.map((r,i)=>(
                    <tr key={i} style={{borderBottom:`1px solid ${S.border}`,background:i%2===0?"transparent":"rgba(255,255,255,0.025)"}}>
                      <td style={{padding:"7px 11px",whiteSpace:"nowrap"}}><span style={{background:r.StatusCode==="ok"?"rgba(16,185,129,0.18)":"rgba(239,68,68,0.15)",color:r.StatusCode==="ok"?S.success:S.danger,padding:"3px 10px",borderRadius:10,fontSize:11,fontWeight:700}}>{r.StatusCode==="ok"?"Confirmed":"Cancelled"}</span></td>
                      <td style={{padding:"7px 11px",color:S.muted,whiteSpace:"nowrap"}}>{r.BookingDate}</td>
                      <td style={{padding:"7px 11px",color:S.text,fontWeight:500,whiteSpace:"nowrap"}}>{r.DepartureDate}</td>
                      <td style={{padding:"7px 11px",color:S.muted,whiteSpace:"nowrap"}}>{r.ReturnDate}</td>
                      <td style={{padding:"7px 11px",textAlign:"right",color:S.text,whiteSpace:"nowrap"}}>{fmtEur(r.SalesBooking)}</td>
                      <td style={{padding:"7px 11px",textAlign:"right",color:S.text,whiteSpace:"nowrap"}}>{fmtEur(r.PurchaseCalculation)}</td>
                      <td style={{padding:"7px 11px",textAlign:"right",color:S.warn,fontWeight:600,whiteSpace:"nowrap"}}>{fmtEur(r.PurchaseObligation)}</td>
                      <td style={{padding:"7px 11px",textAlign:"right",fontWeight:700,color:parseFloat(r.Margin||0)>=0?S.success:S.danger,whiteSpace:"nowrap"}}>{fmtEur(r.Margin)}</td>
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

// ── Settings ──────────────────────────────────────────────────────────────────
function SettingsTab({token, session, onLogout, theme, setTheme}){
  const[tab,setTab]=useState("users");
  const[users,setUsers]=useState([]);
  const[newUser,setNewUser]=useState({username:"",password:"",role:"viewer"});
  const[editUser,setEditUser]=useState(null);
  const[userMsg,setUserMsg]=useState("");
  const[settings,setSettings]=useState({aiPrompt:"",emailAlerts:{enabled:false,revenueDropThreshold:10,bookingSpikethreshold:20,recipients:""}});
  const[apiStatus,setApiStatus]=useState({});
  const[settingsMsg,setSettingsMsg]=useState("");
  const[busy,setBusy]=useState(false);

  useEffect(()=>{
    // Load users
    api("/api/dashboard/users",{},token).then(setUsers).catch(()=>{});
    // Load settings
    api("/api/dashboard/settings",{},token).then(d=>{if(d&&!d.error)setSettings(d);}).catch(()=>{});
    // Check API endpoints
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
        .catch(()=>setApiStatus(s=>({...s,[ep.name]:{ok:false,ms:Date.now()-start,status:"error"}})));
    });
  },[token]);

  async function addUser(e){
    e.preventDefault();setBusy(true);setUserMsg("");
    try{
      const r=await fetch(`${BASE}/api/dashboard/users`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify(newUser)});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error);
      setUsers([...users,d]);setNewUser({username:"",password:"",role:"viewer"});setUserMsg("User created.");
    }catch(e){setUserMsg("Error: "+e.message);}finally{setBusy(false);}
  }

  async function deleteUser(id){
    if(!confirm("Delete this user?"))return;
    try{
      await fetch(`${BASE}/api/dashboard/users/${id}`,{method:"DELETE",headers:{Authorization:`Bearer ${token}`}});
      setUsers(users.filter(u=>u.id!==id));
    }catch(e){setUserMsg("Error: "+e.message);}
  }

  async function updateUserRole(id,role){
    try{
      const r=await fetch(`${BASE}/api/dashboard/users/${id}`,{method:"PUT",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({role})});
      const d=await r.json();
      setUsers(users.map(u=>u.id===id?d:u));
    }catch(e){setUserMsg("Error: "+e.message);}
  }

  async function saveSettings(){
    setBusy(true);setSettingsMsg("");
    try{
      await fetch(`${BASE}/api/dashboard/settings`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify(settings)});
      setSettingsMsg("Settings saved.");
    }catch(e){setSettingsMsg("Error: "+e.message);}finally{setBusy(false);}
  }

  function testApi(name,path){
    const start=Date.now();
    setApiStatus(s=>({...s,[name]:{ok:null,ms:0,status:"testing…"}}));
    fetch(`${BASE}${path}`,{headers:{Authorization:`Bearer ${token}`}})
      .then(r=>setApiStatus(s=>({...s,[name]:{ok:r.ok,ms:Date.now()-start,status:r.status}})))
      .catch(()=>setApiStatus(s=>({...s,[name]:{ok:false,ms:Date.now()-start,status:"error"}})));
  }

  const inp=(val,onChange,type="text",ph="")=>(
    <input type={type} value={val} onChange={e=>onChange(e.target.value)} placeholder={ph}
      style={{background:S.bg,border:`1px solid ${S.border2}`,borderRadius:7,padding:"8px 11px",color:S.text,fontSize:13,width:"100%",boxSizing:"border-box"}}/>
  );
  const slab=l=>(<div style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>{l}</div>);
  const card=(children,style={})=>(
    <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:12,padding:"18px 20px",marginBottom:16,...style}}>{children}</div>
  );
  const sTabBtn=(id,label)=>(
    <button onClick={()=>setTab(id)} style={{padding:"8px 16px",borderRadius:8,fontSize:12,cursor:"pointer",border:`1px solid ${tab===id?S.accent:S.border2}`,background:tab===id?"rgba(59,130,246,0.15)":"transparent",color:tab===id?S.accent2:S.muted,fontWeight:600}}>
      {label}
    </button>
  );

  const API_ENDPOINTS=[
    {name:"Dashboard KPIs",path:"/api/dashboard/kpis"},
    {name:"Revenue by Year",path:"/api/dashboard/revenue-by-year"},
    {name:"Bus Slicers",path:"/api/dashboard/bus-slicers"},
    {name:"Margin Overview",path:"/api/dashboard/margin-overview"},
  ];

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      {/* Settings nav */}
      <div style={{background:S.side,borderBottom:`1px solid ${S.border}`,padding:"10px 18px",display:"flex",gap:8,flexShrink:0,flexWrap:"wrap"}}>
        {sTabBtn("users","User Management")}
        {sTabBtn("theme","Theme")}
        {sTabBtn("api","API Status")}
        {sTabBtn("ai","AI Prompts")}
        {sTabBtn("alerts","Email Alerts")}
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"18px 24px",maxWidth:720}}>

        {/* USER MANAGEMENT */}
        {tab==="users"&&(<>
          <div style={{fontSize:15,fontWeight:700,color:S.text,marginBottom:14}}>User Management</div>
          {userMsg&&<div style={{background:userMsg.startsWith("Error")?S.danger+"22":"rgba(16,185,129,0.15)",border:`1px solid ${userMsg.startsWith("Error")?S.danger:S.success}`,borderRadius:8,padding:"8px 12px",fontSize:12,color:userMsg.startsWith("Error")?S.danger:S.success,marginBottom:12}}>{userMsg}</div>}
          {card(<>
            <div style={{fontSize:13,fontWeight:700,color:S.text,marginBottom:12}}>Current Users</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {users.map(u=>(
                <div key={u.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:S.bg,borderRadius:8,border:`1px solid ${S.border}`}}>
                  <div style={{width:32,height:32,borderRadius:"50%",background:u.role==="admin"?S.accent:S.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#fff",flexShrink:0}}>{(u.username||"?")[0].toUpperCase()}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,color:S.text}}>{u.username}</div>
                    <div style={{fontSize:11,color:S.muted}}>ID: {u.id}</div>
                  </div>
                  <select value={u.role} onChange={e=>updateUserRole(u.id,e.target.value)} style={{background:S.bg,border:`1px solid ${S.border2}`,borderRadius:6,padding:"4px 8px",color:S.text,fontSize:12}}>
                    <option value="viewer">Viewer</option>
                    <option value="admin">Admin</option>
                  </select>
                  <span style={{background:u.role==="admin"?"rgba(59,130,246,0.18)":"rgba(100,116,139,0.15)",color:u.role==="admin"?S.accent2:S.muted,padding:"3px 9px",borderRadius:8,fontSize:11,fontWeight:700}}>{u.role}</span>
                  {u.id!==session?.id&&u.username!==session?.username&&(
                    <button onClick={()=>deleteUser(u.id)} style={{background:"rgba(239,68,68,0.1)",border:`1px solid rgba(239,68,68,0.3)`,borderRadius:6,padding:"4px 10px",color:S.danger,fontSize:11,cursor:"pointer",fontWeight:600}}>Delete</button>
                  )}
                </div>
              ))}
              {users.length===0&&<div style={{color:S.muted,fontSize:12,textAlign:"center",padding:20}}>No users found</div>}
            </div>
          </>)}
          {card(<>
            <div style={{fontSize:13,fontWeight:700,color:S.text,marginBottom:12}}>Add New User</div>
            <form onSubmit={addUser} style={{display:"flex",flexDirection:"column",gap:10}}>
              <div>{slab("Username")}{inp(newUser.username,v=>setNewUser({...newUser,username:v}),"text","Username")}</div>
              <div>{slab("Password")}{inp(newUser.password,v=>setNewUser({...newUser,password:v}),"password","Password")}</div>
              <div>{slab("Role")}
                <select value={newUser.role} onChange={e=>setNewUser({...newUser,role:e.target.value})} style={{background:S.bg,border:`1px solid ${S.border2}`,borderRadius:7,padding:"8px 11px",color:S.text,fontSize:13,width:"100%"}}>
                  <option value="viewer">Viewer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button type="submit" disabled={busy||!newUser.username||!newUser.password} style={{padding:"9px",background:S.accent,border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",opacity:busy?0.7:1}}>
                {busy?"Creating…":"Create User"}
              </button>
            </form>
          </>)}
          {card(<>
            <div style={{fontSize:13,fontWeight:700,color:S.text,marginBottom:6}}>Current Session</div>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:40,height:40,borderRadius:"50%",background:S.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:"#fff"}}>{(session?.username||"U")[0].toUpperCase()}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,color:S.text}}>{session?.username}</div>
                <div style={{fontSize:12,color:S.muted}}>Role: {session?.role||"viewer"}</div>
              </div>
              <button onClick={onLogout} style={{padding:"7px 16px",background:"rgba(239,68,68,0.12)",border:`1px solid rgba(239,68,68,0.3)`,borderRadius:8,color:S.danger,fontSize:12,fontWeight:600,cursor:"pointer"}}>Sign Out</button>
            </div>
          </>)}
        </>)}

        {/* THEME */}
        {tab==="theme"&&(<>
          <div style={{fontSize:15,fontWeight:700,color:S.text,marginBottom:14}}>Theme Settings</div>
          {card(<>
            <div style={{fontSize:13,fontWeight:700,color:S.text,marginBottom:12}}>Color Mode</div>
            <div style={{display:"flex",gap:12}}>
              {[["dark","Dark Mode (Default)","#0f172a","#1e293b"],["light","Light Mode","#f8fafc","#e2e8f0"]].map(([id,label,bg,card_])=>(
                <div key={id} onClick={()=>setTheme(id)} style={{flex:1,padding:16,borderRadius:10,border:`2px solid ${theme===id?S.accent:S.border}`,cursor:"pointer",background:bg,transition:"border 0.2s"}}>
                  <div style={{width:"100%",height:40,borderRadius:6,background:card_,marginBottom:8,border:`1px solid ${theme==="dark"?S.border:"#cbd5e1"}`}}></div>
                  <div style={{fontSize:12,fontWeight:600,color:theme===id?S.accent:S.muted,textAlign:"center"}}>{label}</div>
                  {theme===id&&<div style={{fontSize:10,color:S.accent,textAlign:"center",marginTop:4}}>✓ Active</div>}
                </div>
              ))}
            </div>
            <div style={{fontSize:11,color:S.muted,marginTop:10}}>Theme preference is saved locally in your browser.</div>
          </>)}
          {card(<>
            <div style={{fontSize:13,fontWeight:700,color:S.text,marginBottom:10}}>Data Sources</div>
            {[
              {name:"CustomerOverview",desc:"Solmar · Interbus · Solmar DE",status:"ok"},
              {name:"ST_Bookings",desc:"Snowtravel bookings",status:"ok"},
              {name:"solmar_bus_bookings_modified",desc:"Bus class & deck assignments",status:"ok"},
              {name:"BUStrips",desc:"Pendel overview",status:"ok"},
              {name:"FeederOverview",desc:"Feeder routes",status:"ok"},
              {name:"solmar.MarginOverview",desc:"Purchase obligations & margin",status:"ok"},
            ].map((ds,i)=>(
              <div key={ds.name} style={{display:"flex",alignItems:"center",padding:"9px 0",borderBottom:i<5?`1px solid ${S.border}`:"none"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600,color:S.text,fontFamily:"monospace"}}>{ds.name}</div>
                  <div style={{fontSize:11,color:S.muted}}>{ds.desc}</div>
                </div>
                <span style={{background:"rgba(16,185,129,0.15)",color:S.success,padding:"2px 10px",borderRadius:10,fontSize:11,fontWeight:700}}>● Connected</span>
              </div>
            ))}
          </>)}
        </>)}

        {/* API STATUS */}
        {tab==="api"&&(<>
          <div style={{fontSize:15,fontWeight:700,color:S.text,marginBottom:14}}>API Integrations</div>
          {card(<>
            <div style={{fontSize:13,fontWeight:700,color:S.text,marginBottom:10}}>Endpoint Status</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {API_ENDPOINTS.map(ep=>{
                const st=apiStatus[ep.name];
                return(
                  <div key={ep.name} style={{display:"flex",alignItems:"center",padding:"10px 14px",background:S.bg,borderRadius:8,border:`1px solid ${S.border}`,gap:10}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:st==null?"#64748b":st.ok===null?"#f59e0b":st.ok?S.success:S.danger,flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:S.text}}>{ep.name}</div>
                      <div style={{fontSize:11,color:S.muted,fontFamily:"monospace"}}>{ep.path}</div>
                    </div>
                    {st&&<span style={{fontSize:11,color:S.muted}}>{st.ms}ms · HTTP {st.status}</span>}
                    <button onClick={()=>testApi(ep.name,ep.path)} style={{padding:"4px 12px",background:"transparent",border:`1px solid ${S.border2}`,borderRadius:6,color:S.muted,fontSize:11,cursor:"pointer",fontWeight:600}}>Test</button>
                  </div>
                );
              })}
            </div>
          </>)}
          {card(<>
            <div style={{fontSize:13,fontWeight:700,color:S.text,marginBottom:10}}>System Info</div>
            {[
              ["Backend URL",BASE],
              ["Database","Azure SQL · ttpserver.database.windows.net"],
              ["Database Name","TTPDatabase"],
              ["Schema","solmar · dbo"],
              ["Frontend","GitHub Pages · /TTP-DASHBOARD/"],
              ["Version","v2.1 · Data Engine"],
            ].map(([k,v])=>(
              <div key={k} style={{display:"flex",gap:16,padding:"7px 0",borderBottom:`1px solid ${S.border}`}}>
                <div style={{width:120,fontSize:12,fontWeight:600,color:S.muted,flexShrink:0}}>{k}</div>
                <div style={{fontSize:12,color:S.text,fontFamily:k.includes("URL")||k.includes("DB")||k.includes("Schema")?"monospace":"inherit",wordBreak:"break-all"}}>{v}</div>
              </div>
            ))}
          </>)}
        </>)}

        {/* AI PROMPTS */}
        {tab==="ai"&&(<>
          <div style={{fontSize:15,fontWeight:700,color:S.text,marginBottom:14}}>AI Prompt Settings</div>
          {settingsMsg&&<div style={{background:settingsMsg.startsWith("Error")?"rgba(239,68,68,0.12)":"rgba(16,185,129,0.12)",border:`1px solid ${settingsMsg.startsWith("Error")?S.danger:S.success}`,borderRadius:8,padding:"8px 12px",fontSize:12,color:settingsMsg.startsWith("Error")?S.danger:S.success,marginBottom:12}}>{settingsMsg}</div>}
          {card(<>
            <div style={{fontSize:13,fontWeight:700,color:S.text,marginBottom:6}}>Custom AI Prompt</div>
            <div style={{fontSize:11,color:S.muted,marginBottom:10}}>This prompt is prepended to all AI analysis requests. Use it to provide business context.</div>
            <textarea value={settings.aiPrompt||""} onChange={e=>setSettings({...settings,aiPrompt:e.target.value})} rows={8} placeholder="Example: We are a Belgian travel company. Revenue is in EUR. Fiscal year runs December to November..." style={{width:"100%",background:S.bg,border:`1px solid ${S.border2}`,borderRadius:8,padding:"10px 12px",color:S.text,fontSize:13,resize:"vertical",boxSizing:"border-box",fontFamily:"Inter,system-ui,sans-serif"}}/>
            <button onClick={saveSettings} disabled={busy} style={{marginTop:10,padding:"9px 20px",background:S.accent,border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>{busy?"Saving…":"Save Prompt"}</button>
          </>)}
        </>)}

        {/* EMAIL ALERTS */}
        {tab==="alerts"&&(<>
          <div style={{fontSize:15,fontWeight:700,color:S.text,marginBottom:14}}>Email Alert Settings</div>
          {settingsMsg&&<div style={{background:settingsMsg.startsWith("Error")?"rgba(239,68,68,0.12)":"rgba(16,185,129,0.12)",border:`1px solid ${settingsMsg.startsWith("Error")?S.danger:S.success}`,borderRadius:8,padding:"8px 12px",fontSize:12,color:settingsMsg.startsWith("Error")?S.danger:S.success,marginBottom:12}}>{settingsMsg}</div>}
          {card(<>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:13,fontWeight:700,color:S.text}}>Email Alerts</div>
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                <div style={{position:"relative",width:42,height:22}} onClick={()=>setSettings({...settings,emailAlerts:{...settings.emailAlerts,enabled:!settings.emailAlerts?.enabled}})}>
                  <div style={{width:42,height:22,borderRadius:11,background:settings.emailAlerts?.enabled?S.accent:S.border,transition:"background 0.2s"}}/>
                  <div style={{position:"absolute",top:3,left:settings.emailAlerts?.enabled?22:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
                </div>
                <span style={{fontSize:12,color:settings.emailAlerts?.enabled?S.success:S.muted,fontWeight:600}}>{settings.emailAlerts?.enabled?"Enabled":"Disabled"}</span>
              </label>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div>{slab("Alert Recipients (comma-separated)")}
                {inp(settings.emailAlerts?.recipients||"",v=>setSettings({...settings,emailAlerts:{...settings.emailAlerts,recipients:v}}),"text","email@example.com, email2@example.com")}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div>{slab("Revenue Drop Threshold (%)")}<input type="number" value={settings.emailAlerts?.revenueDropThreshold||10} onChange={e=>setSettings({...settings,emailAlerts:{...settings.emailAlerts,revenueDropThreshold:+e.target.value}})} style={{background:S.bg,border:`1px solid ${S.border2}`,borderRadius:7,padding:"8px 11px",color:S.text,fontSize:13,width:"100%",boxSizing:"border-box"}}/></div>
                <div>{slab("Booking Spike Threshold (%)")}<input type="number" value={settings.emailAlerts?.bookingSpikethreshold||20} onChange={e=>setSettings({...settings,emailAlerts:{...settings.emailAlerts,bookingSpikethreshold:+e.target.value}})} style={{background:S.bg,border:`1px solid ${S.border2}`,borderRadius:7,padding:"8px 11px",color:S.text,fontSize:13,width:"100%",boxSizing:"border-box"}}/></div>
              </div>
              <div style={{background:S.bg,border:`1px solid ${S.border}`,borderRadius:8,padding:12}}>
                <div style={{fontSize:11,fontWeight:700,color:S.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.06em"}}>Alert Conditions</div>
                {[
                  `Revenue drops more than ${settings.emailAlerts?.revenueDropThreshold||10}% vs previous period`,
                  `Bookings spike more than ${settings.emailAlerts?.bookingSpikethreshold||20}% vs previous period`,
                ].map((cond,i)=>(
                  <div key={i} style={{display:"flex",gap:8,alignItems:"center",padding:"5px 0",borderBottom:i<1?`1px solid ${S.border}`:"none"}}>
                    <span style={{color:settings.emailAlerts?.enabled?S.success:S.muted,fontSize:14}}>●</span>
                    <span style={{fontSize:12,color:S.muted}}>{cond}</span>
                  </div>
                ))}
              </div>
              <button onClick={saveSettings} disabled={busy} style={{padding:"9px 20px",background:S.accent,border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",alignSelf:"flex-start"}}>{busy?"Saving…":"Save Alert Settings"}</button>
            </div>
          </>)}
        </>)}
      </div>
    </div>
  );
}


// ── App Shell ─────────────────────────────────────────────────────────────────
export default function App(){
  const[session,setSession]=useState(()=>loadAuth());
  const[tab,setTab]=useState("overview");
  const[theme,setTheme]=useState(()=>localStorage.getItem("ttp_theme")||"dark");
  // Apply theme class
  useEffect(()=>{
    localStorage.setItem("ttp_theme",theme);
    document.body.style.background=theme==="light"?"#f8fafc":"#0f172a";
  },[theme]);
  if(!session?.token)return<Login onLogin={d=>{saveAuth(d.token,d);setSession(d);}}/>;
  const token=session.token;
  const NAV=[
    {id:"overview", l:"Overview",
     ic:<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>},
    {id:"bus",      l:"Bus Occupancy",
     ic:<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M8 6v6M3 16V8a4 4 0 014-4h10a4 4 0 014 4v8m0 0H3m18 0v4H3v-4"/><circle cx="7.5" cy="16.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/></svg>},
    {id:"purchase", l:"Purchase Obligations",
     ic:<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>},
    {id:"settings", l:"Settings",
     ic:<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>},
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
          {tab==="settings" &&<SettingsTab  token={token} session={session} onLogout={()=>{clearAuth();setSession(null);}} theme={theme} setTheme={setTheme}/>}
        </div>
      </div>
    </div>
  );
}
