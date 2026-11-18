/* =========================================================
   Bearbeitete IFC-Datei (aus Revit) einlesen
   - liest alle Bauteile mit web-ifc (läuft im Browser)
   - erkennt die Kategorie am Kennwort im Namen
     (auch mitten im Namen, z. B. "Neubau_Gebäude_1:Typ:12345")
   - merkt sich je Bauteil die nach oben zeigenden Dreiecke
     → daraus lassen sich Grundriss und Schnitte in jeder Höhe bilden
   Koordinaten: Meter, x = Osten, y = Norden, z = oben.
   ========================================================= */

(function () {
  var WEBIFC_VERSION = "0.0.66";
  var WEBIFC_URL = "https://cdn.jsdelivr.net/npm/web-ifc@" + WEBIFC_VERSION + "/";
  var apiVersprechen = null;

  function ladeWebIfc() {
    if (!apiVersprechen) {
      apiVersprechen = (async function () {
        var W = await import(WEBIFC_URL + "web-ifc-api.js");
        var api = new W.IfcAPI();
        api.SetWasmPath(WEBIFC_URL, true);
        await api.Init();
        return { W: W, api: api };
      })();
      apiVersprechen.catch(function () { apiVersprechen = null; });
    }
    return apiVersprechen;
  }

  // Umlaute und Schreibweisen vereinheitlichen: "Gebäude" = "gebaeude" = "GEBAUDE"
  function normal(s) {
    return String(s || "").toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
  }

  var KENNWOERTER = [
    { kat: "Gelände", muster: /gelaende|gelande/ },
    { kat: "Gebäude", muster: /gebaeude|gebaude/ },
    { kat: "Straße", muster: /strasse|strase|weg_/ },
    { kat: "Wasser", muster: /wasser/ },
    { kat: "Grün", muster: /gruen|grun_/ },
    { kat: "Baum", muster: /baum/ },
    { kat: "Brücke", muster: /bruecke|brucke/ },
    { kat: "Bahn", muster: /bahn/ },
  ];

  function erkenne(texte) {
    var t = normal(texte.join(" "));
    var neubau = /neubau/.test(t);
    for (var i = 0; i < KENNWOERTER.length; i++) {
      var k = KENNWOERTER[i];
      var m = t.match(k.muster);
      if (m) {
        var rest = t.slice(m.index);
        var nr = rest.match(/_(\d+)/);
        return { kategorie: k.kat, neubau: neubau, nummer: nr ? parseInt(nr[1], 10) : null };
      }
    }
    return { kategorie: null, neubau: neubau, nummer: null };
  }

  function wert(x) { return x && typeof x === "object" && "value" in x ? x.value : x; }

  // Revit schreibt Namen oft als „Familie:Typ:123456“ → den Teil mit dem Kennwort nehmen
  // und Unterstriche durch Leerzeichen ersetzen: „Neubau_Gebäude_1“ → „Neubau Gebäude 1“
  function sauberName(name) {
    var teile = String(name || "").split(":").map(function (t) { return t.trim(); })
      .filter(function (t) { return t && !/^\d+$/.test(t); });
    if (!teile.length) return "";
    var mitKennwort = teile.filter(function (t) {
      var n = normal(t);
      return /neubau/.test(n) || KENNWOERTER.some(function (k) { return k.muster.test(n); });
    });
    return (mitKennwort[0] || teile[0]).replace(/_+/g, " ").replace(/\s+/g, " ").trim();
  }

  M2M.leseIfc = async function (datei, fortschritt) {
    fortschritt && fortschritt("Lade IFC-Leser …");
    var w = await ladeWebIfc();
    var api = w.api;

    fortschritt && fortschritt("Lese " + datei.name + " …");
    var bytes = new Uint8Array(await datei.arrayBuffer());
    var id = api.OpenModel(bytes, { COORDINATE_TO_ORIGIN: true });

    var elemente = [];
    try {
      api.StreamAllMeshes(id, function (mesh) {
        var info = null;
        try { info = api.GetLine(id, mesh.expressID); } catch (e) { /* ohne Namen weiter */ }
        var texte = info ? [wert(info.Name), wert(info.ObjectType), wert(info.Description), wert(info.Tag), wert(info.LongName)] : [];
        var art = erkenne(texte);

        var dreiecke = [], zmin = Infinity, zmax = -Infinity;
        for (var j = 0; j < mesh.geometries.size(); j++) {
          var pg = mesh.geometries.get(j);
          var g = api.GetGeometry(id, pg.geometryExpressID);
          var v = api.GetVertexArray(g.GetVertexData(), g.GetVertexDataSize());
          var ix = api.GetIndexArray(g.GetIndexData(), g.GetIndexDataSize());
          var T = pg.flatTransformation;
          // web-ifc liefert „y oben“ – zurück in x = Ost, y = Nord, z = oben
          var pts = [];
          for (var k = 0; k < v.length; k += 6) {
            var x = v[k], y = v[k + 1], z = v[k + 2];
            var X = T[0] * x + T[4] * y + T[8] * z + T[12];
            var Y = T[1] * x + T[5] * y + T[9] * z + T[13];
            var Z = T[2] * x + T[6] * y + T[10] * z + T[14];
            pts.push([X, -Z, Y]);
            if (Y < zmin) zmin = Y;
            if (Y > zmax) zmax = Y;
          }
          for (var t = 0; t < ix.length; t += 3) {
            var a = pts[ix[t]], b = pts[ix[t + 1]], c = pts[ix[t + 2]];
            // Normale: nur Flächen, die nach oben zeigen (Dächer, Oberseiten)
            var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
            var vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
            var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
            var laenge = Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (laenge < 1e-8) continue;
            if (nz / laenge > 0.25) dreiecke.push([a, b, c]);
          }
          if (g.delete) try { g.delete(); } catch (e) { /* egal */ }
        }
        if (!dreiecke.length) return;
        elemente.push({
          id: mesh.expressID,
          name: wert(info && info.Name) || ("Element " + mesh.expressID),
          anzeige: sauberName(wert(info && info.Name)) || ("Element " + mesh.expressID),
          kategorie: art.kategorie, neubau: art.neubau, nummer: art.nummer,
          dreiecke: dreiecke, zmin: zmin, zmax: zmax,
        });
      });
    } finally {
      api.CloseModel(id);
    }

    // Rahmen = Bodenplatte (Gelände), sonst alles zusammen
    var rahmen = null;
    var gelaende = elemente.filter(function (e) { return e.kategorie === "Gelände"; });
    var quelle = gelaende.length ? gelaende : elemente;
    quelle.forEach(function (e) {
      e.dreiecke.forEach(function (d) {
        d.forEach(function (p) {
          if (!rahmen) rahmen = { xmin: p[0], ymin: p[1], xmax: p[0], ymax: p[1] };
          rahmen.xmin = Math.min(rahmen.xmin, p[0]); rahmen.xmax = Math.max(rahmen.xmax, p[0]);
          rahmen.ymin = Math.min(rahmen.ymin, p[1]); rahmen.ymax = Math.max(rahmen.ymax, p[1]);
        });
      });
    });
    if (!rahmen) throw new Error("In der Datei wurden keine Bauteile mit Geometrie gefunden.");

    // Grundhöhe = Oberkante Gelände (sonst tiefster Punkt der Gebäude)
    var boden = gelaende.length ? Math.max.apply(null, gelaende.map(function (e) { return e.zmax; })) : 0;

    // Elemente ohne Kennwort: mit Höhe → als Neubau-Gebäude behandeln, sonst ignorieren
    var ohneKennwort = 0;
    elemente.forEach(function (e) {
      if (!e.kategorie) {
        ohneKennwort++;
        if (e.zmax - e.zmin > 1) { e.kategorie = "Gebäude"; e.neubau = true; e.geraten = true; }
      }
    });

    return {
      elemente: elemente.filter(function (e) { return e.kategorie; }),
      rahmen: rahmen, boden: boden, ohneKennwort: ohneKennwort,
    };
  };

  // ---------- Schnitt eines Bauteils in Höhe z (Meter) → Fläche im Grundriss ----------
  // Alle nach oben zeigenden Flächen oberhalb von z, von oben gesehen, ergeben den Querschnitt.
  M2M.schnitt = function (element, z, nurBis) {
    var polys = [];
    element.dreiecke.forEach(function (d) {
      if (nurBis != null && Math.max(d[0][2], d[1][2], d[2][2]) > nurBis) return;
      // Dreieck an der Ebene z abschneiden (nur der Teil darüber zählt)
      var aus = [];
      for (var i = 0; i < 3; i++) {
        var p = d[i], q = d[(i + 1) % 3];
        var pIn = p[2] >= z - 1e-6, qIn = q[2] >= z - 1e-6;
        if (pIn) aus.push([p[0], p[1]]);
        if (pIn !== qIn) {
          var t = (z - p[2]) / (q[2] - p[2]);
          aus.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
        }
      }
      if (aus.length >= 3 && Math.abs(M2M.geo.flaeche(aus)) > 1e-4) polys.push([aus]);
    });
    if (!polys.length) return [];
    return M2M.geo.vereinige(polys);
  };
})();
