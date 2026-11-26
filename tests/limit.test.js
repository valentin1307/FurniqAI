// Tests für das Tageslimit der öffentlichen Functions (Bild-KI, Chat, Anfrage anlegen).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRENZEN, LIMIT_MELDUNG, limitErreicht, ipAus, geraetSchluessel } from '../supabase/functions/_shared/limit.ts';

test('Limit: unter der Grenze frei, ab der Grenze gesperrt (je Gerät und gesamt)', () => {
  const { jeGeraet, gesamt } = GRENZEN.bild;
  assert.equal(limitErreicht('bild', 0, 0), null);
  assert.equal(limitErreicht('bild', jeGeraet - 1, gesamt - 1), null);
  assert.equal(limitErreicht('bild', jeGeraet, 0), 'geraet');
  assert.equal(limitErreicht('bild', 0, gesamt), 'gesamt');
  assert.equal(limitErreicht('bild', jeGeraet, gesamt), 'gesamt', 'Gesamtgrenze zuerst');
});

test('Limit: Bilder knapper als Chat, jede Art mit deutscher Meldung', () => {
  assert.ok(GRENZEN.bild.jeGeraet < GRENZEN.chat.jeGeraet);
  for (const art of Object.keys(GRENZEN)) assert.match(LIMIT_MELDUNG[art], /morgen/);
});

test('IP aus den Kopfzeilen: erste Adresse bei Weiterleitungen', () => {
  const kopf = (werte) => ({ get: (n) => werte[n] ?? null });
  assert.equal(ipAus(kopf({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })), '203.0.113.7');
  assert.equal(ipAus(kopf({ 'cf-connecting-ip': '198.51.100.2' })), '198.51.100.2');
  assert.equal(ipAus(kopf({})), 'unbekannt');
});

test('Geräteschlüssel: 64 Zeichen Hex, ohne IP im Klartext, abhängig vom Salz', async () => {
  const a = await geraetSchluessel('203.0.113.7', 'geheim');
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.ok(!a.includes('203'));
  assert.equal(a, await geraetSchluessel('203.0.113.7', 'geheim'));
  assert.notEqual(a, await geraetSchluessel('203.0.113.7', 'anders'));
});
