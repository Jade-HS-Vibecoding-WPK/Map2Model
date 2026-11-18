/* =========================================================
   IFC-Datei schreiben (IFC2X3, Coordination View)
   Jedes Element wird ein eigenes IfcBuildingElementProxy mit
   einer Extrusion → in Revit ein einzelnes „Allgemeines Modell“,
   das man anklicken, verschieben und löschen kann.
   Zusätzlich: Farbe je Kategorie und Eigenschaften
   (Kategorie, Höhe, Höhenquelle, OSM-Herkunft).
   ========================================================= */

(function () {
  // ---------- Farben je Kategorie (Anzeige in Revit) ----------
  var FARBEN = {
    "Gelände": [0.86, 0.84, 0.79],
    "Gebäude": [0.97, 0.95, 0.91],
    "Straße":  [0.62, 0.64, 0.67],
    "Wasser":  [0.31, 0.56, 0.81],
    "Grün":    [0.45, 0.74, 0.50],
    "Baum":    [0.30, 0.62, 0.32],
    "Stamm":   [0.45, 0.33, 0.22],
    "Stahl":   [0.33, 0.45, 0.58],
    "Dach":    [0.62, 0.30, 0.24],
    "Brücke":  [0.76, 0.72, 0.64],
    "Bahn":    [0.33, 0.33, 0.37],
  };

  // ---------- Hilfen für das IFC-Textformat (STEP) ----------
  var GUID_ZEICHEN = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";
  function guid() {
    var s = GUID_ZEICHEN[Math.floor(Math.random() * 4)];
    for (var i = 0; i < 21; i++) s += GUID_ZEICHEN[Math.floor(Math.random() * 64)];
    return "'" + s + "'";
  }

  // Text in IFC: Umlaute als \X2\....\X0\ kodieren, Apostroph verdoppeln
  function text(s) {
    if (s == null) return "$";
    var aus = "";
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c === 39) aus += "''";
      else if (c === 92) aus += "\\\\";
      else if (c >= 32 && c < 127) aus += s[i];
      else aus += "\\X2\\" + ("0000" + c.toString(16).toUpperCase()).slice(-4) + "\\X0\\";
    }
    return "'" + aus + "'";
  }

  function r(x) { // Zahl im IFC-Format
    var v = Math.round(x * 1000) / 1000;
    var s = String(v);
    return s.indexOf(".") < 0 && s.indexOf("e") < 0 ? s + "." : s;
  }

  // Grad → IfcCompoundPlaneAngleMeasure (Grad, Minute, Sekunde, Millionstel)
  function winkel(grad) {
    var vz = grad < 0 ? -1 : 1, a = Math.abs(grad);
    var g = Math.floor(a), mf = (a - g) * 60, m = Math.floor(mf), sf = (mf - m) * 60, s = Math.floor(sf);
    var mio = Math.round((sf - s) * 1e6);
    return "(" + [vz * g, vz * m, vz * s, vz * mio].join(",") + ")";
  }

  // ---------- Schreiber ----------
  function Schreiber() { this.zeilen = []; this.n = 0; }
  Schreiber.prototype.add = function (inhalt) {
    this.n++;
    this.zeilen.push("#" + this.n + "=" + inhalt + ";");
    return "#" + this.n;
  };

  M2M.schreibeIfc = function (modell, info) {
    var w = new Schreiber();
    var jetzt = Math.floor(Date.now() / 1000);

    // Besitzer / Programm
    var person = w.add("IFCPERSON($,$,'',$,$,$,$,$)");
    var org = w.add("IFCORGANIZATION($,'Map2Model',$,$,$)");
    var po = w.add("IFCPERSONANDORGANIZATION(" + person + "," + org + ",$)");
    var app = w.add("IFCAPPLICATION(" + org + ",'1.0','Map2Model','Map2Model')");
    var oh = w.add("IFCOWNERHISTORY(" + po + "," + app + ",$,.ADDED.,$,$,$," + jetzt + ")");

    // Einheiten: Meter
    var u1 = w.add("IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)");
    var u2 = w.add("IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)");
    var u3 = w.add("IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)");
    var u4 = w.add("IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)");
    var einheiten = w.add("IFCUNITASSIGNMENT((" + [u1, u2, u3, u4].join(",") + "))");

    // Koordinatensystem
    var ursprung = w.add("IFCCARTESIANPOINT((0.,0.,0.))");
    var ursprung2d = w.add("IFCCARTESIANPOINT((0.,0.))");
    var achsen = w.add("IFCAXIS2PLACEMENT3D(" + ursprung + ",$,$)");
    var nord = w.add("IFCDIRECTION((0.,1.))");
    var kontext = w.add("IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05," + achsen + "," + nord + ")");
    var richtungZ = w.add("IFCDIRECTION((0.,0.,1.))");

    // Projekt → Grundstück → Gebäude → Geschoss
    var projekt = w.add("IFCPROJECT(" + guid() + "," + oh + "," + text("Map2Model " + (info.ort || "")) + "," +
      text("Erzeugt mit Map2Model aus OpenStreetMap-Daten (© OpenStreetMap-Mitwirkende, ODbL)") + ",$,$,$,(" + kontext + ")," + einheiten + ")");
    var sitePl = w.add("IFCLOCALPLACEMENT($," + achsen + ")");
    var site = w.add("IFCSITE(" + guid() + "," + oh + "," + text("Gelände") + ",$,$," + sitePl + ",$,$,.ELEMENT.," +
      winkel(modell.projektion.lat0) + "," + winkel(modell.projektion.lon0) + ",0.,$,$)");
    var gebPl = w.add("IFCLOCALPLACEMENT(" + sitePl + "," + achsen + ")");
    var gebaeude = w.add("IFCBUILDING(" + guid() + "," + oh + "," + text("Stadtmodell") + ",$,$," + gebPl + ",$,$,.ELEMENT.,$,$,$)");
    var geschossPl = w.add("IFCLOCALPLACEMENT(" + gebPl + "," + achsen + ")");
    var geschoss = w.add("IFCBUILDINGSTOREY(" + guid() + "," + oh + "," + text("Ebene 0") + ",$,$," + geschossPl + ",$,$,.ELEMENT.,0.)");
    w.add("IFCRELAGGREGATES(" + guid() + "," + oh + ",$,$," + projekt + ",(" + site + "))");
    w.add("IFCRELAGGREGATES(" + guid() + "," + oh + ",$,$," + site + ",(" + gebaeude + "))");
    w.add("IFCRELAGGREGATES(" + guid() + "," + oh + ",$,$," + gebaeude + ",(" + geschoss + "))");

    // Farben je Kategorie
    var stil = {};
    Object.keys(FARBEN).forEach(function (kat) {
      var c = FARBEN[kat];
      var farbe = w.add("IFCCOLOURRGB($," + r(c[0]) + "," + r(c[1]) + "," + r(c[2]) + ")");
      var schatt = w.add("IFCSURFACESTYLESHADING(" + farbe + ")");
      var fl = w.add("IFCSURFACESTYLE(" + text(kat) + ",.BOTH.,(" + schatt + "))");
      stil[kat] = w.add("IFCPRESENTATIONSTYLEASSIGNMENT((" + fl + "))");
    });

    // Lage einer Extrusion je Basishöhe (wiederverwenden)
    var lagen = {};
    function lage(basis) {
      var k = r(basis);
      if (!lagen[k]) {
        var p = w.add("IFCCARTESIANPOINT((0.,0.," + k + "))");
        lagen[k] = w.add("IFCAXIS2PLACEMENT3D(" + p + ",$,$)");
      }
      return lagen[k];
    }

    function polylinie(ring) {
      var pts = ring.map(function (p) { return w.add("IFCCARTESIANPOINT((" + r(p[0]) + "," + r(p[1]) + "))"); });
      pts.push(pts[0]); // geschlossen
      return w.add("IFCPOLYLINE((" + pts.join(",") + "))");
    }

    // ---------- Körper aus Dreiecken/Vierecken (für Bäume) ----------
    // ecken: [[x,y,z], ...], flaechen: [[i, j, k, ...], ...] gegen den Uhrzeigersinn von außen gesehen
    function brep(ecken, flaechen) {
      var p = ecken.map(function (e) { return w.add("IFCCARTESIANPOINT((" + r(e[0]) + "," + r(e[1]) + "," + r(e[2]) + "))"); });
      var faces = flaechen.map(function (f) {
        var schleife = w.add("IFCPOLYLOOP((" + f.map(function (i) { return p[i]; }).join(",") + "))");
        var rand = w.add("IFCFACEOUTERBOUND(" + schleife + ",.T.)");
        return w.add("IFCFACE((" + rand + "))");
      });
      var huelle = w.add("IFCCLOSEDSHELL((" + faces.join(",") + "))");
      return w.add("IFCFACETEDBREP(" + huelle + ")");
    }

    // Stamm: achteckiges Prisma
    function stamm(x, y, radius, hoehe) {
      var n = 8, e = [], f = [];
      for (var i = 0; i < n; i++) {
        var a = 2 * Math.PI * i / n;
        e.push([x + radius * Math.cos(a), y + radius * Math.sin(a), 0]);
        e.push([x + radius * Math.cos(a), y + radius * Math.sin(a), hoehe]);
      }
      var unten = [], oben = [];
      for (var k = 0; k < n; k++) { unten.push(2 * (n - 1 - k)); oben.push(2 * k + 1); }
      f.push(unten, oben);
      for (var j = 0; j < n; j++) {
        var a0 = 2 * j, a1 = 2 * ((j + 1) % n);
        f.push([a0, a1, a1 + 1, a0 + 1]);
      }
      return brep(e, f);
    }

    // Krone: Kugel/Ellipsoid aus Vierecken (8 Teile rundherum, 6 Ringe)
    function krone(x, y, zMitte, rx, rz) {
      var n = 8, ringe = 6, e = [[x, y, zMitte - rz]], f = [];
      for (var k = 1; k < ringe; k++) {
        var phi = Math.PI * k / ringe - Math.PI / 2;
        for (var i = 0; i < n; i++) {
          var a = 2 * Math.PI * i / n;
          e.push([x + rx * Math.cos(phi) * Math.cos(a), y + rx * Math.cos(phi) * Math.sin(a), zMitte + rz * Math.sin(phi)]);
        }
      }
      e.push([x, y, zMitte + rz]);
      var oben = e.length - 1;
      function idx(ring, i) { return 1 + (ring - 1) * n + (i % n); }
      for (var i2 = 0; i2 < n; i2++) f.push([0, idx(1, i2 + 1), idx(1, i2)]);
      for (var k2 = 1; k2 < ringe - 1; k2++) {
        for (var j = 0; j < n; j++) f.push([idx(k2, j), idx(k2, j + 1), idx(k2 + 1, j + 1), idx(k2 + 1, j)]);
      }
      for (var i3 = 0; i3 < n; i3++) f.push([idx(ringe - 1, i3), idx(ringe - 1, i3 + 1), oben]);
      return brep(e, f);
    }

    // Stahlstab von Punkt a nach Punkt b mit rechteckigem Querschnitt (d1 × d2)
    var mitteProfil2d = w.add("IFCAXIS2PLACEMENT2D(" + ursprung2d + ",$)");
    var stabProfile = {};
    function stahlStab(a, b, d1, d2) {
      var dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      var L = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (L < 0.01) return null;
      var ax = [dx / L, dy / L, dz / L];
      // eine Richtung quer zum Stab
      var ref = Math.abs(ax[2]) > 0.9 ? [1, 0, 0] : [-ax[1], ax[0], 0];
      var lr = Math.hypot(ref[0], ref[1], ref[2]); ref = [ref[0] / lr, ref[1] / lr, ref[2] / lr];
      var key = r(d1) + "x" + r(d2);
      if (!stabProfile[key]) stabProfile[key] = w.add("IFCRECTANGLEPROFILEDEF(.AREA.,$," + mitteProfil2d + "," + r(d1) + "," + r(d2) + ")");
      var p = w.add("IFCCARTESIANPOINT((" + r(a[0]) + "," + r(a[1]) + "," + r(a[2]) + "))");
      var achse = w.add("IFCDIRECTION((" + ax.map(function (v) { return (Math.round(v * 1e6) / 1e6).toString().replace(/^(-?\d+)$/, "$1."); }).join(",") + "))");
      var quer = w.add("IFCDIRECTION((" + ref.map(function (v) { return (Math.round(v * 1e6) / 1e6).toString().replace(/^(-?\d+)$/, "$1."); }).join(",") + "))");
      var pl = w.add("IFCAXIS2PLACEMENT3D(" + p + "," + achse + "," + quer + ")");
      return w.add("IFCEXTRUDEDAREASOLID(" + stabProfile[key] + "," + pl + "," + richtungZ + "," + r(L) + ")");
    }

    var bauteile = [];
    modell.daecher = { sattel: 0, flach: 0 };
    modell.elemente.forEach(function (e) {
      var profil;
      // Satteldach: Wände bis zur Traufe + Dach als zwei Körper
      if (info.dachform === "sattel" && e.kategorie === "Gebäude" && M2M.satteldach) {
        var sd = M2M.satteldach(e);
        if (sd && sd.dach) {
          modell.daecher.sattel++;
          var wk = brep(sd.waende.ecken, sd.waende.flaechen);
          var dk = brep(sd.dach.ecken, sd.dach.flaechen);
          w.add("IFCSTYLEDITEM(" + wk + ",(" + stil["Gebäude"] + "),$)");
          w.add("IFCSTYLEDITEM(" + dk + ",(" + stil["Dach"] + "),$)");
          e.dachInfo = "Satteldach (Traufe " + sd.traufe.toFixed(1) + " m, First " + sd.first.toFixed(1) + " m)";
          var darstD = w.add("IFCSHAPEREPRESENTATION(" + kontext + ",'Body','Brep',(" + wk + "," + dk + "))");
          return fuegeHinzu(e, darstD);
        }
        modell.daecher.flach++;
        e.dachInfo = "Flachdach (" + ((sd && sd.grund) || "—") + ")";
      }
      if (e.kreis) {
        // Baum: Stamm + runde Krone
        var h = e.hoehe, kr = e.kreis.r;
        var stammH = h * 0.4, kroneRz = Math.max(h * 0.32, kr * 0.9);
        var s1 = stamm(e.kreis.x, e.kreis.y, Math.max(0.15, kr * 0.08), stammH + kroneRz * 0.3);
        var s2 = krone(e.kreis.x, e.kreis.y, stammH + kroneRz, kr, kroneRz);
        w.add("IFCSTYLEDITEM(" + s1 + ",(" + stil["Stamm"] + "),$)");
        w.add("IFCSTYLEDITEM(" + s2 + ",(" + stil["Baum"] + "),$)");
        var darstB = w.add("IFCSHAPEREPRESENTATION(" + kontext + ",'Body','Brep',(" + s1 + "," + s2 + "))");
        return fuegeHinzu(e, darstB);
      } else if (e.innen && e.innen.length) {
        profil = w.add("IFCARBITRARYPROFILEDEFWITHVOIDS(.AREA.,$," + polylinie(e.aussen) + ",(" +
          e.innen.map(polylinie).join(",") + "))");
      } else {
        profil = w.add("IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$," + polylinie(e.aussen) + ")");
      }

      var koerper = w.add("IFCEXTRUDEDAREASOLID(" + profil + "," + lage(e.basis) + "," + richtungZ + "," + r(Math.max(e.hoehe, 0.01)) + ")");
      if (stil[e.kategorie]) w.add("IFCSTYLEDITEM(" + koerper + ",(" + stil[e.kategorie] + "),$)");
      var teile = [koerper];
      // Stahlkonstruktion (Sondermodell Brücke): jeder Stab ein eigener Körper
      if (e.stahl) e.stahl.forEach(function (s) {
        var k = stahlStab(s[0], s[1], s[2], s[3]);
        if (k) { w.add("IFCSTYLEDITEM(" + k + ",(" + stil["Stahl"] + "),$)"); teile.push(k); }
      });
      var darst = w.add("IFCSHAPEREPRESENTATION(" + kontext + ",'Body','SweptSolid',(" + teile.join(",") + "))");
      fuegeHinzu(e, darst);
    });

    // Element (Allgemeines Modell) mit Lage, Form und Eigenschaften anlegen
    function fuegeHinzu(e, darst) {
      var form = w.add("IFCPRODUCTDEFINITIONSHAPE($,$,(" + darst + "))");
      var pl3 = w.add("IFCLOCALPLACEMENT(" + geschossPl + "," + achsen + ")");
      var teil = w.add("IFCBUILDINGELEMENTPROXY(" + guid() + "," + oh + "," + text(e.name) + "," +
        text("OSM " + e.osm) + "," + text(e.kategorie) + "," + pl3 + "," + form + "," + text(String(e.nummer)) + ",.ELEMENT.)");
      bauteile.push(teil);

      // Eigenschaften (Map2Model)
      var props = [
        w.add("IFCPROPERTYSINGLEVALUE('Kategorie',$,IFCLABEL(" + text(e.kategorie) + "),$)"),
        w.add("IFCPROPERTYSINGLEVALUE('Nummer',$,IFCINTEGER(" + e.nummer + "),$)"),
        w.add("IFCPROPERTYSINGLEVALUE(" + text("Höhe") + ",$,IFCLENGTHMEASURE(" + r(e.hoehe) + "),$)"),
        w.add("IFCPROPERTYSINGLEVALUE(" + text("Höhenquelle") + ",$,IFCLABEL(" + text(e.quelle || "") + "),$)"),
        w.add("IFCPROPERTYSINGLEVALUE('Herkunft',$,IFCLABEL(" + text("OpenStreetMap " + e.osm) + "),$)"),
      ];
      if (e.dachInfo) props.push(w.add("IFCPROPERTYSINGLEVALUE('Dach',$,IFCLABEL(" + text(e.dachInfo) + "),$)"));
      var pset = w.add("IFCPROPERTYSET(" + guid() + "," + oh + ",'Map2Model',$,(" + props.join(",") + "))");
      w.add("IFCRELDEFINESBYPROPERTIES(" + guid() + "," + oh + ",$,$,(" + teil + ")," + pset + ")");
    }

    if (bauteile.length) {
      w.add("IFCRELCONTAINEDINSPATIALSTRUCTURE(" + guid() + "," + oh + ",$,$,(" + bauteile.join(",") + ")," + geschoss + ")");
    }

    var datum = new Date().toISOString().slice(0, 19);
    var kopf = [
      "ISO-10303-21;",
      "HEADER;",
      "FILE_DESCRIPTION(('ViewDefinition [CoordinationView_V2.0]'),'2;1');",
      "FILE_NAME(" + text(info.dateiname || "map2model.ifc") + ",'" + datum + "',(''),('Map2Model'),'Map2Model','Map2Model','');",
      "FILE_SCHEMA(('IFC2X3'));",
      "ENDSEC;",
      "DATA;",
    ];
    return kopf.concat(w.zeilen, ["ENDSEC;", "END-ISO-10303-21;", ""]).join("\n");
  };
})();
