/**
 * Fix Planado job durations based on job type (from description/subject)
 *
 * Default durations (from product-tijden.json):
 * - Inmeten/Opmeting: 60 min
 * - Montage: 155 min (gemiddeld)
 * - Showroom: 60 min
 * - Service/Reparatie: 60 min
 * - Overig: 60 min
 */

const PLANADO_API = 'https://api.planadoapp.com/v2';
const PLANADO_KEY = 'b9877b84119475b39953cb5dd0c409a7704ef669fe569bc1745c99275cef';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function classifyAndGetDuration(description) {
  const s = (description || '').toLowerCase();

  if (s.includes('inmeten') || s.includes('inmeet') || s.includes('opmeting')) {
    return { type: 'Opmeting', minutes: 60 };
  }
  if (s.includes('montage') || s.includes('installatie') || s.includes('plaatsen')) {
    // Check for specific product types for more accurate duration
    if (s.includes('pergola')) return { type: 'Montage (Pergola)', minutes: 480 };
    if (s.includes('markies') || s.includes('knikarm')) return { type: 'Montage (Markies)', minutes: 240 };
    if (s.includes('screen')) return { type: 'Montage (Screens)', minutes: 150 };
    if (s.includes('rolluik')) return { type: 'Montage (Rolluik)', minutes: 180 };
    if (s.includes('zonwering')) return { type: 'Montage (Zonwering)', minutes: 180 };
    if (s.includes('behang')) return { type: 'Montage (Behang)', minutes: 240 };
    if (s.includes('shutter')) return { type: 'Montage (Shutters)', minutes: 120 };
    if (s.includes('gordijn')) return { type: 'Montage (Gordijn)', minutes: 90 };
    return { type: 'Montage', minutes: 120 }; // mediaan uit data
  }
  if (s.includes('showroom') || s.includes('winkel')) {
    return { type: 'Showroom', minutes: 60 };
  }
  if (s.includes('service') || s.includes('reparatie') || s.includes('nazorg')) {
    return { type: 'Service', minutes: 60 };
  }
  if (s.includes('onderhoud')) {
    return { type: 'Onderhoud', minutes: 60 };
  }
  // Default for unclassified
  return { type: 'Overig', minutes: 60 };
}

(async () => {
  console.log('Planado Job Duration Fixer\n');

  // Get all jobs
  let allJobs = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${PLANADO_API}/jobs?page=${page}&per_page=100`, {
      headers: { 'Authorization': `Bearer ${PLANADO_KEY}`, 'Accept': 'application/json' }
    });
    const data = await res.json();
    const jobs = data.jobs || [];
    if (jobs.length === 0) break;
    allJobs = allJobs.concat(jobs);
    page++;
    await sleep(500);
  }

  console.log(`Totaal jobs: ${allJobs.length}`);

  // Find jobs with 0 or missing duration
  const zeroDuration = allJobs.filter(j => {
    const dur = j.scheduled_duration;
    if (!dur) return true;
    const totalMin = (dur.hours || 0) * 60 + (dur.minutes || 0);
    return totalMin === 0;
  });

  console.log(`Jobs met 0 duur: ${zeroDuration.length}`);

  // For each job, we need to get its description to classify it
  let fixed = 0;
  let skipped = 0;
  const typeCounts = {};

  for (const job of zeroDuration) {
    // Get job details
    await sleep(500);
    const detailRes = await fetch(`${PLANADO_API}/jobs/${job.uuid}`, {
      headers: { 'Authorization': `Bearer ${PLANADO_KEY}`, 'Accept': 'application/json' }
    });
    const detail = await detailRes.json();
    const desc = detail.description || '';

    const { type, minutes } = classifyAndGetDuration(desc);
    typeCounts[type] = (typeCounts[type] || 0) + 1;

    // Update duration
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    await sleep(500);
    const updateRes = await fetch(`${PLANADO_API}/jobs/${job.uuid}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${PLANADO_KEY}`,
        'Content-Type': 'application/json',
        'X-Planado-Notify-Assignees': 'false',
      },
      body: JSON.stringify({
        scheduled_duration: { hours, minutes: mins },
        version: job.version,
      }),
    });

    if (updateRes.ok) {
      fixed++;
      if (fixed % 20 === 0) console.log(`  ... ${fixed}/${zeroDuration.length} bijgewerkt`);
    } else {
      skipped++;
      const err = await updateRes.text();
      if (fixed === 0 && skipped === 1) console.log(`  First error: ${err}`);
    }
  }

  console.log(`\nResultaat:`);
  console.log(`  Bijgewerkt: ${fixed}`);
  console.log(`  Overgeslagen: ${skipped}`);
  console.log(`\nVerdeling per type:`);
  Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
})();
