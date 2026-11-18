/* =========================================================
   Sondermodell: Kaiser-Wilhelm-Brücke (Wilhelmshaven)
   Vereinfachte Stahlkonstruktion nach öffentlich bekannten Daten
   (Wikipedia: Länge 159 m, Breite 8 m, Pfeilerabstand 80 m,
   Stützen ca. 20,4 m hoch) und frei lizenzierten Fotos.
   NICHT maßgenau – Bogenform und Stäbe sind nachempfunden.

   Aufbau je Flügel (zwei Flügel, spiegelbildlich):
   - Stahlportal über dem Drehpfeiler (2 Pfosten + Riegel + Kreuz)
   - gebogene Obergurte von der Portalspitze zu beiden Flügelenden
   - Untergurte entlang der Fahrbahn
   - Hänger und Diagonalen (Fachwerk)
   ========================================================= */

(function () {
  var LAENGE = 159, BREITE = 8, PFEILER = 80;
  var DECK_UNTEN = 2.0, DECK_DICKE = 0.8;          // gleiche Höhe wie die anderen Brücken in der Datei
  var DECK_OBEN = DECK_UNTEN + DECK_DICKE;
  var GURT_H = 1.2;                                 // Höhe des Untergurts über der Fahrbahn
  var PORTAL_OBEN = DECK_OBEN + 17.5;               // ≈ 20 m über dem Wasser
  var FELD = 4;                                     // Abstand der Hänger in m

  // Wikipedia-Koordinate der Brückenmitte
  M2M.KW_BRUECKE = { lat: 53.51361, lon: 8.13528, name: /kaiser[- ]wilhelm[- ]br(ü|ue)cke/i };

  // mitte: [x, y] in Metern, achse: Einheitsvektor [ax, ay] entlang der Brücke
  M2M.baueKwBruecke = function (mitte, achse) {
    var ax = achse[0], ay = achse[1], nx = -ay, ny = ax;
    // Brückenkoordinaten (u entlang, v quer, z hoch) → Modellkoordinaten
    function P(u, v, z) { return [mitte[0] + u * ax + v * nx, mitte[1] + u * ay + v * ny, z]; }

    var staebe = []; // [punkt1, punkt2, breite, hoehe]
    function stab(a, b, d1, d2) { staebe.push([a, b, d1, d2 || d1]); }

    var hL = LAENGE / 2, hB = BREITE / 2;

    // Untergurte (Fachwerkträger an beiden Seiten der Fahrbahn)
    [-hB, hB].forEach(function (v) {
      stab(P(-hL, v, DECK_OBEN + GURT_H / 2), P(hL, v, DECK_OBEN + GURT_H / 2), 0.35, GURT_H);
    });

    [-1, 1].forEach(function (seite) {
      var up = seite * PFEILER / 2;            // Pfeiler/Portal dieses Flügels
      // Portal: zwei Pfosten, zwei Riegel, Kreuzverband
      [-hB, hB].forEach(function (v) { stab(P(up, v, DECK_OBEN), P(up, v, PORTAL_OBEN), 0.8); });
      stab(P(up, -hB, PORTAL_OBEN - 0.4), P(up, hB, PORTAL_OBEN - 0.4), 0.6, 0.8);
      stab(P(up, -hB, PORTAL_OBEN - 6), P(up, hB, PORTAL_OBEN - 6), 0.5, 0.6);
      stab(P(up, -hB, PORTAL_OBEN - 6), P(up, hB, PORTAL_OBEN - 0.4), 0.3);
      stab(P(up, hB, PORTAL_OBEN - 6), P(up, -hB, PORTAL_OBEN - 0.4), 0.3);

      // Obergurte: zur Brückenmitte (u = 0) und zum Ufer (u = ±hL)
      [0, seite * hL].forEach(function (uEnde) {
        var spann = uEnde - up, n = Math.max(2, Math.round(Math.abs(spann) / FELD));
        var zEnde = DECK_OBEN + GURT_H;
        function zGurt(s) { return zEnde + (PORTAL_OBEN - zEnde) * (1 - s) * (1 - s); } // durchhängende Kurve
        [-hB, hB].forEach(function (v) {
          for (var i = 0; i < n; i++) {
            var s0 = i / n, s1 = (i + 1) / n;
            var u0 = up + spann * s0, u1 = up + spann * s1;
            // Obergurt-Stück
            stab(P(u0, v, zGurt(s0)), P(u1, v, zGurt(s1)), 0.45);
            // Hänger (senkrecht) und Diagonale (Fachwerk)
            if (i > 0) stab(P(u0, v, DECK_OBEN + GURT_H), P(u0, v, zGurt(s0)), 0.2);
            if (zGurt(s0) - (DECK_OBEN + GURT_H) > 1.5) {
              stab(P(u0, v, zGurt(s0)), P(u1, v, DECK_OBEN + GURT_H), 0.15);
            }
          }
        });
        // Querriegel oben zwischen den beiden Obergurten (nur wo genug Höhe ist)
        for (var j = 1; j < n; j++) {
          var s = j / n;
          if (zGurt(s) - DECK_OBEN > 5.5) stab(P(up + spann * s, -hB, zGurt(s)), P(up + spann * s, hB, zGurt(s)), 0.2);
        }
      });
    });

    // Fahrbahnplatte (Umriss im Grundriss) – dient auch der Laserdatei als Brückenfläche
    var deck = [P(-hL, -hB, 0), P(hL, -hB, 0), P(hL, hB, 0), P(-hL, hB, 0)].map(function (p) { return [p[0], p[1]]; });

    return { deck: deck, staebe: staebe, deckUnten: DECK_UNTEN, deckDicke: DECK_DICKE };
  };
})();
