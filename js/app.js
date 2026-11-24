// Ablauf der Kundenseite: 0 Möbel wählen, 1 Raum, 2 Baukasten mit Feinschliff-Chat, 4 Bild (Bild-KI), 5 Kostenvoranschlag.
// Schritt 3 gibt es nicht mehr als eigene Seite (der Chat sitzt im Baukasten), die Nummern bleiben für die Selektoren.
import { BETRIEB, materialArt } from './betrieb.js';
import {
  berechnePreis,
  masseGrenzen,
  passeKonfigurationEin,
  ueberstand,
  istEinMassForm,
  formatEuro,
  formatZahl,
} from './preis.js';
import {
  kiSignatur,
  seitenverhaeltnisPasst,
  markiertesFoto,
  alsJpeg,
  bildAnfordern,
} from './bildki.js';
import { demoCodeLesen, demoCodeSpeichern, rufeFunction } from './supabase.js';
import { wendeAenderungenAn, promptZusatz, betriebFuerChat } from './feinschliff.js';
import { DEMO_MOEBEL, istFreigeschaltet, moebelSymbol, portfolioLaden } from './portfolio.js';
import {
  normiere,
  markierungsPhase,
  pruefeMarkierung,
  REFERENZ_VORSCHLAG_CM,
} from './markierung.js';

const $ = (sel) => document.querySelector(sel);

