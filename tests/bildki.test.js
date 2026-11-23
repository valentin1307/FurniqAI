// Tests für Schritt 4 (Bild-KI): wann ein Bild veraltet ist, ob die Größen zusammenpassen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kiSignatur, seitenverhaeltnisPasst } from '../js/bildki.js';

const basis = {
  form: 'rechteckig', materialId: 'eiche-massiv', laenge: 120, breite: 60, hoehe: 40,
  gestellId: 'holz', oberflaecheId: 'geoelt',
  referenz: { p1: { x: 0.2, y: 0.5 }, p2: { x: 0.8, y: 0.5 }, laengeCm: 220 },
  tischPosition: { x: 0.5, y: 0.8 },
  optionIds: [], foto: 'data:…',
};

test('Signatur ändert sich bei Form, Material, Maßen, Gestell, Oberfläche und Markierung', () => {
  const s = kiSignatur(basis);
  for (const aenderung of [
    { form: 'oval' }, { materialId: 'nuss-massiv' }, { laenge: 121 }, { breite: 61 }, { hoehe: 41 },
    { gestellId: 'kufen-stahl' }, { oberflaecheId: 'gebeizt' },
    { tischPosition: { x: 0.4, y: 0.8 } }, { referenz: { ...basis.referenz, laengeCm: 200 } },
  ]) {
    assert.notEqual(kiSignatur({ ...basis, ...aenderung }), s, JSON.stringify(aenderung));
  }
});

test('Signatur ändert sich bei Extras aus dem Feinschliff', () => {
  assert.notEqual(kiSignatur({ ...basis, optionIds: ['schublade'] }), kiSignatur(basis));
  assert.notEqual(kiSignatur({ ...basis, sonderwuensche: [{ beschreibung: 'Glasplatte' }] }), kiSignatur(basis));
  assert.equal(kiSignatur({ ...basis, optionIds: ['a', 'b'] }), kiSignatur({ ...basis, optionIds: ['b', 'a'] }), 'Reihenfolge egal');
});

test('Signatur bleibt gleich bei Dingen, die das Bild nicht betreffen', () => {
  assert.equal(kiSignatur({ ...basis, foto: 'anders' }), kiSignatur(basis));
  // rund: Breite spielt keine Rolle
  const rund = { ...basis, form: 'rund', laenge: 80 };
  assert.equal(kiSignatur({ ...rund, breite: 50 }), kiSignatur({ ...rund, breite: 70 }));
});

test('Seitenverhältnis von Eingabe und Ergebnis', () => {
  assert.equal(seitenverhaeltnisPasst({ breite: 1600, hoehe: 1200 }, { breite: 1184, hoehe: 888 }), true);
  assert.equal(seitenverhaeltnisPasst({ breite: 1600, hoehe: 1200 }, { breite: 1024, hoehe: 1024 }), false);
});
