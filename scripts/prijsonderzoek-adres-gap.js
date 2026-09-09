// Zoekt per straat een NIET-bestaand huisnummer tussen twee echte nummers (fictief maar plausibel adres).
const streets = process.argv.slice(2);
(async()=>{
  for (const s of streets) {
    const [straat, plaats] = s.split('|');
    const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(straat+' '+plaats)}&fq=type:adres&fq=woonplaatsnaam:${encodeURIComponent(plaats)}&fq=straatnaam:${encodeURIComponent('"'+straat+'"')}&rows=100&fl=huisnummer,huisletter,huisnummertoevoeging,postcode,straatnaam`;
    await new Promise(r=>setTimeout(r,400)); let docs=[]; try { const r = await fetch(url); const j = await r.json(); docs = j.response.docs.filter(d=>d.straatnaam===straat); } catch(e){ console.log(straat, plaats, 'FOUT', e.message); continue; }
    const byNum = {}; for (const d of docs) { if(!d.huisletter && !d.huisnummertoevoeging) byNum[d.huisnummer] = d.postcode; }
    const nums = Object.keys(byNum).map(Number).sort((a,b)=>a-b);
    let pick=null;
    for (let i=0;i<nums.length-1;i++){ const a=nums[i], b=nums[i+1]; if (b-a===4 && byNum[a]===byNum[b] && a>=4) { pick={n:a+2, pc:byNum[a], tussen:[a,b]}; break; } }
    console.log(`${straat}, ${plaats}: ${docs.length} adressen; ${pick?`FICTIEF ${straat} ${pick.n}, ${pick.pc} (tussen ${pick.tussen.join(' en ')})`:'geen gat gevonden'}`);
  }
})();
