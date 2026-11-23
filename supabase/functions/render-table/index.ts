// Edge Function render-table: setzt den konfigurierten Tisch per Bild-KI ins Raumfoto.
//
// POST { foto, fotoMarkiert, fotoBreite, fotoHoehe, referenz:{p1,p2,laengeCm}, tischPosition:{x,y},
//        tisch:{ form, laenge, breite, hoehe, materialId, gestellId, oberflaecheId, namen:{…}, promptZusatz? } }
//   → 200 { bild, mimeType, modell, anbieter, dauerMs, seitenverhaeltnis }
//   → 4xx/5xx { fehler: { code, meldung } }   (meldung auf Deutsch für die Kundenseite)
// POST { aktion: "modelle" } → { modell, verfuegbar: [...] }   (Prüfung, welche Bildmodelle der Schlüssel kann)
//
// Secrets: GEMINI_API_KEY (Pflicht), GEMINI_MODEL (optional), ERLAUBTE_URSPRUENGE (optional, kommagetrennt)

import { type BildAnbieter, AnbieterFehler, fehler } from './anbieter/typ.ts';
import { GeminiAnbieter } from './anbieter/gemini.ts';
import { bauePrompt, naechstesSeitenverhaeltnis, type TischParameter } from './prompt.ts';

const STANDARD_MODELL = 'gemini-3.1-flash-image';
const ZEITLIMIT_MS = 120_000;
const MAX_BILD_ZEICHEN = 12_000_000; // base64, ca. 9 MB

const STANDARD_URSPRUENGE = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://valentin1307.github.io',
];
const erlaubteUrspruenge = (Deno.env.get('ERLAUBTE_URSPRUENGE') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const URSPRUENGE = erlaubteUrspruenge.length ? erlaubteUrspruenge : STANDARD_URSPRUENGE;

function corsKoepfe(origin: string | null): Record<string, string> {
  const k: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (origin && URSPRUENGE.includes(origin)) k['Access-Control-Allow-Origin'] = origin;
  return k;
}

function json(daten: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(daten), {
    status,
    headers: { ...corsKoepfe(origin), 'content-type': 'application/json; charset=utf-8' },
  });
}

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

/** Eingabe prüfen; wirft AnbieterFehler('eingabe') mit konkretem Hinweis. */
function pruefeEingabe(e: Roh) {
  const mangel = (was: string) => fehler('eingabe', was, `Die Angaben für das Bild sind unvollständig: ${was}.`);
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
  if (!istPunkt(e.tischPosition)) throw mangel('Tischposition fehlt');
  const t = e.tisch;
  if (!t || !['rechteckig', 'quadratisch', 'rund', 'oval'].includes(t.form)) throw mangel('Form fehlt');
  for (const m of ['laenge', 'breite', 'hoehe']) if (!istZahl(t[m]) || t[m] <= 0) throw mangel(`Maß ${m} fehlt`);
  for (const f of ['materialId', 'gestellId', 'oberflaecheId']) if (typeof t[f] !== 'string') throw mangel(`${f} fehlt`);
  for (const n of ['form', 'material', 'gestell', 'oberflaeche']) {
    if (typeof t.namen?.[n] !== 'string') throw mangel(`Name ${n} fehlt`);
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsKoepfe(origin) });
  if (req.method !== 'POST') return json({ fehler: { code: 'methode', meldung: 'Nur POST.' } }, 405, origin);
  if (origin && !URSPRUENGE.includes(origin)) {
    return json({ fehler: { code: 'herkunft', meldung: `Herkunft ${origin} ist nicht erlaubt.` } }, 403, origin);
  }

  const start = Date.now();
  try {
    const eingabe: Roh = await req.json().catch(() => {
      throw fehler('eingabe', 'kein JSON');
    });
    const anbieter = anbieterWaehlen();

    if (eingabe?.aktion === 'modelle') {
      return json({ modell: anbieter.modell, verfuegbar: await anbieter.bildModelle() }, 200, origin);
    }

    pruefeEingabe(eingabe);
    const tisch: TischParameter = eingabe.tisch;
    const seitenverhaeltnis = naechstesSeitenverhaeltnis(eingabe.fotoBreite, eingabe.fotoHoehe);
    const prompt = bauePrompt(tisch, eingabe.referenz.laengeCm);

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
      console.log(JSON.stringify({ ok: true, modell: ergebnis.modell, dauerMs, seitenverhaeltnis }));
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
