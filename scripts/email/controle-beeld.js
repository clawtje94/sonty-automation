const fs=require('fs'), path=require('path');
const DIST=path.join(__dirname,'dist');
const imgs=new Set();
for(const f of fs.readdirSync(DIST).filter(x=>x.endsWith('.html'))){
  const h=fs.readFileSync(path.join(DIST,f),'utf8');
  for(const m of h.matchAll(/<img[^>]+src="([^"]+)"/g)) if(!/\{\{/.test(m[1])) imgs.add(m[1]);
}
(async()=>{
  console.log('Afbeeldingen in de mails: '+imgs.size+'\n');
  let stuk=0;
  for(const u of [...imgs].sort()){
    let code='?';
    try{ const r=await fetch(u,{signal:AbortSignal.timeout(12000)}); code=r.status; }catch{ code='timeout'; }
    if(code!==200) stuk++;
    console.log('  '+String(code).padEnd(8)+u.replace('https://sonty-website.vercel.app/images/',''));
  }
  console.log('\n'+(stuk? stuk+' AFBEELDING(EN) STUK':'Alle afbeeldingen laden.'));
})();
