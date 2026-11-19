# PLAN – Map2Model

> Stand: Di 17.11.2026 · Vibecoding KI-Werkstatt, Jade Hochschule
> Dieses Dokument ist das Projektgedächtnis: Was wir bauen, warum, und wie weit wir sind.
> Nach jedem fertigen Baustein wird der Abschnitt **Stand** aktualisiert.

---

## 1. Idee in einem Satz

Adresse eingeben → Gebiet mit Rechteck wählen → IFC-Datei für Revit herunterladen → in Revit Abriss löschen und Neubauten einsetzen → Datei wieder hochladen → fertige Laserdatei (nach den Regeln der Jade HS) für ein Städtebaumodell herunterladen.

**Von der Map zum Model.**

## 2. Für wen

Architekturstudierende, die ein Städtebau-/Umgebungsmodell lasern wollen – ohne CAD-Vorarbeit. Erstes Testgebiet: Wilhelmshaven, Kaiser-Wilhelm-Brücke mit Nordfrost-Gelände und Insel. Die App muss aber **für jede Adresse** funktionieren.

## 3. Ablauf der App (Bildschirme)

### ① Suche & Gebiet
- Oben ein Suchfeld wie bei openstreetmap.org (Nominatim).
- Karte springt zur Adresse, ein **Rechteck** erscheint; es lässt sich verschieben und an den Ecken ziehen.
- **Grüner Button „Download“** → IFC-Datei für Revit.

### ② In Revit (außerhalb der App)
- IFC in Revit 2026 öffnen.
- Abrissgebäude löschen, Neubauten / neue Straßen / Brücken als **Allgemeines Modell (Extrusion)** einsetzen.
- Als IFC exportieren.

### ③ Datei wieder hochladen
- **„+“-Feld** (Datei hineinziehen oder anklicken).
- Danach erscheinen die Felder:

| Feld | Art |
|---|---|
| Plattengröße | Breite × Höhe in mm (max. 990 × 590, siehe Laserregeln) |
| Material | Freitext / Auswahl (z. B. Graupappe, Holz, Acryl) |
| Materialstärke | mm |
| **Maßstab** | Eingabe **1 : ___** – wird für jedes Modell selbst angegeben, Pflichtfeld |
| Bauweise | Schalter **Geschichtet** / **Volumen** |
| Höhen | Straßen, Wasser, Grün in Schichten – mit realistischen Vorschlagswerten (siehe 6.3), änderbar |
| Beschriftung | Freitext (Name, Projekt, Maßstab …) – wird schwarz auf die Grundplatte graviert |

- **Grüner Button** „Laserdatei erzeugen“.
- Vor dem Download: Hinweis „Benötigt: X Platten [Material] [Stärke]“.

### ④ Download
- Laserdatei als **DXF** und **SVG**.

## 4. Must / Should / Could

| | Inhalt |
|---|---|
| **Must** | Suche → Rechteck → grüner Download (IFC) → „+“-Upload → Felder → grüner Button → Laserdatei **geschichtet**, mit Nummerierung, Beschriftung, Höhenebenen (Straße/Wasser/Grün), **Aufteilung auf mehrere Platten**, alle Jade-Laserregeln. Online auf **GitHub Pages**. |
| **Should** | **Volumenmodell** (Wände + Dach), 3D-Vorschau, Vorschau der Laserdatei vor dem Download, Materialbedarf-Anzeige |
| **Could** | ~~Vereinfachte Stahlbrücke (Kaiser-Wilhelm-Brücke)~~ ✅ erledigt, Brücken-Seitenplatte mit Fachwerk-Gravur für den Laser, Projekte speichern, genauere Gebäudehöhen für Niedersachsen (LGLN LoD2), weitere Exportformate (OBJ, DXF-3D) |

## 5. Technik (Entscheidungen)

- **Reine Browser-App**, veröffentlicht auf **GitHub Pages** im Repo `Jade-HS-Vibecoding-WPK/Map2Model`. Kein eigener Server. Rechte dafür sind vorhanden.
- Kein Build-Schritt: HTML + JavaScript-Module, Bibliotheken mit fester Version per CDN.
- Bibliotheken (vorgesehen):
  - Karte: **Leaflet** (+ OpenStreetMap-Kacheln, Namensnennung Pflicht)
  - Adresssuche: **Nominatim** (max. 1 Anfrage pro Sekunde)
  - Geodaten: **Overpass API** (OpenStreetMap)
  - IFC einlesen: **web-ifc**
  - IFC schreiben, DXF schreiben, SVG schreiben: eigener Code
  - 2D-Geometrie (Verschneiden, Vereinigen, Versatz): Polygon-Bibliothek (z. B. Clipper)
  - 3D-Vorschau (Should): **three.js**
- Keine API-Keys nötig. Falls doch einmal: nie in den Code, nie auf GitHub.

### Datenquellen und Gebäudehöhen
Reihenfolge für die Höhe eines Gebäudes:
1. OSM `height`
2. OSM `building:levels` × 3 m
3. Standardwert: 2 Geschosse (6 m); Garagen/Schuppen 1 Geschoss (3 m)

**Google Earth / Google Maps:** dürfen nicht verwendet werden – die Nutzungsbedingungen verbieten das Herunterladen und Weiterverarbeiten der 3D-Daten, und es gibt keinen offenen Zugang dafür.
**TopoExport:** eigenständiger Dienst ohne offene Schnittstelle, kann von der App nicht automatisch abgefragt werden.
→ Falsche Höhen korrigiert man in Revit (Gebäude löschen, mit richtiger Höhe neu als Extrusion zeichnen). Could: LGLN-LoD2-Höhen für Niedersachsen.

