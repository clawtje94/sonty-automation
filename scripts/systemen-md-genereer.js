#!/usr/bin/env node
// Genereert SYSTEMEN.md uit data/systemen-register.json — het register is de bron,
// de md is de leesbare weergave. Draait mee in status-collect niet (bewust: alleen
// bij wijzigingen handmatig of via de collector als het register verandert).
const fs = require('fs');
const REGISTER = '/Users/clawdboot/sonty/data/systemen-register.json';
const UIT = '/Users/clawdboot/sonty/SYSTEMEN.md';

const reg = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
const GROEPEN = ['Klantgericht', 'Planning & orders', 'Offertes & CRM', 'Bewaking', 'Rapportage', 'Infrastructuur'];

let md = `# SYSTEMEN.md — register van alle Sonty-automatisering

> GEGENEREERD uit \`data/systemen-register.json\` door \`scripts/systemen-md-genereer.js\`.
> NIET hier bewerken: pas het register aan (of via sonty-website.vercel.app/admin/systemen)
> en draai de generator. Laatst gegenereerd: ${new Date().toISOString().slice(0, 10)}.

**Snel stoppen (kill-switch):** \`touch ~/sonty/data/kill/<label>\` — of de "zet uit"-knop op
/admin/systemen. Hard stoppen: \`launchctl bootout gui/501/<label>\`; weer aan met
\`launchctl bootstrap gui/501 ~/Library/LaunchAgents/<label>.plist\`.

**Bewaking:** status-collect.js pusht elke 10 min naar /admin/systemen, herstart stille
pollers zelf (heartbeat) en meldt nieuw-rood, ongeregistreerde en verdwenen diensten op
Telegram. cron-health-check.js (2x/dag) leest hetzelfde register.
`;

for (const groep of GROEPEN) {
  const rijen = Object.entries(reg.diensten).filter(([, d]) => d.groep === groep);
  if (!rijen.length) continue;
  md += `\n## ${groep}\n\n| Dienst | Doet | Ritme | Log | Bewaking |\n|---|---|---|---|---|\n`;
  for (const [label, d] of rijen) {
    const log = d.log ? d.log.replace('/Users/clawdboot/sonty/', '') : '–';
    const bewaking = d.uitgeschakeld ? 'uitgeschakeld'
      : d.heartbeat ? `heartbeat ${d.heartbeat.maxStilMin} min + zelfherstel`
      : d.maxUur ? `log < ${d.maxUur}u` : 'alleen geladen-check';
    md += `| \`${label}\` | ${d.functie} | ${d.ritme} | ${log} | ${bewaking}${d.ks ? ' · KS' : ''} |\n`;
  }
}

md += `\n## Vaste afspraken
- Nieuwe dienst? Registreer hem in \`data/systemen-register.json\` — dashboard én health-check
  volgen vanzelf. Een draaiende dienst zonder registratie wordt automatisch gemeld.
- Credentials horen in \`scripts/secrets.js\` (gitignored), acties richting klant in het
  audit-log (\`logs/audit.jsonl\` via \`scripts/audit.js\`).
- Bekende single point of failure: alles draait op één Mac mini (kernel panic 21-07).
  Cloud-migratie van kritieke flows = aparte beslissing van Daimy.
`;

fs.writeFileSync(UIT, md);
console.log(`SYSTEMEN.md gegenereerd: ${Object.keys(reg.diensten).length} diensten`);
