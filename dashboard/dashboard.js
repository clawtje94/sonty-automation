// Sonty Dashboard — dashboard.js
// Globals
let allDeals = [];
let adSpendData = [];
let stageMap = {};  // stageId -> { label, displayOrder }
let chartInstances = {};
let currentSort = { col: 'createdate', dir: 'desc' };

// ── Helpers ──────────────────────────────────────────────

function fmt(n) {
  if (n == null || isNaN(n)) return '€ 0';
  return '€ ' + Number(n).toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function pct(n) {
  if (n == null || isNaN(n)) return '0%';
  return Number(n).toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

function dateStr(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function monthKey(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
  const [y, m] = key.split('-');
  const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function getWeekKey(iso) {
  const d = new Date(iso);
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function dealStatus(props) {
  if (props.hs_is_closed_won === 'true') return 'won';
  if (props.hs_is_closed_lost === 'true') return 'lost';
  return 'open';
}

function stageName(stageId) {
  return stageMap[stageId]?.label || stageId || '-';
}

const PRODUCT_LABELS = {
  voorraadscherm: 'Voorraadscherm',
  knikarmscherm: 'Knikarmscherm',
  uitvalscherm: 'Uitvalscherm',
  raamdeco_binnen: 'Raamdeco Binnen',
  behang: 'Behang',
  rolluiken: 'Rolluiken',
  screens: 'Screens',
  pergola: 'Pergola',
  markiezen: 'Markiezen',
  zonwering_buiten: 'Zonwering Buiten',
  reparatie: 'Reparatie'
};

const SOURCE_LABELS = {
  ORGANIC_SEARCH: 'Organisch zoeken',
  PAID_SEARCH: 'Betaald zoeken',
  PAID_SOCIAL: 'Betaald sociaal',
  DIRECT_TRAFFIC: 'Direct verkeer',
  REFERRALS: 'Verwijzingen',
  EMAIL_MARKETING: 'E-mailmarketing',
  SOCIAL_MEDIA: 'Social media',
  OTHER_CAMPAIGNS: 'Overige campagnes',
  OFFLINE: 'Offline',
  OTHER: 'Overig'
};

const CHART_COLORS = [
  '#FF6B00', '#3498db', '#2ecc71', '#e74c3c', '#9b59b6',
  '#f1c40f', '#1abc9c', '#e67e22', '#2980b9', '#d35400',
  '#8e44ad', '#16a085'
];

// ── Chart.js Dark Mode Defaults ──────────────────────────
Chart.defaults.color = '#888';
Chart.defaults.borderColor = '#2a2a2a';
Chart.defaults.plugins.legend.labels.color = '#bbb';
Chart.defaults.plugins.tooltip.backgroundColor = '#1a1a1a';
Chart.defaults.plugins.tooltip.titleColor = '#fff';
Chart.defaults.plugins.tooltip.bodyColor = '#bbb';
Chart.defaults.plugins.tooltip.borderColor = '#333';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.scale.grid = { color: '#1e1e1e' };
Chart.defaults.scale.ticks = { color: '#666' };

// ── Data Loading ──────────────────────────────────────────

async function loadData() {
  document.getElementById('loading').style.display = 'flex';
  try {
    const res = await fetch('/api/all');
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    allDeals = data.deals || [];
    adSpendData = data.adSpend || [];
    stageMap = {};
    if (data.pipeline && data.pipeline.stages) {
      data.pipeline.stages.forEach(s => {
        stageMap[s.id] = { label: s.label, displayOrder: s.displayOrder };
      });
    }

    populateFilters();
    renderAll();
    renderAdSpend();

    document.getElementById('lastUpdate').textContent =
      'Bijgewerkt: ' + new Date().toLocaleTimeString('nl-NL');
    updateConnectionStatus(true);
  } catch (err) {
    console.error('Fout bij laden:', err);
    updateConnectionStatus(false);
    alert('Fout bij laden van data: ' + err.message);
  }
  document.getElementById('loading').style.display = 'none';
}

function updateConnectionStatus(online) {
  const el = document.getElementById('connectionStatus');
  if (!el) return;
  const dot = el.querySelector('.status-dot');
  const label = el.querySelector('span:last-child');
  if (online) {
    dot.className = 'status-dot online';
    dot.style.background = 'var(--green)';
    label.textContent = 'Live';
    el.style.color = 'var(--green)';
  } else {
    dot.className = 'status-dot offline';
    dot.style.background = 'var(--red)';
    dot.style.animation = 'none';
    label.textContent = 'Offline';
    el.style.color = 'var(--red)';
  }
}

function populateFilters() {
  // Month filter
  const monthSet = new Set();
  allDeals.forEach(d => {
    const mk = monthKey(d.properties.createdate);
    if (mk) monthSet.add(mk);
    const ck = monthKey(d.properties.closedate);
    if (ck) monthSet.add(ck);
  });
  const months = [...monthSet].sort().reverse();
  const monthSel = document.getElementById('monthFilter');
  const currentVal = monthSel.value;
  monthSel.innerHTML = '<option value="all">Alle maanden</option>';
  months.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = monthLabel(m);
    monthSel.appendChild(opt);
  });
  monthSel.value = currentVal || 'all';

  // Product filter
  const products = new Set();
  allDeals.forEach(d => {
    const p = d.properties.product_categorie;
    if (p) products.add(p);
  });
  const prodSel = document.getElementById('filterProduct');
  const prodVal = prodSel.value;
  prodSel.innerHTML = '<option value="all">Alle producten</option>';
  [...products].sort().forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = PRODUCT_LABELS[p] || p;
    prodSel.appendChild(opt);
  });
  prodSel.value = prodVal || 'all';
}

// ── Filtered deals ──────────────────────────────────────────

function getFilteredDeals() {
  const mf = document.getElementById('monthFilter').value;
  if (mf === 'all') return allDeals;
  return allDeals.filter(d => {
    const ck = monthKey(d.properties.createdate);
    const dk = monthKey(d.properties.closedate);
    return ck === mf || dk === mf;
  });
}

function getMonthWonDeals(month) {
  return allDeals.filter(d => {
    if (d.properties.hs_is_closed_won !== 'true') return false;
    const ck = monthKey(d.properties.closedate);
    return ck === month;
  });
}

// ── Render All ──────────────────────────────────────────

function renderAll() {
  renderKPIs();
  renderCharts();
  renderSourcePerformance();
  renderTable();
}

// ── KPIs ──────────────────────────────────────────

function getTopProduct(month) {
  const wonDeals = getMonthWonDeals(month);
  if (wonDeals.length === 0) {
    // Fallback: count all deals in that month
    const monthDeals = allDeals.filter(d => monthKey(d.properties.createdate) === month);
    if (monthDeals.length === 0) return '-';
    const counts = {};
    monthDeals.forEach(d => {
      const p = d.properties.product_categorie;
      if (p) counts[p] = (counts[p] || 0) + 1;
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? (PRODUCT_LABELS[top[0]] || top[0]) : '-';
  }
  const counts = {};
  wonDeals.forEach(d => {
    const p = d.properties.product_categorie;
    if (p) counts[p] = (counts[p] || 0) + 1;
  });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? (PRODUCT_LABELS[top[0]] || top[0]) : '-';
}

function renderKPIs() {
  const mf = document.getElementById('monthFilter').value;
  const now = new Date();
  const currentMonth = mf !== 'all' ? mf : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const wonDeals = getMonthWonDeals(currentMonth);
  const omzet = wonDeals.reduce((s, d) => s + (parseFloat(d.properties.amount) || 0), 0);
  const inkoop = wonDeals.reduce((s, d) => s + (parseFloat(d.properties.inkoopbedrag) || 0), 0);
  const marge = omzet - inkoop;
  const margePct = omzet > 0 ? (marge / omzet) * 100 : 0;

  // Leads this month
  const leadsMonth = allDeals.filter(d => monthKey(d.properties.createdate) === currentMonth).length;

  // Win rate
  const closedMonth = allDeals.filter(d => {
    const ck = monthKey(d.properties.closedate);
    return ck === currentMonth && (d.properties.hs_is_closed_won === 'true' || d.properties.hs_is_closed_lost === 'true');
  });
  const wonCount = closedMonth.filter(d => d.properties.hs_is_closed_won === 'true').length;
  const winRate = closedMonth.length > 0 ? (wonCount / closedMonth.length) * 100 : 0;

  // Average deal value (won this month)
  const avgDeal = wonDeals.length > 0 ? omzet / wonDeals.length : 0;

  // Average days to close
  const daysArr = wonDeals.map(d => parseFloat(d.properties.days_to_close)).filter(n => !isNaN(n));
  const avgDays = daysArr.length > 0 ? daysArr.reduce((a, b) => a + b, 0) / daysArr.length : 0;

  const monthLbl = monthLabel(currentMonth);
  // Ad spend for this month
  const monthSpend = adSpendData.find(s => s.month === currentMonth);
  const totalAdSpend = monthSpend ? (monthSpend.google || 0) + (monthSpend.meta || 0) : 0;
  const costPerLead = leadsMonth > 0 && totalAdSpend > 0 ? totalAdSpend / leadsMonth : 0;
  const roas = totalAdSpend > 0 ? omzet / totalAdSpend : 0;

  const kpis = [
    { label: `Omzet ${monthLbl}`, value: fmt(omzet), accent: true },
    { label: `Totale inkoop`, value: fmt(inkoop) },
    { label: `Bruto marge`, value: fmt(marge), sub: pct(margePct) },
    { label: `Ad spend`, value: fmt(totalAdSpend), sub: totalAdSpend > 0 ? `G: ${fmt(monthSpend?.google || 0)} / M: ${fmt(monthSpend?.meta || 0)}` : '' },
    { label: `Nieuwe leads`, value: leadsMonth },
    { label: `Kosten per lead`, value: costPerLead > 0 ? fmt(costPerLead) : '-' },
    { label: `ROAS`, value: roas > 0 ? roas.toFixed(1) + 'x' : '-', sub: roas > 0 ? `${fmt(omzet)} / ${fmt(totalAdSpend)}` : '' },
    { label: `Netto winst`, value: fmt(marge - totalAdSpend), sub: `${fmt(marge)} marge - ${fmt(totalAdSpend)} ads` },
    { label: `Slagingspercentage`, value: pct(winRate) },
    { label: `Gem. dealwaarde`, value: fmt(avgDeal) },
    { label: `Gem. dagen tot sluiting`, value: Math.round(avgDays) || '-' },
    { label: `Top product`, value: getTopProduct(currentMonth), sub: 'best verkopend' },
  ];

  const grid = document.getElementById('kpiGrid');
  grid.innerHTML = kpis.map(k => `
    <div class="kpi-card">
      <div class="label">${k.label}</div>
      <div class="value ${k.accent ? 'accent' : ''}">${k.value}</div>
      ${k.sub ? `<div class="sub">${k.sub}</div>` : ''}
    </div>
  `).join('');
}

// ── Charts ──────────────────────────────────────────

function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

function renderCharts() {
  renderRevenueChart();
  renderFunnelChart();
  renderConversionChart();
  renderProductChart();
  renderSourceChart();
  renderLeadsWeekChart();
  renderLostReasonsChart();
}

function renderRevenueChart() {
  destroyChart('chartRevenue');
  // Last 6 months
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const omzetData = [], inkoopData = [], margeData = [];
  months.forEach(m => {
    const won = getMonthWonDeals(m);
    const o = won.reduce((s, d) => s + (parseFloat(d.properties.amount) || 0), 0);
    const i = won.reduce((s, d) => s + (parseFloat(d.properties.inkoopbedrag) || 0), 0);
    omzetData.push(o);
    inkoopData.push(i);
    margeData.push(o - i);
  });

  chartInstances['chartRevenue'] = new Chart(document.getElementById('chartRevenue'), {
    type: 'bar',
    data: {
      labels: months.map(monthLabel),
      datasets: [
        { label: 'Omzet', data: omzetData, backgroundColor: '#FF6B00' },
        { label: 'Inkoop', data: inkoopData, backgroundColor: '#3498db' },
        { label: 'Marge', data: margeData, backgroundColor: '#2ecc71' }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.raw)}` }
        }
      },
      scales: {
        y: {
          ticks: { callback: v => fmt(v) }
        }
      }
    }
  });
}

function renderFunnelChart() {
  destroyChart('chartFunnel');
  const deals = getFilteredDeals();
  // Count deals per stage, ordered by displayOrder
  const stages = Object.entries(stageMap)
    .sort((a, b) => a[1].displayOrder - b[1].displayOrder);

  const stageCounts = {};
  deals.forEach(d => {
    const s = d.properties.dealstage;
    if (s) stageCounts[s] = (stageCounts[s] || 0) + 1;
  });

  const labels = stages.map(([, v]) => v.label);
  const data = stages.map(([k]) => stageCounts[k] || 0);

  chartInstances['chartFunnel'] = new Chart(document.getElementById('chartFunnel'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Deals',
        data,
        backgroundColor: '#FF6B00',
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });
}

function renderConversionChart() {
  destroyChart('chartConversion');
  const deals = getFilteredDeals();
  const stages = Object.entries(stageMap)
    .sort((a, b) => a[1].displayOrder - b[1].displayOrder);

  if (stages.length < 2) return;

  // Count deals that reached each stage or beyond
  const stageCounts = {};
  deals.forEach(d => {
    const s = d.properties.dealstage;
    if (s) stageCounts[s] = (stageCounts[s] || 0) + 1;
  });

  // Cumulative: deals at stage N or later
  const cumulative = [];
  let runningTotal = 0;
  // Start from the last stage and accumulate backwards
  for (let i = stages.length - 1; i >= 0; i--) {
    runningTotal += stageCounts[stages[i][0]] || 0;
    cumulative[i] = runningTotal;
  }

  // Conversion rates between consecutive stages
  const labels = [];
  const rates = [];
  for (let i = 0; i < stages.length - 1; i++) {
    const from = stages[i][1].label;
    const to = stages[i + 1][1].label;
    const fromCount = cumulative[i] || 0;
    const toCount = cumulative[i + 1] || 0;
    const rate = fromCount > 0 ? (toCount / fromCount) * 100 : 0;
    labels.push(`${from} → ${to}`);
    rates.push(Math.round(rate * 10) / 10);
  }

  chartInstances['chartConversion'] = new Chart(document.getElementById('chartConversion'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Conversie %',
        data: rates,
        backgroundColor: rates.map(r => r >= 50 ? '#27ae60' : r >= 25 ? '#f39c12' : '#e74c3c'),
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => `${ctx.raw}%` }
        }
      },
      scales: {
        x: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } }
      }
    }
  });
}

function renderProductChart() {
  destroyChart('chartProducts');
  const deals = getFilteredDeals();
  const counts = {};
  deals.forEach(d => {
    const p = d.properties.product_categorie || 'Onbekend';
    counts[p] = (counts[p] || 0) + 1;
  });

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  chartInstances['chartProducts'] = new Chart(document.getElementById('chartProducts'), {
    type: 'doughnut',
    data: {
      labels: entries.map(([k]) => PRODUCT_LABELS[k] || k),
      datasets: [{
        data: entries.map(([, v]) => v),
        backgroundColor: CHART_COLORS.slice(0, entries.length)
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'right', labels: { font: { size: 11 } } }
      }
    }
  });
}

function renderSourceChart() {
  destroyChart('chartSources');
  const deals = getFilteredDeals();
  const counts = {};
  deals.forEach(d => {
    const s = d.properties.hs_analytics_source || 'Onbekend';
    counts[s] = (counts[s] || 0) + 1;
  });

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  chartInstances['chartSources'] = new Chart(document.getElementById('chartSources'), {
    type: 'doughnut',
    data: {
      labels: entries.map(([k]) => SOURCE_LABELS[k] || k),
      datasets: [{
        data: entries.map(([, v]) => v),
        backgroundColor: CHART_COLORS.slice(0, entries.length)
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'right', labels: { font: { size: 11 } } }
      }
    }
  });
}

function renderLeadsWeekChart() {
  destroyChart('chartLeadsWeek');
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());

  const weekCounts = {};
  allDeals.forEach(d => {
    const created = new Date(d.properties.createdate);
    if (created >= threeMonthsAgo) {
      const wk = getWeekKey(d.properties.createdate);
      weekCounts[wk] = (weekCounts[wk] || 0) + 1;
    }
  });

  const weeks = Object.keys(weekCounts).sort();
  chartInstances['chartLeadsWeek'] = new Chart(document.getElementById('chartLeadsWeek'), {
    type: 'line',
    data: {
      labels: weeks,
      datasets: [{
        label: 'Nieuwe leads',
        data: weeks.map(w => weekCounts[w]),
        borderColor: '#FF6B00',
        backgroundColor: 'rgba(255,107,0,0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: '#FF6B00'
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });
}

function renderLostReasonsChart() {
  destroyChart('chartLostReasons');
  const deals = getFilteredDeals();
  const reasons = {};
  deals.forEach(d => {
    if (d.properties.hs_is_closed_lost === 'true') {
      const r = d.properties.closed_lost_reason || 'Onbekend';
      reasons[r] = (reasons[r] || 0) + 1;
    }
  });

  const entries = Object.entries(reasons).sort((a, b) => b[1] - a[1]);

  chartInstances['chartLostReasons'] = new Chart(document.getElementById('chartLostReasons'), {
    type: 'bar',
    data: {
      labels: entries.map(([k]) => k),
      datasets: [{
        label: 'Aantal',
        data: entries.map(([, v]) => v),
        backgroundColor: '#e74c3c',
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });
}

// ── Ad Spend ──────────────────────────────────────────

function renderAdSpend() {
  renderAdSpendTable();
  renderAdSpendChart();
  renderCPLChart();
}

function renderAdSpendTable() {
  const tbody = document.getElementById('adspendBody');
  if (!adSpendData.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:16px;color:#999;">Nog geen advertentiekosten ingevoerd</td></tr>';
    return;
  }
  tbody.innerHTML = adSpendData.slice().reverse().map(s => {
    const total = (s.google || 0) + (s.meta || 0);
    return `<tr>
      <td>${monthLabel(s.month)}</td>
      <td>${fmt(s.google || 0)}</td>
      <td>${fmt(s.meta || 0)}</td>
      <td><strong>${fmt(total)}</strong></td>
      <td><button class="adspend-delete" onclick="deleteAdSpend('${s.month}')" title="Verwijderen">x</button></td>
    </tr>`;
  }).join('');
}

function renderAdSpendChart() {
  destroyChart('chartAdSpend');
  if (!adSpendData.length) return;

  const last6 = adSpendData.slice(-6);
  chartInstances['chartAdSpend'] = new Chart(document.getElementById('chartAdSpend'), {
    type: 'bar',
    data: {
      labels: last6.map(s => monthLabel(s.month)),
      datasets: [
        { label: 'Google Ads', data: last6.map(s => s.google || 0), backgroundColor: '#3498db' },
        { label: 'Meta Ads', data: last6.map(s => s.meta || 0), backgroundColor: '#9b59b6' }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.raw)}` } }
      },
      scales: {
        x: { stacked: true },
        y: { stacked: true, ticks: { callback: v => fmt(v) } }
      }
    }
  });
}

