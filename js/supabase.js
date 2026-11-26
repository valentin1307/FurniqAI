// Zugang zu den Supabase Edge Functions für Kunden- und Tischlerseite.
// Supabase-URL und anon key kommen aus js/config.js, der Demo-Code (nur Tischlerseite) aus dem Browser-Speicher.

// Demo-Code: nur auf diesem Gerät gemerkt (Browser-Speicher), nie im Code
const DEMO_CODE_SCHLUESSEL = 'furniqai.demoCode';
let sitzungsCode = '';

export function demoCodeLesen() {
  try {
    return localStorage.getItem(DEMO_CODE_SCHLUESSEL) || sitzungsCode;
  } catch {
    return sitzungsCode;
  }
}

export function demoCodeSpeichern(code) {
  sitzungsCode = code;
  try {
    if (code) localStorage.setItem(DEMO_CODE_SCHLUESSEL, code);
    else localStorage.removeItem(DEMO_CODE_SCHLUESSEL);
  } catch {
    // privates Fenster o. Ä.: dann gilt der Code nur bis zum Neuladen
  }
}

/** Supabase-Zugang aus js/config.js. null, wenn die Datei fehlt oder Platzhalter enthält. */
async function ladeKonfig() {
  try {
    const k = await import('./config.js');
    if (!k.SUPABASE_URL || !k.SUPABASE_ANON_KEY || k.SUPABASE_URL.includes('DEINE-')) return null;
    return { url: k.SUPABASE_URL.replace(/\/$/, ''), schluessel: k.SUPABASE_ANON_KEY };
  } catch {
    return null;
  }
}

/** Fehler mit deutschem Text; code z. B. 'demo_code', 'zeit', 'netz', 'konfig'. */
export class ApiFehler extends Error {
  constructor(meldung, code) {
    super(meldung);
    this.code = code;
  }
}

/**
 * Edge Function aufrufen. Gibt die JSON-Antwort zurück oder wirft ApiFehler mit deutscher Meldung.
 * texte: { name } für Fehlermeldungen, z. B. 'Die Bild-KI'.
 */
export async function rufeFunction(name, body, { signal, wer = 'Der Dienst' } = {}) {
  const konfig = await ladeKonfig();
  if (!konfig) throw new ApiFehler(`${wer} ist auf diesem Gerät nicht eingerichtet (js/config.js fehlt).`, 'konfig');
  let antwort;
  try {
    antwort = await fetch(`${konfig.url}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${konfig.schluessel}`,
        apikey: konfig.schluessel,
        'x-demo-code': demoCodeLesen(),
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    if (signal?.aborted) {
      throw new ApiFehler(`${wer} hat zu lange gebraucht (Zeitüberschreitung). Bitte versuchen Sie es noch einmal.`, 'zeit');
    }
    throw new ApiFehler(`${wer} ist nicht erreichbar. Bitte prüfen Sie Ihre Internetverbindung.`, 'netz');
  }
  const daten = await antwort.json().catch(() => null);
  if (!antwort.ok || !daten || daten.fehler) {
    const meldung = daten?.fehler?.meldung || `${wer} hat einen Fehler gemeldet (HTTP ${antwort.status}).`;
    throw new ApiFehler(meldung, daten?.fehler?.code || `http-${antwort.status}`);
  }
  return daten;
}
