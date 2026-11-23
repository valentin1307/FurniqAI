// Tests für die Prüfung der Pilot-Anfragen (Edge Function pilot).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EINWILLIGUNG_TEXT, zeileAusPilot } from '../supabase/functions/pilot/daten.ts';

const formular = {
  name: '  Anna   Holz ',
  betrieb: 'Tischlerei Holz',
  ort: 'Graz',
  email: 'Anna@Example.com',
  telefon: '',
  nachricht: '  Gern Termin\nnächste Woche  ',
  einwilligung: true,
  website: '',
};

test('Pilot-Anfrage: Felder bereinigt, Einwilligung mit Wortlaut', () => {
  const z = zeileAusPilot(formular);
  assert.equal(z.name, 'Anna Holz');
  assert.equal(z.email, 'anna@example.com');
  assert.equal(z.telefon, null);
  assert.equal(z.nachricht, 'Gern Termin\nnächste Woche');
  assert.equal(z.einwilligung, true);
  assert.equal(z.einwilligung_text, EINWILLIGUNG_TEXT);
  assert.equal(zeileAusPilot({ ...formular, nachricht: 'x'.repeat(5000) }).nachricht.length, 3000);
});

test('Pilot-Anfrage: Pflichtfelder und Einwilligung', () => {
  assert.throws(() => zeileAusPilot(null), /leer/);
  assert.throws(() => zeileAusPilot({ ...formular, name: ' ' }), /Namen/);
  assert.throws(() => zeileAusPilot({ ...formular, betrieb: '' }), /Betrieb/);
  assert.throws(() => zeileAusPilot({ ...formular, ort: '' }), /Ort/);
  assert.throws(() => zeileAusPilot({ ...formular, email: 'kaputt@' }), /E-Mail/);
  assert.throws(() => zeileAusPilot({ ...formular, einwilligung: 'ja' }), /Einwilligung/);
});

test('Pilot-Anfrage: ausgefülltes Spam-Feld wird still verworfen', () => {
  assert.equal(zeileAusPilot({ ...formular, website: 'https://spam.example' }), null);
});