/** Text für innerHTML entschärfen (Namen aus betrieb.js werden später bearbeitbar). */
const escape = (s) => String(s).replace(/[&<>"']/g, (z) => `&#${z.charCodeAt(0)};`);

// Darstellung der Materialien (nur Optik, keine Preisdaten).
// Farbe dient als Ersatz-Maserung, solange assets/materialien/<id>.jpg fehlt.
const MATERIAL_FARBE = {
  'eiche-massiv': '#c69c6d',
  'nuss-massiv': '#6b4a33',
  'esche-massiv': '#e2cfa8',
  'eiche-furniert': '#d1ab7c',
  'mdf-lackiert': '#ece8e1',
};
const OHNE_MASERUNG = ['mdf-lackiert'];
// Selbst angelegte Materialien anderer Arten: ruhige Fläche in typischer Farbe, ohne Maserung
const ART_FARBE = { stein: '#bdb7ad', stahl: '#6f7378', glas: '#d3e4e6' };

function materialFarbe(id) {
  const m = BETRIEB.materialien.find((x) => x.id === id);
  return MATERIAL_FARBE[id] || ART_FARBE[materialArt(m)] || (materialArt(m) === 'holz' ? '#c69c6d' : '#cfc8bd');
}

/** Materialkarten, bei mehreren Materialarten mit Zwischenüberschrift je Art. */
function materialKarten() {
  const arten = BETRIEB.materialarten || [{ id: 'holz', name: 'Holz' }];
  const genutzt = arten.filter((a) => BETRIEB.materialien.some((m) => materialArt(m) === a.id));
  return genutzt
    .map((a) => {
      const kopf = genutzt.length > 1 ? `<p class="wahl-gruppe">${escape(a.name)}</p>` : '';
      const karten = BETRIEB.materialien
        .filter((m) => materialArt(m) === a.id)
        .map((m) => {
          const glatt = OHNE_MASERUNG.includes(m.id) || a.id !== 'holz';
          return wahlKarte(
            'material',
            m,
            `<span class="${glatt ? 'muster ohne-maserung' : 'muster'}" data-material="${escape(m.id)}" style="--holz:${materialFarbe(m.id)}"></span><span>${escape(m.name)}</span>`,
          );
        });
      return kopf + karten.join('');
    })
    .join('');
}
const MATERIAL_BILD_ORDNER = 'assets/materialien';

const FOTO_MAX_KANTE = 1600; // px, verkleinert vor dem Speichern

const zustand = {
  schritt: 0,
  moebel: DEMO_MOEBEL, // Schritt 0: gewähltes Möbel (ID aus js/portfolio.js); nur freigeschaltete sind wählbar
  foto: null, // Data-URL (JPEG, verkleinert)
  // Markierung auf dem Foto, normiert 0–1 relativ zu Bildbreite/-höhe
  referenz: { p1: null, p2: null, laengeCm: null }, // p1/p2: { x, y }
  tischPosition: null, // { x, y }
  raumLaenge: null, // cm (Eingabe in m)
  raumBreite: null, // cm
  freiLaenge: null,
  freiBreite: null,
  wunsch: { laenge: null, breite: null, hoehe: null }, // ungefähre Tischmaße in cm
  wunschUebernommen: false, // Wunschmaße schon als Startwerte in den Baukasten gesetzt?
  form: 'rechteckig',
  materialId: 'eiche-massiv',
  laenge: 120,
  breite: 60,
  hoehe: 40,
  gestellId: 'holz',
  oberflaecheId: 'geoelt',
  kiBild: null, // Schritt 4: KI-Bild als JPEG-data-URL
  kiSignaturWert: null, // Angaben, aus denen kiBild entstand (siehe kiSignatur)
  kiInfo: null, // { modell, dauerMs, eingabe:{breite,hoehe}, ergebnis:{breite,hoehe} }
  optionIds: [], // Extras aus dem Feinschliff-Chat (Optionen des Betriebs, fester Aufpreis)
  sonderwuensche: [], // [{ beschreibung, promptZusatz }] – Preis auf Anfrage
  optionZusaetze: {}, // { optionId: englischer Satz für den Bild-Prompt }
  chat: [], // [{ rolle: 'kunde'|'assistent', text, hinweise? }]
};

// ---------- Navigation ----------

function schritt1Fertig() {
  return (
    Boolean(zustand.foto) &&
    !pruefeMarkierung(zustand.referenz, zustand.tischPosition) &&
    !pruefeFreienPlatz() &&
    !pruefeRaum() &&
    !pruefeWunsch()
  );
}

function zeigeSchritt(nr) {
  zustand.schritt = nr;
  document.querySelectorAll('.schritt').forEach((s) => {
    s.hidden = s.id !== `schritt-${nr}`;
  });
  // Vor Baukasten, Bild und Kostenvoranschlag immer Wunschmaße übernehmen und einpassen,
  // auch wenn ein Schritt direkt über die Schrittleiste geöffnet wird.
  if (nr === 2 || nr === 4 || nr === 5) konfigurationEinpassen();
  stepperAktualisieren();
  kickerSetzen(nr);
  if (nr === 2) baukastenAnzeigen();
  if (nr === 4) bildSchrittAnzeigen();
  if (nr === 5) kostenvoranschlagAnzeigen();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/** „Schritt 2 von 3“ – gezählt werden nur die sichtbaren Schritte der Leiste. */
function kickerSetzen(nr) {
  const sichtbar = [...document.querySelectorAll('.schritte li:not([hidden]) button')].map((b) => Number(b.dataset.schritt));
  const pos = sichtbar.indexOf(nr) + 1;
  const kicker = document.querySelector(`#schritt-${nr} .kicker`);
  if (kicker && pos > 0) kicker.textContent = `Schritt ${pos} von ${sichtbar.length}`;
}

function stepperAktualisieren() {
  const fertig1 = schritt1Fertig();
  document.querySelectorAll('.schritte button').forEach((btn) => {
    const nr = Number(btn.dataset.schritt);
    if (nr === 3) return; // Feinschliff ist Teil des Baukastens, eigener Schritt bleibt ausgeblendet
    btn.disabled = nr > 1 && !fertig1;
    btn.classList.toggle('erledigt', nr < zustand.schritt);
    if (nr === zustand.schritt) btn.setAttribute('aria-current', 'step');
    else btn.removeAttribute('aria-current');
  });
}

// ---------- Schritt 0: Möbel wählen ----------

const moebelPortfolio = portfolioLaden();

/** Anzeigename des gewählten Möbels (Portfolio der Tischlerei, sonst betrieb.js). */
function moebelName() {
  return moebelPortfolio.moebel.find((m) => m.id === zustand.moebel)?.name || BETRIEB.moebelart;
}

function schritt0Einrichten() {
  $('#moebel-raster').innerHTML = moebelPortfolio.moebel
    .map((m) => {
      const frei = istFreigeschaltet(m.id);
      return `<label class="moebel-karte${frei ? '' : ' bald'}">
        <input type="radio" name="moebel" value="${escape(m.id)}"${m.id === zustand.moebel ? ' checked' : ''}${frei ? '' : ' disabled'}>
        <span class="moebel-symbol">${moebelSymbol(m.id, 44)}</span>
        <span class="moebel-name">${escape(m.name)}</span>
        <span class="moebel-status">${frei ? 'Jetzt gestalten' : 'Bald verfügbar'}</span>
      </label>`;
    })
    .join('');
  const moebelSetzen = (wert) => {
    zustand.moebel = wert;
    $('#kv-titel').textContent = `Kostenvoranschlag · ${moebelName()}`;
  };
  // Pfeiltasten wechseln nur die Auswahl …
  $('#wahl-moebel').addEventListener('change', (e) => {
    if (e.target.name !== 'moebel' || !istFreigeschaltet(e.target.value)) return;
    moebelSetzen(e.target.value);
  });
  // … ein Klick auf die Karte (oder Enter/Leertaste) wählt das Möbel und geht direkt weiter zum Raum.
  // Klicks auf das Radio selbst kommen nur als Folge des Label-Klicks und werden übersprungen.
  const waehlenUndWeiter = (input) => {
    if (!input || input.disabled || !istFreigeschaltet(input.value)) return;
    input.checked = true;
    moebelSetzen(input.value);
    zeigeSchritt(1);
  };
  $('#moebel-raster').addEventListener('click', (e) => {
    if (e.target.matches('input')) return;
    const karte = e.target.closest('.moebel-karte');
    if (!karte) return;
    e.preventDefault();
    waehlenUndWeiter(karte.querySelector('input[name="moebel"]'));
  });
  $('#moebel-raster').addEventListener('keydown', (e) => {
    if ((e.key !== 'Enter' && e.key !== ' ') || !e.target.matches('input[name="moebel"]')) return;
    e.preventDefault();
    waehlenUndWeiter(e.target);
  });
  $('#kv-titel').textContent = `Kostenvoranschlag · ${moebelName()}`;
}

// ---------- Schritt 1: Raum ----------

function fotoLaden(datei) {
  if (!datei) return;
  if (!datei.type.startsWith('image/')) {
    zeigeFehler('fehler-1', 'Bitte wählen Sie eine Bilddatei (JPG oder PNG).');
    return;
  }
  const url = URL.createObjectURL(datei);
  const bild = new Image();
  bild.onload = () => {
    const faktor = Math.min(1, FOTO_MAX_KANTE / Math.max(bild.width, bild.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bild.width * faktor);
    canvas.height = Math.round(bild.height * faktor);
    canvas.getContext('2d').drawImage(bild, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    zustand.foto = canvas.toDataURL('image/jpeg', 0.85);
    zustand.kiBild = zustand.kiSignaturWert = zustand.kiInfo = null; // anderer Raum
    markierungZuruecksetzen();
    fotoAnzeigen();
    zeigeFehler('fehler-1', null);
    stepperAktualisieren();
  };
  bild.onerror = () => {
    URL.revokeObjectURL(url);
    zeigeFehler('fehler-1', 'Dieses Bild konnte nicht gelesen werden. Bitte versuchen Sie ein JPG oder PNG.');
  };
  bild.src = url;
}

function fotoAnzeigen() {
  const hat = Boolean(zustand.foto);
  if (hat) $('#foto-vorschau').src = zustand.foto;
  $('#upload-zone').hidden = hat;
  $('#markierung').hidden = !hat;
  $('#foto-tipp').hidden = hat;
  markierungAktualisieren();
}

// ---------- Schritt 1: Markierung auf dem Foto ----------

function markierungZuruecksetzen() {
  // Länge bleibt erhalten, falls schon eingegeben
  zustand.referenz = { p1: null, p2: null, laengeCm: zustand.referenz.laengeCm };
  zustand.tischPosition = null;
}

/** Punkt setzen, je nachdem, was als Nächstes dran ist. */
function punktSetzen(p) {
  if (!p) return; // Bild noch nicht bereit
  const phase = markierungsPhase(zustand.referenz, zustand.tischPosition);
  if (phase === 'ref1') zustand.referenz.p1 = p;
  else if (phase === 'ref2') {
    zustand.referenz.p2 = p;
    if (zustand.referenz.laengeCm === null) zustand.referenz.laengeCm = REFERENZ_VORSCHLAG_CM;
  } else if (phase === 'tisch') zustand.tischPosition = p;
  else return; // fertig: Punkte nur noch verschieben
  zeigeFehler('fehler-1', null);
  markierungAktualisieren();
}

function punktVerschieben(name, p) {
  if (!p) return;
  if (name === 'tisch') zustand.tischPosition = p;
  else zustand.referenz[name] = p;
  markierungAktualisieren();
}

const STATUS_TEXT = {
  ref1: 'Tippen Sie auf das erste Ende des Gegenstands.',
  ref2: 'Jetzt auf das andere Ende tippen.',
  tisch: 'Tippen Sie auf die Stelle, an der das Möbelstück stehen soll.',
  fertig: 'Fertig. Punkte lassen sich mit Finger oder Maus verschieben.',
};

/** Anleitung, Längenfeld, Status und SVG-Overlay auf den Zustand bringen. */
function markierungAktualisieren() {
  const { referenz, tischPosition } = zustand;
  const phase = markierungsPhase(referenz, tischPosition);
  const refFertig = phase === 'tisch' || phase === 'fertig';

  $('#markier-schritt-ref').className = `markier-schritt ${refFertig ? 'erledigt' : 'aktiv'}`;
  $('#markier-schritt-tisch').className = `markier-schritt ${phase === 'fertig' ? 'erledigt' : phase === 'tisch' ? 'aktiv' : ''}`;
  const feld = $('#referenz-laenge');
  if (document.activeElement !== feld) feld.value = referenz.laengeCm ?? '';
  $('#markier-status').textContent = STATUS_TEXT[phase];
  $('#markier-flaeche').classList.toggle('fertig', phase === 'fertig');
  $('#neu-markieren').disabled = phase === 'ref1';

  markierungZeichnen();
  stepperAktualisieren();
}

const prozent = (w) => `${(w * 100).toFixed(2)}%`;

/** Etikett (dunkle Pille mit Text) an einer Stelle, Breite grob nach Zeichenzahl. */
function etikett(p, text, versatzY = 0, klasse = 'etikett-flaeche') {
  const breite = Math.round(text.length * 7.6 + 18);
  return `<svg x="${prozent(p.x)}" y="${prozent(p.y)}" overflow="visible">
    <rect class="${klasse}" x="${-breite / 2}" y="${versatzY - 12}" width="${breite}" height="24" rx="12"/>
    <text class="etikett-text" x="0" y="${versatzY + 4.5}" text-anchor="middle">${escape(text)}</text>
  </svg>`;
}

function markierungZeichnen() {
  const { p1, p2, laengeCm } = zustand.referenz;
  const t = zustand.tischPosition;
  const teile = [];

  if (p1 && p2) {
    teile.push(`<line class="ref-linie" x1="${prozent(p1.x)}" y1="${prozent(p1.y)}" x2="${prozent(p2.x)}" y2="${prozent(p2.y)}"/>`);
    const mitte = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    teile.push(etikett(mitte, Number.isFinite(laengeCm) ? `${formatZahl(laengeCm)} cm` : '? cm', -22));
  }
  for (const [name, p] of [['p1', p1], ['p2', p2]]) {
    if (!p) continue;
    teile.push(`<svg x="${prozent(p.x)}" y="${prozent(p.y)}" overflow="visible" data-punkt="${name}">
      <circle class="ref-punkt" r="8"/>
      <circle class="griff" r="24"/>
    </svg>`);
  }
  if (t) {
    teile.push(`<svg x="${prozent(t.x)}" y="${prozent(t.y)}" overflow="visible" data-punkt="tisch">
      <circle class="tisch-ring" r="26"/>
      <circle class="tisch-kern" r="13"/>
      <rect class="tisch-symbol" x="-6" y="-3" width="12" height="4" rx="1"/>
      <rect class="tisch-symbol" x="-5" y="1" width="2" height="4"/>
      <rect class="tisch-symbol" x="3" y="1" width="2" height="4"/>
      <circle class="griff" r="28"/>
    </svg>`);
    // Etikett unter dem Marker, am unteren Bildrand darüber
    teile.push(etikett(t, 'Möbel', t.y > 0.8 ? -42 : 42, 'tisch-etikett'));
  }
  $('#markier-svg').innerHTML = teile.join('');
}

/** Tippen setzt Punkte, Ziehen an einem Punkt verschiebt ihn. Pointer Events: Maus und Finger. */
function markierungEinrichten() {
  const flaeche = $('#markier-flaeche');
  const bildRect = () => $('#foto-vorschau').getBoundingClientRect();
  let ziehen = null; // { name, id }
  let tippen = null; // { id, x, y }

  flaeche.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary) return;
    const punkt = e.target.closest('[data-punkt]');
    if (punkt) {
      ziehen = { name: punkt.dataset.punkt, id: e.pointerId, el: punkt };
      punkt.classList.add('ziehen');
      try {
        flaeche.setPointerCapture(e.pointerId);
      } catch {
        // ohne Capture klappt das Ziehen innerhalb der Fläche trotzdem
      }
      e.preventDefault();
      return;
    }
    tippen = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });

  flaeche.addEventListener('pointermove', (e) => {
    if (!ziehen || e.pointerId !== ziehen.id) return;
    punktVerschieben(ziehen.name, normiere(e.clientX, e.clientY, bildRect()));
  });

  const ende = (e) => {
    if (ziehen && e.pointerId === ziehen.id) {
      ziehen = null;
      return;
    }
    if (tippen && e.pointerId === tippen.id && e.type === 'pointerup') {
      const bewegt = Math.hypot(e.clientX - tippen.x, e.clientY - tippen.y);
      if (bewegt < 10) punktSetzen(normiere(e.clientX, e.clientY, bildRect()));
    }
    tippen = null;
  };
  flaeche.addEventListener('pointerup', ende);
  flaeche.addEventListener('pointercancel', ende);

  $('#referenz-laenge').addEventListener('input', (e) => {
    zustand.referenz.laengeCm = leseZahl(e.target.value);
    markierungZeichnen();
    stepperAktualisieren();
  });

  $('#neu-markieren').addEventListener('click', () => {
    markierungZuruecksetzen();
    zeigeFehler('fehler-1', null);
    markierungAktualisieren();
  });
}

/** Dezimalzahl mit Komma oder Punkt lesen; leer/ungültig → null. */
function leseZahl(text) {
  const wert = parseFloat(String(text).trim().replace(',', '.'));
  return Number.isFinite(wert) ? wert : null;
}

/** Raummaße prüfen (optional). Fehlermeldung oder null. */
function pruefeRaum() {
  const falsch = [zustand.raumLaenge, zustand.raumBreite].some((cm) => cm !== null && (cm < 50 || cm > 5000));
  return falsch ? 'Bitte prüfen Sie die Raummaße, z. B. 4,50 × 3,80 m.' : null;
}

/** Wunschmaße prüfen (optional). Fehlermeldung oder null. */
function pruefeWunsch() {
  const falsch = Object.values(zustand.wunsch).some((w) => w !== null && (w <= 0 || w > 1000));
  return falsch ? 'Bitte geben Sie die ungefähren Maße des Möbelstücks in cm an.' : null;
}

/** Liefert eine Fehlermeldung oder null, wenn der freie Platz passt. */
function pruefeFreienPlatz() {
  const { freiLaenge: l, freiBreite: b } = zustand;
  if (!Number.isFinite(l) || !Number.isFinite(b) || l <= 0 || b <= 0) {
    return 'Bitte geben Sie Länge und Breite des freien Platzes in cm an.';
  }
  return null;
}

function schritt1Weiter() {
  if (!zustand.foto) {
    zeigeFehler('fehler-1', 'Bitte laden Sie zuerst ein Foto Ihres Raums hoch.');
    return;
  }
  const fehler =
    pruefeMarkierung(zustand.referenz, zustand.tischPosition) || pruefeFreienPlatz() || pruefeRaum() || pruefeWunsch();
  if (fehler) {
    zeigeFehler('fehler-1', fehler);
    return;
  }
  zeigeFehler('fehler-1', null);
  zeigeSchritt(2);
}

function schritt1Einrichten() {
  const input = $('#foto-input');
  input.addEventListener('change', () => fotoLaden(input.files[0]));
  $('#foto-wechseln').addEventListener('click', () => {
    input.value = '';
    input.click();
  });

  const zone = $('#upload-zone');
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('ziehen');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('ziehen'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('ziehen');
    fotoLaden(e.dataTransfer.files[0]);
  });

  for (const [id, feld] of [['#frei-laenge', 'freiLaenge'], ['#frei-breite', 'freiBreite']]) {
    $(id).addEventListener('input', (e) => {
      const wert = leseZahl(e.target.value);
      // 1,6 → Meter, 160 → Zentimeter
      zustand[feld] = wert === null || wert <= 0 ? null : Math.round(wert < 10 ? wert * 100 : wert);
      e.target.classList.remove('ungueltig');
      stepperAktualisieren();
    });
  }

  for (const [id, feld] of [['#raum-laenge', 'raumLaenge'], ['#raum-breite', 'raumBreite']]) {
    $(id).addEventListener('input', (e) => {
      const wert = leseZahl(e.target.value);
      // 4,50 → Meter, 450 → Zentimeter
      zustand[feld] = wert === null ? null : Math.round(wert > 30 ? wert : wert * 100);
      stepperAktualisieren();
    });
  }

  for (const mass of ['laenge', 'breite', 'hoehe']) {
    $(`#wunsch-${mass}`).addEventListener('input', (e) => {
      const wert = leseZahl(e.target.value);
      zustand.wunsch[mass] = wert === null || wert <= 0 ? null : wert < 3 ? Math.round(wert * 100) : wert;
      zustand.wunschUebernommen = false; // beim nächsten Öffnen des Baukastens neu übernehmen
      stepperAktualisieren();
    });
  }

  markierungEinrichten();
  $('#weiter-1').addEventListener('click', schritt1Weiter);
  $('#zurueck-1').addEventListener('click', () => zeigeSchritt(0));
}

// ---------- Schritt 2: Baukasten ----------

const FORM_SYMBOL = {
  rechteckig: '<rect x="2" y="6" width="36" height="16" rx="2"/>',
  quadratisch: '<rect x="8" y="2" width="24" height="24" rx="2"/>',
  rund: '<circle cx="20" cy="14" r="12"/>',
  oval: '<ellipse cx="20" cy="14" rx="18" ry="10"/>',
};

function wahlKarte(name, eintrag, inhalt) {
  return `<label><input type="radio" name="${name}" value="${escape(eintrag.id)}">${inhalt}</label>`;
}

function aufpreisText(preis) {
  return preis === 0 ? 'inklusive' : `+ ${formatEuro(preis)}`;
}

function schritt2Einrichten() {
  $('#wahl-form').innerHTML = BETRIEB.formen
    .map((f) =>
      wahlKarte('form', f, `<svg class="form-symbol" viewBox="0 0 40 28" aria-hidden="true">${FORM_SYMBOL[f.id] || ''}</svg><span>${escape(f.name)}</span>`),
    )
    .join('');
  $('#wahl-material').innerHTML = materialKarten();
  musterBilderLaden();
  $('#wahl-gestell').innerHTML = BETRIEB.gestelle
    .map((g) => wahlKarte('gestell', g, `<span>${escape(g.name)}</span><span class="aufpreis">${escape(aufpreisText(g.preis))}</span>`))
    .join('');
  $('#wahl-oberflaeche').innerHTML = BETRIEB.oberflaechen
    .map((o) => wahlKarte('oberflaeche', o, `<span>${escape(o.name)}</span><span class="aufpreis">${escape(aufpreisText(o.preis))}</span>`))
    .join('');

  const felder = { form: 'form', material: 'materialId', gestell: 'gestellId', oberflaeche: 'oberflaecheId' };
  document.querySelector('.baukasten-optionen').addEventListener('change', (e) => {
    const feld = felder[e.target.name];
    if (!feld) return;
    if (feld === 'form') formWechseln(e.target.value);
    else zustand[feld] = e.target.value;
    baukastenAktualisieren();
  });

  for (const mass of ['laenge', 'breite', 'hoehe']) {
    $(`#regler-${mass}`).addEventListener('input', (e) => {
      zustand[mass] = Number(e.target.value);
      reglerFuellung(e.target);
      $('#wunsch-hinweis').hidden = true;
      if (istEinMassForm(zustand.form) && mass === 'laenge') zustand.breite = zustand.laenge;
      baukastenAktualisieren();
    });
  }

  document.querySelectorAll('.umschalter button').forEach((b) => {
    b.addEventListener('click', () => buehneAnsicht(b.dataset.ansicht));
  });

  $('#weiter-2').addEventListener('click', () => zeigeSchritt(4));
  $('#zurueck-2').addEventListener('click', () => zeigeSchritt(1));
}

/**
 * Holzbilder aus assets/materialien/<id>.jpg laden. Fehlt eine Datei,
 * bleibt die CSS-Maserung stehen.
 */
function musterBilderLaden() {
  document.querySelectorAll('.muster[data-material]').forEach((el) => {
    const url = `${MATERIAL_BILD_ORDNER}/${encodeURIComponent(el.dataset.material)}.jpg`;
    const bild = new Image();
    bild.onload = () => {
      el.style.setProperty('--muster-bild', `url("${url}")`);
      el.classList.add('mit-foto');
    };
    bild.src = url;
  });
}

// ---------- Bühne ----------

/** Bild auf der Bühne setzen (Raumfoto oder KI-Bild). */
export function buehneBildSetzen(url, etikett) {
  const bild = $('#buehne-bild');
  if (url && bild.getAttribute('src') !== url) bild.src = url;
  bild.alt = etikett;
  $('#buehne-flaeche').style.setProperty('--buehne-bild', url ? `url("${url}")` : 'none');
  $('#buehne-flaeche').dataset.etikett = etikett;
}

// Ansicht der Bühne: 'raum' (Originalfoto), 'ki' (KI-Bild) oder 'draufsicht'
const zustandBuehne = { ansicht: 'raum' };

function buehneAnsicht(ansicht) {
  if (ansicht === 'ki' && !zustand.kiBild) ansicht = 'raum';
  zustandBuehne.ansicht = ansicht;
  const imBildSchritt = zustand.schritt === 4;
  const draufsicht = ansicht === 'draufsicht';

  if (ansicht === 'ki') {
    buehneBildSetzen(zustand.kiBild, kiVeraltet() ? 'KI-Vorschau · veraltet' : imBildSchritt ? 'Nachher' : 'KI-Vorschau');
  } else {
    buehneBildSetzen(zustand.foto, imBildSchritt ? 'Vorher' : 'Ihr Raum');
  }
  $('#buehne-draufsicht').hidden = !draufsicht;
  $('#buehne-flaeche').classList.toggle('zeigt-draufsicht', draufsicht);
  $('#buehne-etikett').textContent = draufsicht ? 'Draufsicht · maßstäblich' : $('#buehne-flaeche').dataset.etikett;

  // Knöpfe: Schritt 2 „Foto · KI-Bild · Draufsicht“, Schritt 4 „Vorher · Nachher“
  const knopf = (a) => document.querySelector(`.umschalter button[data-ansicht="${a}"]`);
  knopf('raum').textContent = imBildSchritt ? 'Vorher' : 'Foto';
  knopf('ki').textContent = imBildSchritt ? 'Nachher' : 'KI-Bild';
  knopf('ki').hidden = !zustand.kiBild;
  knopf('draufsicht').hidden = imBildSchritt;
  document.querySelectorAll('.umschalter button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.ansicht === ansicht));
  });
}

