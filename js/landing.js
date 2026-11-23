// Landingpage für Tischlereien: Menü auf schmalen Bildschirmen und Pilot-Formular.
// Das Formular schickt an die Edge Function `pilot` (öffentlich, ohne Demo-Code).

const $ = (s) => document.querySelector(s);

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
