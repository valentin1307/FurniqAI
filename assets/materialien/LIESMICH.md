# Holz-Musterbilder

Die Seite lädt für jedes Material automatisch `assets/materialien/<id>.jpg`.
Fehlt eine Datei, zeigt sie eine gezeichnete Ersatz-Maserung (CSS).

Benötigte Dateien (Dateiname = `id` aus `js/betrieb.js`):

| Datei                 | Material        |
|-----------------------|-----------------|
| `eiche-massiv.jpg`    | Eiche massiv    |
| `nuss-massiv.jpg`     | Nuss massiv     |
| `esche-massiv.jpg`    | Esche massiv    |
| `eiche-furniert.jpg`  | Eiche furniert  |
| `mdf-lackiert.jpg`    | MDF lackiert    |

Empfehlung:
- Draufsicht auf die Holzoberfläche, gleichmäßiges Licht, Maserung quer (waagerecht) im Bild.
- Querformat, etwa 600 × 300 px (wird auf 64 px Höhe zugeschnitten, mittig).
- JPG, unter 80 KB pro Datei.
- Nur Bilder mit Nutzungsrecht (eigene Fotos der Tischlerei oder lizenzfreie Quellen).

Kommt später ein neues Material in `betrieb.js` dazu, einfach `<neue-id>.jpg` hier ablegen.
Das gilt auch für Materialien anderer Materialarten (Stein, Stahl, Glas) und für eigene Materialien,
die die Tischlerei in den Einstellungen anlegt (`eigen-<name>`, die genaue ID steht im Browser-Speicher
unter `furniqai.betrieb`). Ohne Bild zeigen sie eine einfarbige Fläche passend zur Materialart.

Hinweis: Solange die Bilder fehlen, meldet die Browser-Konsole für jedes Material einen 404-Fehler.
Das ist erwartet und stört die Seite nicht.
