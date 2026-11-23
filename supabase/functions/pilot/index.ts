// Edge Function pilot: speichert Pilot-Anfragen von Tischlereien (Formular auf tischlereien.html).
//
// Öffentlich, ohne Demo-Code. POST { name, betrieb, ort, email, telefon?, nachricht?, einwilligung: true, website? }
//   → 201 { ok: true }
//   → 4xx { fehler: { code, meldung } } (deutsche Meldung)
// „website“ ist ein verstecktes Feld gegen Spam-Bots: ausgefüllt → 201 ohne Speichern.
// Mengenbegrenzung: je E-Mail und insgesamt (siehe daten.ts). Lesen nur im Supabase-Dashboard.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { json, vorpruefung } from '../_shared/http.ts';
import { GRENZE_GESAMT_STUNDE, GRENZE_JE_EMAIL_TAG, PilotFehler, zeileAusPilot } from './daten.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

async function anzahlSeit(stunden: number, email?: string): Promise<number> {
  let abfrage = db
    .from('pilot_anfragen')
    .select('id', { count: 'exact', head: true })
    .gte('erstellt', new Date(Date.now() - stunden * 3600_000).toISOString());
  if (email) abfrage = abfrage.eq('email', email);
  const { count, error } = await abfrage;
  if (error) throw error;
  return count ?? 0;
}

Deno.serve(async (req) => {
  const vorab = vorpruefung(req);
  if (vorab) return vorab;
  const origin = req.headers.get('origin');

  try {
    const e = await req.json().catch(() => null);
    const zeile = zeileAusPilot(e);
    if (!zeile) return json({ ok: true }, 201, origin); // Spam-Bot: still verwerfen

    if ((await anzahlSeit(24, zeile.email)) >= GRENZE_JE_EMAIL_TAG) {
      throw new PilotFehler('Von dieser E-Mail-Adresse sind schon mehrere Anfragen eingegangen. Wir melden uns bei Ihnen.');
    }
    if ((await anzahlSeit(1)) >= GRENZE_GESAMT_STUNDE) {
      throw new PilotFehler('Gerade gehen sehr viele Anfragen ein. Bitte versuchen Sie es später noch einmal.');
    }

    const { error } = await db.from('pilot_anfragen').insert(zeile);
    if (error) throw error;
    console.log(JSON.stringify({ ok: true }));
    return json({ ok: true }, 201, origin);
  } catch (err) {
    if (err instanceof PilotFehler) return json({ fehler: { code: 'eingabe', meldung: err.message } }, 400, origin);
    console.error(JSON.stringify({ ok: false, fehler: String((err as Error)?.message ?? err) }));
    return json(
      { fehler: { code: 'unbekannt', meldung: 'Ihre Anfrage konnte gerade nicht gespeichert werden. Bitte versuchen Sie es erneut.' } },
      500,
      origin,
    );
  }
});
