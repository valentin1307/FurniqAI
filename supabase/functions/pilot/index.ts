// Edge Function pilot: speichert Pilot-Anfragen von Tischlereien (Formular auf tischlereien.html).
//
// Öffentlich, ohne Demo-Code. POST { name, betrieb, ort, email, telefon?, nachricht?, einwilligung: true, website? }
//   → 201 { ok: true }
//   → 4xx { fehler: { code, meldung } } (deutsche Meldung)
// „website“ ist ein verstecktes Feld gegen Spam-Bots: ausgefüllt → 201 ohne Speichern.
// Mengenbegrenzung: je E-Mail und insgesamt (siehe daten.ts). Lesen im Supabase-Dashboard.
//
// Benachrichtigung per Mail über Resend (https://resend.com), wenn diese Secrets gesetzt sind:
//   RESEND_API_KEY     API-Schlüssel von Resend
//   PILOT_EMPFAENGER   Adresse, an die jede Anfrage geht
//   PILOT_ABSENDER     optional, z. B. "FurniqAI <pilot@eure-domain.de>" (Domain bei Resend bestätigt).
//                      Ohne eigene Domain gilt onboarding@resend.dev; dann stellt Resend nur an die
//                      Adresse zu, mit der das Resend-Konto angelegt wurde.
// Fehlt etwas oder scheitert der Versand, bleibt die Anfrage trotzdem gespeichert (Fehler nur im Log).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { json, vorpruefung } from '../_shared/http.ts';
import { GRENZE_GESAMT_STUNDE, GRENZE_JE_EMAIL_TAG, mailAusPilot, PilotFehler, type PilotZeile, zeileAusPilot } from './daten.ts';

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

/** Mail ans Team. Gibt zurück, ob verschickt wurde; wirft nie. */
async function benachrichtige(zeile: PilotZeile): Promise<boolean> {
  const schluessel = Deno.env.get('RESEND_API_KEY');
  const an = Deno.env.get('PILOT_EMPFAENGER');
  if (!schluessel || !an) {
    console.warn(JSON.stringify({ mail: false, grund: 'RESEND_API_KEY oder PILOT_EMPFAENGER fehlt' }));
    return false;
  }
  const { betreff, text } = mailAusPilot(zeile);
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), 10_000);
  try {
    const antwort = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${schluessel}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('PILOT_ABSENDER') || 'FurniqAI <onboarding@resend.dev>',
        to: an.split(',').map((s) => s.trim()).filter(Boolean),
        reply_to: zeile.email,
        subject: betreff,
        text,
      }),
      signal: abbruch.signal,
    });
    if (!antwort.ok) {
      console.error(JSON.stringify({ mail: false, status: antwort.status, detail: (await antwort.text()).slice(0, 300) }));
      return false;
    }
    return true;
  } catch (err) {
    console.error(JSON.stringify({ mail: false, fehler: String((err as Error)?.message ?? err) }));
    return false;
  } finally {
    clearTimeout(uhr);
  }
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
    const mail = await benachrichtige(zeile);
    console.log(JSON.stringify({ ok: true, mail }));
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
