// Centrale instellingen (Daimy 06-08: "voor alles instellingen, geen AI nodig").
// Bron = /api/inmeet-instellingen (winkel stelt in via /admin/inmeet-instellingen);
// hier met 60s-cache en dezelfde standaarden als de API, zodat een storing in de
// site nooit de planning platlegt.
const STANDAARD = {
  herinneringDagen: [7, 1],
  aanbodGeldigUren: 24,
  contactDeadlineDagen: 4,
  maxOmrijdenMin: 30,
  // 1 = één concreet voorstel ("Dat past" / "Ander moment"), 3 = drie keuzeknoppen.
  // Daimy 07-08: één moment als standaard zodra de nieuwe templates zijn goedgekeurd;
  // tot die tijd valt de verzender vanzelf terug op 3 (template-check).
  aantalTijden: 3,
};
let cache = null;
let cacheTot = 0;

async function haalInstellingen() {
  if (cache && Date.now() < cacheTot) return cache;
  try {
    const r = await fetch('https://sonty-website.vercel.app/api/inmeet-instellingen', {
      headers: { 'x-meet-code': process.env.MEETBON_CODE || '2288' },
    });
    if (r.ok) {
      cache = { ...STANDAARD, ...(await r.json()) };
      cacheTot = Date.now() + 60000;
      return cache;
    }
  } catch { /* val terug op standaard */ }
  return { ...STANDAARD };
}

module.exports = { haalInstellingen, STANDAARD };
