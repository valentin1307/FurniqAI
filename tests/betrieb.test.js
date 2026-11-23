// Tests für die Einstellungen der Tischlerseite (Betriebsdaten bearbeiten).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BETRIEB, BETRIEB_STANDARD, mischeBetrieb, pruefeBetrieb, bearbeitbareWerte, materialArt, neueId } from '../js/betrieb.js';

test('Ohne gespeicherte Einstellungen gilt der Standard', () => {
  assert.deepEqual(BETRIEB, BETRIEB_STANDARD);
  assert.notEqual(BETRIEB, BETRIEB_STANDARD, 'Kopie, nicht dasselbe Objekt');
});

test('Gespeicherte Werte werden übernommen, Unbekanntes und Ungültiges ignoriert', () => {
  const b = mischeBetrieb(BETRIEB_STANDARD, {
    grundpreis: 700,
    rahmenProzent: 'viel',
    materialien: [{ id: 'eiche-massiv', name: ' Eiche Wildholz ', preisProQm: 950 }, { id: 'gibts-nicht', preisProQm: 1 }],
    optionen: [{ id: 'schublade', preis: 300 }],
    grenzen: { laenge: { min: 70, max: 200 }, hoehe: { min: 'x', max: 60 } },
  });
  assert.equal(b.grundpreis, 700);
  assert.equal(b.rahmenProzent, 15);
  assert.deepEqual(b.materialien[0], { id: 'eiche-massiv', name: 'Eiche Wildholz', preisProQm: 950 });
  assert.equal(b.materialien.length, 5);
  assert.equal(b.optionen.find((o) => o.id === 'schublade').preis, 300);
  assert.deepEqual(b.grenzen.laenge, { min: 70, max: 200 });
  assert.deepEqual(b.grenzen.hoehe, { min: 30, max: 50 });
  assert.equal(BETRIEB_STANDARD.grundpreis, 650, 'Standard bleibt unverändert');
});

test('Prüfung der Einstellungen', () => {
  assert.deepEqual(pruefeBetrieb(BETRIEB_STANDARD), []);
  const kaputt = structuredClone(BETRIEB_STANDARD);
  kaputt.grundpreis = -1;
  kaputt.materialien[1].preisProQm = NaN;
  kaputt.gestelle[0].name = ' ';
  kaputt.grenzen.breite = { min: 100, max: 50 };
  const f = pruefeBetrieb(kaputt);
  assert.equal(f.length, 4);
  assert.match(f.join(' | '), /Grundpreis.*Nuss massiv.*Gestell: Der Name.*Breite: Das Minimum/);
});

test('Gespeichert werden nur bearbeitbare Werte', () => {
  const w = bearbeitbareWerte(BETRIEB_STANDARD);
  assert.deepEqual(Object.keys(w).sort(), ['gestelle', 'grenzen', 'grundpreis', 'materialarten', 'materialien', 'oberflaechen', 'optionen', 'rahmenProzent']);
  assert.deepEqual(mischeBetrieb(BETRIEB_STANDARD, w), BETRIEB_STANDARD);
});

test('Materialarten: Standard, Umbenennen, eigene Art', () => {
  assert.deepEqual(BETRIEB_STANDARD.materialarten.map((a) => a.id), ['holz', 'stein', 'stahl', 'glas']);
  assert.equal(materialArt(BETRIEB_STANDARD.materialien[0]), 'holz', 'ohne Angabe gilt Holz');
  const b = mischeBetrieb(BETRIEB_STANDARD, {
    materialarten: [
      { id: 'stein', name: ' Naturstein ' },
      { id: 'eigen-keramik', name: 'Keramik', eigen: true },
      { id: 'ohne-kennzeichen', name: 'Wird ignoriert' },
      { id: 'Ungültig!', name: 'X', eigen: true },
    ],
  });
  assert.deepEqual(b.materialarten.map((a) => a.name), ['Holz', 'Naturstein', 'Stahl', 'Glas', 'Keramik']);
});

test('Eigene Einträge der Tischlerei werden übernommen, ungültige ignoriert', () => {
  const b = mischeBetrieb(BETRIEB_STANDARD, {
    materialien: [
      { id: 'eigen-marmor', name: 'Marmor Carrara', preisProQm: 1800, art: 'stein', eigen: true },
      { id: 'eigen-ohne-art', name: 'X', preisProQm: 10, art: 'gibts-nicht', eigen: true },
      { id: 'eigen-ohne-preis', name: 'Y', eigen: true },
    ],
    gestelle: [{ id: 'eigen-kufen-messing', name: 'Kufen Messing', preis: 480, eigen: true }],
    optionen: [{ id: 'eigen-leer', name: '  ', preis: 5, eigen: true }],
  });
  assert.equal(b.materialien.length, 6);
  assert.deepEqual(b.materialien.at(-1), { id: 'eigen-marmor', name: 'Marmor Carrara', preisProQm: 1800, eigen: true, art: 'stein' });
  assert.deepEqual(b.gestelle.at(-1), { id: 'eigen-kufen-messing', name: 'Kufen Messing', preis: 480, eigen: true });
  assert.equal(b.optionen.length, BETRIEB_STANDARD.optionen.length);
  assert.deepEqual(mischeBetrieb(BETRIEB_STANDARD, bearbeitbareWerte(b)), b, 'Speichern und Laden ergibt dasselbe');
});

test('Prüfung: Materialart muss existieren, eigene Einträge brauchen Name und Preis', () => {
  const b = structuredClone(BETRIEB_STANDARD);
  b.materialien.push({ id: 'eigen-a', name: '', preisProQm: NaN, art: 'stein', eigen: true });
  b.materialien.push({ id: 'eigen-b', name: 'Onyx', preisProQm: 10, art: 'weg', eigen: true });
  const f = pruefeBetrieb(b).join(' | ');
  assert.match(f, /Material: Der Name darf nicht leer sein/);
  assert.match(f, /„ohne Namen“: Der Preis muss 0 oder mehr sein/);
  assert.match(f, /„Onyx“: Die Materialart fehlt/);
});

test('Neue IDs sind lesbar und eindeutig', () => {
  assert.equal(neueId('Marmor Carrara', []), 'eigen-marmor-carrara');
  assert.equal(neueId('Größe XL', []), 'eigen-groesse-xl');
  assert.equal(neueId('', []), 'eigen-eintrag');
  assert.equal(neueId('Marmor', ['eigen-marmor', 'eigen-marmor-2']), 'eigen-marmor-3');
});
