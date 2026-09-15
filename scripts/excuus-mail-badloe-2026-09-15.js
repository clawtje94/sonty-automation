// Badloe: afspraak is door haar geannuleerd na de fouten; aparte excuusmail met aanbod om opnieuw te plannen. --execute om te sturen.
const { trengoFetch } = require('./lib/trengo-fetch.js');
const EXEC = process.argv.includes('--execute'); const email = 's_sewpersad@hotmail.com'; const KANAAL = 1363384;
const onderwerp = 'Onze excuses, Saskia';
const html = `<p>Beste Saskia,</p>
<p>Je hebt de afgelopen dagen meerdere keren hetzelfde voorstel voor een inmeetafspraak van ons gekregen, daarna een bevestiging en gisteren een mail "Geannuleerd: Inmeten". Dat is niet hoe het hoort en daarvoor bieden we je onze excuses aan. We stappen op dit moment over naar een nieuw planningssysteem en daar is het bij jou misgegaan.</p>
<p>We begrijpen dat je de afspraak daarom hebt afgezegd. Als je het ons wilt laten goedmaken, plannen we graag een nieuw moment dat jou uitkomt. Antwoord op deze mail of stuur een WhatsApp naar 085 006 9681, dan regelt een collega het persoonlijk met je.</p>
<p>Met vriendelijke groet,<br>Nanny<br>Sonty Zonwering<br>aanvragen@sonty.nl · 085 006 9681</p>`;
(async () => { if (!EXEC) { console.log('DROOG →', email, '|', onderwerp); return; }
  const r1 = await trengoFetch('/tickets', { method: 'POST', body: JSON.stringify({ channel_id: KANAAL, contact_identifier: email, subject: onderwerp }) }); const t = await r1.json();
  const r2 = await trengoFetch(`/tickets/${t.id}/messages`, { method: 'POST', body: JSON.stringify({ message: html, body_type: 'html' }) });
  console.log(r2.ok ? 'VERSTUURD' : 'MISLUKT ' + r2.status, email, 'ticket', t.id, '(ticket blijft OPEN zodat een collega het oppakt)'); })().catch(e => console.error('FOUT', e.message));
