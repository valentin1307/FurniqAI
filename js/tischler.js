// Tischlerseite: Posteingang (Anfragen aus Supabase) und Einstellungen (Betriebsdaten im Browser).
import {
  BETRIEB,
  BETRIEB_STANDARD,
  mischeBetrieb,
  bearbeitbareWerte,
  pruefeBetrieb,
  einstellungenSpeichern,
  einstellungenZuruecksetzen,
  materialArt,
  neueId,
} from './betrieb.js';
import {
  DEMO_MOEBEL,
  portfolioLaden,
  portfolioSpeichern,
  moebelHinzufuegen,
  moebelEntfernen,
  nochNichtAngeboten,
} from './portfolio.js';
import { formatEuro, formatZahl } from './preis.js';
import { demoCodeLesen, demoCodeSpeichern, rufeFunction } from './supabase.js';

const $ = (sel) => document.querySelector(sel);
const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (z) => `&#${z.charCodeAt(0)};`);

const STATUS_TEXT = { neu: 'Neu', angenommen: 'Angenommen', abgelehnt: 'Abgelehnt' };

const zustand = {
  bereich: 'posteingang',
  anfragen: [],
  filter: 'alle',
  gewaehlt: null, // id
  detail: null, // vollständige Anfrage
  detailBild: 'ki', // 'ki' | 'foto'
  ablehnen: false, // Begründungsfeld offen
  laedt: false,
};

// ---------- Allgemein ----------

function markeSetzen() {
  $('#betrieb-name').textContent = BETRIEB.name;
  $('#betrieb-monogramm').textContent = BETRIEB.name.trim().charAt(0).toUpperCase();
  document.title = `Tischlerseite – ${BETRIEB.name}`;
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

function zeigeFehler(id, text) {
  const el = document.getElementById(id);
  el.hidden = !text;
  el.textContent = text || '';
}

const datumZeit = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const datumKurz = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const zeit = (iso, kurz = false) => (iso ? (kurz ? datumKurz : datumZeit).format(new Date(iso)) : '');

function masseText(k) {
  if (!k) return '';
  if (k.form === 'rund') return `⌀ ${k.laenge} cm, Höhe ${k.hoehe} cm`;
  if (k.form === 'quadratisch') return `${k.laenge} × ${k.laenge} cm, Höhe ${k.hoehe} cm`;
  return `${k.laenge} × ${k.breite} cm, Höhe ${k.hoehe} cm`;
}

const statusMarke = (s) => `<span class="t-status t-status-${escape(s)}">${escape(STATUS_TEXT[s] || s)}</span>`;

// ---------- Zugang (Demo-Code) ----------

function zugangZeigen(meldung) {
  $('#zugang').hidden = false;
  $('#posteingang').hidden = true;
  $('#einstellungen').hidden = true;
  $('#zugang-code').value = '';
  zeigeFehler('zugang-fehler', meldung || null);
  $('#zugang-code').focus();
}

/** Aufruf der Function anfragen; bei falschem Code zurück zur Anmeldung. */
async function api(aktion, extra = {}) {
  try {
    return await rufeFunction('anfragen', { aktion, ...extra }, { wer: 'Der Posteingang' });
  } catch (err) {
    if (err.code === 'demo_code') {
      demoCodeSpeichern('');
      zugangZeigen(err.message);
    }
    throw err;
  }
}

// ---------- Bereiche ----------

function bereichZeigen(bereich) {
  zustand.bereich = bereich;
  document.querySelectorAll('.t-reiter button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.bereich === bereich));
  });
  $('#zugang').hidden = true;
  $('#posteingang').hidden = bereich !== 'posteingang';
  $('#einstellungen').hidden = bereich !== 'einstellungen';
  if (bereich === 'einstellungen') einstellungenZeigen();
  if (bereich === 'posteingang') {
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    if (!demoCodeLesen()) zugangZeigen();
    else listeLaden();
  }
}

// ---------- Posteingang: Liste ----------

async function listeLaden() {
  if (zustand.laedt) return;
  zustand.laedt = true;
  $('#aktualisieren').disabled = true;
  zeigeFehler('liste-fehler', null);
  if (!zustand.anfragen.length) $('#liste').innerHTML = '<li class="t-hinweis">Anfragen werden geladen …</li>';
  try {
    const { anfragen } = await api('liste');
    zustand.anfragen = anfragen;
    listeZeichnen();
    if (zustand.gewaehlt && anfragen.some((a) => a.id === zustand.gewaehlt)) anfrageOeffnen(zustand.gewaehlt, false);
  } catch (err) {
    if (err.code !== 'demo_code') zeigeFehler('liste-fehler', err.message);
    $('#liste').innerHTML = '';
  } finally {
    zustand.laedt = false;
    $('#aktualisieren').disabled = false;
  }
}

