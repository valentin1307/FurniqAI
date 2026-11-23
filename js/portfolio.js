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

/**
 * Möbel, die Kundinnen und Kunden schon konfigurieren können. Gleiche Liste wie
 * supabase/functions/_shared/moebel.ts (FREIGESCHALTET); Ablauf in docs/moebel-freischalten.md.
 */
export const FREIGESCHALTET = [DEMO_MOEBEL];
export const istFreigeschaltet = (id) => FREIGESCHALTET.includes(id);

/** Vorschlag für eine neue Tischlerei, solange sie ihr Portfolio noch nicht gespeichert hat. */
export const START_MOEBEL = ['couchtisch', 'esstisch', 'stuhl', 'sessel', 'lampe', 'schrank', 'kommode', 'bett'];

// Liniensymbole 32 × 32 je Möbel (Tischlerseite und Kundenseite)
const MOEBEL_SYMBOL = {
  couchtisch: '<rect x="3" y="12" width="26" height="3" rx="1"/><path d="M6 15v9M26 15v9M6 20h20"/>',
  esstisch: '<rect x="3" y="9" width="26" height="3" rx="1"/><path d="M6 12v15M26 12v15"/>',
  schreibtisch: '<rect x="3" y="9" width="26" height="3" rx="1"/><path d="M5 12v15M19 12v15M27 12v15M19 18h8"/>',
  stuhl: '<path d="M10 4v23M10 16h12v11M8 16h16"/>',
  sessel: '<path d="M9 12V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4"/><rect x="4" y="12" width="5" height="10" rx="2"/><rect x="23" y="12" width="5" height="10" rx="2"/><path d="M9 17h14M9 22h14M7 22v4M25 22v4"/>',
  sofa: '<path d="M6 13V9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4"/><rect x="2" y="13" width="5" height="9" rx="2"/><rect x="25" y="13" width="5" height="9" rx="2"/><path d="M7 17h18M7 22h18M5 22v3M27 22v3"/>',
  lampe: '<path d="M11 4h10l3 8H8z"/><path d="M16 12v15M11 28h10"/>',
  schrank: '<rect x="7" y="3" width="18" height="24" rx="1"/><path d="M16 3v24M14 14v3M18 14v3M9 27v2M23 27v2"/>',
  kommode: '<rect x="5" y="7" width="22" height="18" rx="1"/><path d="M5 13h22M5 19h22M14 10h4M14 16h4M14 22h4M7 25v3M25 25v3"/>',
  sideboard: '<rect x="2" y="11" width="28" height="11" rx="1"/><path d="M11.3 11v11M20.7 11v11M4 22v4M28 22v4"/>',
  regal: '<path d="M6 3v26M26 3v26M6 10h20M6 17h20M6 24h20"/>',
  bett: '<path d="M3 27V8M3 19h26v8M3 15h26v4"/><rect x="5" y="11" width="7" height="4" rx="1.5"/>',
  nachttisch: '<rect x="8" y="9" width="16" height="15" rx="1"/><path d="M8 16h16M14 12.5h4M14 20h4M10 24v3M22 24v3"/>',
  garderobe: '<path d="M16 3v24M10 28h12M16 7l-6 4M16 7l6 4M16 12l-4 3M16 12l4 3"/>',
  eigen: '<rect x="5" y="9" width="22" height="16" rx="2"/><path d="M5 14h22M14 19h4"/>',
  plus: '<path d="M16 8v16M8 16h16"/>',
};

/** Symbol als SVG-Text; unbekannte und eigene Möbel bekommen ein neutrales Symbol. */
export function moebelSymbol(id, groesse = 32) {
  return `<svg viewBox="0 0 32 32" width="${groesse}" height="${groesse}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${
    MOEBEL_SYMBOL[id] || MOEBEL_SYMBOL.eigen
  }</svg>`;
}

const ID_MUSTER = /^[a-z0-9][a-z0-9-]{0,60}$/;
const katalogEintrag = (id) => MOEBEL_KATALOG.find((m) => m.id === id);

/** Kleinster Zustand: nur der Couchtisch (Grundlage beim Prüfen gespeicherter Daten). */
export function leeresPortfolio() {
  return { moebel: [{ id: DEMO_MOEBEL, name: katalogEintrag(DEMO_MOEBEL).name }] };
}

/** Startzustand ohne gespeichertes Portfolio: eine kleine Auswahl, Couchtisch vorn. */
export function startPortfolio() {
  return mischePortfolio({ moebel: START_MOEBEL.map((id) => ({ id })) });
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
    return roh ? mischePortfolio(JSON.parse(roh)) : startPortfolio();
  } catch {
    return startPortfolio();
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
