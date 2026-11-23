// Referenzmarkierung auf dem Raumfoto. Reine Funktionen ohne DOM, damit testbar.
// Koordinaten sind normiert: x, y jeweils 0–1 relativ zu Bildbreite und -höhe.

export const REFERENZ_VORSCHLAG_CM = 220;
export const REFERENZ_GRENZEN = { min: 20, max: 1000 };
// Mindestabstand der beiden Referenzpunkte (normiert), damit der Maßstab brauchbar ist
export const MIN_ABSTAND = 0.03;

/**
 * Bildschirmposition → normierte Bildkoordinate, auf 0–1 begrenzt, 4 Nachkommastellen.
 * null, solange das Bild noch keine Größe hat (z. B. noch nicht geladen).
 */
export function normiere(clientX, clientY, rect) {
  if (!(rect?.width > 0) || !(rect?.height > 0)) return null;
  const runde = (w) => Math.round(Math.min(1, Math.max(0, w)) * 10000) / 10000;
  return {
    x: runde((clientX - rect.left) / rect.width),
    y: runde((clientY - rect.top) / rect.height),
  };
}

export function abstand(p, q) {
  return Math.hypot(p.x - q.x, p.y - q.y);
}

/** Welcher Punkt als Nächstes gesetzt wird: 'ref1' | 'ref2' | 'tisch' | 'fertig'. */
export function markierungsPhase(referenz, tischPosition) {
  if (!referenz?.p1) return 'ref1';
  if (!referenz.p2) return 'ref2';
  if (!tischPosition) return 'tisch';
  return 'fertig';
}

/** Fehlermeldung, wenn die Markierung unvollständig oder unbrauchbar ist, sonst null. */
export function pruefeMarkierung(referenz, tischPosition) {
  if (!referenz?.p1 || !referenz.p2) {
    return 'Bitte tippen Sie auf dem Foto auf beide Enden eines Gegenstands, dessen Länge Sie kennen, z. B. das Sofa.';
  }
  if (abstand(referenz.p1, referenz.p2) < MIN_ABSTAND) {
    return 'Die beiden Punkte liegen zu nah beieinander. Bitte markieren Sie die Enden des Gegenstands neu.';
  }
  const l = referenz.laengeCm;
  if (!Number.isFinite(l) || l < REFERENZ_GRENZEN.min || l > REFERENZ_GRENZEN.max) {
    return `Bitte geben Sie die Länge des markierten Gegenstands in cm an (${REFERENZ_GRENZEN.min}–${REFERENZ_GRENZEN.max} cm).`;
  }
  if (!tischPosition) {
    return 'Bitte tippen Sie auf dem Foto an, wo der Tisch stehen soll.';
  }
  return null;
}