/** Bühne in den Baukasten (Schritt 2) oder in den Bild-Schritt (4) hängen. */
function buehneVerschieben(schritt) {
  const ziel = schritt === 4 ? $('#bild-buehne-platz') : $('.baukasten-buehne');
  if ($('#buehne').parentElement !== ziel) ziel.prepend($('#buehne'));
}

// Länge/Breite der letzten zweimaßigen Form, damit sie nach „rund“ → „rechteckig“ zurückkommen
let letzteZweiMasse = null;

function formWechseln(neu) {
  const vorher = istEinMassForm(zustand.form);
  const nachher = istEinMassForm(neu);
  if (!vorher && nachher) {
    letzteZweiMasse = { laenge: zustand.laenge, breite: zustand.breite };
    zustand.laenge = zustand.breite = Math.round((zustand.laenge + zustand.breite) / 2);
  } else if (vorher && !nachher && letzteZweiMasse) {
    Object.assign(zustand, letzteZweiMasse);
  }
  zustand.form = neu;
  reglerAktualisieren();
}

// Maße sind nur durch die Grenzen der Tischlerei begrenzt. Der freie Platz
// begrenzt nicht, sondern führt nur zu einem Hinweis (siehe platzHinweisZeigen).
function aktuelleGrenzen() {
  return masseGrenzen(BETRIEB, zustand.form);
}

