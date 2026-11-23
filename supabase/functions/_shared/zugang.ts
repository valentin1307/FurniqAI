// Demo-Code: Die Bild-KI kostet pro Bild. Nur wer den Code kennt (Secret DEMO_CODE), darf Bilder erzeugen.
// Ohne gesetztes Secret ist die Function gesperrt (sicherer Standard).

export type Zugang = 'ok' | 'fehlt' | 'falsch' | 'nicht_eingerichtet';

/** Vergleich in konstanter Zeit, damit der Code nicht Zeichen für Zeichen erraten werden kann. */
function gleich(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let unterschied = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) unterschied |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return unterschied === 0;
}

export function pruefeDemoCode(gesendet: string | null, erwartet: string | undefined): Zugang {
  if (!erwartet || !erwartet.trim()) return 'nicht_eingerichtet';
  const code = (gesendet ?? '').trim();
  if (!code) return 'fehlt';
  return gleich(code, erwartet.trim()) ? 'ok' : 'falsch';
}
