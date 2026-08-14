// KLANT-STIL: de ene poort voor "de bot zwijgt bij deze klant" (Daimy 14-08, Charles
// Gevers: hij stond op de stil-lijst maar kreeg TOCH een boekingsbevestiging, omdat
// alleen de reply-monitor de lijst kende. Elk pad dat een klant een bericht stuurt
// hoort hier eerst langs — bevestigingen, herinneringen, aanbiedingen, alles.)
const fs = require('fs');
const path = require('path');

const PAD = path.join(__dirname, '..', '..', 'data', 'monitor-stil.json');

/** true = deze klant NIET automatisch berichten sturen (mens voert het gesprek). */
function klantStil(telefoon) {
  try {
    const lijst = JSON.parse(fs.readFileSync(PAD, 'utf8'));
    const t9 = String(telefoon || '').replace(/\D/g, '').slice(-9);
    return !!(t9 && lijst[t9]);
  } catch { return false; }
}

module.exports = { klantStil };