## 6. Fachliche Regeln

### 6.1 Was in der IFC-Datei steckt
Jedes Element ist eine **eigene Extrusion** (Allgemeines Modell in Revit) mit Namen, der mit einem Kennwort beginnt:

| Kennwort | Inhalt |
|---|---|
| `Gelände_` | Bodenplatte über das ganze gewählte Rechteck |
| `Gebäude_` | Bestandsgebäude |
| `Straße_` | Straßen, Wege |
| `Wasser_` | Gewässer, Hafenbecken |
| `Grün_` | Grünflächen, Parks, Wiesen, Wald |
| `Baum_` | Einzelbäume |
| `Brücke_` | Brücken |
| `Bahn_` | Eisenbahn, Gleise |
| `Neubau_…` | von den Nutzern in Revit ergänzt, z. B. `Neubau_Gebäude_1`, `Neubau_Straße_1` |

Anforderung an die IFC: In Revit muss sich alles **in einzelne Elemente auflösen** lassen – jedes Gebäude, jede Fläche einzeln anklickbar, löschbar, verschiebbar (kein zusammenhängender Block). Das ist ein Kernversprechen der App.

### 6.2 Regeln für die Arbeit in Revit
1. Projektbasispunkt und Vermessungspunkt **nicht verschieben**.
2. Neues immer als **Allgemeines Modell (Extrusion)**.
3. Name beginnt mit `Neubau_` + Kennwort (siehe oben).

### 6.3 Höhenebenen der Grundplatte
Echte Höhe → in den Maßstab umrechnen → auf ganze Materialschichten runden → **mindestens 1 Schicht**.

| Element | Echte Höhe (Grundlage) | Beispiel 1:500, 1 mm Pappe |
|---|---|---|
| Grün | +10 cm | +1 Schicht (eigene dünne Teile zum Aufkleben) |
| Grundplatte (Gehweg, Platz, Grundstück) | 0 | 0 |
| Straße | −15 cm | −1 Schicht |
| Wasser | −2 m | −4 Schichten |

Aufbau der Grundplatte (Beispiel):
```
  +1   ▓▓▓ Grün (aufgeklebt)
   0   ████████    ███████████    ████   ← Straßen + Wasser ausgeschnitten
  −1   ████████████████████████   ████   ← nur Wasser ausgeschnitten
  −2…  ████████████████████████   ████   ← nur Wasser ausgeschnitten
 unten ████████████████████████████████  ← durchgehend = Wasserspiegel
```
Bahngleise: Gravurlinie. Bäume: kleine Kreise (Gravur). Brücken: Fahrbahnplatte als eigenes Teil über dem Wasser, mit Stützen.

### 6.4 Gebäude
- **Geschichtet:** Gebäude in Schichten der Materialstärke, jede Schicht = Grundriss, rot geschnitten.
- **Volumen:** Wände entlang des Grundrisses (mit Ausgleich der Materialstärke an den Ecken) + Dachplatte.

### 6.5 Nummerierung (Gravur, schwarz)
| Teil | Gravur |
|---|---|
| Grundplatte, Position von Gebäude 1 | `1` |
| Schichten von Gebäude 1 | `1-1`, `1-2`, `1-3` … (von unten nach oben) |
| Wände von Gebäude 1 / Dach | `1-A`, `1-B`, `1-C` … / `1-D` (letzter Buchstabe) |
| Grünteile | `G1`, `G2` … (+ Position auf der Platte) |
| Brücken | `B1`, `B2` … |
| Teile der Grundplatte bei Aufteilung | `A`, `B` …, an der Fuge `A ⟷ B` |
| Ebenen der Grundplatte | z. B. `A 0`, `A −1`, `A −2` |
Mindest-Schrifthöhe 1,8 mm. Text wird als feine Einstrich-Linie ausgegeben (keine Schriftart nötig). Straßennamen werden schwarz auf den Straßenboden graviert.

### 6.6 Aufteilung auf mehrere Platten
- Passt das Gebiet im eingegebenen Maßstab nicht auf eine Platte, zeigt die App das verständlich an.
- Die Grundplatte (alle Ebenen) wird an **geraden Linien** in möglichst wenige, gleich große Teile geteilt.
- Straßen, Wasser, Grün laufen über die Fuge exakt weiter; Gebäude werden **nicht** zerschnitten.
- Vorschau zeigt die Teilungslinie.

### 6.7 Laserregeln der Jade Hochschule (verbindlich)
- Farben als **RGB**: Rot (255,0,0) = durchschneiden · Blau (0,0,255) = anritzen · Gelb (255,255,0) = Rahmen/Orientierung · Schwarz (0,0,0) = Gravur, Flächen, Schrift mit Füllung
- Schwarz als echte RGB-Farbe 0,0,0 (nicht AutoCAD-Farbe 7)
- Linienart **0,00 mm**
- Immer gelber Rahmen **1000 × 600 mm**, alle Elemente **mind. 5 mm** Abstand zum Rahmen
- Keine doppelten Linien („Overkill“), keine Hintergrundinformationen („Bereinigen“)
- Schrift als Kontur → keine Schriftart nötig
- DXF ist Hauptformat (Labor arbeitet mit AutoCAD), SVG zusätzlich
- Vor dem Download: automatische Prüfung dieser Regeln, bei Verstoß verständliche Warnung

