// WhatsApp-verzender via Accessibility (JXA). Gebruik:
//   osascript -l JavaScript wa-stuur.jxa.js <doel> <bericht1> [bericht2 ...]
//
// LESSEN 17/18-08 (alle eerdere fouten zitten hierin verwerkt):
//  - WhatsApp (Catalyst) accepteert chatwissels alleen frontmost; daarom kort overnemen
//    en daarna alles herstellen. De aanroeper wacht eerst tot Daimy idle is.
//  - Element-referenties zijn index-paden die verlopen zodra WhatsApp opnieuw rendert
//    ("Ongeldige index" -1719). Daarom: GERICHT zoeken (stoppen bij de eerste match,
//    seconden i.p.v. halve minuut volle scan) en direct klikken op een verse referentie,
//    met per stap een eigen retry. Nooit een referentie van een eerdere scan hergebruiken.
//  - Na Cmd+Q is het proces even niet scriptbaar ("Object kan niet worden opgevraagd"),
//    dus wachten tot het venster er echt staat.
//  - Typen via scripts/bin/wa-type (unicode-events naar het proces, geen klembord),
//    versturen via de echte Stuur-knop met Enter-fallback, en na afloop teruglezen.
//  - Er wordt pas iets getypt als de header van de geopende chat aantoonbaar het doel is.
ObjC.import('Cocoa');

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
}

function run(argv) {
  const doel = norm(argv[0]);
  const msgs = argv.slice(1);
  if (!doel || !msgs.length) throw new Error('gebruik: doel bericht...');

  const se = Application('System Events');
  const ca = Application.currentApplication();
  ca.includeStandardAdditions = true;
  const vorige = $.NSWorkspace.sharedWorkspace.frontmostApplication.localizedName.js;

  function herstel() {
    try { se.processes['WhatsApp'].visible = false; } catch (e) {}
    delay(0.5);
    try { if (vorige && vorige !== 'WhatsApp') Application(vorige).activate(); } catch (e) {}
  }

  try {
    ca.doShellScript('open -a WhatsApp');
    delay(4);
    function vensters() {
      try { return se.processes['WhatsApp'].windows().length; } catch (e) { return -1; }
    }
    for (let i = 0; i < 15 && vensters() < 1; i += 1) delay(2);
    if (vensters() < 1) throw new Error('WhatsApp-venster wil niet openen');
    const p = se.processes['WhatsApp'];
    const pid = p.unixId();
    const TYPER = ($.NSHomeDirectory().js) + '/sonty/scripts/bin/wa-type';
    function typ(...args) {
      const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
      ca.doShellScript(`${q(TYPER)} ${pid} ${args.map(q).join(' ')}`);
    }
    typ('--keycode', '53'); // Escape: oud zoekfilter weg zodat alle chatrijen zichtbaar zijn
    delay(0.8);

    // Gericht zoeken: loop de boom af en stop bij de eerste match. Berichtenpaneel
    // overslaan (honderden elementen). Geeft een verse referentie of null.
    function vind(pred) {
      let res = null;
      function walk(el, d) {
        if (d > 25 || res) return;
        let kids = [];
        try { kids = el.uiElements(); } catch (e) { return; }
        for (const k of kids) {
          if (res) return;
          let r = '', desc = '';
          try { r = k.role(); } catch (e) {}
          try { desc = String(k.description() || ''); } catch (e) {}
          if (r === 'AXGroup' && norm(desc).startsWith('berichteninchat')) continue;
          let vl = '';
          if (r === 'AXButton' || r === 'AXGenericElement') { try { vl = String(k.value() || ''); } catch (e) {} }
          if (pred(r, desc, vl, k)) { res = k; return; }
          walk(k, d + 1);
        }
      }
      try { walk(p.windows[0], 1); } catch (e) { /* venster net ververst; caller retryt */ }
      return res;
    }
    function positie(k) { try { return k.position(); } catch (e) { return [0, 0]; } }
    function maat(k) { try { return k.size(); } catch (e) { return [0, 0]; } }

    // Stap 1+2 met retry: verse chatrij zoeken, klikken, header verifieren.
    let open = false;
    for (let poging = 0; poging < 4 && !open; poging += 1) {
      const rij = vind((r, desc, vl, k) => (r === 'AXButton' || r === 'AXGenericElement')
        && norm(desc + vl).includes(doel) && maat(k)[0] > 250 && maat(k)[1] > 40 && positie(k)[1] > 200);
      if (rij) {
        try { se.click(rij); } catch (e) { delay(1.5); continue; }
        delay(2);
      } else { delay(1.5); }
      const header = vind((r, desc, vl, k) => (r === 'AXButton' || r === 'AXHeading')
        && norm(desc).includes(doel) && positie(k)[1] < 200);
      // header mag niet de chatrij zelf zijn: rijen zijn hoog (>40px) en staan in de lijst;
      // de maat- en positie-eisen hierboven filteren dat
      open = !!header;
    }
    if (!open) throw new Error('chat wil niet openen op het doel, gestopt zonder te sturen');

    function vakVers() {
      return vind((r, desc) => r === 'AXTextArea' && norm(desc).includes('stelberichtop'));
    }
    function vakWaarde() {
      const v = vakVers();
      try { return v ? String(v.value() || '') : ''; } catch (e) { return ''; }
    }

    for (const m of msgs) {
      const kern = norm(m).slice(0, 15);
      let getypt = false;
      for (let poging = 0; poging < 4 && !getypt; poging += 1) {
        const vak = vakVers();
        if (!vak) { delay(1.5); continue; }
        try { se.click(vak); } catch (e) { delay(1); continue; }
        delay(0.8);
        typ('--wis');
        delay(0.5);
        typ(m);
        delay(1.5);
        getypt = norm(vakWaarde()).includes(kern);
      }
      if (!getypt) throw new Error('tekst komt niet aan in het berichtvak');
      let verstuurd = false;
      for (let poging = 0; poging < 2 && !verstuurd; poging += 1) {
        const stuur = vind((r, desc) => r === 'AXButton' && norm(desc) === 'stuur');
        if (stuur) {
          try { se.click(stuur); } catch (e) { delay(1); continue; }
          delay(2);
          verstuurd = !norm(vakWaarde()).includes(kern);
        } else { delay(1); }
      }
      if (!verstuurd) {
        typ('--keycode', '36');
        delay(2);
        verstuurd = !norm(vakWaarde()).includes(kern);
      }
      if (!verstuurd) throw new Error('bericht wil niet versturen (knop noch Enter)');
    }
    herstel();
    return 'OK: ' + msgs.length + ' bericht(en) naar ' + argv[0];
  } catch (e) {
    herstel();
    throw e;
  }
}