function listeZeichnen() {
  const neu = zustand.anfragen.filter((a) => a.status === 'neu').length;
  $('#zaehler-neu').hidden = neu === 0;
  $('#zaehler-neu').textContent = String(neu);

  const sichtbar = zustand.anfragen.filter((a) => zustand.filter === 'alle' || a.status === zustand.filter);
  if (!sichtbar.length) {
    $('#liste').innerHTML = `<li class="t-hinweis">${
      zustand.anfragen.length ? 'Keine Anfragen mit diesem Status.' : 'Noch keine Anfragen. Sobald jemand im Konfigurator auf „An Tischlerei senden“ klickt, erscheint die Anfrage hier.'
    }</li>`;
    return;
  }
  $('#liste').innerHTML = sichtbar
    .map((a) => {
      const k = a.konfiguration || {};
      const bild = a.kiBildUrl || a.fotoUrl;
      return `<li>
        <button type="button" class="t-eintrag" data-id="${escape(a.id)}" ${a.id === zustand.gewaehlt ? 'aria-current="true"' : ''}>
          <span class="t-vorschau">${bild ? `<img src="${escape(bild)}" alt="" loading="lazy">` : ''}</span>
          <span class="t-eintrag-text">
            <span class="t-eintrag-kopf"><strong>${escape(a.kunde?.name)}</strong>${statusMarke(a.status)}</span>
            <span class="t-eintrag-tisch">${escape(k.namen?.form || k.form)} · ${escape(masseText(k))}</span>
            <span class="t-eintrag-fuss">${escape(k.namen?.material || '')} · ${
              a.preis?.rahmen ? `${formatEuro(a.preis.rahmen.von)} – ${formatEuro(a.preis.rahmen.bis)}` : ''
            }</span>
            <span class="t-eintrag-datum">${escape(zeit(a.erstellt, true))}</span>
          </span>
        </button>
      </li>`;
    })
    .join('');
}

// ---------- Posteingang: Detail ----------

async function anfrageOeffnen(id, scrollen = true) {
  const wechsel = zustand.gewaehlt !== id;
  zustand.gewaehlt = id;
  if (wechsel) {
    zustand.detailBild = 'ki';
    zustand.ablehnen = false;
  }
  document.querySelectorAll('.t-eintrag').forEach((b) => {
    if (b.dataset.id === id) b.setAttribute('aria-current', 'true');
    else b.removeAttribute('aria-current');
  });
  if (wechsel) $('#detail').innerHTML = '<p class="t-leer">Anfrage wird geladen …</p>';
  if (scrollen && window.matchMedia('(max-width: 900px)').matches) $('#detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  try {
    const { anfrage } = await api('detail', { id });
    if (zustand.gewaehlt !== id) return; // inzwischen andere gewählt
    zustand.detail = anfrage;
    detailZeichnen();
  } catch (err) {
    if (err.code !== 'demo_code') $('#detail').innerHTML = `<p class="fehler">${escape(err.message)}</p>`;
  }
}

const zeile = (k, v) => (v ? `<dt>${escape(k)}</dt><dd>${escape(v)}</dd>` : '');

