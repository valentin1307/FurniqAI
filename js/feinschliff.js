// Feinschliff-Chat im Baukasten: Antworten des Assistenten auf den Zustand anwenden.
// Reine Funktionen ohne DOM, damit testbar.

const MASSE = ['laenge', 'breite', 'hoehe'];
const AUSWAHL = { form: 'formen', materialId: 'materialien', gestellId: 'gestelle', oberflaecheId: 'oberflaechen' };
const FELD_NAME = { form: 'Form', materialId: 'Holz', gestellId: 'Gestell', oberflaecheId: 'Oberfläche', laenge: 'Länge', breite: 'Breite', hoehe: 'Höhe' };

const gleicherText = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Änderungen aus dem Chat anwenden.
 * z: { form, laenge, breite, hoehe, materialId, gestellId, oberflaecheId, optionIds, sonderwuensche, optionZusaetze }
 * Rückgabe: { aenderung: Teilzustand zum Übernehmen, hinweise: [{ art, text }] } – Eingabe bleibt unverändert.
 * Maße werden hier nicht begrenzt; das macht danach passeKonfigurationEin.
 */
export function wendeAenderungenAn(z, aenderungen, betrieb) {
  const neu = {
    optionIds: [...(z.optionIds || [])],
    sonderwuensche: (z.sonderwuensche || []).map((s) => ({ ...s })),
    optionZusaetze: { ...(z.optionZusaetze || {}) },
  };
  const hinweise = [];

  for (const a of aenderungen || []) {
    if (a.typ === 'option') {
      const option = betrieb.optionen.find((o) => o.id === a.option_id);
      if (!option) continue;
      if (a.aktion === 'entfernen') {
        if (!neu.optionIds.includes(option.id)) continue;
        neu.optionIds = neu.optionIds.filter((id) => id !== option.id);
        delete neu.optionZusaetze[option.id];
        hinweise.push({ art: 'entfernt', text: `${option.name} entfernt` });
      } else {
        if (!neu.optionIds.includes(option.id)) neu.optionIds.push(option.id);
        if (a.prompt_zusatz) neu.optionZusaetze[option.id] = a.prompt_zusatz;
        hinweise.push({ art: 'option', text: option.name, preis: option.preis });
      }
    } else if (a.typ === 'sonderwunsch') {
      const vorhanden = neu.sonderwuensche.findIndex((s) => gleicherText(s.beschreibung, a.beschreibung));
      if (a.aktion === 'entfernen') {
        if (vorhanden < 0) continue;
        neu.sonderwuensche.splice(vorhanden, 1);
        hinweise.push({ art: 'entfernt', text: `${a.beschreibung} entfernt` });
      } else {
        const eintrag = { beschreibung: a.beschreibung, promptZusatz: a.prompt_zusatz || '' };
        if (vorhanden >= 0) neu.sonderwuensche[vorhanden] = eintrag;
        else neu.sonderwuensche.push(eintrag);
        hinweise.push({ art: 'sonderwunsch', text: a.beschreibung });
      }
    } else if (a.typ === 'einstellung') {
      if (a.feld in AUSWAHL) {
        const eintrag = betrieb[AUSWAHL[a.feld]].find((e) => e.id === a.wert);
        if (!eintrag) continue;
        neu[a.feld] = eintrag.id;
        hinweise.push({ art: 'einstellung', text: `${FELD_NAME[a.feld]}: ${eintrag.name}` });
      } else if (MASSE.includes(a.feld) && Number.isFinite(Number(a.wert)) && Number(a.wert) > 0) {
        neu[a.feld] = Math.round(Number(a.wert));
        hinweise.push({ art: 'einstellung', text: `${FELD_NAME[a.feld]}: ${neu[a.feld]} cm`, feld: a.feld });
      }
    }
  }
  return { aenderung: neu, hinweise };
}

/** Englischer Zusatz für den Bild-Prompt aus gewählten Optionen und Sonderwünschen. */
export function promptZusatz(z, betrieb) {
  const teile = [];
  for (const id of z.optionIds || []) {
    const text = z.optionZusaetze?.[id] || `Extra: ${betrieb.optionen.find((o) => o.id === id)?.name ?? id}.`;
    teile.push(text.trim());
  }
  for (const s of z.sonderwuensche || []) teile.push((s.promptZusatz || `Special request: ${s.beschreibung}.`).trim());
  return teile.join(' ');
}

/** Teil des Betriebs, den der Assistent kennen muss. */
export function betriebFuerChat(b) {
  const { moebelart, formen, materialien, gestelle, oberflaechen, optionen, grenzen } = b;
  return { moebelart, formen, materialien, gestelle, oberflaechen, optionen, grenzen };
}
