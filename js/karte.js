/* =========================================================
   Karte (Leaflet + OpenStreetMap) mit verschiebbarem Rechteck
   - Ecken ziehen  → Größe ändern
   - Mitte ziehen  → Rechteck verschieben
   ========================================================= */

(function () {
  // Startansicht: Norddeutschland
  var karte = L.map("karte", { zoomControl: false }).setView([53.3, 8.4], 8);
  L.control.zoom({ position: "bottomleft", zoomInTitle: "Hineinzoomen", zoomOutTitle: "Herauszoomen" }).addTo(karte);
  M2M.karte = karte;

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a>',
  }).addTo(karte);

  var STANDARD_BREITE_M = 400;   // Startgröße des Rechtecks
  var STANDARD_HOEHE_M = 250;
  var GROSS_WARNUNG_M = 2000;    // ab hier wird das Laden der Daten langsam

  var rechteck = null;
  var saum = null;
  var griffe = {};               // nw, ne, se, sw, mitte
  var hinweis = document.getElementById("karte-hinweis");
  var groesseAnzeige = document.getElementById("gebiet-groesse");
  var knopfDownload = document.getElementById("knopf-download");

  // ---------- Hilfsfunktionen ----------
  function meterZuGrad(lat, breiteM, hoeheM) {
    var dLat = hoeheM / 111320;
    var dLng = breiteM / (111320 * Math.cos(lat * Math.PI / 180));
    return { dLat: dLat, dLng: dLng };
  }

  function griffIcon(klasse) {
    return L.divIcon({ className: "griff " + klasse, iconSize: null });
  }

  var mitteIcon = L.divIcon({
    className: "griff-mitte",
    iconSize: null,
    html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M2 12h20M12 2l-3 3m3-3l3 3M12 22l-3-3m3 3l3-3M2 12l3-3m-3 3l3 3M22 12l-3-3m3 3l-3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  });

  // ---------- Rechteck neu zeichnen ----------
  function aktualisiere(grenzen) {
    saum.setBounds(grenzen);
    rechteck.setBounds(grenzen);
    griffe.nw.setLatLng(grenzen.getNorthWest());
    griffe.ne.setLatLng(grenzen.getNorthEast());
    griffe.se.setLatLng(grenzen.getSouthEast());
    griffe.sw.setLatLng(grenzen.getSouthWest());
    griffe.mitte.setLatLng(grenzen.getCenter());

    M2M.gebiet = {
      sued: grenzen.getSouth(), west: grenzen.getWest(),
      nord: grenzen.getNorth(), ost: grenzen.getEast(),
    };

    var breite = karte.distance(grenzen.getSouthWest(), grenzen.getSouthEast());
    var hoehe = karte.distance(grenzen.getSouthWest(), grenzen.getNorthWest());
    M2M.gebiet.breiteM = breite;
    M2M.gebiet.hoeheM = hoehe;
    groesseAnzeige.textContent = Math.round(breite) + " × " + Math.round(hoehe) + " m";
  }

  function nachAenderung() {
    // Gebiet geändert: alte geladene Daten ausblenden
    if (datenEbene) datenEbene.clearLayers();
    document.getElementById("gebiet-inhalt").hidden = true;
    if (M2M.gebiet.breiteM > GROSS_WARNUNG_M || M2M.gebiet.hoeheM > GROSS_WARNUNG_M) {
      M2M.melde("Das Gebiet ist sehr groß. Das Laden der Daten kann lange dauern.", "fehler");
    }
  }

  // ---------- Rechteck anlegen ----------
  function erzeugeRechteck(mitte) {
    var d = meterZuGrad(mitte.lat, STANDARD_BREITE_M, STANDARD_HOEHE_M);
    var grenzen = L.latLngBounds(
      [mitte.lat - d.dLat / 2, mitte.lng - d.dLng / 2],
      [mitte.lat + d.dLat / 2, mitte.lng + d.dLng / 2]
    );

    if (!rechteck) {
      // weißer Saum unter dem grünen Rand, damit das Gebiet auf der bunten Karte gut sichtbar ist
      saum = L.rectangle(grenzen, { color: "#ffffff", weight: 7, opacity: 0.9, fill: false, interactive: false }).addTo(karte);
      rechteck = L.rectangle(grenzen, {
        color: "#c8102e", weight: 3, fillColor: "#c8102e", fillOpacity: 0.12, interactive: false,
      }).addTo(karte);

      // Eckgriffe: die gegenüberliegende Ecke bleibt fest
      var gegenueber = { nw: "se", ne: "sw", se: "nw", sw: "ne" };
      ["nw", "ne", "se", "sw"].forEach(function (ecke) {
        var m = L.marker([0, 0], { icon: griffIcon(ecke), draggable: true, keyboard: false }).addTo(karte);
        m.on("drag", function () {
          var fest = griffe[gegenueber[ecke]].getLatLng();
          aktualisiere(L.latLngBounds(fest, m.getLatLng()));
        });
        m.on("dragend", nachAenderung);
        griffe[ecke] = m;
      });

      // Mittelgriff: ganzes Rechteck verschieben
      var start = null;
      griffe.mitte = L.marker([0, 0], { icon: mitteIcon, draggable: true, keyboard: false, title: "Gebiet verschieben" }).addTo(karte);
      griffe.mitte.on("dragstart", function () {
        start = { punkt: griffe.mitte.getLatLng(), grenzen: rechteck.getBounds() };
      });
      griffe.mitte.on("drag", function () {
        var jetzt = griffe.mitte.getLatLng();
        var dLat = jetzt.lat - start.punkt.lat;
        var dLng = jetzt.lng - start.punkt.lng;
        var sw = start.grenzen.getSouthWest(), ne = start.grenzen.getNorthEast();
        aktualisiere(L.latLngBounds([sw.lat + dLat, sw.lng + dLng], [ne.lat + dLat, ne.lng + dLng]));
      });
      griffe.mitte.on("dragend", nachAenderung);
    }

    aktualisiere(grenzen);
    hinweis.style.display = "none";
    knopfDownload.disabled = false;
  }

  // ---------- von der Suche aufgerufen ----------
  M2M.springeZu = function (lat, lng) {
    karte.setView([lat, lng], 16);
    erzeugeRechteck(L.latLng(lat, lng));
  };

  // ---------- geladene Daten auf der Karte zeigen ----------
  var datenEbene = L.layerGroup().addTo(karte);
  var KARTEN_FARBE = {
    "Gebäude": "#6b5e4a", "Straße": "#7a8089", "Wasser": "#2f6aa3", "Grün": "#3f8a52",
    "Baum": "#1f6b33", "Brücke": "#8a7a5c", "Bahn": "#33343a",
  };
  function zeigeDaten(modell) {
    datenEbene.clearLayers();
    var p = modell.projektion;
    function gr(ring) { return ring.map(function (pt) { return p.zuGrad(pt[0], pt[1]); }); }
    var reihenfolge = ["Wasser", "Grün", "Straße", "Bahn", "Brücke", "Gebäude", "Baum"];
    reihenfolge.forEach(function (kat) {
      modell.elemente.forEach(function (e) {
        if (e.kategorie !== kat) return;
        var farbe = KARTEN_FARBE[kat];
        if (e.kreis) {
          L.circle(p.zuGrad(e.kreis.x, e.kreis.y), { radius: e.kreis.r, color: farbe, weight: 1, fillOpacity: 0.6, interactive: false }).addTo(datenEbene);
        } else {
          L.polygon([gr(e.aussen)].concat(e.innen.map(gr)), {
            color: farbe, weight: kat === "Gebäude" ? 1.2 : 0.6, fillColor: farbe,
            fillOpacity: kat === "Gebäude" ? 0.55 : 0.35, interactive: false,
          }).addTo(datenEbene);
        }
      });
    });
  }

  // ---------- Inhalt der Datei in der Seitenleiste auflisten ----------
  function zeigeInhalt(modell) {
    var liste = document.getElementById("inhalt-liste");
    liste.innerHTML = "";
    ["Gebäude", "Straße", "Wasser", "Grün", "Baum", "Brücke", "Bahn"].forEach(function (kat) {
      var n = modell.anzahl[kat] || 0;
      var li = document.createElement("li");
      li.innerHTML = '<i style="background:' + KARTEN_FARBE[kat] + '"></i><span>' + kat + '</span><b class="mono">' + n + "</b>";
      if (!n) li.classList.add("leer");
      liste.appendChild(li);
    });
    var geschaetzt = modell.elemente.filter(function (e) {
      return e.kategorie === "Gebäude" && e.quelle.indexOf("Schätzung") === 0;
    }).length;
    document.getElementById("inhalt-hinweis").textContent = geschaetzt
      ? geschaetzt + " von " + (modell.anzahl["Gebäude"] || 0) + " Gebäudehöhen sind geschätzt (in OSM fehlt die Höhe)."
      : "";
    document.getElementById("gebiet-inhalt").hidden = false;
  }

  // ---------- grüner Download-Button: Daten laden, IFC schreiben, herunterladen ----------
  var knopfText = knopfDownload.innerHTML;
  function knopfLaedt(text) {
    knopfDownload.disabled = !!text;
    knopfDownload.innerHTML = text ? '<span class="lader" aria-hidden="true"></span>' + text : knopfText;
  }

  knopfDownload.addEventListener("click", async function () {
    if (!M2M.gebiet) return;
    try {
      var modell = await M2M.ladeOsm(M2M.gebiet, function (t) { knopfLaedt(t.replace(" …", "…")); });
      if (!modell.elemente.length) {
        M2M.melde("In diesem Gebiet wurden keine Daten gefunden. Rechteck verschieben?", "fehler");
        return;
      }
      M2M.modell = modell;
      zeigeDaten(modell);
      zeigeInhalt(modell);

      knopfLaedt("Schreibe IFC-Datei…");
      var heute = new Date().toISOString().slice(0, 10);
      var ort = (M2M.ortName || "Gebiet").replace(/[^\wäöüÄÖÜß-]+/g, "_").slice(0, 40);
      var dateiname = "Map2Model_" + ort + "_" + heute + ".ifc";
      var dachform = (document.querySelector("input[name=dachform]:checked") || {}).value || "flach";
      var ifc = M2M.schreibeIfc(modell, { ort: M2M.ortName, dateiname: dateiname, dachform: dachform });
      if (dachform === "sattel" && modell.daecher) {
        var hinweis = document.getElementById("inhalt-hinweis");
        hinweis.textContent += (hinweis.textContent ? " " : "") + modell.daecher.sattel + " Satteldächer, " +
          modell.daecher.flach + " Gebäude bleiben flach (Halle, Garage, Innenhof oder in OSM als Flachdach).";
      }

      M2M.letzteIfc = ifc;
      M2M.letzteIfcName = dateiname;

      // Frage: „Darf ich sie in deinem CAD-Programm öffnen?“ (js/arbeitsordner.js)
      M2M.ifcFertig(dateiname, ifc);
    } catch (fehler) {
      console.error(fehler);
      var t = String(fehler && fehler.message || "");
      M2M.melde(t === "ausgelastet"
        ? "Der Kartendienst ist gerade ausgelastet. Bitte in einer Minute noch einmal versuchen."
        : "Die Kartendaten konnten nicht geladen werden. Internet prüfen oder das Gebiet verkleinern.", "fehler");
    } finally {
      knopfLaedt(null);
    }
  });
})();
