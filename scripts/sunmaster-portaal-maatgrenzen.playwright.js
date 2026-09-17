async (page) => {
  const CFG = (await page.evaluate(() => window.__SMCFG || {})) || {};
  const products = CFG.products || [];
  const out = [];
  const dialogRows = () => page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.svy-dialog')].filter(e => e.getClientRects().length && e.innerText.includes('Productingave')).pop();
    if (!dlg) return null;
    const dl = dlg.getBoundingClientRect().left;
    const allInputs = [...document.querySelectorAll('input')].filter(x => x.offsetParent);
    const leaves = [...dlg.querySelectorAll('*')].filter(e => e.offsetParent && !['UL', 'LI', 'BUTTON', 'H4'].includes(e.tagName) && (e.tagName === 'INPUT' || (e.children.length === 0 && e.textContent.trim())));
    const items = leaves.map(e => { const r = e.getBoundingClientRect(); return { e, cy: r.top + r.height / 2, left: r.left - dl, isInput: e.tagName === 'INPUT', h: r.height }; }).filter(i => i.h > 0);
    const labels = items.filter(i => !i.isInput && i.left < 170 && !/Productingave|Annuleren|Opslaan/.test(i.e.textContent));
    return labels.map(l => { const vals = items.filter(i => i !== l && Math.abs(i.cy - l.cy) < 11 && i.left >= 170).sort((a, b) => a.left - b.left); const inp = vals.find(v => v.isInput); return { label: l.e.textContent.trim(), value: vals.map(v => v.isInput ? v.e.value : v.e.textContent.trim()).filter(Boolean).join(' '), idx: inp ? allInputs.indexOf(inp.e) : -1, kind: inp ? (inp.e.className.includes('typeahead') ? 'select' : (inp.e.readOnly ? 'ro' : 'text')) : 'fixed' }; });
  });
  const readOpts = () => page.evaluate(() => [...document.querySelectorAll('ul.dropdown-menu li')].filter(e => e.offsetParent).map(e => e.textContent.trim().replace(/\s+/g, ' ')));
  const dismissWarn = async () => { const m = page.locator('.bootbox.modal.in'); if (await m.count()) { const t = (await m.innerText()).replace(/\s+/g, ' ').replace(/^Waarschuwing\s*/, '').replace(/\s*Ok$/, '').trim(); await m.locator('button').last().click(); await page.waitForTimeout(400); return t; } return null; };
  const inp = (i) => page.locator('input:visible').nth(i);
  const closeAll = async () => { await dismissWarn(); for (let k = 0; k < 3; k++) { const b = page.getByRole('button', { name: 'Annuleren' }).first(); if (await b.count()) { await b.click(); await page.waitForTimeout(700); } else break; } };
  const openProd = async (prod) => { await page.getByRole('button', { name: /Artikel toevoegen|Nieuwe offerte/ }).first().click(); await page.waitForTimeout(1300); await page.locator('.svy-dialog .ag-cell', { hasText: new RegExp('^' + prod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().dblclick(); for (let t = 0; t < 20; t++) { await page.waitForTimeout(400); const rr = await dialogRows(); if (rr && rr.length > 2) break; } await page.waitForTimeout(600); };
  const fillNum = async (label, val) => { const rows = await dialogRows(); const r = rows && rows.find(x => x.label === label && x.idx >= 0); if (!r) return { missing: true }; await inp(r.idx).click(); await inp(r.idx).fill(String(val)); await page.keyboard.press('Tab'); await page.waitForTimeout(1000); const w = await dismissWarn(); return { warn: w }; };
  const rangeOf = (w) => { const m = w && w.match(/tussen ([\d.]+) en ([\d.]+)/); return m ? [+m[1].replace(/\./g, ''), +m[2].replace(/\./g, '')] : null; };
  const openList = async (idx) => { await inp(idx).click(); await page.waitForTimeout(300); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(800); let o = await readOpts(); if (!o.length) { await inp(idx).fill(''); await page.waitForTimeout(400); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(900); o = await readOpts(); } if (!o.length) { await page.keyboard.type(' '); await page.waitForTimeout(800); o = await readOpts(); } if (!o.length) { await page.keyboard.press('Escape'); await page.waitForTimeout(1500); await inp(idx).click(); await page.waitForTimeout(400); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(1200); o = await readOpts(); } return o; };
  const pickFirst = async (label, prefer) => { const rows = await dialogRows(); const r = rows && rows.find(x => x.label === label && x.kind === 'select' && x.idx >= 0); if (!r) return null; const o = await openList(r.idx); let i = 0; if (prefer) { const j = o.findIndex(x => x === prefer); if (j >= 0) i = j; } if (o.length) { await page.locator('ul.dropdown-menu li:visible').nth(i).click(); await page.waitForTimeout(800); await dismissWarn(); return o[i]; } await page.keyboard.press('Escape'); return null; };
  const readSel = async (label) => { const rows = await dialogRows(); const r = rows && rows.find(x => x.label === label && x.kind === 'select' && x.idx >= 0); if (!r) return null; const before = r.value; const o = await openList(r.idx); await page.keyboard.press('Escape'); await page.waitForTimeout(150); if (before) { await inp(r.idx).fill(before); await page.keyboard.press('Tab'); await page.waitForTimeout(300); await dismissWarn(); } if (!o.length && before) return [before + ' (auto)']; return o; };
  const isOk = async (label, val) => { const r = await fillNum(label, val); return !r.missing && !r.warn; };
  const bsearch = async (label) => { // laagste en hoogste geldige waarde in [1, 12000]
    let lo = 1, hi = 12000; if (!(await isOk(label, 3000)) && !(await isOk(label, 1500)) && !(await isOk(label, 800)) && !(await isOk(label, 5000))) return null;
    let a = 1, b = 12000; // zoek min: laagste ok
    let l = 1, h = 12000; const okAt = {}; const ok = async (v) => { if (okAt[v] === undefined) okAt[v] = await isOk(label, v); return okAt[v]; };
    // vind een ok-punt
    let pivot = null; for (const v of [3000, 1500, 800, 5000, 2000, 1000]) { if (await ok(v)) { pivot = v; break; } } if (pivot === null) return null;
    l = 1; h = pivot; while (h - l > 1) { const m = Math.floor((l + h) / 2); if (await ok(m)) h = m; else l = m; } const mn = h;
    l = pivot; h = 12000; while (h - l > 1) { const m = Math.floor((l + h) / 2); if (await ok(m)) l = m; else h = m; } const mx = l;
    return [mn, mx];
  };
  const fillEmptySelectsBefore = async (label) => { for (let k = 0; k < 8; k++) { const rows = await dialogRows(); if (!rows) return; const ti = rows.findIndex(x => x.label === label); const e = rows.find((x, i) => i < (ti < 0 ? rows.length : ti) && x.kind === 'select' && x.idx >= 0 && !x.value); if (!e) return; await pickFirst(e.label); } };
  await closeAll();
  for (const prod of products) {
    const res = { product: prod, breedte: null, hoogteBijBreedte: [], uitvalOmslag: [], variantBereik: [], errors: [] };
    let rows = null;
    try {
      if ((CFG.skipBase || []).includes(prod)) throw new Error('SKIPBASE');
      await openProd(prod);
      // basis: breedtebereik
      rows = await dialogRows();
      const hasB = rows.some(r => r.label === 'Breedte (MM)'), hasH = rows.some(r => r.label === 'Hoogte (MM)'), hasU = rows.some(r => /^Uitval\/Arm/.test(r.label));
      // velden vóór breedte (bv. Uitvoering bij rolluik) eerst vullen
      for (let k = 0; k < 4; k++) { rows = await dialogRows(); const first = rows.find(r => r.idx >= 0 && r.kind === 'select' && !r.value); const bIdx = rows.findIndex(r => r.label === 'Breedte (MM)'); if (!first || rows.indexOf(first) > bIdx) break; await pickFirst(first.label); }
      if (!hasB) { res.getallen = []; const rr0 = await dialogRows(); for (const g of rr0.filter(x => x.kind === 'text' && /\(MM\)/.test(x.label))) { const a = await fillNum(g.label, 1); const b = await fillNum(g.label, 99999); res.getallen.push({ veld: g.label, bij1: a.warn || null, bij99999: b.warn || null, bereik: rangeOf(b.warn) || rangeOf(a.warn) }); await fillNum(g.label, 3000); } }
      const wb = hasB ? await fillNum('Breedte (MM)', 1) : { warn: null }; res.breedte = rangeOf(wb.warn) || wb.warn;
      const R = rangeOf(wb.warn);
      if (R) {
        const [mn, mx] = R;
        // hoogtebereik als functie van de breedte (per 250 mm + max)
        if (hasH) { const ws = []; for (let w = Math.ceil(mn / 250) * 250; w < mx; w += 250) ws.push(w); ws.unshift(mn); ws.push(mx);
          for (const w of [...new Set(ws)]) { await fillNum('Breedte (MM)', w); const hb = await fillNum('Hoogte (MM)', 1); const hb2 = hb.missing ? null : await fillNum('Hoogte (MM)', 99999); const r1 = rangeOf(hb.warn), r2 = rangeOf(hb2 && hb2.warn); res.hoogteBijBreedte.push({ breedte: w, min: (r1 || r2 || [null])[0], max: (r2 || r1 || [null, null])[1], raw: hb2 ? hb2.warn : hb.warn }); await fillNum('Hoogte (MM)', Math.min(2000, ((r2 || r1 || [0, 2000])[1]) || 2000)); } }
        // overige getalvelden (MM): bereik meten
        await fillNum('Breedte (MM)', Math.round((mn + mx) / 2 / 100) * 100);
        res.getallen = [];
        { const rr = await dialogRows(); for (const g of rr.filter(x => x.kind === 'text' && /\(MM\)/.test(x.label) && !/^Breedte|^Hoogte/.test(x.label))) { const a = await fillNum(g.label, 1); const b = await fillNum(g.label, 99999); res.getallen.push({ veld: g.label, bij1: a.warn || null, bij99999: b.warn || null, bereik: rangeOf(b.warn) || rangeOf(a.warn) }); await fillNum(g.label, 2000); } }
        // uitval-omslagpunten per 100 mm
        if (hasU || rows.some(r => /^Uitval\/Arm/.test(r.label))) {
          let prev = null;
          for (let w = Math.ceil(mn / 100) * 100; w <= mx; w += 100) {
            await fillNum('Breedte (MM)', w);
            await fillEmptySelectsBefore('Uitval/Arm');
            const o = await readSel('Uitval/Arm'); const key = (o || []).map(x => x.split('|')[0].trim()).join(',');
            if (key !== prev) { res.uitvalOmslag.push({ vanafBreedte: w, uitval: key }); prev = key; }
          }
          if (mx % 100) { await fillNum('Breedte (MM)', mx); const o = await readSel('Uitval/Arm'); const key = (o || []).map(x => x.split('|')[0].trim()).join(','); if (key !== prev) res.uitvalOmslag.push({ vanafBreedte: mx, uitval: key }); }
        }
      }
      await closeAll();
      // breedte/hoogtebereik per structurele variant
      const structural = (CFG.variantFields || {})[prod] || [];
      for (const [field, opt] of structural) {
        try {
          await openProd(prod);
          // cascade tot het veld zichtbaar is, kies optie, dan breedte 1 en hoogte 1
          let picked = null;
          for (let k = 0; k < 20; k++) {
            rows = await dialogRows(); if (!rows) break;
            const target = rows.find(r => r.label === field && r.kind === 'select' && r.idx >= 0);
            if (target) { picked = await pickFirst(field, opt); break; }
            const nxt = rows.find(r => r.idx >= 0 && r.kind !== 'ro' && !r.value && r.label !== 'Aantal');
            if (!nxt) break;
            if (nxt.kind === 'select') await pickFirst(nxt.label); else if (/breedte/i.test(nxt.label)) { await fillNum('Breedte (MM)', 1); const rr = rangeOf((await dialogRows()) ? '' : ''); await fillNum('Breedte (MM)', 3000); } else if (/hoogte/i.test(nxt.label)) await fillNum('Hoogte (MM)', 2000); else if (/^uitval/i.test(nxt.label)) await fillNum(nxt.label, 2000); else break;
          }
          let wb2 = await fillNum('Breedte (MM)', 1); let R2 = rangeOf(wb2.warn); if (!R2) { const wb9 = await fillNum('Breedte (MM)', 99999); if (rangeOf(wb9.warn)) { wb2 = wb9; R2 = rangeOf(wb9.warn); } else { const bs = await bsearch('Breedte (MM)'); if (bs) { R2 = bs; wb2 = { warn: 'gemeten via zoeken (portaal geeft geen bereik): ' + bs.join('-') }; } else wb2 = { warn: (wb2.warn || '') + ' / ' + (wb9.warn || '') }; } }
          let hoog = null; if (R2) { await fillNum('Breedte (MM)', Math.round((R2[0] + R2[1]) / 2 / 100) * 100); const hb3 = await fillNum('Hoogte (MM)', 99999); hoog = hb3.missing ? null : (rangeOf(hb3.warn) || hb3.warn || null); await fillNum('Breedte (MM)', R2[1]); const hb4 = await fillNum('Hoogte (MM)', 99999); if (!hb4.missing) hoog = { midden: hoog, bijMaxBreedte: rangeOf(hb4.warn) || hb4.warn || null }; }
          res.variantBereik.push({ field, opt, picked, breedte: R2 || wb2.warn || null, hoogte: hoog });
        } catch (e) { res.variantBereik.push({ field, opt, error: String(e).slice(0, 120) }); }
        await closeAll();
      }
    } catch (e) { if (String(e).includes('SKIPBASE')) { res.basisOvergeslagen = true; await closeAll(); const structural = (CFG.variantFields || {})[prod] || []; for (const [field, opt] of structural) { try { await openProd(prod); let picked = null; for (let k = 0; k < 20; k++) { rows = await dialogRows(); if (!rows) break; const target = rows.find(r => r.label === field && r.kind === 'select' && r.idx >= 0); if (target) { picked = await pickFirst(field, opt); break; } const nxt = rows.find(r => r.idx >= 0 && r.kind !== 'ro' && !r.value && r.label !== 'Aantal'); if (!nxt) break; if (nxt.kind === 'select') await pickFirst(nxt.label); else if (/breedte/i.test(nxt.label)) { await fillNum('Breedte (MM)', 3000); } else if (/hoogte/i.test(nxt.label)) await fillNum('Hoogte (MM)', 2000); else if (/^uitval/i.test(nxt.label)) await fillNum(nxt.label, 2000); else break; } let wb2 = await fillNum('Breedte (MM)', 1); let R2 = rangeOf(wb2.warn); if (!R2) { const wb9 = await fillNum('Breedte (MM)', 99999); if (rangeOf(wb9.warn)) { wb2 = wb9; R2 = rangeOf(wb9.warn); } else { const bs = await bsearch('Breedte (MM)'); if (bs) { R2 = bs; wb2 = { warn: 'gemeten via zoeken (portaal geeft geen bereik): ' + bs.join('-') }; } else wb2 = { warn: (wb2.warn || '') + ' / ' + (wb9.warn || '') }; } } let hoog = null; if (R2) { await fillNum('Breedte (MM)', Math.round((R2[0] + R2[1]) / 2 / 100) * 100); const hb3 = await fillNum('Hoogte (MM)', 99999); hoog = hb3.missing ? null : (rangeOf(hb3.warn) || hb3.warn || null); await fillNum('Breedte (MM)', R2[1]); const hb4 = await fillNum('Hoogte (MM)', 99999); if (!hb4.missing) hoog = { midden: hoog, bijMaxBreedte: rangeOf(hb4.warn) || hb4.warn || null }; } res.variantBereik.push({ field, opt, picked, breedte: R2 || wb2.warn || null, hoogte: hoog }); } catch (e2) { res.variantBereik.push({ field, opt, error: String(e2).slice(0, 120) }); } await closeAll(); } } else { res.errors.push(String(e).slice(0, 200)); await closeAll(); } }
    out.push(res);
    await page.evaluate((r) => { window.__SMP = window.__SMP || []; window.__SMP.push(r); }, res);
  }
  return out.map(r => ({ product: r.product, breedte: r.breedte, hoogte: r.hoogteBijBreedte.length, omslag: r.uitvalOmslag.length, varianten: r.variantBereik.length, errors: r.errors }));
}
