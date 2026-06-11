// Sonty Medewerker Portaal
let currentRole = null;
let deals = [];
let stageMap = {};

const ROLE_COLORS = {
  sales: '#FF6B00',
  planning: '#3498db',
  monteurs: '#2ecc71',
  klantenservice: '#9b59b6'
};

const ROLE_LABELS = {
  sales: 'Sales',
  planning: 'Planning',
  monteurs: 'Monteurs & Inmeters',
  klantenservice: 'Klantenservice'
};

const PRODUCT_LABELS = {
  voorraadscherm: 'Voorraadscherm', knikarmscherm: 'Knikarmscherm',
  uitvalscherm: 'Uitvalscherm', raamdeco_binnen: 'Raamdeco Binnen',
  behang: 'Behang', rolluiken: 'Rolluiken', screens: 'Screens',
  pergola: 'Pergola', markiezen: 'Markiezen',
  zonwering_buiten: 'Zonwering Buiten', reparatie: 'Reparatie'
};

// ── Login ──
document.querySelector('.role-grid').addEventListener('click', (e) => {
  const btn = e.target.closest('.role-btn');
  if (!btn) return;
  currentRole = btn.dataset.role;
  login(currentRole);
});

function login(role) {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').classList.add('active');
  const badge = document.getElementById('headerRole');
  badge.textContent = ROLE_LABELS[role];
  badge.style.background = ROLE_COLORS[role] + '30';
  badge.style.color = ROLE_COLORS[role];
  buildTabs(role);
  loadData();
}

function logout() {
  currentRole = null;
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('app').classList.remove('active');
}

// ── Tabs per role ──
const ROLE_TABS = {
  sales: [
    { id: 'overzicht', label: 'Overzicht' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'handleiding', label: 'Handleiding' },
    { id: 'ideeen', label: 'Idee insturen' },
    { id: 'faq', label: 'FAQ' }
  ],
  planning: [
    { id: 'overzicht', label: 'Overzicht' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'handleiding', label: 'Handleiding' },
    { id: 'ideeen', label: 'Idee insturen' },
    { id: 'faq', label: 'FAQ' }
  ],
  monteurs: [
    { id: 'overzicht', label: 'Overzicht' },
    { id: 'handleiding', label: 'Handleiding' },
    { id: 'ideeen', label: 'Idee insturen' },
    { id: 'faq', label: 'FAQ' }
  ],
  klantenservice: [
    { id: 'overzicht', label: 'Overzicht' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'handleiding', label: 'Handleiding' },
    { id: 'ideeen', label: 'Idee insturen' },
    { id: 'faq', label: 'FAQ' }
  ]
};

let activeTab = 'overzicht';

function buildTabs(role) {
  const tabs = ROLE_TABS[role];
  const container = document.getElementById('tabsContainer');
  container.innerHTML = tabs.map(t =>
    `<button class="tab ${t.id === activeTab ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>`
  ).join('');

  container.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    activeTab = tab.dataset.tab;
    container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderTab();
  });

  renderTab();
}

// ── Data ──
async function loadData() {
  try {
    const [dealsRes, pipeRes] = await Promise.all([
      fetch('/api/deals').then(r => r.json()),
      fetch('/api/pipeline').then(r => r.json())
    ]);
    deals = dealsRes.deals || [];
    stageMap = {};
    if (pipeRes.stages) {
      pipeRes.stages.forEach(s => {
        stageMap[s.id] = { label: s.label, displayOrder: s.displayOrder };
      });
    }
    renderTab();
  } catch (err) {
    console.error('Data laden mislukt:', err);
  }
}

function dealStatus(props) {
  if (props.hs_is_closed_won === 'true') return 'won';
  if (props.hs_is_closed_lost === 'true') return 'lost';
  return 'open';
}

// ── Render ──
function renderTab() {
  const el = document.getElementById('tabContent');
  switch (activeTab) {
    case 'overzicht': el.innerHTML = renderOverzicht(); break;
    case 'pipeline': el.innerHTML = renderPipeline(); break;
    case 'handleiding': el.innerHTML = renderHandleiding(); break;
    case 'ideeen': el.innerHTML = renderIdeeen(); setupIdeaForm(); break;
    case 'faq': el.innerHTML = renderFAQ(); setupFAQ(); break;
    default: el.innerHTML = '';
  }
}

