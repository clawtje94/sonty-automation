// Alle links uit de gebouwde mails halen en stuk voor stuk testen. Een 404 in een mail naar
// duizenden mensen is een blunder die je maar een keer maakt.
const fs=require('fs'), path=require('path');
const DIST=path.join(__dirname,'dist');
const links=new Set();
for(const f of fs.readdirSync(DIST).filter(x=>x.endsWith('.html'))){
  const h=fs.readFileSync(path.join(DIST,f),'utf8');
  for(const m of h.matchAll(/href="(https?:\/\/[^"]+)"/g)){
    const u=m[1];
    if(/\{\{|\{%|document\.reuzenpanda|wa\.me|tel:/.test(u)) continue;
    links.add(u);
  }
}
(async()=>{
  console.log('Links in de mails: '+links.size+'\n');
  let stuk=0;
  for(const u of [...links].sort()){
    let code='?';
    try{ const r=await fetch(u,{method:'GET',redirect:'follow',signal:AbortSignal.timeout(12000)}); code=r.status; }catch{ code='timeout'; }
    const ok = code===200;
    if(!ok) stuk++;
    console.log('  '+String(code).padEnd(8)+u);
  }
  console.log('\n'+(stuk? stuk+' LINK(S) STUK':'Alle links werken.'));
})();
