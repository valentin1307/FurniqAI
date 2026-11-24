// Tests für den Eckenradius im Baukasten (Regler unter „Form“).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BETRIEB } from '../js/betrieb.js';
import { ECKEN_OPTION, ECKEN_STANDARD, hatEcken, maxEckenRadius, eckenSetzen, eckenAbgleichen, eckenText } from '../js/ecken.js';

const basis = { form: 'rechteckig', laenge: 120, breite: 60, optionIds: ['schublade'], optionZusaetze: {} };

test('Nur eckige Formen haben Ecken', () => {
  assert.equal(hatEcken('rechteckig'), true);
  assert.equal(hatEcken('quadratisch'), true);
  assert.equal(hatEcken('rund'), false);
  assert.equal(hatEcken('oval'), false);
});

test('Größter Radius: halbe kurze Seite, höchstens 30 cm, 0 bei runden Formen', () => {
  assert.equal(maxEckenRadius('rechteckig', 120, 50), 25);
  assert.equal(maxEckenRadius('rechteckig', 180, 100), 30);
  assert.equal(maxEckenRadius('quadratisch', 40, 999), 20);
  assert.equal(maxEckenRadius('rund', 100, 100), 0);
  assert.equal(maxEckenRadius('oval', 120, 60), 0);
});

test('Radius > 0 schaltet die Option mit Prompt-Zusatz ein, 0 wieder aus', () => {
  const an = eckenSetzen(basis, BETRIEB, 8);
  assert.equal(an.eckenRadius, 8);
  assert.deepEqual(an.optionIds, ['schublade', ECKEN_OPTION]);
  assert.match(an.optionZusaetze[ECKEN_OPTION], /8 cm/);
  const aus = eckenSetzen({ ...basis, ...an }, BETRIEB, 0);
  assert.equal(aus.eckenRadius, 0);
  assert.deepEqual(aus.optionIds, ['schublade']);
  assert.equal(aus.optionZusaetze[ECKEN_OPTION], undefined);
});

test('Radius wird auf die Grenzen begrenzt und ändert den Zustand nicht', () => {
  const vorher = structuredClone(basis);
  assert.equal(eckenSetzen(basis, BETRIEB, 99).eckenRadius, 30);
  assert.equal(eckenSetzen(basis, BETRIEB, -4).eckenRadius, 0);
  assert.deepEqual(basis, vorher);
});

test('Ohne passende Option im Betrieb: nur Radius, kein Aufpreis', () => {
  const ohne = { ...BETRIEB, optionen: [] };
  const r = eckenSetzen(basis, ohne, 10);
  assert.equal(r.eckenRadius, 10);
  assert.deepEqual(r.optionIds, ['schublade']);
});

test('Abgleich: Option aus dem Chat bekommt Standardradius, entfernte Option setzt 0, runde Form entfernt beides', () => {
  assert.equal(eckenAbgleichen({ ...basis, optionIds: [ECKEN_OPTION] }, BETRIEB).eckenRadius, ECKEN_STANDARD);
  assert.equal(eckenAbgleichen({ ...basis, eckenRadius: 12, optionIds: [] }, BETRIEB).eckenRadius, 0);
  const rund = eckenAbgleichen({ ...basis, form: 'rund', eckenRadius: 12, optionIds: [ECKEN_OPTION] }, BETRIEB);
  assert.equal(rund.eckenRadius, 0);
  assert.deepEqual(rund.optionIds, []);
});

test('Text für die Zusammenfassung', () => {
  assert.equal(eckenText(0), 'eckig');
  assert.equal(eckenText(7), 'Radius 7 cm');
});
