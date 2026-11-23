// Tests für die Daten der Edge Function anfragen (Prüfung und Umwandlung).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zeileAusAnfrage, anfrageAusZeile, pruefeStatus, bildAusDataUrl } from '../supabase/functions/anfragen/daten.ts';

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
  assert.throws(() => zeileAusAnfrage({ ...anfrage, konfiguration: null }), /Tischauswahl/);
  assert.throws(() => zeileAusAnfrage({ ...anfrage, preis: {} }), /Preis/);
  assert.throws(() => zeileAusAnfrage({ ...anfrage, freierPlatz: null }), /freie Platz/);
});

test('Zeile → Anfrage für die Tischlerseite', () => {
  const a = anfrageAusZeile({ id: 'x', status: 'neu', freier_platz: { laenge: 1, breite: 2 }, tisch_position: null }, { kiBild: 'https://bild' });
  assert.deepEqual(a.freierPlatz, { laenge: 1, breite: 2 });
  assert.equal(a.kiBildUrl, 'https://bild');
  assert.equal(a.fotoUrl, null);
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
