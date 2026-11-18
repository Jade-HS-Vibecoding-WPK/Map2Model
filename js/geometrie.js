/* =========================================================
   Geometrie-Werkzeuge
   - Umrechnen von Längen-/Breitengrad in Meter (lokal)
   - Flächen und Linien am Rechteck abschneiden
   - Straßenlinien zu Flächen mit Breite machen
   - Ringe aus mehreren OSM-Wegen zusammensetzen
   - Meer aus der Küstenlinie bilden
   Alle Punkte: [x, y] in Metern, x = Osten, y = Norden.
   ========================================================= */

(function () {
  var G = {};

  // ---------- Umrechnung Grad → Meter um einen Mittelpunkt ----------
  G.projektion = function (lat0, lon0) {
    var phi = lat0 * Math.PI / 180;
    var mProGradLat = 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi);
    var mProGradLon = 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi);
    return {
      lat0: lat0, lon0: lon0,
      zuMeter: function (lat, lon) { return [(lon - lon0) * mProGradLon, (lat - lat0) * mProGradLat]; },
      zuGrad: function (x, y) { return [lat0 + y / mProGradLat, lon0 + x / mProGradLon]; },
    };
  };

  // ---------- Kleinkram ----------
  G.flaeche = function (ring) { // mit Vorzeichen: > 0 = gegen den Uhrzeigersinn
    var a = 0;
    for (var i = 0, n = ring.length; i < n; i++) {
      var p = ring[i], q = ring[(i + 1) % n];
      a += p[0] * q[1] - q[0] * p[1];
    }
    return a / 2;
  };

  G.schwerpunkt = function (ring) {
    var x = 0, y = 0;
    ring.forEach(function (p) { x += p[0]; y += p[1]; });
    return [x / ring.length, y / ring.length];
  };

  G.punktInRing = function (pt, ring) {
    var drin = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var a = ring[i], b = ring[j];
      if ((a[1] > pt[1]) !== (b[1] > pt[1]) &&
          pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) drin = !drin;
    }
    return drin;
  };

  // doppelte Punkte und den wiederholten Schlusspunkt entfernen
  G.bereinigeRing = function (ring) {
    var aus = [];
    ring.forEach(function (p) {
      var l = aus[aus.length - 1];
      if (!l || Math.abs(l[0] - p[0]) > 0.01 || Math.abs(l[1] - p[1]) > 0.01) aus.push(p);
    });
    if (aus.length > 1) {
      var a = aus[0], z = aus[aus.length - 1];
      if (Math.abs(a[0] - z[0]) < 0.01 && Math.abs(a[1] - z[1]) < 0.01) aus.pop();
    }
    return aus;
  };

  // ---------- Umriss für Revit sauber machen ----------
  // - doppelte und fast doppelte Punkte (< 5 cm) entfernen
  // - Punkte auf einer Geraden entfernen
  // - Drehsinn festlegen: außen gegen den Uhrzeigersinn, Löcher im Uhrzeigersinn
  // leicht = true: nur doppelte Punkte (< 1 cm) entfernen – für verschmolzene Flächen,
  // damit sich Löcher und Außenkante nicht berühren.
  G.saeubereRing = function (ring, aussen, leicht) {
    var pts = G.bereinigeRing(ring.map(function (p) {
      return [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000];
    }));
    if (leicht) {
      if (pts.length < 3 || Math.abs(G.flaeche(pts)) < 0.5) return null;
      if ((G.flaeche(pts) > 0) !== !!aussen) pts.reverse();
      return pts;
    }
    var geaendert = true, schutz = 0;
    while (geaendert && pts.length > 3 && schutz++ < 50) {
      geaendert = false;
      for (var i = 0; i < pts.length && pts.length > 3; i++) {
        var a = pts[(i + pts.length - 1) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length];
        var ab = Math.hypot(b[0] - a[0], b[1] - a[1]);
        // Fläche des Dreiecks a-b-c → Abstand von b zur Geraden a-c
        var ac = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
        var abstand = Math.abs((c[0] - a[0]) * (b[1] - a[1]) - (b[0] - a[0]) * (c[1] - a[1])) / ac;
        if (ab < 0.05 || abstand < 0.01) { pts.splice(i, 1); geaendert = true; i--; }
      }
    }
    if (pts.length < 3 || Math.abs(G.flaeche(pts)) < 0.5) return null;
    var gegenUhr = G.flaeche(pts) > 0;
    if (gegenUhr !== !!aussen) pts.reverse();
    return pts;
  };

  // Schneidet sich ein Umriss selbst? (Revit lehnt solche Formen ab)
  G.schneidetSichSelbst = function (ring) {
    function o(p, q, r) { return Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); }
    var n = ring.length;
    for (var i = 0; i < n; i++) {
      var a = ring[i], b = ring[(i + 1) % n];
      for (var j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        var c = ring[j], d = ring[(j + 1) % n];
        if (o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0) return true;
      }
    }
    return false;
  };

  // ---------- Flächen verschmelzen / abziehen (Bibliothek polygon-clipping) ----------
  // Polygon = [aussenRing, lochRing, ...]; MultiPolygon = [Polygon, ...]
  G.vereinige = function (polygone) {
    if (!polygone.length) return [];
    try {
      return polygonClipping.union.apply(null, polygone);
    } catch (e) {
      // Falls eine einzelne Fläche Probleme macht: Stück für Stück verschmelzen und sie auslassen
      console.warn("Verschmelzen schrittweise:", e);
      var ergebnis = [];
      polygone.forEach(function (p) {
        try { ergebnis = ergebnis.length ? polygonClipping.union(ergebnis, p) : [p]; }
        catch (e2) { console.warn("Fläche ausgelassen", e2); }
      });
      return ergebnis;
    }
  };

  G.abzueglich = function (multi, andere) {
    var weg = andere.filter(function (m) { return m && m.length; });
    if (!multi.length || !weg.length) return multi;
    try { return polygonClipping.difference.apply(null, [multi].concat(weg)); }
    catch (e) { console.warn("Abziehen nicht möglich, Fläche bleibt ganz:", e); return multi; }
  };

  // MultiPolygon → [{ aussen, innen }] mit sauberen, richtig gedrehten Ringen
  G.zuRingen = function (multi) {
    var aus = [];
    (multi || []).forEach(function (poly) {
      var aussen = G.saeubereRing(poly[0], true, true);
      if (!aussen || Math.abs(G.flaeche(aussen)) < 1) return;
      var innen = poly.slice(1).map(function (ir) { return G.saeubereRing(ir, false, true); })
        .filter(function (ir) { return ir && Math.abs(G.flaeche(ir)) >= 0.5; });
      aus.push({ aussen: aussen, innen: innen });
    });
    return aus;
  };

  // ---------- Fläche am Rechteck abschneiden (Sutherland-Hodgman) ----------
  // r = { xmin, ymin, xmax, ymax }
  G.schneideRing = function (ring, r) {
    var kanten = [
      function (p) { return p[0] >= r.xmin; }, function (p) { return p[0] <= r.xmax; },
      function (p) { return p[1] >= r.ymin; }, function (p) { return p[1] <= r.ymax; },
    ];
    var schnitt = [
      function (a, b) { var t = (r.xmin - a[0]) / (b[0] - a[0]); return [r.xmin, a[1] + t * (b[1] - a[1])]; },
      function (a, b) { var t = (r.xmax - a[0]) / (b[0] - a[0]); return [r.xmax, a[1] + t * (b[1] - a[1])]; },
      function (a, b) { var t = (r.ymin - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), r.ymin]; },
      function (a, b) { var t = (r.ymax - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), r.ymax]; },
    ];
    var aus = ring;
    for (var k = 0; k < 4; k++) {
      var ein = aus; aus = [];
      if (!ein.length) break;
      for (var i = 0; i < ein.length; i++) {
        var cur = ein[i], prev = ein[(i + ein.length - 1) % ein.length];
        var curIn = kanten[k](cur), prevIn = kanten[k](prev);
        if (curIn) {
          if (!prevIn) aus.push(schnitt[k](prev, cur));
          aus.push(cur);
        } else if (prevIn) {
          aus.push(schnitt[k](prev, cur));
        }
      }
    }
    return G.bereinigeRing(aus);
  };

  // ---------- Linie am Rechteck abschneiden (Liang-Barsky) ----------
  // Ergebnis: Liste von Teil-Linien, jede mit .startRand / .endeRand (liegt auf dem Rand?)
  function schneideStrecke(a, b, r) {
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var t0 = 0, t1 = 1;
    var p = [-dx, dx, -dy, dy];
    var q = [a[0] - r.xmin, r.xmax - a[0], a[1] - r.ymin, r.ymax - a[1]];
    for (var i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return null; }
      else {
        var t = q[i] / p[i];
        if (p[i] < 0) { if (t > t1) return null; if (t > t0) t0 = t; }
        else { if (t < t0) return null; if (t < t1) t1 = t; }
      }
    }
    return { a: [a[0] + t0 * dx, a[1] + t0 * dy], b: [a[0] + t1 * dx, a[1] + t1 * dy], t0: t0, t1: t1 };
  }

  G.schneideLinie = function (linie, r) {
    var teile = [], aktuell = null;
    for (var i = 0; i < linie.length - 1; i++) {
      var s = schneideStrecke(linie[i], linie[i + 1], r);
      if (!s) { if (aktuell) { teile.push(aktuell); aktuell = null; } continue; }
      if (!aktuell) {
        aktuell = [s.a];
        aktuell.startRand = s.t0 > 0 || aufRand(s.a, r);
      }
      aktuell.push(s.b);
      if (s.t1 < 1) { aktuell.endeRand = true; teile.push(aktuell); aktuell = null; }
    }
    if (aktuell) { aktuell.endeRand = aufRand(aktuell[aktuell.length - 1], r); teile.push(aktuell); }
    return teile.filter(function (t) { return t.length >= 2; });
  };

  function aufRand(p, r) {
    var e = 0.01;
    return Math.abs(p[0] - r.xmin) < e || Math.abs(p[0] - r.xmax) < e ||
           Math.abs(p[1] - r.ymin) < e || Math.abs(p[1] - r.ymax) < e;
  }

  // ---------- Linie → saubere Flächen (ohne Selbstüberschneidung) ----------
  // An scharfen Knicken (> 60°) wird die Linie geteilt; schneidet sich ein Teil
  // trotzdem selbst, wird er in einzelne gerade Stücke zerlegt.
  G.linieZuFlaechen = function (linie, breite) {
    var pts = [];
    linie.forEach(function (p) {
      var l = pts[pts.length - 1];
      if (!l || Math.hypot(l[0] - p[0], l[1] - p[1]) > 0.05) pts.push(p);
    });
    if (pts.length < 2) return [];
    var teile = [], cur = [pts[0]];
    for (var i = 1; i < pts.length; i++) {
      cur.push(pts[i]);
      if (i < pts.length - 1) {
        var a = pts[i - 1], b = pts[i], c = pts[i + 1];
        var w1 = Math.atan2(b[1] - a[1], b[0] - a[0]), w2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
        var knick = Math.abs(((w2 - w1 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
        if (knick > Math.PI / 3) { teile.push(cur); cur = [pts[i]]; }
      }
    }
    teile.push(cur);

    var flaechen = [];
    teile.forEach(function (t) {
      if (t.length < 2) return;
      var f = G.linieZuFlaeche(t, breite);
      if (f && !G.schneidetSichSelbst(f)) { flaechen.push(f); return; }
      for (var k = 0; k < t.length - 1; k++) {
        var q = G.linieZuFlaeche([t[k], t[k + 1]], breite);
        if (q) flaechen.push(q);
      }
    });
    return flaechen;
  };

  // ---------- Linie → Fläche mit Breite (für Straßen und Gleise) ----------
  G.linieZuFlaeche = function (linie, breite) {
    // nur doppelte Punkte entfernen
    var pts = [];
    linie.forEach(function (p) {
      var l = pts[pts.length - 1];
      if (!l || Math.hypot(l[0] - p[0], l[1] - p[1]) > 0.05) pts.push(p);
    });
    if (pts.length < 2) return null;

    var h = breite / 2, links = [], rechts = [];
    function normale(a, b) {
      var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      return [-dy / l, dx / l];
    }
    for (var i = 0; i < pts.length; i++) {
      var n;
      var laenge = h;
      if (i === 0) n = normale(pts[0], pts[1]);
      else if (i === pts.length - 1) n = normale(pts[i - 1], pts[i]);
      else {
        var n1 = normale(pts[i - 1], pts[i]), n2 = normale(pts[i], pts[i + 1]);
        var s = [n1[0] + n2[0], n1[1] + n2[1]], ls = Math.hypot(s[0], s[1]);
        if (ls < 1e-6) n = n1;
        else {
          n = [s[0] / ls, s[1] / ls];
          var cos = n[0] * n1[0] + n[1] * n1[1];
          laenge = Math.min(h / Math.max(cos, 0.2), h * 2.5); // Spitzen begrenzen
        }
      }
      links.push([pts[i][0] + n[0] * laenge, pts[i][1] + n[1] * laenge]);
      rechts.push([pts[i][0] - n[0] * laenge, pts[i][1] - n[1] * laenge]);
    }
    return links.concat(rechts.reverse());
  };

  // ---------- Ringe aus mehreren Wegen zusammensetzen (OSM-Multipolygone) ----------
  // wege: Liste von Punktlisten in Grad [{lat, lon}, ...]
  G.setzeRingeZusammen = function (wege) {
    function key(p) { return p.lat.toFixed(7) + "," + p.lon.toFixed(7); }
    var pool = wege.filter(function (w) { return w && w.length >= 2; }).map(function (w) { return w.slice(); });
    var ringe = [];
    var schutz = 0;
    while (pool.length && schutz++ < 10000) {
      var cur = pool.shift();
      var weiter = true;
      while (weiter) {
        if (key(cur[0]) === key(cur[cur.length - 1]) && cur.length >= 4) { ringe.push(cur); break; }
        weiter = false;
        for (var i = 0; i < pool.length; i++) {
          var w = pool[i], a = key(w[0]), z = key(w[w.length - 1]);
          var cs = key(cur[0]), ce = key(cur[cur.length - 1]);
          if (a === ce) cur = cur.concat(w.slice(1));
          else if (z === ce) cur = cur.concat(w.slice(0, -1).reverse());
          else if (z === cs) cur = w.slice(0, -1).concat(cur);
          else if (a === cs) cur = w.slice(1).reverse().concat(cur);
          else continue;
          pool.splice(i, 1); weiter = true; break;
        }
      }
    }
    return ringe;
  };

  // Linien (z. B. Küste) an gemeinsamen Endpunkten zu langen Linien verbinden
  G.verbindeLinien = function (wege) {
    function key(p) { return p.lat.toFixed(7) + "," + p.lon.toFixed(7); }
    var pool = wege.map(function (w) { return w.slice(); });
    var aus = [];
    while (pool.length) {
      var cur = pool.shift(), weiter = true;
      while (weiter) {
        weiter = false;
        if (key(cur[0]) === key(cur[cur.length - 1])) break; // schon geschlossen
        for (var i = 0; i < pool.length; i++) {
          var w = pool[i];
          if (key(w[0]) === key(cur[cur.length - 1])) { cur = cur.concat(w.slice(1)); }
          else if (key(w[w.length - 1]) === key(cur[0])) { cur = w.slice(0, -1).concat(cur); }
          else continue;
          pool.splice(i, 1); weiter = true; break;
        }
      }
      aus.push(cur);
    }
    return aus;
  };

  // ---------- Meer aus der Küstenlinie ----------
  // In OSM liegt das Land links, das Wasser rechts der Küstenlinie.
  // linien: Küstenlinien in Metern; r: Rechteck.
  // richtung: +1 = normal (Wasser rechts), -1 = umgedreht (falls die Daten verkehrt herum sind).
  // Am Rand wird immer im Uhrzeigersinn weitergegangen – so liegt immer die rechte Seite innen.
  G.meerAusKueste = function (linien, r, richtung) {
    var W = r.xmax - r.xmin, H = r.ymax - r.ymin, U = 2 * (W + H);
    // Position auf dem Rand, im Uhrzeigersinn ab der Ecke oben links
    function randPos(p) {
      var e = 0.05;
      if (Math.abs(p[1] - r.ymax) < e) return p[0] - r.xmin;
      if (Math.abs(p[0] - r.xmax) < e) return W + (r.ymax - p[1]);
      if (Math.abs(p[1] - r.ymin) < e) return W + H + (r.xmax - p[0]);
      return 2 * W + H + (p[1] - r.ymin);
    }
    var ecken = [
      { t: 0, p: [r.xmin, r.ymax] }, { t: W, p: [r.xmax, r.ymax] },
      { t: W + H, p: [r.xmax, r.ymin] }, { t: 2 * W + H, p: [r.xmin, r.ymin] },
    ];
    // Ecken, die auf dem Weg von t1 nach t2 liegen (in Laufrichtung)
    function eckenZwischen(t1, t2) {
      var liste = [];
      var d = (t2 - t1 + U) % U;
      ecken.forEach(function (e) { var de = (e.t - t1 + U) % U; if (de > 1e-6 && de < d) liste.push({ d: de, p: e.p }); });
      return liste.sort(function (a, b) { return a.d - b.d; }).map(function (x) { return x.p; });
    }

    var stuecke = [], inseln = [];
    linien.forEach(function (l) {
      var geschlossen = l.length > 3 && Math.hypot(l[0][0] - l[l.length - 1][0], l[0][1] - l[l.length - 1][1]) < 0.05;
      var innen = l.every(function (p) { return p[0] > r.xmin && p[0] < r.xmax && p[1] > r.ymin && p[1] < r.ymax; });
      if (geschlossen && innen) { inseln.push(G.bereinigeRing(l)); return; }
      G.schneideLinie(l, r).forEach(function (t) {
        if (t.startRand && t.endeRand) {
          var s = richtung > 0 ? t : t.slice().reverse();
          stuecke.push({ pts: s, ein: randPos(s[0]), aus: randPos(s[s.length - 1]) });
        }
      });
    });

    var meere = [];
    if (!stuecke.length) {
      // keine Küste schneidet das Gebiet: nur Inseln → alles drumherum ist Meer
      if (inseln.length) meere.push({ aussen: [[r.xmin, r.ymin], [r.xmax, r.ymin], [r.xmax, r.ymax], [r.xmin, r.ymax]], innen: [] });
    } else {
      var offen = stuecke.slice();
      var schutz = 0;
      while (offen.length && schutz++ < 500) {
        var start = offen.shift(), ring = start.pts.slice(), t = start.aus, cur = start;
        for (var n = 0; n < 500; n++) {
          // nächstes Stück in Laufrichtung am Rand
          var kandidaten = offen.concat([start]), best = null, bestD = Infinity;
          kandidaten.forEach(function (k) {
            var d = (k.ein - t + U) % U;
            if (d < bestD) { bestD = d; best = k; }
          });
          ring = ring.concat(eckenZwischen(t, best.ein));
          if (best === start) break;
          ring = ring.concat(best.pts);
          t = best.aus;
          offen.splice(offen.indexOf(best), 1);
        }
        meere.push({ aussen: G.bereinigeRing(ring), innen: [] });
      }
    }
    // Inseln als Löcher in das Meer setzen, in dem sie liegen
    inseln.forEach(function (insel) {
      var m = meere.find(function (mm) { return G.punktInRing(insel[0], mm.aussen); });
      if (m) m.innen.push(insel);
    });
    return meere.filter(function (m) { return m.aussen.length >= 3 && Math.abs(G.flaeche(m.aussen)) > 1; });
  };

  window.M2M = window.M2M || {};
  M2M.geo = G;
})();