/**
 * Wunschmaße (falls neu) übernehmen, dann Form und Maße an die Grenzen der Tischlerei anpassen.
 * Wird vor Schritt 2 und Schritt 5 aufgerufen.
 */
function konfigurationEinpassen() {
  const wunschNeu = !zustand.wunschUebernommen;
  if (wunschNeu) wunschmasseUebernehmen();
  let eingepasst = passeKonfigurationEin(konfiguration(), BETRIEB);
  // Wurde rund/quadratisch durch eine zweimaßige Form ersetzt, die vorherigen Länge/Breite
  // zurückholen – wie beim Formwechsel von Hand.
  if (istEinMassForm(zustand.form) && !istEinMassForm(eingepasst.form) && letzteZweiMasse) {
    eingepasst = passeKonfigurationEin({ ...eingepasst, ...letzteZweiMasse }, BETRIEB);
  }
  Object.assign(zustand, eingepasst);
  if (wunschNeu) wunschHinweisZeigen();
}

/** Radio-Eingabe einer Auswahlgruppe finden (ID sicher für den Selektor). */
function wahlInput(name, id) {
  return document.querySelector(`input[name="${name}"][value="${CSS.escape(id)}"]`);
}

/** Beim Betreten von Schritt 2: Auswahl und Regler setzen. */
function baukastenAnzeigen() {
  for (const [name, feld] of [['form', 'form'], ['material', 'materialId'], ['gestell', 'gestellId'], ['oberflaeche', 'oberflaecheId']]) {
    const input = wahlInput(name, zustand[feld]);
    if (input) input.checked = true;
  }
  buehneVerschieben(2);
  buehneAnsicht(zustand.kiBild && !kiVeraltet() ? 'ki' : 'raum');
  $('#chat-code-feld').hidden = Boolean(demoCodeLesen());
  extrasZeichnen();
  chatZeichnen();
  reglerAktualisieren();
  baukastenAktualisieren();
}

