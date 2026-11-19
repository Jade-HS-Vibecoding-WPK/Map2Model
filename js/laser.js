/* =========================================================
   Laserdatei erzeugen (Jade-HS-Regeln)
   Eingabe: eingelesene IFC (M2M.leseIfc) + Einstellungen
   Ausgabe: Liste von Platten („Blätter“) mit Linien und Gravurflächen
            in mm, Laserbett 1000 × 600 mm (Ursprung unten links).

   Farben:  rot = schneiden · blau = anritzen · gelb = Rahmen/Orientierung
            schwarz = Gravur (Linien und feine Schrift, z. B. Straßennamen)
   ========================================================= */

(function () {
  var BETT_B = 1000, BETT_H = 600;
  var PLATTE_X = 5, PLATTE_Y = 5;   // Platte liegt 5 mm vom gelben Rahmen entfernt
  var RAND = 4;                     // Abstand der Teile zum Plattenrand
  var ABSTAND = 3;                  // Abstand der Teile untereinander
  var MIN_SCHRIFT = 1.8;            // mm Schrifthöhe (Großbuchstaben ≈ 1,5 mm) – kleiner wird unleserlich
  var KLEIN_SCHRIFT = 1.2;          // mm – nur als Notlösung für sehr kleine Teile (Kurzform)

  var PC = function () { return window.polygonClipping; };

  // ---------- Werkzeuge für Flächen (MultiPolygon = [[ring, loch...], ...]) ----------
  function schneide(a, b) { if (!a.length || !b.length) return []; try { return PC().intersection(a, b); } catch (e) { console.warn(e); return []; } }
  function ohne(a, b) { if (!a.length) return []; if (!b.length) return a; try { return PC().difference(a, b); } catch (e) { console.warn(e); return a; } }
  function vereint(liste) { liste = liste.filter(function (m) { return m && m.length; }); if (!liste.length) return []; try { return PC().union.apply(null, liste); } catch (e) { console.warn(e); return [].concat.apply([], liste); } }
  function rechteck(x, y, w, h) { return [[[[x, y], [x + w, y], [x + w, y + h], [x, y + h]]]]; }

  function abbilden(mp, fn) { return mp.map(function (poly) { return poly.map(function (ring) { return ring.map(fn); }); }); }
  function rahmenVon(mp) {
    var b = { xmin: Infinity, ymin: Infinity, xmax: -Infinity, ymax: -Infinity };
    mp.forEach(function (poly) { poly[0].forEach(function (p) {
      if (p[0] < b.xmin) b.xmin = p[0]; if (p[0] > b.xmax) b.xmax = p[0];
      if (p[1] < b.ymin) b.ymin = p[1]; if (p[1] > b.ymax) b.ymax = p[1];
    }); });
    return b;
  }
  function flaecheMP(mp) {
    var a = 0;
    mp.forEach(function (poly) { poly.forEach(function (ring, i) { a += (i ? -1 : 1) * Math.abs(M2M.geo.flaeche(ring)); }); });
    return a;
  }
  function inMP(pt, mp) {
    return mp.some(function (poly) {
      if (!M2M.geo.punktInRing(pt, poly[0])) return false;
      for (var i = 1; i < poly.length; i++) if (M2M.geo.punktInRing(pt, poly[i])) return false;
      return true;
    });
  }
  function rechteckInMP(x, y, w, h, mp) {
    var pts = [[x, y], [x + w, y], [x, y + h], [x + w, y + h], [x + w / 2, y + h / 2], [x + w / 2, y], [x + w / 2, y + h], [x, y + h / 2], [x + w, y + h / 2]];
    if (!pts.every(function (p) { return inMP(p, mp); })) return false;
    // keine Kante der Fläche darf durch das Textfeld laufen
    var box = rechteck(x, y, w, h);
    return Math.abs(flaecheMP(schneide(box, mp)) - w * h) < w * h * 0.002;
  }

  // freien Platz für ein Textfeld (w × h) in der Fläche suchen, möglichst nahe am Ziel
  function textPlatz(mp, w, h, ziel) {
    if (!mp.length) return null;
    var b = rahmenVon(mp);
    if (b.xmax - b.xmin < w + 0.6 || b.ymax - b.ymin < h + 0.6) return null;
    var schritt = Math.max(h / 2, Math.sqrt(((b.xmax - b.xmin) * (b.ymax - b.ymin)) / 2500));
    var kand = [];
    for (var x = b.xmin + 0.3; x <= b.xmax - w - 0.3; x += schritt) {
      for (var y = b.ymin + 0.3; y <= b.ymax - h - 0.3; y += schritt) {
        var cx = x + w / 2 - ziel[0], cy = y + h / 2 - ziel[1];
        kand.push([x, y, cx * cx + cy * cy]);
      }
    }
    kand.sort(function (a, c) { return a[2] - c[2]; });
    for (var i = 0; i < kand.length && i < 600; i++) {
      if (rechteckInMP(kand[i][0], kand[i][1], w, h, mp)) return [kand[i][0], kand[i][1]];
    }
    return null;
  }

  function schwerpunktMP(mp) {
    var groesste = null, ga = -1;
    mp.forEach(function (poly) { var a = Math.abs(M2M.geo.flaeche(poly[0])); if (a > ga) { ga = a; groesste = poly[0]; } });
    return groesste ? M2M.geo.schwerpunkt(groesste) : [0, 0];
  }

  // ---------- Teil so drehen, dass es möglichst wenig Platz braucht ----------
  function huelle(punkte) {
    var p = punkte.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    function kreuz(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var unten = [], oben = [];
    p.forEach(function (q) { while (unten.length >= 2 && kreuz(unten[unten.length - 2], unten[unten.length - 1], q) <= 0) unten.pop(); unten.push(q); });
    p.slice().reverse().forEach(function (q) { while (oben.length >= 2 && kreuz(oben[oben.length - 2], oben[oben.length - 1], q) <= 0) oben.pop(); oben.push(q); });
    oben.pop(); unten.pop();
    return unten.concat(oben);
  }

  function ausrichten(mp) {
    var pts = [];
    mp.forEach(function (poly) { poly[0].forEach(function (p) { pts.push(p); }); });
    var h = huelle(pts), besterWinkel = 0, besteFl = Infinity;
    for (var i = 0; i < h.length; i++) {
      var a = h[i], b = h[(i + 1) % h.length];
      var w = -Math.atan2(b[1] - a[1], b[0] - a[0]);
      var c = Math.cos(w), s = Math.sin(w), xs = [], ys = [];
      h.forEach(function (p) { xs.push(p[0] * c - p[1] * s); ys.push(p[0] * s + p[1] * c); });
      var fl = (Math.max.apply(null, xs) - Math.min.apply(null, xs)) * (Math.max.apply(null, ys) - Math.min.apply(null, ys));
      if (fl < besteFl - 1e-6) { besteFl = fl; besterWinkel = w; }
    }
    var c2 = Math.cos(besterWinkel), s2 = Math.sin(besterWinkel);
    var gedreht = abbilden(mp, function (p) { return [p[0] * c2 - p[1] * s2, p[0] * s2 + p[1] * c2]; });
    var b2 = rahmenVon(gedreht);
    if (b2.ymax - b2.ymin > b2.xmax - b2.xmin) { // liegend ist besser für die Reihen
      gedreht = abbilden(gedreht, function (p) { return [-p[1], p[0]]; });
      b2 = rahmenVon(gedreht);
    }
    return abbilden(gedreht, function (p) { return [p[0] - b2.xmin, p[1] - b2.ymin]; });
  }

  // ---------- Kreis als Linie ----------
  function kreis(cx, cy, r) {
    var pts = [], n = Math.max(12, Math.min(48, Math.round(r * 6)));
    for (var i = 0; i < n; i++) { var a = 2 * Math.PI * i / n; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return pts;
  }

  function buchstaben(i) { var s = ""; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

  // ===================================================================
  M2M.erzeugeLaser = function (imp, cfg, fortschritt) {
    var f = 1000 / cfg.massstab;          // mm pro Meter
    var t = cfg.staerke;                  // Materialstärke mm
    var tM = t / f;                       // Materialstärke in Metern (Wirklichkeit)
    var R = imp.rahmen;
    var MW = (R.xmax - R.xmin) * f, MH = (R.ymax - R.ymin) * f;
    var hinweise = [];
    var zuMM = function (p) { return [(p[0] - R.xmin) * f, (p[1] - R.ymin) * f]; };
    var mm = function (mp) { return abbilden(mp, zuMM); };
    var modellRahmen = rechteck(0, 0, MW, MH);
    var grundriss = function (e, bis) { return schneide(mm(M2M.schnitt(e, e.zmin + 0.02, bis)), modellRahmen); };

    fortschritt && fortschritt("Ordne Bauteile …");
    var nach = {};
    imp.elemente.forEach(function (e) { (nach[e.kategorie] = nach[e.kategorie] || []).push(e); });
    function liste(k) { return nach[k] || []; }

    var wasser = vereint(liste("Wasser").map(function (e) { return grundriss(e); }));
    var strasse = ohne(vereint(liste("Straße").map(function (e) { return grundriss(e); })), wasser);
    var bahn = vereint(liste("Bahn").map(function (e) { return grundriss(e); }));

    // Ebenen der Grundplatte
    var sT = Math.max(1, Math.abs(cfg.hStrasse || 1));
    var wT = Math.max(sT + 1, Math.abs(cfg.hWasser || 2));
    if (!strasse.length) sT = 0;
    var ebenen = wasser.length ? wT : sT;  // Anzahl Platten unter der obersten

    // ---------- Nummern ----------
    var gebaeude = liste("Gebäude").slice().sort(function (a, b) { return (a.neubau - b.neubau) || ((a.nummer || 1e9) - (b.nummer || 1e9)); });
    var vergeben = {};
    var naechste = { b: 1, n: 1 };
    gebaeude.forEach(function (e) {
      var art = e.neubau ? "n" : "b";
      var nr = e.nummer && !vergeben[art + e.nummer] ? e.nummer : null;
      while (!nr) { if (!vergeben[art + naechste[art]]) nr = naechste[art]; naechste[art]++; }
      vergeben[art + nr] = true;
      e.kurz = (e.neubau ? "N" : "") + nr;
    });
    liste("Grün").forEach(function (e, i) { e.kurz = (e.neubau ? "NG" : "G") + (i + 1); });
    liste("Brücke").forEach(function (e, i) { e.kurz = (e.neubau ? "NB" : "B") + (i + 1); });

    // Gravur: der eigene Name aus Revit (z. B. „NEUBAU GEBÄUDE 1“), wenn er auf das Teil passt –
    // sonst für DIESES Bauteil überall dieselbe Kurzform (z. B. „N1“). Die Übersicht erklärt beide.
    function waehleGravur(e, flaeche) {
      var lang = M2M.gross(e.anzeige || e.kurz);
      e.lang = e.anzeige || e.kurz;
      e.label = e.kurz;
      if (!flaeche.length || lang === e.kurz) return;
      var b = rahmenVon(ausrichten(flaeche));
      if (M2M.textBreite(lang + "-99", MIN_SCHRIFT) <= b.xmax * 0.85 && b.ymax >= MIN_SCHRIFT * 1.6) e.label = lang;
    }

    // ---------- Teile für Gebäude, Grün, Brücken ----------
    fortschritt && fortschritt("Schneide Gebäude in Schichten …");
    var teile = [];        // { gruppe, mp, label }
    var markierungen = []; // Umrisse + Nummern auf der obersten Grundplatte
    var zuKlein = 0, ohneNummer = 0;

    gebaeude.forEach(function (e) {
      var fuss = grundriss(e);
      if (!fuss.length) return;
      waehleGravur(e, fuss);
      e.schichten = [];
      markierungen.push({ mp: fuss, label: e.label, element: e });
      var gruppe = e.neubau ? "Neubau" : "Gebäude";
      var hoeheMM = (e.zmax - e.zmin) * f;

      if (cfg.bauweise === "volumen") {
        // Wände entlang des Umrisses + Dachplatte
        var groesste = fuss.slice().sort(function (a, b) { return Math.abs(M2M.geo.flaeche(b[0])) - Math.abs(M2M.geo.flaeche(a[0])); })[0][0];
        var ring = M2M.geo.saeubereRing(groesste, true) || groesste;
        var wandH = Math.max(t, hoeheMM - t);
        ring.forEach(function (p, i) {
          var q = ring[(i + 1) % ring.length];
          var L = Math.hypot(q[0] - p[0], q[1] - p[1]) - t; // Ecke: jede Wand endet eine Materialstärke früher
          if (L < 1) return;
          var wb = buchstaben(i);
          teile.push({ gruppe: gruppe, mp: rechteck(0, 0, L, wandH), label: e.label, zusatz: "WAND " + wb, wand: true, element: e, schicht: "Wand " + wb });
        });
        teile.push({ gruppe: gruppe, mp: [[groesste]], label: e.label, zusatz: "DACH", element: e, schicht: "Dach" });
        return;
      }

      var n = Math.max(1, Math.round(hoeheMM / t));
      var letzte = null, letzteFl = -1;
      for (var k = 0; k < n; k++) {
        var z = e.zmin + (k + 0.5) * tM;
        if (z > e.zmax) z = e.zmax - 0.01;
        var schicht = schneide(mm(M2M.schnitt(e, z)), modellRahmen);
        var fl = flaecheMP(schicht);
        if (fl < 1) { zuKlein++; continue; }
        // gleiche Schicht wie davor → wiederverwenden (spart Rechenzeit)
        if (letzte && Math.abs(fl - letzteFl) < 0.01) schicht = letzte;
        letzte = schicht; letzteFl = fl;
        teile.push({ gruppe: gruppe, mp: schicht, label: e.label, zusatz: "SCHICHT " + (k + 1), element: e, schicht: k + 1 });
      }
    });

    liste("Grün").forEach(function (e) {
      var fuss = ohne(grundriss(e), vereint([strasse, wasser]));
      if (flaecheMP(fuss) < 4) return;
      waehleGravur(e, fuss);
      e.schichten = [];
      markierungen.push({ mp: fuss, label: e.label, element: e });
      var anzahl = Math.max(1, cfg.hGruen || 1);
      fuss.forEach(function (poly, j) {
        for (var k = 0; k < anzahl; k++) {
          var zusatz = (fuss.length > 1 ? String.fromCharCode(97 + (j % 26)) : "") + (anzahl > 1 ? "-" + (k + 1) : "");
          teile.push({ gruppe: e.neubau ? "Neubau" : "Grün", mp: [poly], label: e.label, zusatz: zusatz ? "TEIL " + zusatz.toUpperCase() : "", element: e, schicht: zusatz || "1" });
        }
      });
    });

    liste("Brücke").forEach(function (e) {
      var deck = grundriss(e, e.zmin + 1.5);
      if (!deck.length) deck = grundriss(e);
      if (!deck.length) return;
      waehleGravur(e, deck);
      e.schichten = [];
      markierungen.push({ mp: deck, label: e.label, nurUmriss: true, element: e });
      teile.push({ gruppe: e.neubau ? "Neubau" : "Gebäude", mp: deck, label: e.label, zusatz: "", element: e, schicht: "Fahrbahn" });
    });

    var baeume = liste("Baum").map(function (e) {
      var xs = [], ys = [];
      e.dreiecke.forEach(function (d) { d.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); });
      var c = zuMM([(Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2]);
      return { c: c, r: Math.max(0.8, (Math.max.apply(null, xs) - Math.min.apply(null, xs)) / 2 * f) };
    });

    // ---------- Grundplatte in Teile (A, B, …) aufteilen ----------
    fortschritt && fortschritt("Baue die Grundplatte …");
    var nutzB = cfg.plattenB - 2 * RAND, nutzH = cfg.plattenH - 2 * RAND;
    var nx = Math.ceil(MW / nutzB - 1e-9), ny = Math.ceil(MH / nutzH - 1e-9);
    var kachelB = MW / nx, kachelH = MH / ny;
    var blaetter = [];

    var flaecheEbene = [];
    for (var k = 0; k <= ebenen; k++) {
      var weg = [];
      if (k < sT) weg.push(strasse);
      if (k < (wasser.length ? wT : 0)) weg.push(wasser);
      flaecheEbene.push(ohne(modellRahmen, vereint(weg)));
    }

    // Ebenen mit gleicher Form werden EINE Datei mit Anzahl („3× schneiden“)
    var ebenenArten = [{ k: 0, art: "Bodenplatte", kurz: "OBEN", anzahl: 1, rang: 0 }];
    if (sT > 1) ebenenArten.push({ k: 1, art: "Bodenplatte darunter", kurz: "OBEN2", anzahl: sT - 1, rang: 1 });
    if (wasser.length && wT > sT) {
      if (wT - sT > 0 && sT > 0) ebenenArten.push({ k: sT, art: "Zwischenebene (Straßenboden)", kurz: "MITTE", anzahl: wT - sT, rang: 2 });
      ebenenArten.push({ k: ebenen, art: "Wasser (unten)", kurz: "WASSER", anzahl: 1, rang: 3 });
    } else if (ebenen > 0) {
      ebenenArten.push({ k: ebenen, art: "Straßenboden (unten)", kurz: "UNTEN", anzahl: 1, rang: 3 });
    }
    // Ohne Straßen: Ebenen über dem Wasser sind alle gleich
    if (wasser.length && sT === 0 && wT > 1) ebenenArten.splice(1, 0, { k: 1, art: "Zwischenebene", kurz: "MITTE", anzahl: wT - 1, rang: 2 });

    // ---------- Straßennamen: auf den Straßenboden gravieren ----------
    // Man sieht ihn durch die ausgeschnittene Straße in der obersten Platte.
    var namenText = [], namenEbene = sT;
    if (strasse.length && cfg.strassen && cfg.strassen.linien) {
      var S = cfg.strassen;
      if (Math.abs(S.b - (R.xmax - R.xmin)) > 3 || Math.abs(S.h - (R.ymax - R.ymin)) > 3) {
        hinweise.push("Straßennamen fehlen: Die IFC-Datei gehört zu einem anderen Gebiet als das zuletzt in Schritt 1 geladene. Gebiet in Schritt 1 neu laden, dann klappt es.");
      } else if (S.linien.length) {
        fortschritt && fortschritt("Graviere Straßennamen …");
        namenText = setzeStrassenNamen(S.linien.map(function (l) {
          return { name: l.name, pts: l.pts.map(function (p) { return [p[0] * f, p[1] * f]; }) };
        }), strasse, kachelB, kachelH, nx, ny, cfg.massstab);
        var anzahlNamen = {};
        namenText.forEach(function (t) { anzahlNamen[t.name] = true; });
        var alleNamen = {};
        S.linien.forEach(function (l) { alleNamen[l.name] = true; });
        var fehlen = Object.keys(alleNamen).length - Object.keys(anzahlNamen).length;
        if (namenText.length) hinweise.push(Object.keys(anzahlNamen).length + " Straßennamen sind auf den Straßenboden graviert (schwarz)." + (fehlen > 0 ? " " + fehlen + " Straße(n) sind zu schmal oder zu kurz für den Namen." : ""));
        else hinweise.push("Die Straßen sind in diesem Maßstab zu schmal für lesbare Straßennamen.");
      }
    } else if (strasse.length) {
      hinweise.push("Straßennamen fehlen: Sie kommen aus Schritt 1 – das Gebiet dort einmal laden (IFC herunterladen), dann werden sie mit graviert.");
    }

    for (var j = ny - 1, idx = 0; j >= 0; j--) {
      for (var i = 0; i < nx; i++, idx++) {
        var buchst = buchstaben(idx);
        var kx = i * kachelB, ky = j * kachelH;
        var kachel = rechteck(kx, ky, kachelB, kachelH);
        var nachbarn = [];
        if (i > 0) nachbarn.push(["links", buchstaben(idx - 1)]);
        if (i < nx - 1) nachbarn.push(["rechts", buchstaben(idx + 1)]);
        if (j < ny - 1) nachbarn.push(["oben", buchstaben(idx - nx)]);
        if (j > 0) nachbarn.push(["unten", buchstaben(idx + nx)]);

        for (var ea = 0; ea < ebenenArten.length; ea++) {
          var ebArt = ebenenArten[ea], e2 = ebArt.k;
          var flaeche = schneide(flaecheEbene[e2], kachel);
          if (!flaeche.length) continue;
          var lokal = abbilden(flaeche, function (p) { return [p[0] - kx, p[1] - ky]; });
          var blatt = neuesBlatt(ebArt.art + (nx * ny > 1 ? " · Teil " + buchst : ""), "Grundplatte");
          blatt.anzahl = ebArt.anzahl;
          blatt.teil = buchst;
          blatt.ebeneKurz = ebArt.kurz;
          blatt.rang = 10 + ebArt.rang * 100 + idx;
          var ox = PLATTE_X + RAND, oy = PLATTE_Y + RAND;
          var aufBlatt = function (p) { return [p[0] + ox, p[1] + oy]; };
          umriss(blatt, abbilden(lokal, aufBlatt), "rot");

          if (e2 === namenEbene) {
            namenText.forEach(function (tn) {
              if (tn.i !== i || tn.j !== j) return;
              tn.linien.forEach(function (pts) {
                blatt.linien.push({ farbe: "schwarz", pts: pts.map(function (p) { return [p[0] - kx + ox, p[1] - ky + oy]; }), zu: false });
              });
            });
          }

          if (e2 === 0) {
            // Markierungen der Bauteile: Umriss blau anritzen, Nummer schwarz gravieren
            var belegt = null; // alle Umrisse dieser Kachel (für Nummern NEBEN dem Umriss)
            markierungen.forEach(function (m) {
              var teil = schneide(schneide(m.mp, kachel), flaeche);
              if (!teil.length) return;
              var l = abbilden(teil, function (p) { return [p[0] - kx, p[1] - ky]; });
              umriss(blatt, abbilden(l, aufBlatt), "blau");
              if (m.nurUmriss || cfg.beschriften === false) return; // „Ohne Beschriftung“: nur der Umriss
              // Nummer im Umriss: normal → Kurzform → gedreht → kleiner; sonst direkt daneben
              var kurz = m.element.kurz || m.label, sp = schwerpunktMP(l);
              var h0 = Math.min(2.5, Math.max(MIN_SCHRIFT, Math.sqrt(flaecheMP(l)) * 0.2));
              var proben = [[m.label, h0], [kurz, MIN_SCHRIFT], [kurz, KLEIN_SCHRIFT]];
              for (var pi = 0; pi < proben.length * 2; pi++) {
                var pr = proben[pi >> 1], dreh = pi % 2 === 1, tw = M2M.textBreite(pr[0], pr[1]);
                var o = dreh ? textPlatz(l, pr[1], tw, sp) : textPlatz(l, tw, pr[1], sp);
                if (o) { feinGedreht(blatt, pr[0], o[0] + ox, o[1] + oy, pr[1], dreh); return; }
              }
              if (!belegt) belegt = vereint(markierungen.map(function (mm) {
                return abbilden(schneide(mm.mp, kachel), function (p) { return [p[0] - kx, p[1] - ky]; });
              }));
              var tw2 = M2M.textBreite(kurz, MIN_SCHRIFT);
              var o2 = textPlatz(ohne(lokal, belegt), tw2, MIN_SCHRIFT, sp);
              if (o2 && Math.hypot(o2[0] + tw2 / 2 - sp[0], o2[1] - sp[1]) < 25) feinGedreht(blatt, kurz, o2[0] + ox, o2[1] + oy, MIN_SCHRIFT, false);
              else ohneNummer++;
            });
            // Bäume werden NICHT gelasert (Wunsch des Teams).
            // Gleise als Gravurlinien
            var gleise = schneide(schneide(bahn, kachel), flaeche);
            umriss(blatt, abbilden(abbilden(gleise, function (p) { return [p[0] - kx, p[1] - ky]; }), aufBlatt), "schwarz");
            // Die Beschriftung kommt auf ein eigenes kleines Schild (siehe unten), nicht auf die Grundplatte.
          }
          // Kennzeichnung der Platte (Teil + Ebene), unten links
          var kenn = (nx * ny > 1 ? buchst + " " : "") + ebArt.kurz;
          var kh = 2.5, kw = M2M.textBreite(kenn, kh);
          var kort = textPlatz(lokal, kw, kh, [kw / 2 + 4, kh / 2 + 4]);
          if (kort) fein(blatt, kenn, kort[0] + ox, kort[1] + oy, kh);
          // Nachbarn an den Fugen: „→ B“
          if (nx * ny > 1 && e2 === 0) nachbarn.forEach(function (nb) {
            var nt = "> " + nb[1], nh = 2, nw = M2M.textBreite(nt, nh);
            var ziel = { links: [nw / 2 + 3, kachelH / 2], rechts: [kachelB - nw / 2 - 3, kachelH / 2], oben: [kachelB / 2, kachelH - nh / 2 - 3], unten: [kachelB / 2, nh / 2 + 3] }[nb[0]];
            var nort = textPlatz(lokal, nw, nh, ziel);
            if (nort) fein(blatt, nt, nort[0] + ox, nort[1] + oy, nh);
          });
          blaetter.push(blatt);
        }
      }
    }

    // ---------- Teile ausrichten, beschriften, auf Platten verteilen ----------
    fortschritt && fortschritt("Verteile Teile auf die Platten …");
    var zuGross = 0, aussenBeschriftet = 0;
    var vorbereitet = [];
    teile.forEach(function (tl) {
      var mp = tl.wand ? tl.mp : ausrichten(tl.mp);
      var b = rahmenVon(mp);
      var w = b.xmax, h = b.ymax;
      if (w < 1 || h < 1 || flaecheMP(mp) < 1) { zuKlein++; return; }
      if (w > nutzB || h > nutzH) {
        if (h <= nutzB && w <= nutzH) { mp = abbilden(mp, function (p) { return [h - p[1], p[0]]; }); var tmp = w; w = h; h = tmp; }
        else { zuGross++; return; }
      }
      // Teil spiegeln: Der Laser graviert die OBERSEITE. Gespiegelt geschnitten und dann
      // umgedreht verbaut, liegt die Gravur auf der Unterseite (Schichten, Dach) bzw.
      // Innenseite (Wände) – am fertigen Modell sieht man sie nicht.
      var breite = w;
      mp = abbilden(mp, function (p) { return [breite - p[0], p[1]]; });
      // Gravur: oben GENAU der Text wie auf der Bodenplatte, darunter klein die Schicht.
      // Passt das nicht, eine Zeile „NAME-3“; passt auch das nicht, nur der Name.
      // Reihenfolge, bis es passt:
      //  1. Name + Schicht   2. Kurzform „N1-3“   3. dasselbe GEDREHT (für schmale, hohe Teile wie Wände)
      //  4. kleinere Schrift  5. passt nichts → Beschriftung direkt UNTER das Teil auf die Pappe
      var kurz = (tl.element && tl.element.kurz) || tl.label;
      var kurzZus = tl.zusatz ? tl.zusatz.replace(/^SCHICHT /, "").replace(/^WAND /, "").replace(/^TEIL /, "") : "";
      var kurzText = kurz + (kurzZus && kurzZus !== "DACH" ? "-" + kurzZus : kurzZus === "DACH" ? "-D" : "");
      var normal = [];
      [Math.min(2.2, Math.max(MIN_SCHRIFT, Math.min(w, h) * 0.2)), MIN_SCHRIFT].forEach(function (gr) {
        if (tl.zusatz) normal.push([[tl.label, gr], [tl.zusatz, MIN_SCHRIFT]]);
        else normal.push([[tl.label, gr]]);
      });
      if (tl.zusatz) normal.push([[tl.label + "-" + kurzZus, MIN_SCHRIFT]]);
      normal.push([[kurzText, MIN_SCHRIFT]]);
      var klein = [[[kurzText, KLEIN_SCHRIFT]], [[kurz, KLEIN_SCHRIFT]]];
      var versuche = [];
      normal.forEach(function (z) { versuche.push({ zeilen: z, dreh: false }); });
      normal.forEach(function (z) { versuche.push({ zeilen: z, dreh: true }); });
      klein.forEach(function (z) { versuche.push({ zeilen: z, dreh: false }); versuche.push({ zeilen: z, dreh: true }); });
      var gravur = null;
      var beschriften = cfg.beschriften !== false; // Auswahl „Mit / Ohne Beschriftung“
      for (var vi = 0; beschriften && vi < versuche.length && !gravur; vi++) {
        var z = versuche[vi].zeilen, abst = 0.6;
        var bw = Math.max.apply(null, z.map(function (q) { return M2M.textBreite(q[0], q[1]); }));
        var bh = z.reduce(function (s, q) { return s + q[1]; }, 0) + abst * (z.length - 1);
        // gedreht: das Textfeld steht hochkant (bh breit, bw hoch)
        var ort = versuche[vi].dreh ? textPlatz(mp, bh, bw, [w / 2, h / 2]) : textPlatz(mp, bw, bh, [w / 2, h / 2]);
        if (ort) gravur = { ort: ort, zeilen: z, bw: bw, bh: bh, abst: abst, dreh: versuche[vi].dreh };
      }
      if (!gravur && beschriften) {
        // 5. außen: unter dem Teil (Teil rückt nach oben, die Pappe darunter trägt die Nummer)
        var ah = MIN_SCHRIFT, aw = M2M.textBreite(kurzText, ah), luft = 0.8;
        mp = abbilden(mp, function (p) { return [p[0], p[1] + ah + luft]; });
        var neuW = Math.max(w, aw);
        gravur = { ort: [(neuW - aw) / 2, 0], zeilen: [[kurzText, ah]], bw: aw, bh: ah, abst: 0, dreh: false, aussen: true };
        h += ah + luft; w = neuW;
        aussenBeschriftet++;
      }
      vorbereitet.push({ gruppe: tl.gruppe, mp: mp, w: w, h: h, label: tl.label, gravur: gravur, element: tl.element, schicht: tl.schicht });
    });

    // ---------- Schild: Beschriftung + Nordpfeil auf einem eigenen kleinen Pappstück ----------
    // Wird ausgeschnitten und von euch aufs Modell geklebt. NICHT gespiegelt – die Schrift ist oben sichtbar.
    // Norden = oben auf der Platte (die IFC aus Map2Model ist genordet). Schild parallel zur Plattenkante
    // aufkleben, dann zeigt der Pfeil nach Norden.
    var schildElement = { label: "SCHILD", lang: "Schild", schichten: [] };
    (function () {
      var zeilen = String(cfg.beschriftung || "").split(/\r?\n/).map(function (z) { return z.trim().replace(/\s+/g, " "); }).filter(Boolean);
      var mst = "M 1:" + cfg.massstab;
      if (!zeilen.some(function (z) { return z.replace(/\s/g, "").indexOf("1:" + cfg.massstab) >= 0; })) zeilen.push(mst);
      // Größe passt sich dem Modell an: großes Modell (z. B. 1:200) → großes Schild, kleines (1:1000) → kleines.
      // G = Höhe der ersten Zeile in mm, alles andere wächst mit.
      var G = Math.max(3.6, Math.min(9, Math.sqrt(MW * MH) * 0.011));
      var tw, hoehen, ZA, PAD, PW, PH, LUECKE;
      for (var versuch = 0; versuch < 8; versuch++) {
        hoehen = zeilen.map(function (z, i) { return i === 0 && zeilen.length > 1 ? G : G * 0.72; });
        ZA = G * 0.45; PAD = G * 0.85; PW = G * 2.1; PH = G * 3.5; LUECKE = G * 1.2;
        tw = Math.max.apply(null, zeilen.map(function (z, i) { return M2M.textBreite(z, hoehen[i]); }));
        if (PAD * 2 + tw + LUECKE + PW <= nutzB * 0.6 || G <= 3.6) break;
        G = Math.max(3.6, G * 0.85);
      }
      var th = hoehen.reduce(function (s, h) { return s + h; }, 0) + ZA * (zeilen.length - 1);
      var innenH = Math.max(th, PH);
      var W = PAD + tw + LUECKE + PW + PAD, H = PAD + innenH + PAD;
      if (W > nutzB) { hinweise.push("Die Beschriftung ist zu lang für das Schild – bitte kürzer oder mit Zeilenumbrüchen schreiben."); return; }
      var striche = [];
      // Text: linksbündig, senkrecht mittig
      var y = PAD + (innenH + th) / 2;
      zeilen.forEach(function (z, i) {
        y -= hoehen[i];
        M2M.textLinien(z, PAD, y - hoehen[i] * 0.05, hoehen[i]).forEach(function (pts) { striche.push({ pts: pts, zu: false }); });
        y -= ZA;
      });
      // Nordpfeil rechts daneben: „N“ oben, darunter der Pfeil (Spitze nach oben = Norden)
      var ax = W - PAD - PW / 2, yUnten = PAD + (innenH - PH) / 2, nh = G * 0.72;
      M2M.textLinien("N", ax - M2M.textBreite("N", nh) / 2, yUnten + PH - nh, nh).forEach(function (pts) { striche.push({ pts: pts, zu: false }); });
      var spitze = yUnten + PH - nh - 1.4, fuss = yUnten;
      var kerbe = fuss + (spitze - fuss) * 0.28;
      striche.push({ pts: [[ax, spitze], [ax + PW * 0.42, fuss], [ax, kerbe], [ax - PW * 0.42, fuss]], zu: true });
      striche.push({ pts: [[ax, spitze], [ax, kerbe]], zu: false });
      [0.25, 0.5, 0.75].forEach(function (f) { // eine Pfeilhälfte schraffiert, wie beim klassischen Nordpfeil
        var yy = fuss + (spitze - fuss) * f * 0.85 + (kerbe - fuss) * (1 - f) * 0.3;
        var t = (yy - fuss) / (spitze - fuss);
        striche.push({ pts: [[ax, Math.max(yy, kerbe + (spitze - kerbe) * f * 0.6)], [ax + PW * 0.42 * (1 - t), yy]], zu: false });
      });
      var ziel = ["Gebäude", "Neubau", "Grün"].filter(function (g) { return vorbereitet.some(function (v) { return v.gruppe === g; }); })[0] || "Gebäude";
      vorbereitet.push({ gruppe: ziel, mp: rechteck(0, 0, W, H), w: W, h: H, label: "SCHILD", gravur: null, schild: striche, element: schildElement, schicht: "Schild" });
    })();

    ["Gebäude", "Neubau", "Grün"].forEach(function (gruppe) {
      // Teile eines Gebäudes bleiben zusammen und in Schicht-Reihenfolge auf EINER Platte
      // (wenn es irgendwie passt) – so findet man beim Bauen alles an einem Ort.
      var stuecke = vorbereitet.filter(function (v) { return v.gruppe === gruppe; });
      if (!stuecke.length) return;
      var platten = []; // { blatt, reihen: [{ y, h, x }] , yFrei }

      function setze(pl, s) { // Teil in die Platte setzen (erste passende Reihe), sonst null
        for (var r = 0; r < pl.reihen.length; r++) {
          var reihe = pl.reihen[r];
          if (s.h <= reihe.h && reihe.x + s.w <= nutzB) { var z = { pl: pl, x: reihe.x, y: reihe.y }; reihe.x += s.w + ABSTAND; return z; }
        }
        if (pl.yFrei + s.h <= nutzH) {
          pl.reihen.push({ y: pl.yFrei, h: s.h, x: s.w + ABSTAND });
          var z2 = { pl: pl, x: 0, y: pl.yFrei };
          pl.yFrei += s.h + ABSTAND;
          return z2;
        }
        return null;
      }
      function passtGanz(pl, gruppeTeile) { // Probe auf einer Kopie
        var probe = { reihen: pl.reihen.map(function (r) { return { y: r.y, h: r.h, x: r.x }; }), yFrei: pl.yFrei };
        return gruppeTeile.every(function (s) { return !!setze(probe, s); });
      }

      // nach Bauteil gruppieren (Reihenfolge wie in der Liste), innen nach Schicht
      var gruppen = [], nachElement = new Map();
      stuecke.forEach(function (s) {
        var key = s.element || s;
        if (!nachElement.has(key)) { nachElement.set(key, []); gruppen.push(nachElement.get(key)); }
        nachElement.get(key).push(s);
      });
      gruppen.forEach(function (g) {
        g.sort(function (a, b) { return (typeof a.schicht === "number" ? a.schicht : 999) - (typeof b.schicht === "number" ? b.schicht : 999); });
        var aktuell = platten[platten.length - 1];
        // passt das ganze Bauteil nicht mehr auf die aktuelle Platte → neue Platte anfangen
        if (aktuell && !passtGanz(aktuell, g) && passtGanz({ reihen: [], yFrei: 0 }, g)) platten.push(null);
        g.forEach(platziere);
      });

      function platziere(s) {
        var ziel = null;
        var pl = platten[platten.length - 1];
        if (pl) ziel = setze(pl, s);
        if (!ziel) {
          if (platten[platten.length - 1] === null) platten.pop();
          var nb = neuesBlatt(gruppe, gruppe);
          nb.rang = { "Gebäude": 0, "Neubau": 1, "Grün": 2 }[gruppe] * 0.001 + platten.length * 0.00001;
          var neu = { blatt: nb, reihen: [{ y: 0, h: s.h, x: s.w + ABSTAND }], yFrei: s.h + ABSTAND };
          platten.push(neu);
          ziel = { pl: neu, x: 0, y: 0 };
        }
        var ox = PLATTE_X + RAND + ziel.x, oy = PLATTE_Y + RAND + ziel.y;
        umriss(ziel.pl.blatt, abbilden(s.mp, function (p) { return [p[0] + ox, p[1] + oy]; }), "rot");
        if (s.schild) s.schild.forEach(function (st) {
          ziel.pl.blatt.linien.push({ farbe: "schwarz", pts: st.pts.map(function (p) { return [p[0] + ox, p[1] + oy]; }), zu: st.zu });
        });
        if (s.gravur) {
          // Zeilen von oben nach unten, jeweils mittig im Textfeld. Nur die FORM des Teils ist
          // gespiegelt – die Schrift nicht: nach dem Umdrehen liest man sie von unten richtig herum.
          // Gedreht: um 90° gegen den Uhrzeigersinn (von unten nach oben lesbar) im hochkanten Textfeld.
          var g = s.gravur, vOben = g.bh;
          var trafo = g.dreh
            ? function (p) { return [ox + g.ort[0] + (g.bh - p[1]), oy + g.ort[1] + p[0]]; }   // (u, v) → hochkant
            : function (p) { return [ox + g.ort[0] + p[0], oy + g.ort[1] + p[1]]; };
          g.zeilen.forEach(function (q) {
            vOben -= q[1];
            var uz = (g.bw - M2M.textBreite(q[0], q[1])) / 2;
            M2M.textLinien(q[0], uz, vOben, q[1]).forEach(function (pts) {
              ziel.pl.blatt.linien.push({ farbe: "blau", pts: pts.map(trafo), zu: false });
            });
            vOben -= g.abst;
          });
        }
        // merken, was auf welcher Platte liegt (für die Übersicht)
        if (s.element) {
          ziel.pl.blatt.inhalt.push({ element: s.element, schicht: s.schicht });
          s.element.schichten.push({ schicht: s.schicht, blatt: ziel.pl.blatt });
        }
      }
      platten.forEach(function (pl) { if (pl) blaetter.push(pl.blatt); });
    });

    // ---------- Reihenfolge und Nummern: Platte 01 · Gebäude, Platte 02 · Bodenplatte, … ----------
    blaetter.sort(function (a, b) { return (a.rang || 0) - (b.rang || 0); });
    var jeGruppe = {};
    blaetter.forEach(function (b) { if (b.gruppe !== "Grundplatte") jeGruppe[b.gruppe] = (jeGruppe[b.gruppe] || 0) + 1; });
    var laufend = {};
    blaetter.forEach(function (b, i) {
      b.nummer = i + 1;
      b.anzahl = b.anzahl || 1;
      var titel = b.name;
      if (jeGruppe[b.gruppe] > 1) { laufend[b.gruppe] = (laufend[b.gruppe] || 0) + 1; titel += " " + laufend[b.gruppe] + "/" + jeGruppe[b.gruppe]; }
      b.name = "Platte " + String(b.nummer).padStart(2, "0") + " · " + titel + (b.anzahl > 1 ? " (" + b.anzahl + "× schneiden)" : "");
    });
    var finnpappen = blaetter.reduce(function (s, b) { return s + b.anzahl; }, 0);

    // ---------- Platte 00: Aufteilungsplan (wo liegt Teil A, B, … im Modell?) ----------
    blaetter.unshift(aufteilungsplan());
    function aufteilungsplan() {
      // nur zur Übersicht – wird NICHT gelasert und NICHT als Platte gezählt
      var bl = neuesBlatt("Übersicht · Aufteilungsplan (nicht lasern)", "Übersicht");
      bl.nummer = 0; bl.anzahl = 0;
      var px0 = PLATTE_X + RAND, py0 = PLATTE_Y + RAND, pw = cfg.plattenB - 2 * RAND, ph = cfg.plattenH - 2 * RAND;
      // Titel oben
      var titel = "AUFTEILUNG DER GRUNDPLATTE · M 1:" + cfg.massstab;
      var th0 = Math.max(MIN_SCHRIFT, Math.min(10, (pw - 30) / (M2M.textBreite(titel, 1) || 1)));
      text(bl, titel, px0 + 15, py0 + ph - th0 - 10, th0);
      // Modell auf die Platte verkleinern (unter dem Titel)
      var s = Math.min((pw - 40) / MW, (ph - th0 - 45) / MH);
      var x0 = px0 + (pw - MW * s) / 2, y0 = py0 + 15;
      var klein = function (mp) { return abbilden(mp, function (p) { return [x0 + p[0] * s, y0 + p[1] * s]; }); };
      // Umriss, Wasser, Gebäude
      umriss(bl, klein(modellRahmen), "schwarz");
      if (wasser.length) umriss(bl, klein(wasser), "schwarz");
      markierungen.forEach(function (m) { if (m.element.kategorie === "Gebäude") umriss(bl, klein(m.mp), "blau"); });
      // jedes Bauteil mit seiner Gravur beschriften, damit man sieht, wo was hinkommt
      markierungen.forEach(function (m) {
        var km = klein(m.mp), sp = schwerpunktMP(km);
        var fl = Math.sqrt(Math.max(1, flaecheMP(km)));
        var gr = Math.max(1.6, Math.min(4, fl * 0.35));
        var tb = M2M.textBreite(m.label, gr);
        text(bl, m.label, sp[0] - tb / 2, sp[1] - gr / 2, gr);
      });
      // Teile A, B, … mit großen Buchstaben und den Plattennummern dazu
      for (var j2 = ny - 1, id2 = 0; j2 >= 0; j2--) {
        for (var i2 = 0; i2 < nx; i2++, id2++) {
          var bu = buchstaben(id2);
          var kx2 = x0 + i2 * kachelB * s, ky2 = y0 + j2 * kachelH * s, kb = kachelB * s, kh2 = kachelH * s;
          bl.linien.push({ farbe: "schwarz", pts: [[kx2, ky2], [kx2 + kb, ky2], [kx2 + kb, ky2 + kh2], [kx2, ky2 + kh2]], zu: true });
          var gross = Math.min(48, kh2 * 0.3, kb * 0.4);
          text(bl, bu, kx2 + kb / 2 - M2M.textBreite(bu, gross) / 2, ky2 + kh2 / 2, gross);
          // darunter je Ebene eine Zeile: „OBEN P11“, „MITTE P15“, „WASSER P19“
          var zeilen = blaetter.filter(function (b) { return b.gruppe === "Grundplatte" && b.teil === bu; })
            .map(function (b) { return b.ebeneKurz + " P" + String(b.nummer).padStart(2, "0") + (b.anzahl > 1 ? " X" + b.anzahl : ""); });
          var breiteste = Math.max.apply(null, zeilen.map(function (z) { return M2M.textBreite(z, 1); }).concat([1]));
          var nh = Math.min(9, Math.max(MIN_SCHRIFT, Math.min((kb * 0.8) / breiteste, (kh2 * 0.45 - gross * 0.5) / (zeilen.length * 1.4))));
          zeilen.forEach(function (z, zi) {
            text(bl, z, kx2 + kb / 2 - M2M.textBreite(z, nh) / 2, ky2 + kh2 / 2 - 6 - (zi + 1) * nh * 1.4, nh);
          });
        }
      }
      return bl;
    }

    // ---------- Blatt fertigstellen: Rahmen, doppelte Linien, Prüfung ----------
    fortschritt && fortschritt("Prüfe die Regeln …");
    var entfernt = 0;
    blaetter.forEach(function (b) {
      entfernt += entferneDoppelte(b);
      b.linien.unshift({ farbe: "gelb", pts: [[PLATTE_X, PLATTE_Y], [PLATTE_X + cfg.plattenB, PLATTE_Y], [PLATTE_X + cfg.plattenB, PLATTE_Y + cfg.plattenH], [PLATTE_X, PLATTE_Y + cfg.plattenH]], zu: true });
      b.linien.unshift({ farbe: "gelb", pts: [[0, 0], [BETT_B, 0], [BETT_B, BETT_H], [0, BETT_H]], zu: true });
    });

    var pruefung = pruefe(blaetter);
    if (imp.ohneKennwort) hinweise.push(imp.ohneKennwort + " Bauteil(e) ohne Kennwort im Namen – mit Höhe als Neubau-Gebäude behandelt, flache ignoriert.");
    if (zuKlein) hinweise.push(zuKlein + " sehr kleine Teile (< 1 mm) wurden weggelassen.");
    if (ohneNummer) hinweise.push(ohneNummer + " Umrisse auf der Bodenplatte sind zu klein für eine lesbare Nummer – im Bauplan nachsehen.");
    if (aussenBeschriftet) hinweise.push(aussenBeschriftet + " sehr kleine Teile tragen ihre Nummer direkt UNTER dem Teil auf der Pappe (z. B. „N1-3“) – beim Herauslösen gleich zuordnen.");
    if (zuGross) hinweise.push(zuGross + " Teile sind größer als die Platte und fehlen – größere Platte oder kleineren Maßstab wählen.");
    if (nx * ny > 1) {
      var passt = Math.ceil(Math.max((R.xmax - R.xmin) * 1000 / nutzB, (R.ymax - R.ymin) * 1000 / nutzH));
      hinweise.push("Die Grundplatte ist auf " + nx * ny + " Teile aufgeteilt. Tipp: Ab Maßstab 1:" + passt + " passt sie auf eine Platte.");
    }
    if (cfg.bauweise === "volumen") hinweise.push("Volumen: Wände enden an jeder Ecke eine Materialstärke früher. Innenhöfe und Schrägdächer werden nicht abgebildet.");

    var zaehl = {};
    blaetter.forEach(function (b) { if (b.gruppe !== "Übersicht") zaehl[b.gruppe] = (zaehl[b.gruppe] || 0) + b.anzahl; });
    if (cfg.beschriften === false) hinweise.unshift("Ohne Beschriftung: Gebäudeteile und Umrisse auf der Bodenplatte haben keine Nummern – im Bauplan (Lageplan) nachsehen, was wohin gehört.");
    else hinweise.unshift("Gravur liegt auf der Rückseite: Gebäudeteile sind gespiegelt geschnitten (die Schrift nicht) – umgedreht verbauen (Schichten/Dach: Gravur nach unten, Wände: nach innen). Von unten liest man sie richtig herum, am fertigen Modell ist sie nicht zu sehen.");
    // ---------- Daten für die Übersicht (Lageplan + Listen) ----------
    var bauteile = gebaeude.concat(liste("Grün"), liste("Brücke"))
      .filter(function (e) { return e.schichten; })
      .map(function (e) {
        var platten = [];
        e.schichten.forEach(function (s) { if (platten.indexOf(s.blatt.nummer) < 0) platten.push(s.blatt.nummer); });
        return {
          kategorie: e.kategorie, neubau: e.neubau, gravur: e.label, kurz: e.kurz, name: e.lang,
          hoeheM: e.zmax - e.zmin, teile: e.schichten.length, platten: platten.sort(function (a, b) { return a - b; }),
        };
      });
    var plan = {
      breite: MW, hoehe: MH, wasser: wasser, strasse: strasse, bahn: bahn,
      markierungen: markierungen.map(function (m) {
        return { mp: m.mp, label: m.label, kategorie: m.element.kategorie, neubau: m.element.neubau };
      }),
      baeume: baeume,
      kacheln: { nx: nx, ny: ny, b: kachelB, h: kachelH },
    };

    return {
      blaetter: blaetter, pruefung: pruefung, hinweise: hinweise, zaehl: zaehl,
      teile: { grundplatte: nx * ny, ebenen: ebenen + 1, kachel: [kachelB, kachelH], gebaeude: gebaeude.length },
      modellMM: [MW, MH], doppelteEntfernt: entfernt, finnpappen: finnpappen,
      bauteile: bauteile, plan: plan, ebenenArten: ebenenArten,
    };
  };

  // ===================================================================
  // Straßennamen entlang der Straßen-Mittellinie setzen.
  // linien: [{ name, pts }] in Modell-mm · ziel: Straßenfläche (MultiPolygon)
  // Ergebnis: [{ name, i, j, linien }] – i, j = Teil der Grundplatte (Spalte, Zeile)
  function setzeStrassenNamen(linien, ziel, kachelB, kachelH, nx, ny, massstab) {
    var gesetzt = [], boxen = [];
    var nachName = {};
    linien.forEach(function (l) { (nachName[l.name] = nachName[l.name] || []).push(l.pts.slice()); });

    // Wege einer Straße, die sich am Ende berühren, zu einem langen Zug verbinden
    function verbinde(zuege) {
      var nah = function (a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.5; };
      var weiter = true;
      while (weiter) {
        weiter = false;
        for (var a = 0; a < zuege.length && !weiter; a++) {
          for (var b = 0; b < zuege.length && !weiter; b++) {
            if (a === b) continue;
            var A = zuege[a], B = zuege[b];
            var neu = null;
            if (nah(A[A.length - 1], B[0])) neu = A.concat(B.slice(1));
            else if (nah(A[A.length - 1], B[B.length - 1])) neu = A.concat(B.slice(0, -1).reverse());
            else if (nah(A[0], B[0])) neu = A.slice().reverse().concat(B.slice(1));
            if (neu) { zuege[a] = neu; zuege.splice(b, 1); weiter = true; }
          }
        }
      }
      return zuege;
    }

    function boxVon(m, w, tw, h) { // gedrehtes Rechteck um den Text (mit etwas Luft)
      var c = Math.cos(w), s = Math.sin(w);
      var x0 = -tw / 2 - 0.6, x1 = tw / 2 + 0.6, y0 = -h * 5 / 12 - 0.5, y1 = h * 7 / 12 + 0.5;
      var dreh = function (x, y) { return [m[0] + x * c - y * s, m[1] + x * s + y * c]; };
      var proben = [];
      var n = Math.max(2, Math.ceil((x1 - x0) / Math.max(0.8, h / 2)));
      for (var k = 0; k <= n; k++) {
        var x = x0 + (x1 - x0) * k / n;
        proben.push(dreh(x, y0), dreh(x, y1), dreh(x, (y0 + y1) / 2));
      }
      return { ring: [dreh(x0, y0), dreh(x1, y0), dreh(x1, y1), dreh(x0, y1)], proben: proben };
    }
    function ueberlappt(box) {
      return boxen.some(function (o) {
        return box.proben.some(function (p) { return M2M.geo.punktInRing(p, o.ring); }) ||
          o.proben.some(function (p) { return M2M.geo.punktInRing(p, box.ring); });
      });
    }
    function kachelVon(box) {
      var i = Math.floor(box.ring[0][0] / kachelB), j = Math.floor(box.ring[0][1] / kachelH);
      if (i < 0 || j < 0 || i >= nx || j >= ny) return null;
      var x0 = i * kachelB + 0.8, x1 = (i + 1) * kachelB - 0.8, y0 = j * kachelH + 0.8, y1 = (j + 1) * kachelH - 0.8;
      var drin = box.ring.every(function (p) { return p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1; });
      return drin ? [i, j] : null;
    }

    Object.keys(nachName).sort().forEach(function (name) {
      var txt = M2M.gross(name);
      var zuege = verbinde(nachName[name]);
      var xs = [], ys = [];
      zuege.forEach(function (z) { z.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); });
      var zielHier = schneide(ziel, rechteck(Math.min.apply(null, xs) - 20, Math.min.apply(null, ys) - 20,
        Math.max.apply(null, xs) - Math.min.apply(null, xs) + 40, Math.max.apply(null, ys) - Math.min.apply(null, ys) + 40));
      if (!zielHier.length) return;

      // Schriftgröße nach Maßstab: ca. 2,4 m echte Höhe (1:500 → 4,8 mm, 1:1000 → 2,4 mm, 1:200 → 8 mm),
      // passt sie nicht in die Straße, wird sie schrittweise kleiner.
      var groessen = [], gStart = Math.max(MIN_SCHRIFT, Math.min(8, 2400 / massstab));
      for (var gg = gStart; gg > MIN_SCHRIFT + 0.05; gg *= 0.85) groessen.push(gg);
      groessen.push(MIN_SCHRIFT);
      for (var gi = 0; gi < groessen.length; gi++) {
        var h = groessen[gi], tw = M2M.textBreite(txt, h);
        var kand = [];
        zuege.forEach(function (z) {
          var lang = [0];
          for (var k = 1; k < z.length; k++) lang.push(lang[k - 1] + Math.hypot(z[k][0] - z[k - 1][0], z[k][1] - z[k - 1][1]));
          var L = lang[lang.length - 1];
          if (L < tw * 1.05) return;
          var bei = function (s) {
            for (var k = 1; k < z.length; k++) if (lang[k] >= s) {
              var t = (s - lang[k - 1]) / Math.max(1e-9, lang[k] - lang[k - 1]);
              return [z[k - 1][0] + (z[k][0] - z[k - 1][0]) * t, z[k - 1][1] + (z[k][1] - z[k - 1][1]) * t];
            }
            return z[z.length - 1];
          };
          var schritt = Math.max(1.5, tw / 6);
          for (var s0 = 0; s0 + tw <= L + 1e-9; s0 += schritt) {
            var a = bei(s0), b = bei(s0 + tw);
            var dx = b[0] - a[0], dy = b[1] - a[1], cl = Math.hypot(dx, dy);
            if (cl < tw * 0.97) continue; // zu kurvig
            // gerade genug? Alle Knicke dazwischen nahe an der Sehne
            var gerade = true;
            for (var k2 = 1; k2 < z.length - 1 && gerade; k2++) {
              if (lang[k2] <= s0 || lang[k2] >= s0 + tw) continue;
              var d = Math.abs((z[k2][0] - a[0]) * dy - (z[k2][1] - a[1]) * dx) / cl;
              if (d > h * 0.3) gerade = false;
            }
            if (!gerade) continue;
            var w = Math.atan2(dy, dx);
            if (w > Math.PI / 2 + 1e-6) w -= Math.PI; else if (w <= -Math.PI / 2 + 1e-6) w += Math.PI; // immer lesbar
            var mitte = s0 + tw / 2;
            kand.push({ m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], w: w, wert: Math.abs(mitte - L / 2) - L });
          }
        });
        kand.sort(function (p, q) { return p.wert - q.wert; });
        var hier = [], tests = 0;
        for (var ci = 0; ci < kand.length && hier.length < 3 && tests < 200; ci++) {
          var kd = kand[ci];
          if (hier.some(function (o) { return Math.hypot(o.m[0] - kd.m[0], o.m[1] - kd.m[1]) < tw * 2.5 + 40; })) continue;
          tests++;
          var box = boxVon(kd.m, kd.w, tw, h);
          if (!box.proben.every(function (p) { return inMP(p, zielHier); })) continue;
          if (ueberlappt(box)) continue;
          var kach = kachelVon(box);
          if (!kach) continue;
          var c = Math.cos(kd.w), sn = Math.sin(kd.w);
          var striche = M2M.textLinien(txt, -tw / 2, -h * 5 / 12, h).map(function (pts) {
            return pts.map(function (p) { return [kd.m[0] + p[0] * c - p[1] * sn, kd.m[1] + p[0] * sn + p[1] * c]; });
          });
          hier.push({ m: kd.m });
          boxen.push(box);
          gesetzt.push({ name: name, i: kach[0], j: kach[1], linien: striche });
        }
        if (hier.length) break; // passt in dieser Größe → nicht kleiner probieren
      }
    });
    return gesetzt;
  }

  function neuesBlatt(name, gruppe) { return { name: name, gruppe: gruppe, linien: [], flaechen: [], inhalt: [] }; }

  function umriss(blatt, mp, farbe) {
    mp.forEach(function (poly) {
      poly.forEach(function (ring) {
        var r = ring.slice();
        var a = r[0], z = r[r.length - 1];
        if (r.length > 1 && Math.abs(a[0] - z[0]) < 1e-9 && Math.abs(a[1] - z[1]) < 1e-9) r.pop();
        if (r.length >= 2) blatt.linien.push({ farbe: farbe, pts: r, zu: true });
      });
    });
  }

  // sichtbare Gravur (schwarz) in der feinen Einstrich-Schrift
  function text(blatt, inhalt, x, y, h) {
    M2M.textLinien(inhalt, x, y, h).forEach(function (pts) { blatt.linien.push({ farbe: "schwarz", pts: pts, zu: false }); });
  }

  // feine, geritzte Kennzeichnung (blau) – kaum sichtbar
  function fein(blatt, inhalt, x, y, h) {
    M2M.textLinien(inhalt, x, y, h).forEach(function (pts) { blatt.linien.push({ farbe: "blau", pts: pts, zu: false }); });
  }
  // dasselbe, wahlweise um 90° gedreht (von unten nach oben lesbar) in einem hochkanten Feld ab (x, y)
  function feinGedreht(blatt, inhalt, x, y, h, dreh) {
    if (!dreh) return fein(blatt, inhalt, x, y, h);
    M2M.textLinien(inhalt, 0, 0, h).forEach(function (pts) {
      blatt.linien.push({ farbe: "blau", pts: pts.map(function (p) { return [x + h - p[1], y + p[0]]; }), zu: false });
    });
  }

  // ---------- Doppelte und übereinanderliegende Linien entfernen („Overkill“) ----------
  // Reihenfolge: rot vor blau vor schwarz. Liegt eine Linie auf einer schon vorhandenen,
  // wird der überlappende Teil gelöscht.
  function entferneDoppelte(blatt) {
    var RANG = { rot: 0, blau: 1, schwarz: 2 };
    var ZELLE = 20, TOL = 0.05, gitter = {};
    var segs = [];
    blatt.linien.forEach(function (l) {
      var n = l.pts.length, bis = l.zu ? n : n - 1;
      for (var i = 0; i < bis; i++) segs.push({ a: l.pts[i], b: l.pts[(i + 1) % n], farbe: l.farbe });
    });
    segs.sort(function (s1, s2) { return RANG[s1.farbe] - RANG[s2.farbe]; });

    function zellen(a, b) {
      var x0 = Math.floor((Math.min(a[0], b[0]) - TOL) / ZELLE), x1 = Math.floor((Math.max(a[0], b[0]) + TOL) / ZELLE);
      var y0 = Math.floor((Math.min(a[1], b[1]) - TOL) / ZELLE), y1 = Math.floor((Math.max(a[1], b[1]) + TOL) / ZELLE);
      var aus = [];
      for (var x = x0; x <= x1; x++) for (var y = y0; y <= y1; y++) aus.push(x + "," + y);
      return aus;
    }

    var behalten = [], entfernt = 0;
    segs.forEach(function (s) {
      var dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], L = Math.hypot(dx, dy);
      if (L < 0.01) { entfernt++; return; }
      var ux = dx / L, uy = dy / L;
      var frei = [[0, L]]; // freie Abschnitte entlang s
      var gesehen = {};
      zellen(s.a, s.b).forEach(function (z) {
        (gitter[z] || []).forEach(function (o) {
          if (gesehen[o.id]) return; gesehen[o.id] = true;
          // liegt o auf derselben Geraden?
          var d1 = Math.abs((o.a[0] - s.a[0]) * uy - (o.a[1] - s.a[1]) * ux);
          var d2 = Math.abs((o.b[0] - s.a[0]) * uy - (o.b[1] - s.a[1]) * ux);
          if (d1 > TOL || d2 > TOL) return;
          var t1 = (o.a[0] - s.a[0]) * ux + (o.a[1] - s.a[1]) * uy;
          var t2 = (o.b[0] - s.a[0]) * ux + (o.b[1] - s.a[1]) * uy;
          var lo = Math.min(t1, t2) - TOL, hi = Math.max(t1, t2) + TOL;
          var neu = [];
          frei.forEach(function (iv) {
            if (hi <= iv[0] || lo >= iv[1]) { neu.push(iv); return; }
            if (lo > iv[0]) neu.push([iv[0], lo]);
            if (hi < iv[1]) neu.push([hi, iv[1]]);
          });
          frei = neu;
        });
      });
      var weg = L - frei.reduce(function (summe, iv) { return summe + (iv[1] - iv[0]); }, 0);
      if (weg > 0.01) entfernt++;
      frei.forEach(function (iv) {
        if (iv[1] - iv[0] < 0.05) return;
        var seg = { a: [s.a[0] + ux * iv[0], s.a[1] + uy * iv[0]], b: [s.a[0] + ux * iv[1], s.a[1] + uy * iv[1]], farbe: s.farbe, id: behalten.length + 1 };
        behalten.push(seg);
        zellen(seg.a, seg.b).forEach(function (z) { (gitter[z] = gitter[z] || []).push(seg); });
      });
    });

    // wieder zu Linienzügen verbinden (gleiche Farbe, Ende = Anfang)
    var linien = [];
    ["rot", "blau", "schwarz"].forEach(function (farbe) {
      var eigene = behalten.filter(function (s) { return s.farbe === farbe; });
      var key = function (p) { return p[0].toFixed(3) + "," + p[1].toFixed(3); };
      var abStart = {};
      eigene.forEach(function (s, i) { (abStart[key(s.a)] = abStart[key(s.a)] || []).push(i); });
      var benutzt = {};
      eigene.forEach(function (s, i) {
        if (benutzt[i]) return;
        benutzt[i] = true;
        var pts = [s.a, s.b];
        for (var schutz = 0; schutz < 100000; schutz++) {
          var weiter = (abStart[key(pts[pts.length - 1])] || []).filter(function (k) { return !benutzt[k]; });
          if (!weiter.length) break;
          benutzt[weiter[0]] = true;
          pts.push(eigene[weiter[0]].b);
        }
        var zu = pts.length > 3 && key(pts[0]) === key(pts[pts.length - 1]);
        if (zu) pts.pop();
        linien.push({ farbe: farbe, pts: pts, zu: zu });
      });
    });
    blatt.linien = linien;
    return entfernt;
  }

  // ---------- Prüfung nach den Jade-Regeln ----------
  function pruefe(blaetter) {
    var minAbstand = Infinity, farbenOk = true, doppelt = 0;
    blaetter.forEach(function (b) {
      var gesehen = {};
      b.linien.forEach(function (l) {
        if (["rot", "blau", "gelb", "schwarz"].indexOf(l.farbe) < 0) farbenOk = false;
        var n = l.pts.length, bis = l.zu ? n : n - 1;
        for (var i = 0; i < bis; i++) {
          var a = l.pts[i], c = l.pts[(i + 1) % n];
          var k = [a[0].toFixed(2), a[1].toFixed(2), c[0].toFixed(2), c[1].toFixed(2)];
          var k1 = k.join(","), k2 = [k[2], k[3], k[0], k[1]].join(",");
          if (gesehen[k1] || gesehen[k2]) doppelt++;
          gesehen[k1] = true;
        }
        if (l.farbe === "gelb") return;
        l.pts.forEach(function (p) { minAbstand = Math.min(minAbstand, p[0], p[1], BETT_B - p[0], BETT_H - p[1]); });
      });
      b.flaechen.forEach(function (q) { minAbstand = Math.min(minAbstand, q[0], q[1], BETT_B - q[0] - q[2], BETT_H - q[1] - q[3]); });
    });
    return [
      { ok: true, text: "Gelber Rahmen 1000 × 600 mm auf jeder Platte" },
      { ok: minAbstand >= 5 - 1e-6, text: "Alle Teile mindestens 5 mm vom Rahmen entfernt (kleinster Abstand " + (isFinite(minAbstand) ? minAbstand.toFixed(1) : "–") + " mm)" },
      { ok: farbenOk, text: "Nur Rot, Blau, Gelb und Schwarz (RGB)" },
      { ok: doppelt === 0, text: doppelt === 0 ? "Keine doppelten Linien" : doppelt + " doppelte Linien gefunden" },
      { ok: true, text: "Schrift als feine Einzellinie – keine Schriftart nötig" },
      { ok: true, text: "Linienstärke 0,00 mm" },
    ];
  }
})();
