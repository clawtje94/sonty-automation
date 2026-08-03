/** Doet één verse meting en schrijft hem als JSON naar stdout. Alleen-lezen.
 *  Los proces zodat de verhoging-check en de meetlat exact dezelfde meting gebruiken. */
const { meet } = require('./meetlat.js');
process.stdout.write(JSON.stringify(meet()));
