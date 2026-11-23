// Edge Function anfragen: Anfragen speichern (Kundenseite), lesen und bearbeiten (Tischlerseite).
//
// Alle Aufrufe POST mit Header x-demo-code (Secret DEMO_CODE).
//   { aktion: "anlegen", anfrage: {...}, foto: dataURL, kiBild?: dataURL } → { id }
//   { aktion: "liste" }                                                  → { anfragen: [...] } (neueste zuerst)
//   { aktion: "detail", id }                                             → { anfrage }
//   { aktion: "status", id, status: "neu"|"angenommen"|"abgelehnt", grund? } → { anfrage }
// Fehler: { fehler: { code, meldung } } mit deutscher Meldung.
//
// Die Tabelle ist für anon gesperrt (RLS ohne Policies). Diese Function nutzt die service role.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { json, vorpruefung } from '../_shared/http.ts';
import { pruefeDemoCode } from '../_shared/zugang.ts';
import { anfrageAusZeile, bildAusDataUrl, DatenFehler, pruefeStatus, zeileAusAnfrage } from './daten.ts';

const BUCKET = 'anfrage-bilder';
const URL_GUELTIG_S = 60 * 60; // signierte Bild-URLs: 1 Stunde

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

class HttpFehler extends Error {
  constructor(public code: string, meldung: string, public status: number) {
    super(meldung);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function pruefeId(id: unknown): string {
  if (typeof id !== 'string' || !UUID.test(id)) throw new HttpFehler('eingabe', 'Ungültige Anfrage-ID.', 400);
  return id;
}

/** Signierte URLs für mehrere Pfade auf einmal; fehlende Pfade → null. */
async function signiere(pfade: (string | null)[]): Promise<Map<string, string>> {
  const vorhanden = [...new Set(pfade.filter((p): p is string => Boolean(p)))];
  const karte = new Map<string, string>();
  if (!vorhanden.length) return karte;
  const { data, error } = await db.storage.from(BUCKET).createSignedUrls(vorhanden, URL_GUELTIG_S);
  if (error) throw error;
  for (const e of data ?? []) if (e.path && e.signedUrl) karte.set(e.path, e.signedUrl);
  return karte;
}

async function anlegen(e: Roh) {
  const zeile = zeileAusAnfrage(e.anfrage);
  const foto = bildAusDataUrl(e.foto);
  const kiBild = bildAusDataUrl(e.kiBild);
  const id = crypto.randomUUID();
  const hochgeladen: string[] = [];

  const lade = async (bild: { bytes: Uint8Array; mimeType: string } | null, name: string) => {
    if (!bild) return null;
    const pfad = `${id}/${name}.${bild.mimeType === 'image/png' ? 'png' : 'jpg'}`;
    const { error } = await db.storage.from(BUCKET).upload(pfad, bild.bytes, { contentType: bild.mimeType });
    if (error) throw error;
    hochgeladen.push(pfad);
    return pfad;
  };

  try {
    const foto_pfad = await lade(foto, 'foto');
    const ki_bild_pfad = await lade(kiBild, 'ki-bild');
    const { error } = await db.from('anfragen').insert({ id, ...zeile, foto_pfad, ki_bild_pfad });
    if (error) throw error;
  } catch (err) {
    if (hochgeladen.length) await db.storage.from(BUCKET).remove(hochgeladen); // nichts Halbes zurücklassen
    throw err;
  }
  return { id };
}

async function liste() {
  const { data, error } = await db
    .from('anfragen')
    .select('id, erstellt, status, ablehnungsgrund, bearbeitet, kunde, konfiguration, preis, foto_pfad, ki_bild_pfad, passt_in_freien_platz')
    .order('erstellt', { ascending: false })
    .limit(200);
  if (error) throw error;
  const urls = await signiere(data.map((z) => z.ki_bild_pfad || z.foto_pfad));
  return {
    anfragen: data.map((z) =>
      anfrageAusZeile(z, z.ki_bild_pfad ? { kiBild: urls.get(z.ki_bild_pfad) } : { foto: urls.get(z.foto_pfad) }),
    ),
  };
}

async function detail(id: string) {
  const { data, error } = await db.from('anfragen').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpFehler('nicht_gefunden', 'Diese Anfrage gibt es nicht (mehr).', 404);
  const urls = await signiere([data.foto_pfad, data.ki_bild_pfad]);
  return { anfrage: anfrageAusZeile(data, { foto: urls.get(data.foto_pfad), kiBild: urls.get(data.ki_bild_pfad) }) };
}

async function statusSetzen(e: Roh) {
  const id = pruefeId(e.id);
  const neu = pruefeStatus(e.status, e.grund);
  const { data, error } = await db
    .from('anfragen')
    .update({ ...neu, bearbeitet: new Date().toISOString() })
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new HttpFehler('nicht_gefunden', 'Diese Anfrage gibt es nicht (mehr).', 404);
  return detail(id);
}

// deno-lint-ignore no-explicit-any
type Roh = any;

Deno.serve(async (req) => {
  const vorab = vorpruefung(req);
  if (vorab) return vorab;
  const origin = req.headers.get('origin');

  try {
    const zugang = pruefeDemoCode(req.headers.get('x-demo-code'), Deno.env.get('DEMO_CODE'));
    if (zugang === 'nicht_eingerichtet') throw new HttpFehler('demo_code', 'Der Demo-Code ist in Supabase nicht eingerichtet.', 401);
    if (zugang === 'falsch') throw new HttpFehler('demo_code', 'Der Demo-Code stimmt nicht. Bitte prüfen Sie ihn.', 401);
    if (zugang === 'fehlt') throw new HttpFehler('demo_code', 'Bitte geben Sie den Demo-Code ein.', 401);

    const e: Roh = await req.json().catch(() => ({}));
    switch (e.aktion) {
      case 'anlegen':
        return json(await anlegen(e), 201, origin);
      case 'liste':
        return json(await liste(), 200, origin);
      case 'detail':
        return json(await detail(pruefeId(e.id)), 200, origin);
      case 'status':
        return json(await statusSetzen(e), 200, origin);
      default:
        throw new HttpFehler('eingabe', 'Unbekannte Aktion.', 400);
    }
  } catch (err) {
    if (err instanceof HttpFehler) return json({ fehler: { code: err.code, meldung: err.message } }, err.status, origin);
    if (err instanceof DatenFehler) return json({ fehler: { code: 'eingabe', meldung: err.message } }, 400, origin);
    console.error(JSON.stringify({ ok: false, fehler: String((err as Error)?.message ?? err) }));
    return json(
      { fehler: { code: 'unbekannt', meldung: 'Die Anfrage konnte gerade nicht verarbeitet werden. Bitte versuchen Sie es erneut.' } },
      500,
      origin,
    );
  }
});
