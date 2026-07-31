#!/bin/bash
# Wacht tot na de 17:00-run en check of de 12 wachtenden zijn afgevinkt.
while [ "$(date +%H%M)" -lt 1725 ]; do sleep 60; done
node -e "
const fs=require('fs');
const KS=require('./scripts/ai-ks/config.js');
(async()=>{
 const wa=JSON.parse(fs.readFileSync('scripts/.wa-offerte-sent.json','utf8'));
 const items=(await (await fetch('https://backend.reuzenpanda.nl/contact-service/'+KS.RP_PID+'/backlogs/'+KS.RP_BACKLOG+'/items',{headers:{Authorization:'Bearer '+KS.RP_API_KEY}})).json()).items||[];
 const perTel=new Map();
 for(const it of items){const t=String(it.fields?.phone||'').replace(/\D/g,'').slice(-9);
  if(t.length>=9){if(!perTel.has(t))perTel.set(t,[]);perTel.get(t).push(it);}}
 const wachtenden={'614674888':'Richard B','610066030':'Tertia Kramer','612962241':'Paul Driever','620627773':'M. Smits','636169248':'Niels Jongkoen','624167908':'Jan Maes','610751413':'Robbert Winkel','624206204':'Robert Gubbi','629387390':'Bart van den Oord','640532429':'Dicky Baas','648791921':'Nick Vermaat','633786035':'Daniel Wijma','685041041':'Patrycja Swaczyna'};
 const nu=new Date().toISOString().slice(0,10);
 const ok=[],niet=[];
 for(const [t9,naam] of Object.entries(wachtenden)){
  if(t9==='610066030')continue; // was al verstuurd
  const its=perTel.get(t9)||[];
  const vandaag=its.some(i=>String(wa[i.id]||'').startsWith(nu));
  const ooit=its.some(i=>wa[i.id]);
  (vandaag||ooit?ok:niet).push(naam);
 }
 let txt='Controle na de 17:00-run: van de 12 wachtende offerte-WhatsApps zijn er '+ok.length+' nu verstuurd.';
 if(niet.length)txt+='\nNog NIET verstuurd: '+niet.join(', ')+'. Volgende poging morgen 09:00; als het dan weer misgaat is er iets anders aan de hand en duik ik erin.';
 else txt+=' Allemaal binnen, inhaalslag compleet.';
 require('child_process').execFileSync('node',['scripts/sonty-data-send.js',txt],{stdio:'inherit'});
})();
"
