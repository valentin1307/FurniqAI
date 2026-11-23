// Feinschliff-Chat: Anweisung an das Text-Modell, Antwortschema und Prüfung der Antwort.
// Reine Funktionen ohne Deno-Globals, damit mit Node testbar.

// deno-lint-ignore no-explicit-any
type Roh = any;

export interface Eintrag {
  id: string;
  name: string;
  preis?: number;
  preisProQm?: number;
}
export interface BetriebDaten {
  moebelart: string;
  formen: Eintrag[];
  materialien: Eintrag[];
  gestelle: Eintrag[];
  oberflaechen: Eintrag[];
  optionen: Eintrag[];
  grenzen: Record<'laenge' | 'breite' | 'hoehe', { min: number; max: number }>;
}

export const FELDER = ['form', 'materialId', 'gestellId', 'oberflaecheId', 'laenge', 'breite', 'hoehe'] as const;
export type Feld = (typeof FELDER)[number];

export interface Aenderung {
  typ: 'option' | 'sonderwunsch' | 'einstellung';
  aktion: 'hinzufuegen' | 'entfernen';
  option_id?: string;
  feld?: Feld;
  wert?: string | number;
  beschreibung: string;
  prompt_zusatz?: string;
}

/** Antwortschema für Gemini (structured output). */
export const ANTWORT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    antwort: { type: 'STRING', description: 'Kurze Antwort an den Kunden auf Deutsch, Sie-Form, höchstens 2 Sätze.' },
    aenderungen: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          typ: { type: 'STRING', enum: ['option', 'sonderwunsch', 'einstellung'] },
          aktion: { type: 'STRING', enum: ['hinzufuegen', 'entfernen'] },
          option_id: { type: 'STRING', nullable: true },
          feld: { type: 'STRING', enum: [...FELDER], nullable: true },
          wert: { type: 'STRING', nullable: true },
          beschreibung: { type: 'STRING' },
          prompt_zusatz: { type: 'STRING', nullable: true },
        },
        required: ['typ', 'aktion', 'beschreibung'],
      },
    },
  },
  required: ['antwort', 'aenderungen'],
};

const liste = (eintraege: Eintrag[], preis: (e: Eintrag) => string) =>
  eintraege.map((e) => `- ${e.id}: ${e.name}${preis(e)}`).join('\n');

/** Anweisung an das Modell mit Optionen und Auswahl des Betriebs und der aktuellen Konfiguration. */
export function baueAnweisung(b: BetriebDaten, konfig: Roh): string {
  const euro = (e: Eintrag) => (typeof e.preis === 'number' ? ` (Aufpreis ${e.preis} €)` : '');
  const g = b.grenzen;
  return `Sie sind der Assistent einer Tischlerei im Online-Konfigurator für einen ${b.moebelart} nach Maß.
Der Kunde beschreibt Wünsche zu seinem Tisch. Ordnen Sie jeden Wunsch ein und antworten Sie nur im JSON-Schema.

Arten von Änderungen:
1. "einstellung": Der Wunsch betrifft etwas, das es im Baukasten schon gibt. feld ist eines von
   form, materialId, gestellId, oberflaecheId (wert = eine ID aus den Listen unten) oder
   laenge, breite, hoehe (wert = Zahl in cm, als Text). Relative Angaben wie "10 cm länger" rechnen Sie
   mit der aktuellen Konfiguration aus. Maße außerhalb der Grenzen: auf die Grenze setzen und es in der antwort sagen.
2. "option": Der Wunsch entspricht einer Option des Betriebs (option_id aus der Liste). Diese haben einen festen Aufpreis.
   aktion "entfernen", wenn der Kunde eine gewählte Option nicht mehr möchte.
3. "sonderwunsch": Ein baubarer Wunsch am Tisch, der in keiner Liste steht (z. B. eingelassene Glasplatte,
   besondere Kantenform, Fräsung). Preis ist "auf Anfrage", die Tischlerei prüft ihn. Nennen Sie dafür nie einen Preis.

Für "option" und "sonderwunsch": prompt_zusatz ist ein kurzer englischer Satz, der das sichtbare Aussehen für ein
Bildmodell beschreibt (z. B. "The table has a lower shelf between the legs, made of the same wood.").
beschreibung ist ein kurzer deutscher Name für die Liste (z. B. "Ablage unten").

Regeln:
- Erfinden Sie keine Preise. Preise nennen Sie höchstens für Optionen aus der Liste.
- Wünsche, die nichts mit dem Tisch zu tun haben, nicht machbar sind oder unklar bleiben: keine Änderung,
  in der antwort freundlich nachfragen oder erklären.
- Mehrere Wünsche in einer Nachricht: mehrere Einträge in aenderungen.
- antwort: höchstens 2 Sätze, Deutsch, Sie-Form, bestätigt kurz, was übernommen wurde.

Formen:
${liste(b.formen, () => '')}
Materialien (Tischplatte):
${liste(b.materialien, () => '')}
Gestelle:
${liste(b.gestelle, euro)}
Oberflächen:
${liste(b.oberflaechen, euro)}
Optionen:
${liste(b.optionen, euro)}
Maßgrenzen in cm: Länge ${g.laenge.min}–${g.laenge.max}, Breite ${g.breite.min}–${g.breite.max}, Höhe ${g.hoehe.min}–${g.hoehe.max}.

Aktuelle Konfiguration:
${JSON.stringify(konfig)}`;
}

