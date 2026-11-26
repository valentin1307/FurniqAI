// Schnittstelle für Bild-Anbieter. Ein weiterer Anbieter (z. B. OpenAI) ist nur eine weitere Datei
// in diesem Ordner, die `BildAnbieter` umsetzt, plus ein Eintrag in `anbieterWaehlen` (index.ts).

export interface BildEingabe {
  /** Raumfoto, das bearbeitet wird (base64, ohne data:-Präfix) */
  foto: string;
  /** Kopie mit roter Referenzlinie und Tischmarke, nur als Orientierung (base64) */
  fotoMarkiert: string;
  mimeType: string;
  /** Seitenverhältnis des Fotos, z. B. "4:3" */
  seitenverhaeltnis: string;
  prompt: string;
}

export interface BildErgebnis {
  bild: string; // base64
  mimeType: string;
  modell: string;
  /** Begleittext des Modells, falls vorhanden (nur fürs Log) */
  text?: string;
}

export interface BildAnbieter {
  name: string;
  modell: string;
  erzeuge(eingabe: BildEingabe, signal: AbortSignal): Promise<BildErgebnis>;
  /** Verfügbare Bildmodelle (für die Modellprüfung) */
  bildModelle(): Promise<string[]>;
}

export type FehlerCode =
  | 'zeit'
  | 'filter'
  | 'kein_bild'
  | 'abrechnung'
  | 'kontingent'
  | 'schluessel'
  | 'modell'
  | 'eingabe'
  | 'demo_code'
  | 'limit'
  | 'unbekannt';

/** Fehler mit deutschem Text für die Kundenseite und HTTP-Status. */
export class AnbieterFehler extends Error {
  code: FehlerCode;
  status: number;
  detail?: string;
  constructor(code: FehlerCode, meldung: string, status: number, detail?: string) {
    super(meldung);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

export const MELDUNG: Record<FehlerCode, string> = {
  zeit: 'Die Bild-KI hat zu lange gebraucht (Zeitüberschreitung). Bitte versuchen Sie es noch einmal.',
  filter: 'Der Inhaltsfilter der Bild-KI hat das Bild abgelehnt. Bitte versuchen Sie es mit einem anderen Foto.',
  kein_bild: 'Die Bild-KI hat kein Bild zurückgegeben. Bitte erzeugen Sie das Bild neu.',
  abrechnung:
    'Für die Bild-KI ist beim Anbieter keine Abrechnung aktiv oder das Guthaben ist aufgebraucht. Bitte Abrechnung bzw. Guthaben für den API-Schlüssel prüfen.',
  kontingent: 'Die Bild-KI ist gerade ausgelastet (zu viele Anfragen). Bitte warten Sie kurz und versuchen Sie es erneut.',
  schluessel: 'Der API-Schlüssel für die Bild-KI fehlt oder ist ungültig.',
  modell: 'Das eingestellte Bildmodell ist nicht verfügbar.',
  eingabe: 'Die Angaben für das Bild sind unvollständig.',
  demo_code: 'Bitte geben Sie den Demo-Code ein.',
  limit: 'Für heute sind keine weiteren KI-Bilder möglich. Bitte versuchen Sie es morgen erneut.',
  unbekannt: 'Die Bild-KI ist gerade nicht erreichbar. Bitte versuchen Sie es später erneut.',
};

export const STATUS: Record<FehlerCode, number> = {
  zeit: 504,
  filter: 422,
  kein_bild: 502,
  abrechnung: 402,
  kontingent: 429,
  schluessel: 500,
  modell: 500,
  eingabe: 400,
  demo_code: 401,
  limit: 429,
  unbekannt: 502,
};

export function fehler(code: FehlerCode, detail?: string, meldung = MELDUNG[code]): AnbieterFehler {
  return new AnbieterFehler(code, meldung, STATUS[code], detail);
}