## 7. Bekannte Grenzen (ehrlich)
- Gebäudehöhen aus OSM sind oft geschätzt.
- Echte Revit-Wände entstehen nicht – alles ist Allgemeines Modell (so gewollt).
- Schrägdächer werden im Volumenmodell nicht abgebildet.
- Details unter ca. 1 mm im Modell (Balkone, Zäune, Laternen) fallen weg.
- Offenes Meer ist in OSM als Küstenlinie statt als Fläche eingetragen – muss für Wilhelmshaven (Jade) gesondert behandelt werden.
- Formgenaues Anordnen der Teile ist nicht geplant; Teile werden über ihre Hüllrechtecke angeordnet.

## 8. Zeitplan

| Tag | Etappe |
|---|---|
| Mo 16.11. | Idee & Plan ✅ |
| **Di 17.11.** | Grundgerüst & Aussehen: Seite, Suche, Karte, Rechteck, grüner Download-Button; GitHub Pages einrichten |
| Mi 18.11. | Daten & Laser: OSM-Daten → IFC; IFC-Upload; Laserdatei geschichtet, Nummern, Höhenebenen, Aufteilung |
| Do 19.11. | Volumenmodell, Vorschau, Tests mit Revit; **12 Uhr Funktionsstopp**, dann Poster |
| Fr 20.11. | Polieren, README (inkl. KI-Kennzeichnung, Quellen), **bis 16 Uhr auf GitHub**, Präsentation |

Für die Präsentation: fertige Beispieldateien (IFC + Laserdatei) als Ersatz bereithalten, falls Internet ausfällt.

## 9. Stand

- [x] Repo geklont, Git installiert
- [x] Plan abgestimmt (dieses Dokument)
- [x] Grundgerüst & Aussehen (Di 17.11.) – `index.html`, `css/style.css`, `js/`
- [x] Suche + Karte + Rechteck (Nominatim, Leaflet, Ecken ziehen / Mitte verschieben, Größe in m)
- [x] Laser-Ansicht: „+“-Feld, alle Felder, Pflichtprüfung, Höhen-Vorschlag aus Maßstab (noch ohne Laserdatei)
- [x] Design als Werkzeug-App: dunkle Seitenleiste mit Schritten 1–2–3, farbige Karte, Schritt 2 mit Revit-Anleitung, Laserbett-Vorschau mit Modellgröße, Anzahl Grundplatten-Teile und geschätzter Plattenzahl
- [x] Startbildschirm mit Titel, Modell-Grafik und den drei Schritten (`js/startseite.js`)
- [x] OSM-Daten → IFC-Download (Di 17.11.): `js/osm.js` (Overpass, Ersatz: openstreetmap.org-API bei Überlastung), `js/geometrie.js` (Meter-Umrechnung, Zuschneiden, Straßenbreiten, Multipolygone, Meer aus Küstenlinie), `js/ifc-export.js` (IFC2X3, je Element ein IfcBuildingElementProxy mit Extrusion, Farbe, Eigenschaften „Map2Model“). Geprüft mit web-ifc: Wilhelmshaven 400 × 250 m → 95 Elemente, alle mit Geometrie, Namen korrekt.
- [ ] **Revit-Test der IFC durch das Team** (öffnen, einzeln anklicken/löschen, Neubau einsetzen, zurück exportieren)
- [x] IFC-Upload einlesen (`js/ifc-import.js`, web-ifc 0.0.66): Kategorie über Kennwort irgendwo im Namen/Typ/Beschreibung, Umlaute egal; Neubau an „neubau“; Bauteile ohne Kennwort mit Höhe → Neubau-Gebäude.
- [x] **Laserdatei** (Di 17.11.): `js/laser.js`, `js/schrift.js`, `js/laser-export.js`
  - Grundplatte in Ebenen (oben: Straßen + Wasser ausgeschnitten; darunter nur Wasser; unten durchgehend), Aufteilung in Teile A, B … mit „> B“ an der Fuge, Kennzeichnung „A -2“.
  - Oberste Ebene: Gebäude/Grün/Brücken blau angeritzt + Nummer graviert, Bäume als Kreise, Gleise als Gravurlinie, Beschriftung.
  - Gebäude **geschichtet** (Schnitt in jeder Schichthöhe – auch Sockel/Turm und Schrägdächer stufig) mit Nummer `12-3`; **Volumen**: Wände `12-A…` + `12-DACH`.
  - Neubauten (`N3-1`) und Grün (`G4`) auf eigenen Platten; Teile gedreht und in Reihen angeordnet (3 mm Abstand, 4 mm zum Plattenrand).
  - Doppelte/überlappende Linien werden entfernt (Rang rot > blau > schwarz); automatische Prüfung der Jade-Regeln.
  - Schrift = gefüllte 5×7-Rasterschrift → keine Schriftart nötig.
  - Download: ZIP mit `DXF/` (R12, Layer je Farbe), `SVG/` (exakte RGB) und `LIESMICH.txt`.
  - Test Wilhelmshaven 400 × 300 m, 1:500, 1 mm: 13 Platten (10 Grundplatte, 2 Gebäude, 1 Grün), alle Prüfungen bestanden, < 1 s Rechenzeit.
  - DXF-Schwarz = AutoCAD-Farbe 7 (Schwarz/Weiß); bei Bedarf Layer GRAVUR_SCHWARZ in AutoCAD auf True Color 0,0,0 stellen. Noch nicht im Laserlabor getestet.
- [x] Laserdatei (geschichtet)
- [x] Aufteilung auf mehrere Platten
- [x] Volumenmodell (einfach: Wände + Dach)
- [ ] Vorschau
- [ ] GitHub Pages online
- [ ] README + Poster

