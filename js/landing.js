// Landingpage für Tischlereien: Bewegung beim Scrollen, Menü auf schmalen Bildschirmen, Pilot-Formular.
// Das Formular schickt an die Edge Function `pilot` (öffentlich, ohne Demo-Code).

const $ = (s) => document.querySelector(s);
const $$ = (s, w = document) => [...w.querySelectorAll(s)];

// ---------- Bewegung beim Scrollen ----------
// Ein rAF-gedrosselter Takt berechnet je Element, wie weit es herein- (--ein) bzw. hinausgescrollt (--aus) ist.
// Das CSS macht daraus Gleiten, Kippen und Schweben. Bei „Bewegung reduzieren“ nur der Lesefortschritt.

const wurzel = document.documentElement;
const ruhig = matchMedia('(prefers-reduced-motion: reduce)');
const begrenze = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const weich = (t) => 1 - (1 - t) ** 3;

const szene = $('[data-szene]');
const laufband = $('.laufband');
const huelle = $('.ablauf-huelle');
const buehne = $('.ablauf-buehne');
const schiene = $('.ablauf .schritte');
const tafeln = schiene ? $$('.schritt', schiene) : [];
const anzeigeNr = $('#anzeige-nr');
const bewegte = $$('[data-bewegung]');

let quer = false;
let strecke = 0; // Scrollweg für den Querlauf in px
let tafelMasse = [];
let geplant = false;
const zuletzt = new WeakMap(); // nur schreiben, wenn sich etwas ändert

function setze(el, name, wert) {
  let alt = zuletzt.get(el);
  if (!alt) zuletzt.set(el, (alt = {}));
  const gerundet = Math.round(wert * 1000) / 1000;
  if (alt[name] === gerundet) return;
  alt[name] = gerundet;
  el.style.setProperty(name, String(gerundet));
}

function anordnen() {
  quer = !ruhig.matches && Boolean(schiene) && innerWidth >= 1000 && innerHeight >= 640;
  wurzel.classList.toggle('quer', quer);
  if (!schiene) return;
  if (quer) {
    schiene.style.setProperty('--x', '0px');
    strecke = Math.max(0, schiene.scrollWidth - innerWidth);
    huelle.style.setProperty('--huelle', `${buehne.offsetHeight + strecke}px`);
    tafelMasse = tafeln.map((t) => ({ mitte: t.offsetLeft + t.offsetWidth / 2, breite: t.offsetWidth }));
    // Bilder außerhalb des Bildschirms sofort laden, sonst ploppen sie beim Querlauf auf
    $$('img', schiene).forEach((b) => (b.loading = 'eager'));
  } else {
    huelle.style.removeProperty('--huelle');
    schiene.style.removeProperty('--x');
    tafeln.forEach((t) => {
      t.style.removeProperty('--d');
      t.style.removeProperty('--da');
      zuletzt.delete(t);
    });
  }
}

function takt() {
  geplant = false;
  const vh = innerHeight;
  const gesamt = wurzel.scrollHeight - vh;
  setze(wurzel, '--fortschritt', gesamt > 0 ? scrollY / gesamt : 0);
  if (ruhig.matches) return;

  if (szene) {
    const r = szene.getBoundingClientRect();
    setze(szene, '--aus', begrenze(-r.top / (r.height * 0.85)));
  }
  if (laufband) {
    const r = laufband.getBoundingClientRect();
    if (r.bottom > -200 && r.top < vh + 200) laufband.style.setProperty('--verschiebung', `${Math.round((vh - r.top) * 0.35)}px`);
  }

  for (const el of bewegte) {
    if (quer && el.classList.contains('schritt')) continue;
    const r = el.getBoundingClientRect();
    if (r.top > vh * 1.4) { setze(el, '--ein', 0); setze(el, '--aus', 0); continue; }
    if (r.bottom < -vh * 0.4) { setze(el, '--ein', 1); setze(el, '--aus', 1); continue; }
    setze(el, '--ein', weich(begrenze((vh - r.top) / (vh * 0.55))));
    setze(el, '--aus', weich(begrenze((vh * 0.22 - r.bottom) / (vh * 0.5))));
  }

  if (quer && strecke > 0) {
    const r = huelle.getBoundingClientRect();
    const kopf = parseFloat(getComputedStyle(wurzel).getPropertyValue('--kopf')) || 72;
    const p = begrenze((kopf - r.top) / strecke);
    const x = -p * strecke;
    schiene.style.setProperty('--x', `${Math.round(x)}px`);
    buehne.style.setProperty('--x', `${Math.round(x)}px`);
    setze(huelle, '--p', p);
    tafeln.forEach((t, i) => {
      const { mitte, breite } = tafelMasse[i];
      const d = begrenze((mitte + x - innerWidth / 2) / breite, -1.5, 1.5);
      setze(t, '--d', d);
      setze(t, '--da', Math.min(1, Math.abs(d)));
    });
    const nr = String(Math.min(tafeln.length, Math.round(p * (tafeln.length - 1)) + 1)).padStart(2, '0');
    if (anzeigeNr && anzeigeNr.textContent !== nr) anzeigeNr.textContent = nr;
  }
}