function renderOverzicht() {
  const open = deals.filter(d => dealStatus(d.properties) === 'open').length;
  const won = deals.filter(d => dealStatus(d.properties) === 'won').length;
  const lost = deals.filter(d => dealStatus(d.properties) === 'lost').length;
  const total = deals.length;

  // Role-specific stats
  let extraStats = '';
  if (currentRole === 'sales') {
    const activeCalls = deals.filter(d => {
      const bp = parseInt(d.properties.aantal_belpogingen) || 0;
      return bp > 0 && bp < 6 && dealStatus(d.properties) === 'open';
    }).length;
    extraStats = `
      <div class="stat-card"><div class="stat-label">Actieve belpogingen</div><div class="stat-value">${activeCalls}</div></div>
    `;
  } else if (currentRole === 'monteurs') {
    const installaties = deals.filter(d => {
      const stage = stageMap[d.properties.dealstage];
      return stage && (stage.label.includes('Installatie') || stage.label.includes('Montage'));
    }).length;
    const inmetingen = deals.filter(d => {
      const stage = stageMap[d.properties.dealstage];
      return stage && (stage.label.includes('Inmeet') || stage.label.includes('Opmeting'));
    }).length;
    extraStats = `
      <div class="stat-card"><div class="stat-label">Installaties</div><div class="stat-value">${installaties}</div></div>
      <div class="stat-card"><div class="stat-label">Inmetingen</div><div class="stat-value">${inmetingen}</div></div>
    `;
  } else if (currentRole === 'planning') {
    const teplannen = deals.filter(d => {
      const stage = stageMap[d.properties.dealstage];
      return stage && (stage.label.includes('Inplannen') || stage.label.includes('Gepland'));
    }).length;
    extraStats = `
      <div class="stat-card"><div class="stat-label">Te plannen</div><div class="stat-value">${teplannen}</div></div>
    `;
  }

  // Product breakdown
  const products = {};
  deals.filter(d => dealStatus(d.properties) === 'open').forEach(d => {
    const p = d.properties.product_categorie || 'Onbekend';
    products[p] = (products[p] || 0) + 1;
  });
  const productList = Object.entries(products)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `<div class="pipeline-stage"><span class="stage-name">${PRODUCT_LABELS[k] || k}</span><span class="stage-count">${v}</span></div>`)
    .join('');

  return `
    <div class="section-title">Overzicht</div>
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Totaal deals</div><div class="stat-value">${total}</div></div>
      <div class="stat-card"><div class="stat-label">Open</div><div class="stat-value accent">${open}</div></div>
      <div class="stat-card"><div class="stat-label">Gewonnen</div><div class="stat-value" style="color:var(--green)">${won}</div></div>
      <div class="stat-card"><div class="stat-label">Verloren</div><div class="stat-value" style="color:var(--red)">${lost}</div></div>
      ${extraStats}
    </div>
    <div class="card">
      <h3>Open deals per product</h3>
      ${productList || '<p>Geen open deals</p>'}
    </div>
  `;
}

function renderPipeline() {
  const stages = Object.entries(stageMap)
    .sort((a, b) => a[1].displayOrder - b[1].displayOrder);

  const stageCounts = {};
  deals.forEach(d => {
    const s = d.properties.dealstage;
    if (s) stageCounts[s] = (stageCounts[s] || 0) + 1;
  });

  const maxCount = Math.max(...Object.values(stageCounts), 1);

  const stageRows = stages.map(([id, info]) => {
    const count = stageCounts[id] || 0;
    const barWidth = Math.max(4, (count / maxCount) * 100);
    return `<div class="pipeline-stage">
      <span class="stage-name">${info.label}</span>
      <div style="flex:1;max-width:200px;background:var(--dark-border);border-radius:3px;height:6px;">
        <div class="stage-bar" style="width:${barWidth}%"></div>
      </div>
      <span class="stage-count">${count}</span>
    </div>`;
  }).join('');

  return `
    <div class="section-title">Pipeline Overzicht</div>
    <p style="color:var(--gray);font-size:13px;margin-bottom:16px;">Hoeveel deals er in elke fase staan. Dit is een read-only overzicht.</p>
    <div class="card">
      ${stageRows}
    </div>
  `;
}

let guidesCache = null;

async function loadGuides() {
  try {
    const res = await fetch(`/api/guides/${currentRole}`);
    return await res.json();
  } catch { return null; }
}

