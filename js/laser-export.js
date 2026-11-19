/* =========================================================
   Laserdatei als DXF und SVG schreiben + alles als ZIP packen
   DXF: Format R12 (liest jedes CAD- und Laserprogramm).
        Farben als AutoCAD-Farbnummern, die exakt den RGB-Werten entsprechen:
        1 = Rot (255,0,0), 5 = Blau (0,0,255), 2 = Gelb (255,255,0),
        7 = Schwarz (im CAD „Schwarz/Weiß“, wird schwarz ausgegeben).
        Jede Farbe liegt zusätzlich auf einem eigenen Layer.
   SVG: exakte RGB-Farben, Haarlinie, Maße in mm.
   ========================================================= */

(function () {
  var FARBE = {
    rot:     { aci: 1, rgb: "#FF0000", layer: "SCHNEIDEN_ROT" },
    blau:    { aci: 5, rgb: "#0000FF", layer: "RITZEN_BLAU" },
    gelb:    { aci: 2, rgb: "#FFFF00", layer: "RAHMEN_GELB" },
    schwarz: { aci: 7, rgb: "#000000", layer: "GRAVUR_SCHWARZ" },
  };

  function z(v) { return (Math.round(v * 1000) / 1000).toFixed(3); }

  // ---------- DXF (R12) ----------
  M2M.blattZuDxf = function (blatt) {
    var o = [];
    function g(code, wert) { o.push(String(code)); o.push(String(wert)); }

    g(0, "SECTION"); g(2, "HEADER");
    g(9, "$ACADVER"); g(1, "AC1009");
    g(9, "$INSUNITS"); g(70, 4);           // Millimeter
    g(9, "$EXTMIN"); g(10, 0); g(20, 0); g(30, 0);
    g(9, "$EXTMAX"); g(10, blatt.breite || 1000); g(20, blatt.hoehe || 600); g(30, 0);
    g(0, "ENDSEC");

    g(0, "SECTION"); g(2, "TABLES");
    g(0, "TABLE"); g(2, "LTYPE"); g(70, 1);
    g(0, "LTYPE"); g(2, "CONTINUOUS"); g(70, 0); g(3, "Durchgehend"); g(72, 65); g(73, 0); g(40, 0.0);
    g(0, "ENDTAB");
    g(0, "TABLE"); g(2, "LAYER"); g(70, 5);
    g(0, "LAYER"); g(2, "0"); g(70, 0); g(62, 7); g(6, "CONTINUOUS");
    Object.keys(FARBE).forEach(function (k) {
      g(0, "LAYER"); g(2, FARBE[k].layer); g(70, 0); g(62, FARBE[k].aci); g(6, "CONTINUOUS");
    });
    g(0, "ENDTAB");
    g(0, "ENDSEC");

    g(0, "SECTION"); g(2, "ENTITIES");
    blatt.linien.forEach(function (l) {
      var fa = FARBE[l.farbe];
      if (l.pts.length === 2 && !l.zu) {
        g(0, "LINE"); g(8, fa.layer); g(6, "CONTINUOUS"); g(62, fa.aci);
        g(10, z(l.pts[0][0])); g(20, z(l.pts[0][1])); g(30, 0);
        g(11, z(l.pts[1][0])); g(21, z(l.pts[1][1])); g(31, 0);
        return;
      }
      g(0, "POLYLINE"); g(8, fa.layer); g(6, "CONTINUOUS"); g(62, fa.aci); g(66, 1);
      g(10, 0); g(20, 0); g(30, 0); g(70, l.zu ? 1 : 0);
      l.pts.forEach(function (p) {
        g(0, "VERTEX"); g(8, fa.layer); g(10, z(p[0])); g(20, z(p[1])); g(30, 0);
      });
      g(0, "SEQEND"); g(8, fa.layer);
    });
    // gefüllte Schrift: SOLID = gefülltes Viereck
    blatt.flaechen.forEach(function (q) {
      var x = q[0], y = q[1], w = q[2], h = q[3];
      g(0, "SOLID"); g(8, FARBE.schwarz.layer); g(62, FARBE.schwarz.aci);
      g(10, z(x)); g(20, z(y)); g(30, 0);
      g(11, z(x + w)); g(21, z(y)); g(31, 0);
      g(12, z(x)); g(22, z(y + h)); g(32, 0);
      g(13, z(x + w)); g(23, z(y + h)); g(33, 0);
    });
    g(0, "ENDSEC");
    g(0, "EOF");
    return o.join("\r\n") + "\r\n";
  };

  // ---------- SVG ----------
  // Im SVG zeigt y nach unten → umdrehen, damit es wie im DXF aussieht.
  M2M.blattZuSvg = function (blatt, fuerVorschau) {
    var B = blatt.breite || 1000, H = blatt.hoehe || 600;
    var teile = [];
    var gruppen = { gelb: [], rot: [], blau: [], schwarz: [] };
    blatt.linien.forEach(function (l) {
      var d = "M" + l.pts.map(function (p) { return z(p[0]) + " " + z(H - p[1]); }).join("L") + (l.zu ? "Z" : "");
      gruppen[l.farbe].push(d);
    });
    var strich = fuerVorschau ? "0.6" : "0.01";
    ["gelb", "blau", "schwarz", "rot"].forEach(function (k) {
      if (!gruppen[k].length) return;
      // Vorschau: Gelb etwas dunkler, sonst ist es auf Weiß kaum lesbar (die Datei bleibt exakt 255,255,0)
      var farbe = fuerVorschau && k === "gelb" ? "#D4AE00" : FARBE[k].rgb;
      teile.push('<path fill="none" stroke="' + farbe + '" stroke-width="' + strich + '"' +
        (fuerVorschau ? ' vector-effect="non-scaling-stroke"' : "") + ' d="' + gruppen[k].join(" ") + '"/>');
    });
    if (blatt.flaechen.length) {
      var d = blatt.flaechen.map(function (q) {
        return "M" + z(q[0]) + " " + z(H - q[1] - q[3]) + "h" + z(q[2]) + "v" + z(q[3]) + "h-" + z(q[2]) + "Z";
      }).join("");
      teile.push('<path fill="#000000" stroke="none" d="' + d + '"/>');
    }
    var kopf = fuerVorschau
      ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 ' + (B + 20) + " " + (H + 20) + '" preserveAspectRatio="xMidYMid meet">'
      : '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="' + B + 'mm" height="' + H + 'mm" viewBox="0 0 ' + B + " " + H + '">\n<title>' +
        blatt.name.replace(/[<&>]/g, "") + "</title>\n";
    var hinter = fuerVorschau ? '<rect x="0" y="0" width="' + B + '" height="' + H + '" fill="#fff"/>' : "";
    return kopf + hinter + teile.join("\n") + "\n</svg>\n";
  };

  // ---------- ALLE Platten in EINER Datei (das ist die Laserdatei) ----------
  // Raster mit 4 Spalten. Über jeder Platte steht ihr Name („PLATTE 01 · GEBÄUDE 1/5“),
  // unten und links ist die Pappe bemaßt (z. B. 800 mm × 500 mm).
  // Überschrift und Bemaßung sind SCHWARZ (gut lesbar). Sie liegen AUSSERHALB des gelben Laserbetts,
  // landen also nicht auf der Pappe, wenn man Platte für Platte lasert.
  // platte: { b, h, x, y } = Größe und Lage der Pappe im Laserbett (mm)
  M2M.alleZusammen = function (blaetter, platte) {
    platte = platte || { b: 800, h: 500, x: 5, y: 5 };
    var SP = Math.min(4, blaetter.length), LUECKE_X = 160, LUECKE_Y = 200, B = 1000, H = 600;
    var RAND_L = 90, RAND_U = 80;   // Platz links und unten für die Bemaßung
    var zeilen = Math.ceil(blaetter.length / SP);
    var gesamtB = RAND_L + SP * B + (SP - 1) * LUECKE_X + 20, gesamtH = RAND_U + zeilen * (H + LUECKE_Y);
    var alle = { name: "Alle Platten", breite: gesamtB, hoehe: gesamtH, linien: [], flaechen: [] };
    function gelb(pts, zu) { alle.linien.push({ farbe: "schwarz", pts: pts, zu: !!zu }); } // Überschrift + Maßketten: schwarz (Wunsch des Teams, gut lesbar)
    function text(inhalt, x, y, h, drehen) {
      M2M.textLinien(inhalt, 0, 0, h).forEach(function (pts) {
        gelb(pts.map(function (p) { return drehen ? [x - p[1], y + p[0]] : [x + p[0], y + p[1]]; }));
      });
    }
    function zahl(v) { return String(Math.round(v * 10) / 10).replace(".", ","); }

    blaetter.forEach(function (b, i) {
      var sp = i % SP, ze = Math.floor(i / SP);
      var dx = RAND_L + sp * (B + LUECKE_X), dy = gesamtH - (ze + 1) * (H + LUECKE_Y) + RAND_U;
      b.linien.forEach(function (l) {
        alle.linien.push({ farbe: l.farbe, zu: l.zu, pts: l.pts.map(function (p) { return [p[0] + dx, p[1] + dy]; }) });
      });
      b.flaechen.forEach(function (q) { alle.flaechen.push([q[0] + dx, q[1] + dy, q[2], q[3]]); });

      // Überschrift über der Platte – genau der Plattenname
      var titel = M2M.gross(b.name);
      var th = Math.min(30, (B - 10) / (M2M.textBreite(titel, 1) || 1));
      text(titel, dx, dy + H + 28, th);

      // Bemaßung der Pappe: unten die Breite, links die Höhe (Maßlinie, Hilfslinien, Schrägstriche)
      var x0 = dx + platte.x, y0 = dy + platte.y, x1 = x0 + platte.b, y1 = y0 + platte.h;
      var MH = 12, ABST = 34, UEB = 6, S = 5;
      var ym = dy - ABST;                                  // Maßlinie unten
      gelb([[x0, y0 - 8], [x0, ym - UEB]]); gelb([[x1, y0 - 8], [x1, ym - UEB]]);
      gelb([[x0 - UEB, ym], [x1 + UEB, ym]]);
      gelb([[x0 - S, ym - S], [x0 + S, ym + S]]); gelb([[x1 - S, ym - S], [x1 + S, ym + S]]);
      var tb = zahl(platte.b) + " MM";
      text(tb, (x0 + x1) / 2 - M2M.textBreite(tb, MH) / 2, ym + 3, MH);
      var xm = dx - ABST;                                  // Maßlinie links
      gelb([[x0 - 8, y0], [xm - UEB, y0]]); gelb([[x0 - 8, y1], [xm - UEB, y1]]);
      gelb([[xm, y0 - UEB], [xm, y1 + UEB]]);
      gelb([[xm - S, y0 - S], [xm + S, y0 + S]]); gelb([[xm - S, y1 - S], [xm + S, y1 + S]]);
      var th2 = zahl(platte.h) + " MM";
      text(th2, xm - 3, (y0 + y1) / 2 - M2M.textBreite(th2, MH) / 2, MH, true);
    });
    return alle;
  };

  // ---------- ZIP (ohne Kompression) ----------
  var CRC_TABELLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABELLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  M2M.zip = function (dateien) { // [{ name, inhalt (Text) }]
    var enc = new TextEncoder(), teile = [], verzeichnis = [], offset = 0;
    var jetzt = new Date();
    var zeit = (jetzt.getHours() << 11) | (jetzt.getMinutes() << 5) | Math.floor(jetzt.getSeconds() / 2);
    var datum = ((jetzt.getFullYear() - 1980) << 9) | ((jetzt.getMonth() + 1) << 5) | jetzt.getDate();
    dateien.forEach(function (d) {
      var name = enc.encode(d.name), daten = typeof d.inhalt === "string" ? enc.encode(d.inhalt) : d.inhalt, crc = crc32(daten);
      var kopf = new DataView(new ArrayBuffer(30));
      kopf.setUint32(0, 0x04034b50, true); kopf.setUint16(4, 20, true); kopf.setUint16(6, 0x0800, true);
      kopf.setUint16(8, 0, true); kopf.setUint16(10, zeit, true); kopf.setUint16(12, datum, true);
      kopf.setUint32(14, crc, true); kopf.setUint32(18, daten.length, true); kopf.setUint32(22, daten.length, true);
      kopf.setUint16(26, name.length, true); kopf.setUint16(28, 0, true);
      teile.push(new Uint8Array(kopf.buffer), name, daten);

      var zentral = new DataView(new ArrayBuffer(46));
      zentral.setUint32(0, 0x02014b50, true); zentral.setUint16(4, 20, true); zentral.setUint16(6, 20, true);
      zentral.setUint16(8, 0x0800, true); zentral.setUint16(10, 0, true); zentral.setUint16(12, zeit, true);
      zentral.setUint16(14, datum, true); zentral.setUint32(16, crc, true); zentral.setUint32(20, daten.length, true);
      zentral.setUint32(24, daten.length, true); zentral.setUint16(28, name.length, true);
      zentral.setUint32(42, offset, true);
      verzeichnis.push(new Uint8Array(zentral.buffer), name);
      offset += 30 + name.length + daten.length;
    });
    var groesse = verzeichnis.reduce(function (s, a) { return s + a.length; }, 0);
    var ende = new DataView(new ArrayBuffer(22));
    ende.setUint32(0, 0x06054b50, true);
    ende.setUint16(8, dateien.length, true); ende.setUint16(10, dateien.length, true);
    ende.setUint32(12, groesse, true); ende.setUint32(16, offset, true);
    return new Blob(teile.concat(verzeichnis, [new Uint8Array(ende.buffer)]), { type: "application/zip" });
  };
})();