### Dateien
- `index.html` – Seite mit zwei Ansichten: `#gebiet` und `#laser`
- `css/style.css` – Gestaltung (Akzentfarbe Grün `#15803d`)
- `js/app.js` – gemeinsamer Zustand `M2M` (Gebiet, Datei), Ansichtswechsel, Rückmeldungen
- `js/suche.js` – Adresssuche (Nominatim, max. 1 Anfrage/s)
- `js/karte.js` – Karte + Rechteck; Gebiet liegt in `M2M.gebiet` (sued, west, nord, ost, breiteM, hoeheM)
- `js/laser-ansicht.js` – Upload-Feld, Felder, Prüfung, Höhenvorschlag
- Ohne Build-Schritt; zum lokalen Testen über einen kleinen Webserver öffnen (nicht per Doppelklick, sonst fehlen Karte und Stil).

### Korrektur nach dem ersten Revit-Test (Di 17.11.)
Problem: In Revit erschienen nur Wasser, Brücke und 2–3 Gebäude, obwohl die Datei 311 Gebäude und 222 Straßen enthielt. Keine Bodenplatte.
Behoben:
- Alle Umrisse werden gesäubert: Punkte < 5 cm Abstand und Punkte auf Geraden entfernt, Drehsinn außen gegen den Uhrzeigersinn, Löcher im Uhrzeigersinn (vorher bei ~60 % der Gebäude und allen Straßen falsch herum).
- Straßen werden an scharfen Knicken (> 60°) geteilt; sich selbst schneidende Umrisse gibt es nicht mehr (vorher 3).
- Unvollständige Overpass-Antworten (Hinweis „remark“) werden erkannt → Ersatzweg.
- Neu: **`Gelände_1`** = Bodenplatte über das ganze Rechteck (−0,3…0 m). Wasser liegt 1 cm darüber, Straßen und Grün darauf.
Prüfung: 1000 × 700 m an der Brücke → 815 Elemente (333 Gebäude, 216 Straßen, 239 Bäume, 15 Brücken, 8 Grün, 3 Wasser, 1 Gelände), alle mit Geometrie (web-ifc), 0 Selbstüberschneidungen.
Noch offen: erneuter Test in Revit 2026.

### Zweite Korrektur nach Revit-Test (Di 17.11.)
Wunsch: Straßen als ein zusammenhängendes Bauteil, keine übereinanderliegenden Flächen, schönere Bäume.
Umgesetzt (Bibliothek `polygon-clipping` 0.15.7):
- Straßen, Wasser, Bahn, Grün und Brücken werden je Kategorie **zu einer Fläche verschmolzen**.
- **Keine Überlagerung mehr**, Rangfolge: Wasser > Straße > Bahn > Grün (Höheres wird aus Niedrigerem herausgeschnitten). Brücken liegen erhöht darüber.
- Ergebnis 1000 × 700 m: 216 Straßenstücke → **6 zusammenhängende Straßennetze** (mit 88 Aussparungen für die Baublöcke).
- **Bäume** = Stamm (braun, achteckig) + runde Krone (grün) als eigener Körper.
- Prüfung web-ifc: 603 Elemente, alle mit Geometrie; 0 Selbstüberschneidungen.

### Brücke mit Stahlkonstruktion (umgesetzt Di 17.11.)
- Automatisch für jede Brücke nicht möglich (OSM kennt keine Tragkonstruktion).
- **Sondermodell Kaiser-Wilhelm-Brücke** in `js/bruecke-kw.js`: wird automatisch eingesetzt, wenn die Brücke (OSM-Name „Kaiser-Wilhelm-Brücke“) im Gebiet liegt. Lage und Richtung aus den OSM-Brückenwegen.
- Daten: Wikipedia (159 m lang, 8 m breit, Pfeilerabstand 80 m, Stützen ca. 20,4 m) + frei lizenzierte Fotos (Wikimedia Commons). Google Maps/Earth wurde **nicht** verwendet (Nutzungsbedingungen).
- Aufbau: Fahrbahnplatte, 2 Stahlportale über den Drehpfeilern, gebogene Obergurte zu beiden Flügelenden, Untergurte, Hänger, Diagonalen, Querriegel → 238 Stahlstäbe, ein Element `Brücke_Kaiser-Wilhelm` (Farbe Stahlblau).
- **Nicht maßgenau** (Bogenform, Stabquerschnitte nachempfunden). Im Lasermodell: Fahrbahn als Teil; Stahl bei 1:500 < 1 mm → später nur als Seitenplatte mit Gravur sinnvoll.

### Bekannte Punkte aus dem IFC-Baustein
- Overpass war beim Test überlastet; die App weicht nach 2 × 15 s auf die openstreetmap.org-API aus (nur kleine Gebiete, < 0,24 Grad²). Das dauert dann ca. 30–40 s.
- In Wilhelmshaven fehlt bei etwa der Hälfte der Gebäude die Höhe → Schätzung 2 Geschosse.
- Darstellungshöhen in der IFC (nur für Revit): Wasser −0,5…0 m, Straße 0,05 m, Grün 0,1 m, Bahn 0,15 m, Brücke 2–2,8 m, Bäume Zylinder 8 m. Die Laserdatei rechnet ihre Ebenen aus der **Kategorie**, nicht aus diesen Höhen.

### Korrektur Laserdatei nach erstem Test (Di 17.11.)
Problem: zu viele Grundplatten-Dateien (jede Ebene × jedes Teil), unklare Namen.
Behoben:
- Ebenen mit gleicher Form = **eine Datei mit Anzahl** („3× schneiden“).
- Wassertiefe-Vorschlag jetzt −1 m echt → bei 1:500 / 1 mm = **2 Schichten** → je Teil nur **Bodenplatte, Zwischenebene (Straßenboden), Wasser (unten)**.
- Platten durchnummeriert in Bau-Reihenfolge: **Platte 01 · Gebäude, … · Grün, … · Bodenplatte, … · Zwischenebene, … · Wasser**. Dateinamen gleich.
- Anzeige und LIESMICH: **„Benötigt: X × Finnpappe“** (Kopien mitgezählt). Material-Vorgabe „Finnpappe“.
- Beispiel 800 × 500 m: 1:500 geschichtet → 19 Dateien/19 Pappen (4 Grundplatten-Teile); 1:900 Volumen → 5 Pappen (Gebäude, Grün, Bodenplatte, Zwischenebene, Wasser).