function renderCPLChart() {
  destroyChart('chartCPL');
  if (!adSpendData.length) return;

  const last6 = adSpendData.slice(-6);
  const cplData = [], roasData = [];

  last6.forEach(s => {
    const total = (s.google || 0) + (s.meta || 0);
    const leads = allDeals.filter(d => monthKey(d.properties.createdate) === s.month).length;
    const won = getMonthWonDeals(s.month);
    const omzet = won.reduce((sum, d) => sum + (parseFloat(d.properties.amount) || 0), 0);
    cplData.push(leads > 0 && total > 0 ? total / leads : 0);
    roasData.push(total > 0 ? omzet / total : 0);
  });

  chartInstances['chartCPL'] = new Chart(document.getElementById('chartCPL'), {
    type: 'bar',
    data: {
      labels: last6.map(s => monthLabel(s.month)),
      datasets: [
        {
          label: 'Kosten per lead',
          data: cplData,
          backgroundColor: '#e74c3c',
          yAxisID: 'y'
        },
        {
          label: 'ROAS',
          data: roasData,
          type: 'line',
          borderColor: '#27ae60',
          backgroundColor: 'rgba(39,174,96,0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 5,
          pointBackgroundColor: '#27ae60',
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => ctx.dataset.label === 'ROAS'
              ? `ROAS: ${ctx.raw.toFixed(1)}x`
              : `Kosten per lead: ${fmt(ctx.raw)}`
          }
        }
      },
      scales: {
        y: { position: 'left', ticks: { callback: v => fmt(v) }, title: { display: true, text: 'Kosten per lead' } },
        y1: { position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'ROAS' }, ticks: { callback: v => v + 'x' } }
      }
    }
  });
}

