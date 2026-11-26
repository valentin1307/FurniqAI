// Edge Function feinschliff: ordnet Kundenwünsche aus dem Chat ein (Option, Sonderwunsch, Einstellung).
//
// POST { moebel?, nachricht, verlauf:[{rolle:'kunde'|'assistent', text}], konfiguration, betrieb }
//   moebel fehlt → 'couchtisch'; nur freigeschaltete Möbel (_shared/moebel.ts)
//   → 200 { antwort, aenderungen:[{ typ, aktion, option_id?, feld?, wert?, beschreibung, prompt_zusatz? }], modell }
// POST { aktion: "modelle" } → verfügbare Text-Modelle (Flash), nur mit Header x-demo-code
// Ohne Demo-Code nutzbar; Schutz vor Kosten durch das Tageslimit (_shared/limit.ts, Tabelle nutzung).
//
// Secrets: GEMINI_API_KEY, DEMO_CODE; optional GEMINI_TEXT_MODEL (Standard gemini-3.5-flash-lite)

import { json, vorpruefung } from '../_shared/http.ts';
import { pruefeDemoCode } from '../_shared/zugang.ts';
import { nutzungPruefen } from '../_shared/nutzung.ts';
import { istFreigeschaltet, moebelAus } from '../_shared/moebel.ts';
import { ordneHttpFehlerEin } from '../render-table/anbieter/gemini.ts';
import { AnbieterFehler, fehler } from '../render-table/anbieter/typ.ts';
import { ANTWORT_SCHEMA, baueAnweisung, denkEinstellung, bereinigeAntwort, verlaufFuerModell, type BetriebDaten } from './regeln.ts';

const API = 'https://generativelanguage.googleapis.com/v1beta';
const STANDARD_MODELL = 'gemini-3.5-flash-lite';
const ZEITLIMIT_MS = 30_000;

// deno-lint-ignore no-explicit-any
type Roh = any;

function pruefeBetrieb(b: Roh): BetriebDaten {
  const istListe = (l: Roh) => Array.isArray(l) && l.every((e) => typeof e?.id === 'string' && typeof e?.name === 'string');
  if (!b || !['formen', 'materialien', 'gestelle', 'oberflaechen', 'optionen'].every((k) => istListe(b[k])) || !b.grenzen) {
    throw fehler('eingabe', 'betrieb fehlt', 'Die Angaben des Betriebs fehlen.');
  }
  return b;
}