function detailZeichnen() {
  const a = zustand.detail;
  const k = a.konfiguration || {};
  const n = k.namen || {};
  const optionen = (k.optionIds || []).map((id) => BETRIEB.optionen.find((o) => o.id === id)?.name || id);
  const sonder = a.preis?.sonderwuensche || k.sonderwuensche || [];
  const hatKi = Boolean(a.kiBildUrl);
  const zeigeKi = hatKi && (zustand.detailBild === 'ki' || !a.fotoUrl);
  const bild = zeigeKi ? a.kiBildUrl : a.fotoUrl;
  const m = (cm) => formatZahl(cm / 100, 2);

  const bildHtml = bild
    ? `<figure class="t-bild">
        <img src="${escape(bild)}" alt="${zeigeKi ? 'KI-Vorschau des Möbelstücks im Raum' : 'Raumfoto der Kundin/des Kunden'}">
        <figcaption>${zeigeKi ? 'KI-Vorschau' : 'Raumfoto'}</figcaption>
        ${
          hatKi && a.fotoUrl
            ? `<div class="umschalter" role="group" aria-label="Bild">
                <button type="button" data-bild="ki" aria-pressed="${zeigeKi}">KI-Vorschau</button>
                <button type="button" data-bild="foto" aria-pressed="${!zeigeKi}">Raumfoto</button>
              </div>`
            : ''
        }
      </figure>`
    : '<p class="t-ohne-bild">Kein Bild vorhanden.</p>';

  const positionen = (a.preis?.positionen || [])
    .map(
      (p) =>
        `<tr><th scope="row">${escape(p.bezeichnung)}<span class="detail">${escape(p.detail)}</span></th><td class="betrag">${formatEuro(p.betrag)}</td></tr>`,
    )
    .join('');

  let aktionen;
  if (a.status === 'neu' && !zustand.ablehnen) {
    aktionen = `<div class="t-aktionen">
      <button type="button" class="knopf knopf-haupt" data-aktion="annehmen">Annehmen</button>
      <button type="button" class="knopf knopf-leise" data-aktion="ablehnen">Ablehnen …</button>
    </div>`;
  } else if (a.status === 'neu') {
    aktionen = `<form class="t-ablehnen" id="ablehnen-form">
      <label class="feld">
        <span>Begründung der Ablehnung *</span>
        <textarea id="ablehnen-grund" rows="3" placeholder="z. B. Das gewünschte Maß können wir nicht fertigen."></textarea>
      </label>
      <div class="t-aktionen">
        <button type="submit" class="knopf knopf-haupt t-knopf-ablehnen">Ablehnung bestätigen</button>
        <button type="button" class="knopf knopf-leise" data-aktion="abbrechen">Abbrechen</button>
      </div>
    </form>`;
  } else {
    aktionen = `<div class="t-ergebnis t-ergebnis-${escape(a.status)}">
      <p><strong>${escape(STATUS_TEXT[a.status])}</strong> am ${escape(zeit(a.bearbeitet))}</p>
      ${a.ablehnungsgrund ? `<p class="t-grund">Begründung: ${escape(a.ablehnungsgrund)}</p>` : ''}
      <button type="button" class="link-zurueck" data-aktion="zuruecksetzen">Wieder auf „Neu“ setzen</button>
    </div>`;
  }

  $('#detail').innerHTML = `
    <header class="t-detail-kopf">
      <div>
        <h2>${escape(a.kunde?.name)}</h2>
        <p class="tipp">Eingegangen am ${escape(zeit(a.erstellt))}</p>
      </div>
      ${statusMarke(a.status)}
    </header>
    ${bildHtml}
    <p class="fehler" id="detail-fehler" role="alert" hidden></p>
    ${aktionen}

    <div class="t-abschnitte">
      <section>
        <h3>Möbelstück</h3>
        <dl class="kv-daten">
          ${zeile('Möbel', BETRIEB.moebelart)}
          ${zeile('Form', n.form || k.form)}
          ${zeile('Maße', masseText(k))}
          ${zeile('Material', n.material)}
          ${zeile('Gestell', n.gestell)}
          ${zeile('Oberfläche', n.oberflaeche)}
          ${zeile('Optionen', optionen.length ? optionen.join(', ') : 'keine')}
        </dl>
        ${a.passtInFreienPlatz === false ? '<p class="hinweis-platz">Das Möbelstück ist größer als der angegebene freie Platz.</p>' : ''}
        ${
          sonder.length
            ? `<h4>Sonderwünsche</h4><ul class="sonderliste">${sonder
                .map((s) => `<li>${escape(s.beschreibung)} – <span class="auf-anfrage">Preis auf Anfrage</span></li>`)
                .join('')}</ul>`
            : ''
        }
      </section>

      <section>
        <h3>Preis</h3>
        <table class="positionen t-preis">
          <tbody>${positionen}</tbody>
          <tfoot>
            <tr class="summe"><th scope="row">Summe inkl. MwSt.</th><td class="betrag">${formatEuro(a.preis?.summe ?? 0)}</td></tr>
            ${
              a.preis?.rahmen
                ? `<tr class="rahmen"><th scope="row">Preisrahmen</th><td class="betrag">${formatEuro(a.preis.rahmen.von)} – ${formatEuro(a.preis.rahmen.bis)}</td></tr>`
                : ''
            }
          </tfoot>
        </table>
        <p class="tipp">Unverbindliche Schätzung mit Demo-Preisen. Der endgültige Preis folgt nach dem Vor-Ort-Termin.</p>
      </section>

      <section>
        <h3>Raum</h3>
        <dl class="kv-daten">
          ${zeile('Freier Platz', a.freierPlatz ? `${a.freierPlatz.laenge} × ${a.freierPlatz.breite} cm` : '')}
          ${zeile('Raum', a.raum ? `${m(a.raum.laenge)} × ${m(a.raum.breite)} m` : '')}
          ${zeile('Referenz', a.referenz?.laengeCm ? `${formatZahl(a.referenz.laengeCm)} cm` : '')}
          ${zeile(
            'Wunschmaß',
            a.wunschmasse && Object.values(a.wunschmasse).some((w) => w !== null)
              ? `ca. ${a.wunschmasse.laenge ?? '–'} × ${a.wunschmasse.breite ?? '–'} cm, Höhe ${a.wunschmasse.hoehe ?? '–'} cm`
              : '',
          )}
        </dl>
      </section>

      <section>
        <h3>Kunde</h3>
        <dl class="kv-daten">
          ${zeile('Name', a.kunde?.name)}
          ${a.kunde?.email ? `<dt>E-Mail</dt><dd><a href="mailto:${escape(a.kunde.email)}">${escape(a.kunde.email)}</a></dd>` : ''}
          ${a.kunde?.telefon ? `<dt>Telefon</dt><dd><a href="tel:${escape(a.kunde.telefon.replace(/[^\d+]/g, ''))}">${escape(a.kunde.telefon)}</a></dd>` : ''}
          ${zeile('PLZ und Ort', a.kunde?.ort)}
        </dl>
        ${a.kunde?.nachricht ? `<blockquote class="t-nachricht">${escape(a.kunde.nachricht)}</blockquote>` : ''}
      </section>
    </div>`;
}

async function statusSetzen(status, grund) {
  const a = zustand.detail;
  const knoepfe = $('#detail').querySelectorAll('button');
  knoepfe.forEach((b) => (b.disabled = true));
  zeigeFehler('detail-fehler', null);
  try {
    const { anfrage } = await api('status', { id: a.id, status, grund });
    zustand.detail = anfrage;
    zustand.ablehnen = false;
    const i = zustand.anfragen.findIndex((x) => x.id === anfrage.id);
    if (i >= 0) zustand.anfragen[i] = { ...zustand.anfragen[i], status: anfrage.status, ablehnungsgrund: anfrage.ablehnungsgrund };
    listeZeichnen();
    detailZeichnen();
  } catch (err) {
    if (err.code === 'demo_code') return;
    knoepfe.forEach((b) => (b.disabled = false));
    zeigeFehler('detail-fehler', err.message);
  }
}

