// Tischlerseite: Posteingang (Anfragen aus Supabase) und Einstellungen (Betriebsdaten im Browser).
import {
  BETRIEB,
  BETRIEB_STANDARD,
  mischeBetrieb,
  bearbeitbareWerte,
  pruefeBetrieb,
  einstellungenSpeichern,
  einstellungenZuruecksetzen,
} from './betrieb.js';
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
  if (bereich === 'einstellungen') einstellungenZeichnen();
  if (bereich === 'posteingang') {
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
        <img src="${escape(bild)}" alt="${zeigeKi ? 'KI-Vorschau des Tisches im Raum' : 'Raumfoto der Kundin/des Kunden'}">
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
        <h3>Tisch</h3>
        <dl class="kv-daten">
          ${zeile('Möbel', BETRIEB.moebelart)}
          ${zeile('Form', n.form || k.form)}
          ${zeile('Maße', masseText(k))}
          ${zeile('Material', n.material)}
          ${zeile('Gestell', n.gestell)}
          ${zeile('Oberfläche', n.oberflaeche)}
          ${zeile('Optionen', optionen.length ? optionen.join(', ') : 'keine')}
        </dl>
        ${a.passtInFreienPlatz === false ? '<p class="hinweis-platz">Der Tisch ist größer als der angegebene freie Platz.</p>' : ''}
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

// ---------- Einstellungen ----------

// Was bearbeitet werden kann: [Liste, Titel, Preisfeld, Einheit]
const LISTEN = [
  ['materialien', 'Materialien', 'preisProQm', '€ je m² Platte'],
  ['gestelle', 'Gestelle', 'preis', '€ Aufpreis'],
  ['oberflaechen', 'Oberflächen', 'preis', '€ Aufpreis'],
  ['optionen', 'Optionen', 'preis', '€ Aufpreis'],
];
const MASSE = [['laenge', 'Länge'], ['breite', 'Breite'], ['hoehe', 'Höhe']];

// Zahlen ohne Tausenderpunkt, Komma als Dezimalzeichen (12,5)
const zahlText = (w) => String(w).replace('.', ',');
const zahlFeld = (pfad, wert, label) =>
  `<input type="text" inputmode="decimal" data-pfad="${pfad}" value="${escape(zahlText(wert))}" aria-label="${escape(label)}">`;

function einstellungenZeichnen(b = BETRIEB) {
  const listen = LISTEN.map(
    ([liste, titel, feld, einheit]) => `
    <fieldset class="karte t-einst">
      <legend>${titel}</legend>
      <div class="t-einst-zeilen">
        <span class="t-einst-spalte">Name</span><span class="t-einst-spalte">${einheit}</span>
        ${b[liste]
          .map(
            (e, i) => `
          <input type="text" data-pfad="${liste}.${i}.name" value="${escape(e.name)}" aria-label="${escape(titel)}: Name">
          ${zahlFeld(`${liste}.${i}.${feld}`, e[feld], `${e.name}: ${einheit}`)}`,
          )
          .join('')}
      </div>
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
      ${listen}
    </div>
    <p class="tipp">Gespeichert wird nur in diesem Browser (Demo). Der Konfigurator in diesem Browser nutzt die Werte beim nächsten Laden.</p>`;
}

/** „1.300“ → 1300, „12,5“ → 12.5, „12.5“ → 12.5; leer/ungültig → NaN. */
function leseZahl(text) {
  let t = String(text).trim().replace(/\s|€|%/g, '');
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '');
  t = t.replace(',', '.');
  return t === '' ? NaN : Number(t);
}

/** Formularwerte in eine Kopie des Betriebs schreiben. */
function einstellungenAusFormular() {
  const b = structuredClone(BETRIEB);
  document.querySelectorAll('#einstellungen-felder [data-pfad]').forEach((input) => {
    const teile = input.dataset.pfad.split('.');
    let ziel = b;
    for (const t of teile.slice(0, -1)) ziel = ziel[t];
    const feld = teile.at(-1);
    ziel[feld] = feld === 'name' ? input.value.trim() : leseZahl(input.value);
  });
  return b;
}

function einstellungenEinrichten() {
  $('#einstellungen-form').addEventListener('submit', (e) => {
    e.preventDefault();
    $('#einstellungen-ok').hidden = true;
    const b = einstellungenAusFormular();
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
    einstellungenZeichnen();
    $('#einstellungen-ok').hidden = false;
  });
  $('#einstellungen-standard').addEventListener('click', () => {
    if (!window.confirm('Alle Einstellungen auf die Standardwerte zurücksetzen?')) return;
    einstellungenZuruecksetzen();
    Object.assign(BETRIEB, structuredClone(BETRIEB_STANDARD));
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
  einstellungenEinrichten();
  bereichZeigen(location.hash === '#einstellungen' ? 'einstellungen' : 'posteingang');
}

start();
