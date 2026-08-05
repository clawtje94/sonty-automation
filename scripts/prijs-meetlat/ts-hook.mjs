// Resolver zodat de TypeScript-prijsmotoren van sonty-website geladen kunnen worden:
// @/... wijst naar de repo-root, en JSON-imports hebben in ESM een expliciet attribuut nodig.
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
const ROOT = '/Users/clawdboot/sonty-website/';
export async function resolve(spec, ctx, next) {
  if (spec.startsWith('@/')) {
    let pad = ROOT + spec.slice(2);
    // Next.js laat de extensie weg (@/lib/prijspeil). Node niet, dus zelf aanvullen.
    if (!/\.(json|ts|tsx|js|mjs)$/.test(pad)) {
      const gevonden = ['.ts', '.tsx', '.js', '.mjs', '/index.ts'].find((e) => existsSync(pad + e));
      if (gevonden) pad += gevonden;
    }
    const url = pathToFileURL(pad).href;
    if (url.endsWith('.json')) return { url, format: 'json', importAttributes: { type: 'json' }, shortCircuit: true };
    return next(url, ctx);
  }
  return next(spec, ctx);
}
