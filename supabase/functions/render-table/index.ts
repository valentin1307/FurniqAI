// Edge Function render-table: setzt das konfigurierte Möbelstück per Bild-KI ins Raumfoto.
//
// POST { moebel?, foto, fotoMarkiert, fotoBreite, fotoHoehe, referenz:{p1,p2,laengeCm}, tischPosition:{x,y},
//        tisch:{ form, laenge, breite, hoehe, materialId, gestellId, oberflaecheId, namen:{…}, promptZusatz? } }
//   moebel fehlt → 'couchtisch'. Nur freigeschaltete Möbel mit Eintrag in PROMPTS (prompt.ts).
//   tischPosition/tisch heißen aus Kompatibilität so, gelten aber für jedes Möbel.
//   → 200 { bild, mimeType, modell, anbieter, dauerMs, seitenverhaeltnis }
//   → 4xx/5xx { fehler: { code, meldung } }   (meldung auf Deutsch für die Kundenseite)
// POST { aktion: "modelle" } → { modell, verfuegbar: [...] }   (Prüfung, welche Bildmodelle der Schlüssel kann)
//
// Header x-demo-code: muss dem Secret DEMO_CODE entsprechen (Schutz vor fremden Aufrufen auf unsere Kosten).
// Secrets: GEMINI_API_KEY und DEMO_CODE (Pflicht), GEMINI_MODEL, ERLAUBTE_URSPRUENGE (optional, kommagetrennt)

import { type BildAnbieter, AnbieterFehler, fehler } from './anbieter/typ.ts';
import { GeminiAnbieter } from './anbieter/gemini.ts';
import { naechstesSeitenverhaeltnis, PROMPTS } from './prompt.ts';
import { pruefeDemoCode } from '../_shared/zugang.ts';
import { istFreigeschaltet, moebelAus } from '../_shared/moebel.ts';
import { json, vorpruefung } from '../_shared/http.ts';

const STANDARD_MODELL = 'gemini-3.1-flash-image';
const ZEITLIMIT_MS = 120_000;
const MAX_BILD_ZEICHEN = 12_000_000; // base64, ca. 9 MB

function anbieterWaehlen(): BildAnbieter {
  const schluessel = Deno.env.get('GEMINI_API_KEY');
  if (!schluessel) throw fehler('schluessel', 'Secret GEMINI_API_KEY fehlt');
  return new GeminiAnbieter(schluessel, Deno.env.get('GEMINI_MODEL') || STANDARD_MODELL);
}

// deno-lint-ignore no-explicit-any
type Roh = any;

