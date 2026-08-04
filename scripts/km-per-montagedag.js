#!/usr/bin/env node
// Hoeveel kilometer rijdt een montageteam per dag? READ-ONLY.
// Route per team per dag: magazijn Berkel -> klussen op volgorde -> terug naar magazijn,
// afstanden via TomTom.
//
// LET OP bij het lezen van de uitkomst: het locatieveld in Outlook wordt ook als
// notitieveld gebruikt ("Yudi later", "Yudi vrij"). Zonder huisnummer is het geen adres;
// die afspraken worden overgeslagen, anders reken je ritten die niet bestaan (dat gaf
// eerst 242 km/dag voor Yudi in plaats van 98).
const {reistijd,MAGAZIJN}=require('/Users/clawdboot/sonty/scripts/lib/reistijd');
const T=fs.readFileSync('/Users/clawdboot/sonty/scripts/.owa-token.txt','utf8').trim();
const H={Authorization:'Bearer '+T};
const isInmeet=s=>/inmeet|inmeten/i.test(s||'');
const isMontage=s=>/montage/i.test(s||'');

(async()=>{
  const cals=(await (await fetch('https://outlook.office.com/api/v2.0/me/calendars',{headers:H})).json()).value||[];
  const cal=cals.find(c=>c.Name==='Sonty Montage');
  const van=new Date(); van.setDate(van.getDate()-28);
  const tot=new Date();
  let url='https://outlook.office.com/api/v2.0/me/calendars/'+cal.Id+'/calendarView?$top=1000&$select=Subject,Start,End,Location,IsCancelled,Attendees&startDateTime='+van.toISOString()+'&endDateTime='+tot.toISOString();
  const evs=[];while(url){const j=await (await fetch(url,{headers:H})).json();evs.push(...(j.value||[]));url=j['@odata.nextLink']||null;}

  const deelnemers=e=>(e.Attendees||[]).map(a=>a.EmailAddress?.Name||'').filter(n=>n&&!/^sonty$/i.test(n));
  // Het locatieveld wordt ook als notitieveld gebruikt ("Yudi later", "Yudi vrij").
  // Zonder huisnummer is het geen adres; TomTom plaatst zo'n tekst ergens op de kaart
  // en dan reken je een rit die niet bestaat.
  const isAdres=t=>{const s=(t||'').trim();return s.length>8 && /\d/.test(s) && /[a-z]{3}/i.test(s);};
  const alleMont=evs.filter(e=>!e.IsCancelled && isMontage(e.Subject) && !isInmeet(e.Subject));
  const mont=alleMont.filter(e=>isAdres(e.Location?.DisplayName));
  const geenAdres=alleMont.length-mont.length;
  console.log(`${alleMont.length} montage-afspraken, waarvan ${mont.length} met een ECHT adres`);
  console.log(`${geenAdres} overgeslagen (locatieveld bevat een notitie of is leeg)\n`);

  // per persoon per dag de route opbouwen
  const dagen={};
  for(const e of mont){
    const dag=e.Start.DateTime.slice(0,10);
    for(const p of deelnemers(e)){
      const k=p.split(' ')[0]+'|'+dag;
      (dagen[k]=dagen[k]||[]).push({start:e.Start.DateTime,adres:e.Location.DisplayName.trim(),klant:(e.Subject||'').slice(0,26)});
    }
  }

  const resultaten=[];
  for(const [k,stops] of Object.entries(dagen)){
    stops.sort((a,b)=>a.start.localeCompare(b.start));
    let km=0, ok=true;
    let vorig=MAGAZIJN;
    for(const s of stops){
      try{ const r=await reistijd(vorig,s.adres,new Date(s.start+'Z')); km+=r.km; vorig=s.adres; }
      catch{ ok=false; break; }
    }
    if(ok){
      try{ const r=await reistijd(vorig,MAGAZIJN,new Date()); km+=r.km; }catch{ok=false;}
    }
    if(ok) resultaten.push({wie:k.split('|')[0],dag:k.split('|')[1],stops:stops.length,km:Math.round(km)});
  }

  const mediaan=a=>{const s=[...a].sort((x,y)=>x-y);const i=Math.floor(s.length/2);return s.length%2?s[i]:Math.round((s[i-1]+s[i])/2);};
  const alle=resultaten.map(r=>r.km);
  console.log(`${resultaten.length} team-dagen doorgerekend\n`);
  console.log(`  GEMIDDELD ${Math.round(alle.reduce((a,b)=>a+b,0)/alle.length)} km per team per dag`);
  console.log(`  mediaan   ${mediaan(alle)} km`);
  console.log(`  kortste   ${Math.min(...alle)} km   langste ${Math.max(...alle)} km\n`);

  console.log('Duurste 5 dagen (controle op uitschieters):');
  for(const r of [...resultaten].sort((a,b)=>b.km-a.km).slice(0,5)){
    console.log(`  ${r.dag} ${r.wie}: ${r.km} km, ${r.stops} klussen`);
    for(const s of dagen[r.wie+'|'+r.dag]) console.log(`      ${s.start.slice(11,16)} ${s.klant} | ${s.adres.slice(0,52)}`);
  }
  console.log('');

  const perPersoon={};
  for(const r of resultaten){(perPersoon[r.wie]=perPersoon[r.wie]||[]).push(r);}
  console.log('Per team:');
  for(const [w,l] of Object.entries(perPersoon).sort((a,b)=>b[1].length-a[1].length)){
    const km=l.map(x=>x.km);
    const stops=l.reduce((a,x)=>a+x.stops,0)/l.length;
    console.log(`  ${w.padEnd(10)} ${String(l.length).padStart(2)} dagen | gem ${String(Math.round(km.reduce((a,b)=>a+b,0)/km.length)).padStart(3)} km/dag | ${stops.toFixed(1)} klussen/dag`);
  }
})();