async function saveAdSpend(month, google, meta) {
  const res = await fetch('/api/ad-spend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ month, google, meta })
  });
  const data = await res.json();
  if (data.ok) {
    adSpendData = data.data;
    renderAdSpend();
    renderKPIs();
  }
}

async function deleteAdSpend(month) {
  if (!confirm(`Advertentiekosten voor ${monthLabel(month)} verwijderen?`)) return;
  const res = await fetch(`/api/ad-spend/${encodeURIComponent(month)}`, {
    method: 'DELETE'
  });
  const data = await res.json();
  if (data.ok) {
    adSpendData = data.data;
    renderAdSpend();
    renderKPIs();
  }
}

// ── Source Performance Table ──────────────────────────────

// Map HubSpot sources to ad spend categories
const SOURCE_TO_AD = {
  PAID_SEARCH: 'google',
  PAID_SOCIAL: 'meta'
};

function renderSourcePerformance() {
  const mf = document.getElementById('monthFilter').value;
  const now = new Date();
  const currentMonth = mf !== 'all' ? mf : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Get deals for this period
  const deals = mf === 'all' ? allDeals : allDeals.filter(d => {
    const ck = monthKey(d.properties.createdate);
    const dk = monthKey(d.properties.closedate);
    return ck === mf || dk === mf;
  });

  // Get total ad spend for this month
  const monthSpend = adSpendData.find(s => s.month === currentMonth);
  const googleSpend = monthSpend?.google || 0;
  const metaSpend = monthSpend?.meta || 0;

  // Group by source
  const sources = {};
  deals.forEach(d => {
    const src = d.properties.hs_analytics_source || 'OTHER';
    if (!sources[src]) {
      sources[src] = { leads: 0, won: 0, lost: 0, omzet: 0, inkoop: 0, days: [], adSpend: 0 };
    }
    const s = sources[src];
    s.leads++;
    if (d.properties.hs_is_closed_won === 'true') {
      s.won++;
      s.omzet += parseFloat(d.properties.amount) || 0;
      s.inkoop += parseFloat(d.properties.inkoopbedrag) || 0;
      const dtc = parseFloat(d.properties.days_to_close);
      if (!isNaN(dtc)) s.days.push(dtc);
    }
    if (d.properties.hs_is_closed_lost === 'true') s.lost++;
  });

  // Assign ad spend to paid sources
  if (sources['PAID_SEARCH']) sources['PAID_SEARCH'].adSpend = googleSpend;
  if (sources['PAID_SOCIAL']) sources['PAID_SOCIAL'].adSpend = metaSpend;

  // Sort by leads descending
  const sorted = Object.entries(sources).sort((a, b) => b[1].leads - a[1].leads);

  // Totals
  let totLeads = 0, totWon = 0, totLost = 0, totOmzet = 0, totInkoop = 0, totAdSpend = 0, allDays = [];

  const tbody = document.getElementById('sourceBody');
  const sourceColors = {
    PAID_SEARCH: '#3498db',
    PAID_SOCIAL: '#9b59b6',
    ORGANIC_SEARCH: '#2ecc71',
    DIRECT_TRAFFIC: '#f1c40f',
    REFERRALS: '#1abc9c',
    SOCIAL_MEDIA: '#e67e22',
    EMAIL_MARKETING: '#e74c3c',
    OFFLINE: '#95a5a6',
    OTHER: '#7f8c8d'
  };

  tbody.innerHTML = sorted.map(([src, s]) => {
    const closed = s.won + s.lost;
    const winRate = closed > 0 ? (s.won / closed) * 100 : 0;
    const avgDays = s.days.length > 0 ? Math.round(s.days.reduce((a, b) => a + b, 0) / s.days.length) : '-';
    const marge = s.omzet - s.inkoop;
    const netto = marge - s.adSpend;
    const roi = s.adSpend > 0 ? ((netto / s.adSpend) * 100) : null;
    const color = sourceColors[src] || '#666';
    const maxLeads = sorted[0][1].leads;
    const barWidth = Math.max(10, (s.leads / maxLeads) * 80);

    totLeads += s.leads;
    totWon += s.won;
    totLost += s.lost;
    totOmzet += s.omzet;
    totInkoop += s.inkoop;
    totAdSpend += s.adSpend;
    allDays.push(...s.days);

    return `<tr>
      <td><span class="source-bar" style="background:${color};width:${barWidth}px;"></span>${SOURCE_LABELS[src] || src}</td>
      <td>${s.leads}</td>
      <td><span class="positive">${s.won}</span></td>
      <td><span class="negative">${s.lost}</span></td>
      <td>${closed > 0 ? `<span class="${winRate >= 50 ? 'positive' : winRate >= 25 ? '' : 'negative'}">${pct(winRate)}</span>` : '-'}</td>
      <td>${avgDays}</td>
      <td>${fmt(s.omzet)}</td>
      <td>${fmt(s.inkoop)}</td>
      <td><span class="${marge >= 0 ? 'positive' : 'negative'}">${fmt(marge)}</span></td>
      <td>${s.adSpend > 0 ? fmt(s.adSpend) : '-'}</td>
      <td><span class="${netto >= 0 ? 'positive' : 'negative'}">${s.adSpend > 0 || marge !== 0 ? fmt(netto) : '-'}</span></td>
      <td>${roi !== null ? `<span class="${roi >= 0 ? 'positive' : 'negative'}">${Math.round(roi)}%</span>` : '-'}</td>
    </tr>`;
  }).join('');

  // Footer totals
  const totClosed = totWon + totLost;
  const totWinRate = totClosed > 0 ? (totWon / totClosed) * 100 : 0;
  const totAvgDays = allDays.length > 0 ? Math.round(allDays.reduce((a, b) => a + b, 0) / allDays.length) : '-';
  const totMarge = totOmzet - totInkoop;
  const totNetto = totMarge - totAdSpend;

  const tfoot = document.getElementById('sourceFoot');
  tfoot.innerHTML = `<tr>
    <td>Totaal</td>
    <td>${totLeads}</td>
    <td>${totWon}</td>
    <td>${totLost}</td>
    <td>${pct(totWinRate)}</td>
    <td>${totAvgDays}</td>
    <td>${fmt(totOmzet)}</td>
    <td>${fmt(totInkoop)}</td>
    <td><span class="${totMarge >= 0 ? 'positive' : 'negative'}">${fmt(totMarge)}</span></td>
    <td>${totAdSpend > 0 ? fmt(totAdSpend) : '-'}</td>
    <td><span class="${totNetto >= 0 ? 'positive' : 'negative'}">${fmt(totNetto)}</span></td>
    <td>-</td>
  </tr>`;
}