/** Ungefähre Tischmaße aus Schritt 1 als Startwerte setzen. */
function wunschmasseUebernehmen() {
  zustand.wunschUebernommen = true;
  const w = zustand.wunsch;
  if (w.laenge !== null) zustand.laenge = Math.round(w.laenge);
  if (w.breite !== null) zustand.breite = Math.round(w.breite);
  if (w.hoehe !== null) zustand.hoehe = Math.round(w.hoehe);
  if (istEinMassForm(zustand.form) && w.laenge !== null) zustand.breite = zustand.laenge;
  letzteZweiMasse = null;
}

/** Nach dem Einpassen: Hinweis, falls Wunschmaße angepasst werden mussten. */
function wunschHinweisZeigen() {
  const w = zustand.wunsch;
  const namen = { laenge: 'Länge', breite: 'Breite', hoehe: 'Höhe' };
  const geaendert = Object.keys(namen)
    .filter((m) => w[m] !== null && Math.round(w[m]) !== zustand[m])
    .filter((m) => !(m === 'breite' && istEinMassForm(zustand.form)))
    .map((m) => `${namen[m]} ${Math.round(w[m])} → ${zustand[m]} cm`);
  const hinweis = $('#wunsch-hinweis');
  hinweis.hidden = geaendert.length === 0;
  hinweis.textContent = `Ihre Wunschmaße wurden an die möglichen Maße der Tischlerei angepasst: ${geaendert.join(', ')}.`;
}

/** Grenzen der Regler je nach Form setzen, Werte einpassen. */
function reglerAktualisieren() {
  Object.assign(zustand, passeKonfigurationEin(konfiguration(), BETRIEB));
  const g = aktuelleGrenzen();
  const einMass = istEinMassForm(zustand.form);

  $('#label-laenge').textContent = zustand.form === 'rund' ? 'Durchmesser' : einMass ? 'Seitenlänge' : 'Länge';
  $('#regler-breite-block').hidden = einMass;

  for (const mass of ['laenge', 'breite', 'hoehe']) {
    const regler = $(`#regler-${mass}`);
    regler.min = g[mass].min;
    regler.max = g[mass].max;
    regler.value = zustand[mass];
    reglerFuellung(regler);
    $(`#grenze-${mass}`).textContent = `${g[mass].min}–${g[mass].max} cm`;
  }
}

/** Gefüllten Teil der Reglerspur setzen (für Chrome/Safari, Firefox nutzt ::-moz-range-progress). */
function reglerFuellung(regler) {
  const min = Number(regler.min);
  const max = Number(regler.max);
  const anteil = max > min ? ((Number(regler.value) - min) / (max - min)) * 100 : 100;
  regler.style.setProperty('--fuellung', `${anteil}%`);
}

function konfiguration() {
  const { form, laenge, breite, hoehe, materialId, gestellId, oberflaecheId, optionIds, sonderwuensche } = zustand;
  return { form, laenge, breite, hoehe, materialId, gestellId, oberflaecheId, optionIds, sonderwuensche };
}

function baukastenAktualisieren() {
  for (const mass of ['laenge', 'breite', 'hoehe']) {
    $(`#wert-${mass}`).textContent = `${zustand[mass]} cm`;
  }
  const preis = berechnePreis(konfiguration(), BETRIEB);
  preisAnimieren(preis.summe);
  $('#preis-rahmen').textContent = `Preisrahmen ${formatEuro(preis.rahmen.von)} – ${formatEuro(preis.rahmen.bis)}`;
  platzHinweisZeigen();
  draufsichtZeichnen();
  veraltetHinweisZeigen();
}

/** Hinweis (keine Sperre), wenn der Tisch größer ist als der freie Platz. */
function platzHinweisZeigen() {
  const u = tischUeberstand();
  const teile = [];
  if (u.laenge) teile.push(`${u.laenge} cm länger`);
  if (u.breite) teile.push(`${u.breite} cm ${zustand.form === 'rund' || zustand.form === 'quadratisch' ? 'tiefer' : 'breiter'}`);
  const hinweis = $('#platz-hinweis');
  hinweis.hidden = u.passt;
  hinweis.textContent =
    `Das Möbelstück ist ${teile.join(' und ')} als Ihr freier Platz (${zustand.freiLaenge} × ${zustand.freiBreite} cm). ` +
    'Sie können es trotzdem so anfragen.';
}

function tischUeberstand() {
  return ueberstand(zustand.form, zustand.laenge, zustand.breite, zustand.freiLaenge, zustand.freiBreite);
}

// Betrag zählt sanft zum neuen Wert (respektiert „Bewegung reduzieren“)
const preisAnzeige = { wert: null, rahmen: 0, ende: null };
const wenigBewegung = window.matchMedia('(prefers-reduced-motion: reduce)');

function preisAnimieren(ziel) {
  const el = $('#preis-summe');
  const start = preisAnzeige.wert;
  cancelAnimationFrame(preisAnzeige.rahmen);
  clearTimeout(preisAnzeige.ende);
  if (start === null || start === ziel || wenigBewegung.matches) {
    preisAnzeige.wert = ziel;
    el.textContent = `ca. ${formatEuro(ziel)}`;
    return;
  }
  el.classList.add('aendert');
  const dauer = 380;
  const t0 = performance.now();
  const schritt = (t) => {
    const p = Math.min(1, (t - t0) / dauer);
    const sanft = 1 - (1 - p) ** 3;
    preisAnzeige.wert = Math.round(start + (ziel - start) * sanft);
    el.textContent = `ca. ${formatEuro(preisAnzeige.wert)}`;
    if (p < 1) preisAnzeige.rahmen = requestAnimationFrame(schritt);
    else preisAnzeige.ende = setTimeout(() => el.classList.remove('aendert'), 250);
  };
  preisAnzeige.rahmen = requestAnimationFrame(schritt);
}

/** Draufsicht: freier Platz (gestrichelt) mit Tisch, maßstabsgetreu. */
function draufsichtZeichnen() {
  const W = zustand.freiLaenge;
  const H = zustand.freiBreite;
  const { form, laenge: L } = zustand;
  const B = istEinMassForm(form) ? L : zustand.breite;
  const cx = W / 2;
  const cy = H / 2;
  // Ausschnitt: freier Platz und Tisch, auch wenn der Tisch übersteht
  const x0 = Math.min(0, cx - L / 2);
  const y0 = Math.min(0, cy - B / 2);
  const x1 = Math.max(W, cx + L / 2);
  const y1 = Math.max(H, cy + B / 2);
  const gross = Math.max(x1 - x0, y1 - y0);
  const rand = gross * 0.08;
  const schrift = gross * 0.05;
  const steht = !tischUeberstand().passt;
  const farbe = materialFarbe(zustand.materialId);
  const kontur = `stroke="${steht ? '#b4532a' : '#6e4620'}" stroke-width="${gross * (steht ? 0.009 : 0.006)}"`;

  let tisch;
  if (form === 'rund') tisch = `<circle cx="${cx}" cy="${cy}" r="${L / 2}" fill="${farbe}" ${kontur}/>`;
  else if (form === 'oval') tisch = `<ellipse cx="${cx}" cy="${cy}" rx="${L / 2}" ry="${B / 2}" fill="${farbe}" ${kontur}/>`;
  else tisch = `<rect x="${cx - L / 2}" y="${cy - B / 2}" width="${L}" height="${B}" rx="${Math.min(L, B) * 0.03}" fill="${farbe}" ${kontur}/>`;

  const masstext = istEinMassForm(form) ? (form === 'rund' ? `⌀ ${L} cm` : `${L} × ${L} cm`) : `${L} × ${B} cm`;
  const textFarbe = zustand.materialId === 'nuss-massiv' ? '#fff' : '#2a2520';

  const svg = $('#draufsicht');
  svg.setAttribute('viewBox', `${x0 - rand} ${y0 - rand - schrift * 1.6} ${x1 - x0 + 2 * rand} ${y1 - y0 + 2 * rand + schrift * 1.6}`);
  svg.innerHTML = `
    <text x="${cx}" y="${y0 - rand * 0.6}" text-anchor="middle" font-size="${schrift * 0.85}" fill="#6f665c">Freier Platz ${W} × ${H} cm</text>
    <rect x="0" y="0" width="${W}" height="${H}" fill="#fbf9f6" stroke="#b9ad9e" stroke-width="${gross * 0.005}" stroke-dasharray="${schrift * 0.5} ${schrift * 0.35}"/>
    ${tisch}
    <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="${schrift}" font-weight="600" fill="${textFarbe}">${masstext}</text>
    <text x="${cx}" y="${y1 + rand * 0.75}" text-anchor="middle" font-size="${schrift * 0.75}" fill="#6f665c">Sofa-Seite</text>`;
}

