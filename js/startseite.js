/* =========================================================
   Startseite: 3D-Architekturmodell, das sich selbst zusammensetzt
   Wie ein echtes Lasermodell aus Finnpappe: Wasserplatte,
   Straßenboden, Baublöcke, Blockrand mit Innenhöfen, Zeilen,
   Hochpunkte, Park mit Bäumen, Brücke – und der Neubau in Rot.
   Jede Pappschicht ist ein eigenes Teil mit feiner Kante.

   Ablauf (Schleife): Teile fallen nacheinander herein →
   kurz stehen → Explosionsansicht (Schichten schweben auseinander)
   → wieder zusammen → stehen → nach oben weg → von vorn.
   Die Kamera dreht sich langsam um das Modell.
   Bibliothek: three.js r128 (cdnjs), wird nur hier geladen.
   Geht 3D nicht: die einfache SVG-Grafik (startseite-svg.js).
   ========================================================= */

(function () {
  var huelle = document.querySelector(".start-grafik");
  var svg = document.getElementById("start-grafik");
  if (!huelle) return;

  function ersatz() { if (M2M.startSvg) M2M.startSvg(); }

  function hatWebgl() {
    try { var c = document.createElement("canvas"); return !!(c.getContext("webgl") || c.getContext("experimental-webgl")); }
    catch (e) { return false; }
  }
  if (!hatWebgl()) { ersatz(); return; }

  var skript = document.createElement("script");
  skript.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
  skript.onload = function () { try { baue(window.THREE); } catch (e) { console.warn(e); ersatz(); } };
  skript.onerror = ersatz;
  document.head.appendChild(skript);

  function baue(THREE) {
    if (svg) svg.style.display = "none";
    var flaeche = document.createElement("div");
    flaeche.className = "start-3d";
    huelle.appendChild(flaeche);

    // ---------- Bühne ----------
    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    flaeche.appendChild(renderer.domElement);

    var szene = new THREE.Scene();
    var kamera = new THREE.PerspectiveCamera(26, 1.5, 1, 2000);

    szene.add(new THREE.HemisphereLight(0xffffff, 0xcfc6b4, 0.62));
    var sonne = new THREE.DirectionalLight(0xffffff, 0.78);
    sonne.position.set(-70, 130, 50);
    sonne.castShadow = true;
    sonne.shadow.mapSize.set(2048, 2048);
    sonne.shadow.camera.left = -110; sonne.shadow.camera.right = 110;
    sonne.shadow.camera.top = 110; sonne.shadow.camera.bottom = -110;
    sonne.shadow.camera.near = 10; sonne.shadow.camera.far = 400;
    sonne.shadow.bias = -0.0006;
    szene.add(sonne);
    var gegen = new THREE.DirectionalLight(0xfff4ea, 0.22);
    gegen.position.set(80, 60, -60);
    szene.add(gegen);

    // Schatten auf dem „Tisch“
    var boden = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.ShadowMaterial({ opacity: 0.16 }));
    boden.rotation.x = -Math.PI / 2;
    boden.position.y = -0.02;
    boden.receiveShadow = true;
    szene.add(boden);

    var modell = new THREE.Group();
    szene.add(modell);

    // ---------- Farben (Finnpappe, Grau, Wasser, Neubau) ----------
    var FARBE = {
      wasser: 0xa7bccb, strasse: 0xd6d2c8, pappe: 0xeee7d8, haus: 0xf8f6f1,
      neu: 0xc8102e, gruen: 0xc6d6b2, baum: 0xb9cfa3, bruecke: 0xe6dfcf, sockel: 0x6e7378, // Grau
    };
    var KANTE = 0x6f6656;
    function lin(hex) { return new THREE.Color(hex).convertSRGBToLinear(); } // Farben wie am Bildschirm gemeint

    // ---------- Teile ----------
    var B = 160, T = 112, D = 1.2, L = 1.3;   // Platte, Pappstärke, Schichthöhe Gebäude
    var teile = [];                           // { obj, mats, y, start, ebene }

    function formAus(pts, loecher) {
      var s = new THREE.Shape(pts.map(function (p) { return new THREE.Vector2(p[0], -p[1]); }));
      (loecher || []).forEach(function (l) { s.holes.push(new THREE.Path(l.map(function (p) { return new THREE.Vector2(p[0], -p[1]); }))); });
      return s;
    }
    function rechteck(x0, z0, x1, z1) { return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]; }

    // ein Teil aus einer fertigen Geometrie (mit feiner Kante), das später hereinfällt
    function teil(geo, farbe, y, start, ebene, kante, ohneKante) {
      var mat = new THREE.MeshStandardMaterial({ color: lin(farbe), roughness: 0.9, metalness: 0 });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      var g = new THREE.Group();
      g.add(mesh);
      var mats = [mat], opak = 1;
      if (!ohneKante) {
        var kmat = new THREE.LineBasicMaterial({ color: lin(KANTE), transparent: true, opacity: kante || 0.3 });
        g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), kmat));
        mats.push(kmat); opak = kmat.opacity;
      }
      g.position.y = y;
      g.visible = false;
      modell.add(g);
      var tl = { obj: g, mats: mats, kanteOpak: opak, y: y, start: start, ebene: ebene };
      teile.push(tl);
      return tl;
    }
    // eine Pappschicht: Grundriss nach oben extrudiert
    function schicht(pts, loecher, dicke, farbe, y, start, ebene, kante) {
      var geo = new THREE.ExtrudeGeometry(formAus(pts, loecher), { depth: dicke, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      return teil(geo, farbe, y, start, ebene, kante);
    }

    // Zufall mit festem Startwert → jedes Mal dasselbe Modell
    var saat = 11;
    function zufall() { saat = (saat * 16807) % 2147483647; return (saat - 1) / 2147483646; }
    function ganz(a, b) { return a + Math.floor(zufall() * (b - a + 1)); }

    // ---------- Sockel, Wasser, Land, Baublöcke ----------
    var sockelGeo = new THREE.BoxGeometry(B + 8, 5, T + 8);
    sockelGeo.translate(B / 2, -2.5, T / 2);
    teil(sockelGeo, FARBE.sockel, 0, 0, 0, 0.0, true);

    var KAI = 92;                                          // ab hier Wasser (vorne)
    var BECKEN = [104, 74, 146, KAI];                      // Hafenbecken
    var land = [[0, 0], [B, 0], [B, KAI], [BECKEN[2], KAI], [BECKEN[2], BECKEN[1]], [BECKEN[0], BECKEN[1]], [BECKEN[0], KAI], [0, KAI]];
    schicht(rechteck(0, 0, B, T), null, D, FARBE.wasser, 0, 250, 1);
    schicht(land, null, D, FARBE.strasse, D, 450, 2);

    var bloecke = {
      A1: [2, 2, 36, 30], A2: [42, 2, 78, 30], A3: [84, 2, 120, 30], A4: [126, 2, 158, 30],
      B1: [2, 36, 36, 64], B2: [42, 36, 78, 64], B3: [84, 36, 120, 64], B4: [126, 36, 158, 64],
      C1: [2, 70, 36, 88], C2: [42, 70, 78, 88], C3: [84, 70, 100, 88], C4: [150, 70, 158, 88],
    };
    Object.keys(bloecke).forEach(function (k, i) {
      var b = bloecke[k];
      schicht(rechteck(b[0], b[1], b[2], b[3]), null, D, FARBE.pappe, 2 * D, 650 + i * 45, 3);
    });

    var Y0 = 3 * D;      // Oberkante der Baublöcke
    var BAU = 1250;      // ab hier wachsen die Gebäude
    var JE = 95;         // Abstand zwischen zwei Schichten
    var spaetestens = 0;

    // Gebäude aus Schichten. Start als Welle von hinten links nach vorne rechts.
    function gebaeude(pts, schichten, farbe, ab, loecher) {
      var xs = pts.map(function (p) { return p[0]; }), zs = pts.map(function (p) { return p[1]; });
      var welle = (Math.min.apply(null, xs) + Math.min.apply(null, zs)) * 5;
      for (var k = ab || 0; k < schichten; k++) {
        var st = BAU + welle + k * JE;
        schicht(pts, loecher, L, farbe, Y0 + k * L, st, 4 + k, 0.24);
        spaetestens = Math.max(spaetestens, st);
      }
      return Y0 + schichten * L;
    }
    function quader(x0, z0, x1, z1, schichten, farbe, ab) { return gebaeude(rechteck(x0, z0, x1, z1), schichten, farbe, ab); }

    // Satteldach als Prisma; First entlang der längeren Seite
    function dach(x0, z0, x1, z1, y, h, farbe, start, ebene) {
      var entlangX = (x1 - x0) >= (z1 - z0);
      var quer = entlangX ? z1 - z0 : x1 - x0, laenge = entlangX ? x1 - x0 : z1 - z0;
      var s = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(quer, 0), new THREE.Vector2(quer / 2, h)]);
      var geo = new THREE.ExtrudeGeometry(s, { depth: laenge, bevelEnabled: false });
      if (entlangX) { geo.rotateY(Math.PI / 2); geo.translate(x0, 0, z1); }
      else geo.translate(x0, 0, z0);
      teil(geo, farbe, y, start, ebene, 0.3);
    }

    // --- Bautypen ---
    function blockrand(b, hoehen, eckturm) {
      var t = 8, x0 = b[0] + 1.5, z0 = b[1] + 1.5, x1 = b[2] - 1.5, z1 = b[3] - 1.5;
      quader(x0, z0, x1, z0 + t, hoehen[0], FARBE.haus);
      quader(x0, z1 - t, x1, z1, hoehen[1], FARBE.haus);
      quader(x0, z0 + t, x0 + t, z1 - t, hoehen[2], FARBE.haus);
      quader(x1 - t, z0 + t, x1, z1 - t, hoehen[3], FARBE.haus);
      if (eckturm) quader(x1 - t, z0, x1, z0 + t, eckturm, FARBE.haus, hoehen[0]);
    }
    function zeilen(b, anzahl) {
      var tiefe = 6.5, frei = (b[3] - b[1] - 3 - anzahl * tiefe) / Math.max(1, anzahl - 1);
      for (var i = 0; i < anzahl; i++) {
        var z0 = b[1] + 1.5 + i * (tiefe + frei), mitte = b[0] + 1.5 + (b[2] - b[0] - 3) * (0.4 + zufall() * 0.2);
        quader(b[0] + 1.5, z0, mitte - 0.6, z0 + tiefe, ganz(3, 6), FARBE.haus);
        quader(mitte + 0.6, z0, b[2] - 1.5, z0 + tiefe, ganz(4, 8), FARBE.haus);
      }
    }
    function reihenhaeuser(b) {
      var breite = 5.2;
      [[b[1] + 1.5, b[1] + 9], [b[3] - 9, b[3] - 1.5]].forEach(function (zz, reihe) {
        for (var x = b[0] + 1.5; x + breite <= b[2] - 1.5 + 0.01; x += breite + 0.5) {
          var n = ganz(2, 3), y = quader(x, zz[0], x + breite, zz[1], n, FARBE.haus);
          var st = BAU + (x + zz[0]) * 5 + n * JE + 120;
          dach(x, zz[0], x + breite, zz[1], y, 3.2, FARBE.haus, st, 4 + n);
          spaetestens = Math.max(spaetestens, st);
        }
      });
    }
    function hochpunkte(b) {
      var sockelH = quader(b[0] + 1.5, b[1] + 1.5, b[2] - 1.5, b[3] - 1.5, 2, FARBE.haus);
      var w = (b[2] - b[0] - 9) / 2;
      quader(b[0] + 3, b[1] + 3, b[0] + 3 + w, b[1] + 3 + w * 0.9, 16, FARBE.haus, 2);
      quader(b[2] - 3 - w * 0.8, b[3] - 3 - w, b[2] - 3, b[3] - 3, 11, FARBE.haus, 2);
      return sockelH;
    }
    function park(b, startZeit) {
      schicht(rechteck(b[0] + 1.5, b[1] + 1.5, b[2] - 1.5, b[3] - 1.5), [rechteck(b[0] + 13, b[1] + 11, b[2] - 13, b[3] - 11)], 0.5, FARBE.gruen, Y0, startZeit, 4);
      for (var i = 0; i < 18; i++) {
        var x = b[0] + 4 + zufall() * (b[2] - b[0] - 8), z = b[1] + 4 + zufall() * (b[3] - b[1] - 8);
        if (x > b[0] + 11 && x < b[2] - 11 && z > b[1] + 9 && z < b[3] - 9) continue;
        baeume.push([x, z, 1.3 + zufall() * 1.1, Y0 + 0.5]);
      }
    }

    var baeume = [];

    // Reihe A (hinten)
    blockrand(bloecke.A1, [5, 4, 3, 6], 9);
    zeilen(bloecke.A2, 3);
    park(bloecke.A3, 1150);
    hochpunkte(bloecke.A4);
    // Reihe B (Mitte)
    reihenhaeuser(bloecke.B1);
    // NEUBAU (rot): gestaffelt mit Dachterrassen, ein Flügel, ein Hochpunkt
    var b2 = bloecke.B2;
    gebaeude([[b2[0] + 1.5, b2[1] + 1.5], [b2[2] - 1.5, b2[1] + 1.5], [b2[2] - 1.5, b2[1] + 11], [b2[0] + 12, b2[1] + 11], [b2[0] + 12, b2[3] - 1.5], [b2[0] + 1.5, b2[3] - 1.5]], 4, FARBE.neu);
    quader(b2[0] + 1.5, b2[1] + 1.5, b2[0] + 12, b2[1] + 11, 9, FARBE.neu, 4);
    quader(b2[0] + 1.5, b2[1] + 1.5, b2[0] + 7, b2[1] + 7, 13, FARBE.neu, 9);
    quader(b2[2] - 13, b2[3] - 13, b2[2] - 1.5, b2[3] - 1.5, 6, FARBE.neu);
    blockrand(bloecke.B3, [6, 5, 5, 4], 0);
    reihenhaeuser(bloecke.B4);
    // Reihe C (am Wasser)
    zeilen(bloecke.C1, 2);
    quader(bloecke.C2[0] + 1.5, bloecke.C2[1] + 1.5, bloecke.C2[2] - 1.5, bloecke.C2[3] - 1.5, 2, FARBE.haus);
    quader(bloecke.C2[2] - 13, bloecke.C2[1] + 2.5, bloecke.C2[2] - 3, bloecke.C2[3] - 2.5, 20, FARBE.haus, 2);
    quader(bloecke.C3[0] + 1.5, bloecke.C3[1] + 1.5, bloecke.C3[2] - 1.5, bloecke.C3[3] - 1.5, 4, FARBE.haus);
    quader(bloecke.C4[0] + 1, bloecke.C4[1] + 1.5, bloecke.C4[2] - 1, bloecke.C4[3] - 1.5, 3, FARBE.haus);

    // Baumreihe an der Promenade und an der großen Straße
    for (var px = 3; px < BECKEN[0] - 2; px += 5.5) baeume.push([px, 90, 1.05, 2 * D]);
    for (var pz = 4; pz < 88; pz += 6) if (pz < 30 || pz > 36) baeume.push([81, pz, 1.0, 2 * D]);

    // ---------- Bogenbrücke über das Hafenbecken (wie die Kaiser-Wilhelm-Brücke) ----------
    var BR = spaetestens * 0.55 + 600;
    var bz0 = 79, bz1 = 85, bx0 = BECKEN[0] - 3, bx1 = BECKEN[2] + 3, deckY = 2 * D + 1.4;
    schicht(rechteck(bx0, bz0, bx1, bz1), null, 0.7, FARBE.bruecke, deckY, BR, 3);
    [bz0 + 0.3, bz1 - 0.3].forEach(function (zb, i) {
      var bogen = new THREE.QuadraticBezierCurve3(new THREE.Vector3(BECKEN[0] - 1, deckY + 0.7, zb), new THREE.Vector3((BECKEN[0] + BECKEN[2]) / 2, deckY + 22, zb), new THREE.Vector3(BECKEN[2] + 1, deckY + 0.7, zb));
      teil(new THREE.TubeGeometry(bogen, 48, 0.32, 6, false), FARBE.bruecke, 0, BR + 250 + i * 120, 4, 0, true);
      // Hänger
      var stangen = new THREE.BufferGeometry(), pts = [];
      for (var s = 1; s < 12; s++) {
        var p = bogen.getPoint(s / 12);
        pts.push(p.x, deckY + 0.7, zb, p.x, p.y, zb);
      }
      stangen.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      var lmat = new THREE.LineBasicMaterial({ color: lin(0x8c8476), transparent: true, opacity: 0.7 });
      var lg = new THREE.Group(); lg.add(new THREE.LineSegments(stangen, lmat)); lg.visible = false; modell.add(lg);
      teile.push({ obj: lg, mats: [lmat], kanteOpak: 0.7, y: 0, start: BR + 520 + i * 120, ebene: 4, nurLinie: true });
    });

    // ---------- Bäume: kleine Kugeln (wie im Modellbau) ----------
    var baumGeo = new THREE.IcosahedronGeometry(1, 1);
    var BAEUME = spaetestens + 500;
    baeume.forEach(function (b, i) {
      var mat = new THREE.MeshStandardMaterial({ color: lin(FARBE.baum), roughness: 0.95 });
      var m = new THREE.Mesh(baumGeo, mat);
      m.scale.setScalar(b[2]);
      m.position.set(b[0], b[2], b[1]);
      m.castShadow = true;
      var g = new THREE.Group();
      g.add(m);
      g.position.y = b[3];
      g.visible = false;
      modell.add(g);
      teile.push({ obj: g, mats: [mat], kanteOpak: 1, y: b[3], start: BAEUME + i * 18, ebene: 4, baum: m, r: b[2] });
    });

    modell.position.set(-B / 2, 0, -T / 2);

    // ---------- Zeitablauf ----------
    var FALL = 34, DAUER = 700;
    var AUFBAU = BAEUME + baeume.length * 18 + 900;
    var PHASEN = {
      stehen1: AUFBAU, auf: AUFBAU + 2600, offen: AUFBAU + 4100, zu: AUFBAU + 6600,
      stehen2: AUFBAU + 8100, weg: AUFBAU + 11100, ende: AUFBAU + 12400,
    };
    function sanft(t) { return 1 - Math.pow(1 - t, 3); }
    function weich(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function klemme(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
    function deckkraft(tl, a) {
      var trans = a < 0.999;
      tl.mats.forEach(function (m, i) {
        m.transparent = trans || i > 0;
        m.opacity = i > 0 ? tl.kanteOpak * a : a;
      });
    }

    function stelle(t) {
      var offen = 0;
      if (t >= PHASEN.auf && t < PHASEN.offen) offen = weich((t - PHASEN.auf) / 1500);
      else if (t >= PHASEN.offen && t < PHASEN.zu) offen = 1;
      else if (t >= PHASEN.zu && t < PHASEN.stehen2) offen = 1 - weich((t - PHASEN.zu) / 1500);
      var weg = t >= PHASEN.weg ? klemme((t - PHASEN.weg) / 1100) : 0;

      teile.forEach(function (tl, i) {
        var u = klemme((t - tl.start) / DAUER);
        if (u <= 0) { tl.obj.visible = false; return; }
        tl.obj.visible = true;
        var e = sanft(u);
        var y = tl.y + (1 - e) * FALL + offen * tl.ebene * 0.85;
        var a = Math.min(1, u * 2.2);
        if (weg > 0) {
          var w = klemme(weg * 1.6 - (1 - i / teile.length) * 0.6);
          y += w * w * 40;
          a *= 1 - w;
        }
        tl.obj.position.y = y;
        if (tl.baum) tl.baum.scale.setScalar(tl.r * (0.2 + 0.8 * e));
        deckkraft(tl, a);
      });
    }

    // ---------- Kamera: langsame Drehung ----------
    var ZIEL = new THREE.Vector3(0, 6, 0);
    var NEIGUNG = 0.5;          // Höhe der Kamera im Verhältnis zum Abstand
    var abstand = 260;
    function kameraStellen(zeit, r) {
      var w = -0.75 + zeit * (2 * Math.PI / 60000);   // eine Runde pro Minute
      r = r || abstand;
      kamera.position.set(Math.sin(w) * r, ZIEL.y + r * NEIGUNG, Math.cos(w) * r);
      kamera.lookAt(ZIEL);
    }
    // Abstand so wählen, dass das ganze Modell (auch in der Explosionsansicht) bei JEDEM Drehwinkel ins Bild passt
    function passeAbstand() {
      var ecken = [];
      [-B / 2 - 4, B / 2 + 4].forEach(function (x) { [-T / 2 - 4, T / 2 + 4].forEach(function (z) { [-5, 38].forEach(function (y) { ecken.push(new THREE.Vector3(x, y, z)); }); }); });
      var groesst = 0;
      for (var i = 0; i < 48; i++) {
        kameraStellen(i * 60000 / 48 + 0.75 * 60000 / (2 * Math.PI), 800);
        kamera.updateMatrixWorld();
        ecken.forEach(function (p) {
          var q = p.clone().project(kamera);
          groesst = Math.max(groesst, Math.abs(q.x), Math.abs(q.y));
        });
      }
      // aus großer Entfernung messen (Kamera sicher außerhalb), linear hochrechnen, dann 3× nachschärfen
      abstand = 800 * groesst / 0.98;
      for (var k = 0; k < 3; k++) {
        var g2 = 0;
        for (var j = 0; j < 48; j++) {
          kameraStellen(j * 60000 / 48 + 0.75 * 60000 / (2 * Math.PI), abstand);
          kamera.updateMatrixWorld();
          ecken.forEach(function (p) { var q = p.clone().project(kamera); g2 = Math.max(g2, Math.abs(q.x), Math.abs(q.y)); });
        }
        abstand *= Math.pow(g2 / 0.98, 0.9);
      }
    }

    function groesse() {
      var b = huelle.clientWidth || 640;
      var h = Math.min(b * 0.7, window.innerHeight * 0.56);
      renderer.setSize(b, h);
      kamera.aspect = b / h;
      kamera.updateProjectionMatrix();
      passeAbstand();
    }
    window.addEventListener("resize", groesse);
    groesse();

    // ---------- Schleife (läuft nur, wenn die Startseite sichtbar ist) ----------
    var start = document.getElementById("start");
    var t0 = performance.now(), laeuft = false;
    // Standbild für Poster/Screenshots: ?standbild=1 (fertig) oder ?standbild=offen (Explosionsansicht),
    // optional &winkel=… (Grad) für die Blickrichtung
    var such = new URLSearchParams(location.search), STAND = such.get("standbild");
    var WINKEL = such.get("winkel") != null ? (parseFloat(such.get("winkel")) * Math.PI / 180 + 0.75) * 60000 / (2 * Math.PI) : 0;
    function bild(jetzt) {
      if (!laeuft) return;
      var t = (jetzt - t0) % PHASEN.ende;
      if (STAND) { t = STAND === "offen" ? PHASEN.offen + 500 : PHASEN.stehen1 + 500; jetzt = WINKEL; }
      stelle(t);
      kameraStellen(jetzt);
      renderer.render(szene, kamera);
      requestAnimationFrame(bild);
    }
    function pruefe() {
      var sichtbar = start && !start.hidden;
      if (sichtbar && !laeuft) { laeuft = true; t0 = performance.now(); groesse(); requestAnimationFrame(bild); }
      if (!sichtbar) laeuft = false;
    }
    window.addEventListener("hashchange", function () { setTimeout(pruefe, 0); });
    // Startseite wird ein-/ausgeblendet → sofort reagieren (auch wenn three.js schneller geladen war)
    if (start && window.MutationObserver) new MutationObserver(pruefe).observe(start, { attributes: true, attributeFilter: ["hidden"] });
    pruefe();
  }
})();
