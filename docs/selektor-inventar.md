# Selektor-Inventar (Stand 23.11.2026, Branch design-neu)

Diese Selektoren benutzen `js/app.js`, `js/tischler.js` und `js/kopf.js`. Sie bleiben beim Umbau von Markup und CSS unverändert.
Die Tests (`tests/*.test.js`) prüfen nur reine Funktionen und greifen nicht auf das DOM zu.

## Kundenseite (index.html, js/app.js)

**Struktur und Navigation**
- `.schritt` (alle Schritt-Sections), `#schritt-0`, `#schritt-1`, `#schritt-2`, `#schritt-4`, `#schritt-5`, `#schritt-N .kicker`
- `.schritte button`, `.schritte li:not([hidden]) button`, `data-schritt`, `aria-current="step"`, Klasse `erledigt`, `disabled`
- Schritt 3 bleibt `li hidden` (Feinschliff-Chat sitzt im Baukasten)

**Kopf (White-Label)**
- `#betrieb-logo`, `#betrieb-monogramm`, `#betrieb-name`, `#betrieb-claim` (alle `hidden`-gesteuert)

**Schritt 0 (Möbel wählen)**
- `#wahl-moebel` (change-Listener), `#moebel-raster`, `.moebel-karte` (Klasse `bald` = noch nicht freigeschaltet), `input[type=radio][name=moebel]` (`disabled` wenn nicht freigeschaltet), `.moebel-symbol`, `.moebel-name`, `.moebel-status`
- `#weiter-0`, `#zurueck-1` (Schritt 1 → 0), `#kv-titel` (Titel des Kostenvoranschlags mit Möbelname)
- `.nur-vorleser` (nur für Screenreader)

**Schritt 1**
- `#foto-input`, `#upload-zone` (Klasse `ziehen`), `#upload-leer`, `#foto-tipp`, `#markierung`
- `#markier-schritt-ref`, `#markier-schritt-tisch` (className wird komplett gesetzt: `markier-schritt aktiv|erledigt`)
- `#referenz-laenge`, `#markier-flaeche` (Klasse `fertig`), `#foto-vorschau`, `#markier-svg`, `[data-punkt]` (p1, p2, tisch)
- SVG-Klassen aus JS: `ref-linie`, `ref-punkt`, `griff`, `ziehen`, `etikett-flaeche`, `etikett-text`, `tisch-ring`, `tisch-kern`, `tisch-symbol`, `tisch-etikett`
- `#markier-status`, `#neu-markieren`, `#foto-wechseln`
- `#frei-laenge`, `#frei-breite`, `#raum-laenge`, `#raum-breite`, `#wunsch-laenge`, `#wunsch-breite`, `#wunsch-hoehe` (Klasse `ungueltig`)
- `#fehler-1`, `#weiter-1`

**Schritt 2 (Baukasten, Bühne, Chat)**
- `.baukasten-buehne` (Ziel für `#buehne`), `.baukasten-optionen` (change-Listener)
- `#buehne`, `#buehne-flaeche` (Klassen `zeigt-draufsicht`, `laedt`, `data-etikett`, CSS-Variable `--buehne-bild`), `#buehne-bild`, `#buehne-draufsicht`, `#draufsicht`, `#buehne-etikett`, `#buehne-laden`, `#laden-sekunden`
- `.umschalter button`, `data-ansicht` (raum, ki, draufsicht), `aria-pressed`, `hidden`
- `#wahl-form`, `#wahl-material`, `#wahl-gestell`, `#wahl-oberflaeche`; darin `label > input[type=radio][name=form|material|gestell|oberflaeche]`
- `.muster[data-material]` (Klasse `mit-foto`, `ohne-maserung`, Variablen `--holz`, `--muster-bild`), `.form-symbol`, `.aufpreis`
- `#form-hinweis`, `#wunsch-hinweis`, `#platz-hinweis`
- `#regler-laenge|breite|hoehe` (Variable `--fuellung`), `#wert-*`, `#grenze-*`, `#label-laenge`, `#regler-breite-block`
- `#preis-summe` (Klasse `aendert`), `#preis-rahmen`, `#weiter-2`, `#zurueck-2`, `#veraltet-2`
- `#chat-verlauf`, `#chat-vorschlaege` (`button`), `#chat-code-feld`, `#chat-code`, `#chat-text`, `#chat-senden`, `#fehler-chat`
- Chat-Klassen aus JS: `chat-nachricht`, `chat-kunde`, `chat-assistent`, `chat-tippt`, `chat-hinweise`, `art-option|sonderwunsch|einstellung|entfernt`
- `#extras`, `#extras-liste` (`button[data-option]`, `button[data-sonder]`, `extra-name`, `extra-preis`, `auf-anfrage`)

