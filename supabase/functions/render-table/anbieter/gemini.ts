// Anbieter Google Gemini (Bildmodell, z. B. gemini-3.1-flash-image-preview).
// Ohne Deno-Globals, damit die Auswertung auch mit Node getestet werden kann.
import { type BildAnbieter, type BildEingabe, type BildErgebnis, fehler, AnbieterFehler } from './typ.ts';

const API = 'https://generativelanguage.googleapis.com/v1beta';

// Gründe, aus denen Gemini ein Bild wegen Inhaltsregeln verweigert
const FILTER_GRUENDE = [
  'SAFETY',
  'IMAGE_SAFETY',
  'PROHIBITED_CONTENT',
  'IMAGE_PROHIBITED_CONTENT',
  'BLOCKLIST',
  'SPII',
  'RECITATION',
  'IMAGE_RECITATION',
];

/** HTTP-Fehler der Gemini-API einordnen. */
export function ordneHttpFehlerEin(status: number, text: string, modell: string): AnbieterFehler {
  const t = text.toLowerCase();
  const detail = `HTTP ${status}: ${text.slice(0, 500)}`;
  if (status === 402 || t.includes('billing') || t.includes('credits are depleted') || t.includes('limit: 0') || t.includes('free_tier') || t.includes('free tier')) {
    return fehler('abrechnung', detail);
  }
  if (status === 429) return fehler('kontingent', detail);
  if (t.includes('api_key_invalid') || t.includes('api key not valid') || status === 401 || status === 403) {
    return fehler('schluessel', detail);
  }
  if (status === 404 || (t.includes('model') && t.includes('not found'))) {
    return fehler('modell', detail, `Das Bildmodell „${modell}“ ist nicht verfügbar. Bitte GEMINI_MODEL prüfen.`);
  }
  if (t.includes('failed_precondition')) return fehler('abrechnung', detail);
  if (status === 504 || t.includes('deadline')) return fehler('zeit', detail);
  return fehler('unbekannt', detail);
}

// deno-lint-ignore no-explicit-any
type Antwort = any;

/** Erfolgreiche HTTP-Antwort auswerten: Bild herausholen oder passenden Fehler werfen. */
export function werteAntwortAus(json: Antwort, modell: string): BildErgebnis {
  const block = json?.promptFeedback?.blockReason;
  if (block) throw fehler('filter', `promptFeedback.blockReason=${block}`);

  const kandidat = json?.candidates?.[0];
  const teile: Antwort[] = kandidat?.content?.parts ?? [];
  const bildTeil = teile.find((t) => t?.inlineData?.data || t?.inline_data?.data);
  const text = teile
    .map((t) => t?.text)
    .filter(Boolean)
    .join(' ')
    .trim();

  if (bildTeil) {
    const daten = bildTeil.inlineData ?? bildTeil.inline_data;
    return {
      bild: daten.data,
      mimeType: daten.mimeType ?? daten.mime_type ?? 'image/png',
      modell,
      text: text || undefined,
    };
  }
  const grund = kandidat?.finishReason;
  if (grund && FILTER_GRUENDE.includes(grund)) throw fehler('filter', `finishReason=${grund} ${text}`.trim());
  throw fehler('kein_bild', `finishReason=${grund ?? '–'} ${text}`.trim());
}

export class GeminiAnbieter implements BildAnbieter {
  name = 'gemini';
  modell: string;
  private schluessel: string;

  constructor(schluessel: string, modell: string) {
    this.schluessel = schluessel;
    this.modell = modell;
  }

  async erzeuge(e: BildEingabe, signal: AbortSignal): Promise<BildErgebnis> {
    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'Image 1 (the photo to edit):' },
            { inlineData: { mimeType: e.mimeType, data: e.foto } },
            { text: 'Image 2 (same photo with red guide markings, for orientation only, never reproduce them):' },
            { inlineData: { mimeType: e.mimeType, data: e.fotoMarkiert } },
            { text: e.prompt },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: e.seitenverhaeltnis },
      },
    };

    let antwort: Response;
    try {
      antwort = await fetch(`${API}/models/${encodeURIComponent(this.modell)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.schluessel },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      if (signal.aborted) throw fehler('zeit', String(err));
      throw fehler('unbekannt', String(err));
    }

    const text = await antwort.text().catch(() => '');
    if (!antwort.ok) throw ordneHttpFehlerEin(antwort.status, text, this.modell);
    let json: Antwort;
    try {
      json = JSON.parse(text);
    } catch {
      throw fehler('kein_bild', `Antwort ist kein JSON: ${text.slice(0, 200)}`);
    }
    return werteAntwortAus(json, this.modell);
  }

  async bildModelle(): Promise<string[]> {
    const antwort = await fetch(`${API}/models?pageSize=1000`, {
      headers: { 'x-goog-api-key': this.schluessel },
    });
    const text = await antwort.text();
    if (!antwort.ok) throw ordneHttpFehlerEin(antwort.status, text, this.modell);
    const json = JSON.parse(text);
    return (json.models ?? [])
      .filter((m: Antwort) => String(m.name).includes('image'))
      .filter((m: Antwort) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
      .map((m: Antwort) => String(m.name).replace(/^models\//, ''));
  }
}
