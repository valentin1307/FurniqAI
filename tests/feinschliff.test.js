// Tests für den Feinschliff-Chat: Anweisung ans Modell und Prüfung der Modell-Antwort.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BETRIEB_STANDARD as B } from '../js/betrieb.js';
import { baueAnweisung, bereinigeAntwort, verlaufFuerModell } from '../supabase/functions/feinschliff/regeln.ts';

test('Anweisung enthält Optionen mit Preis, IDs, Grenzen und die aktuelle Konfiguration', () => {
  const a = baueAnweisung(B, { form: 'rechteckig', laenge: 120 });
  assert.match(a, /- ablage-unten: Ablage unten \(Aufpreis 220 €\)/);
  assert.match(a, /- nuss-massiv: Nuss massiv/);
  assert.match(a, /Länge 60–180, Breite 50–100, Höhe 30–50/);
  assert.match(a, /"laenge":120/);
  assert.match(a, /Erfinden Sie keine Preise/);
});

test('Antwort: gültige Änderungen bleiben, Optionsname kommt vom Betrieb', () => {
  const r = bereinigeAntwort(
    {
      antwort: 'Gern, ich habe die Ablage und Nuss übernommen.',
      aenderungen: [
        { typ: 'option', aktion: 'hinzufuegen', option_id: 'ablage-unten', beschreibung: 'Regal', prompt_zusatz: 'with a lower shelf' },
        { typ: 'einstellung', aktion: 'hinzufuegen', feld: 'materialId', wert: 'nuss-massiv', beschreibung: 'Nuss' },
        { typ: 'einstellung', aktion: 'hinzufuegen', feld: 'laenge', wert: '130 cm', beschreibung: 'Länge 130 cm' },
        { typ: 'sonderwunsch', aktion: 'hinzufuegen', beschreibung: 'Eingelassene Glasplatte', prompt_zusatz: 'with an inset glass panel' },
      ],
    },
    B,
  );
  assert.equal(r.aenderungen.length, 4);
  assert.deepEqual(r.aenderungen[0], { typ: 'option', aktion: 'hinzufuegen', option_id: 'ablage-unten', beschreibung: 'Ablage unten', prompt_zusatz: 'with a lower shelf' });
  assert.equal(r.aenderungen[1].wert, 'nuss-massiv');
  assert.equal(r.aenderungen[2].wert, 130);
  assert.equal(r.aenderungen[3].typ, 'sonderwunsch');
});

test('Antwort: erfundene IDs, Felder und Werte fallen weg', () => {
  const r = bereinigeAntwort(
    {
      antwort: '',
      aenderungen: [
        { typ: 'option', option_id: 'goldrand', beschreibung: 'Goldrand' },
        { typ: 'einstellung', feld: 'materialId', wert: 'gold' },
        { typ: 'einstellung', feld: 'preis', wert: '1' },
        { typ: 'einstellung', feld: 'hoehe', wert: 'hoch' },
        { typ: 'sonderwunsch', beschreibung: '' },
        { typ: 'quatsch', beschreibung: 'x' },
      ],
    },
    B,
  );
  assert.deepEqual(r.aenderungen, []);
  assert.match(r.antwort, /nicht verstanden/);
});

test('Option entfernen und Verlauf fürs Modell', () => {
  const r = bereinigeAntwort({ antwort: 'Ok.', aenderungen: [{ typ: 'option', aktion: 'entfernen', option_id: 'schublade', beschreibung: 'x' }] }, B);
  assert.equal(r.aenderungen[0].aktion, 'entfernen');
  const v = verlaufFuerModell([{ rolle: 'kunde', text: 'Hallo' }, { rolle: 'assistent', text: 'Guten Tag' }, { rolle: 'system', text: 'x' }]);
  assert.deepEqual(v.map((n) => n.role), ['user', 'model']);
});

// ---------- Kundenseite: Änderungen anwenden ----------
import { wendeAenderungenAn, promptZusatz } from '../js/feinschliff.js';

