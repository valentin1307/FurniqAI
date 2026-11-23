// Tests für die Einstellungen der Tischlerseite (Betriebsdaten bearbeiten).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BETRIEB, BETRIEB_STANDARD, mischeBetrieb, pruefeBetrieb, bearbeitbareWerte } from '../js/betrieb.js';

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
  assert.deepEqual(Object.keys(w).sort(), ['gestelle', 'grenzen', 'grundpreis', 'materialien', 'oberflaechen', 'optionen', 'rahmenProzent']);
  assert.deepEqual(mischeBetrieb(BETRIEB_STANDARD, w), BETRIEB_STANDARD);
});