// ---------- Schritt 2: Feinschliff-Chat ----------

const chatLauf = { laeuft: false };

/** Optionen und Sonderwünsche als kurzer Text, z. B. für Schritt 4. */
function extrasText() {
  const optionen = zustand.optionIds.map((id) => BETRIEB.optionen.find((o) => o.id === id)?.name ?? id);
  const sonder = zustand.sonderwuensche.map((s) => `${s.beschreibung} (auf Anfrage)`);
  return [...optionen, ...sonder].join(', ');
}

function hinweisText(h) {
  if (h.art === 'option') return `✓ ${h.text} · +${formatEuro(h.preis)}`;
  if (h.art === 'sonderwunsch') return `Sonderwunsch: ${h.text} · Preis auf Anfrage`;
  if (h.art === 'einstellung') return `✓ ${h.text}`;
  return h.text;
}

function chatZeichnen() {
  const nachrichten = zustand.chat.map(
    (n) => `<div class="chat-nachricht chat-${n.rolle}">${escape(n.text)}${
      n.hinweise?.length
        ? `<ul class="chat-hinweise">${n.hinweise.map((h) => `<li class="art-${h.art}">${escape(hinweisText(h))}</li>`).join('')}</ul>`
        : ''
    }</div>`,
  );
  if (chatLauf.laeuft) nachrichten.push('<div class="chat-nachricht chat-assistent chat-tippt">Einen Moment …</div>');
  const verlauf = $('#chat-verlauf');
  verlauf.innerHTML = nachrichten.join('');
  verlauf.scrollTop = verlauf.scrollHeight;
  $('#chat-vorschlaege').hidden = zustand.chat.length > 0;
  $('#chat-senden').disabled = chatLauf.laeuft;
  $('#chat-text').disabled = chatLauf.laeuft;
}

function extrasZeichnen() {
  const optionen = zustand.optionIds.map((id) => {
    const o = BETRIEB.optionen.find((x) => x.id === id);
    return `<li><span class="extra-name">${escape(o?.name ?? id)}</span><span class="extra-preis">+${formatEuro(o?.preis ?? 0)}</span>
      <button type="button" data-option="${escape(id)}" aria-label="${escape(o?.name ?? id)} entfernen">×</button></li>`;
  });
  const sonder = zustand.sonderwuensche.map(
    (s, i) => `<li><span class="extra-name">${escape(s.beschreibung)}</span><span class="extra-preis auf-anfrage">Preis auf Anfrage</span>
      <button type="button" data-sonder="${i}" aria-label="${escape(s.beschreibung)} entfernen">×</button></li>`,
  );
  $('#extras').hidden = optionen.length + sonder.length === 0;
  $('#extras-liste').innerHTML = [...optionen, ...sonder].join('');
}

/** Änderungen aus dem Chat übernehmen und Baukasten aktualisieren. */
function chatAenderungenUebernehmen(aenderungen) {
  const { aenderung, hinweise } = wendeAenderungenAn(zustand, aenderungen, BETRIEB);
  if (aenderung.form && aenderung.form !== zustand.form) formWechseln(aenderung.form);
  delete aenderung.form;
  Object.assign(zustand, aenderung);
  if (istEinMassForm(zustand.form) && aenderung.laenge) zustand.breite = zustand.laenge;
  for (const [name, feld] of [['form', 'form'], ['material', 'materialId'], ['gestell', 'gestellId'], ['oberflaeche', 'oberflaecheId']]) {
    const input = wahlInput(name, zustand[feld]);
    if (input) input.checked = true;
  }
  reglerAktualisieren(); // begrenzt Maße auf die Grenzen des Betriebs
  // Hinweis mit dem tatsächlich gesetzten Maß (falls begrenzt)
  for (const h of hinweise) {
    if (h.feld) h.text = `${{ laenge: 'Länge', breite: 'Breite', hoehe: 'Höhe' }[h.feld]}: ${zustand[h.feld]} cm`;
  }
  $('#wunsch-hinweis').hidden = true;
  extrasZeichnen();
  baukastenAktualisieren();
  return hinweise;
}

async function chatSenden(text) {
  text = text.trim();
  if (!text || chatLauf.laeuft) return;
  zeigeFehler('fehler-chat', null);
  if (!$('#chat-code-feld').hidden) {
    const code = $('#chat-code').value.trim();
    if (!code) {
      zeigeFehler('fehler-chat', 'Bitte geben Sie zuerst den Demo-Code ein.');
      $('#chat-code').focus();
      return;
    }
    demoCodeSpeichern(code);
    $('#chat-code-feld').hidden = true;
  }

  const verlauf = zustand.chat.slice(-8).map(({ rolle, text: t }) => ({ rolle, text: t }));
  zustand.chat.push({ rolle: 'kunde', text });
  $('#chat-text').value = '';
  chatLauf.laeuft = true;
  chatZeichnen();
  try {
    const antwort = await rufeFunction(
      'feinschliff',
      { moebel: zustand.moebel, nachricht: text, verlauf, konfiguration: konfiguration(), betrieb: betriebFuerChat(BETRIEB) },
      { wer: 'Der Assistent' },
    );
    const hinweise = chatAenderungenUebernehmen(antwort.aenderungen || []);
    zustand.chat.push({ rolle: 'assistent', text: antwort.antwort, hinweise });
    console.info(`[Feinschliff] Modell ${antwort.modell} · ${hinweise.length} Änderung(en)`);
  } catch (err) {
    console.warn('[Feinschliff] Fehler:', err.code || '', err.message);
    zustand.chat.pop(); // Nachricht zurück ins Eingabefeld
    $('#chat-text').value = text;
    if (err.code === 'demo_code') {
      demoCodeSpeichern('');
      $('#chat-code-feld').hidden = false;
    }
    zeigeFehler('fehler-chat', err.message);
  } finally {
    chatLauf.laeuft = false;
    chatZeichnen();
    $('#chat-text').focus();
  }
}

function feinschliffEinrichten() {
  $('#chat-senden').addEventListener('click', () => chatSenden($('#chat-text').value));
  $('#chat-text').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      chatSenden($('#chat-text').value);
    }
  });
  $('#chat-vorschlaege').addEventListener('click', (e) => {
    const knopf = e.target.closest('button');
    if (knopf) chatSenden(knopf.textContent);
  });
  $('#extras-liste').addEventListener('click', (e) => {
    const knopf = e.target.closest('button');
    if (!knopf) return;
    if (knopf.dataset.option) {
      zustand.optionIds = zustand.optionIds.filter((id) => id !== knopf.dataset.option);
      delete zustand.optionZusaetze[knopf.dataset.option];
    } else if (knopf.dataset.sonder) {
      zustand.sonderwuensche = zustand.sonderwuensche.filter((_, i) => i !== Number(knopf.dataset.sonder));
    }
    extrasZeichnen();
    baukastenAktualisieren();
  });
}

