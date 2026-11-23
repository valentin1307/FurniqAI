// Tests für die Daten der Edge Function anfragen (Prüfung und Umwandlung).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FREIGESCHALTET, istFreigeschaltet, moebelAus } from '../supabase/functions/_shared/moebel.ts';
import { KONFIG_PRUEFUNG, zeileAusAnfrage, anfrageAusZeile, pruefeStatus, bildAusDataUrl } from '../supabase/functions/anfragen/daten.ts';

const anfrage = {
  kunde: { name: ' Anna Muster ', email: 'anna@example.com', telefon: '', ort: 'Wien', nachricht: 'Gern mit Ablage' },
  konfiguration: { form: 'rechteckig', laenge: 120, breite: 60, hoehe: 40, materialId: 'eiche-massiv', namen: { form: 'Rechteckig' } },
  preis: { summe: 1298, rahmen: { von: 1100, bis: 1500 }, positionen: [] },
  freierPlatz: { laenge: 160, breite: 90 },
  raum: null,
  referenz: { p1: { x: 0.2, y: 0.5 }, p2: { x: 0.8, y: 0.5 }, laengeCm: 220 },
  tischPosition: { x: 0.5, y: 0.8 },
  passtInFreienPlatz: true,
};

test('Anfrage → Zeile: Felder umbenannt, Text gekürzt und getrimmt', () => {
  const z = zeileAusAnfrage(anfrage);
  assert.equal(z.kunde.name, 'Anna Muster');
  assert.deepEqual(z.freier_platz, { laenge: 160, breite: 90 });
  assert.deepEqual(z.tisch_position, { x: 0.5, y: 0.8 });
  assert.equal(z.passt_in_freien_platz, true);
  assert.equal(z.raum, null);
  assert.equal(zeileAusAnfrage({ ...anfrage, kunde: { ...anfrage.kunde, nachricht: 'x'.repeat(5000) } }).kunde.nachricht.length, 3000);
});

test('Anfrage → Zeile: Pflichtangaben', () => {
  assert.throws(() => zeileAusAnfrage({ ...anfrage, kunde: { name: '', email: 'a@b.de' } }), /Namen/);
  assert.throws(() => zeileAusAnfrage({ ...anfrage, kunde: { name: 'A', email: 'kaputt' } }), /E-Mail/);
  assert.throws(() => zeileAusAnfrage({ ...anfrage, konfiguration: null }), /Auswahl zum Möbelstück/);
  assert.throws(() => zeileAusAnfrage({ ...anfrage, preis: {} }), /Preis/);
  assert.throws(() => zeileAusAnfrage({ ...anfrage, freierPlatz: null }), /freie Platz/);
});

test('Möbel: fehlt → Couchtisch (ältere Kundenseite), sonst nur freigeschaltete', () => {
  const alt = zeileAusAnfrage(anfrage);
  assert.equal(alt.moebel, 'couchtisch');
  assert.equal(alt.moebel_name, null);
  const neu = zeileAusAnfrage({ ...anfrage, moebel: 'couchtisch', moebelName: ' Couchtisch ' });
  assert.equal(neu.moebel, 'couchtisch');
  assert.equal(neu.moebel_name, 'Couchtisch');
  assert.throws(() => zeileAusAnfrage({ ...anfrage, moebel: 'esstisch' }), /noch nicht angefragt/);
  assert.throws(() => zeileAusAnfrage({ ...anfrage, moebel: 'DROP TABLE' }), /Unbekanntes Möbelstück/);
  assert.throws(() => zeileAusAnfrage({ ...anfrage, moebel: 42 }), /Unbekanntes Möbelstück/);
});

test('Möbel: Freischaltliste und Konfigurationsprüfung passen zusammen', () => {
  assert.equal(moebelAus(undefined), 'couchtisch');
  assert.equal(moebelAus('eigen-hocker'), 'eigen-hocker');
  assert.equal(moebelAus('-x'), null);
  assert.equal(istFreigeschaltet('couchtisch'), true);
  assert.equal(istFreigeschaltet('esstisch'), false);
  assert.equal(istFreigeschaltet(null), false);
  // Jedes freigeschaltete Möbel braucht eine Prüfung, sonst scheitert jede Anfrage dafür
  for (const id of FREIGESCHALTET) assert.equal(typeof KONFIG_PRUEFUNG[id], 'function', id);
});

test('Zeile → Anfrage für die Tischlerseite', () => {
  const a = anfrageAusZeile({ id: 'x', status: 'neu', freier_platz: { laenge: 1, breite: 2 }, tisch_position: null }, { kiBild: 'https://bild' });
  assert.deepEqual(a.freierPlatz, { laenge: 1, breite: 2 });
  assert.equal(a.kiBildUrl, 'https://bild');
  assert.equal(a.fotoUrl, null);
  assert.equal(a.moebel, 'couchtisch'); // Zeile von vor der Migration
  assert.equal(anfrageAusZeile({ id: 'y', moebel: 'couchtisch', moebel_name: 'Couchtisch' }).moebelName, 'Couchtisch');
});

test('Status: Ablehnen nur mit Begründung', () => {
  assert.deepEqual(pruefeStatus('angenommen', 'egal'), { status: 'angenommen', ablehnungsgrund: null });
  assert.deepEqual(pruefeStatus('abgelehnt', ' Maß zu groß '), { status: 'abgelehnt', ablehnungsgrund: 'Maß zu groß' });
  assert.throws(() => pruefeStatus('abgelehnt', ''), /Begründung/);
  assert.throws(() => pruefeStatus('erledigt'), /Unbekannter Status/);
});

test('Bild aus data-URL', () => {
  const b = bildAusDataUrl('data:image/jpeg;base64,QUJD');
  assert.equal(b.mimeType, 'image/jpeg');
  assert.deepEqual([...b.bytes], [65, 66, 67]);
  assert.equal(bildAusDataUrl(null), null);
  assert.throws(() => bildAusDataUrl('data:text/html;base64,QUJD'), /Bildformat/);
  assert.throws(() => bildAusDataUrl('data:image/png;base64,QUJD', 2), /zu groß/);
});
