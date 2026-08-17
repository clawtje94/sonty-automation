// WhatsApp-verzender via Accessibility (JXA). Gebruik:
//   osascript -l JavaScript wa-stuur.jxa.js <doel> <bericht1> [bericht2 ...]
//
// WhatsApp (Catalyst) accepteert chatwissels alleen betrouwbaar als de app vooraan staat;
// achtergrond-AXPress, proces-muiskliks en verborgen vensters bleken allemaal wankel
// (Catalyst gooit verborgen vensters ook nog eens weg). Daarom: kort en netjes overnemen
// en alles terugzetten. De aanroeper (sunny-weetje.js) wacht eerst tot Daimy idle is,
// zodat dit nooit gebeurt terwijl hij aan het werk is (Daimy 17-08).
//  - onthoud welke app vooraan stond, activeer WhatsApp (maakt een dicht venster ook
//    opnieuw aan), doe het werk, verberg WhatsApp en geef de vorige app de focus terug
//  - chatrij aanklikken en de header van de geopende chat controleren tegen <doel>
//    voordat er ook maar iets getypt wordt (nooit blind Enter op zoekresultaten)
//  - tekst typen met scripts/bin/wa-type (unicode-events naar het proces, geen klembord)
//  - versturen via de echte "Stuur"-knop en teruglezen dat het vak leeg is
// Het berichtenpaneel wordt bij het scannen overgeslagen (honderden elementen, elke
// property-call is een los Apple Event; anders loopt het uit de tijd).
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
    const p = se.processes['WhatsApp'];
    if (p.windows().length === 0) throw new Error('WhatsApp-venster wil niet openen');
    const pid = p.unixId();
    const TYPER = ($.NSHomeDirectory().js) + '/sonty/scripts/bin/wa-type';
    function typ(t) {
      ca.doShellScript(`'${TYPER.replace(/'/g, `'\\''`)}' ${pid} '${t.replace(/'/g, `'\\''`)}'`);
    }

    const INTERESSANT = ['AXButton', 'AXGenericElement', 'AXTextArea', 'AXGroup'];
    function verzamel() {
      const alles = [];
      function walk(el, d) {
        if (d > 25) return;
        let kids = [];
        try { kids = el.uiElements(); } catch (e) { return; }
        for (const k of kids) {
          let r = '';
          try { r = k.role(); } catch (e) {}
          if (INTERESSANT.includes(r)) {
            let desc = '';
            try { desc = String(k.description() || ''); } catch (e) {}
            if (r === 'AXGroup' && norm(desc).startsWith('berichteninchat')) {
              alles.push({ el: k, r, desc, vl: '', x: 0, y: 0, w: 0, h: 0, paneel: true });
              continue; // berichtenpaneel niet in afdalen
            }
            let vl = '', pos = [0, 0], sz = [0, 0];
            try { vl = String(k.value() || ''); } catch (e) {}
            try { pos = k.position(); } catch (e) {}
            try { sz = k.size(); } catch (e) {}
            alles.push({ el: k, r, desc, vl, x: pos[0], y: pos[1], w: sz[0], h: sz[1] });
          }
          walk(k, d + 1);
        }
      }
      walk(p.windows[0], 1);
      return alles;
    }

    // 1. chatrij zoeken in de linkerlijst (links van het berichtenpaneel) en openen
    let alles = verzamel();
    let paneel = alles.find((e) => e.paneel);
    let grens = 100000;
    if (paneel) { try { grens = paneel.el.position()[0]; } catch (e) {} }
    const rij = alles.find((e) => (e.r === 'AXButton' || e.r === 'AXGenericElement')
      && e.x < grens && e.w > 250 && e.h > 40 && norm(e.desc + e.vl).includes(doel));
    if (!rij) throw new Error('chatrij niet gevonden voor: ' + argv[0]);
    se.click(rij.el);
    delay(2);

    // 2. header van de geopende chat controleren (bovenin, rechts van de lijst)
    alles = verzamel();
    paneel = alles.find((e) => e.paneel);
    if (paneel) { try { grens = paneel.el.position()[0]; } catch (e) {} }
    const header = alles.find((e) => !e.paneel && e.x >= grens - 80 && e.y < 300 && norm(e.desc).includes(doel));
    if (!header) throw new Error('geopende chat matcht het doel niet, gestopt zonder te sturen');

    // 3. per bericht: vak leegmaken, typen, controleren, met de Stuur-knop versturen
    const vak = alles.find((e) => e.r === 'AXTextArea' && norm(e.desc).includes('stelberichtop'));
    if (!vak) throw new Error('berichtvak niet gevonden');
    function vakWaarde() {
      try { return String(vak.el.value() || ''); } catch (e) { return ''; }
    }
    se.click(vak.el);
    delay(0.8);
    for (const m of msgs) {
      const kern = norm(m).slice(0, 15);
      let getypt = false;
      for (let poging = 0; poging < 4 && !getypt; poging += 1) {
        typ('--wis');
        delay(0.5);
        typ(m);
        delay(1.2);
        getypt = norm(vakWaarde()).includes(kern);
        if (!getypt) { se.click(vak.el); delay(0.8); }
      }
      if (!getypt) throw new Error('tekst komt niet aan in het berichtvak');
      const na = verzamel();
      const stuur = na.find((e) => e.r === 'AXButton' && norm(e.desc) === 'stuur');
      if (!stuur) throw new Error('Stuur-knop niet gevonden terwijl er tekst staat');
      se.click(stuur.el);
      delay(2);
      if (norm(vakWaarde()).includes(kern)) throw new Error('Stuur-knop verstuurde het bericht niet');
    }
    herstel();
    return 'OK: ' + msgs.length + ' bericht(en) naar ' + argv[0];
  } catch (e) {
    herstel();
    throw e;
  }
}
