// Eén plek voor telefoonnummer-normalisatie richting WhatsApp (Trengo).
//
// Aanleiding (Daimy 16-08): het RP-formulier toont het telefoonveld al in
// +31-opmaak. Klanten die daardoor de "06" weglaten en alleen de laatste 8
// cijfers typen, komen als +31 + 8 cijfers in RP terecht; de formulier-check
// houdt dat niet tegen. Giel Kooi bewees de herstelregel: kapotte lead
// +3144536548, goede lead (Tiny en Giel) +31644536548 — precies de 6 die mist.
// Vaste nummers (+3170..., +3110...) hebben geen WhatsApp en zijn kansloos.
//
// normaliseerTelefoon(ruw) → { ok, nummer, actie, reden }
//   actie 'ok'       — nummer is (na opmaak) een geldig doel voor WhatsApp
//   actie 'hersteld' — 8 cijfers na +31: de weggelaten 6 vooraan teruggezet
//   actie 'skip'     — niet via WhatsApp sturen; reden zegt waarom
function normaliseerTelefoon(ruw) {
  const skip = (reden, nummer) => ({ ok: false, actie: 'skip', reden, nummer: nummer || null });

  let s = String(ruw || '').trim();
  if (!s) return skip('leeg');
  // alles behalve cijfers en een leidende + weggooien (spaties, streepjes, punten, haakjes, /)
  s = s.replace(/[^\d+]/g, '');
  s = (s.startsWith('+') ? '+' : '') + s.replace(/\+/g, '');
  if (!/\d/.test(s)) return skip('geen-cijfers');
  if (s.startsWith('00')) s = '+' + s.slice(2);

  // Zonder landcode: NL-notaties naar +31 brengen
  if (!s.startsWith('+')) {
    if (s.startsWith('31')) s = '+' + s;
    else if (s.startsWith('0')) s = '+31' + s.slice(1);
    else s = '+31' + s; // "612345678" of het formulier-lek "44536548"
  }

  // Buitenlands nummer: niet aan sleutelen, alleen op plausibele lengte checken
  if (!s.startsWith('+31')) {
    const cijfers = s.slice(1);
    if (cijfers.length < 9 || cijfers.length > 15) return skip('buitenlands-onwaarschijnlijke-lengte', s);
    return { ok: true, actie: 'ok', reden: 'buitenlands', nummer: s };
  }

  let rest = s.slice(3);
  while (rest.startsWith('0')) rest = rest.slice(1); // dubbele prefix zoals "+31 (0)6" of "+3106..."

  if (rest.length === 9) {
    if (rest.startsWith('6')) return { ok: true, actie: 'ok', reden: 'nl-mobiel', nummer: '+31' + rest };
    return skip('vast-nummer-geen-whatsapp', '+31' + rest);
  }
  if (rest.length === 8) {
    // Het formulier-lek: klant liet "06" weg. De 6 terugzetten geeft een geldig mobiel nummer.
    return { ok: true, actie: 'hersteld', reden: '06-weggelaten-in-formulier', nummer: '+316' + rest };
  }
  return skip('nl-onherstelbare-lengte-' + rest.length, '+31' + rest);
}

module.exports = { normaliseerTelefoon };
