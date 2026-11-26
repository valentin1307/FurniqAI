// Tageslimit mit der Tabelle public.nutzung (Migration 20261126120000_nutzung.sql).
// Zählt Aufrufe der letzten 24 Stunden je Gerät und insgesamt; bei Platz wird der Aufruf eingetragen.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { type Art, geraetSchluessel, ipAus, limitErreicht, LIMIT_MELDUNG } from './limit.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const TAG_MS = 24 * 60 * 60 * 1000;

/**
 * Prüft das Tageslimit und trägt den Aufruf ein.
 * @returns null, wenn der Aufruf erlaubt ist, sonst die Meldung für die Kundenseite.
 */
export async function nutzungPruefen(art: Art, req: Request): Promise<string | null> {
  const salz = Deno.env.get('DEMO_CODE') || Deno.env.get('SUPABASE_URL') || '';
  const geraet = await geraetSchluessel(ipAus(req.headers), salz);
  const seit = new Date(Date.now() - TAG_MS).toISOString();

  const zaehle = async (nurGeraet: boolean) => {
    let abfrage = db.from('nutzung').select('id', { count: 'exact', head: true }).eq('art', art).gte('zeit', seit);
    if (nurGeraet) abfrage = abfrage.eq('geraet', geraet);
    const { count, error } = await abfrage;
    if (error) throw error;
    return count ?? 0;
  };
  const [anzahlGeraet, anzahlGesamt] = await Promise.all([zaehle(true), zaehle(false)]);
  if (limitErreicht(art, anzahlGeraet, anzahlGesamt)) return LIMIT_MELDUNG[art];

  const { error } = await db.from('nutzung').insert({ art, geraet });
  if (error) throw error;
  // Aufräumen: alles älter als 2 Tage (klein dank Index)
  await db.from('nutzung').delete().lt('zeit', new Date(Date.now() - 2 * TAG_MS).toISOString());
  return null;
}