### Dachform-Auswahl (Mi 18.11.)
- Schritt 1: Umschalter **Flachdach / Satteldach** für die IFC (`js/dach.js`).
- Satteldach: First in der Mitte entlang der langen Seite (kleinstes umschließendes Rechteck), 40° Neigung, Dachhöhe 1,5–7 m; OSM `roof:height`, `roof:levels`, `roof:orientation=across` werden genutzt. Mit bekannter Gesamthöhe (OSM `height`) liegt der First auf dieser Höhe, sonst kommt das Dach auf die Traufe obendrauf.
- Bleiben flach: Innenhof, Nebengebäude (Garage, Schuppen …), OSM `roof:shape=flat`, breiter als 22 m (Hallen).
- IFC: je Gebäude zwei Körper (Wände bis Traufe hell, Dach rot) als Brep; Eigenschaft „Dach“ mit Traufe/First.
- Laserdatei: Dächer werden automatisch stufig geschichtet. Test 350 × 250 m: 115 Satteldächer, 5 flach, alle 168 Elemente mit Geometrie, Laser-Prüfung ok.

### Übersichtlichere Laserdatei (Mi 18.11.)
- **Gravur = eigener Name aus Revit** (z. B. „NEUBAU GEBÄUDE 1-3“, „GEBÄUDE 12-5“). Revit-Zusätze („Familie:Typ:123456“) werden entfernt, `_` → Leerzeichen. Passt der Name nicht aufs Bauteil, bekommt **dieses Bauteil überall** dieselbe Kurzform („N1“, „12“, „G3“).
- **Bauplan `00_Uebersicht.html`** im ZIP (und Knopf „Bauplan / Übersicht öffnen“ in der App): Kennzahlen, **Lageplan** mit allen Gravuren (Bestand weiß, Neubau grün, Teile A/B rot gestrichelt), **Bauanleitung** von unten nach oben, **Plattenliste** (was liegt wo, Schichten), **Bauteilliste** (Gravur → Name → Höhe → Platten). Im Browser als PDF druckbar.
- **Anordnung**: Teile eines Bauteils liegen zusammen und in Schicht-Reihenfolge auf **einer** Platte (Test: 0 Gebäude auf mehreren Platten, gleiche Pappenzahl).

### Neues Design, Schritt 2 „CAD-Programm“, Aufteilungsplan (Mi 18.11.)
- **Design**: weiß mit roten Akzenten (Rot `#c8102e`, angelehnt an die Jade HS). Nur „IFC-Datei herunterladen“ und „Laserdatei herunterladen“ sind große rote Buttons mit hüpfendem Pfeil „Hier geht’s weiter“; alles andere ist zurückhaltend (`knopf-zweit`).
- **Schritt 2 = „Im CAD-Programm bearbeiten“** (`js/arbeitsordner.js`): Auswahl Revit, Archicad, Vectorworks, Allplan, BricsCAD, FreeCAD, Blender/Bonsai, Anderes → passende Klick-Anleitung. **Arbeitsordner** (nur Chrome/Edge, File System Access API): App speichert die IFC dort und erkennt beim Zurückkommen eine neu gespeicherte IFC automatisch → Schritt 3. Ein CAD-Programm selbst starten kann keine Website (Browser-Sicherheit). Getestet mit Browser-internem Ersatzordner.
- **Gravur auf Teilen = Gravur auf der Bodenplatte** (z. B. „N1“ / „GEBÄUDE 12“), darunter klein „SCHICHT 3“ / „WAND A“ / „DACH“.
- **Platte 00 · Aufteilungsplan** (optional lasern): verkleinertes Modell mit Teilen A, B … und je Teil „OBEN P11 / MITTE P15 / WASSER P19“.
- **`00_Alle_Platten_nebeneinander.dxf/.svg`** im ZIP + als erste Ansicht in der Vorschau (zum Ansehen, nicht zum Lasern).
- Hinweis: Durch zweizeilige Gravur und „ein Gebäude = eine Platte“ braucht es etwas mehr Gebäudeplatten (Test 800 × 500 m: 8 statt 6).

### Feinschliff Laserdatei + CAD-Ablauf (Mi 18.11., Nachmittag)
- **Feine Gravur**: alle Beschriftungen auf Teilen und Bodenplatte als **Einzellinien-Schrift, blau geritzt**, 1,5–2,5 mm hoch (`M2M.textLinien` in `js/schrift.js`). Nur die frei wählbare Beschriftung bleibt schwarz gefüllt.
- **Gravur auf der Rückseite**: alle Gebäude-, Grün- und Brückenteile werden **gespiegelt** geschnitten, die Schrift spiegelverkehrt → umgedreht verbaut liegt sie unten (Schichten/Dach) bzw. innen (Wände). Hinweis dazu in der App.
- **Übersicht / Aufteilungsplan**: alle Bauteile mit ihrer Gravur beschriftet; **kein Schnitt, nicht gelasert, nicht gezählt**.
- **Einkaufszeile**: „X Platten à B × H mm · Material Stärke“ in der App (Kasten „Einkaufen“), unten rechts, im LIESMICH und im Bauplan.
- **Schritt-2-Ablauf**: Nach dem Erzeugen fragt die App „Darf Map2Model sie in deinem CAD-Programm öffnen?“ → Ja → Download (mit einmaliger Browser-Einstellung „Dateien dieses Typs immer öffnen“ öffnet sie sich direkt im CAD-Programm) → Rückkehr zur Website wird erkannt → **Schritt 3 mit „Willkommen zurück! IFC-Datei einfügen“** (Dateiauswahl startet im Download- bzw. Arbeitsordner). Getestet mit simuliertem Verlassen/Zurückkommen.

