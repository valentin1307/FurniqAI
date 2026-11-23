// Demo-Betrieb: alle Werte sind Platzhalter-Annahmen (siehe FurniqAI.md, „Preislogik“).
// Sie werden später durch Umfragewerte ersetzt und dürfen in der UI nicht als
// echte Preise eines Betriebs ausgegeben werden.

export const BETRIEB_STANDARD = {
  name: 'Demo-Tischlerei',
  claim: 'Möbel nach Maß',
  // Optional: Pfad zum Logo, z. B. 'assets/logo.svg'. Ohne Logo erscheint ein Monogramm.
  logo: null,
  // Optional: Akzentfarbe des Betriebs (CSS-Farbe, z. B. '#3d5a40'). Ohne Angabe gilt das Holzbraun.
  // Weiße Schrift muss darauf mindestens 4.5:1 Kontrast haben, also eher dunkle Töne wählen.
  akzent: null,
  moebelart: 'Couchtisch',

  // Arbeit inkl. Standard-Gestell Holz
  grundpreis: 650,

  // Preisrahmen im Kostenvoranschlag: ± Prozent um die Schätzung
  rahmenProzent: 15,

  formen: [
    { id: 'rechteckig', name: 'Rechteckig' },
    { id: 'quadratisch', name: 'Quadratisch' },
    { id: 'rund', name: 'Rund' },
    { id: 'oval', name: 'Oval' },
  ],

  // Materialarten: Gruppen für die Materialien. Einträge ohne „art“ gehören zu Holz.
  // Stein, Stahl und Glas sind leer, bis die Tischlerei eigene Materialien anlegt.
  materialarten: [
    { id: 'holz', name: 'Holz' },
    { id: 'stein', name: 'Stein' },
    { id: 'stahl', name: 'Stahl' },
    { id: 'glas', name: 'Glas' },
  ],

  // Preis je m² Tischplatte
  materialien: [
    { id: 'eiche-massiv', name: 'Eiche massiv', preisProQm: 900 },
    { id: 'nuss-massiv', name: 'Nuss massiv', preisProQm: 1300 },
    { id: 'esche-massiv', name: 'Esche massiv', preisProQm: 800 },
    { id: 'eiche-furniert', name: 'Eiche furniert', preisProQm: 450 },
    { id: 'mdf-lackiert', name: 'MDF lackiert', preisProQm: 300 },
  ],

  gestelle: [
    { id: 'holz', name: 'Holz', preis: 0 },
    { id: 'stahl-schwarz', name: 'Stahl schwarz, pulverbeschichtet', preis: 250 },
    { id: 'kufen-stahl', name: 'Kufen Stahl', preis: 320 },
  ],

  oberflaechen: [
    { id: 'geoelt', name: 'geölt', preis: 0 },
    { id: 'lackiert-matt', name: 'lackiert matt', preis: 80 },
    { id: 'gebeizt', name: 'gebeizt', preis: 120 },
  ],

  // Fügt der Feinschliff-Chat im Baukasten hinzu, wenn die Kundin oder der Kunde sie wünscht.
  optionen: [
    { id: 'ecken-abgerundet', name: 'Abgerundete Ecken', preis: 60 },
    { id: 'kante-gefast', name: 'Kantenprofil gefast', preis: 90 },
    { id: 'ablage-unten', name: 'Ablage unten', preis: 220 },
    { id: 'schublade', name: 'Schublade', preis: 280 },
  ],

  // Maßgrenzen in cm
  grenzen: {
    laenge: { min: 60, max: 180 },
    breite: { min: 50, max: 100 },
    hoehe: { min: 30, max: 50 },
  },
};

// ---------- Einstellungen der Tischlerseite ----------
// Für die Demo werden Änderungen nur im Browser gespeichert (FurniqAI.md: „Lesen und Bearbeiten
// von betrieb.js-Daten im Browser“). Kunden- und Tischlerseite im selben Browser teilen sie.

export const EINSTELLUNGEN_SCHLUESSEL = 'furniqai.betrieb';
const LISTEN = { materialien: 'preisProQm', gestelle: 'preis', oberflaechen: 'preis', optionen: 'preis' };

const zahl = (w) => typeof w === 'number' && Number.isFinite(w);
const textOk = (t) => typeof t === 'string' && t.trim().length > 0 && t.trim().length <= 80;
// IDs für eigene Einträge der Tischlerei (siehe neueId)
const ID_MUSTER = /^[a-z0-9][a-z0-9-]{0,60}$/;

/** Materialart eines Materials; ältere Einträge ohne Angabe sind Holz. */
export const materialArt = (m) => m?.art || 'holz';

