// Resolver zodat de TypeScript-prijsmotoren van sonty-website geladen kunnen worden:
// @/... wijst naar de repo-root, en JSON-imports hebben in ESM een expliciet attribuut nodig.
import { pathToFileURL } from 'node:url';
const ROOT = '/Users/clawdboot/sonty-website/';
export async function resolve(spec, ctx, next) {
  if (spec.startsWith('@/')) {
    const url = pathToFileURL(ROOT + spec.slice(2)).href;
    if (url.endsWith('.json')) return { url, format: 'json', importAttributes: { type: 'json' }, shortCircuit: true };
    return next(url, ctx);
  }
  return next(spec, ctx);
}
