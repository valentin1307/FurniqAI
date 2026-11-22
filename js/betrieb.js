// Demo-Betrieb: alle Werte sind Platzhalter-Annahmen (siehe FurniqAI.md, „Preislogik“).
// Sie werden später durch Umfragewerte ersetzt und dürfen in der UI nicht als
// echte Preise eines Betriebs ausgegeben werden.

export const BETRIEB = {
  name: 'Demo-Tischlerei',
  claim: 'Möbel nach Maß',
  // Optional: Pfad zum Logo, z. B. 'assets/logo.svg'. Ohne Logo erscheint ein Monogramm.
  logo: null,
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

  // Kommen ab dem Feinschliff-Chat (Schritt 3) dazu.
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
