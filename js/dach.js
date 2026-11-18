/* =========================================================
   Satteldach für ein Gebäude berechnen
   - Der First läuft in der Mitte entlang der langen Seite des Gebäudes
     (kleinstes umschließendes Rechteck; „roof:orientation=across“ dreht ihn).
   - Dachneigung 40°, Dachhöhe 1,5–7 m; aus OSM werden roof:height und
     roof:levels übernommen, wenn vorhanden.
   - Flach bleiben: Gebäude mit Innenhof, Nebengebäude (Garage, Schuppen),
     Gebäude, die in OSM als Flachdach eingetragen sind, und sehr breite
     Gebäude (> 22 m, z. B. Hallen).
   Ergebnis: zwei geschlossene Körper (Wände bis zur Traufe + Dach) als
   Eckpunkte und Flächen – bereit für die IFC-Datei.
   ========================================================= */

(function () {
  var NEIGUNG = 40 * Math.PI / 180;
  var MAX_BREITE = 22;

  function huelle(punkte) {
    var p = punkte.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    function k(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var u = [], o = [];
    p.forEach(function (q) { while (u.length >= 2 && k(u[u.length - 2], u[u.length - 1], q) <= 0) u.pop(); u.push(q); });
    p.slice().reverse().forEach(function (q) { while (o.length >= 2 && k(o[o.length - 2], o[o.length - 1], q) <= 0) o.pop(); o.push(q); });
    o.pop(); u.pop();
    return u.concat(o);
  }

  // kleinstes umschließendes Rechteck: Mitte, Richtung der langen Seite, Breite (kurze Seite)
  function rechteck(ring) {
    var h = huelle(ring), best = null;
    for (var i = 0; i < h.length; i++) {
      var a = h[i], b = h[(i + 1) % h.length];
      var L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) continue;
      var u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], n = [-u[1], u[0]];
      var umin = Infinity, umax = -Infinity, nmin = Infinity, nmax = -Infinity;
      h.forEach(function (p) {
        var su = p[0] * u[0] + p[1] * u[1], sn = p[0] * n[0] + p[1] * n[1];
        umin = Math.min(umin, su); umax = Math.max(umax, su); nmin = Math.min(nmin, sn); nmax = Math.max(nmax, sn);
      });
      var fl = (umax - umin) * (nmax - nmin);
      if (!best || fl < best.fl) {
        var cu = (umin + umax) / 2, cn = (nmin + nmax) / 2;
        best = { fl: fl, u: u, n: n, lu: umax - umin, ln: nmax - nmin,
          mitte: [cu * u[0] + cn * n[0], cu * u[1] + cn * n[1]] };
      }
    }
    if (!best) return null;
    // u soll entlang der LANGEN Seite liegen
    if (best.ln > best.lu) {
      var t = best.u; best.u = best.n; best.n = [-t[0], -t[1]];
      var tl = best.lu; best.lu = best.ln; best.ln = tl;
    }
    return best;
  }

  // Körper aus einem Umriss: unten flach auf zUnten, oben nach zOben(p)
  // Liegt ein oberer Punkt genau auf dem unteren (Höhe 0, z. B. an der Traufe),
  // wird derselbe Eckpunkt benutzt – so entstehen keine Kanten der Länge 0.
  function koerper(ring, zUnten, zOben) {
    var n = ring.length, ecken = [], flaechen = [], oben = [];
    ring.forEach(function (p) { ecken.push([p[0], p[1], zUnten]); });
    ring.forEach(function (p, i) {
      var z = zOben(p);
      if (Math.abs(z - zUnten) < 1e-4) oben.push(i);
      else { oben.push(ecken.length); ecken.push([p[0], p[1], z]); }
    });
    function flaeche(idx) {
      var f = [];
      idx.forEach(function (i) { if (f[f.length - 1] !== i) f.push(i); });
      if (f.length > 1 && f[0] === f[f.length - 1]) f.pop();
      if (f.length >= 3) flaechen.push(f);
    }
    var boden = []; for (var i = n - 1; i >= 0; i--) boden.push(i);
    flaeche(boden);
    for (var j = 0; j < n; j++) { var k = (j + 1) % n; flaeche([j, k, oben[k], oben[j]]); }
    return { ecken: ecken, flaechen: flaechen, oben: oben, flaeche: flaeche };
  }

  M2M.satteldach = function (e) {
    var d = e.dach || {};
    if (e.innen && e.innen.length) return { grund: "Innenhof" };
    if (d.osmForm === "flat") return { grund: "OSM: Flachdach" };
    if (d.klein) return { grund: "Nebengebäude" };

    var ring = e.aussen;
    var re = rechteck(ring);
    if (!re) return { grund: "Form" };
    var u = d.quer ? re.n : re.u, n = d.quer ? [-re.u[0], -re.u[1]] : re.n;
    var breite = d.quer ? re.lu : re.ln;
    if (breite > MAX_BREITE) return { grund: "zu breit" };
    var halb = breite / 2;

    // Höhen
    var dachH = d.osmDachHoehe || (d.dachgeschosse ? d.dachgeschosse * 3 : Math.tan(NEIGUNG) * halb);
    dachH = Math.max(1.5, Math.min(7, dachH));
    var traufe;
    if (d.gesamtHoeheBekannt) { dachH = Math.min(dachH, e.hoehe * 0.5); traufe = e.hoehe - dachH; }
    else if (d.dachgeschosse) traufe = e.hoehe - d.dachgeschosse * 3;
    else traufe = e.hoehe;
    traufe = Math.max(2, traufe);

    var c = re.mitte;
    function abstand(p) { return (p[0] - c[0]) * n[0] + (p[1] - c[1]) * n[1]; }

    // Punkte einfügen, wo der First die Außenwand kreuzt
    var mitFirst = [];
    ring.forEach(function (p, i) {
      var q = ring[(i + 1) % ring.length];
      mitFirst.push(p);
      var dp = abstand(p), dq = abstand(q);
      if ((dp > 1e-6 && dq < -1e-6) || (dp < -1e-6 && dq > 1e-6)) {
        var t = dp / (dp - dq);
        mitFirst.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
      }
    });

    var z0 = e.basis || 0;
    function dachZ(p) { return z0 + traufe + dachH * Math.max(0, 1 - Math.abs(abstand(p)) / halb); }

    var waende = koerper(mitFirst, z0, function () { return z0 + traufe; });
    waende.flaeche(waende.oben.slice()); // Deckel auf Traufhöhe

    // Dach: unten auf der Traufe, oben zwei geneigte Flächen (links und rechts vom First)
    // (Seitenflächen ohne Höhe – an der Traufe – fallen dabei automatisch weg)
    var dach = koerper(mitFirst, z0 + traufe, dachZ);
    var m = mitFirst.length;
    [1, -1].forEach(function (seite) {
      var oben = [];
      for (var i = 0; i < m; i++) if (seite * abstand(mitFirst[i]) >= -1e-6) oben.push(dach.oben[i]);
      dach.flaeche(oben);
    });

    return { waende: waende, dach: dach, traufe: traufe, first: traufe + dachH, dachH: dachH };
  };
})();