// ---------- Schritt 4: Bild (KI-Vorschau) ----------

const KI_ZEITLIMIT_MS = 130_000; // etwas mehr als das Limit der Edge Function
const kiLauf = { abbruch: null, uhr: 0 };

function kiVeraltet() {
  return Boolean(zustand.kiBild) && zustand.kiSignaturWert !== kiSignatur(zustand);
}

/** KI-Bild nur, wenn es zur aktuellen Auswahl passt (für Kostenvoranschlag und Anfrage). */
function aktuellesKiBild() {
  return zustand.kiBild && !kiVeraltet() ? zustand.kiBild : null;
}

function veraltetHinweisZeigen() {
  const veraltet = kiVeraltet();
  $('#veraltet-2').hidden = !veraltet;
  $('#veraltet-4').hidden = !veraltet || Boolean(kiLauf.abbruch);
  if (zustandBuehne.ansicht === 'ki') buehneAnsicht('ki'); // Etikett „veraltet“ nachziehen
}

function bildSchrittAnzeigen() {
  buehneVerschieben(4);
  const n = namen();
  const daten = [
    ['Form', n.form],
    ['Maße', masseText()],
    ['Material', n.material],
    ['Gestell', n.gestell],
    ['Oberfläche', n.oberflaeche],
  ];
  if (extrasText()) daten.push(['Extras', extrasText()]);
  $('#bild-auswahl').innerHTML = daten.map(([k, v]) => `<dt>${k}</dt><dd>${escape(v)}</dd>`).join('');
  buehneAnsicht(zustand.kiBild ? 'ki' : 'raum');
  veraltetHinweisZeigen();
  bildKnopfAktualisieren();
  // Beim ersten Besuch automatisch erzeugen; danach nur auf Knopfdruck (jeder Aufruf kostet).
  // Ohne Demo-Code erst nach dem Code fragen.
  if (!demoCodeLesen()) demoCodeAbfragen(true);
  else if (!zustand.kiBild && !kiLauf.abbruch) bildErzeugen();
}

function demoCodeAbfragen(an) {
  $('#demo-code-form').hidden = !an;
  $('#bild-erzeugen').hidden = an;
  if (an) $('#demo-code').value = '';
}

function bildKnopfAktualisieren() {
  const laeuft = Boolean(kiLauf.abbruch);
  $('#bild-erzeugen').disabled = laeuft;
  $('#bild-erzeugen').classList.toggle('knopf-haupt', kiVeraltet());
  $('#bild-erzeugen').classList.toggle('knopf-leise', !kiVeraltet());
  $('#bild-erzeugen-text').textContent = laeuft ? 'Wird erzeugt …' : zustand.kiBild ? 'Neu erzeugen' : 'Bild erzeugen';
}

function ladenAnzeigen(an) {
  $('#buehne-laden').hidden = !an;
  $('#buehne-flaeche').classList.toggle('laedt', an);
  clearInterval(kiLauf.uhr);
  if (an) {
    const start = Date.now();
    $('#laden-sekunden').textContent = '0';
    kiLauf.uhr = setInterval(() => {
      $('#laden-sekunden').textContent = String(Math.round((Date.now() - start) / 1000));
    }, 500);
  }
}

async function bildErzeugen() {
  if (kiLauf.abbruch) return;
  zeigeFehler('fehler-4', null);
  const abbruch = new AbortController();
  kiLauf.abbruch = abbruch;
  const zeitlimit = setTimeout(() => abbruch.abort(), KI_ZEITLIMIT_MS);
  const signatur = kiSignatur(zustand);
  ladenAnzeigen(true);
  bildKnopfAktualisieren();
  veraltetHinweisZeigen();
  buehneAnsicht('raum');

  try {
    const markiert = await markiertesFoto(zustand.foto, zustand.referenz, zustand.tischPosition);
    const antwort = await bildAnfordern(
      {
        moebel: zustand.moebel,
        foto: zustand.foto,
        fotoMarkiert: markiert.daten,
        fotoBreite: markiert.breite,
        fotoHoehe: markiert.hoehe,
        referenz: zustand.referenz,
        tischPosition: zustand.tischPosition,
        tisch: { ...konfiguration(), namen: namen(), promptZusatz: promptZusatz(zustand, BETRIEB) },
      },
      abbruch.signal,
    );
    const ergebnis = await alsJpeg(`data:${antwort.mimeType};base64,${antwort.bild}`);
    const eingabe = { breite: markiert.breite, hoehe: markiert.hoehe };
    const groesse = { breite: ergebnis.breite, hoehe: ergebnis.hoehe };
    const passt = seitenverhaeltnisPasst(eingabe, groesse);
    zustand.kiBild = ergebnis.daten;
    zustand.kiSignaturWert = signatur;
    zustand.kiInfo = { modell: antwort.modell, dauerMs: antwort.dauerMs, eingabe, ergebnis: groesse, passt };
    console.info(
      `[Bild-KI] Modell ${antwort.modell} · Dauer ${(antwort.dauerMs / 1000).toFixed(1)} s · ` +
        `Eingabe ${eingabe.breite} × ${eingabe.hoehe} · Ergebnis ${groesse.breite} × ${groesse.hoehe} · ` +
        `Seitenverhältnis ${antwort.seitenverhaeltnis} · passt zusammen: ${passt ? 'ja' : 'NEIN'}`,
    );
  } catch (err) {
    console.warn('[Bild-KI] Fehler:', err.code || '', err.message);
    zeigeFehler('fehler-4', err.message || 'Das Bild konnte nicht erzeugt werden. Bitte versuchen Sie es erneut.');
    if (err.code === 'demo_code') {
      demoCodeSpeichern(''); // falscher oder fehlender Code: neu abfragen
      demoCodeAbfragen(true);
    }
  } finally {
    clearTimeout(zeitlimit);
    kiLauf.abbruch = null;
    ladenAnzeigen(false);
    if (zustand.schritt === 4 || zustand.schritt === 2) buehneAnsicht(zustand.kiBild ? 'ki' : 'raum');
    bildKnopfAktualisieren();
    veraltetHinweisZeigen();
  }
}

function schritt4Einrichten() {
  $('#bild-erzeugen').addEventListener('click', bildErzeugen);
  $('#demo-code-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = $('#demo-code').value.trim();
    if (!code) return;
    demoCodeSpeichern(code);
    demoCodeAbfragen(false);
    bildErzeugen();
  });
  $('#zurueck-4').addEventListener('click', () => zeigeSchritt(2));
  $('#weiter-4').addEventListener('click', () => zeigeSchritt(5));
}

// ---------- Schritt 5: Kostenvoranschlag ----------

function namen() {
  const finde = (liste, id) => liste.find((e) => e.id === id)?.name ?? id;
  return {
    form: finde(BETRIEB.formen, zustand.form),
    material: finde(BETRIEB.materialien, zustand.materialId),
    gestell: finde(BETRIEB.gestelle, zustand.gestellId),
    oberflaeche: finde(BETRIEB.oberflaechen, zustand.oberflaecheId),
  };
}

function masseText() {
  const { form, laenge, breite, hoehe } = zustand;
  if (form === 'rund') return `⌀ ${laenge} cm, Höhe ${hoehe} cm`;
  if (form === 'quadratisch') return `${laenge} × ${laenge} cm, Höhe ${hoehe} cm`;
  return `${laenge} × ${breite} cm, Höhe ${hoehe} cm`;
}

function raumText() {
  const m = (cm) => formatZahl(cm / 100, 2);
  return `${m(zustand.raumLaenge)} × ${m(zustand.raumBreite)} m`;
}

/** Ungefähre Tischmaße als Text, oder '' wenn keine angegeben. */
function wunschText() {
  const { laenge, breite, hoehe } = zustand.wunsch;
  if (laenge === null && breite === null && hoehe === null) return '';
  const z = (v) => (v === null ? '–' : formatZahl(v));
  return `ca. ${z(laenge)} × ${z(breite)} cm, Höhe ${z(hoehe)} cm`;
}