async function frageModell(schluessel: string, modell: string, anweisung: string, inhalte: Roh[]) {
  const generationConfig: Roh = {
    responseMimeType: 'application/json',
    responseSchema: ANTWORT_SCHEMA,
    ...denkEinstellung(modell),
  };

  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), ZEITLIMIT_MS);
  try {
    const antwort = await fetch(`${API}/models/${encodeURIComponent(modell)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': schluessel },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: anweisung }] }, contents: inhalte, generationConfig }),
      signal: abbruch.signal,
    });
    const text = await antwort.text();
    if (!antwort.ok) throw ordneHttpFehlerEin(antwort.status, text, modell);
    const daten = JSON.parse(text);
    const block = daten?.promptFeedback?.blockReason || (daten?.candidates?.[0]?.finishReason === 'SAFETY' && 'SAFETY');
    if (block) throw fehler('filter', String(block), 'Diese Nachricht kann ich leider nicht bearbeiten. Bitte formulieren Sie Ihren Wunsch anders.');
    const roh = daten?.candidates?.[0]?.content?.parts?.map((p: Roh) => p.text ?? '').join('') ?? '';
    try {
      return JSON.parse(roh);
    } catch {
      throw fehler('kein_bild', `keine JSON-Antwort: ${roh.slice(0, 200)}`, 'Der Assistent hat nicht verständlich geantwortet. Bitte versuchen Sie es noch einmal.');
    }
  } catch (err) {
    if (abbruch.signal.aborted) throw fehler('zeit', String(err), 'Der Assistent hat zu lange gebraucht. Bitte versuchen Sie es noch einmal.');
    throw err;
  } finally {
    clearTimeout(uhr);
  }
}

Deno.serve(async (req) => {
  const vorab = vorpruefung(req);
  if (vorab) return vorab;
  const origin = req.headers.get('origin');
  const start = Date.now();

  try {
    const schluessel = Deno.env.get('GEMINI_API_KEY');
    if (!schluessel) throw fehler('schluessel', 'Secret GEMINI_API_KEY fehlt');
    const modell = Deno.env.get('GEMINI_TEXT_MODEL') || STANDARD_MODELL;
    const e: Roh = await req.json().catch(() => ({}));

    if (e.aktion === 'modelle') {
      if (pruefeDemoCode(req.headers.get('x-demo-code'), Deno.env.get('DEMO_CODE')) !== 'ok') throw fehler('demo_code', 'Diagnose ohne Code');
      const r = await fetch(`${API}/models?pageSize=1000`, { headers: { 'x-goog-api-key': schluessel } });
      const d = await r.json();
      const flash = (d.models ?? [])
        .map((m: Roh) => String(m.name).replace(/^models\//, ''))
        .filter((n: string) => n.includes('flash') && !n.includes('image') && !n.includes('tts') && !n.includes('audio'));
      return json({ modell, verfuegbar: flash }, 200, origin);
    }

    if (!istFreigeschaltet(moebelAus(e.moebel))) {
      throw fehler('eingabe', `Möbel ${String(e.moebel)} nicht freigeschaltet`, 'Für dieses Möbelstück ist der Assistent noch nicht eingerichtet.');
    }
    const nachricht = typeof e.nachricht === 'string' ? e.nachricht.trim().slice(0, 600) : '';
    if (!nachricht) throw fehler('eingabe', 'nachricht fehlt', 'Bitte schreiben Sie Ihren Wunsch.');
    const betrieb = pruefeBetrieb(e.betrieb);
    const gesperrt = await nutzungPruefen('chat', req);
    if (gesperrt) throw fehler('limit', 'Tageslimit erreicht', gesperrt);
    const anweisung = baueAnweisung(betrieb, e.konfiguration ?? {});
    const inhalte = [...verlaufFuerModell(e.verlauf), { role: 'user', parts: [{ text: nachricht }] }];

    const roh = await frageModell(schluessel, modell, anweisung, inhalte);
    const ergebnis = bereinigeAntwort(roh, betrieb);
    console.log(JSON.stringify({ ok: true, modell, dauerMs: Date.now() - start, aenderungen: ergebnis.aenderungen.length }));
    return json({ ...ergebnis, modell }, 200, origin);
  } catch (err) {
    const f = err instanceof AnbieterFehler ? err : fehler('unbekannt', String(err));
    // Texte aus der Bild-KI auf den Assistenten umstellen
    const EIGENE: Record<string, string> = {
      unbekannt: 'Der Assistent ist gerade nicht erreichbar. Bitte versuchen Sie es später erneut.',
      abrechnung: 'Für den Assistenten ist beim Anbieter keine Abrechnung aktiv oder das Guthaben ist aufgebraucht.',
      kontingent: 'Der Assistent ist gerade ausgelastet. Bitte warten Sie kurz und versuchen Sie es erneut.',
      schluessel: 'Der API-Schlüssel für den Assistenten fehlt oder ist ungültig.',
      modell: 'Das eingestellte Text-Modell ist nicht verfügbar. Bitte GEMINI_TEXT_MODEL prüfen.',
    };
    const meldung = EIGENE[f.code] ?? f.message;
    console.error(JSON.stringify({ ok: false, code: f.code, detail: f.detail, dauerMs: Date.now() - start }));
    return json({ fehler: { code: f.code, meldung } }, f.status, origin);
  }
});
