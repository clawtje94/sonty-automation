// Scenario-matrix: uit dimensies automatisch alle combinaties bouwen.
// Daimy 06-08: "ik wil dat jij een structuur bouwt … 500 scenario's testen
// zodat we weten hoe of wat" — niemand hoeft nog met de hand gevallen te verzinnen.
//
// Een dimensie = { naam, waarden: [{ label, ...data }] }.
// combinaties() geeft elk kruisproduct als { _label, <dimnaam>: waarde, ... }.

function combinaties(dimensies) {
  let result = [{}];
  for (const dim of dimensies) {
    const volgende = [];
    for (const basis of result) {
      for (const waarde of dim.waarden) {
        volgende.push({ ...basis, [dim.naam]: waarde });
      }
    }
    result = volgende;
  }
  return result.map((s, i) => ({
    _nr: i + 1,
    _label: dimensies.map((d) => `${d.naam}=${s[d.naam].label}`).join(' | '),
    ...s,
  }));
}

/** Deterministische deelverzameling als het kruisproduct te groot wordt. */
function sample(scenarios, max) {
  if (scenarios.length <= max) return scenarios;
  const stap = scenarios.length / max;
  const uit = [];
  for (let i = 0; i < max; i++) uit.push(scenarios[Math.floor(i * stap)]);
  return uit;
}

module.exports = { combinaties, sample };