**Schritt 4 (Bild)**
- `#bild-buehne-platz`, `#bild-auswahl`, `#veraltet-4`, `#fehler-4`
- `#demo-code-form`, `#demo-code`, `#bild-erzeugen` (Klassen `knopf-haupt`/`knopf-leise` werden umgeschaltet), `#bild-erzeugen-text`
- `#zurueck-4`, `#weiter-4`

**Schritt 5 (Kostenvoranschlag)**
- `#kv-foto`, `#kv-daten`, `#kv-betrieb`, `#kv-datum`, `#kv-positionen` (`.detail`), `#kv-summe`, `#kv-prozent`, `#kv-rahmen`, `#kv-sonder`, `#kv-sonderliste`
- `#kunden-form` (`button[type=submit]`, `input`, Feldnamen name/email/telefon/ort/nachricht/demoCode), `#kunden-code-feld`, `#fehler-5`
- `#erfolg`, `#neu-starten`, `#zurueck-5`

## Tischlerseite (tischler.html, js/tischler.js)
- `#betrieb-logo`, `#betrieb-monogramm`, `#betrieb-name`
- `.t-reiter button`, `data-bereich`, `aria-pressed`, `#zaehler-neu`
- `#zugang`, `#zugang-form`, `#zugang-code`, `#zugang-fehler`
- `#posteingang`, `#einstellungen` (`hidden`), `#aktualisieren`
- `.t-filter button`, `data-filter`, `aria-pressed`
- `#liste`, `.t-eintrag` (`data-id`, `aria-current="true"`), `#liste-fehler`
- `#detail`, `[data-bild]`, `[data-aktion]` (annehmen, ablehnen, abbrechen, zuruecksetzen), `#ablehnen-form`, `#ablehnen-grund`, `#detail-fehler`
- Klassen aus JS: `t-hinweis`, `t-vorschau`, `t-eintrag-*`, `t-status`, `t-status-neu|angenommen|abgelehnt`, `t-leer`, `t-detail-kopf`, `t-bild`, `umschalter`, `t-ohne-bild`, `t-aktionen`, `t-ablehnen`, `t-knopf-ablehnen`, `t-ergebnis-*`, `t-grund`, `t-abschnitte`, `t-preis`, `t-nachricht`, `kv-daten`, `positionen`, `hinweis-platz`, `sonderliste`, `link-zurueck`, `knopf`, `knopf-haupt`, `knopf-leise`
- `#einstellungen-form`, `#einstellungen-felder` (`[data-pfad]`), `#einstellungen-fehler`, `#einstellungen-ok`, `#einstellungen-standard`
- Portfolio: `#portfolio-ansicht`, `#portfolio-liste` (`.t-moebel[data-moebel]`, `#moebel-hinzufuegen` mit `aria-expanded`), `#portfolio-status`, `#portfolio-auswahl`, `#katalog-liste` (`[data-katalog]`), `#katalog-schliessen`, `#eigenes-moebel-form`, `#eigenes-moebel`
- Leere Möbelseite: `#moebel-leer`, `#moebel-leer-titel`, `#moebel-leer-symbol`, `#moebel-entfernen` (`data-id`), `[data-portfolio="zurueck"]`
- Couchtisch: `#couchtisch-ansicht`; im Formular `[role="tab"][data-art]` (`#art-reiter-<id>`, `.t-art-titel`, `aria-selected`), `#art-panel-<id>`, `[data-neu]` (materialien mit `data-art`, materialart, gestelle, oberflaechen, optionen), `[data-entfernen]`, `[data-art-entfernen]`
- Hash-Ansichten: `#einstellungen`, `#einstellungen/<möbel-id>`
- Klassen aus JS: `t-einst-raster`, `t-einst`, `t-einst-breit`, `t-einst-zeilen`, `t-einst-drei`, `t-mit-entfernen`, `t-einst-spalte`, `t-einst-name`, `t-arten`, `t-arten-reiter`, `t-anzahl`, `t-art-panel`, `t-art-name`, `t-leer-hinweis`, `t-plus`, `t-entfernen`, `t-standard`, `t-moebel*`, `t-katalog*`
- Kundenseite: `.wahl-gruppe` (Zwischenüberschrift je Materialart im Baukasten)

## Neu in dieser Runde (js/kopf.js)
- `.kopfbereich` (fester Container), Klassen `verdichtet`, `kopf-weg`, `nicht-fest`; `.kopf-sentinel`; CSS-Variable `--kopf-hoehe` auf `html`

## Landingpage (tischlereien.html, js/landing.js)
- `#menue-knopf` (`aria-expanded`), `#hauptnavigation` (`hidden` auf schmalen Bildschirmen)
- `#pilot-form` (Felder name, betrieb, ort, email, telefon, nachricht, einwilligung, website = Spamfalle), `#pilot-fehler`, `#pilot-senden`, `#pilot-erfolg`
