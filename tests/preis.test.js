// Tests für die Preisrechnung: `node --test tests/`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BETRIEB } from '../js/betrieb.js';
import { flaecheQm, masseGrenzen, berechnePreis, passeKonfigurationEin, ueberstand } from '../js/preis.js';

const basis = {
  form: 'rechteckig',
  laenge: 120,
  breite: 60,
  hoehe: 40,
  materialId: 'eiche-massiv',
  gestellId: 'holz',
  oberflaecheId: 'geoelt',
};

test('Fläche je Form', () => {
  const nah = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);
  nah(flaecheQm('rechteckig', 120, 60), 0.72);
  nah(flaecheQm('quadratisch', 80, 999), 0.64);
  assert.ok(Math.abs(flaecheQm('rund', 100, 100) - Math.PI * 0.25) < 1e-9);
  assert.ok(Math.abs(flaecheQm('oval', 120, 60) - Math.PI * 0.6 * 0.3) < 1e-9);
});

test('Grundkonfiguration: 650 + 0,72 m² × 900 = 1.298 €', () => {
  const p = berechnePreis(basis, BETRIEB);
  assert.equal(p.summe, 1298);
  assert.deepEqual(p.rahmen, { von: 1100, bis: 1500 });
});

test('Aufpreise für Gestell, Oberfläche und Optionen', () => {
  const p = berechnePreis(
    { ...basis, gestellId: 'kufen-stahl', oberflaecheId: 'gebeizt', optionIds: ['schublade'] },
    BETRIEB,
  );
  assert.equal(p.summe, 1298 + 320 + 120 + 280);
});

test('Rund nutzt den Durchmesser, Breite wird ignoriert', () => {
  const p = berechnePreis({ ...basis, form: 'rund', laenge: 100, breite: 50 }, BETRIEB);
  assert.equal(p.summe, 650 + Math.round(Math.PI * 0.25 * 900));
});

test('Freier Platz begrenzt die Maße', () => {
  const g = masseGrenzen(BETRIEB, 'rechteckig', 140, 70);
  assert.deepEqual(g.laenge, { min: 60, max: 140 });
  assert.deepEqual(g.breite, { min: 50, max: 70 });
  assert.equal(g.passt, true);

  const rund = masseGrenzen(BETRIEB, 'rund', 140, 70);
  assert.deepEqual(rund.laenge, { min: 60, max: 70 });

  assert.equal(masseGrenzen(BETRIEB, 'rechteckig', 50, 70).passt, false);
  assert.equal(masseGrenzen(BETRIEB, 'rund', 200, 55).passt, false);
});

test('Einpassen: Maße werden auf den freien Platz begrenzt', () => {
  const k = passeKonfigurationEin(basis, BETRIEB, 100, 70);
  assert.equal(k.laenge, 100);
  assert.equal(k.breite, 60);
  assert.equal(k.form, 'rechteckig');
  assert.equal(basis.laenge, 120, 'Eingabe bleibt unverändert');
});

test('Einpassen: zu große Wunschmaße und Höhe werden begrenzt', () => {
  const k = passeKonfigurationEin({ ...basis, laenge: 200, breite: 30, hoehe: 70 }, BETRIEB, 150, 80);
  assert.deepEqual([k.laenge, k.breite, k.hoehe], [150, 50, 50]);
});

test('Einpassen: nicht mehr passende Form wird ersetzt', () => {
  // rund braucht mind. 60 cm in beide Richtungen
  const k = passeKonfigurationEin({ ...basis, form: 'rund', laenge: 80, breite: 80 }, BETRIEB, 120, 55);
  assert.equal(k.form, 'rechteckig');
  assert.deepEqual([k.laenge, k.breite], [80, 55]);
});

test('Einpassen: bei rund gilt breite = laenge', () => {
  const k = passeKonfigurationEin({ ...basis, form: 'rund', laenge: 90, breite: 50 }, BETRIEB, 140, 75);
  assert.deepEqual([k.form, k.laenge, k.breite], ['rund', 75, 75]);
});

test('Überstand: freier Platz begrenzt nicht, meldet nur, was übersteht', () => {
  assert.deepEqual(ueberstand('rechteckig', 120, 60, 100, 90), { laenge: 20, breite: 0, passt: false });
  assert.deepEqual(ueberstand('rechteckig', 120, 60, 160, 90), { laenge: 0, breite: 0, passt: true });
  // rund: Durchmesser zählt in beide Richtungen
  assert.deepEqual(ueberstand('rund', 80, 50, 120, 70), { laenge: 0, breite: 10, passt: false });
  assert.equal(ueberstand('rechteckig', 120, 60, null, null).passt, true);
});

test('Einpassen ohne freien Platz: nur Grenzen der Tischlerei', () => {
  const k = passeKonfigurationEin({ ...basis, laenge: 170, breite: 95, hoehe: 30 }, BETRIEB);
  assert.deepEqual([k.laenge, k.breite, k.hoehe], [170, 95, 30]);
});
