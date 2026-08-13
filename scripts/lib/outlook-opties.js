// Bot-opties zichtbaar in Outlook (Daimy 06-08: "hoe voorkomen we dat de winkel iets
// plant wat jij al hebt voorgesteld?"). Elk verstuurd aanbod zet zijn 3 tijden als
// "OPTIE bot" in de agenda Sonty Montage, zodat het kantoor eromheen plant. Bij keuze
// wordt de gekozen optie een echte afspraak (bestaand formaat, mét inmeter als
// deelnemer zodat de Outlook→Planado-sync hem herkent) en verdwijnen de andere twee.
// Opties hebben GEEN deelnemers: de sync slaat ze dan vanzelf over (geen dubbele jobs).
const fs = require('fs');
const path = require('path');

const INMETER_MAIL = { Joey: 'joey@sonty.nl', Sjoerd: 'sjoerd@sonty.nl' };

function owaHeaders() {
  const token = fs.readFileSync(path.join(__dirname, '..', '.owa-token.txt'), 'utf8').trim();
  return { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
}

async function kalenderId(OH) {
  const cals = (await (await fetch('https://outlook.office.com/api/v2.0/me/calendars', { headers: OH })).json()).value || [];
  const cal = cals.find((c) => c.Name === 'Sonty Montage');
  if (!cal) throw new Error('kalender Sonty Montage niet gevonden');
  return cal.Id;
}

const owaTijd = (d) => ({ DateTime: new Date(d).toISOString().slice(0, 19), TimeZone: 'UTC' });

/** Zet de aangeboden tijden als OPTIE-afspraken. Geeft de event-ids terug. */
async function maakOpties({ slots, naam, verlooptOp }) {
  const OH = owaHeaders();
  const calId = await kalenderId(OH);
  const vervalt = new Date(verlooptOp).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const ids = [];
  for (const slot of slots) {
    const r = await fetch(`https://outlook.office.com/api/v2.0/me/calendars/${calId}/events`, {
      method: 'POST', headers: OH,
      body: JSON.stringify({
        Subject: `OPTIE bot ${slot.inmeter} — ${naam} (vervalt ${vervalt})`,
        Start: owaTijd(slot.aankomst), End: owaTijd(slot.vertrek),
        Body: { ContentType: 'Text', Content: 'Automatisch aanbod van de inmeet-planner. Niet overheen plannen a.u.b.; vervalt vanzelf.' },
        ShowAs: 'Tentative',
      }),
    });
    if (r.ok) ids.push((await r.json()).Id);
  }
  return ids;
}

/** Verwijder optie-afspraken (na keuze of verlopen). Fouten zijn niet fataal. */
async function verwijderOpties(ids) {
  if (!ids?.length) return;
  const OH = owaHeaders();
  // Met herkansing (Daimy 11-08): een stil mislukte DELETE liet het OPTIE-blok staan,
  // en dat blok hield de tijd bezet voor nieuwe boekingen en op het dashboard.
  // Er stonden 17 van zulke wezen. De sync veegt als vangnet elke 30 min na.
  for (const id of ids) {
    for (let poging = 0; poging < 3; poging++) {
      try {
        const r = await fetch('https://outlook.office.com/api/v2.0/me/events/' + id, { method: 'DELETE', headers: OH });
        if (r.ok || r.status === 204 || r.status === 404) break;
      } catch { /* netwerk: opnieuw */ }
      await new Promise((rs) => setTimeout(rs, 8000 * (poging + 1)));
    }
  }
}

/** Zet de definitieve afspraak in Outlook, in het bestaande formaat mét inmeter.
 *  DE KLANT STAAT ER ALTIJD BIJ ALS GENODIGDE (Daimy 13-08, hard geleerd: het team
 *  stuurt de bevestigingen vanuit Outlook, dus een afspraak zonder klant-mailadres
 *  betekent dat de klant NIETS krijgt — dat is bij tientallen boekingen misgegaan).
 *  Outlook mailt de genodigde automatisch de uitnodiging, en wijzigingen gaan mee. */
async function maakDefinitief({ slot, naam, telefoon, adres, duurMin, email }) {
  const OH = owaHeaders();
  const calId = await kalenderId(OH);
  const eind = new Date(+new Date(slot.aankomst) + duurMin * 60000);
  const mail = INMETER_MAIL[slot.inmeter];
  const attendees = [];
  if (mail) attendees.push({ EmailAddress: { Address: mail, Name: slot.inmeter }, Type: 'Required' });
  if (email && /@/.test(email)) attendees.push({ EmailAddress: { Address: email, Name: naam }, Type: 'Required' });
  const r = await fetch(`https://outlook.office.com/api/v2.0/me/calendars/${calId}/events`, {
    method: 'POST', headers: OH,
    body: JSON.stringify({
      Subject: `Inmeten — ${naam}`,
      Start: owaTijd(slot.aankomst), End: owaTijd(eind),
      Location: { DisplayName: adres || '' },
      Body: { ContentType: 'Text', Content: `Geboekt door de inmeet-planner na klantkeuze.\nTelefoonnummer: ${telefoon || '-'}\nE-mail: ${email || '-'}` },
      Attendees: attendees,
    }),
  });
  if (!r.ok) throw new Error('Outlook-afspraak aanmaken: HTTP ' + r.status);
  return (await r.json()).Id;
}

module.exports = { maakOpties, verwijderOpties, maakDefinitief };