// ── Deal Table ──────────────────────────────────────────

const TABLE_COLS = [
  { key: 'createdate', label: 'Datum', fmt: (d) => dateStr(d.properties.createdate) },
  { key: 'dealname', label: 'Klant', fmt: (d) => d.properties.dealname || '-' },
  { key: 'product_categorie', label: 'Product', fmt: (d) => PRODUCT_LABELS[d.properties.product_categorie] || d.properties.product_categorie || '-' },
  { key: 'amount', label: 'Verkoop', fmt: (d) => fmt(d.properties.amount), numeric: true },
  { key: 'inkoopbedrag', label: 'Inkoop', fmt: (d) => fmt(d.properties.inkoopbedrag), numeric: true },
  { key: 'marge', label: 'Marge', fmt: (d) => {
    const v = (parseFloat(d.properties.amount) || 0) - (parseFloat(d.properties.inkoopbedrag) || 0);
    return `<span class="${v >= 0 ? 'positive' : 'negative'}">${fmt(v)}</span>`;
  }, numeric: true },
  { key: 'margepct', label: 'Marge%', fmt: (d) => {
    const a = parseFloat(d.properties.amount) || 0;
    const i = parseFloat(d.properties.inkoopbedrag) || 0;
    const p = a > 0 ? ((a - i) / a) * 100 : 0;
    return `<span class="${p >= 0 ? 'positive' : 'negative'}">${pct(p)}</span>`;
  }, numeric: true },
  { key: 'hs_analytics_source', label: 'Bron', fmt: (d) => SOURCE_LABELS[d.properties.hs_analytics_source] || d.properties.hs_analytics_source || '-' },
  { key: 'days_to_close', label: 'Dagen', fmt: (d) => d.properties.days_to_close || '-', numeric: true },
  { key: 'dealstage', label: 'Status', fmt: (d) => {
    const s = dealStatus(d.properties);
    const cls = s === 'won' ? 'badge-won' : s === 'lost' ? 'badge-lost' : 'badge-open';
    const label = s === 'won' ? 'Gewonnen' : s === 'lost' ? 'Verloren' : stageName(d.properties.dealstage);
    return `<span class="badge ${cls}">${label}</span>`;
  }}
];

