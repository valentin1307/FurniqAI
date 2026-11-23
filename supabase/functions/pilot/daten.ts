// Prüfung der Pilot-Anfragen. Ohne Deno-Globals, damit mit Node testbar.

// deno-lint-ignore no-explicit-any
type Roh = any;

export class PilotFehler extends Error {}

/** Wortlaut der Einwilligung; wird mit jeder Anfrage gespeichert. Gleicher Text wie auf tischlereien.html. */
export const EINWILLIGUNG_TEXT =
  'Ich bin einverstanden, dass meine Angaben zur Bearbeitung meiner Anfrage gespeichert werden.';

/** Höchstens so viele Anfragen je E-Mail-Adresse in 24 Stunden und insgesamt je Stunde. */
export const GRENZE_JE_EMAIL_TAG = 3;
export const GRENZE_GESAMT_STUNDE = 30;

const text = (w: unknown, max: number) => (typeof w === 'string' ? w.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const langtext = (w: unknown, max: number) => (typeof w === 'string' ? w.trim().slice(0, max) : '');

/**
 * Formular → Tabellenzeile. Wirft PilotFehler mit deutschem Text.
 * Gibt null zurück, wenn das versteckte Feld „website“ ausgefüllt ist (Spam-Bot): Dann wird still nichts gespeichert.
 */
export function zeileAusPilot(e: Roh) {
  if (typeof e !== 'object' || e === null) throw new PilotFehler('Die Anfrage ist leer.');
  if (text(e.website, 200)) return null;

  const zeile = {
    name: text(e.name, 200),
    betrieb: text(e.betrieb, 200),
    ort: text(e.ort, 200),
    email: text(e.email, 200).toLowerCase(),
    telefon: text(e.telefon, 60) || null,
    nachricht: langtext(e.nachricht, 3000) || null,
    einwilligung: e.einwilligung === true,
    einwilligung_text: EINWILLIGUNG_TEXT,
  };
  if (!zeile.name) throw new PilotFehler('Bitte geben Sie Ihren Namen an.');
  if (!zeile.betrieb) throw new PilotFehler('Bitte geben Sie Ihren Betrieb an.');
  if (!zeile.ort) throw new PilotFehler('Bitte geben Sie Ihren Ort an.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(zeile.email)) throw new PilotFehler('Bitte geben Sie eine gültige E-Mail-Adresse an.');
  if (!zeile.einwilligung) throw new PilotFehler('Bitte bestätigen Sie die Einwilligung zur Speicherung.');
  return zeile;
}
