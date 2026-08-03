/** Vergelijkt v4 en de bot op een vaste set maten en print het resultaat als JSON.
 *  Draait als LOS proces omdat engines.js het netwerk dichtzet; de kruiscontrole zelf
 *  moet juist wel naar buiten kunnen voor de KV-check en de Telegram-melding. */
const E = require('./engines.js');
const v4 = E.motorV4(), bot = E.motorBot();
const cases = [
  { productKey: 'suneye', breedte: 500, hoogte: null, uitval: 300, bedType: 'afstandsbediening' },
  { productKey: 'rolluikS37', breedte: 200, hoogte: 200, uitval: null, bedType: 'io' },
  { productKey: 'zipSquare85100', breedte: 300, hoogte: 250, uitval: null, bedType: 'io' },
  { productKey: 'suncube150', breedte: 300, hoogte: null, uitval: 135, bedType: 'io' },
  { productKey: 'suncontrolPergola', breedte: 400, hoogte: null, uitval: 300, bedType: 'io' },
];
const uit = cases.map((c) => ({ p: c.productKey, b: c.breedte, v4: v4.prijs(c), bot: bot.prijs(c) }));
process.stdout.write(JSON.stringify({ markup: v4.markup, cases: uit }));