function sortValue(deal, col) {
  if (col === 'marge') return (parseFloat(deal.properties.amount) || 0) - (parseFloat(deal.properties.inkoopbedrag) || 0);
  if (col === 'margepct') {
    const a = parseFloat(deal.properties.amount) || 0;
    const i = parseFloat(deal.properties.inkoopbedrag) || 0;
    return a > 0 ? (a - i) / a : 0;
  }
  const v = deal.properties[col];
  if (v == null) return '';
  const n = parseFloat(v);
  if (!isNaN(n) && TABLE_COLS.find(c => c.key === col)?.numeric) return n;
  return v;
}

function renderTable() {
  let deals = getFilteredDeals();

  // Apply filters
  const prod = document.getElementById('filterProduct').value;
  const status = document.getElementById('filterStatus').value;
  const search = document.getElementById('filterSearch').value.toLowerCase();

  if (prod !== 'all') deals = deals.filter(d => d.properties.product_categorie === prod);
  if (status !== 'all') deals = deals.filter(d => dealStatus(d.properties) === status);
  if (search) deals = deals.filter(d => (d.properties.dealname || '').toLowerCase().includes(search));

  // Sort
  deals.sort((a, b) => {
    let va = sortValue(a, currentSort.col);
    let vb = sortValue(b, currentSort.col);
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    let cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return currentSort.dir === 'desc' ? -cmp : cmp;
  });

  // Render header
  const thead = document.getElementById('tableHead');
  thead.innerHTML = TABLE_COLS.map(c => {
    const arrow = currentSort.col === c.key ? (currentSort.dir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<th data-col="${c.key}">${c.label}<span class="sort-arrow">${arrow}</span></th>`;
  }).join('');

  // Render body
  const tbody = document.getElementById('tableBody');
  if (deals.length === 0) {
    tbody.innerHTML = '<tr><td colspan="' + TABLE_COLS.length + '" style="text-align:center;padding:24px;color:#999;">Geen deals gevonden</td></tr>';
    return;
  }
  tbody.innerHTML = deals.map((d, idx) => {
    const mainRow = `<tr class="deal-row" data-deal-idx="${idx}">${TABLE_COLS.map(c => `<td>${c.fmt(d)}</td>`).join('')}</tr>`;
    const offerte = d.properties.eerste_offertebedrag || d.properties.definitief_offertebedrag;
    const detailRow = `<tr class="deal-detail" id="detail-${idx}" style="display:none;">
      <td colspan="${TABLE_COLS.length}" style="padding:12px 24px;background:var(--dark-card);border-bottom:2px solid var(--accent);">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;font-size:12px;">
          <div><strong>Offertebedrag:</strong> ${offerte ? fmt(offerte) : '-'}</div>
          <div><strong>Eerste offerte:</strong> ${d.properties.eerste_offertebedrag ? fmt(d.properties.eerste_offertebedrag) : '-'}</div>
          <div><strong>Definitief offerte:</strong> ${d.properties.definitief_offertebedrag ? fmt(d.properties.definitief_offertebedrag) : '-'}</div>
          <div><strong>Afspraak type:</strong> ${d.properties.afspraak_type || '-'}</div>
          <div><strong>Sluitdatum:</strong> ${dateStr(d.properties.closedate)}</div>
          <div><strong>Verliesreden:</strong> ${d.properties.closed_lost_reason || '-'}</div>
          <div><strong>Pipeline fase:</strong> ${stageName(d.properties.dealstage)}</div>
          <div><strong>Bron:</strong> ${SOURCE_LABELS[d.properties.hs_analytics_source] || d.properties.hs_analytics_source || '-'}</div>
          <div><strong>Lead kwaliteit:</strong> ${d.properties.lead_kwaliteit || '-'}</div>
          <div><strong>Lead score:</strong> ${d.properties.lead_score || '-'}</div>
          <div><strong>Nurture fase:</strong> ${d.properties.nurture_fase || '-'}</div>
          <div><strong>Belpogingen:</strong> ${d.properties.aantal_belpogingen || '0'}</div>
          <div><strong>Laatste belpoging:</strong> ${dateStr(d.properties.laatste_belpoging)}</div>
          <div><strong>Review verstuurd:</strong> ${d.properties.review_verstuurd === 'true' ? 'Ja' : 'Nee'}</div>
        </div>
      </td>
    </tr>`;
    return mainRow + detailRow;
  }).join('');

  // Store filtered deals for CSV export
  window._filteredDeals = deals;
}

// ── Event Listeners ──────────────────────────────────────────

document.getElementById('monthFilter').addEventListener('change', renderAll);
document.getElementById('filterProduct').addEventListener('change', renderTable);
document.getElementById('filterStatus').addEventListener('change', renderTable);
document.getElementById('filterSearch').addEventListener('input', renderTable);

document.getElementById('tableHead').addEventListener('click', (e) => {
  const th = e.target.closest('th');
  if (!th) return;
  const col = th.dataset.col;
  if (currentSort.col === col) {
    currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    currentSort.col = col;
    currentSort.dir = 'desc';
  }
  renderTable();
});

// Deal row click for expansion
document.getElementById('tableBody').addEventListener('click', (e) => {
  const row = e.target.closest('.deal-row');
  if (!row) return;
  const idx = row.dataset.dealIdx;
  const detail = document.getElementById(`detail-${idx}`);
  if (detail) {
    const isOpen = detail.style.display !== 'none';
    // Close all open details first
    document.querySelectorAll('.deal-detail').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.deal-row').forEach(el => el.classList.remove('expanded'));
    if (!isOpen) {
      detail.style.display = '';
      row.classList.add('expanded');
    }
  }
});

// CSV Export
function exportCSV() {
  const deals = window._filteredDeals || getFilteredDeals();
  const headers = ['Datum', 'Klant', 'Product', 'Verkoop', 'Inkoop', 'Marge', 'Marge%', 'Bron', 'Dagen', 'Status', 'Offertebedrag', 'Afspraak type', 'Sluitdatum', 'Verliesreden'];
  const rows = deals.map(d => {
    const a = parseFloat(d.properties.amount) || 0;
    const i = parseFloat(d.properties.inkoopbedrag) || 0;
    const m = a - i;
    const mp = a > 0 ? ((m / a) * 100).toFixed(1) : '0';
    const s = dealStatus(d.properties);
    const statusLabel = s === 'won' ? 'Gewonnen' : s === 'lost' ? 'Verloren' : stageName(d.properties.dealstage);
    return [
      dateStr(d.properties.createdate),
      (d.properties.dealname || '').replace(/"/g, '""'),
      PRODUCT_LABELS[d.properties.product_categorie] || d.properties.product_categorie || '',
      a, i, m, mp + '%',
      SOURCE_LABELS[d.properties.hs_analytics_source] || d.properties.hs_analytics_source || '',
      d.properties.days_to_close || '',
      statusLabel,
      d.properties.eerste_offertebedrag || d.properties.definitief_offertebedrag || '',
      d.properties.afspraak_type || '',
      dateStr(d.properties.closedate),
      d.properties.closed_lost_reason || ''
    ];
  });

  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(';')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sonty-deals-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Ad spend form
document.getElementById('adspendForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const month = document.getElementById('adspendMonth').value;
  const google = document.getElementById('adspendGoogle').value || 0;
  const meta = document.getElementById('adspendMeta').value || 0;
  if (!month) return;
  await saveAdSpend(month, google, meta);
  document.getElementById('adspendGoogle').value = '';
  document.getElementById('adspendMeta').value = '';
});

// Set default month to current
const now = new Date();
document.getElementById('adspendMonth').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

// ── Ideas Board ──────────────────────────────────────────

let ideasData = [];
let ideasFilter = 'all';

async function loadIdeas() {
  const res = await fetch('/api/ideas');
  ideasData = await res.json();
  renderIdeas();
}

function renderIdeas() {
  const list = document.getElementById('ideasList');
  const filtered = ideasFilter === 'all' ? ideasData : ideasData.filter(i => i.status === ideasFilter);

  if (filtered.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:24px;color:#555;">Nog geen ideeën — voeg er een toe!</div>';
    return;
  }

  // Sort: urgent/hoog first, afgerond last
  const priorityOrder = { urgent: 0, hoog: 1, normaal: 2, laag: 3 };
  const statusOrder = { idee: 0, in_uitvoering: 1, afgerond: 2 };
  const sorted = [...filtered].sort((a, b) => {
    const sd = statusOrder[a.status] - statusOrder[b.status];
    if (sd !== 0) return sd;
    return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
  });

  const statusLabels = { idee: 'Idee', in_uitvoering: 'In uitvoering', afgerond: 'Afgerond' };
  const nextStatus = { idee: 'in_uitvoering', in_uitvoering: 'afgerond', afgerond: 'idee' };

  list.innerHTML = sorted.map(idea => {
    const date = new Date(idea.created).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' });
    return `<div class="idea-card status-${idea.status}">
      <div class="idea-priority ${idea.priority}"></div>
      <div class="idea-content">
        <div class="idea-title">${idea.title}</div>
        ${idea.description ? `<div class="idea-desc">${idea.description}</div>` : ''}
        <div class="idea-meta">${idea.author} · ${date} · ${idea.priority}</div>
      </div>
      <div class="idea-actions">
        <button class="idea-status-btn ${idea.status}" onclick="updateIdeaStatus('${idea.id}', '${nextStatus[idea.status]}')">${statusLabels[idea.status]}</button>
        <button class="idea-delete-btn" onclick="deleteIdea('${idea.id}')" title="Verwijderen">x</button>
      </div>
    </div>`;
  }).join('');
}

async function updateIdeaStatus(id, newStatus) {
  const res = await fetch(`/api/ideas/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus })
  });
  const data = await res.json();
  if (data.ok) { ideasData = data.data; renderIdeas(); }
}