function planen() {
  if (geplant) return;
  geplant = true;
  requestAnimationFrame(takt);
}

function bewegungStarten() {
  anordnen();
  takt();
  wurzel.classList.toggle('bewegt', !ruhig.matches);
}
addEventListener('scroll', planen, { passive: true });
addEventListener('resize', () => {
  anordnen();
  planen();
});
addEventListener('load', () => {
  anordnen();
  planen();
});
ruhig.addEventListener('change', bewegungStarten);
bewegungStarten();

// Kicker tippen sich ein, sobald sie sichtbar werden
const tipper = new IntersectionObserver(
  (eintraege) => {
    for (const e of eintraege) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('getippt');
      tipper.unobserve(e.target);
    }
  },
  { rootMargin: '0px 0px -10% 0px' },
);
$$('[data-tippen]').forEach((k) => {
  k.style.setProperty('--n', String(k.textContent.trim().length + 3));
  tipper.observe(k);
});

// ---------- Menü ----------
const menueKnopf = $('#menue-knopf');
const navigation = $('#hauptnavigation');
const schmal = matchMedia('(max-width: 860px)');

function menueSetzen(offen) {
  menueKnopf.setAttribute('aria-expanded', String(offen));
  navigation.hidden = schmal.matches && !offen;
}
menueKnopf.addEventListener('click', () => menueSetzen(menueKnopf.getAttribute('aria-expanded') !== 'true'));
navigation.addEventListener('click', (e) => {
  if (e.target.closest('a') && schmal.matches) menueSetzen(false);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menueKnopf.getAttribute('aria-expanded') === 'true') {
    menueSetzen(false);
    menueKnopf.focus();
  }
});
schmal.addEventListener('change', () => menueSetzen(false));
menueSetzen(false);

// ---------- Pilot-Formular ----------
const form = $('#pilot-form');
const fehler = $('#pilot-fehler');
const senden = $('#pilot-senden');

const PFLICHT = [
  ['name', 'Bitte geben Sie Ihren Namen an.'],
  ['betrieb', 'Bitte geben Sie Ihren Betrieb an.'],
  ['ort', 'Bitte geben Sie Ihren Ort an.'],
  ['email', 'Bitte geben Sie eine gültige E-Mail-Adresse an.'],
];

function zeigeFehler(text, feld) {
  fehler.textContent = text || '';
  fehler.hidden = !text;
  form.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
  if (feld) {
    feld.setAttribute('aria-invalid', 'true');
    feld.focus();
  }
}

/** Prüft im Browser, was die Function ohnehin prüft, damit Fehler sofort am Feld erscheinen. */
function pruefe() {
  for (const [name, meldung] of PFLICHT) {
    const feld = form.elements[name];
    if (!feld.value.trim() || !feld.checkValidity()) return { meldung, feld };
  }
  if (!form.elements.einwilligung.checked) {
    return { meldung: 'Bitte bestätigen Sie die Einwilligung zur Speicherung.', feld: form.elements.einwilligung };
  }
  return null;
}

async function ladeKonfig() {
  const k = await import('./config.js');
  if (!k.SUPABASE_URL || !k.SUPABASE_ANON_KEY || k.SUPABASE_URL.includes('DEINE-')) throw new Error('konfig');
  return { url: k.SUPABASE_URL.replace(/\/$/, ''), schluessel: k.SUPABASE_ANON_KEY };
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const problem = pruefe();
  if (problem) {
    zeigeFehler(problem.meldung, problem.feld);
    return;
  }
  zeigeFehler(null);

  const f = form.elements;
  const daten = {
    name: f.name.value,
    betrieb: f.betrieb.value,
    ort: f.ort.value,
    email: f.email.value,
    telefon: f.telefon.value,
    nachricht: f.nachricht.value,
    einwilligung: f.einwilligung.checked,
    website: f.website.value,
  };

  const knopfText = senden.innerHTML;
  senden.disabled = true;
  senden.textContent = 'Wird gesendet …';
  try {
    const { url, schluessel } = await ladeKonfig();
    const antwort = await fetch(`${url}/functions/v1/pilot`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${schluessel}`, apikey: schluessel },
      body: JSON.stringify(daten),
    });
    const ergebnis = await antwort.json().catch(() => null);
    if (!antwort.ok || !ergebnis?.ok) {
      throw new Error(ergebnis?.fehler?.meldung || 'Ihre Anfrage konnte gerade nicht gesendet werden. Bitte versuchen Sie es erneut.');
    }
  } catch (err) {
    const meldung =
      err instanceof TypeError
        ? 'Keine Verbindung. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.'
        : err.message === 'konfig'
          ? 'Das Formular ist auf dieser Seite nicht eingerichtet. Bitte schreiben Sie uns direkt.'
          : err.message;
    zeigeFehler(meldung);
    senden.disabled = false;
    senden.innerHTML = knopfText;
    return;
  }

  form.hidden = true;
  const erfolg = $('#pilot-erfolg');
  erfolg.hidden = false;
  erfolg.focus();
});
