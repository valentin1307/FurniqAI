// Portfolio der Tischlerei: welche Möbel sie im Konfigurator anbietet.
// Für die Demo ist nur der Couchtisch eingerichtet; alle anderen Möbel lassen sich anlegen
// und öffnen, ihre Einstellungen folgen später. Gespeichert wird nur im Browser.

export const PORTFOLIO_SCHLUESSEL = 'furniqai.portfolio';

/** Das Möbel, das in der Demo vollständig eingerichtet ist (Einstellungen aus betrieb.js). */
export const DEMO_MOEBEL = 'couchtisch';

/** Auswahl zum Hinzufügen. Die Reihenfolge ist die Anzeige-Reihenfolge. */
export const MOEBEL_KATALOG = [
  { id: 'couchtisch', name: 'Couchtisch' },
  { id: 'esstisch', name: 'Esstisch' },
  { id: 'schreibtisch', name: 'Schreibtisch' },
  { id: 'stuhl', name: 'Stuhl' },
  { id: 'sessel', name: 'Sessel' },
  { id: 'sofa', name: 'Sofa' },
  { id: 'lampe', name: 'Lampe' },
  { id: 'schrank', name: 'Schrank' },
  { id: 'kommode', name: 'Kommode' },
  { id: 'sideboard', name: 'Sideboard' },
  { id: 'regal', name: 'Regal' },
  { id: 'bett', name: 'Bett' },
  { id: 'nachttisch', name: 'Nachttisch' },
  { id: 'garderobe', name: 'Garderobe' },
];

const ID_MUSTER = /^[a-z0-9][a-z0-9-]{0,60}$/;
const katalogEintrag = (id) => MOEBEL_KATALOG.find((m) => m.id === id);

/** Startzustand: nur der Couchtisch. */
export function leeresPortfolio() {
  return { moebel: [{ id: DEMO_MOEBEL, name: katalogEintrag(DEMO_MOEBEL).name }] };
}

/**
 * Gespeicherte Daten prüfen: Katalog-Möbel per id, eigene Möbel mit Name (eigen: true).
 * Der Couchtisch ist immer dabei und steht vorn. Doppelte und Ungültiges fallen weg.
 */
export function mischePortfolio(roh) {
  const p = leeresPortfolio();
  for (const m of Array.isArray(roh?.moebel) ? roh.moebel : []) {
    if (!m || typeof m.id !== 'string' || p.moebel.some((x) => x.id === m.id)) continue;
    const k = katalogEintrag(m.id);
    if (k) p.moebel.push({ id: k.id, name: k.name });
    else if (m.eigen === true && ID_MUSTER.test(m.id) && typeof m.name === 'string' && m.name.trim()) {
      p.moebel.push({ id: m.id, name: m.name.trim().slice(0, 60), eigen: true });
    }
  }
  return p;
}

/** Möbel aus dem Katalog oder ein eigenes Möbel (nur Name) hinzufügen. Gibt ein neues Portfolio zurück. */
export function moebelHinzufuegen(p, eintrag) {
  const neu = structuredClone(p);
  if (typeof eintrag === 'string') {
    const k = katalogEintrag(eintrag);
    if (k && !neu.moebel.some((m) => m.id === k.id)) neu.moebel.push({ id: k.id, name: k.name });
    return neu;
  }
  const name = String(eintrag?.name ?? '').trim().slice(0, 60);
  if (!name) return neu;
  // Gleichnamiges Katalog-Möbel statt Dublette
  const k = MOEBEL_KATALOG.find((m) => m.name.toLowerCase() === name.toLowerCase());
  if (k) return moebelHinzufuegen(neu, k.id);
  if (neu.moebel.some((m) => m.name.toLowerCase() === name.toLowerCase())) return neu;
  const slug = name
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'moebel';
  let id = `eigen-${slug}`;
  for (let n = 2; neu.moebel.some((m) => m.id === id); n++) id = `eigen-${slug}-${n}`;
  neu.moebel.push({ id, name, eigen: true });
  return neu;
}

/** Möbel entfernen; der Couchtisch der Demo bleibt. */
export function moebelEntfernen(p, id) {
  if (id === DEMO_MOEBEL) return structuredClone(p);
  return { ...structuredClone(p), moebel: p.moebel.filter((m) => m.id !== id).map((m) => ({ ...m })) };
}

/** Katalog-Möbel, die noch nicht im Portfolio sind. */
export function nochNichtAngeboten(p) {
  return MOEBEL_KATALOG.filter((k) => !p.moebel.some((m) => m.id === k.id));
}

export function portfolioLaden() {
  try {
    const roh = globalThis.localStorage?.getItem(PORTFOLIO_SCHLUESSEL);
    return mischePortfolio(roh ? JSON.parse(roh) : null);
  } catch {
    return leeresPortfolio();
  }
}

/** Gibt false zurück, wenn der Browser-Speicher gesperrt ist. */
export function portfolioSpeichern(p) {
  try {
    globalThis.localStorage.setItem(PORTFOLIO_SCHLUESSEL, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}