function renderHandleiding() {
  // Show loading, then fetch guides
  const el = document.getElementById('tabContent');
  el.innerHTML = `
    <div class="section-title">Handleiding ${ROLE_LABELS[currentRole]}</div>
    <p style="color:var(--gray);font-size:13px;">Laden...</p>
  `;

  loadGuides().then(guide => {
    if (!guide || !guide.sections) {
      el.innerHTML += '<p style="color:var(--red);">Handleiding niet gevonden.</p>';
      return;
    }

    let html = `
      <div class="section-title">${guide.title}</div>
      <p style="color:var(--gray);font-size:13px;margin-bottom:24px;">${guide.intro}</p>
    `;

    guide.sections.forEach(section => {
      html += `<div class="card" style="margin-bottom:20px;">
        <h3 style="font-size:16px;color:var(--accent);margin-bottom:16px;">${section.title}</h3>`;

      section.steps.forEach((step, i) => {
        const linkHtml = step.link
          ? `<a href="${step.link}" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;padding:6px 14px;background:var(--accent);color:#fff;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none;">${step.linkLabel || 'Openen'}</a>`
          : '';
        html += `<div class="guide-step">
          <div class="step-number">${i + 1}</div>
          <div class="step-content">
            <div class="step-title">${step.action}</div>
            <div class="step-desc">${step.detail}</div>
            ${linkHtml}
          </div>
        </div>`;
      });

      html += `</div>`;
    });

    el.innerHTML = html;
  });

  return '';
}

function renderIdeeen() {
  return `
    <div class="section-title">Idee of Suggestie Insturen</div>
    <p style="color:var(--gray);font-size:13px;margin-bottom:16px;">
      Heb je een idee om iets te verbeteren? Stuur het in! Het komt direct bij de eigenaar terecht.
    </p>
    <div class="idea-form">
      <h3>Nieuw idee</h3>
      <form id="ideaForm">
        <div class="field" style="margin-bottom:12px;">
          <label>Je naam</label>
          <input type="text" id="ideaAuthor" placeholder="Bijv. Jan" required>
        </div>
        <div class="field" style="margin-bottom:12px;">
          <label>Idee / Suggestie</label>
          <input type="text" id="ideaTitle" placeholder="Bijv. Automatische herinnering voor klanten" required>
        </div>
        <div class="field" style="margin-bottom:12px;">
          <label>Toelichting (optioneel)</label>
          <textarea id="ideaDesc" placeholder="Leg uit waarom dit een goed idee is..."></textarea>
        </div>
        <button type="submit" class="submit-btn">Insturen</button>
      </form>
      <div class="success-msg" id="ideaSuccess">Je idee is verstuurd! De eigenaar kan het nu zien in het dashboard.</div>
    </div>
  `;
}

function setupIdeaForm() {
  const form = document.getElementById('ideaForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('ideaTitle').value;
    const description = document.getElementById('ideaDesc').value;
    const author = document.getElementById('ideaAuthor').value;
    if (!title) return;

    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, author, role: currentRole })
      });
      const data = await res.json();
      if (data.ok) {
        document.getElementById('ideaSuccess').style.display = 'block';
        document.getElementById('ideaTitle').value = '';
        document.getElementById('ideaDesc').value = '';
        setTimeout(() => {
          const msg = document.getElementById('ideaSuccess');
          if (msg) msg.style.display = 'none';
        }, 4000);
      }
    } catch (err) {
      alert('Fout bij versturen: ' + err.message);
    }
  });
}