/** Neue, eindeutige ID für einen eigenen Eintrag, z. B. 'eigen-marmor-carrara'. */
export function neueId(name, vorhandeneIds) {
  const slug = String(name || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const basis = `eigen-${slug || 'eintrag'}`;
  const ids = new Set(vorhandeneIds);
  let id = basis;
  for (let n = 2; ids.has(id); n++) id = `${basis}-${n}`;
  return id;
}

/**
 * Gespeicherte Änderungen über den Standard legen. Übernommen werden bekannte Einträge (per id)
 * mit gültigen Werten und von der Tischlerei angelegte Einträge (eigen: true, gültige id, Name
 * und Preis). Alles andere wird ignoriert und bleibt Standard.
 */
export function mischeBetrieb(standard, aenderungen) {
  const b = structuredClone(standard);
  if (!aenderungen || typeof aenderungen !== 'object') return b;
  for (const feld of ['grundpreis', 'rahmenProzent']) if (zahl(aenderungen[feld])) b[feld] = aenderungen[feld];
  for (const neu of aenderungen.materialarten || []) {
    const art = b.materialarten.find((a) => a.id === neu?.id);
    if (art) {
      if (textOk(neu.name)) art.name = neu.name.trim();
    } else if (neu?.eigen === true && ID_MUSTER.test(String(neu.id)) && textOk(neu.name)) {
      b.materialarten.push({ id: neu.id, name: neu.name.trim(), eigen: true });
    }
  }
  for (const [liste, preisFeld] of Object.entries(LISTEN)) {
    for (const neu of aenderungen[liste] || []) {
      const eintrag = b[liste].find((e) => e.id === neu?.id);
      if (!eintrag) {
        // eigener Eintrag der Tischlerei
        if (neu?.eigen !== true || !ID_MUSTER.test(String(neu.id)) || !textOk(neu.name) || !zahl(neu[preisFeld])) continue;
        const e = { id: neu.id, name: neu.name.trim(), [preisFeld]: neu[preisFeld], eigen: true };
        if (liste === 'materialien') {
          if (!b.materialarten.some((a) => a.id === neu.art)) continue;
          e.art = neu.art;
        }
        b[liste].push(e);
        continue;
      }
      if (typeof neu.name === 'string' && neu.name.trim()) eintrag.name = neu.name.trim();
      if (zahl(neu[preisFeld])) eintrag[preisFeld] = neu[preisFeld];
    }
  }
  for (const mass of ['laenge', 'breite', 'hoehe']) {
    const g = aenderungen.grenzen?.[mass];
    if (zahl(g?.min) && zahl(g?.max)) b.grenzen[mass] = { min: g.min, max: g.max };
  }
  return b;
}

/** Fehlerliste (deutsch) für bearbeitete Betriebsdaten; leer, wenn alles passt. */
export function pruefeBetrieb(b) {
  const fehler = [];
  if (!zahl(b.grundpreis) || b.grundpreis < 0) fehler.push('Der Grundpreis muss 0 oder mehr sein.');
  if (!zahl(b.rahmenProzent) || b.rahmenProzent < 0 || b.rahmenProzent > 50) {
    fehler.push('Der Preisrahmen muss zwischen 0 und 50 % liegen.');
  }
  for (const a of b.materialarten || []) {
    if (!a.name || !a.name.trim()) fehler.push('Materialart: Der Name darf nicht leer sein.');
  }
  const titel = { materialien: 'Material', gestelle: 'Gestell', oberflaechen: 'Oberfläche', optionen: 'Option' };
  for (const [liste, preisFeld] of Object.entries(LISTEN)) {
    for (const e of b[liste]) {
      if (!e.name || !e.name.trim()) fehler.push(`${titel[liste]}: Der Name darf nicht leer sein.`);
      if (!zahl(e[preisFeld]) || e[preisFeld] < 0) {
        fehler.push(`${titel[liste]} „${(e.name || '').trim() || 'ohne Namen'}“: Der Preis muss 0 oder mehr sein.`);
      }
      if (liste === 'materialien' && b.materialarten && !b.materialarten.some((a) => a.id === materialArt(e))) {
        fehler.push(`Material „${e.name}“: Die Materialart fehlt.`);
      }
    }
  }
  const namen = { laenge: 'Länge', breite: 'Breite', hoehe: 'Höhe' };
  for (const [mass, n] of Object.entries(namen)) {
    const g = b.grenzen[mass];
    if (!zahl(g.min) || !zahl(g.max) || g.min <= 0) fehler.push(`${n}: Bitte gültige Grenzen in cm angeben.`);
    else if (g.min >= g.max) fehler.push(`${n}: Das Minimum muss kleiner als das Maximum sein.`);
  }
  return fehler;
}

/** Nur die bearbeitbaren Werte, so wie sie gespeichert werden. */
export function bearbeitbareWerte(b) {
  const werte = { grundpreis: b.grundpreis, rahmenProzent: b.rahmenProzent, grenzen: structuredClone(b.grenzen) };
  werte.materialarten = b.materialarten.map((a) => ({ id: a.id, name: a.name, ...(a.eigen ? { eigen: true } : {}) }));
  for (const [liste, preisFeld] of Object.entries(LISTEN)) {
    werte[liste] = b[liste].map((e) => ({
      id: e.id,
      name: e.name,
      [preisFeld]: e[preisFeld],
      ...(e.art ? { art: e.art } : {}),
      ...(e.eigen ? { eigen: true } : {}),
    }));
  }
  return werte;
}

function gespeicherteAenderungen() {
  try {
    const roh = globalThis.localStorage?.getItem(EINSTELLUNGEN_SCHLUESSEL);
    return roh ? JSON.parse(roh) : null;
  } catch {
    return null;
  }
}

/** Betrieb mit den im Browser gespeicherten Einstellungen (in Node/Tests: Standard). */
export const BETRIEB = mischeBetrieb(BETRIEB_STANDARD, gespeicherteAenderungen());

/** Einstellungen speichern. Gibt false zurück, wenn der Browser-Speicher gesperrt ist. */
export function einstellungenSpeichern(b) {
  try {
    globalThis.localStorage.setItem(EINSTELLUNGEN_SCHLUESSEL, JSON.stringify(bearbeitbareWerte(b)));
    return true;
  } catch {
    return false;
  }
}

export function einstellungenZuruecksetzen() {
  try {
    globalThis.localStorage.removeItem(EINSTELLUNGEN_SCHLUESSEL);
  } catch {
    // nichts zu tun
  }
}