async function deleteIdea(id) {
  if (!confirm('Idee verwijderen?')) return;
  const res = await fetch(`/api/ideas/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (data.ok) { ideasData = data.data; renderIdeas(); }
}

// Ideas form submit
document.getElementById('ideasForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('ideaTitle').value;
  const description = document.getElementById('ideaDescription').value;
  const priority = document.getElementById('ideaPriority').value;
  const author = document.getElementById('ideaAuthor').value;
  if (!title) return;

  const res = await fetch('/api/ideas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description, priority, author })
  });
  const data = await res.json();
  if (data.ok) {
    ideasData = data.data;
    renderIdeas();
    document.getElementById('ideaTitle').value = '';
    document.getElementById('ideaDescription').value = '';
    document.getElementById('ideaPriority').value = 'normaal';
  }
});

// Ideas filter buttons
document.getElementById('ideasFilters').addEventListener('click', (e) => {
  const btn = e.target.closest('.ideas-filter');
  if (!btn) return;
  document.querySelectorAll('.ideas-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ideasFilter = btn.dataset.filter;
  renderIdeas();
});

// Tab switching
document.querySelector('.tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  const target = tab.dataset.tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  tab.classList.add('active');
  document.getElementById(`tab-${target}`).classList.add('active');
});

// ── Changelog ──────────────────────────────────────────
let changelogData = [];

async function loadChangelog() {
  try {
    const res = await fetch('/api/changelog');
    changelogData = await res.json();
    renderChangelog();
  } catch (err) {
    console.error('Changelog laden mislukt:', err);
  }
}

function renderChangelog() {
  const el = document.getElementById('changelogList');
  if (!el) return;
  if (changelogData.length === 0) {
    el.innerHTML = '<p style="color:#555;font-size:13px;">Nog geen wijzigingen vastgelegd. Voeg je eerste changelog entry toe!</p>';
    return;
  }

  el.innerHTML = changelogData.map((entry, i) => {
    const date = new Date(entry.created).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const s = entry.snapshot || {};
    const prev = (i < changelogData.length - 1) ? (changelogData[i + 1].snapshot || {}) : null;

    function compare(cur, old, key, higher) {
      if (!old || old[key] == null || cur[key] == null) return '';
      const diff = cur[key] - old[key];
      if (diff === 0) return '<div class="changelog-compare neutral">—</div>';
      const sign = diff > 0 ? '+' : '';
      const cls = (higher && diff > 0) || (!higher && diff < 0) ? 'up' : (higher && diff < 0) || (!higher && diff > 0) ? 'down' : 'neutral';
      const val = key === 'slagingspercentage' ? `${sign}${diff.toFixed(1)}%` : `${sign}${diff}`;
      return `<div class="changelog-compare ${cls}">${val}</div>`;
    }

    return `<div class="changelog-entry">
      <div class="changelog-header">
        <span class="changelog-badge ${entry.category}">${entry.category}</span>
        <span class="changelog-title">${entry.title}</span>
        <span class="changelog-date">${date}</span>
        <button class="changelog-delete" onclick="deleteChangelog('${entry.id}')" title="Verwijderen">x</button>
      </div>
      ${entry.description ? `<div class="changelog-desc">${entry.description}</div>` : ''}
      <div class="changelog-kpis">
        <div class="changelog-kpi"><div class="ck-label">Deals</div><div class="ck-value">${s.totaal_deals ?? '-'}</div>${compare(s, prev, 'totaal_deals', true)}</div>
        <div class="changelog-kpi"><div class="ck-label">Gewonnen</div><div class="ck-value">${s.gewonnen ?? '-'}</div>${compare(s, prev, 'gewonnen', true)}</div>
        <div class="changelog-kpi"><div class="ck-label">Verloren</div><div class="ck-value">${s.verloren ?? '-'}</div>${compare(s, prev, 'verloren', false)}</div>
        <div class="changelog-kpi"><div class="ck-label">Omzet</div><div class="ck-value">${s.omzet != null ? fmt(s.omzet) : '-'}</div>${compare(s, prev, 'omzet', true)}</div>
        <div class="changelog-kpi"><div class="ck-label">Marge</div><div class="ck-value">${s.marge != null ? fmt(s.marge) : '-'}</div>${compare(s, prev, 'marge', true)}</div>
        <div class="changelog-kpi"><div class="ck-label">Slagings%</div><div class="ck-value">${s.slagingspercentage != null ? s.slagingspercentage + '%' : '-'}</div>${compare(s, prev, 'slagingspercentage', true)}</div>
        <div class="changelog-kpi"><div class="ck-label">Gem. Deal</div><div class="ck-value">${s.gem_dealwaarde != null ? fmt(s.gem_dealwaarde) : '-'}</div>${compare(s, prev, 'gem_dealwaarde', true)}</div>
        <div class="changelog-kpi"><div class="ck-label">Gem. Dagen</div><div class="ck-value">${s.gem_dagen_tot_sluiting ?? '-'}</div>${compare(s, prev, 'gem_dagen_tot_sluiting', false)}</div>
      </div>
    </div>`;
  }).join('');
}

async function deleteChangelog(id) {
  if (!confirm('Changelog entry verwijderen?')) return;
  const res = await fetch(`/api/changelog/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (data.ok) { changelogData = data.data; renderChangelog(); }
}

document.getElementById('changelogForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('changelogTitle').value;
  const description = document.getElementById('changelogDescription').value;
  const category = document.getElementById('changelogCategory').value;
  if (!title) return;

  const res = await fetch('/api/changelog', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description, category })
  });
  const data = await res.json();
  if (data.ok) {
    changelogData = data.data;
    renderChangelog();
    document.getElementById('changelogTitle').value = '';
    document.getElementById('changelogDescription').value = '';
    document.getElementById('changelogCategory').value = 'verbetering';
  }
});

// Auto-refresh every 5 minutes
setInterval(loadData, 5 * 60 * 1000);

// Initial load
loadData();
loadIdeas();
loadChangelog();
