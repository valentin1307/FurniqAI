// Umwandlung und Prüfung der Anfrage-Daten. Ohne Deno-Globals, damit mit Node testbar.

import { istFreigeschaltet, moebelAus } from '../_shared/moebel.ts';

// deno-lint-ignore no-explicit-any
type Roh = any;

export const STATUS_WERTE = ['neu', 'angenommen', 'abgelehnt'] as const;
export type Status = (typeof STATUS_WERTE)[number];

export class DatenFehler extends Error {}

const text = (w: unknown, max: number) => (typeof w === 'string' ? w.trim().slice(0, max) : '');
const istZahl = (w: unknown) => typeof w === 'number' && Number.isFinite(w);
const istObjekt = (w: unknown) => typeof w === 'object' && w !== null && !Array.isArray(w);

/**
 * Prüfung der Konfiguration je Möbel. Jedes freigeschaltete Möbel (_shared/moebel.ts) braucht hier
 * einen Eintrag, sonst wird die Anfrage abgelehnt statt mit unpassenden Daten gespeichert.
 */
export const KONFIG_PRUEFUNG: Record<string, (k: Roh) => boolean> = {
  couchtisch: (k) => typeof k.form === 'string' && istZahl(k.laenge) && istZahl(k.hoehe),
};

/**
 * Anfrage von der Kundenseite (camelCase) → Tabellenzeile (snake_case).
 * Wirft DatenFehler mit deutschem Text, wenn Pflichtangaben fehlen.
 */
export function zeileAusAnfrage(a: Roh) {
  if (!istObjekt(a)) throw new DatenFehler('Die Anfrage ist leer.');
  const kunde = {
    name: text(a.kunde?.name, 200),
    email: text(a.kunde?.email, 200),
    telefon: text(a.kunde?.telefon, 60),
    ort: text(a.kunde?.ort, 200),
    nachricht: text(a.kunde?.nachricht, 3000),
  };
  if (!kunde.name) throw new DatenFehler('Bitte geben Sie Ihren Namen an.');
  if (!/^\S+@\S+\.\S+$/.test(kunde.email)) throw new DatenFehler('Bitte geben Sie eine gültige E-Mail-Adresse an.');

  // Ältere Kundenseiten schicken kein Möbel mit → Couchtisch
  const moebel = moebelAus(a.moebel);
  if (moebel === null) throw new DatenFehler('Unbekanntes Möbelstück.');
  const pruefe = KONFIG_PRUEFUNG[moebel];
  if (!istFreigeschaltet(moebel) || !pruefe) {
    throw new DatenFehler('Dieses Möbelstück kann noch nicht angefragt werden.');
  }
  const k = a.konfiguration;
  if (!istObjekt(k) || !pruefe(k)) throw new DatenFehler('Die Auswahl zum Möbelstück fehlt.');
  if (!istObjekt(a.preis) || !istZahl(a.preis.summe)) throw new DatenFehler('Der Preis fehlt.');
  if (!istObjekt(a.freierPlatz) || !istZahl(a.freierPlatz.laenge) || !istZahl(a.freierPlatz.breite)) {
    throw new DatenFehler('Der freie Platz fehlt.');
  }

  return {
    moebel,
    moebel_name: text(a.moebelName, 80) || null,
    kunde,
    konfiguration: k,
    preis: a.preis,
    raum: istObjekt(a.raum) ? a.raum : null,
    freier_platz: a.freierPlatz,
    wunschmasse: istObjekt(a.wunschmasse) ? a.wunschmasse : null,
    referenz: istObjekt(a.referenz) ? a.referenz : null,
    tisch_position: istObjekt(a.tischPosition) ? a.tischPosition : null,
    passt_in_freien_platz: typeof a.passtInFreienPlatz === 'boolean' ? a.passtInFreienPlatz : null,
    ki_info: istObjekt(a.kiInfo) ? a.kiInfo : null,
  };
}

/** Tabellenzeile → Anfrage für die Tischlerseite (camelCase), Bild-URLs werden ergänzt. */
export function anfrageAusZeile(z: Roh, urls: { foto?: string | null; kiBild?: string | null } = {}) {
  return {
    id: z.id,
    erstellt: z.erstellt,
    status: z.status,
    moebel: z.moebel ?? 'couchtisch', // Zeilen von vor der Migration
    moebelName: z.moebel_name ?? null,
    ablehnungsgrund: z.ablehnungsgrund ?? null,
    bearbeitet: z.bearbeitet ?? null,
    kunde: z.kunde,
    konfiguration: z.konfiguration,
    preis: z.preis,
    raum: z.raum ?? null,
    freierPlatz: z.freier_platz ?? null,
    wunschmasse: z.wunschmasse ?? null,
    referenz: z.referenz ?? null,
    tischPosition: z.tisch_position ?? null,
    passtInFreienPlatz: z.passt_in_freien_platz ?? null,
    kiInfo: z.ki_info ?? null,
    fotoUrl: urls.foto ?? null,
    kiBildUrl: urls.kiBild ?? null,
  };
}

/** Statuswechsel prüfen. Ablehnen nur mit Begründung. */
export function pruefeStatus(status: unknown, grund: unknown): { status: Status; ablehnungsgrund: string | null } {
  if (!STATUS_WERTE.includes(status as Status)) throw new DatenFehler('Unbekannter Status.');
  const g = text(grund, 2000);
  if (status === 'abgelehnt' && g.length < 3) {
    throw new DatenFehler('Bitte geben Sie eine Begründung für die Ablehnung an.');
  }
  return { status: status as Status, ablehnungsgrund: status === 'abgelehnt' ? g : null };
}

/** data:image/jpeg;base64,… → { bytes, mimeType }; null bei leerem Wert. */
export function bildAusDataUrl(dataUrl: unknown, maxBytes = 10 * 1024 * 1024) {
  if (dataUrl == null || dataUrl === '') return null;
  if (typeof dataUrl !== 'string') throw new DatenFehler('Ungültiges Bild.');
  const treffer = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!treffer) throw new DatenFehler('Ungültiges Bildformat.');
  const binaer = atob(treffer[2]);
  if (binaer.length > maxBytes) throw new DatenFehler('Das Bild ist zu groß.');
  const bytes = new Uint8Array(binaer.length);
  for (let i = 0; i < binaer.length; i++) bytes[i] = binaer.charCodeAt(i);
  return { bytes, mimeType: treffer[1] };
}
