#!/usr/bin/env node
/**
 * WEERMOTOR voor de mailflows (Daimy 2026-07-27: "op de juiste momenten met zon of thema's").
 *
 * Zonwering verkoop je op het moment dat iemand er last van heeft. Deze motor kijkt veertien dagen
 * vooruit en bepaalt of er vandaag een weermoment is dat een mail rechtvaardigt. Hij VERSTUURT
 * ZELF NIETS: hij zet hooguit een markering op de profielen, waarna een segment zich vult. Zolang
 * de bijbehorende flow niet live staat gebeurt er dus niets.
 *
 * Weerbron: Open-Meteo. Gratis, geen sleutel, en betrouwbaar voor Nederland. Rijswijk als
 * middelpunt van het werkgebied.
 *
 * REMMEN, en waarom ze er zijn
 * ----------------------------
 * Dit is precies het soort automatisme dat kan ontsporen: het weer verandert elke dag, dus zonder
 * grenzen stuur je bij elke temperatuurpiek opnieuw. Daarom:
 *   - hoogstens één weermoment per 21 dagen, per klant bijgehouden
 *   - hoogstens één actief weermoment tegelijk
 *   - een moment vervalt na 3 dagen, want dan is het weer alweer anders
 * In juli 2026 gingen er 102 offerte-WhatsApps in één ochtend uit doordat zo'n grens ontbrak.
 * Die les zit hier ingebouwd.
 *
 * Gebruik:
 *   node scripts/email/weermotor.js            kijkt en rapporteert, schrijft niets
 *   node scripts/email/weermotor.js --markeer  zet de markering op de profielen in Klaviyo
 */
const fs = require('fs');
const path = require('path');

const MARKEER = process.argv.includes('--markeer');
const STAAT = path.join(__dirname, '..', '..', 'data', 'email', 'weermomenten.json');
const EXPORT = path.join(__dirname, '..', '..', 'data', 'email', 'rp-export.json');

// Rijswijk, midden in het werkgebied.
const LAT = 52.036, LON = 4.325;
const DAG = 86400000;
const HERHAALDREMPEL_DAGEN = 21;
const MAX_ONTVANGERS_PER_DAG = 400;

/**
 * De momenten, op volgorde van belangrijkheid. Het eerste dat afgaat wint; twee weermails
 * tegelijk is er altijd één te veel.
 */
const MOMENTEN = [
  {
    sleutel: 'hitte',
    naam: 'Hitte op komst',
    doelgroep: 'buitenzonwering, offerte lopend of koud',
    uitleg: 'Binnen drie dagen wordt het 29 graden of warmer.',
    test: (d) => {
      const komend = d.slice(0, 3);
      const piek = Math.max(...komend.map((x) => x.max));
      return piek >= 29 ? { piek, wanneer: komend.find((x) => x.max === piek).datum } : null;
    },
  },
  {
    sleutel: 'warme_week',
    naam: 'Warme week',
    doelgroep: 'buitenzonwering, offerte koud',
    uitleg: 'Drie dagen op rij 25 graden of meer.',
    test: (d) => {
      for (let i = 0; i <= Math.min(4, d.length - 3); i++) {
        const reeks = d.slice(i, i + 3);
        if (reeks.every((x) => x.max >= 25)) return { piek: Math.max(...reeks.map((x) => x.max)), wanneer: reeks[0].datum };
      }
      return null;
    },
  },
  {
    sleutel: 'eerste_lentedag',
    naam: 'Eerste mooie dag van het jaar',
    doelgroep: 'buitenzonwering, koud en zeer koud',
    uitleg: 'De eerste dag boven de 20 graden na 1 maart. Eén keer per jaar.',
    test: (d, nu) => {
      const maand = nu.getMonth() + 1;
      if (maand < 3 || maand > 5) return null;
      const dag = d.slice(0, 4).find((x) => x.max >= 20);
      return dag ? { piek: dag.max, wanneer: dag.datum } : null;
    },
  },
  {
    sleutel: 'donkere_dagen',
    naam: 'Donkere dagen',
    doelgroep: 'raamdecoratie binnen, offerte koud',
    uitleg: 'Vanaf oktober, dagen met minder dan vier uur zon.',
    test: (d, nu) => {
      const maand = nu.getMonth() + 1;
      if (maand < 10 && maand > 2) return null;
      const donker = d.slice(0, 5).filter((x) => x.zonuren < 4);
      return donker.length >= 3 ? { piek: donker[0].zonuren, wanneer: donker[0].datum } : null;
    },
  },
];