const istZahl = (w: unknown): w is number => typeof w === 'number' && Number.isFinite(w);
const istPunkt = (p: Roh) => p && istZahl(p.x) && istZahl(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
const ohnePraefix = (s: string) => s.replace(/^data:[^,]*,/, '');

type Mangel = (was: string) => Error;

/** Angaben je Möbel prüfen (Schlüssel wie in PROMPTS). */
const MOEBEL_PRUEFUNG: Record<string, (t: Roh, mangel: Mangel) => void> = {
  couchtisch(t, mangel) {
    if (!t || !['rechteckig', 'quadratisch', 'rund', 'oval'].includes(t.form)) throw mangel('Form fehlt');
    for (const m of ['laenge', 'breite', 'hoehe']) if (!istZahl(t[m]) || t[m] <= 0) throw mangel(`Maß ${m} fehlt`);
    for (const f of ['materialId', 'gestellId', 'oberflaecheId']) if (typeof t[f] !== 'string') throw mangel(`${f} fehlt`);
    for (const n of ['form', 'material', 'gestell', 'oberflaeche']) {
      if (typeof t.namen?.[n] !== 'string') throw mangel(`Name ${n} fehlt`);
    }
  },
};

/** Eingabe prüfen; wirft AnbieterFehler('eingabe') mit konkretem Hinweis. Gibt die Möbel-ID zurück. */
function pruefeEingabe(e: Roh): string {
  const mangel = (was: string) => fehler('eingabe', was, `Die Angaben für das Bild sind unvollständig: ${was}.`);
  const moebel = moebelAus(e?.moebel);
  if (!istFreigeschaltet(moebel) || !PROMPTS[moebel!] || !MOEBEL_PRUEFUNG[moebel!]) {
    throw fehler('eingabe', `Möbel ${String(e?.moebel)} nicht freigeschaltet`, 'Für dieses Möbelstück gibt es noch keine Bildvorschau.');
  }
  if (typeof e?.foto !== 'string' || e.foto.length < 100) throw mangel('Raumfoto fehlt');
  if (typeof e?.fotoMarkiert !== 'string' || e.fotoMarkiert.length < 100) throw mangel('markiertes Foto fehlt');
  if (e.foto.length > MAX_BILD_ZEICHEN || e.fotoMarkiert.length > MAX_BILD_ZEICHEN) throw mangel('Foto ist zu groß');
  if (!istZahl(e.fotoBreite) || !istZahl(e.fotoHoehe) || e.fotoBreite <= 0 || e.fotoHoehe <= 0) {
    throw mangel('Fotogröße fehlt');
  }
  const r = e.referenz;
  if (!istPunkt(r?.p1) || !istPunkt(r?.p2) || !istZahl(r?.laengeCm) || r.laengeCm <= 0) {
    throw mangel('Referenzmarkierung fehlt');
  }
  if (!istPunkt(e.tischPosition)) throw mangel('Standort fehlt');
  MOEBEL_PRUEFUNG[moebel!](e.tisch, mangel);
  return moebel!;
}

Deno.serve(async (req) => {
  const vorab = vorpruefung(req);
  if (vorab) return vorab;
  const origin = req.headers.get('origin');

  const start = Date.now();
  try {
    const zugang = pruefeDemoCode(req.headers.get('x-demo-code'), Deno.env.get('DEMO_CODE'));
    if (zugang === 'nicht_eingerichtet') {
      throw fehler('demo_code', 'Secret DEMO_CODE fehlt', 'Die Bild-KI ist noch nicht freigeschaltet (Demo-Code fehlt in Supabase).');
    }
    if (zugang === 'falsch') throw fehler('demo_code', 'falscher Code', 'Der Demo-Code stimmt nicht. Bitte prüfen Sie ihn.');
    if (zugang === 'fehlt') throw fehler('demo_code', 'kein Code');

    const eingabe: Roh = await req.json().catch(() => {
      throw fehler('eingabe', 'kein JSON');
    });
    const anbieter = anbieterWaehlen();

    if (eingabe?.aktion === 'modelle') {
      return json({ modell: anbieter.modell, verfuegbar: await anbieter.bildModelle() }, 200, origin);
    }

    const moebel = pruefeEingabe(eingabe);
    const seitenverhaeltnis = naechstesSeitenverhaeltnis(eingabe.fotoBreite, eingabe.fotoHoehe);
    const prompt = PROMPTS[moebel](eingabe.tisch, eingabe.referenz.laengeCm);

    const abbruch = new AbortController();
    const uhr = setTimeout(() => abbruch.abort(), ZEITLIMIT_MS);
    try {
      const ergebnis = await anbieter.erzeuge(
        {
          foto: ohnePraefix(eingabe.foto),
          fotoMarkiert: ohnePraefix(eingabe.fotoMarkiert),
          mimeType: 'image/jpeg',
          seitenverhaeltnis,
          prompt,
        },
        abbruch.signal,
      );
      const dauerMs = Date.now() - start;
      console.log(JSON.stringify({ ok: true, moebel, modell: ergebnis.modell, dauerMs, seitenverhaeltnis }));
      return json({ ...ergebnis, anbieter: anbieter.name, dauerMs, seitenverhaeltnis }, 200, origin);
    } finally {
      clearTimeout(uhr);
    }
  } catch (err) {
    const f = err instanceof AnbieterFehler ? err : fehler('unbekannt', String(err));
    // Details nur ins Log der Function, nicht an den Browser
    console.error(JSON.stringify({ ok: false, code: f.code, detail: f.detail, dauerMs: Date.now() - start }));
    return json({ fehler: { code: f.code, meldung: f.message } }, f.status, origin);
  }
});
