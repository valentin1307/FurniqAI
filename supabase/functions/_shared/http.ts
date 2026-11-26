// Gemeinsame HTTP-Helfer der Edge Functions: CORS und JSON-Antworten.

const STANDARD_URSPRUENGE = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://valentin1307.github.io',
  'https://werkbuilt.com',
  'https://www.werkbuilt.com',
];
const erlaubteUrspruenge = (Deno.env.get('ERLAUBTE_URSPRUENGE') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
export const URSPRUENGE = erlaubteUrspruenge.length ? erlaubteUrspruenge : STANDARD_URSPRUENGE;

export function corsKoepfe(origin: string | null): Record<string, string> {
  const k: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-demo-code',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (origin && URSPRUENGE.includes(origin)) k['Access-Control-Allow-Origin'] = origin;
  return k;
}

export function json(daten: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(daten), {
    status,
    headers: { ...corsKoepfe(origin), 'content-type': 'application/json; charset=utf-8' },
  });
}

/** Vorab-Prüfung für jede Anfrage: OPTIONS beantworten, nur POST, nur erlaubte Herkunft. */
export function vorpruefung(req: Request): Response | null {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsKoepfe(origin) });
  if (req.method !== 'POST') return json({ fehler: { code: 'methode', meldung: 'Nur POST.' } }, 405, origin);
  if (origin && !URSPRUENGE.includes(origin)) {
    return json({ fehler: { code: 'herkunft', meldung: `Herkunft ${origin} ist nicht erlaubt.` } }, 403, origin);
  }
  return null;
}