function renderFAQ() {
  const faqs = {
    sales: [
      { q: 'Hoeveel belpogingen moet ik doen?', a: 'Maximaal 6 belpogingen per lead. Na 6 pogingen zonder contact gaat de lead automatisch naar de nurture sequence. Het systeem houdt dit bij via HubSpot.' },
      { q: 'Wanneer is de beste tijd om te bellen?', a: 'Ochtend (08:30-10:00) heeft de hoogste bereikbaarheid (28-32%). Late middag (16:00-17:00) is ook goed. Vermijd lunchtijd.' },
      { q: 'Hoeveel korting mag ik geven?', a: 'Overleg altijd eerst met de eigenaar. Standaard is max. overleg. Bij prijsbezwaar: leg de kwaliteit uit (Sunmaster, eigen monteurs, garantie). Nodig uit voor de showroom — dat converteert 10x beter.' },
      { q: 'Wat als een klant bij een concurrent goedkoper kan?', a: 'Benadruk de kwaliteit: A-merk producten, eigen gecertificeerde monteurs, garantie op product en installatie, 4.9/5 beoordeling. Vraag wat de concurrent precies aanbiedt — vaak is het een lager segment product.' },
      { q: 'Hoe plan ik een opmeting in?', a: 'Verplaats de deal in HubSpot naar "Inmeetafspraak Inplannen". De planning-afdeling pakt het dan op en plant het in via Planado.' }
    ],
    planning: [
      { q: 'Hoe lang duurt een inmeting?', a: 'Gemiddeld 30-45 minuten per adres. Plan geen twee inmetingen direct achter elkaar — rijd- en gesprekstijd meenemen.' },
      { q: 'Hoe lang duurt een installatie?', a: 'Afhankelijk van het product. Screens: 2-4 uur. Knikarmscherm: 3-5 uur. Pergola: hele dag. Rolluiken: 3-6 uur per raam.' },
      { q: 'Wat als een klant wil herplannen?', a: 'Pas de afspraak aan in Planado. Bel de klant om een nieuw tijdstip af te spreken. Stuur ook een WhatsApp ter bevestiging.' },
      { q: 'Wie doet welke producten?', a: 'Check de monteur-vaardigheden in Planado. Niet elke monteur kan elk product installeren. Bij twijfel: overleg met de eigenaar.' }
    ],
    monteurs: [
      { q: 'Wat neem ik mee naar een inmeting?', a: 'Meetlint, laser afstandsmeter, notitieboek of tablet, fototoestel/telefoon. Check vooraf de opdracht in Planado voor bijzonderheden.' },
      { q: 'Klant is niet thuis, wat nu?', a: 'Bel het kantoor direct. Wacht maximaal 15 minuten. Het kantoor regelt contact met de klant en eventueel een nieuwe afspraak.' },
      { q: 'Er klopt iets niet met de bestelling?', a: 'NIET zelf oplossen of beloftes doen. Bel direct het kantoor. Neem foto\'s van het probleem. Het kantoor regelt de rest.' },
      { q: 'Kan ik materiaal retourneren?', a: 'Alleen via het kantoor. Neem beschadigd of verkeerd materiaal mee terug en meld het direct bij planning.' }
    ],
    klantenservice: [
      { q: 'Klant vraagt naar de status, wat zeg ik?', a: 'Zoek de deal op in HubSpot. Kijk in welke fase die staat. Leg uit wat de volgende stap is: "Uw opmeting staat gepland voor...", "We wachten nog op het materiaal..."' },
      { q: 'Klant heeft een klacht, wat doe ik?', a: 'Luister goed, noteer alles. Maak een notitie bij de deal in HubSpot. Bij urgente klachten: stuur direct een idee in via dit portaal zodat de eigenaar het ziet.' },
      { q: 'Hoe beantwoord ik WhatsApp?', a: 'Gebruik Trengo. Beantwoord binnen 1 uur tijdens kantooruren. Gebruik een vriendelijke, professionele toon. Begin altijd met de naam van de klant.' },
      { q: 'Klant wil annuleren, wat nu?', a: 'Probeer te achterhalen waarom. Noteer de reden in HubSpot. Informeer de eigenaar. Verplaats de deal NIET zelf naar "Verloren" — dat doet de eigenaar.' },
      { q: 'Nieuwe service/reparatie aanvraag?', a: 'Maak een nieuwe deal aan in HubSpot met product "Reparatie". Noteer het probleem. Planning plant dan een service-afspraak in.' }
    ]
  };

  const items = faqs[currentRole] || [];
  const faqHtml = items.map(f =>
    `<div class="faq-item">
      <div class="faq-question">
        <span>${f.q}</span>
        <span class="faq-arrow">&#9654;</span>
      </div>
      <div class="faq-answer">${f.a}</div>
    </div>`
  ).join('');

  return `
    <div class="section-title">Veelgestelde Vragen</div>
    <p style="color:var(--gray);font-size:13px;margin-bottom:16px;">Klik op een vraag voor het antwoord.</p>
    ${faqHtml}
  `;
}

function setupFAQ() {
  document.querySelectorAll('.faq-item').forEach(item => {
    item.querySelector('.faq-question').addEventListener('click', () => {
      item.classList.toggle('open');
    });
  });
}
