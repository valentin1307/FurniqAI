// Tageslimit für die öffentlichen Functions ohne Demo-Code.
// Reine Funktionen, damit sie ohne Deno getestet werden können (Datenbankteil: nutzung.ts).

export type Art = 'bild' | 'chat' | 'anfrage';

/** Höchstens so viele Aufrufe in 24 Stunden: je Gerät (IP) und insgesamt. */
export const GRENZEN: Record<Art, { jeGeraet: number; gesamt: number }> = {
  bild: { jeGeraet: 20, gesamt: 200 },
  chat: { jeGeraet: 150, gesamt: 2000 },
  anfrage: { jeGeraet: 10, gesamt: 100 },
};

export const LIMIT_MELDUNG: Record<Art, string> = {
  bild: 'Für heute sind keine weiteren KI-Bilder möglich. Bitte versuchen Sie es morgen erneut.',
  chat: 'Für heute sind keine weiteren Nachrichten an den Assistenten möglich. Bitte versuchen Sie es morgen erneut.',
  anfrage: 'Für heute können keine weiteren Anfragen gesendet werden. Bitte versuchen Sie es morgen erneut.',
};

/** Welche Grenze erreicht ist (vor dem neuen Aufruf gezählt), oder null. */
export function limitErreicht(art: Art, anzahlGeraet: number, anzahlGesamt: number): 'geraet' | 'gesamt' | null {
  const g = GRENZEN[art];
  if (anzahlGesamt >= g.gesamt) return 'gesamt';
  if (anzahlGeraet >= g.jeGeraet) return 'geraet';
  return null;
}

/** IP-Adresse des Aufrufers aus den Kopfzeilen (erste Adresse bei Weiterleitungen). */
export function ipAus(kopf: { get(name: string): string | null }): string {
  const weiter = kopf.get('x-forwarded-for');
  if (weiter) return weiter.split(',')[0].trim();
  return (kopf.get('cf-connecting-ip') || kopf.get('x-real-ip') || 'unbekannt').trim();
}

/** SHA-256 (hex) aus IP und Server-Geheimnis, damit keine IP im Klartext gespeichert wird. */
export async function geraetSchluessel(ip: string, salz: string): Promise<string> {
  const daten = new TextEncoder().encode(`${salz}|${ip}`);
  const hash = await crypto.subtle.digest('SHA-256', daten);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