### CAD-Programm direkt öffnen: Map2Model-Öffner (Mi 18.11., Abend)
- Wunsch: „Ja“ → Liste der CAD-Programme → Revit öffnet sich mit der IFC. Eine Website allein darf keine Programme starten.
- Lösung: **Map2Model-Öffner** (`oeffner/`): `Installieren.cmd` (einmal doppelklicken, ohne Adminrechte) meldet für den eigenen Benutzer die Adresse `map2model://` an und kopiert `oeffner.ps1` nach `%LOCALAPPDATA%\Map2Model-Oeffner`. `Deinstallieren.cmd` entfernt alles.
- Ablauf: „Ja, im CAD-Programm öffnen“ → **Liste** (Revit, Archicad, Vectorworks, Allplan, BricsCAD, FreeCAD, Standardprogramm) → IFC wird heruntergeladen → Website ruft `map2model://oeffnen?programm=revit&datei=…` auf → Öffner sucht die Datei im Download-Ordner und startet das Programm mit der Datei; Dateipfad zusätzlich in der Zwischenablage.
- Sicherheit: nur `.ifc` aus dem eigenen Download-Ordner (≤ 5 Min. alt), nur Programme aus der festen Liste, Dateiname wird geprüft.
- Ist der Öffner nicht installiert (kein Wechsel ins Programm nach ~9 s), zeigt die App eine Anleitung + Knopf „Map2Model-Öffner herunterladen“ (ZIP).
- Getestet: Öffner im Probe-Modus findet `C:\Program Files\Autodesk\Revit 2026\Revit.exe`, lehnt falsche Dateinamen ab; Website-Liste und Hinweis im Browser. **Nicht getestet**: echtes Starten von Revit mit IFC (Revit evtl. ohne Datei → Datei → Öffnen → IFC → Strg + V).

### Nur noch zwei Schritte (Mi 18.11., Abend)
- Schritt 2 „Im CAD-Programm bearbeiten“ ist **entfernt**. Die App hat jetzt **1 Gebiet wählen** und **2 Laserdatei**.
- Das Öffnen im CAD-Programm bleibt: nach „IFC-Datei herunterladen“ → Frage → **Liste der Programme** → Map2Model-Öffner startet das Programm. Rückkehr → Schritt 2 mit „IFC-Datei einfügen“.
- Arbeitsordner-Funktion (File System Access) entfernt; Benennungsregeln als aufklappbarer **Tipp unter dem Upload-Feld**.
- Startseite: Karten „1 Gebiet wählen · ↔ dazwischen dein CAD-Programm · 2 Laserdatei“.

