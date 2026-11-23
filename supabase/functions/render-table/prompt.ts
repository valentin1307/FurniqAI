// Prompt für die Bild-KI nach der Vorlage in FurniqAI.md, plus Hinweise zu Bild 2 (Markierungen).
// Reine Funktionen ohne Deno-Globals, damit sie mit Node getestet werden können.

export interface TischParameter {
  form: string; // rechteckig | quadratisch | rund | oval
  laenge: number;
  breite: number;
  hoehe: number;
  materialId: string;
  gestellId: string;
  oberflaecheId: string;
  namen: { form: string; material: string; gestell: string; oberflaeche: string };
  promptZusatz?: string;
}

// Englische Beschreibungen für die bekannten IDs; unbekannte (vom Betrieb geänderte) nutzen den Namen.
const MATERIAL_EN: Record<string, string> = {
  'eiche-massiv': 'solid oak wood',
  'nuss-massiv': 'solid walnut wood',
  'esche-massiv': 'solid ash wood',
  'eiche-furniert': 'oak veneer',
  'mdf-lackiert': 'lacquered MDF with a smooth, grainless surface',
};
const GESTELL_EN: Record<string, string> = {
  holz: 'four straight wooden legs in the same wood as the top',
  'stahl-schwarz': 'black powder-coated steel legs',
  'kufen-stahl': 'black steel sled base (two closed rectangular steel runners)',
};
const OBERFLAECHE_EN: Record<string, string> = {
  geoelt: 'natural oiled finish',
  'lackiert-matt': 'matte lacquer finish',
  gebeizt: 'stained finish',
};

function formText(p: TischParameter): string {
  switch (p.form) {
    case 'rund':
      return `round, ${p.laenge} cm in diameter`;
    case 'quadratisch':
      return `square, ${p.laenge} × ${p.laenge} cm`;
    case 'oval':
      return `oval, ${p.laenge} cm long, ${p.breite} cm deep`;
    default:
      return `rectangular, ${p.laenge} cm long, ${p.breite} cm deep`;
  }
}

const mitName = (en: string | undefined, name: string) => (en ? `${en} ("${name}")` : `"${name}"`);

export function bauePrompt(p: TischParameter, referenzCm: number): string {
  const material = mitName(MATERIAL_EN[p.materialId], p.namen.material);
  const gestell = mitName(GESTELL_EN[p.gestellId], p.namen.gestell);
  const oberflaeche = mitName(OBERFLAECHE_EN[p.oberflaecheId], p.namen.oberflaeche);
  // Extras aus dem Feinschliff-Chat (englisch), gekürzt
  const zusatz = typeof p.promptZusatz === 'string' && p.promptZusatz.trim() ? ` ${p.promptZusatz.trim().slice(0, 1500)}` : '';

  return [
    'Image 2 is a copy of image 1 with red guide markings: a red line between two red dots marks the reference object,',
    'and a red ring with a cross marks the spot where the table goes. Use image 2 only to find the scale and the spot.',
    '',
    `Insert a coffee table into image 1. The marked reference object is ${referenzCm} cm wide; use it for scale.`,
    `Table: ${formText(p)}, ${p.hoehe} cm high, top made of ${material}, ${oberflaeche}, base: ${gestell}.${zusatz}`,
    'Place it at the marked spot, parallel to the sofa.',
    'Keep the room, lighting, camera angle, image framing and every other object exactly as they are.',
    'Return the complete edited image 1 with exactly the same framing and aspect ratio.',
    'The result must not contain any red markings, lines, dots, rings, crosses or text. Photorealistic.',
  ].join('\n');
}

// Seitenverhältnisse, die Gemini für Bilder annimmt
const VERHAELTNISSE = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];

/** Nächstliegendes unterstütztes Seitenverhältnis zu Breite × Höhe. */
export function naechstesSeitenverhaeltnis(breite: number, hoehe: number): string {
  const ziel = Math.log(breite / hoehe);
  let bestes = '1:1';
  let abstand = Infinity;
  for (const v of VERHAELTNISSE) {
    const [w, h] = v.split(':').map(Number);
    const d = Math.abs(Math.log(w / h) - ziel);
    if (d < abstand) {
      abstand = d;
      bestes = v;
    }
  }
  return bestes;
}
