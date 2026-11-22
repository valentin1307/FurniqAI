// Preisrechnung und Maßgrenzen. Reine Funktionen ohne DOM, damit testbar.
//
// Preis inkl. MwSt. = Grundpreis + Tischfläche (m²) × Materialpreis/m²
//                     + Gestell + Oberfläche + Optionen

// Formen mit nur einem Maß (Seitenlänge bzw. Durchmesser): Länge = Breite.
export const EIN_MASS_FORMEN = ['quadratisch', 'rund'];

export function istEinMassForm(form) {
  return EIN_MASS_FORMEN.includes(form);
}

/** Tischfläche in m². Maße in cm. */
export function flaecheQm(form, laenge, breite) {
  const l = laenge / 100;
  const b = breite / 100;
  switch (form) {
    case 'rechteckig':
      return l * b;
    case 'quadratisch':
      return l * l;
    case 'rund':
      return Math.PI * (l / 2) ** 2;
    case 'oval':
      return Math.PI * (l / 2) * (b / 2);
    default:
      throw new Error(`Unbekannte Form: ${form}`);
  }
}

/**
 * Erlaubte Maße für eine Form: Grenzen des Betriebs, zusätzlich begrenzt
 * durch den freien Platz (Länge × Breite in cm).
 * Rückgabe: { laenge:{min,max}, breite:{min,max}, hoehe:{min,max}, passt }
 * Bei quadratisch/rund gilt laenge = breite = Seitenlänge/Durchmesser.
 */
export function masseGrenzen(betrieb, form, freiLaenge, freiBreite) {
  const g = betrieb.grenzen;
  const fL = Number.isFinite(freiLaenge) ? freiLaenge : Infinity;
  const fB = Number.isFinite(freiBreite) ? freiBreite : Infinity;

  let laenge;
  let breite;
  if (istEinMassForm(form)) {
    const min = Math.max(g.laenge.min, g.breite.min);
    const max = Math.min(g.laenge.max, g.breite.max, fL, fB);
    laenge = { min, max };
    breite = { min, max };
  } else {
    laenge = { min: g.laenge.min, max: Math.min(g.laenge.max, fL) };
    breite = { min: g.breite.min, max: Math.min(g.breite.max, fB) };
  }
  const passt = laenge.min <= laenge.max && breite.min <= breite.max;
  return { laenge, breite, hoehe: { ...g.hoehe }, passt };
}

/**
 * Wie weit der Tisch über den freien Platz hinausragt (cm, je Richtung).
 * Der freie Platz begrenzt die Maße nicht, er führt nur zu einem Hinweis.
 * Rückgabe: { laenge, breite, passt }. Ohne freien Platz: passt = true.
 */
export function ueberstand(form, laenge, breite, freiLaenge, freiBreite) {
  const b = istEinMassForm(form) ? laenge : breite;
  const l = Number.isFinite(freiLaenge) ? Math.max(0, laenge - freiLaenge) : 0;
  const q = Number.isFinite(freiBreite) ? Math.max(0, b - freiBreite) : 0;
  return { laenge: l, breite: q, passt: l === 0 && q === 0 };
}

/** Wert auf [min, max] begrenzen. */
export function begrenze(wert, { min, max }) {
  return Math.min(max, Math.max(min, wert));
}

/**
 * Konfiguration an Betrieb und freien Platz anpassen.
 * - Passt die Form nicht, wird die erste passende Form des Betriebs gewählt.
 * - Länge, Breite und Höhe werden auf die erlaubten Maße begrenzt.
 * - Bei quadratisch/rund gilt danach breite = laenge.
 * Gibt eine neue Konfiguration zurück, die Eingabe bleibt unverändert.
 */
export function passeKonfigurationEin(konfig, betrieb, freiLaenge, freiBreite) {
  const grenzenFuer = (form) => masseGrenzen(betrieb, form, freiLaenge, freiBreite);
  let form = konfig.form;
  if (!grenzenFuer(form).passt) {
    form = betrieb.formen.map((f) => f.id).find((id) => grenzenFuer(id).passt) ?? form;
  }
  const g = grenzenFuer(form);
  const laenge = begrenze(konfig.laenge, g.laenge);
  const breite = istEinMassForm(form) ? laenge : begrenze(konfig.breite, g.breite);
  const hoehe = begrenze(konfig.hoehe, g.hoehe);
  return { ...konfig, form, laenge, breite, hoehe };
}

function finde(liste, id, art) {
  const eintrag = liste.find((e) => e.id === id);
  if (!eintrag) throw new Error(`Unbekannte ${art}: ${id}`);
  return eintrag;
}

/**
 * Kostenvoranschlag berechnen.
 * konfig: { form, laenge, breite, hoehe, materialId, gestellId, oberflaecheId,
 *           optionIds?: string[], sonderwuensche?: { beschreibung }[] }
 * Rückgabe: { positionen:[{bezeichnung, detail, betrag}], summe,
 *             rahmen:{von, bis}, sonderwuensche:[…], flaeche }
 */
export function berechnePreis(konfig, betrieb) {
  const breite = istEinMassForm(konfig.form) ? konfig.laenge : konfig.breite;
  const flaeche = flaecheQm(konfig.form, konfig.laenge, breite);
  const material = finde(betrieb.materialien, konfig.materialId, 'Material');
  const gestell = finde(betrieb.gestelle, konfig.gestellId, 'Gestell');
  const oberflaeche = finde(betrieb.oberflaechen, konfig.oberflaecheId, 'Oberfläche');
  const optionen = (konfig.optionIds || []).map((id) => finde(betrieb.optionen, id, 'Option'));

  const positionen = [
    {
      bezeichnung: 'Grundpreis',
      detail: 'Arbeit, Standard-Gestell Holz',
      betrag: betrieb.grundpreis,
    },
    {
      bezeichnung: `Tischplatte ${material.name}`,
      detail: `${formatZahl(flaeche, 2)} m² × ${formatEuro(material.preisProQm)}/m²`,
      betrag: Math.round(flaeche * material.preisProQm),
    },
    {
      bezeichnung: `Gestell ${gestell.name}`,
      detail: gestell.preis === 0 ? 'im Grundpreis enthalten' : 'Aufpreis',
      betrag: gestell.preis,
    },
    {
      bezeichnung: `Oberfläche ${oberflaeche.name}`,
      detail: oberflaeche.preis === 0 ? 'im Grundpreis enthalten' : 'Aufpreis',
      betrag: oberflaeche.preis,
    },
    ...optionen.map((o) => ({ bezeichnung: o.name, detail: 'Option', betrag: o.preis })),
  ];

  const summe = positionen.reduce((s, p) => s + p.betrag, 0);
  const faktor = betrieb.rahmenProzent / 100;
  const rahmen = {
    von: Math.floor((summe * (1 - faktor)) / 10) * 10,
    bis: Math.ceil((summe * (1 + faktor)) / 10) * 10,
  };

  return {
    positionen,
    summe,
    rahmen,
    sonderwuensche: konfig.sonderwuensche || [],
    flaeche,
  };
}

export function formatEuro(betrag) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(betrag);
}

export function formatZahl(zahl, stellen = 0) {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: stellen,
    maximumFractionDigits: stellen,
  }).format(zahl);
}