function posteingangEinrichten() {
  $('#aktualisieren').addEventListener('click', listeLaden);
  document.querySelectorAll('.t-filter button').forEach((b) => {
    b.addEventListener('click', () => {
      zustand.filter = b.dataset.filter;
      document.querySelectorAll('.t-filter button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      listeZeichnen();
    });
  });
  $('#liste').addEventListener('click', (e) => {
    const eintrag = e.target.closest('.t-eintrag');
    if (eintrag) anfrageOeffnen(eintrag.dataset.id);
  });
  $('#detail').addEventListener('click', (e) => {
    const bildKnopf = e.target.closest('[data-bild]');
    if (bildKnopf) {
      zustand.detailBild = bildKnopf.dataset.bild;
      detailZeichnen();
      return;
    }
    const aktion = e.target.closest('[data-aktion]')?.dataset.aktion;
    if (aktion === 'annehmen') statusSetzen('angenommen');
    if (aktion === 'zuruecksetzen') statusSetzen('neu');
    if (aktion === 'ablehnen') {
      zustand.ablehnen = true;
      detailZeichnen();
      $('#ablehnen-grund').focus();
    }
    if (aktion === 'abbrechen') {
      zustand.ablehnen = false;
      detailZeichnen();
    }
  });
  $('#detail').addEventListener('submit', (e) => {
    if (e.target.id !== 'ablehnen-form') return;
    e.preventDefault();
    const grund = $('#ablehnen-grund').value.trim();
    if (grund.length < 3) {
      zeigeFehler('detail-fehler', 'Bitte geben Sie eine Begründung für die Ablehnung an.');
      $('#ablehnen-grund').focus();
      return;
    }
    statusSetzen('abgelehnt', grund);
  });

  $('#zugang-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = $('#zugang-code').value.trim();
    if (!code) return;
    demoCodeSpeichern(code);
    bereichZeigen('posteingang');
  });
}

// ---------- Einstellungen: Portfolio und Möbel ----------
// Ansichten: 'portfolio' (alle Möbel), 'couchtisch' (eingerichtet, Daten aus betrieb.js),
// andere Möbel-IDs (Seite noch leer). Die Ansicht steht im Hash, z. B. #einstellungen/couchtisch.

const einst = {
  ansicht: 'portfolio',
  portfolio: portfolioLaden(),
  entwurf: null, // Kopie von BETRIEB, die im Couchtisch-Formular bearbeitet wird
  art: 'holz', // gewählte Materialart
  fokus: null, // data-pfad oder Selektor, der nach dem Neuzeichnen den Fokus bekommt
  neuNr: 0, // Zähler für vorläufige IDs neuer Einträge
};

// Linien-Symbole 32 × 32 für das Portfolio
const MOEBEL_SYMBOL = {
  couchtisch: '<rect x="3" y="12" width="26" height="3" rx="1"/><path d="M6 15v9M26 15v9M6 20h20"/>',
  esstisch: '<rect x="3" y="9" width="26" height="3" rx="1"/><path d="M6 12v15M26 12v15"/>',
  schreibtisch: '<rect x="3" y="9" width="26" height="3" rx="1"/><path d="M5 12v15M19 12v15M27 12v15M19 18h8"/>',
  stuhl: '<path d="M10 4v23M10 16h12v11M8 16h16"/>',
  sessel: '<path d="M9 12V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4"/><rect x="4" y="12" width="5" height="10" rx="2"/><rect x="23" y="12" width="5" height="10" rx="2"/><path d="M9 17h14M9 22h14M7 22v4M25 22v4"/>',
  sofa: '<path d="M6 13V9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4"/><rect x="2" y="13" width="5" height="9" rx="2"/><rect x="25" y="13" width="5" height="9" rx="2"/><path d="M7 17h18M7 22h18M5 22v3M27 22v3"/>',
  lampe: '<path d="M11 4h10l3 8H8z"/><path d="M16 12v15M11 28h10"/>',
  schrank: '<rect x="7" y="3" width="18" height="24" rx="1"/><path d="M16 3v24M14 14v3M18 14v3M9 27v2M23 27v2"/>',
  kommode: '<rect x="5" y="7" width="22" height="18" rx="1"/><path d="M5 13h22M5 19h22M14 10h4M14 16h4M14 22h4M7 25v3M25 25v3"/>',
  sideboard: '<rect x="2" y="11" width="28" height="11" rx="1"/><path d="M11.3 11v11M20.7 11v11M4 22v4M28 22v4"/>',
  regal: '<path d="M6 3v26M26 3v26M6 10h20M6 17h20M6 24h20"/>',
  bett: '<path d="M3 27V8M3 19h26v8M3 15h26v4"/><rect x="5" y="11" width="7" height="4" rx="1.5"/>',
  nachttisch: '<rect x="8" y="9" width="16" height="15" rx="1"/><path d="M8 16h16M14 12.5h4M14 20h4M10 24v3M22 24v3"/>',
  garderobe: '<path d="M16 3v24M10 28h12M16 7l-6 4M16 7l6 4M16 12l-4 3M16 12l4 3"/>',
  eigen: '<rect x="5" y="9" width="22" height="16" rx="2"/><path d="M5 14h22M14 19h4"/>',
  plus: '<path d="M16 8v16M8 16h16"/>',
};
const symbol = (id) =>
  `<svg viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${
    MOEBEL_SYMBOL[id] || MOEBEL_SYMBOL.eigen
  }</svg>`;