function kostenvoranschlagAnzeigen() {
  const n = namen();
  const preis = berechnePreis(konfiguration(), BETRIEB);

  $('#kunden-code-feld').hidden = Boolean(demoCodeLesen()); // evtl. schon in Schritt 4 eingegeben
  $('#kv-foto').src = aktuellesKiBild() || zustand.foto;
  $('#kv-foto').alt = aktuellesKiBild() ? 'KI-Vorschau Ihres Möbelstücks in Ihrem Raum' : 'Ihr Raumfoto';
  $('#kv-betrieb').textContent = BETRIEB.name;
  $('#kv-datum').textContent = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  const daten = [
    ['Möbel', moebelName()],
    ['Form', n.form],
    ['Maße', masseText()],
    ['Material', n.material],
    ['Gestell', n.gestell],
    ['Oberfläche', n.oberflaeche],
    ['Freier Platz', `${zustand.freiLaenge} × ${zustand.freiBreite} cm`],
  ];
  daten.push(['Referenz', `${formatZahl(zustand.referenz.laengeCm)} cm`]);
  if (zustand.raumLaenge !== null && zustand.raumBreite !== null) daten.push(['Raum', raumText()]);
  if (!tischUeberstand().passt) daten.push(['Hinweis', 'Möbelstück ist größer als der freie Platz']);
  if (wunschText()) daten.push(['Ihr Wunschmaß', wunschText()]);
  $('#kv-daten').innerHTML = daten.map(([k, v]) => `<dt>${k}</dt><dd>${escape(v)}</dd>`).join('');

  $('#kv-positionen').innerHTML = preis.positionen
    .map(
      (p) =>
        `<tr><th scope="row">${escape(p.bezeichnung)}<span class="detail">${escape(p.detail)}</span></th><td class="betrag">${formatEuro(p.betrag)}</td></tr>`,
    )
    .join('');
  $('#kv-summe').textContent = formatEuro(preis.summe);
  $('#kv-prozent').textContent = `(± ${formatZahl(BETRIEB.rahmenProzent, Number.isInteger(BETRIEB.rahmenProzent) ? 0 : 1)} %, inkl. MwSt.)`;
  $('#kv-rahmen').textContent = `${formatEuro(preis.rahmen.von)} – ${formatEuro(preis.rahmen.bis)}`;

  const sonder = preis.sonderwuensche;
  $('#kv-sonder').hidden = sonder.length === 0;
  $('#kv-sonderliste').innerHTML = sonder
    .map((s) => `<li>${escape(s.beschreibung)} – <span class="auf-anfrage">Preis auf Anfrage</span></li>`)
    .join('');
}

/**
 * Platzhalter für Supabase: speichert die Anfrage vorerst im Browser (localStorage).
 * Gibt true zurück, wenn gespeichert wurde (notfalls ohne Foto), sonst false.
 */
/** Anfrage über die Edge Function in Supabase speichern (Bilder landen im privaten Storage). */
async function anfrageSenden(anfrage, foto, kiBild) {
  return rufeFunction('anfragen', { aktion: 'anlegen', anfrage, foto, kiBild }, { wer: 'Der Versand' });
}

function schritt5Einrichten() {
  $('#zurueck-5').addEventListener('click', () => zeigeSchritt(4));

  const form = $('#kunden-form');
  const sendeKnopf = form.querySelector('button[type="submit"]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sendeKnopf.disabled) return;
    const daten = Object.fromEntries(new FormData(form));
    const code = (daten.demoCode || '').trim();
    delete daten.demoCode;
    const fehlend = [];
    form.querySelectorAll('input').forEach((i) => i.classList.remove('ungueltig'));
    if (!daten.name.trim()) fehlend.push(form.elements.name);
    if (!/^\S+@\S+\.\S+$/.test(daten.email.trim())) fehlend.push(form.elements.email);
    if (fehlend.length) {
      fehlend.forEach((i) => i.classList.add('ungueltig'));
      fehlend[0].focus();
      zeigeFehler('fehler-5', 'Bitte geben Sie Ihren Namen und eine gültige E-Mail-Adresse an.');
      return;
    }
    if (!$('#kunden-code-feld').hidden) {
      if (!code) {
        form.elements.demoCode.classList.add('ungueltig');
        form.elements.demoCode.focus();
        zeigeFehler('fehler-5', 'Bitte geben Sie den Demo-Code ein.');
        return;
      }
      demoCodeSpeichern(code);
    }
    zeigeFehler('fehler-5', null);

    const preis = berechnePreis(konfiguration(), BETRIEB);
    const anfrage = {
      moebel: zustand.moebel,
      moebelName: moebelName(),
      kunde: Object.fromEntries(Object.entries(daten).map(([k, v]) => [k, v.trim()])),
      raum:
        zustand.raumLaenge === null || zustand.raumBreite === null
          ? null
          : { laenge: zustand.raumLaenge, breite: zustand.raumBreite },
      passtInFreienPlatz: tischUeberstand().passt,
      freierPlatz: { laenge: zustand.freiLaenge, breite: zustand.freiBreite },
      wunschmasse: { ...zustand.wunsch },
      referenz: structuredClone(zustand.referenz),
      tischPosition: structuredClone(zustand.tischPosition),
      konfiguration: { ...konfiguration(), namen: namen() },
      preis,
      kiInfo: aktuellesKiBild() ? zustand.kiInfo : null,
    };

    const knopfText = sendeKnopf.innerHTML;
    sendeKnopf.disabled = true;
    sendeKnopf.textContent = 'Wird gesendet …';
    try {
      await anfrageSenden(anfrage, zustand.foto, aktuellesKiBild());
    } catch (err) {
      console.warn('[Anfrage] Fehler:', err.code || '', err.message);
      if (err.code === 'demo_code') {
        demoCodeSpeichern('');
        $('#kunden-code-feld').hidden = false;
      }
      zeigeFehler('fehler-5', err.message || 'Ihre Anfrage konnte leider nicht gesendet werden. Bitte versuchen Sie es erneut.');
      return;
    } finally {
      sendeKnopf.disabled = false;
      sendeKnopf.innerHTML = knopfText;
    }

    form.hidden = true;
    $('#erfolg').hidden = false;
    $('#erfolg').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  $('#neu-starten').addEventListener('click', () => window.location.reload());
}

// ---------- Allgemein ----------

function zeigeFehler(id, text) {
  const el = document.getElementById(id);
  el.hidden = !text;
  el.textContent = text || '';
}

/** Kopfzeile als White-Label: Name, Claim und optionales Logo aus betrieb.js. */
function markeSetzen() {
  $('#betrieb-name').textContent = BETRIEB.name;
  $('#betrieb-claim').textContent = BETRIEB.claim || '';
  $('#betrieb-claim').hidden = !BETRIEB.claim;
  $('#betrieb-monogramm').textContent = BETRIEB.name.trim().charAt(0).toUpperCase();
  document.title = `Möbel nach Maß – ${BETRIEB.name}`;
  if (BETRIEB.logo) {
    const logo = $('#betrieb-logo');
    logo.onload = () => {
      logo.hidden = false;
      $('#betrieb-monogramm').hidden = true;
    };
    logo.alt = BETRIEB.name;
    logo.src = BETRIEB.logo;
  }
}

function start() {
  markeSetzen();
  schritt0Einrichten();
  document.querySelectorAll('.schritte button').forEach((btn) => {
    btn.addEventListener('click', () => zeigeSchritt(Number(btn.dataset.schritt)));
  });
  schritt1Einrichten();
  schritt2Einrichten();
  feinschliffEinrichten();
  schritt4Einrichten();
  schritt5Einrichten();
  stepperAktualisieren();
  kickerSetzen(0);
}

start();
