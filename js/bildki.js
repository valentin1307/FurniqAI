// Bild-KI (Schritt 4): Aufruf der Edge Function render-table.
// Oben reine Funktionen (testbar mit Node), unten Funktionen mit Canvas/Fetch für den Browser.
import { rufeFunction, ApiFehler } from './supabase.js';

/** Kennung der Angaben, aus denen ein KI-Bild entstanden ist. Ändert sie sich, ist das Bild veraltet. */
export function kiSignatur(z) {
  const einMass = z.form === 'quadratisch' || z.form === 'rund';
  return JSON.stringify([
    z.form,
    z.materialId,
    z.laenge,
    einMass ? z.laenge : z.breite,
    z.hoehe,
    z.gestellId,
    z.oberflaecheId,
    z.referenz?.p1,
    z.referenz?.p2,
    z.referenz?.laengeCm,
    z.tischPosition,
    [...(z.optionIds || [])].sort(),
    (z.sonderwuensche || []).map((s) => s.beschreibung),
  ]);
}

/** Passen die Seitenverhältnisse von Eingabe und Ergebnis zusammen (Abweichung ≤ toleranz)? */
export function seitenverhaeltnisPasst(eingabe, ergebnis, toleranz = 0.02) {
  const a = eingabe.breite / eingabe.hoehe;
  const b = ergebnis.breite / ergebnis.hoehe;
  return Math.abs(a - b) / a <= toleranz;
}

// ---------- Browser ----------

function bildLaden(url) {
  return new Promise((ok, fehler) => {
    const bild = new Image();
    bild.onload = () => ok(bild);
    bild.onerror = () => fehler(new Error('Bild konnte nicht geladen werden'));
    bild.src = url;
  });
}

/**
 * Kopie des Fotos mit roter Referenzlinie und Tischmarke (nur Orientierung für die KI).
 * Rückgabe: { daten (data-URL JPEG), breite, hoehe } – Breite/Höhe des Originalfotos.
 */
export async function markiertesFoto(fotoUrl, referenz, tischPosition) {
  const bild = await bildLaden(fotoUrl);
  const w = bild.naturalWidth;
  const h = bild.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bild, 0, 0);

  const s = Math.max(w, h) / 1000; // Strichstärke passend zur Bildgröße
  const rot = '#ff1a1a';
  const px = (p) => [p.x * w, p.y * h];
  ctx.strokeStyle = rot;
  ctx.fillStyle = rot;
  ctx.lineCap = 'round';

  // Referenz: Linie mit zwei Punkten
  const [x1, y1] = px(referenz.p1);
  const [x2, y2] = px(referenz.p2);
  ctx.lineWidth = 5 * s;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  for (const [x, y] of [[x1, y1], [x2, y2]]) {
    ctx.beginPath();
    ctx.arc(x, y, 10 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tischposition: Ring mit Kreuz
  const [tx, ty] = px(tischPosition);
  const r = 26 * s;
  ctx.lineWidth = 6 * s;
  ctx.beginPath();
  ctx.arc(tx, ty, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(tx - r * 0.6, ty - r * 0.6);
  ctx.lineTo(tx + r * 0.6, ty + r * 0.6);
  ctx.moveTo(tx + r * 0.6, ty - r * 0.6);
  ctx.lineTo(tx - r * 0.6, ty + r * 0.6);
  ctx.stroke();

  return { daten: canvas.toDataURL('image/jpeg', 0.85), breite: w, hoehe: h };
}

/** Ergebnis als JPEG speichern (spart Platz im Speicher), Größe messen. */
export async function alsJpeg(dataUrl, qualitaet = 0.88) {
  const bild = await bildLaden(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = bild.naturalWidth;
  canvas.height = bild.naturalHeight;
  canvas.getContext('2d').drawImage(bild, 0, 0);
  return { daten: canvas.toDataURL('image/jpeg', qualitaet), breite: canvas.width, hoehe: canvas.height };
}

/**
 * Bild bei der Edge Function anfordern.
 * eingabe: { foto, fotoMarkiert, fotoBreite, fotoHoehe, referenz, tischPosition, tisch }
 * Rückgabe: Antwort der Function { bild, mimeType, modell, dauerMs, seitenverhaeltnis }
 */
export async function bildAnfordern(eingabe, signal) {
  const daten = await rufeFunction('render-table', eingabe, { signal, wer: 'Die Bild-KI' });
  if (!daten.bild) throw new ApiFehler('Die Bild-KI hat kein Bild zurückgegeben. Bitte erzeugen Sie das Bild neu.', 'kein_bild');
  return daten;
}
