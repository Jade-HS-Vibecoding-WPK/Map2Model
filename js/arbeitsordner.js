/* =========================================================
   Schritt 2: Im CAD-Programm bearbeiten
   - Auswahl des CAD-Programms → passende Klick-Anleitung
   - Arbeitsordner (nur Chrome/Edge, „File System Access API“):
       1. Nutzer wählt einmal einen Ordner (der Browser fragt um Erlaubnis)
       2. die IFC-Datei wird dort gespeichert
       3. kommt man zur Website zurück, sucht die App im Ordner nach einer
          NEU gespeicherten IFC und legt sie automatisch in Schritt 3 bereit
   Ein CAD-Programm selbst starten kann eine Website nicht (Sicherheitsregel
   aller Browser) – das Öffnen macht man im Programm mit den gezeigten Klicks.
   ========================================================= */

(function () {
  var $ = function (id) { return document.getElementById(id); };

  // ---------- Anleitungen je Programm ----------
  var CAD = {
    revit: { name: "Revit", schritte: [
      ["Datei öffnen", "<b>Datei → Öffnen → IFC</b> und die Map2Model-Datei aus dem Arbeitsordner wählen."],
      ["Lage nicht verändern", "Projektbasispunkt und Vermessungspunkt <b>nicht verschieben</b>."],
      ["Abriss", "Gebäude anklicken und mit <b>Entf</b> löschen."],
      ["Neubau", "<b>Architektur → Bauteil → Modell vor Ort</b> → Kategorie „Allgemeines Modell“ → Name <code>Neubau_Gebäude_1</code> → Extrusion zeichnen → <b>Modell fertigstellen</b>."],
      ["Speichern", "<b>Datei → Exportieren → IFC</b> und in den <b>Arbeitsordner</b> speichern."],
    ] },
    archicad: { name: "Archicad", schritte: [
      ["Datei öffnen", "<b>Ablage/Datei → Öffnen</b> und die IFC-Datei wählen."],
      ["Abriss", "Gebäude auswählen und löschen."],
      ["Neubau", "Mit dem <b>Morph</b>-Werkzeug einen Körper zeichnen. In der Infobox als <b>Element-ID</b> <code>Neubau_Gebäude_1</code> eintragen."],
      ["Speichern", "<b>Ablage/Datei → Sichern unter</b> → Dateityp <b>IFC</b> → in den <b>Arbeitsordner</b>."],
    ] },
    vectorworks: { name: "Vectorworks", schritte: [
      ["Datei öffnen", "<b>Datei → Importieren → IFC importieren</b>."],
      ["Abriss", "Gebäude anklicken und löschen."],
      ["Neubau", "Einen Volumenkörper zeichnen (z. B. Extrusion). In der <b>Objekt-Info</b> als Name <code>Neubau_Gebäude_1</code> eintragen."],
      ["Speichern", "<b>Datei → Exportieren → IFC exportieren</b> → in den <b>Arbeitsordner</b>."],
    ] },
    allplan: { name: "Allplan", schritte: [
      ["Datei öffnen", "<b>Datei → Importieren → IFC-Daten importieren</b>."],
      ["Abriss", "Gebäude markieren und löschen."],
      ["Neubau", "Einen 3D-Körper zeichnen und beim Attribut <b>Name</b> <code>Neubau_Gebäude_1</code> eintragen."],
      ["Speichern", "<b>Datei → Exportieren → IFC-Daten exportieren</b> → in den <b>Arbeitsordner</b>."],
    ] },
    bricscad: { name: "BricsCAD BIM", schritte: [
      ["Datei öffnen", "<b>Datei → Öffnen</b> und als Dateityp <b>IFC</b> wählen."],
      ["Abriss", "Gebäude anklicken und löschen."],
      ["Neubau", "Einen Volumenkörper zeichnen (z. B. mit <b>Extrusion</b>) und in den BIM-Eigenschaften als <b>Name</b> <code>Neubau_Gebäude_1</code> eintragen."],
      ["Speichern", "<b>Datei → Exportieren → IFC</b> → in den <b>Arbeitsordner</b>."],
    ] },
    freecad: { name: "FreeCAD", schritte: [
      ["Datei öffnen", "Arbeitsbereich <b>BIM</b> wählen, dann <b>Datei → Öffnen</b> und die IFC-Datei wählen."],
      ["Abriss", "Gebäude in der Baumansicht auswählen und löschen."],
      ["Neubau", "Einen Körper erstellen (z. B. Quader oder Extrusion) und ihn in der Baumansicht <code>Neubau_Gebäude_1</code> nennen (F2)."],
      ["Speichern", "Alles auswählen → <b>Datei → Exportieren</b> → Dateityp <b>IFC</b> → in den <b>Arbeitsordner</b>."],
    ] },
    blender: { name: "Blender + Bonsai", schritte: [
      ["Datei öffnen", "Im Bonsai-Bereich <b>Open IFC Project</b> und die Datei aus dem Arbeitsordner wählen."],
      ["Abriss", "Gebäude anklicken und löschen."],
      ["Neubau", "Einen Körper modellieren, als IFC-Element zuweisen und den <b>Name</b> <code>Neubau_Gebäude_1</code> geben."],
      ["Speichern", "<b>Strg + S</b> (Save IFC Project) speichert direkt in die Datei im Arbeitsordner."],
    ] },
    anderes: { name: "deinem Programm", schritte: [
      ["Datei öffnen", "Die IFC-Datei öffnen oder importieren (meist <b>Datei → Öffnen</b> oder <b>Importieren → IFC</b>)."],
      ["Abriss", "Gebäude löschen."],
      ["Neubau", "Neue Körper zeichnen und ihnen einen Namen mit Kennwort geben, z. B. <code>Neubau_Gebäude_1</code>."],
      ["Speichern", "Als <b>IFC</b> exportieren oder speichern – in den <b>Arbeitsordner</b>. Hinweis: AutoCAD, SketchUp und Rhino können IFC meist nur mit Zusatzprogramm (Plugin)."],
    ] },
  };

  function zeigeAnleitung() {
    var wahl = $("cad-programm").value, c = CAD[wahl] || CAD.anderes;
    $("cad-name").textContent = c.name;
    $("cad-anleitung").innerHTML = c.schritte.map(function (s) {
      return "<li><b>" + s[0] + "</b><span>" + s[1] + "</span></li>";
    }).join("") + "<li><b>Zurück zur Website</b><span>" + (M2M.ordner ? "Die gespeicherte Datei wird automatisch erkannt." : "In Schritt 3 die gespeicherte IFC-Datei ins „+“-Feld ziehen.") + "</span></li>";
    try { localStorage.setItem("m2m-cad", wahl); } catch (e) { /* egal */ }
  }
  try { var gemerkt = localStorage.getItem("m2m-cad"); if (gemerkt && CAD[gemerkt]) $("cad-programm").value = gemerkt; } catch (e) { /* egal */ }
  $("cad-programm").addEventListener("change", zeigeAnleitung);
  zeigeAnleitung();

  // ---------- Arbeitsordner ----------
  var kannOrdner = typeof window.showDirectoryPicker === "function";
  var status = $("ordner-status");

  function zeigeStatus(html, art) {
    status.hidden = false;
    status.className = "ordner-status" + (art ? " " + art : "");
    status.innerHTML = html;
  }

  M2M.ordner = null; // { handle, gespeichertUm, zuletztGeladen }

  // IFC-Text in den Arbeitsordner schreiben
  M2M.speichereImOrdner = async function (name, inhalt) {
    if (!M2M.ordner) return false;
    var datei = await M2M.ordner.handle.getFileHandle(name, { create: true });
    var schreiber = await datei.createWritable();
    await schreiber.write(inhalt);
    await schreiber.close();
    M2M.ordner.gespeichertUm = Date.now();
    M2M.ordner.originalName = name;
    zeigeStatus("<b>Gespeichert:</b> " + name + " in „" + M2M.ordner.handle.name + "“.<br><span class='warte'>Warte auf deine bearbeitete IFC-Datei in diesem Ordner …</span>", "aktiv");
    return true;
  };

  $("knopf-ordner").addEventListener("click", async function () {
    if (!kannOrdner) {
      zeigeStatus("Dein Browser kann keinen Ordner freigeben (das geht nur in <b>Chrome</b> oder <b>Edge</b>). " +
        "Kein Problem: Die IFC-Datei landet im Download-Ordner, und in Schritt 3 ziehst du die bearbeitete Datei ins „+“-Feld.", "fehler");
      return;
    }
    try {
      var handle = await window.showDirectoryPicker({ id: "map2model", mode: "readwrite" });
      M2M.ordner = { handle: handle, gespeichertUm: Date.now(), zuletztGeladen: 0 };
      $("knopf-ordner").textContent = "Anderen Ordner wählen";
      zeigeAnleitung();
      if (M2M.letzteIfc) {
        await M2M.speichereImOrdner(M2M.letzteIfcName || "Map2Model.ifc", M2M.letzteIfc);
        M2M.melde("IFC-Datei im Ordner „" + handle.name + "“ gespeichert. Jetzt im CAD-Programm öffnen.");
      } else {
        zeigeStatus("Ordner „" + handle.name + "“ ist bereit. Lade in Schritt 1 die IFC-Datei – sie wird dann direkt hier gespeichert.", "aktiv");
      }
    } catch (e) {
      if (e && e.name === "AbortError") return; // Nutzer hat abgebrochen
      zeigeStatus("Der Ordner konnte nicht benutzt werden: " + (e && e.message ? e.message : e), "fehler");
    }
  });

  // ---------- Zurück auf der Website: nach neuer IFC im Ordner suchen ----------
  var sucht = false;
  async function suchen() {
    if (!M2M.ordner || sucht || document.hidden) return;
    sucht = true;
    try {
      var neueste = null;
      for await (var eintrag of M2M.ordner.handle.values()) {
        if (eintrag.kind !== "file" || !/\.ifc$/i.test(eintrag.name)) continue;
        var f = await eintrag.getFile();
        // nur Dateien, die NACH unserem Speichern geändert wurden
        if (f.lastModified > M2M.ordner.gespeichertUm + 1500 && f.lastModified > M2M.ordner.zuletztGeladen) {
          if (!neueste || f.lastModified > neueste.lastModified) neueste = f;
        }
      }
      if (neueste) {
        M2M.ordner.zuletztGeladen = neueste.lastModified;
        if (M2M.nimmDatei) M2M.nimmDatei(neueste);
        zeigeStatus("<b>Bearbeitete Datei gefunden:</b> " + neueste.name + " – liegt in Schritt 3 bereit.", "gefunden");
        M2M.melde("Bearbeitete Datei „" + neueste.name + "“ gefunden – weiter zur Laserdatei.");
        location.hash = "#laser";
      }
    } catch (e) {
      // Erlaubnis evtl. abgelaufen – beim nächsten Klick auf „Ordner wählen“ neu erteilen
      console.warn("Ordner konnte nicht gelesen werden:", e);
    } finally {
      sucht = false;
    }
  }
  window.addEventListener("focus", suchen);
  document.addEventListener("visibilitychange", suchen);
  setInterval(suchen, 4000);

  // ===================================================================
  // Ablauf nach „IFC-Datei herunterladen“:
  //   Frage „Darf ich sie in deinem CAD-Programm öffnen?“ → Ja → Datei wird
  //   heruntergeladen (der Browser öffnet sie – nach einmaliger Einstellung –
  //   direkt im CAD-Programm) → man arbeitet im CAD → kommt man zurück,
  //   steht man in Schritt 3 mit „IFC-Datei einfügen?“.
  // ===================================================================
  var dialog = $("cad-dialog");
  var offen = null; // { name, inhalt }

  function herunterladen(name, inhalt) {
    var blob = new Blob([inhalt], { type: "application/x-step" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  M2M.ifcFertig = function (name, inhalt) {
    offen = { name: name, inhalt: inhalt };
    var c = CAD[$("cad-programm").value] || CAD.anderes;
    $("cad-dialog-name").textContent = c.name === "deinem Programm" ? "" : c.name;
    var schonEingerichtet = false;
    try { schonEingerichtet = localStorage.getItem("m2m-auto-oeffnen") === "ja"; } catch (e) { /* egal */ }
    $("cad-einrichtung").open = !schonEingerichtet;
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute("open", "");
  };

  function schliessen() { if (dialog.close) dialog.close(); else dialog.removeAttribute("open"); }

  $("cad-ja").addEventListener("click", async function () {
    if (!offen) return;
    schliessen();
    try { localStorage.setItem("m2m-auto-oeffnen", "ja"); } catch (e) { /* egal */ }
    if (M2M.ordner) await M2M.speichereImOrdner(offen.name, offen.inhalt);
    else herunterladen(offen.name, offen.inhalt);
    M2M.warteAufCad = { seit: Date.now(), weg: null };
    location.hash = "#revit";
    zeigeStatus("<b>" + offen.name + "</b> wird geöffnet …<br><span class='warte'>Bearbeite die Datei, speichere sie als IFC und komm dann einfach hierher zurück.</span>", "aktiv");
    M2M.melde("Die IFC-Datei öffnet sich in deinem CAD-Programm. Danach einfach hierher zurückkommen.");
  });

  $("cad-nein").addEventListener("click", function () {
    if (!offen) return;
    schliessen();
    if (M2M.ordner) M2M.speichereImOrdner(offen.name, offen.inhalt);
    else herunterladen(offen.name, offen.inhalt);
    M2M.melde("Gespeichert: " + offen.name);
  });

  // ---------- Rückkehr erkennen: Fenster war weg (im CAD-Programm) und ist wieder da ----------
  function weg() { if (M2M.warteAufCad) M2M.warteAufCad.weg = Date.now(); }
  function zurueck() {
    var w = M2M.warteAufCad;
    if (!w || document.hidden || !w.weg) return;
    if (Date.now() - w.weg < 5000) return; // nur kurz weg (z. B. Download-Liste) → nichts tun
    M2M.warteAufCad = null;
    location.hash = "#laser";
    var frage = $("einfuegen-frage");
    frage.hidden = false;
    $("einfuegen-text").textContent = M2M.datei
      ? "Deine bearbeitete Datei „" + M2M.datei.name + "“ ist schon eingefügt. Stimmt das? Sonst eine andere wählen."
      : "Fertig mit dem Bearbeiten? Dann füge jetzt deine gespeicherte IFC-Datei ein.";
    frage.scrollIntoView({ block: "nearest" });
  }
  window.addEventListener("blur", weg);
  document.addEventListener("visibilitychange", function () { if (document.hidden) weg(); else zurueck(); });
  window.addEventListener("focus", zurueck);

  // „IFC-Datei einfügen“: Dateiauswahl öffnen (im Arbeitsordner bzw. Download-Ordner)
  $("knopf-einfuegen").addEventListener("click", async function () {
    if (window.showOpenFilePicker) {
      try {
        var griffe = await window.showOpenFilePicker({
          startIn: M2M.ordner ? M2M.ordner.handle : "downloads",
          types: [{ description: "IFC-Datei", accept: { "application/octet-stream": [".ifc"] } }],
        });
        var datei = await griffe[0].getFile();
        if (M2M.nimmDatei) M2M.nimmDatei(datei);
        $("einfuegen-frage").hidden = true;
        return;
      } catch (e) { if (e && e.name === "AbortError") return; }
    }
    $("datei-eingabe").click();
  });
})();
