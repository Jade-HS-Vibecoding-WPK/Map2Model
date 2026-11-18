# CLAUDE.md – Regeln für die Arbeit an Map2Model

Lies zuerst **PLAN.md**. Dort stehen Ziel, Ablauf, Must/Should/Could, alle fachlichen Regeln und der aktuelle Stand.

## Wer wir sind
- Zwei Architekturstudierende der Jade Hochschule. Wir können **nicht programmieren**, kennen uns aber mit Revit und Modellbau aus.
- Projekt der Vibecoding KI-Werkstatt (16.–20.11.2026). Abgabe: Repo auf GitHub (Organisation `Jade-HS-Vibecoding-WPK`) mit README bis Fr 16 Uhr, plus Poster.

## Wie du mit uns arbeitest
- **Erklär jeden Schritt einfach**, ohne Fachjargon. Sag vorher, was du vorhast, und danach, was wir sehen sollten und wo wir klicken müssen.
- **Ein Baustein pro Sitzung.** Klein anfangen, testen, dann weiter.
- Fertige, funktionierende Bausteine **committen** (Commit = Speicherstand) und auf Wunsch pushen.
- Nach jedem Baustein den Abschnitt **Stand** in PLAN.md aktualisieren.
- Wenn etwas technisch nicht geht oder riskant ist: **ehrlich sagen** und eine Alternative vorschlagen.
- Wir testen in Revit 2026 und schicken Screenshots. Fehlermeldungen kopieren wir komplett in den Chat.
- Was im Laserlabor passiert, organisieren wir selbst – dafür brauchst du nichts zu fragen.

## Technik
- Reine **Browser-App** auf **GitHub Pages**, kein Server, kein Build-Schritt.
- HTML + JavaScript-Module; Bibliotheken von CDN mit **fester Versionsnummer**.
- Keine API-Keys im Code oder auf GitHub.
- OpenStreetMap: Namensnennung „© OpenStreetMap-Mitwirkende“ immer sichtbar. Nominatim: höchstens 1 Anfrage pro Sekunde.
- Keine Daten aus Google Maps/Earth (Lizenz verbietet es).

## Gestaltung
- **Aktuelles Design (ersetzt Grün/Dunkel, Mi 18.11.)**: weiß mit roten Akzenten (Rot `#c8102e`, angelehnt an die Jade HS). Nur die zwei Hauptaktionen „IFC-Datei herunterladen“ und „Laserdatei herunterladen“ sind große rote Buttons mit hüpfendem Pfeil. Schritt 2 heißt „Im CAD-Programm bearbeiten“ (Programm-Auswahl + Arbeitsordner).
- (älter) **Startbildschirm** (dunkel): großer Titel „Von der Karte zum Lasermodell.“, isometrische Grafik eines geschichteten Modells, drei Schritt-Karten, grüner Button „Los geht’s“. Logo führt zurück zum Start.
- Stil der App: **Werkzeug-App** (wie Figma/CAD): **dunkle Seitenleiste** links (Logo, Schritte 1 Gebiet · 2 Revit · 3 Laserdatei, Felder des Schritts, Hauptbutton unten), große helle Fläche rechts (Karte bei 1+2, Laserbett-Vorschau bei 3). Schrift Inter, Maße in JetBrains Mono.
- Akzentfarbe **Grün `#15803d`** – **eigene gestalterische Entscheidung:** Jede Hauptaktion ist ein grüner Button („Los geht’s“, „Download“, „Weiter“, „Laserdatei erzeugen“). Pro Ansicht genau **ein** Hauptbutton, alles andere leiser.
- Karte: **farbige** OpenStreetMap-Karte; das Gebiet hat einen grünen Rand mit weißem Saum, damit es gut sichtbar bleibt.
- Die Aufteilung in die drei Schritte und die übersichtlichen Felder gefallen uns – beibehalten.
- Suche oben in der Seitenleiste, wie bei openstreetmap.org.
- Upload als **„+“-Feld** zum Hineinziehen oder Anklicken.
- Sichtbares Feedback bei jedem Klick (lädt / fertig / Fehler).
- Fehler verständlich formulieren, z. B. „Adresse nicht gefunden. Schreibweise prüfen?“ statt „Error 500“.

## Unverrückbare Fachregeln (Details in PLAN.md)
- Alles in der IFC ist eine **eigene Extrusion** (Allgemeines Modell), Name beginnt mit Kennwort: `Gelände_` (Bodenplatte), `Gebäude_`, `Straße_`, `Wasser_`, `Grün_`, `Baum_`, `Brücke_`, `Bahn_`, Neues mit `Neubau_`. In Revit muss sich alles in einzelne Elemente auflösen lassen.
- Laserdatei nach **Jade-HS-Regeln**: RGB Rot = schneiden, Blau = ritzen, Gelb = Rahmen, Schwarz (echt 0,0,0) = Gravur/Fläche/Schrift; Linienart 0,00 mm; gelber Rahmen 1000 × 600 mm; 5 mm Abstand; keine doppelten Linien; Schrift als Kontur; DXF + SVG.
- Maßstab ist ein Pflichtfeld „1 : ___“.
- Gravuren sind **fein** (blau geritzte Einzellinien-Schrift, 1,5–2,5 mm) und liegen auf der **Rückseite** (Teile gespiegelt geschnitten) – am fertigen Modell unsichtbar. Übersichtspläne werden nie gelasert oder gezählt.
- Jedes Teil trägt eine Gravur, die auch auf der Grundplatte steht: **der eigene Name aus Revit** plus Schicht (z. B. `NEUBAU GEBÄUDE 1-3`); passt er nicht, für dieses Bauteil einheitlich die Kurzform (`N1-3`). Zu jeder Laserdatei gehört der Bauplan `00_Uebersicht.html`. Teile eines Bauteils liegen zusammen auf einer Platte.
- Höhenebenen: realistische Höhe → Maßstab → ganze Schichten, mindestens 1 Schicht (Grün +, Straße −, Wasser tiefer).
- Zu großes Gebiet → Grundplatte gerade auf mehrere Platten teilen, mit `A`, `B` und `A ⟷ B` an der Fuge.

## KI-Nutzung
Dieses Projekt wird mit Claude Code (KI-Coding-Agent) entwickelt. Das wird im README nach den Regeln der Hochschule angegeben.