function einstellungenZeigen(ansicht = einst.ansicht) {
  const bekannt = ansicht === 'portfolio' || einst.portfolio.moebel.some((m) => m.id === ansicht);
  if (!bekannt) ansicht = 'portfolio';
  const wechsel = ansicht !== einst.ansicht;
  einst.ansicht = ansicht;
  $('#portfolio-ansicht').hidden = ansicht !== 'portfolio';
  $('#couchtisch-ansicht').hidden = ansicht !== DEMO_MOEBEL;
  $('#moebel-leer').hidden = ansicht === 'portfolio' || ansicht === DEMO_MOEBEL;
  const hash = ansicht === 'portfolio' ? '#einstellungen' : `#einstellungen/${ansicht}`;
  if (location.hash !== hash) history.replaceState(null, '', hash);

  if (ansicht === 'portfolio') portfolioZeichnen();
  else if (ansicht === DEMO_MOEBEL) {
    if (!einst.entwurf) einst.entwurf = structuredClone(BETRIEB);
    einstellungenZeichnen();
  } else leerZeichnen(ansicht);

  if (wechsel) {
    window.scrollTo({ top: 0 });
    const titel = document.querySelector(`#${ansicht === 'portfolio' ? 'portfolio-ansicht' : ansicht === DEMO_MOEBEL ? 'couchtisch-ansicht' : 'moebel-leer'} h1`);
    titel?.setAttribute('tabindex', '-1');
    titel?.focus({ preventScroll: true });
  }
}

// ---------- Portfolio ----------

function portfolioZeichnen() {
  const offen = !$('#portfolio-auswahl').hidden;
  const karten = einst.portfolio.moebel.map((m) => {
    const fertig = m.id === DEMO_MOEBEL;
    return `<li><button type="button" class="t-moebel${fertig ? ' t-moebel-fertig' : ''}" data-moebel="${escape(m.id)}">
        <span class="t-moebel-symbol">${symbol(m.id)}</span>
        <span class="t-moebel-name">${escape(m.name)}</span>
        <span class="t-moebel-status">${fertig ? 'Eingerichtet · im Konfigurator' : 'Noch nicht eingerichtet'}</span>
      </button></li>`;
  });
  karten.push(`<li><button type="button" class="t-moebel t-moebel-neu" id="moebel-hinzufuegen" aria-expanded="${offen}" aria-controls="portfolio-auswahl">
      <span class="t-moebel-symbol">${symbol('plus')}</span>
      <span class="t-moebel-name">Möbel hinzufügen</span>
      <span class="t-moebel-status">Tische, Stühle, Schränke …</span>
    </button></li>`);
  $('#portfolio-liste').innerHTML = karten.join('');
  const frei = nochNichtAngeboten(einst.portfolio);
  $('#katalog-liste').innerHTML = frei.length
    ? frei
        .map(
          (k) => `<li><button type="button" class="t-katalog-eintrag" data-katalog="${escape(k.id)}">
            <span class="t-katalog-symbol">${symbol(k.id)}</span><span>${escape(k.name)}</span><span class="t-katalog-plus" aria-hidden="true">+</span>
          </button></li>`,
        )
        .join('')
    : '<li class="tipp">Alle Möbel aus der Auswahl sind in Ihrem Portfolio.</li>';
}

function portfolioMelden(text) {
  $('#portfolio-status').textContent = text;
  $('#portfolio-status').hidden = !text;
}

function portfolioAendern(neu, meldung) {
  einst.portfolio = neu;
  const gespeichert = portfolioSpeichern(neu);
  portfolioZeichnen();
  portfolioMelden(gespeichert ? meldung : `${meldung} Hinweis: Der Browser-Speicher ist gesperrt, es gilt nur bis zum Neuladen.`);
}

function katalogOeffnen(offen) {
  $('#portfolio-auswahl').hidden = !offen;
  $('#moebel-hinzufuegen')?.setAttribute('aria-expanded', String(offen));
  if (offen) {
    $('#portfolio-auswahl').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    ($('.t-katalog-eintrag') || $('#eigenes-moebel')).focus({ preventScroll: true });
  } else $('#moebel-hinzufuegen')?.focus();
}

function leerZeichnen(id) {
  const m = einst.portfolio.moebel.find((x) => x.id === id);
  $('#moebel-leer-titel').textContent = m.name;
  $('#moebel-leer-symbol').innerHTML = symbol(m.id);
  $('#moebel-entfernen').dataset.id = m.id;
}

function portfolioEinrichten() {
  $('#einstellungen').addEventListener('click', (e) => {
    const moebel = e.target.closest('[data-moebel]');
    if (moebel) return einstellungenZeigen(moebel.dataset.moebel);
    if (e.target.closest('[data-portfolio="zurueck"]')) return einstellungenZeigen('portfolio');
    if (e.target.closest('#moebel-hinzufuegen')) return katalogOeffnen($('#portfolio-auswahl').hidden);
    if (e.target.closest('#katalog-schliessen')) return katalogOeffnen(false);
    const katalog = e.target.closest('[data-katalog]');
    if (katalog) {
      const knoepfe = [...document.querySelectorAll('.t-katalog-eintrag')];
      const index = knoepfe.indexOf(katalog);
      const name = katalog.textContent.replace('+', '').trim();
      portfolioAendern(moebelHinzufuegen(einst.portfolio, katalog.dataset.katalog), `${name} ist jetzt in Ihrem Portfolio.`);
      const rest = document.querySelectorAll('.t-katalog-eintrag');
      (rest[Math.min(index, rest.length - 1)] || $('#eigenes-moebel')).focus({ preventScroll: true });
      return;
    }
    if (e.target.closest('#moebel-entfernen')) {
      const id = $('#moebel-entfernen').dataset.id;
      const m = einst.portfolio.moebel.find((x) => x.id === id);
      if (!m || !window.confirm(`${m.name} aus dem Portfolio entfernen?`)) return;
      portfolioAendern(moebelEntfernen(einst.portfolio, id), `${m.name} wurde aus dem Portfolio entfernt.`);
      einstellungenZeigen('portfolio');
    }
  });
  $('#eigenes-moebel-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#eigenes-moebel').value.trim();
    if (!name) return $('#eigenes-moebel').focus();
    const vorher = einst.portfolio.moebel.length;
    const neu = moebelHinzufuegen(einst.portfolio, { name });
    $('#eigenes-moebel').value = '';
    if (neu.moebel.length === vorher) portfolioMelden(`${name} ist bereits in Ihrem Portfolio.`);
    else portfolioAendern(neu, `${neu.moebel.at(-1).name} ist jetzt in Ihrem Portfolio.`);
    $('#eigenes-moebel').focus();
  });
}

