/* =========================================================
   Schritt 2: Im CAD-Programm bearbeiten

   Ablauf:
   1. In Schritt 1 „IFC-Datei herunterladen“ → Datei landet im Download-Ordner,
      die App springt hierher.
   2. Programm wählen (Revit, Archicad, …) → roter Button „In Revit öffnen“.
   3. Die Website ruft den Map2Model-Öffner auf (map2model://…). Der startet
      das Programm. Bei Revit übernimmt das Map2Model-Add-in: Es wartet, bis
      Revit fertig geladen ist, und öffnet die IFC dann automatisch
      (wie „Datei → Öffnen → IFC“).
   4. Bearbeiten, als IFC speichern, zur Website zurück → Schritt 3 mit
      „Willkommen zurück! IFC-Datei einfügen“.

   Eine Website allein darf keine Programme starten – dafür wird der Öffner
   einmalig installiert (Ordner oeffner/).
   ========================================================= */

(function () {
  var $ = function (id) { return document.getElementById(id); };
  var datei = null; // { name, inhalt } – zuletzt heruntergeladene IFC

  // Programme, die der Map2Model-Öffner kennt (siehe oeffner/oeffner.ps1)
  var LISTE = [
    ["revit", "Autodesk Revit", "öffnet die IFC automatisch"],
    ["archicad", "Archicad", ""],
    ["vectorworks", "Vectorworks", ""],
    ["allplan", "Allplan", ""],
    ["bricscad", "BricsCAD BIM", ""],
    ["freecad", "FreeCAD", "kostenlos"],
    ["standard", "Standardprogramm von Windows", "das Programm, das Windows für .ifc eingestellt hat"],
  ];
  var NAME = {};
  LISTE.forEach(function (p) { NAME[p[0]] = p[1]; });

  function gemerkt() { try { return localStorage.getItem("m2m-cad") || "revit"; } catch (e) { return "revit"; } }
  function merke(p) { try { localStorage.setItem("m2m-cad", p); } catch (e) { /* egal */ } }
  function oeffnerInstalliert() { try { return localStorage.getItem("m2m-oeffner") === "ja"; } catch (e) { return false; } }

  // ---------- Programmliste ----------
  var wahl = gemerkt();
  function zeigeListe() {
    $("cad-liste").innerHTML = LISTE.map(function (p) {
      return '<button type="button" class="cad-wahl' + (p[0] === wahl ? " aktiv" : "") + (p[0] === "standard" ? " voll" : "") +
        '" data-programm="' + p[0] + '" aria-pressed="' + (p[0] === wahl) + '"><b>' + p[1] + "</b>" +
        (p[2] ? "<small>" + p[2] + "</small>" : "") + "</button>";
    }).join("");
    var kurz = NAME[wahl].replace("Autodesk ", "").replace("Standardprogramm von Windows", "Standardprogramm");
    $("knopf-cad-text").textContent = "In " + kurz + " öffnen";
    $("cad-info").className = "cad-info";
    $("cad-info").innerHTML = wahl === "revit"
      ? "<b>Revit</b> startet und öffnet deine IFC-Datei automatisch – das dauert so lange, wie Revit zum Starten braucht. Ist Revit schon offen, kommt die Datei dort an."
      : "<b>" + NAME[wahl] + "</b> startet mit deiner IFC-Datei. Öffnet das Programm die Datei nicht selbst: Der Dateipfad liegt in der Zwischenablage – im Programm „Öffnen“ bzw. „Importieren → IFC“ und Strg + V.";
  }
  $("cad-liste").addEventListener("click", function (ev) {
    var k = ev.target.closest(".cad-wahl");
    if (!k) return;
    wahl = k.dataset.programm;
    merke(wahl);
    zeigeListe();
  });
  zeigeListe();

  function herunterladen(name, inhalt) {
    var blob = new Blob([inhalt], { type: "application/x-step" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  // ---------- 1. Aus Schritt 1: Datei herunterladen und hierher wechseln ----------
  M2M.ifcFertig = function (name, inhalt) {
    datei = { name: name, inhalt: inhalt, um: Date.now() };
    herunterladen(name, inhalt);
    $("cad-datei").classList.remove("leer");
    $("cad-datei-name").textContent = name;
    $("knopf-cad").disabled = false;
    location.hash = "#revit";
    M2M.melde("IFC-Datei heruntergeladen. Jetzt Programm wählen und öffnen.");
  };

  // ---------- 2. „In Revit öffnen“ → Map2Model-Öffner aufrufen ----------
  $("knopf-cad").addEventListener("click", function () {
    if (!datei) return;
    var programm = wahl, progName = NAME[wahl], dateiName = datei.name;
    M2M.warteAufCad = { seit: Date.now(), weg: null };
    $("cad-info").className = "cad-info warte";
    $("cad-info").innerHTML = "<b>" + progName + "</b> wird gestartet … Bearbeite die Datei, speichere sie als IFC und komm dann einfach hierher zurück.";

    var gewechselt = false;
    var weg = function () { gewechselt = true; };
    window.addEventListener("blur", weg, { once: true });
    document.addEventListener("visibilitychange", weg, { once: true });
    location.href = "map2model://oeffnen?programm=" + encodeURIComponent(programm) + "&datei=" + encodeURIComponent(dateiName);
    // Kein Wechsel ins Programm → Öffner vermutlich nicht installiert → Anleitung zeigen
    setTimeout(function () {
      if (gewechselt) { try { localStorage.setItem("m2m-oeffner", "ja"); } catch (e) { /* egal */ } return; }
      zeigeOeffnenHinweis(dateiName, progName);
    }, oeffnerInstalliert() ? 15000 : 9000); // Zeit lassen für die Rückfrage des Browsers
  });

  // ---------- Hinweis: Öffner einmalig installieren ----------
  function zeigeOeffnenHinweis(name, progName) {
    $("oeffnen-datei").textContent = name;
    $("oeffnen-cad").textContent = progName || "Dein CAD-Programm";
    $("oeffnen-hinweis").hidden = false;
  }
  function versteckeOeffnenHinweis() { $("oeffnen-hinweis").hidden = true; }
  $("oeffnen-zu").addEventListener("click", versteckeOeffnenHinweis);
  window.addEventListener("blur", function () { setTimeout(versteckeOeffnenHinweis, 1500); });

  // Öffner als ZIP herunterladen
  $("oeffner-laden").addEventListener("click", async function () {
    try {
      var dateien = [];
      var namen = ["Installieren.cmd", "Deinstallieren.cmd", "oeffner.ps1", "Map2ModelRevit.dll", "Map2ModelRevit.addin"];
      for (var i = 0; i < namen.length; i++) {
        var antwort = await fetch("oeffner/" + namen[i], { cache: "no-store" });
        if (!antwort.ok) { if (/Revit/.test(namen[i])) continue; throw new Error(namen[i] + " fehlt"); }
        var inhalt;
        if (/\.dll$/.test(namen[i])) inhalt = new Uint8Array(await antwort.arrayBuffer());
        else {
          inhalt = await antwort.text();
          // PowerShell 5 braucht die Kennung „UTF-8 mit BOM“, damit Umlaute stimmen
          if (/\.ps1$/.test(namen[i]) && inhalt.charCodeAt(0) !== 0xFEFF) inhalt = "﻿" + inhalt;
        }
        dateien.push({ name: "Map2Model-Oeffner/" + namen[i], inhalt: inhalt });
      }
      var a = document.createElement("a");
      a.href = URL.createObjectURL(M2M.zip(dateien));
      a.download = "Map2Model-Oeffner.zip";
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      M2M.melde("Map2Model-Oeffner.zip heruntergeladen – entpacken und Installieren.cmd doppelklicken.");
    } catch (e) {
      M2M.melde("Der Öffner konnte nicht geladen werden: " + (e && e.message ? e.message : e), "fehler");
    }
  });

  // ---------- 3. Rückkehr erkennen → Schritt 3 „IFC-Datei einfügen“ ----------
  function fortgegangen() { if (M2M.warteAufCad) M2M.warteAufCad.weg = Date.now(); }
  function zurueck() {
    var w = M2M.warteAufCad;
    if (!w || document.hidden || !w.weg) return;
    if (Date.now() - w.weg < 5000) return; // nur kurz weg (z. B. Rückfrage des Browsers)
    M2M.warteAufCad = null;
    location.hash = "#laser";
    var frage = $("einfuegen-frage");
    frage.hidden = false;
    $("einfuegen-text").textContent = M2M.datei
      ? "Deine Datei „" + M2M.datei.name + "“ ist schon eingefügt. Stimmt das? Sonst eine andere wählen."
      : "Fertig mit dem Bearbeiten? Dann füge jetzt deine gespeicherte IFC-Datei ein.";
    frage.scrollIntoView({ block: "nearest" });
  }
  window.addEventListener("blur", fortgegangen);
  document.addEventListener("visibilitychange", function () { if (document.hidden) fortgegangen(); else zurueck(); });
  window.addEventListener("focus", zurueck);

  // „IFC-Datei einfügen“: Dateiauswahl, startet im Download-Ordner
  $("knopf-einfuegen").addEventListener("click", async function () {
    if (window.showOpenFilePicker) {
      try {
        var griffe = await window.showOpenFilePicker({
          startIn: "downloads",
          types: [{ description: "IFC-Datei", accept: { "application/octet-stream": [".ifc"] } }],
        });
        var f = await griffe[0].getFile();
        if (M2M.nimmDatei) M2M.nimmDatei(f);
        $("einfuegen-frage").hidden = true;
        return;
      } catch (e) { if (e && e.name === "AbortError") return; }
    }
    $("datei-eingabe").click();
  });
})();
