// Welche Möbel die Edge Functions verarbeiten. Gleiche IDs wie in js/portfolio.js.
// Reine Funktionen ohne Deno-Globals, damit mit Node testbar.
//
// Ein Möbel freischalten (Ablauf siehe docs/moebel-freischalten.md):
//   1. ID hier in FREIGESCHALTET eintragen (und in js/portfolio.js),
//   2. anfragen/daten.ts: Prüfung der Konfiguration in KONFIG_PRUEFUNG ergänzen,
//   3. render-table/prompt.ts: Prompt in PROMPTS ergänzen,
//   4. Functions neu deployen. Die Tabelle braucht keine Änderung: Spalte moebel ist freier Text.

/** Möbel, wenn eine ältere Kundenseite keins mitschickt (vor Einführung der Möbelauswahl). */
export const STANDARD_MOEBEL = 'couchtisch';

/** Möbel, für die Anfragen, Bild-KI und Feinschliff-Chat eingerichtet sind. */
export const FREIGESCHALTET: readonly string[] = ['couchtisch'];

// Wie die Check-Regel der Spalte anfragen.moebel (Migration 20261123150000_moebel.sql)
const ID_MUSTER = /^[a-z0-9][a-z0-9-]{0,60}$/;

/** Möbel-ID aus der Eingabe: fehlt sie → STANDARD_MOEBEL, ungültig → null. */
export function moebelAus(wert: unknown): string | null {
  if (wert === undefined || wert === null || wert === '') return STANDARD_MOEBEL;
  return typeof wert === 'string' && ID_MUSTER.test(wert) ? wert : null;
}

export function istFreigeschaltet(id: string | null): boolean {
  return id !== null && FREIGESCHALTET.includes(id);
}