// ---------- Couchtisch: Materialien, Preise, Maßgrenzen, Optionen ----------

// Weitere Listen unter den Materialien: [Liste, Titel, Preisfeld, Einheit, Text des Plus-Knopfs]
const LISTEN = [
  ['gestelle', 'Gestelle', 'preis', '€ Aufpreis', 'Gestell hinzufügen'],
  ['oberflaechen', 'Oberflächen', 'preis', '€ Aufpreis', 'Oberfläche hinzufügen'],
  ['optionen', 'Optionen', 'preis', '€ Aufpreis', 'Option hinzufügen'],
];
const EINZELNAME = { materialien: 'Material', gestelle: 'Gestell', oberflaechen: 'Oberfläche', optionen: 'Option' };
const MASSE = [['laenge', 'Länge'], ['breite', 'Breite'], ['hoehe', 'Höhe']];

// Zahlen ohne Tausenderpunkt, Komma als Dezimalzeichen (12,5); leere Felder bleiben leer
const zahlText = (w) => (Number.isFinite(w) ? String(w).replace('.', ',') : '');
const zahlFeld = (pfad, wert, label) =>
  `<input type="text" inputmode="decimal" data-pfad="${pfad}" value="${escape(zahlText(wert))}" aria-label="${escape(label)}" placeholder="0">`;

/** Eine Zeile: Name, Preis, bei eigenen Einträgen ein Entfernen-Knopf. */
function zeileFelder(liste, i, e, feld, einheit) {
  const titel = EINZELNAME[liste];
  const name = e.name?.trim() || 'Neuer Eintrag';
  return `<input type="text" data-pfad="${liste}.${i}.name" value="${escape(e.name)}" aria-label="${escape(titel)}: Name" placeholder="Name" maxlength="80">
    ${zahlFeld(`${liste}.${i}.${feld}`, e[feld], `${name}: ${einheit}`)}
    ${
      e.eigen
        ? `<button type="button" class="t-entfernen" data-entfernen="${liste}.${i}" aria-label="${escape(name)} entfernen" title="Entfernen">×</button>`
        : '<span class="t-standard" title="Standard der Demo">·</span>'
    }`;
}

function materialienHtml(b) {
  if (!b.materialarten.some((a) => a.id === einst.art)) einst.art = b.materialarten[0].id;
  const anzahl = (id) => b.materialien.filter((m) => materialArt(m) === id).length;
  const reiter = b.materialarten
    .map(
      (a) => `<button type="button" role="tab" id="art-reiter-${escape(a.id)}" aria-controls="art-panel-${escape(a.id)}"
        aria-selected="${a.id === einst.art}" tabindex="${a.id === einst.art ? 0 : -1}" data-art="${escape(a.id)}">
        <span class="t-art-titel">${escape(a.name.trim() || 'Neue Art')}</span><span class="t-anzahl">${anzahl(a.id)}</span>
      </button>`,
    )
    .join('');
  const panels = b.materialarten
    .map((a, ai) => {
      const zeilen = b.materialien.map((m, i) => [m, i]).filter(([m]) => materialArt(m) === a.id);
      const artName = a.name.trim() || 'Neue Materialart';
      return `<div class="t-art-panel" role="tabpanel" id="art-panel-${escape(a.id)}" aria-labelledby="art-reiter-${escape(a.id)}" ${
        a.id === einst.art ? '' : 'hidden'
      }>
        ${
          a.eigen
            ? `<div class="t-art-name">
                <label class="feld"><span>Name der Materialart</span>
                  <input type="text" data-pfad="materialarten.${ai}.name" value="${escape(a.name)}" maxlength="80" placeholder="z. B. Keramik">
                </label>
                ${zeilen.length ? '' : `<button type="button" class="link-zurueck" data-art-entfernen="${escape(a.id)}">Materialart entfernen</button>`}
              </div>`
            : ''
        }
        ${
          zeilen.length
            ? `<div class="t-einst-zeilen t-mit-entfernen">
                <span class="t-einst-spalte">Material</span><span class="t-einst-spalte">€ je m² Platte</span><span></span>
                ${zeilen.map(([m, i]) => zeileFelder('materialien', i, m, 'preisProQm', '€ je m² Platte')).join('')}
              </div>`
            : `<p class="t-leer-hinweis">Noch keine Materialien unter „${escape(artName)}“. Legen Sie das erste an.</p>`
        }
        <button type="button" class="t-plus" data-neu="materialien" data-art="${escape(a.id)}"><span aria-hidden="true">+</span> Material hinzufügen</button>
      </div>`;
    })
    .join('');
  return `<fieldset class="karte t-einst t-einst-breit">
      <legend>Materialien</legend>
      <p class="tipp t-einst-tipp">Zuerst die Materialart, darin die einzelnen Materialien. Preise je m² Tischplatte.</p>
      <div class="t-arten">
        <div class="t-arten-reiter" role="tablist" aria-label="Materialart">${reiter}</div>
        <button type="button" class="t-plus t-plus-art" data-neu="materialart"><span aria-hidden="true">+</span> Materialart</button>
      </div>
      ${panels}
    </fieldset>`;
}

