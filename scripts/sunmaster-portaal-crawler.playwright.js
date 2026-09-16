async (page) => {
  const CFG = (await page.evaluate(() => window.__SMCFG || {})) || {};
  const products = CFG.products || [];
  const WIDTH = CFG.width || 3000;
  const prefer = CFG.prefer || {};
  const probeWidths = CFG.probeWidths || [];
  const tag = CFG.tag || 'default';
  const summary = [];

  const dialogRows = () => page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.svy-dialog')].filter(e => e.getClientRects().length && e.innerText.includes('Productingave')).pop();
    if (!dlg) return null;
    const dl = dlg.getBoundingClientRect().left;
    const allInputs = [...document.querySelectorAll('input')].filter(x => x.offsetParent);
    const leaves = [...dlg.querySelectorAll('*')].filter(e => e.offsetParent && !['UL', 'LI', 'BUTTON', 'H4'].includes(e.tagName) && (e.tagName === 'INPUT' || (e.children.length === 0 && e.textContent.trim())));
    const items = leaves.map(e => { const r = e.getBoundingClientRect(); return { e, cy: r.top + r.height / 2, left: r.left - dl, isInput: e.tagName === 'INPUT', h: r.height }; }).filter(i => i.h > 0);
    const labels = items.filter(i => !i.isInput && i.left < 170 && !/Productingave|Annuleren|Opslaan/.test(i.e.textContent));
    return labels.map(l => {
      const vals = items.filter(i => i !== l && Math.abs(i.cy - l.cy) < 11 && i.left >= 170).sort((a, b) => a.left - b.left);
      const inp = vals.find(v => v.isInput);
      const kind = inp ? (inp.e.className.includes('typeahead') ? 'select' : (inp.e.readOnly ? 'ro' : 'text')) : 'fixed';
      const value = vals.map(v => v.isInput ? v.e.value : v.e.textContent.trim()).filter(Boolean).join(' ');
      return { label: l.e.textContent.trim(), value, idx: inp ? allInputs.indexOf(inp.e) : -1, kind };
    }).filter(r => r.label);
  });
  const dismissWarn = async () => { const m = page.locator('.bootbox.modal.in'); if (await m.count()) { const t = (await m.innerText()).replace(/\s+/g, ' ').replace(/^Waarschuwing\s*/, '').replace(/\s*Ok$/, '').trim(); await m.locator('button').last().click(); await page.waitForTimeout(600); return t; } return null; };
  const readStable = async (prevKey) => {
    // gemeten: na typen is de lijst ~0,6-0,85 s verborgen tot het antwoord komt; geen treffers = blijft verborgen.
    // Dus: pas lezen na 950 ms, non-leeg en 2x gelijk = klaar; leeg pas geloven na 2,2 s.
    await page.waitForTimeout(950);
    let last = null;
    for (let t = 0; t < 12; t++) {
      const o = await readOpts(); const key = o.join('~');
      if (o.length && last !== null && key === last) return o;
      if (!o.length && t >= 6) { const o2 = await readOpts(); if (!o2.length) return []; }
      last = key; await page.waitForTimeout(200);
    }
    return await readOpts();
  };
  const enumAll = async (idx, seed) => {
    // typeahead toont max 50; filter op 'bevat'. Elk artikel heeft een code met cijfers, dus: cijferfilters recursief
    // (0-9 -> 00-99 -> 000-999 ...) tot < 50 treffers; letters alleen op niveau 1 als vangnet (niet uitgebreid).
    const all = new Set(seed); const digits = '0123456789'.split(''); const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    const q = digits.slice(); let incomplete = [], letterOverflow = []; let prevKey = seed.join('~'); const log = [];
    const doFilter = async (f) => {
      const inp = page.locator('input:visible').nth(idx); await inp.click(); await inp.fill(f);
      let o = await readStable(prevKey);
      if (o.length && o.join('~') === prevKey) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); await inp.click(); await inp.fill(''); await page.waitForTimeout(150); await inp.fill(f); o = await readStable(prevKey); }
      prevKey = o.join('~'); o.forEach(x => all.add(x)); log.push(f + ':' + o.length);
      await page.keyboard.press('Escape'); await page.waitForTimeout(80);
      return o;
    };
    // gemeten regel: filter = (code begint met X) OF (naam bevat X). Codes zijn cijfers of letter+cijfers.
    const expand = async (start) => { const qq = [start]; while (qq.length) { const f = qq.shift(); const o = await doFilter(f); if (o.length >= 50) { if (f.length < 6) digits.forEach(c => qq.push(f + c)); else incomplete.push(f); } } };
    const overflowDigits = [];
    const expandD = async (start) => { const qq = [start]; while (qq.length) { const f = qq.shift(); const o = await doFilter(f); if (o.length >= 50) { overflowDigits.push(f); if (f.length < 6) digits.forEach(c => qq.push(f + c)); else incomplete.push(f); } } };
    for (const d of digits) await expandD(d);
    // codes met lettersuffix (04s, 03m, 06s) vallen buiten cijfer-uitbreiding als het cijferprefix overloopt: prefix+letter proberen
    for (const f of overflowDigits.filter(x => x.length === 2)) for (const l of 'smtx') { const o = await doFilter(f + l); if (o.length >= 50) incomplete.push(f + l); }
    for (const c of letters) { const o = await doFilter(c); if (o.length >= 50) { letterOverflow.push(c); for (const d of digits) await expand(c + d); } }
    const inp = page.locator('input:visible').nth(idx); await inp.click(); await inp.fill(''); await page.waitForTimeout(300); await page.keyboard.press('Escape');
    const list = [...all]; list.__incomplete = incomplete; list.__log = log; list.__letterOverflow = letterOverflow; return list;
  };
  const readOpts = () => page.evaluate(() => [...document.querySelectorAll('ul.dropdown-menu li, [role=option], .typeahead-popup li')].filter(e => e.offsetParent).map(e => e.textContent.trim().replace(/\s+/g, ' ')));
  const openOpts = async (idx) => { await page.locator('input:visible').nth(idx).click(); await page.waitForTimeout(350); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(800); let o = await readOpts(); if (!o.length) { await page.keyboard.type(' '); await page.waitForTimeout(600); o = await readOpts(); } return o; };
  const pickOpt = async (field, opts, prefer) => { let i = 0; const p = (prefer || {})[field]; if (p) { const j = opts.findIndex(o => new RegExp(p, 'i').test(o)); if (j >= 0) i = j; } await page.locator('ul.dropdown-menu li:visible, [role=option]:visible').nth(i).click(); await page.waitForTimeout(850); return opts[i]; };

  await dismissWarn();
  for (let k = 0; k < 3; k++) { const b = page.getByRole('button', { name: 'Annuleren' }).first(); if (await b.count()) { await b.click(); await page.waitForTimeout(900); } else break; }
  const runOne = async (prod, prefer, tag) => {
    const res = { product: prod, tag, width: WIDTH, fields: [], errors: [] };
    try {
      await page.getByRole('button', { name: /Artikel toevoegen|Nieuwe offerte/ }).first().click();
      await page.waitForTimeout(1500);
      const sb = page.locator('.svy-dialog input:visible').first();
      await sb.fill(prod); await page.waitForTimeout(1200);
      const cell = page.locator('.svy-dialog .ag-cell', { hasText: new RegExp('^' + prod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first();
      await cell.dblclick(); await page.waitForTimeout(1800);
      const seen = {};
      for (let round = 0; round < 45; round++) {
        const rows = await dialogRows(); if (!rows) { res.errors.push('geen dialoog'); break; }
        const next = rows.find(r => r.idx >= 0 && r.kind !== 'ro' && !seen[r.label] && r.label !== 'Aantal');
        if (!next) break;
        seen[next.label] = true;
        if (next.kind === 'select') {
          const opts = await openOpts(next.idx);
          let chosen = null;
          let full = null;
          if (opts.length >= 50) { await page.keyboard.press('Escape'); await page.waitForTimeout(200);
            const ck = next.label + '|' + opts.slice(0, 50).join('~');
            full = await page.evaluate((k) => (window.__SMCACHE || {})[k] || null, ck);
            if (!full && !CFG.skipEnum) { full = await enumAll(next.idx, opts); await page.evaluate(([k, v]) => { window.__SMCACHE = window.__SMCACHE || {}; window.__SMCACHE[k] = v; }, [ck, full]); }
            await openOpts(next.idx); }
          if (opts.length) chosen = await pickOpt(next.label, opts, prefer); else await page.keyboard.press('Escape');
          const warn = await dismissWarn();
          res.fields.push({ field: next.label, kind: 'select', chosen, options: full || opts, truncatedAt50: opts.length >= 50, enumIncomplete: (full && full.__incomplete && full.__incomplete.length) ? full.__incomplete : undefined, enumLog: (full && full.__log) ? full.__log.join(' ') : undefined, letterOverflow: (full && full.__letterOverflow) ? full.__letterOverflow.join('') : undefined, warn });
        } else {
          let val = '';
          if (/breedte/i.test(next.label)) val = String(WIDTH);
          else if (/hoogte|lengte(?!.*doek)/i.test(next.label) && !/doek/i.test(next.label)) val = String(CFG.height || 2000);
          else if (/^uitval/i.test(next.label)) val = String(CFG.uitval || 2000);
          let range = null, warn = null;
          if (val) { const inp = page.locator('input:visible').nth(next.idx); await inp.click(); await inp.fill('1'); await page.keyboard.press('Tab'); await page.waitForTimeout(1200); range = await dismissWarn();
            const m = range && range.match(/tussen ([\d.]+) en ([\d.]+)/); if (m) { const mn = +m[1].replace(/\./g, ''), mx = +m[2].replace(/\./g, ''); if (+val < mn || +val > mx) val = String(Math.round(((mn + mx) / 2) / 100) * 100); if (/breedte/i.test(next.label)) { res.widthRange = [mn, mx]; res.width = +val; } }
            await inp.click(); await inp.fill(val); await page.keyboard.press("Tab"); await page.waitForTimeout(1200); warn = await dismissWarn(); }
          res.fields.push({ field: next.label, kind: 'text', filled: val || null, range, warn });
        }
      }
      res.final = await dialogRows();
      // breedte-probe: uitval/arm opties per breedte
      if (probeWidths.length) {
        res.probe = [];
        const rows0 = await dialogRows();
        const wRow = rows0.find(r => /breedte/i.test(r.label) && r.idx >= 0);
        const target = rows0.find(r => /^uitval/i.test(r.label) && r.kind === 'select') || rows0.find(r => /uitval/i.test(r.label) && r.kind === 'select');
        let pws = probeWidths; if (res.widthRange) { const [mn, mx] = res.widthRange; pws = []; for (let w = Math.ceil(mn / 500) * 500; w < mx; w += 500) pws.push(w); pws.push(mx); if (!pws.includes(mn)) pws.unshift(mn); }
        if (wRow && target) for (const w of pws) {
          const inp = page.locator('input:visible').nth(wRow.idx); await inp.click(); await inp.fill(String(w)); await page.keyboard.press('Tab'); await page.waitForTimeout(1300);
          const pw = await dismissWarn(); if (pw) { res.probe.push({ width: w, warn: pw }); continue; }
          const rows1 = await dialogRows(); const t1 = rows1.find(r => r.label === target.label);
          let opts = []; if (t1 && t1.idx >= 0) { opts = await openOpts(t1.idx); if (!opts.length) { await page.keyboard.press('Escape'); await page.waitForTimeout(700); opts = await openOpts(t1.idx); } await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
          const msg = await page.evaluate(() => [...document.querySelectorAll('.alert, .toast, .svy-dialog')].filter(e => e.getClientRects().length).map(e => e.innerText.replace(/\s+/g, ' ')).filter(t => /max|min|niet|fout|ongeldig/i.test(t) && !t.includes('Productingave')).join(' || ').slice(0, 300));
          if (!opts.length && t1 && t1.value) opts = [t1.value.replace(/^\[SELECT:|\]$/g, '') + ' (enige keuze, automatisch gevuld)'];
          res.probe.push({ width: w, field: target.label, options: opts, msg });
        }
      }
      await page.screenshot({ path: '/Users/clawdboot/.playwright-mcp/sm-prod-' + prod.replace(/[^a-z0-9]+/gi, '_') + '-' + tag + '.png', fullPage: true });
      await page.getByRole('button', { name: 'Annuleren' }).first().click(); await page.waitForTimeout(1200);
      // orderregel-dialoog sluiten indien aanwezig
      if (await page.getByText('Orderregelreferentie').count()) { await page.getByRole('button', { name: 'Annuleren' }).first().click(); await page.waitForTimeout(1200); }
    } catch (e) { res.errors.push(String(e).slice(0, 300)); try { await dismissWarn(); for (let k = 0; k < 3; k++) { const b = page.getByRole('button', { name: 'Annuleren' }).first(); if (await b.count()) { await b.click(); await page.waitForTimeout(800); } } } catch (_) { } }
    await page.evaluate((r) => { window.__SMR = window.__SMR || []; window.__SMR.push(r); }, res);
    summary.push({ product: prod, tag, nFields: res.fields.length, selects: res.fields.filter(f => f.kind === 'select').map(f => f.field + '(' + f.options.length + ')').join(', '), errors: res.errors });
    return res;
  };
  for (const prod of products) {
    const base = await runOne(prod, prefer, tag);
    const branchFields = CFG.branchFields || (CFG.branch ? [CFG.branch] : []);
    const skipRe = CFG.branchSkip ? new RegExp(CFG.branchSkip, 'i') : null;
    let fieldsToBranch = branchFields.length ? base.fields.filter(f => f.kind === 'select' && branchFields.includes(f.field)) : [];
    if (CFG.branchAuto) fieldsToBranch = base.fields.filter(f => f.kind === 'select' && f.options.length >= 2 && f.options.length <= (CFG.branchMax || 13) && !(skipRe && skipRe.test(f.field)));
    for (const bf of fieldsToBranch) for (const opt of bf.options.slice(1)) {
      if (CFG.branchOnly && !CFG.branchOnly.some(([f, o]) => f === bf.field && o === opt)) continue;
      const esc = opt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      await runOne(prod, Object.assign({}, prefer, { [bf.field]: '^' + esc + '$' }), 'variant ' + bf.field + ' = ' + opt);
    }
  }
  return summary;
}