const text = (w: unknown, max: number) => (typeof w === 'string' ? w.trim().slice(0, max) : '');

/**
 * Antwort des Modells prüfen: nur bekannte IDs, Felder und Zahlen übernehmen.
 * Ungültige Einträge fallen weg, die Antwort an den Kunden bleibt.
 */
export function bereinigeAntwort(json: Roh, b: BetriebDaten): { antwort: string; aenderungen: Aenderung[] } {
  const antwort = text(json?.antwort, 600) || 'Entschuldigung, das habe ich nicht verstanden. Können Sie es anders formulieren?';
  const ids: Record<string, Eintrag[]> = {
    form: b.formen,
    materialId: b.materialien,
    gestellId: b.gestelle,
    oberflaecheId: b.oberflaechen,
  };
  const aenderungen: Aenderung[] = [];
  for (const a of Array.isArray(json?.aenderungen) ? json.aenderungen.slice(0, 8) : []) {
    const aktion = a?.aktion === 'entfernen' ? 'entfernen' : 'hinzufuegen';
    const beschreibung = text(a?.beschreibung, 120);
    const prompt_zusatz = text(a?.prompt_zusatz, 300) || undefined;
    if (a?.typ === 'option') {
      const option = b.optionen.find((o) => o.id === a.option_id);
      if (option) aenderungen.push({ typ: 'option', aktion, option_id: option.id, beschreibung: option.name, prompt_zusatz });
    } else if (a?.typ === 'sonderwunsch') {
      if (beschreibung) aenderungen.push({ typ: 'sonderwunsch', aktion, beschreibung, prompt_zusatz });
    } else if (a?.typ === 'einstellung' && (FELDER as readonly string[]).includes(a.feld)) {
      if (a.feld in ids) {
        const eintrag = ids[a.feld].find((e) => e.id === a.wert);
        if (eintrag) aenderungen.push({ typ: 'einstellung', aktion: 'hinzufuegen', feld: a.feld, wert: eintrag.id, beschreibung: beschreibung || eintrag.name });
      } else {
        const zahl = Number(String(a.wert ?? '').replace(',', '.').replace(/[^\d.]/g, ''));
        if (Number.isFinite(zahl) && zahl > 0) {
          aenderungen.push({ typ: 'einstellung', aktion: 'hinzufuegen', feld: a.feld, wert: Math.round(zahl), beschreibung });
        }
      }
    }
  }
  return { antwort, aenderungen };
}

/** Gesprächsverlauf fürs Modell: nur die letzten Nachrichten, gekürzt. */
export function verlaufFuerModell(verlauf: Roh): { role: 'user' | 'model'; parts: { text: string }[] }[] {
  if (!Array.isArray(verlauf)) return [];
  return verlauf
    .slice(-8)
    .filter((n) => (n?.rolle === 'kunde' || n?.rolle === 'assistent') && typeof n.text === 'string' && n.text.trim())
    .map((n) => ({ role: n.rolle === 'kunde' ? 'user' : 'model', parts: [{ text: n.text.trim().slice(0, 600) }] }));
}
