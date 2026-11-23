// Tests für das Portfolio der Tischlerseite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMO_MOEBEL,
  MOEBEL_KATALOG,
  leeresPortfolio,
  mischePortfolio,
  moebelHinzufuegen,
  moebelEntfernen,
  nochNichtAngeboten,
  portfolioLaden,
} from '../js/portfolio.js';

test('Start: nur der Couchtisch, auch ohne Browser-Speicher', () => {
  assert.deepEqual(leeresPortfolio(), { moebel: [{ id: 'couchtisch', name: 'Couchtisch' }] });
  assert.deepEqual(portfolioLaden(), leeresPortfolio());
  assert.equal(DEMO_MOEBEL, 'couchtisch');
});

test('Gespeichertes Portfolio: Couchtisch immer vorn, Ungültiges und Doppeltes fällt weg', () => {
  const p = mischePortfolio({
    moebel: [
      { id: 'stuhl' },
      { id: 'stuhl' },
      { id: 'gibts-nicht' },
      { id: 'eigen-hocker', name: ' Hocker ', eigen: true },
      { id: 'eigen-leer', name: '', eigen: true },
      null,
    ],
  });
  assert.deepEqual(p.moebel.map((m) => m.id), ['couchtisch', 'stuhl', 'eigen-hocker']);
  assert.equal(p.moebel[2].name, 'Hocker');
  assert.deepEqual(mischePortfolio('kaputt'), leeresPortfolio());
});

test('Hinzufügen aus dem Katalog und eigene Möbel', () => {
  let p = leeresPortfolio();
  p = moebelHinzufuegen(p, 'bett');
  p = moebelHinzufuegen(p, 'bett');
  p = moebelHinzufuegen(p, { name: 'Hocker' });
  p = moebelHinzufuegen(p, { name: 'hocker' });
  p = moebelHinzufuegen(p, { name: 'Sessel' }); // Katalog-Name → Katalog-Eintrag
  p = moebelHinzufuegen(p, { name: '   ' });
  assert.deepEqual(p.moebel.map((m) => m.id), ['couchtisch', 'bett', 'eigen-hocker', 'sessel']);
  assert.equal(nochNichtAngeboten(p).length, MOEBEL_KATALOG.length - 3);
});

test('Entfernen: Couchtisch bleibt, Eingabe bleibt unverändert', () => {
  const p = moebelHinzufuegen(leeresPortfolio(), 'lampe');
  assert.deepEqual(moebelEntfernen(p, 'lampe').moebel.map((m) => m.id), ['couchtisch']);
  assert.deepEqual(moebelEntfernen(p, 'couchtisch').moebel.map((m) => m.id), ['couchtisch', 'lampe']);
  assert.equal(p.moebel.length, 2);
});