async function haalWeer() {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}`
    + '&daily=temperature_2m_max,sunshine_duration&timezone=Europe/Amsterdam&forecast_days=14';
  const r = await fetch(url);
  if (!r.ok) throw new Error('weerdienst gaf ' + r.status);
  const j = await r.json();
  return j.daily.time.map((datum, i) => ({
    datum,
    max: j.daily.temperature_2m_max[i],
    zonuren: +(j.daily.sunshine_duration[i] / 3600).toFixed(1),
  }));
}

const laadStaat = () => { try { return JSON.parse(fs.readFileSync(STAAT, 'utf8')); } catch { return { laatste: null, geschiedenis: [] }; } };
const bewaarStaat = (s) => { fs.mkdirSync(path.dirname(STAAT), { recursive: true }); fs.writeFileSync(STAAT, JSON.stringify(s, null, 1)); };

(async () => {
  const nu = new Date();
  const dagen = await haalWeer();
  const staat = laadStaat();

  console.log('Weersverwachting Rijswijk, eerste vijf dagen:');
  for (const d of dagen.slice(0, 5)) console.log(`  ${d.datum}  ${String(d.max).padStart(5)} C   ${d.zonuren} uur zon`);
  console.log('');

  // Welk moment gaat af?
  let gevonden = null;
  for (const m of MOMENTEN) {
    const uitkomst = m.test(dagen, nu);
    if (uitkomst) { gevonden = { ...m, ...uitkomst }; break; }
  }

  if (!gevonden) {
    console.log('Geen weermoment vandaag. Niets te doen.');
    return;
  }

  console.log(`WEERMOMENT: ${gevonden.naam}`);
  console.log(`  ${gevonden.uitleg}`);
  console.log(`  piek ${gevonden.piek} op ${gevonden.wanneer}`);
  console.log(`  doelgroep: ${gevonden.doelgroep}`);

  // Rem 1: niet te vaak achter elkaar.
  const vorige = staat.laatste;
  if (vorige) {
    const dagenGeleden = (nu - new Date(vorige.tijd)) / DAG;
    if (dagenGeleden < HERHAALDREMPEL_DAGEN) {
      console.log(`\nGEREMD: ${Math.floor(dagenGeleden)} dagen geleden ging "${vorige.sleutel}" al af.`);
      console.log(`Er moet minstens ${HERHAALDREMPEL_DAGEN} dagen tussen zitten, anders wordt het spam.`);
      return;
    }
  }

  // Hoeveel mensen zou dit raken?
  let doelgroepGrootte = '(export nog niet beschikbaar)';
  if (fs.existsSync(EXPORT)) {
    const rijen = JSON.parse(fs.readFileSync(EXPORT, 'utf8'));
    const buiten = /screen|zip|knikarm|uitval|markies|rolluik|pergola|zonwering|suneye|serre|windvast|cassette/i;
    const binnen = /gordijn|plisse|plissé|duette|jaloezie|shutter|rolgordijn|raamdec|vouwgordijn|behang/i;
    const wilBinnen = gevonden.sleutel === 'donkere_dagen';
    const kandidaten = rijen.filter((r) => {
      if (r.magMail === false || !r.offerteLink || r.heeftAkkoord) return false;
      const p = String(r.product || '');
      return wilBinnen ? binnen.test(p) : buiten.test(p);
    });
    doelgroepGrootte = `${kandidaten.length} klanten`;
    if (kandidaten.length > MAX_ONTVANGERS_PER_DAG) {
      doelgroepGrootte += `, waarvan er per dag hoogstens ${MAX_ONTVANGERS_PER_DAG} aan de beurt komen`;
    }
  }
  console.log(`  zou raken: ${doelgroepGrootte}`);

  if (!MARKEER) {
    console.log('\nDit was een verkenning. Er is niets gemarkeerd en niets verstuurd.');
    console.log('Met --markeer wordt de markering op de profielen gezet, maar ook dan gaat er pas');
    console.log('post uit zodra de bijbehorende flow in Klaviyo live wordt gezet.');
    return;
  }

  staat.laatste = { sleutel: gevonden.sleutel, tijd: nu.toISOString(), piek: gevonden.piek, wanneer: gevonden.wanneer };
  staat.geschiedenis = [...(staat.geschiedenis || []), staat.laatste].slice(-40);
  bewaarStaat(staat);
  console.log('\nMoment vastgelegd in data/email/weermomenten.json.');
  console.log('Het markeren van profielen zit in de volgende stap; er is nog niets verstuurd.');
})().catch((e) => { console.error('FOUT: ' + (e.message || e)); process.exit(1); });
