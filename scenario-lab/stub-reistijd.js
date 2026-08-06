// Nep-reistijd voor het lab: deterministisch (afstand ≈ postcodeverschil), geen TomTom.
// MOET geladen worden vóór iets anders slotzoeker.js require't — slotzoeker bindt
// reistijd bij zijn eigen require, dus de cache wordt hier vooraf gevuld.
const path = require('path');
const echtPad = require.resolve(path.join(__dirname, '..', 'scripts', 'lib', 'reistijd.js'));

const pcVan = (adres) => {
  const m = String(adres || '').match(/\b([1-9]\d{3})\b/);
  return m ? Number(m[1]) : 2650; // magazijn-buurt als een adres geen postcode heeft
};

require.cache[echtPad] = {
  id: echtPad, filename: echtPad, loaded: true, exports: {
    MAGAZIJN: 'Magazijnweg 1, 2651 AA Berkel en Rodenrijs',
    reistijd: async (van, naar) => {
      const minuten = Math.max(5, Math.round(Math.abs(pcVan(van) - pcVan(naar)) / 25));
      return { minuten, km: minuten * 0.9 };
    },
  },
};