function einstellungenZeichnen() {
  const b = einst.entwurf;
  const listen = LISTEN.map(
    ([liste, titel, feld, einheit, plus]) => `
    <fieldset class="karte t-einst">
      <legend>${titel}</legend>
      <div class="t-einst-zeilen t-mit-entfernen">
        <span class="t-einst-spalte">Name</span><span class="t-einst-spalte">${einheit}</span><span></span>
        ${b[liste].map((e, i) => zeileFelder(liste, i, e, feld, einheit)).join('')}
      </div>
      <button type="button" class="t-plus" data-neu="${liste}"><span aria-hidden="true">+</span> ${plus}</button>
    </fieldset>`,
  ).join('');

  $('#einstellungen-felder').innerHTML = `
    <div class="t-einst-raster">
      <fieldset class="karte t-einst">
        <legend>Preise allgemein</legend>
        <label class="feld"><span>Grundpreis (Arbeit, Standard-Gestell Holz) in €</span>${zahlFeld('grundpreis', b.grundpreis, 'Grundpreis')}</label>
        <label class="feld"><span>Preisrahmen im Kostenvoranschlag, ± %</span>${zahlFeld('rahmenProzent', b.rahmenProzent, 'Preisrahmen')}</label>
      </fieldset>
      <fieldset class="karte t-einst">
        <legend>Maßgrenzen in cm</legend>
        <div class="t-einst-zeilen t-einst-drei">
          <span></span><span class="t-einst-spalte">min.</span><span class="t-einst-spalte">max.</span>
          ${MASSE.map(
            ([m, name]) => `<span class="t-einst-name">${name}</span>
              ${zahlFeld(`grenzen.${m}.min`, b.grenzen[m].min, `${name} minimal`)}
              ${zahlFeld(`grenzen.${m}.max`, b.grenzen[m].max, `${name} maximal`)}`,
          ).join('')}
        </div>
      </fieldset>
      ${materialienHtml(b)}
      ${listen}
    </div>
    <p class="tipp">Gespeichert wird nur in diesem Browser (Demo). Der Konfigurator in diesem Browser nutzt die Werte beim nächsten Laden.
      Mit + angelegte Einträge erscheinen dort ebenfalls.</p>`;

  if (einst.fokus) {
    const ziel = einst.fokus.startsWith('#') ? $(einst.fokus) : $(`[data-pfad="${einst.fokus}"]`);
    einst.fokus = null;
    ziel?.focus();
  }
}

/** „1.300“ → 1300, „12,5“ → 12.5, „12.5“ → 12.5; leer/ungültig → NaN. */
function leseZahl(text) {
  let t = String(text).trim().replace(/\s|€|%/g, '');
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '');
  t = t.replace(',', '.');
  return t === '' ? NaN : Number(t);
}

/** Wert eines Feldes in den Entwurf schreiben (Pfad wie „materialien.3.name“). */
function inEntwurf(pfad, wert) {
  const teile = pfad.split('.');
  let ziel = einst.entwurf;
  for (const t of teile.slice(0, -1)) ziel = ziel[t];
  const feld = teile.at(-1);
  ziel[feld] = feld === 'name' ? wert : leseZahl(wert);
}

const vorlaeufigeId = () => `neu-${++einst.neuNr}`;

/** Vorläufige IDs neuer Einträge durch lesbare ersetzen (aus dem Namen), Namen trimmen. */
function idsVergeben(b) {
  const alle = () => [...b.materialarten, ...b.materialien, ...b.gestelle, ...b.oberflaechen, ...b.optionen].map((e) => e.id);
  for (const a of b.materialarten) {
    a.name = a.name.trim();
    if (!a.id.startsWith('neu-')) continue;
    const id = neueId(a.name, alle());
    for (const m of b.materialien) if (m.art === a.id) m.art = id;
    a.id = id;
  }
  for (const liste of ['materialien', 'gestelle', 'oberflaechen', 'optionen']) {
    for (const e of b[liste]) {
      e.name = (e.name || '').trim();
      if (e.id.startsWith('neu-')) e.id = neueId(e.name, alle());
    }
  }
  return b;
}

