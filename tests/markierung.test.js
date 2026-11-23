// Tests für die Referenzmarkierung: `npm test`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normiere, markierungsPhase, pruefeMarkierung } from '../js/markierung.js';

const rect = { left: 100, top: 50, width: 800, height: 600 };

test('Normierung relativ zum Bild, begrenzt auf 0–1', () => {
  assert.deepEqual(normiere(500, 350, rect), { x: 0.5, y: 0.5 });
  assert.deepEqual(normiere(100, 50, rect), { x: 0, y: 0 });
  assert.deepEqual(normiere(2000, -10, rect), { x: 1, y: 0 });
  assert.deepEqual(normiere(366.66, 50, rect), { x: 0.3333, y: 0 });
  assert.equal(normiere(10, 10, { left: 0, top: 0, width: 0, height: 0 }), null, 'Bild ohne Größe');
});

test('Phasen der Markierung', () => {
  const p = { x: 0.2, y: 0.5 };
  const q = { x: 0.8, y: 0.5 };
  assert.equal(markierungsPhase(null, null), 'ref1');
  assert.equal(markierungsPhase({ p1: p, p2: null }, null), 'ref2');
  assert.equal(markierungsPhase({ p1: p, p2: q }, null), 'tisch');
  assert.equal(markierungsPhase({ p1: p, p2: q }, { x: 0.5, y: 0.8 }), 'fertig');
});

test('Prüfung: vollständig und gültig → null', () => {
  const ref = { p1: { x: 0.2, y: 0.5 }, p2: { x: 0.8, y: 0.5 }, laengeCm: 220 };
  assert.equal(pruefeMarkierung(ref, { x: 0.5, y: 0.8 }), null);
});

test('Prüfung: fehlende oder unbrauchbare Angaben', () => {
  const p1 = { x: 0.2, y: 0.5 };
  const p2 = { x: 0.8, y: 0.5 };
  const tisch = { x: 0.5, y: 0.8 };
  assert.match(pruefeMarkierung({ p1, p2: null, laengeCm: 220 }, tisch), /beide Enden/);
  assert.match(pruefeMarkierung({ p1, p2: { x: 0.21, y: 0.5 }, laengeCm: 220 }, tisch), /zu nah/);
  assert.match(pruefeMarkierung({ p1, p2, laengeCm: null }, tisch), /Länge/);
  assert.match(pruefeMarkierung({ p1, p2, laengeCm: 5 }, tisch), /Länge/);
  assert.match(pruefeMarkierung({ p1, p2, laengeCm: 220 }, null), /Tisch/);
});
