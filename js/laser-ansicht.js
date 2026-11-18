/* =========================================================
   Schritt 3: Datei hochladen ("+"-Feld), Eingabefelder,
   Laserbett-Vorschau rechts.
   Die eigentliche Laserdatei wird in einem späteren Baustein erzeugt.
   ========================================================= */

(function () {
  var ablage = document.getElementById("ablage");
  var eingabe = document.getElementById("datei-eingabe");
  var form = document.getElementById("laser-form");
  var meldung = document.getElementById("laser-meldung");
  var $ = function (id) { return document.getElementById(id); };

  // ---------- Datei übernehmen ----------
  function nimmDatei(datei) {
    if (!datei) return;
    if (!/\.ifc$/i.test(datei.name)) {
      M2M.melde("Bitte eine IFC-Datei hochladen (Endung .ifc).", "fehler");
      return;
    }
    M2M.datei = datei;
    ablage.classList.add("hat-datei");
    ablage.querySelector(".ablage-plus").textContent = "✓";
    ablage.querySelector(".ablage-text b").textContent = datei.name;
    ablage.querySelector(".ablage-text small").textContent =
      (datei.size / 1024 / 1024).toFixed(1) + " MB · zum Ändern klicken";
    meldung.textContent = "";
    meldung.classList.remove("fehler");
  }

  M2M.nimmDatei = nimmDatei; // auch der Arbeitsordner (Schritt 2) legt Dateien hier ab
  eingabe.addEventListener("change", function () { nimmDatei(eingabe.files[0]); });
  ["dragenter", "dragover"].forEach(function (art) {
    ablage.addEventListener(art, function (e) { e.preventDefault(); ablage.classList.add("ueber"); });
  });
  ["dragleave", "drop"].forEach(function (art) {
    ablage.addEventListener(art, function (e) { e.preventDefault(); ablage.classList.remove("ueber"); });
  });
  ablage.addEventListener("drop", function (e) { nimmDatei(e.dataTransfer.files[0]); });

  // ---------- Höhen aus realistischen Werten vorschlagen ----------
  // echte Höhe → Maßstab → ganze Schichten, mindestens 1 Schicht
  // Wasser: −1 m ergibt bei 1:500 und 1 mm Pappe 2 Schichten → Bodenplatte, Zwischenebene, Wasser
  var ECHTE_HOEHE_M = { gruen: 0.10, strasse: -0.15, wasser: -1.0 };

  function schichten(echtM, massstab, staerkeMm) {
    var anzahl = Math.round(Math.abs(echtM * 1000 / massstab) / staerkeMm);
    return Math.sign(echtM) * Math.max(1, anzahl);
  }

  function hoehenVorschlagen() {
    var m = parseFloat($("massstab").value);
    var t = parseFloat($("staerke").value);
    if (!(m > 0) || !(t > 0)) return;
    $("hoehe-gruen").value = schichten(ECHTE_HOEHE_M.gruen, m, t);
    $("hoehe-strasse").value = schichten(ECHTE_HOEHE_M.strasse, m, t);
    $("hoehe-wasser").value = schichten(ECHTE_HOEHE_M.wasser, m, t);
  }
  $("massstab").addEventListener("change", hoehenVorschlagen);
  $("staerke").addEventListener("change", hoehenVorschlagen);

  // ---------- Laserbett-Vorschau ----------
  var SVG_NS = "http://www.w3.org/2000/svg";
  function el(name, attrs, text) {
    var e = document.createElementNS(SVG_NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function zahl(x) { return Math.round(x).toLocaleString("de-DE"); }

  M2M.zeichneVorschau = function () {
    if (M2M.laser) return; // fertige Platten werden gerade gezeigt
    var svg = $("vorschau-svg");
    svg.innerHTML = "";

    var pb = Math.min(990, Math.max(0, parseFloat($("platte-breite").value) || 0));
    var ph = Math.min(590, Math.max(0, parseFloat($("platte-hoehe").value) || 0));
    var m = parseFloat($("massstab").value);
    var material = $("material").value.trim() || "Material";
    var staerke = $("staerke").value;

    // Laserbett + gelber Rahmen 1000 × 600 mm
    svg.appendChild(el("rect", { x: 0, y: 0, width: 1000, height: 600, fill: "#fff", stroke: "#e6b800", "stroke-width": 2.5 }));
    // Platte (Material), 5 mm Abstand zum Rahmen
    svg.appendChild(el("rect", { x: 5, y: 5, width: pb, height: ph, fill: "#ece6d8", stroke: "#cfc6b2", "stroke-width": 1 }));
    svg.appendChild(el("text", { x: 5 + 12, y: 5 + 26, "font-size": 15, fill: "#6b6457", "font-family": "Inter, sans-serif", "font-weight": 600 },
      material + " " + staerke + " mm · " + zahl(pb) + " × " + zahl(ph) + " mm"));

    // Modellgröße und Aufteilung (Schätzung aus dem Rechteck in Schritt 1)
    var kzModell = "–", kzTeile = "–", kzPlatten = "–";
    if (M2M.gebiet && m > 0 && pb > 0 && ph > 0) {
      var mb = M2M.gebiet.breiteM * 1000 / m;
      var mh = M2M.gebiet.hoeheM * 1000 / m;
      var nx = Math.ceil(mb / pb), ny = Math.ceil(mh / ph);
      var teile = nx * ny;
      var tb = mb / nx, th = mh / ny;

      // erstes Teil der Grundplatte auf der Platte zeigen
      var x0 = 5 + (pb - tb) / 2, y0 = 5 + (ph - th) / 2;
      svg.appendChild(el("rect", { x: x0, y: y0, width: tb, height: th, fill: "rgba(34,197,94,.10)", stroke: "#ff0000", "stroke-width": 1.5 }));
      svg.appendChild(el("text", { x: x0 + tb / 2, y: y0 + th / 2 + 18, "font-size": 52, "text-anchor": "middle", fill: "#000", "font-family": "Inter, sans-serif", "font-weight": 700 },
        teile > 1 ? "A" : ""));
      svg.appendChild(el("text", { x: x0 + tb / 2, y: y0 + th - 14, "font-size": 14, "text-anchor": "middle", fill: "#555", "font-family": "Inter, sans-serif" },
        "Grundplatte " + (teile > 1 ? "Teil A von " + teile : "") + " · " + zahl(tb) + " × " + zahl(th) + " mm"));

      var ebenen = 1 + Math.abs(parseInt($("hoehe-wasser").value, 10) || 0);
      var gruen = (parseInt($("hoehe-gruen").value, 10) || 0) > 0 ? 1 : 0;

      kzModell = zahl(mb) + " × " + zahl(mh) + " mm";
      kzTeile = teile === 1 ? "1 Teil" : teile + " Teile (" + nx + " × " + ny + ")";
      kzPlatten = "≈ " + (teile * ebenen + gruen) + " + Gebäude";
    } else {
      svg.appendChild(el("text", { x: 500, y: 320, "font-size": 18, "text-anchor": "middle", fill: "#8a919a", "font-family": "Inter, sans-serif" },
        M2M.gebiet ? "Maßstab eintragen, um die Größe zu sehen" : "Gebiet in Schritt 1 wählen und Maßstab eintragen"));
    }

    // Bemaßung des Laserbetts
    svg.appendChild(el("text", { x: 500, y: 622, "font-size": 13, "text-anchor": "middle", fill: "#8a919a", "font-family": "JetBrains Mono, monospace" }, "1000 mm"));
    var hoeheText = el("text", { x: 1014, y: 300, "font-size": 13, "text-anchor": "middle", fill: "#8a919a", "font-family": "JetBrains Mono, monospace", transform: "rotate(90 1014 300)" }, "600 mm");
    svg.appendChild(hoeheText);

    $("kz-modell").textContent = kzModell;
    $("kz-teile").textContent = kzTeile;
    $("kz-platten").textContent = kzPlatten;
  };

  // Vorschau bei jeder Eingabe aktualisieren
  form.addEventListener("input", function () { M2M.zeichneVorschau(); });
  form.addEventListener("change", function () { M2M.zeichneVorschau(); });

  // ---------- grüner Button: Eingaben prüfen ----------
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var fehler = [];
    form.querySelectorAll(".fehlt").forEach(function (x) { x.classList.remove("fehlt"); });

    function pruefe(id, bedingung, text) {
      var feld = $(id);
      if (!bedingung(feld.value)) { feld.classList.add("fehlt"); fehler.push(text); }
    }

    if (!M2M.datei) fehler.push("Bitte zuerst die IFC-Datei hochladen.");
    pruefe("massstab", function (v) { return parseFloat(v) > 0; }, "Bitte den Maßstab eingeben.");
    pruefe("platte-breite", function (v) { return v > 0 && v <= 990; }, "Plattenbreite: höchstens 990 mm.");
    pruefe("platte-hoehe", function (v) { return v > 0 && v <= 590; }, "Plattenhöhe: höchstens 590 mm.");
    pruefe("staerke", function (v) { return parseFloat(v) > 0; }, "Bitte die Materialstärke eingeben.");
    pruefe("material", function (v) { return v.trim() !== ""; }, "Bitte das Material eingeben.");

    if (fehler.length) {
      meldung.textContent = fehler[0];
      meldung.classList.add("fehler");
      return;
    }
    meldung.classList.remove("fehler");
    erzeuge();
  });

  // ---------- Laserdatei erzeugen ----------
  var knopf = $("knopf-laser"), knopfInhalt = knopf.innerHTML;
  function laedt(text) {
    knopf.disabled = !!text;
    knopf.innerHTML = text ? '<span class="lader" aria-hidden="true"></span>' + text : knopfInhalt;
  }
  function warte() { return new Promise(function (r) { setTimeout(r, 30); }); } // Anzeige zwischendurch aktualisieren

  async function erzeuge() {
    var cfg = {
      massstab: parseFloat($("massstab").value),
      staerke: parseFloat($("staerke").value),
      plattenB: parseFloat($("platte-breite").value),
      plattenH: parseFloat($("platte-hoehe").value),
      material: $("material").value.trim(),
      bauweise: form.querySelector("input[name=bauweise]:checked").value,
      hGruen: Math.abs(parseInt($("hoehe-gruen").value, 10) || 0),
      hStrasse: Math.abs(parseInt($("hoehe-strasse").value, 10) || 1),
      hWasser: Math.abs(parseInt($("hoehe-wasser").value, 10) || 2),
      beschriftung: $("beschriftung").value.trim().replace(/\s+/g, " "),
    };
    meldung.textContent = "";
    try {
      laedt("Lese IFC-Datei…"); await warte();
      var imp = await M2M.leseIfc(M2M.datei, function (t) { laedt(t.replace(" …", "…")); });
      laedt("Erzeuge Laserdatei…"); await warte();
      var erg = M2M.erzeugeLaser(imp, cfg, function (t) { laedt(t.replace(" …", "…")); });
      M2M.laser = erg;
      M2M.letzteCfg = cfg;

      zeigeErgebnis(erg);
      laedt("Packe die Dateien…"); await warte();
      ladeHerunter(erg, cfg);
      M2M.melde("Fertig: " + erg.blaetter.length + " Dateien heruntergeladen – " + erg.finnpappen + " Pappen werden gebraucht.");
    } catch (e) {
      console.error(e);
      meldung.textContent = "Die Laserdatei konnte nicht erzeugt werden: " + (e && e.message ? e.message : e);
      meldung.classList.add("fehler");
    } finally {
      laedt(null);
    }
  }

  function ladeHerunter(erg, cfg) {
    var basis = (M2M.datei.name || "Modell").replace(/\.ifc$/i, "").replace(/[^\wäöüÄÖÜß-]+/g, "_").slice(0, 40);
    var dateien = [];
    erg.blaetter.forEach(function (b) {
      var name = b.name.replace(/[·()]/g, "").replace(/×/g, "x").replace(/\//g, "-").replace(/−/g, "-")
        .trim().replace(/\s+/g, "_").replace(/_+/g, "_");
      dateien.push({ name: "DXF/" + name + ".dxf", inhalt: M2M.blattZuDxf(b) });
      dateien.push({ name: "SVG/" + name + ".svg", inhalt: M2M.blattZuSvg(b) });
    });
    var liesmich = [
      "Map2Model – Laserdateien",
      "Quelle: " + M2M.datei.name,
      "Maßstab 1:" + cfg.massstab + " · Material: " + cfg.material + " " + cfg.staerke + " mm · Platte " + cfg.plattenB + " × " + cfg.plattenH + " mm",
      "Bauweise: " + (cfg.bauweise === "volumen" ? "Volumen (Wände + Dach)" : "Geschichtet"),
      "",
      "EINKAUFEN: " + erg.finnpappen + " Platten à " + cfg.plattenB + " × " + cfg.plattenH + " mm · " + cfg.material + " " + cfg.staerke + " mm",
      "(Die Übersicht/Aufteilungsplan wird nicht gelasert und ist nicht mitgezählt.)",
      "",
      "Platten (" + erg.blaetter.length + " Dateien):",
    ].concat(erg.blaetter.map(function (b) { return "  " + b.name; }), [
      "",
      "Farben: Rot = schneiden · Blau = anritzen · Gelb = Rahmen/Orientierung · Schwarz = gravieren",
      "DXF: Farbe auch als Layer (SCHNEIDEN_ROT, RITZEN_BLAU, RAHMEN_GELB, GRAVUR_SCHWARZ).",
      "Schwarz ist im DXF die AutoCAD-Farbe 7 (Schwarz/Weiß). Falls RGB 0,0,0 verlangt ist:",
      "in AutoCAD den Layer GRAVUR_SCHWARZ auf Farbe „0,0,0“ (True Color) stellen.",
      "",
      "Prüfung:",
    ], erg.pruefung.map(function (p) { return "  [" + (p.ok ? "OK" : "!!") + "] " + p.text; }),
      erg.hinweise.length ? ["", "Hinweise:"].concat(erg.hinweise.map(function (h) { return "  - " + h; })) : [],
      ["", "Erzeugt mit Map2Model · Kartendaten © OpenStreetMap-Mitwirkende"]).join("\r\n");
    dateien.unshift({ name: "LIESMICH.txt", inhalt: liesmich });
    dateien.unshift({ name: "00_Uebersicht.html", inhalt: M2M.uebersichtHtml(erg, cfg, M2M.datei.name) });
    var alle = M2M.alleZusammen(erg.blaetter);
    dateien.splice(2, 0,
      { name: "00_Alle_Platten_nebeneinander.svg", inhalt: M2M.blattZuSvg(alle) },
      { name: "00_Alle_Platten_nebeneinander.dxf", inhalt: M2M.blattZuDxf(alle) });

    var blob = M2M.zip(dateien);
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "Map2Model_Laser_" + basis + "_M1-" + cfg.massstab + ".zip";
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  // ---------- Ergebnis anzeigen: Prüfung links, Platten rechts ----------
  // Vorschau: zuerst „Alle Platten nebeneinander“, dann jede Platte einzeln
  var blattNr = 0;
  function vorschauListe() {
    var erg = M2M.laser;
    if (!erg.alle) erg.alle = M2M.alleZusammen(erg.blaetter);
    return [erg.alle].concat(erg.blaetter);
  }
  function zeigeBlatt() {
    var erg = M2M.laser; if (!erg) return;
    var liste = vorschauListe();
    var b = liste[blattNr];
    $("vorschau-svg").style.display = "none";
    $("vorschau-blatt").hidden = false;
    $("vorschau-blatt").innerHTML = M2M.blattZuSvg(b, true);
    $("blatt-nav").hidden = false;
    $("blatt-name").textContent = blattNr === 0
      ? "Alle " + erg.blaetter.length + " Platten nebeneinander – mit › einzeln ansehen"
      : b.name;
  }
  $("knopf-uebersicht").addEventListener("click", function () {
    if (!M2M.letzteUebersicht) return;
    var url = URL.createObjectURL(new Blob([M2M.letzteUebersicht], { type: "text/html" }));
    window.open(url, "_blank");
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  });
  $("blatt-zurueck").addEventListener("click", function () { if (M2M.laser) { var n = vorschauListe().length; blattNr = (blattNr - 1 + n) % n; zeigeBlatt(); } });
  $("blatt-vor").addEventListener("click", function () { if (M2M.laser) { var n = vorschauListe().length; blattNr = (blattNr + 1) % n; zeigeBlatt(); } });

  function zeigeErgebnis(erg) {
    var pl = $("pruefung-liste"); pl.innerHTML = "";
    erg.pruefung.forEach(function (p) {
      var li = document.createElement("li"); li.textContent = p.text; if (!p.ok) li.className = "nein"; pl.appendChild(li);
    });
    var hl = $("hinweis-liste"); hl.innerHTML = "";
    erg.hinweise.forEach(function (h) { var li = document.createElement("li"); li.textContent = h; hl.appendChild(li); });
    $("laser-ergebnis").hidden = false;
    M2M.letzteUebersicht = M2M.uebersichtHtml(erg, M2M.letzteCfg || {}, M2M.datei ? M2M.datei.name : "");

    $("kz-modell").textContent = Math.round(erg.modellMM[0]) + " × " + Math.round(erg.modellMM[1]) + " mm";
    $("kz-teile").textContent = erg.teile.grundplatte + " Teil" + (erg.teile.grundplatte > 1 ? "e" : "") + " × " + erg.teile.ebenen + " Ebenen";
    var c = M2M.letzteCfg || {};
    var einkauf = erg.finnpappen + " Platten à " + c.plattenB + " × " + c.plattenH + " mm";
    $("kz-platten").textContent = einkauf;
    $("einkauf-text").textContent = einkauf + " · " + (c.material || "") + " " + (c.staerke || "") + " mm";
    $("einkauf-text").title = Object.keys(erg.zaehl).map(function (k) { return erg.zaehl[k] + " " + k; }).join(", ");
    blattNr = 0;
    zeigeBlatt();
  }

  // Bei geänderten Eingaben wieder die einfache Bett-Vorschau zeigen
  form.addEventListener("input", function () {
    if (!M2M.laser) return;
    M2M.laser = null;
    $("vorschau-blatt").hidden = true; $("vorschau-svg").style.display = "";
    $("blatt-nav").hidden = true; $("blatt-name").textContent = "Laserbett · 1000 × 600 mm";
    M2M.zeichneVorschau();
  });
})();