function einstellungenEinrichten() {
  const felder = $('#einstellungen-felder');
  felder.addEventListener('input', (e) => {
    const pfad = e.target.dataset.pfad;
    if (!pfad) return;
    inEntwurf(pfad, e.target.value);
    if (pfad.startsWith('materialarten.')) {
      const a = einst.entwurf.materialarten[Number(pfad.split('.')[1])];
      const titel = document.querySelector(`#art-reiter-${CSS.escape(a.id)} .t-art-titel`);
      if (titel) titel.textContent = a.name.trim() || 'Neue Art';
    }
  });

  felder.addEventListener('click', (e) => {
    const b = einst.entwurf;
    const reiter = e.target.closest('[role="tab"][data-art]');
    if (reiter) {
      einst.art = reiter.dataset.art;
      einst.fokus = `#art-reiter-${CSS.escape(einst.art)}`;
      return einstellungenZeichnen();
    }
    const neu = e.target.closest('[data-neu]');
    if (neu) {
      const liste = neu.dataset.neu;
      if (liste === 'materialart') {
        const id = vorlaeufigeId();
        b.materialarten.push({ id, name: '', eigen: true });
        einst.art = id;
        einst.fokus = `materialarten.${b.materialarten.length - 1}.name`;
      } else {
        const feld = liste === 'materialien' ? 'preisProQm' : 'preis';
        const eintrag = { id: vorlaeufigeId(), name: '', [feld]: NaN, eigen: true };
        if (liste === 'materialien') eintrag.art = neu.dataset.art;
        b[liste].push(eintrag);
        einst.fokus = `${liste}.${b[liste].length - 1}.name`;
      }
      $('#einstellungen-ok').hidden = true;
      return einstellungenZeichnen();
    }
    const weg = e.target.closest('[data-entfernen]');
    if (weg) {
      const [liste, i] = weg.dataset.entfernen.split('.');
      const eintrag = b[liste][Number(i)];
      b[liste].splice(Number(i), 1);
      einst.fokus = liste === 'materialien' ? `#art-reiter-${CSS.escape(materialArt(eintrag))}` : null;
      $('#einstellungen-ok').hidden = true;
      einstellungenZeichnen();
      if (!einst.fokus && liste !== 'materialien') felder.querySelector(`[data-neu="${liste}"]`)?.focus();
      return;
    }
    const artWeg = e.target.closest('[data-art-entfernen]');
    if (artWeg) {
      b.materialarten = b.materialarten.filter((a) => a.id !== artWeg.dataset.artEntfernen);
      einst.art = b.materialarten[0].id;
      einst.fokus = `#art-reiter-${CSS.escape(einst.art)}`;
      einstellungenZeichnen();
    }
  });

  // Reiter der Materialarten mit Pfeiltasten (Tab-Muster)
  felder.addEventListener('keydown', (e) => {
    const reiter = e.target.closest('[role="tab"][data-art]');
    if (!reiter || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const alle = [...felder.querySelectorAll('[role="tab"][data-art]')];
    const i = alle.indexOf(reiter);
    const ziel = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: alle.length - 1 }[e.key];
    const neu = alle[(ziel + alle.length) % alle.length];
    einst.art = neu.dataset.art;
    einst.fokus = `#art-reiter-${CSS.escape(einst.art)}`;
    einstellungenZeichnen();
  });

  $('#einstellungen-form').addEventListener('submit', (e) => {
    e.preventDefault();
    $('#einstellungen-ok').hidden = true;
    const b = idsVergeben(structuredClone(einst.entwurf));
    const fehler = pruefeBetrieb(b);
    if (fehler.length) {
      zeigeFehler('einstellungen-fehler', fehler.join(' '));
      return;
    }
    if (!einstellungenSpeichern(b)) {
      zeigeFehler('einstellungen-fehler', 'Speichern nicht möglich: Der Browser-Speicher ist gesperrt (z. B. privates Fenster).');
      return;
    }
    zeigeFehler('einstellungen-fehler', null);
    Object.assign(BETRIEB, mischeBetrieb(BETRIEB_STANDARD, bearbeitbareWerte(b)));
    // vorläufige ID der gewählten Art auf die gespeicherte umstellen
    const index = einst.entwurf.materialarten.findIndex((a) => a.id === einst.art);
    einst.entwurf = structuredClone(BETRIEB);
    if (index >= 0 && einst.entwurf.materialarten[index]) einst.art = einst.entwurf.materialarten[index].id;
    einstellungenZeichnen();
    $('#einstellungen-ok').hidden = false;
  });
  $('#einstellungen-standard').addEventListener('click', () => {
    if (!window.confirm('Alle Einstellungen des Couchtischs auf die Standardwerte zurücksetzen? Selbst angelegte Materialien, Gestelle, Oberflächen und Optionen werden entfernt.')) return;
    einstellungenZuruecksetzen();
    Object.assign(BETRIEB, structuredClone(BETRIEB_STANDARD));
    // Object.assign ersetzt Listen, eigene Einträge sind damit weg
    einst.entwurf = structuredClone(BETRIEB);
    einst.art = 'holz';
    zeigeFehler('einstellungen-fehler', null);
    einstellungenZeichnen();
    $('#einstellungen-ok').hidden = false;
  });
  $('#einstellungen-form').addEventListener('input', () => {
    $('#einstellungen-ok').hidden = true;
  });
}

// ---------- Start ----------

function start() {
  markeSetzen();
  document.querySelectorAll('.t-reiter button').forEach((b) => {
    b.addEventListener('click', () => bereichZeigen(b.dataset.bereich));
  });
  posteingangEinrichten();
  portfolioEinrichten();
  einstellungenEinrichten();
  const ziel = location.hash.match(/^#einstellungen(?:\/([a-z0-9-]+))?$/);
  if (ziel) einst.ansicht = ziel[1] || 'portfolio';
  bereichZeigen(ziel ? 'einstellungen' : 'posteingang');
}

start();