### Schritt 2 wieder da + Revit-Add-in (Mi 18.11., Abend)
- Revit kann eine IFC nicht beim Start öffnen („Datei kann nicht geöffnet werden“) – sie muss in Revit über **Datei → Öffnen → IFC** geladen werden.
- Lösung: **Map2Model-Add-in für Revit 2026** (`addin/App.cs`, gebaut mit .NET 10 SDK → `oeffner/Map2ModelRevit.dll` + `Map2ModelRevit.addin`). Der Öffner legt `%LOCALAPPDATA%\Map2Model-Oeffner\auftrag.txt` mit dem IFC-Pfad ab und startet Revit **ohne** Datei (oder holt ein offenes Revit nach vorne). Das Add-in prüft im Leerlauf (Idling) jede Sekunde den Auftrag und öffnet die IFC mit `Application.OpenIFCDocument` (= „IFC öffnen“), speichert als `<Name>.ifc.rvt` daneben und zeigt das Projekt an.
- `Installieren.cmd` kopiert das Add-in nach `%APPDATA%\Autodesk\Revit\Addins\2026\`. Revit fragt beim ersten Start einmal „Immer laden“.
- **Schritt 2 „Im CAD-Programm bearbeiten“ ist wieder da**: nach dem IFC-Download springt die App hierher; Programmliste + roter Button „In Revit öffnen“; Rückkehr → Schritt 3 „IFC-Datei einfügen“. Der Frage-Dialog ist entfallen.
- .NET 10 SDK nur für den Benutzer installiert (`%LOCALAPPDATA%\Microsoft\dotnet-sdk`, offizielles Microsoft-Skript, ohne Adminrechte).
- **Noch nicht in Revit getestet.**

### Schrift, Spiegelung, Straßennamen (Mi 18.11., spät)
- **Schrift nicht mehr spiegelverkehrt**: Nur die **Form** der Teile wird gespiegelt geschnitten, die Schrift bleibt normal. Umgedreht verbaut liegt die Gravur unten/innen und ist von unten **richtig herum** lesbar.
- **Neue feine Einstrich-Schrift** mit runden Bögen (`js/schrift.js`, `M2M.textLinien`, `M2M.textBreite`, `M2M.gross` – „ß“ bleibt „ß“). Jede Linie wird einmal abgefahren, keine Schriftart, keine Füllung mehr. Ersetzt die alte 5×7-Pixelschrift überall (Teile, Bodenplatte, Beschriftung, Aufteilungsplan, „Alle Platten“). Mindesthöhe 1,8 mm (Großbuchstaben ≈ 1,5 mm).
- **Straßennamen als Gravur** (schwarz) auf dem **Straßenboden** (Zwischenebene bzw. untere Platte – man sieht ihn durch die ausgeschnittene Straße). `osm.js` merkt sich die Mittellinien benannter Straßen, `karte.js` speichert sie in `M2M.strassen` + localStorage `m2m-strassen` (relativ zur linken unteren Gebietsecke). `laser.js/setzeStrassenNamen` setzt jeden Namen bis zu 3× entlang gerader Straßenstücke, immer lesbar gedreht, 3,5 → 1,8 mm je nach Straßenbreite, nie über eine Plattenfuge. Passt die IFC nicht zum zuletzt geladenen Gebiet → Hinweis.
- Getestet (Wilhelmshaven, KW-Brücke, 1:500 Schichten + 1:1000 Volumen/Satteldach): alle Prüfungen grün, 4 Straßennamen graviert, DXF/SVG ok.

### Schild mit Nordpfeil, keine Bäume (Mi 18.11., spät)
- **Keine Bäume** mehr in der Laserdatei (vorher gravierte Kreise auf der Bodenplatte).
- **Schild**: Die Beschriftung wird nicht mehr auf die Grundplatte graviert, sondern auf ein **eigenes kleines Pappstück** (rot ausgeschnitten, Schrift schwarz graviert, **nicht** gespiegelt). Liegt mit auf einer Gebäude-Platte („SCHILD“). Inhalt: jede Zeile aus dem Feld „Beschriftung“ + automatisch „M 1:…“ + **Nordpfeil** rechts daneben. Norden = obere Kante der Bodenplatte (IFC ist genordet) → Schild parallel zur Plattenkante aufkleben. Steht auch in der Bauanleitung.
- **Schriftgrößen passen sich dem Maßstab an**: Schild-Schrift wächst mit der Modellgröße (3,6–9 mm erste Zeile, z. B. 1:500 ≈ 176 × 51 mm, 1:1000 ≈ 128 × 39 mm). Straßennamen starten bei ca. 2,4 m echter Höhe (1:200 → 8 mm, 1:500 → 4,8 mm, 1:1000 → 2,4 mm) und werden kleiner, bis sie in die Straße passen (min. 1,8 mm).

### Veröffentlichung + Live-Demo (Do 19.11., Mittag)
- Auf GitHub hochgeladen (`main`, Commit „Laserdatei, 3D-Startseite, CAD-Öffner, README“). README neu: Satz, Live-Link, Screenshots (`docs/screenshots/`), Starten, Technik, Quellen mit Lizenzen, Bibliotheken mit Version/Lizenz, KI-Nutzung.
- **Lokal starten:** `Map2Model starten.cmd` (Doppelklick) → `start/server.ps1` (kleiner Server, Port 8080) + Browser. Kein Python/Node nötig.
- **QR-Code** zur Live-Demo: `docs/qr-code.png` (2320 px, für A1).
- **Live-Link** https://jade-hs-vibecoding-wpk.github.io/Map2Model/ – muss im Repo unter Settings → Pages (Branch `main`, Ordner `/root`) eingeschaltet werden (Team).
- **Demo-Ordner** `WPK - KI/Demo/` (nicht im Repo): `Demo starten.cmd` (Karte direkt an der KW-Brücke), Notfall-Dateien (IFC aus Schritt 1, „bearbeitete“ IFC mit `Neubau_Gebäude_1`, fertige Laser-ZIP), `Demo-Ablauf.txt` (Sprechzettel nach der Gliederung aus Tag 5).
- Poster macht das Team selbst.
- Pages ist an (19.11.), Live-Link getestet: Startseite + kompletter Ablauf (OSM → IFC → web-ifc → Laserdatei) laufen online.
- Offen: Test am Handy/privaten Fenster durch das Team, Release v1.0.0 (Team im Browser), Revit-Add-in behalten oder entfernen.

### Poster A1 (Do 19.11.)
- Poster nach der rot-weißen Werkstatt-Vorlage (Seite 1 von „Poster-Vorlage A0.pdf“), auf **A1 (594 × 841 mm)** umgesetzt: `WPK - KI/Poster/poster.html` → `Map2Model_Poster_A1.pdf` (gedruckt mit Edge im Hintergrund). Bilder in `Poster/bilder/` (echte Ansichten aus Map2Model). Namen/Matrikelnummern sind noch Platzhalter.
- Dafür in der App ergänzt: **Standbild** der Startseite `?standbild=1` / `?standbild=offen` (&winkel=…), **Direktlink** `?ort=Breite,Länge,Name` springt ohne Suche zu einem Ort (z. B. für die Präsentation).

### Jedes Teil bekommt eine Nummer (Do 19.11.)
- Problem: Die Gravur wurde nur gesetzt, wenn sie ganz ins Teil passte (min. 1,8 mm) – schmale Wände, kleine Dächer und obere Schichten blieben leer.
- Jetzt der Reihe nach: Name + Schicht → Kurzform („N1-3“, Dach „-D“) → **gedreht** um 90° (von unten nach oben lesbar, für hohe schmale Teile) → **kleinere Schrift 1,2 mm** → passt nichts: Nummer **direkt unter dem Teil** auf der Pappe (Hinweis in der App).
- Dasselbe für die Umrisse auf der **Bodenplatte**: kleiner/gedreht im Umriss, sonst direkt daneben (max. 25 mm entfernt).
- Test (Wilhelmshaven): 1:500 und 1:1000 Schichten → alle Teile und Umrisse nummeriert; 1:1000 Volumen → 15 Teile mit Nummer unter dem Teil, Rest im Teil.

### Eine Laserdatei mit allen Platten (Do 19.11.)
- Der Download enthält jetzt **eine** Laserdatei `Map2Model_Laser_<Name>_M1-<Maßstab>.dxf` mit **allen Platten** im Raster (4 nebeneinander), gleiche Ansicht als `.svg`, dazu `Bauplan_Uebersicht.html` und `LIESMICH.txt`. Keine Einzeldateien mehr.
- Über jeder Platte steht ihr **Name als Überschrift** (wie bisher die Dateinamen, z. B. „PLATTE 01 · GEBÄUDE 1/5“, „PLATTE 07 · BODENPLATTE · TEIL A“).
- Jede Platte ist **bemaßt**: unten die Breite, links die Höhe der Pappe (z. B. 800 MM / 500 MM) mit Maß- und Hilfslinien und Schrägstrichen.
- Überschrift und Bemaßung sind **schwarz** (Wunsch des Teams, gut lesbar; vorher gelb). Sie liegen **außerhalb** des gelben Laserbetts → beim Lasern Platte für Platte nur den Inhalt im gelben Rahmen nehmen. (Gelbe Rahmen werden in der Vorschau etwas dunkler gezeigt, in der Datei exakt RGB 255,255,0.)
- **Umschalter „Gebäude beschriften: Mit Beschriftung / Ohne“** (wie Geschichtet/Volumen). „Ohne“: keine Nummern auf Gebäude-, Grün- und Brückenteilen und keine Nummern in den Umrissen der Bodenplatte; Umrisse, Schild, Straßennamen und Plattenkennung bleiben. Hinweis in der App + LIESMICH.
- Code: `M2M.alleZusammen(blaetter, platte)` in `js/laser-export.js`, Download in `js/laser-ansicht.js`.

### Startmodell komplexer, Logo dunkelgrau (Mi 18.11., Abend)
- **Startmodell** (`js/startseite.js`) deutlich größer und detaillierter: dunkler **Sockel** wie ein Ausstellungsmodell, 12 Baublöcke mit Bautypen (Blockrand mit unterschiedlichen Höhen + Eckturm, Zeilen mit Höhensprüngen, Hochpunkte auf Sockel, **Reihenhäuser mit Satteldach**, Park), **Hafenbecken** mit **Bogenbrücke** (Bögen + Hänger, angelehnt an die Kaiser-Wilhelm-Brücke), Baumreihen an Promenade und Straße, **Neubau rot** gestaffelt mit Dachterrassen und Hochpunkt. Gebäude wachsen als Welle von hinten links nach vorne rechts.
- Kamera-Abstand wird einmal für alle Drehwinkel berechnet → das Modell passt immer ganz ins Bild (auch in der Explosionsansicht).
- Logo und „Los geht’s“ sind immer sichtbar (Einblenden nur noch Zusatz – vorher blieben sie unsichtbar, wenn der Browser die Animation nicht abspielte).
- **Grau (`#6e7378`, vorher Anthrazit)**: Logo-Grundplatte, Schriftzug „Map2Model“ (auch Seitenleiste) und der Sockel des 3D-Startmodells. Häuser im Logo hellgrau, Pin rot.

