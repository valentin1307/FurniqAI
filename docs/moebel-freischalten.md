# Ein weiteres Möbel freischalten

Stand: nur der Couchtisch ist freigeschaltet. Alle anderen Möbel erscheinen im Portfolio der Tischlerseite
und auf der Kundenseite (Schritt „Wählen Sie Ihr neues Herzstück“), sind dort aber nicht wählbar („Bald verfügbar“).

## Wie die Möbelart gespeichert wird

- Tabelle `public.anfragen`, Spalten `moebel` (ID, Pflicht, Standard `'couchtisch'`) und `moebel_name` (Anzeigename zum Zeitpunkt der Anfrage).
  Migration: `supabase/migrations/20261123150000_moebel.sql`.
- `moebel` ist freier Text mit Formatregel (`^[a-z0-9][a-z0-9-]{0,60}$`), **keine** feste Liste.
  Ein neues Möbel braucht deshalb keine neue Migration.
- Die Konfiguration bleibt in `konfiguration` (jsonb). Ihr Aufbau darf je Möbel anders sein; geprüft wird sie in der Edge Function.
- Die Spalte `tisch_position` und das Feld `tisch` im Aufruf von `render-table` heißen aus Kompatibilität weiter so,
  gelten aber für jedes Möbel (Standort im Foto bzw. Angaben zum Möbel).
- Ältere Kundenseiten ohne `moebel` funktionieren weiter: Die Functions setzen dann `couchtisch`.

## Schritte

1. **Freischaltliste** an zwei Stellen gleich halten:
   - `js/portfolio.js` → `FREIGESCHALTET`
   - `supabase/functions/_shared/moebel.ts` → `FREIGESCHALTET`
2. **Prüfung der Anfrage**: `supabase/functions/anfragen/daten.ts` → Eintrag in `KONFIG_PRUEFUNG`
   (welche Felder die Konfiguration des Möbels haben muss).
3. **Bild-KI**: `supabase/functions/render-table/prompt.ts` → Prompt-Bauer in `PROMPTS`,
   `supabase/functions/render-table/index.ts` → Eingabeprüfung in `MOEBEL_PRUEFUNG`.
4. **Feinschliff-Chat**: `supabase/functions/feinschliff/regeln.ts` prüfen (Text der Anweisung, Felder in `FELDER`).
5. **Kundenseite und Tischlerseite**: Baukasten und Einstellungen für das Möbel bauen
   (heute sind `js/betrieb.js`, Schritt 2 in `index.html` und `#couchtisch-ansicht` in `tischler.html` couchtischspezifisch).
6. `npm test` – die Tests prüfen, dass jedes freigeschaltete Möbel eine Prüfung und einen Prompt hat.
7. Ausliefern: zuerst die Functions, dann die Seiten.

   ```bash
   supabase functions deploy anfragen render-table feinschliff
   ```

Die Reihenfolge ist wichtig: Schaltet die Seite ein Möbel frei, das die Functions noch nicht kennen,
lehnen sie Anfragen dafür mit einer verständlichen Meldung ab („Dieses Möbelstück kann noch nicht angefragt werden.“),
statt unpassende Daten zu speichern.

## Erstmalige Einrichtung (einmal, vor dem ersten Deploy der neuen Functions)

```bash
supabase db push
```

Danach die drei Functions deployen (siehe oben). Die Migration ist rückwärtsverträglich:
Die heute ausgelieferte Seite schickt kein `moebel` mit und landet beim Standardwert `couchtisch`.
