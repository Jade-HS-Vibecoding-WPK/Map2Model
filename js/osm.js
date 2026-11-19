/* =========================================================
   OpenStreetMap-Daten über die Overpass API laden
   und in Elemente für das Modell umwandeln.

   Ergebnis von M2M.ladeOsm(gebiet):
   {
     rechteck: { xmin, ymin, xmax, ymax }   (Meter, Mitte = 0/0)
     projektion,                            (Grad ↔ Meter)
     elemente: [ { kategorie, name, aussen, innen, basis, hoehe, quelle, osm } ... ]
   }
   Bäume haben statt aussen/innen: kreis = { x, y, r }.
   ========================================================= */

(function () {
  var SERVER = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
  ];

  // ---------- Höhen und Breiten ----------
  var GESCHOSS_M = 3;
  var STANDARD_GESCHOSSE = 2;
  var KLEINBAUTEN = /^(garage|garages|shed|carport|hut|cabin|kiosk|roof|toilets|container)$/;

  // Darstellung in Revit (die Laserdatei rechnet ihre Ebenen selbst aus der Kategorie)
  // Bodenplatte −0,3…0 m; Wasser liegt 1 cm über der Platte, damit es in Revit sichtbar ist.
  var FLACH = {
    "Gelände": { basis: -0.3, hoehe: 0.3 },
    "Wasser": { basis: -0.5, hoehe: 0.51 },
    "Straße": { basis: 0, hoehe: 0.05 },
    "Grün":   { basis: 0, hoehe: 0.1 },
    "Bahn":   { basis: 0, hoehe: 0.15 },
    "Brücke": { basis: 2, hoehe: 0.8 },
  };

  var STRASSEN_BREITE = {
    motorway: 14, trunk: 12, primary: 10, secondary: 9, tertiary: 8,
    motorway_link: 6, trunk_link: 6, primary_link: 6, secondary_link: 6, tertiary_link: 6,
    residential: 7, unclassified: 6, living_street: 6, road: 6,
    service: 4, pedestrian: 5, track: 3,
    footway: 2.5, path: 2, cycleway: 2.5, steps: 2.5, bridleway: 2.5, corridor: 2,
  };

  function zahl(text) {
    if (text == null) return NaN;
    var m = String(text).replace(",", ".").match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : NaN;
  }

  function gebaeudeHoehe(tags) {
    var h = zahl(tags.height) || zahl(tags["building:height"]);
    if (h > 0) return { hoehe: h, quelle: "OSM Höhe" };
    var g = zahl(tags["building:levels"]);
    if (g > 0) {
      var dach = zahl(tags["roof:levels"]) || 0;
      return { hoehe: (g + dach) * GESCHOSS_M, quelle: "OSM Geschosse × 3 m" };
    }
    if (KLEINBAUTEN.test(tags.building)) return { hoehe: GESCHOSS_M, quelle: "Schätzung (Nebengebäude)" };
    return { hoehe: STANDARD_GESCHOSSE * GESCHOSS_M, quelle: "Schätzung (2 Geschosse)" };
  }

  // ---------- Overpass-Abfrage ----------
  function abfrage(b) {
    var bb = "(" + [b.sued, b.west, b.nord, b.ost].map(function (v) { return v.toFixed(6); }).join(",") + ")";
    return "[out:json][timeout:90];(" +
      'way["building"]' + bb + ';relation["building"]["type"="multipolygon"]' + bb + ";" +
      'way["highway"]' + bb + ";" +
      'way["railway"~"^(rail|tram|light_rail|subway|narrow_gauge)$"]' + bb + ";" +
      'way["natural"="water"]' + bb + ';relation["natural"="water"]' + bb + ";" +
      'way["waterway"="riverbank"]' + bb + ';relation["waterway"="riverbank"]' + bb + ";" +
      'way["landuse"~"^(basin|reservoir)$"]' + bb + ";" +
      'way["landuse"~"^(grass|meadow|forest|village_green|recreation_ground|allotments|cemetery)$"]' + bb + ";" +
      'relation["landuse"~"^(grass|meadow|forest|village_green|recreation_ground)$"]' + bb + ";" +
      'way["leisure"~"^(park|garden|pitch|playground)$"]' + bb + ';relation["leisure"="park"]' + bb + ";" +
      'way["natural"~"^(wood|scrub|grassland|heath)$"]' + bb + ';relation["natural"="wood"]' + bb + ";" +
      'node["natural"="tree"]' + bb + ";" +
      'way["man_made"~"^(bridge|pier)$"]' + bb + ";" +
      'way["natural"="coastline"]' + bb + ";" +
      ");out geom;";
  }

  async function mitZeitlimit(url, optionen, ms) {
    var c = new AbortController();
    var t = setTimeout(function () { c.abort(); }, ms);
    try { return await fetch(url, Object.assign({ signal: c.signal }, optionen)); }
    finally { clearTimeout(t); }
  }

  async function holeDaten(gebiet, fortschritt) {
    var text = abfrage(gebiet), letzterFehler = null;
    // 1. Weg: Overpass API (mehrere Server nacheinander)
    for (var i = 0; i < SERVER.length; i++) {
      try {
        var antwort = await mitZeitlimit(SERVER[i], {
          method: "POST",
          body: "data=" + encodeURIComponent(text),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }, 15000);
        if (!antwort.ok) { letzterFehler = new Error(antwort.status === 429 ? "ausgelastet" : "HTTP " + antwort.status); continue; }
        var json = await antwort.json();
        // Bei Überlastung liefert Overpass manchmal nur einen TEIL der Daten mit einem Hinweis („remark“).
        if (json.remark && /error|timed out|timeout|out of memory/i.test(json.remark)) {
          letzterFehler = new Error("ausgelastet"); continue;
        }
        return json;
      } catch (e) { letzterFehler = e; }
    }
    // 2. Weg (Ersatz): direkt von openstreetmap.org – nur für kleine Gebiete
    var flaecheGrad = (gebiet.nord - gebiet.sued) * (gebiet.ost - gebiet.west);
    if (flaecheGrad < 0.24) {
      fortschritt && fortschritt("Kartendienst überlastet – lade direkt von OpenStreetMap …");
      try {
        var url = "https://api.openstreetmap.org/api/0.6/map?bbox=" +
          [gebiet.west, gebiet.sued, gebiet.ost, gebiet.nord].map(function (v) { return v.toFixed(6); }).join(",");
        var a2 = await mitZeitlimit(url, {}, 60000);
        if (a2.ok) return xmlZuElementen(await a2.text());
        letzterFehler = new Error(a2.status === 509 || a2.status === 429 ? "ausgelastet" : "HTTP " + a2.status);
      } catch (e) { letzterFehler = e; }
    }
    throw letzterFehler || new Error("keine Antwort");
  }

  // OSM-XML (openstreetmap.org) in dieselbe Form wie die Overpass-Antwort bringen
  function xmlZuElementen(xmlText) {
    var doc = new DOMParser().parseFromString(xmlText, "application/xml");
    function tagsVon(el) {
      var t = {};
      el.querySelectorAll(":scope > tag").forEach(function (tg) { t[tg.getAttribute("k")] = tg.getAttribute("v"); });
      return t;
    }
    var knoten = {}, wege = {}, aus = [];
    doc.querySelectorAll("osm > node").forEach(function (n) {
      var k = { type: "node", id: +n.getAttribute("id"), lat: +n.getAttribute("lat"), lon: +n.getAttribute("lon"), tags: tagsVon(n) };
      knoten[k.id] = k;
      if (Object.keys(k.tags).length) aus.push(k);
    });
    doc.querySelectorAll("osm > way").forEach(function (wEl) {
      var geo = [], vollstaendig = true;
      wEl.querySelectorAll(":scope > nd").forEach(function (nd) {
        var k = knoten[nd.getAttribute("ref")];
        if (k) geo.push({ lat: k.lat, lon: k.lon }); else vollstaendig = false;
      });
      var w = { type: "way", id: +wEl.getAttribute("id"), tags: tagsVon(wEl), geometry: geo };
      wege[w.id] = w;
      if (vollstaendig && geo.length >= 2) aus.push(w);
    });
    doc.querySelectorAll("osm > relation").forEach(function (rEl) {
      var tags = tagsVon(rEl);
      if (tags.type !== "multipolygon") return;
      var members = [];
      rEl.querySelectorAll(":scope > member").forEach(function (m) {
        if (m.getAttribute("type") !== "way") return;
        var w = wege[m.getAttribute("ref")];
        if (w) members.push({ type: "way", ref: w.id, role: m.getAttribute("role"), geometry: w.geometry });
      });
      aus.push({ type: "relation", id: +rEl.getAttribute("id"), tags: tags, members: members });
    });
    return { elements: aus };
  }

  // ---------- Kategorie eines OSM-Objekts ----------
  function kategorie(tags, typ) {
    if (typ === "node") return tags.natural === "tree" ? "Baum" : null;
    if (tags.building && tags.building !== "no" && tags.building !== "roof") return "Gebäude";
    if (tags.natural === "coastline") return "Küste";
    if (tags.highway) {
      if (tags.tunnel && tags.tunnel !== "no") return null;
      if (/^(proposed|construction|platform|bus_stop|elevator|raceway|abandoned)$/.test(tags.highway)) return null;
      if (tags.area === "yes") return null;
      return tags.bridge && tags.bridge !== "no" ? "Brücke-Linie" : "Straße";
    }
    if (/^(rail|tram|light_rail|subway|narrow_gauge)$/.test(tags.railway)) {
      if (tags.tunnel && tags.tunnel !== "no") return null;
      return "Bahn";
    }
    if (tags.man_made === "bridge" || tags.man_made === "pier") return "Brücke";
    if (tags.natural === "water" || tags.waterway === "riverbank" || /^(basin|reservoir)$/.test(tags.landuse)) return "Wasser";
    if (/^(grass|meadow|forest|village_green|recreation_ground|allotments|cemetery)$/.test(tags.landuse) ||
        /^(park|garden|pitch|playground)$/.test(tags.leisure) ||
        /^(wood|scrub|grassland|heath)$/.test(tags.natural)) return "Grün";
    return null;
  }

  // ---------- Hauptfunktion ----------
  M2M.ladeOsm = async function (gebiet, fortschritt) {
    var G = M2M.geo;
    fortschritt && fortschritt("Lade Kartendaten von OpenStreetMap …");
    var daten = await holeDaten(gebiet, fortschritt);

    fortschritt && fortschritt("Bereite Daten auf …");
    var proj = G.projektion((gebiet.sued + gebiet.nord) / 2, (gebiet.west + gebiet.ost) / 2);
    var sw = proj.zuMeter(gebiet.sued, gebiet.west), ne = proj.zuMeter(gebiet.nord, gebiet.ost);
    var r = { xmin: sw[0], ymin: sw[1], xmax: ne[0], ymax: ne[1] };

    function zuMeter(liste) { return liste.map(function (p) { return proj.zuMeter(p.lat, p.lon); }); }

    var flaechen = [];   // { kat, aussen, innen, tags, osm }
    var kuestenWege = [];
    var elemente = [];
    var kwPunkte = [];
    var strassenNamen = []; // { name, pts: [[x, y], …] } in Metern

    (daten.elements || []).forEach(function (el) {
      var tags = el.tags || {};
      var kat = kategorie(tags, el.type);
      if (!kat) return;
      var osm = el.type + "/" + el.id;

      if (kat === "Baum") {
        var p = proj.zuMeter(el.lat, el.lon);
        if (p[0] < r.xmin || p[0] > r.xmax || p[1] < r.ymin || p[1] > r.ymax) return;
        var krone = zahl(tags.diameter_crown);
        var hoehe = zahl(tags.height);
        elemente.push({
          kategorie: "Baum", kreis: { x: p[0], y: p[1], r: krone > 0 ? krone / 2 : 2.5 },
          basis: 0, hoehe: hoehe > 0 ? hoehe : 8, quelle: hoehe > 0 ? "OSM Höhe" : "Schätzung", osm: osm,
        });
        return;
      }

      if (kat === "Küste") { if (el.geometry) kuestenWege.push(el.geometry); return; }

      // Kaiser-Wilhelm-Brücke: wird später als Stahlmodell gebaut, hier nur die Lage merken
      if ((kat === "Brücke-Linie" || kat === "Brücke") && M2M.KW_BRUECKE && M2M.KW_BRUECKE.name.test(tags.name || "")) {
        if (el.geometry) kwPunkte = kwPunkte.concat(zuMeter(el.geometry));
        return;
      }

      // Linien: Straßen, Gleise, Brücken-Wege
      if (kat === "Straße" || kat === "Bahn" || kat === "Brücke-Linie") {
        if (!el.geometry) return;
        var breite = zahl(tags.width);
        if (!(breite > 0)) breite = kat === "Bahn" ? 3 : (STRASSEN_BREITE[tags.highway] || 5);
        var geschlossen = el.geometry.length > 3 &&
          el.geometry[0].lat === el.geometry[el.geometry.length - 1].lat &&
          el.geometry[0].lon === el.geometry[el.geometry.length - 1].lon;
        // geschlossene Fußgängerflächen o. ä. als Fläche behandeln
        if (geschlossen && tags.area === "yes") return;
        G.schneideLinie(zuMeter(el.geometry), r).forEach(function (teil) {
          // Straßennamen merken (Mittellinie) – sie werden später auf die Bodenplatte graviert
          if (kat === "Straße" && tags.name && teil.length >= 2) strassenNamen.push({ name: tags.name, pts: teil });
          G.linieZuFlaechen(teil, breite).forEach(function (f) {
            flaechen.push({ kat: kat === "Brücke-Linie" ? "Brücke" : kat, aussen: f, innen: [], tags: tags, osm: osm });
          });
        });
        return;
      }

      // Flächen aus Wegen
      if (el.type === "way" && el.geometry && el.geometry.length >= 4) {
        flaechen.push({ kat: kat, aussen: zuMeter(el.geometry), innen: [], tags: tags, osm: osm });
        return;
      }
      // Flächen aus Relationen (Multipolygone mit Löchern)
      if (el.type === "relation" && el.members) {
        var aussenWege = [], innenWege = [];
        el.members.forEach(function (m) {
          if (m.type !== "way" || !m.geometry) return;
          (m.role === "inner" ? innenWege : aussenWege).push(m.geometry);
        });
        var innenRinge = G.setzeRingeZusammen(innenWege).map(zuMeter);
        G.setzeRingeZusammen(aussenWege).forEach(function (ring) {
          var aussen = zuMeter(ring);
          var innen = innenRinge.filter(function (ir) { return G.punktInRing(ir[0], aussen); });
          flaechen.push({ kat: kat, aussen: aussen, innen: innen, tags: tags, osm: osm });
        });
      }
    });

    // ---------- Flächen zuschneiden ----------
    // Gebäude bleiben einzeln. Alle anderen Flächen werden je Kategorie gesammelt
    // und weiter unten zu einer zusammenhängenden Fläche verschmolzen.
    var uebersprungen = 0;
    var sammlung = { "Straße": [], "Bahn": [], "Wasser": [], "Grün": [], "Brücke": [] };
    flaechen.forEach(function (f) {
      var aussen = G.saeubereRing(G.schneideRing(G.bereinigeRing(f.aussen), r), true);
      if (!aussen || Math.abs(G.flaeche(aussen)) < 1) return;
      if (G.schneidetSichSelbst(aussen)) { uebersprungen++; return; }
      var innen = f.innen
        .map(function (ir) { return G.saeubereRing(G.schneideRing(G.bereinigeRing(ir), r), false); })
        .filter(function (ir) { return ir && Math.abs(G.flaeche(ir)) >= 1 && !G.schneidetSichSelbst(ir); });

      if (f.kat === "Gebäude") {
        var h = gebaeudeHoehe(f.tags);
        elemente.push({ kategorie: "Gebäude", aussen: aussen, innen: innen, osm: f.osm,
          basis: 0, hoehe: h.hoehe, quelle: h.quelle,
          // Angaben für das Satteldach (siehe js/dach.js)
          dach: {
            osmForm: f.tags["roof:shape"] || null,
            osmDachHoehe: zahl(f.tags["roof:height"]) || null,
            quer: f.tags["roof:orientation"] === "across",
            gesamtHoeheBekannt: zahl(f.tags.height) > 0 || zahl(f.tags["building:height"]) > 0,
            dachgeschosse: zahl(f.tags["roof:levels"]) || 0,
            klein: KLEINBAUTEN.test(f.tags.building || ""),
          } });
      } else if (sammlung[f.kat]) {
        sammlung[f.kat].push([aussen].concat(innen));
      }
    });

    // ---------- Meer aus der Küstenlinie ----------
    if (kuestenWege.length) {
      var linien = G.verbindeLinien(kuestenWege).map(zuMeter);
      var punkte = elemente.filter(function (e) { return e.kategorie === "Gebäude"; })
        .map(function (e) { return G.schwerpunkt(e.aussen); });
      // Probe: Das Meer sollte möglichst keine Gebäude enthalten.
      // Sind die Küstendaten verkehrt herum, wird die andere Seite genommen.
      function gebaeudeImMeer(meere) {
        return punkte.filter(function (p) {
          return meere.some(function (m) { return G.punktInRing(p, m.aussen); });
        }).length;
      }
      var meer = G.meerAusKueste(linien, r, 1);
      if (punkte.length && gebaeudeImMeer(meer) > punkte.length / 2) meer = G.meerAusKueste(linien, r, -1);
      meer.forEach(function (m) {
        var aussen = G.saeubereRing(m.aussen, true);
        if (!aussen || G.schneidetSichSelbst(aussen)) return;
        var innen = m.innen.map(function (ir) { return G.saeubereRing(ir, false); }).filter(Boolean);
        sammlung["Wasser"].push([aussen].concat(innen));
      });
    }

    // ---------- Flächen verschmelzen, ohne Überlagerung ----------
    // Rangfolge: Wasser > Straße > Bahn > Grün. Was weiter oben steht, wird
    // aus den unteren Kategorien herausgeschnitten. Brücken liegen erhöht
    // über allem und bleiben deshalb ganz.
    var wasser = M2M.geo.vereinige(sammlung["Wasser"]);
    var strasse = M2M.geo.abzueglich(M2M.geo.vereinige(sammlung["Straße"]), [wasser]);
    var bahn = M2M.geo.abzueglich(M2M.geo.vereinige(sammlung["Bahn"]), [wasser, strasse]);
    var gruen = M2M.geo.abzueglich(M2M.geo.vereinige(sammlung["Grün"]), [wasser, strasse, bahn]);
    var bruecke = M2M.geo.vereinige(sammlung["Brücke"]);

    // ---------- Sondermodell Kaiser-Wilhelm-Brücke (Stahlkonstruktion) ----------
    if (kwPunkte.length >= 2 && M2M.baueKwBruecke) {
      // Brückenachse = die zwei am weitesten auseinanderliegenden Punkte der Brücken-Wege
      var a = kwPunkte[0], b = kwPunkte[1], best = -1;
      kwPunkte.forEach(function (p) {
        kwPunkte.forEach(function (q) {
          var d = (p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1]);
          if (d > best) { best = d; a = p; b = q; }
        });
      });
      var mitte = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      var laenge = Math.sqrt(best) || 1;
      if (mitte[0] > r.xmin && mitte[0] < r.xmax && mitte[1] > r.ymin && mitte[1] < r.ymax) {
        var kw = M2M.baueKwBruecke(mitte, [(b[0] - a[0]) / laenge, (b[1] - a[1]) / laenge]);
        var deck = G.saeubereRing(G.schneideRing(kw.deck, r), true);
        if (deck) {
          // andere Brückenflächen auf derselben Brücke (z. B. Gehwege) nicht doppelt:
          // alles, was im Streifen der Kaiser-Wilhelm-Brücke liegt, fällt weg
          var ux = (b[0] - a[0]) / laenge, uy = (b[1] - a[1]) / laenge;
          bruecke = M2M.geo.abzueglich(bruecke, [[[kw.deck]]]).filter(function (poly) {
            var sp = G.schwerpunkt(poly[0]);
            var dx = sp[0] - mitte[0], dy = sp[1] - mitte[1];
            var entlang = dx * ux + dy * uy, quer = -dx * uy + dy * ux;
            return !(Math.abs(entlang) < 85 && Math.abs(quer) < 15);
          });
          elemente.push({
            kategorie: "Brücke", sondername: "Brücke_Kaiser-Wilhelm", aussen: deck, innen: [],
            basis: kw.deckUnten, hoehe: kw.deckDicke, stahl: kw.staebe,
            quelle: "Sondermodell nach Wikipedia-Daten (vereinfacht)", osm: "Kaiser-Wilhelm-Brücke",
          });
        }
      }
    }

    [["Wasser", wasser, "OSM Gewässer/Küste"], ["Straße", strasse, "OSM Straßen und Wege"],
     ["Bahn", bahn, "OSM Gleise"], ["Grün", gruen, "OSM Grünflächen"], ["Brücke", bruecke, "OSM Brücken"]]
      .forEach(function (k) {
        M2M.geo.zuRingen(k[1]).forEach(function (p) {
          elemente.push({ kategorie: k[0], aussen: p.aussen, innen: p.innen, osm: k[2],
            basis: FLACH[k[0]].basis, hoehe: FLACH[k[0]].hoehe, quelle: "Darstellung" });
        });
      });

    // ---------- Bodenplatte über das ganze Rechteck ----------
    elemente.push({
      kategorie: "Gelände",
      aussen: [[r.xmin, r.ymin], [r.xmax, r.ymin], [r.xmax, r.ymax], [r.xmin, r.ymax]],
      innen: [], basis: FLACH["Gelände"].basis, hoehe: FLACH["Gelände"].hoehe,
      quelle: "Gebietsrahmen", osm: "Rechteck",
    });

    // ---------- Nummerieren: von oben links nach unten rechts ----------
    var zaehler = {};
    elemente.forEach(function (e) {
      e._sp = e.kreis ? [e.kreis.x, e.kreis.y] : G.schwerpunkt(e.aussen);
    });
    elemente.sort(function (a, b) {
      var za = Math.round(-a._sp[1] / 40), zb = Math.round(-b._sp[1] / 40);
      return za !== zb ? za - zb : a._sp[0] - b._sp[0];
    });
    elemente.forEach(function (e) {
      zaehler[e.kategorie] = (zaehler[e.kategorie] || 0) + 1;
      e.nummer = zaehler[e.kategorie];
      e.name = e.sondername || (e.kategorie + "_" + e.nummer);
      delete e._sp;
    });

    return { rechteck: r, projektion: proj, elemente: elemente, anzahl: zaehler, uebersprungen: uebersprungen, strassenNamen: strassenNamen };
  };
})();
