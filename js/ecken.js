/**
 * Abgerundete Ecken (Regler im Baukasten unter „Form“).
 * Reine Funktionen, damit sie ohne Browser getestet werden können.
 *
 * Der Radius hängt an der Option „ecken-abgerundet“ des Betriebs (fester Aufpreis):
 * Radius > 0 → Option an, Radius 0 → Option aus. Hat der Betrieb diese Option nicht,
 * wird nur der Radius gespeichert (ohne Aufpreis).
 */

export const ECKEN_OPTION = 'ecken-abgerundet';
export const ECKEN_STANDARD = 5; // cm, wenn die Option ohne Radius (z. B. aus dem Chat) dazukommt
const ECKEN_HOECHSTENS = 30; // cm

/** Nur eckige Formen haben Ecken. */
export function hatEcken(form) {
  return form === 'rechteckig' || form === 'quadratisch';
}

/** Größter sinnvoller Radius: halbe kurze Seite, höchstens 30 cm. */
export function maxEckenRadius(form, laenge, breite) {
  if (!hatEcken(form)) return 0;
  const kurz = form === 'quadratisch' ? laenge : Math.min(laenge, breite);
  return Math.max(0, Math.min(ECKEN_HOECHSTENS, Math.floor(kurz / 2)));
}

/** Satz für den Bild-Prompt (englisch, wie die übrigen Zusätze). */
export function eckenPrompt(radius) {
  return `The tabletop has rounded corners with a radius of about ${radius} cm.`;
}

/** Text für Zusammenfassung und Kostenvoranschlag. */
export function eckenText(radius) {
  return radius > 0 ? `Radius ${radius} cm` : 'eckig';
}

/**
 * Neuen Radius setzen. Gibt die geänderten Felder des Zustands zurück
 * (eckenRadius, optionIds, optionZusaetze), ohne den Zustand selbst zu ändern.
 */
export function eckenSetzen(z, betrieb, radius) {
  const r = Math.max(0, Math.min(maxEckenRadius(z.form, z.laenge, z.breite), Math.round(Number(radius) || 0)));
  const gibtOption = (betrieb.optionen || []).some((o) => o.id === ECKEN_OPTION);
  let optionIds = (z.optionIds || []).filter((id) => id !== ECKEN_OPTION);
  const optionZusaetze = { ...(z.optionZusaetze || {}) };
  delete optionZusaetze[ECKEN_OPTION];
  if (r > 0 && gibtOption) {
    optionIds = [...optionIds, ECKEN_OPTION];
    optionZusaetze[ECKEN_OPTION] = eckenPrompt(r);
  }
  return { eckenRadius: r, optionIds, optionZusaetze };
}

/**
 * Radius und Option in Einklang bringen, nachdem sich Form, Maße oder Extras geändert haben
 * (z. B. Option im Chat hinzugefügt oder in der Extras-Liste entfernt).
 */
export function eckenAbgleichen(z, betrieb) {
  const gibtOption = (betrieb.optionen || []).some((o) => o.id === ECKEN_OPTION);
  const optionAn = (z.optionIds || []).includes(ECKEN_OPTION);
  let radius = z.eckenRadius || 0;
  if (!hatEcken(z.form)) radius = 0;
  else if (gibtOption && optionAn && radius === 0) radius = ECKEN_STANDARD;
  else if (gibtOption && !optionAn) radius = 0;
  return eckenSetzen(z, betrieb, radius);
}