### Neue Startseite + Logo (Mi 18.11., spät)
- **Logo „Pin steckt im Modell“** (Wahl des Teams aus 12 Vorschlägen): roter Karten-Pin steckt in einer kleinen isometrischen Modellplatte mit zwei Häusern. Datei `img/logo.svg` – auf der Startseite, in der Seitenleiste und als Symbol im Browser-Tab.
- **Startseite ganz reduziert**: nur Logo, bewegtes Modell, Button „Los geht’s“ (plus kleine Zeile Jade HS / © OpenStreetMap). Texte und Schritt-Karten sind weg.
- **3D-Architekturmodell (ersetzt die SVG-Grafik, Wunsch: „nicht wie Lego“)**: `js/startseite.js` mit three.js r128 (cdnjs, nur auf der Startseite geladen). Weißes Finnpappe-Modell mit feinen Schichtkanten: Wasser, Straßenboden, 6 Baublöcke, Blockrand mit Innenhof + Eckturm, Zeilen mit Höhensprüngen, U-Block, Halle + Hochhaus, Park mit Kugelbäumen, Promenade, Brücke, **Neubau rot** (L-Form + Hochpunkt). Ablauf in Schleife: Teile fallen nacheinander herein → stehen → **Explosionsansicht** (Schichten schweben auseinander) → zusammen → nach oben weg. Kamera dreht eine Runde pro Minute, weicher Schatten. Läuft immer (auch bei Windows-„Animationen aus“) und startet, sobald die Startseite sichtbar wird (Fehler behoben: startete vorher manchmal gar nicht). Ohne WebGL → einfache SVG-Grafik `js/startseite-svg.js`.
- (ersetzt) **Bewegtes Modell** (SVG): echte isometrische Quader (Wasserplatte, Straßenboden, Baublöcke, Park mit Bäumen, Brücke, Gebäude aus Schichten, Neubau rot). Die Teile fallen nacheinander von oben herein, Gebäude wachsen Schicht für Schicht; ~5 s stehen, dann auseinander und von vorn. Schwebt leicht. Bei „Bewegung reduzieren“ steht es still. Läuft nur, solange die Startseite sichtbar ist.

### Nächster Schritt
1. Team: echte Revit-Export-IFC mit `Neubau_Gebäude_1` hochladen und Laserdatei erzeugen.
2. Team: eine DXF in AutoCAD/Ruby im Labor öffnen (Farben, Schrift, Maße prüfen).
3. Danach: GitHub Pages einrichten, README, Poster.
