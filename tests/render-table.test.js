// Tests für Prompt und Fehlerauswertung der Edge Function render-table (Node lädt die .ts-Dateien direkt).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bauePrompt, naechstesSeitenverhaeltnis } from '../supabase/functions/render-table/prompt.ts';
import { ordneHttpFehlerEin, werteAntwortAus } from '../supabase/functions/render-table/anbieter/gemini.ts';
import { pruefeDemoCode } from '../supabase/functions/_shared/zugang.ts';

const tisch = {
  form: 'rechteckig',
  laenge: 120,
  breite: 60,
  hoehe: 40,
  materialId: 'eiche-massiv',
  gestellId: 'holz',
  oberflaecheId: 'geoelt',
  namen: { form: 'Rechteckig', material: 'Eiche massiv', gestell: 'Holz', oberflaeche: 'geölt' },
};

test('Prompt enthält Maßstab, Maße, Material und das Verbot von Markierungen', () => {
  const p = bauePrompt(tisch, 220);
  assert.match(p, /reference object is 220 cm wide/);
  assert.match(p, /rectangular, 120 cm long, 60 cm deep, 40 cm high/);
  assert.match(p, /solid oak wood \("Eiche massiv"\)/);
  assert.match(p, /parallel to the sofa/);
  assert.match(p, /must not contain any red markings/);
  assert.match(p, /camera angle/);
});

test('Prompt: rund nutzt Durchmesser, unbekannte IDs den Namen des Betriebs', () => {
  const p = bauePrompt({ ...tisch, form: 'rund', laenge: 90, materialId: 'kirsche', namen: { ...tisch.namen, material: 'Kirsche' } }, 200);
  assert.match(p, /round, 90 cm in diameter/);
  assert.match(p, /top made of "Kirsche"/);
});

test('Seitenverhältnis: nächstes von Gemini unterstütztes', () => {
  assert.equal(naechstesSeitenverhaeltnis(1600, 1200), '4:3');
  assert.equal(naechstesSeitenverhaeltnis(1200, 1600), '3:4');
  assert.equal(naechstesSeitenverhaeltnis(1600, 900), '16:9');
  assert.equal(naechstesSeitenverhaeltnis(1000, 1000), '1:1');
});

test('Antwort mit Bild wird ausgewertet', () => {
  const e = werteAntwortAus(
    { candidates: [{ content: { parts: [{ text: 'ok' }, { inlineData: { mimeType: 'image/png', data: 'QUJD' } }] } }] },
    'm',
  );
  assert.deepEqual(e, { bild: 'QUJD', mimeType: 'image/png', modell: 'm', text: 'ok' });
});

test('Antwort ohne Bild: Inhaltsfilter bzw. kein Bild', () => {
  const code = (json) => {
    try {
      werteAntwortAus(json, 'm');
    } catch (f) {
      return f.code;
    }
  };
  assert.equal(code({ promptFeedback: { blockReason: 'SAFETY' } }), 'filter');
  assert.equal(code({ candidates: [{ finishReason: 'IMAGE_SAFETY', content: { parts: [] } }] }), 'filter');
  assert.equal(code({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Sorry' }] } }] }), 'kein_bild');
});

test('HTTP-Fehler: Abrechnung, Kontingent, Schlüssel, Modell', () => {
  assert.equal(ordneHttpFehlerEin(429, 'Quota exceeded ... limit: 0, model: gemini-3.1-flash-image', 'm').code, 'abrechnung');
  assert.equal(ordneHttpFehlerEin(400, '{"error":{"message":"... requires billing to be enabled"}}', 'm').code, 'abrechnung');
  assert.equal(ordneHttpFehlerEin(402, '{"error":{"message":"Your prepayment credits are depleted.","status":"RESOURCE_EXHAUSTED"}}', 'm').code, 'abrechnung');
  assert.equal(ordneHttpFehlerEin(429, 'RESOURCE_EXHAUSTED', 'm').code, 'kontingent');
  assert.equal(ordneHttpFehlerEin(400, 'API key not valid. API_KEY_INVALID', 'm').code, 'schluessel');
  const modell = ordneHttpFehlerEin(404, 'models/x is not found', 'x');
  assert.equal(modell.code, 'modell');
  assert.match(modell.message, /„x“/);
});

test('Demo-Code: richtig, falsch, fehlt, nicht eingerichtet', () => {
  assert.equal(pruefeDemoCode('tisch2026', 'tisch2026'), 'ok');
  assert.equal(pruefeDemoCode(' tisch2026 ', 'tisch2026'), 'ok', 'Leerzeichen egal');
  assert.equal(pruefeDemoCode('tisch2025', 'tisch2026'), 'falsch');
  assert.equal(pruefeDemoCode('tisch', 'tisch2026'), 'falsch');
  assert.equal(pruefeDemoCode(null, 'tisch2026'), 'fehlt');
  assert.equal(pruefeDemoCode('', 'tisch2026'), 'fehlt');
  assert.equal(pruefeDemoCode('egal', undefined), 'nicht_eingerichtet', 'ohne Secret gesperrt');
});