const basis = { form: 'rechteckig', laenge: 120, breite: 60, hoehe: 40, materialId: 'eiche-massiv', gestellId: 'holz', oberflaecheId: 'geoelt', optionIds: [], sonderwuensche: [], optionZusaetze: {} };

test('Änderungen anwenden: Option, Holz, Länge, Sonderwunsch', () => {
  const { aenderung, hinweise } = wendeAenderungenAn(basis, [
    { typ: 'option', aktion: 'hinzufuegen', option_id: 'ablage-unten', prompt_zusatz: 'with a lower shelf' },
    { typ: 'einstellung', feld: 'materialId', wert: 'nuss-massiv' },
    { typ: 'einstellung', feld: 'laenge', wert: 130 },
    { typ: 'sonderwunsch', aktion: 'hinzufuegen', beschreibung: 'Glasplatte', prompt_zusatz: 'with an inset glass panel' },
  ], B);
  assert.deepEqual(aenderung.optionIds, ['ablage-unten']);
  assert.equal(aenderung.materialId, 'nuss-massiv');
  assert.equal(aenderung.laenge, 130);
  assert.deepEqual(aenderung.sonderwuensche, [{ beschreibung: 'Glasplatte', promptZusatz: 'with an inset glass panel' }]);
  assert.deepEqual(hinweise.map((h) => h.art), ['option', 'einstellung', 'einstellung', 'sonderwunsch']);
  assert.equal(hinweise[0].preis, 220);
  assert.deepEqual(basis.optionIds, [], 'Eingabe bleibt unverändert');
});

test('Änderungen anwenden: doppelt, entfernen, Unbekanntes', () => {
  const z = { ...basis, optionIds: ['schublade'], sonderwuensche: [{ beschreibung: 'Glasplatte', promptZusatz: 'x' }], optionZusaetze: { schublade: 'y' } };
  const { aenderung, hinweise } = wendeAenderungenAn(z, [
    { typ: 'option', aktion: 'hinzufuegen', option_id: 'schublade' },
    { typ: 'option', aktion: 'entfernen', option_id: 'schublade' },
    { typ: 'sonderwunsch', aktion: 'entfernen', beschreibung: 'glasplatte ' },
    { typ: 'option', option_id: 'gibts-nicht' },
    { typ: 'einstellung', feld: 'materialId', wert: 'gold' },
  ], B);
  assert.deepEqual(aenderung.optionIds, []);
  assert.deepEqual(aenderung.optionZusaetze, {});
  assert.deepEqual(aenderung.sonderwuensche, []);
  assert.equal(aenderung.materialId, undefined);
  assert.equal(hinweise.length, 3);
});

test('Prompt-Zusatz aus Optionen und Sonderwünschen', () => {
  const z = { optionIds: ['ablage-unten', 'schublade'], optionZusaetze: { 'ablage-unten': 'With a lower shelf.' }, sonderwuensche: [{ beschreibung: 'Glasplatte', promptZusatz: 'With an inset glass panel.' }] };
  assert.equal(promptZusatz(z, B), 'With a lower shelf. Extra: Schublade. With an inset glass panel.');
  assert.equal(promptZusatz({ optionIds: [], sonderwuensche: [] }, B), '');
});

test('Denkstufe je Modell: 2.5 ohne Nachdenken, Gemini 3 niedrigste unterstützte Stufe', async () => {
  const { denkEinstellung } = await import('../supabase/functions/feinschliff/regeln.ts');
  assert.deepEqual(denkEinstellung('gemini-2.5-flash').thinkingConfig, { thinkingBudget: 0 });
  assert.deepEqual(denkEinstellung('gemini-3.5-flash-lite'), { thinkingConfig: { thinkingLevel: 'minimal' } });
  assert.deepEqual(denkEinstellung('gemini-3.6-flash'), { thinkingConfig: { thinkingLevel: 'minimal' } });
  assert.deepEqual(denkEinstellung('gemini-3.8-flash'), { thinkingConfig: { thinkingLevel: 'low' } });
  assert.equal(denkEinstellung('gemini-3.8-flash').temperature, undefined);
});
