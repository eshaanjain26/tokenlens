#!/bin/bash
# usage: run1.sh <spec-file-prefix>  -> prints compact failure list
cd "$(dirname "$0")"
TL_URL=${TL_URL:-http://localhost:4196/} timeout 280 npx playwright test tests/$1* --timeout 30000 --reporter=json > /tmp/tl-r-$1.json 2>/dev/null
node -e '
const fs=require("fs");let raw=fs.readFileSync("/tmp/tl-r-'$1'.json","utf8");let r;try{r=JSON.parse(raw)}catch(e){console.log("NO JSON (timeout?)");process.exit()}
const rows=[];function walk(s){(s.specs||[]).forEach(sp=>sp.tests.forEach(t=>{const res=t.results[0]||{};rows.push({title:sp.title,status:res.status,ms:res.duration,err:(res.errors||[]).map(e=>(e.message||"").replace(/\u001b\[[0-9;]*m/g,"").split("\n").filter(x=>x.trim()).slice(0,2).join(" / ").slice(0,230)),ann:(t.annotations||[]).map(a=>a.type+": "+(a.description||"").slice(0,200))});}));(s.suites||[]).forEach(walk);}
r.suites.forEach(walk);
console.log("== '$1': ",rows.filter(x=>x.status==="passed").length+"/"+rows.length+" passed");
rows.forEach(x=>{ if(x.status!=="passed") console.log("FAIL",x.title.slice(0,70),"("+x.ms+"ms)\n   ",x.err.slice(0,4).join("\n    ")); if(x.ann.length) console.log("  ANN",x.ann.join(" || ").slice(0,300)); });
'
