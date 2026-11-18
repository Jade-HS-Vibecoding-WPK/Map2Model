/* =========================================================
   Startbildschirm: Grafik eines geschichteten Lasermodells
   (Isometrie: Grundplatte aus Ebenen, Wasser, Straßen, Grün,
   Gebäude aus Schichten – genau so, wie die App es später baut)
   ========================================================= */

(function () {
  var svg = document.getElementById("start-grafik");
  if (!svg) return;
  var NS = "http://www.w3.org/2000/svg";

  // Mittelpunkt der Grafik und Isometrie-Verzerrung
  var CX = 280, CY = 150;
  var ISO = "matrix(0.866 0.5 -0.866 0.5 0 0)";

  // Eine flache Platte (Rechteck im Grundriss) auf Höhe z zeichnen,
  // mit dunklerer Kante darunter, damit sie Materialstärke bekommt.
  function platte(x, y, b, h, z, dicke, oben, kante) {
    [[z, kante], [z + dicke, oben]].forEach(function (ebene, i) {
      var g = document.createElementNS(NS, "g");
      g.setAttribute("transform", "translate(" + CX + " " + (CY + 200 - ebene[0]) + ") " + ISO);
      var r = document.createElementNS(NS, "rect");
      r.setAttribute("x", x - 160); r.setAttribute("y", y - 120);
      r.setAttribute("width", b); r.setAttribute("height", h);
      r.setAttribute("fill", ebene[1]);
      if (i === 1) { r.setAttribute("stroke", "rgba(0,0,0,.18)"); r.setAttribute("stroke-width", "0.6"); }
      g.appendChild(r);
      svg.appendChild(g);
    });
  }

  var PAPPE = "#ece6d8", PAPPE_KANTE = "#c4b9a2";
  var T = 7; // Materialstärke in der Grafik

  // Ebene unten: Wasserspiegel (durchgehend)
  platte(0, 0, 320, 240, 0, T, "#4f8fcf", "#2f6aa3");
  // Ebene Straße: alles außer Wasser (Wasser = unterer Streifen)
  platte(0, 0, 320, 170, T, T, "#a9afb7", "#7d848d");
  // Ebene 0: Baublöcke zwischen den Straßen
  var bloecke = [
    [0, 0, 92, 70], [108, 0, 104, 70], [228, 0, 92, 70],
    [0, 86, 92, 84], [108, 86, 104, 84], [228, 86, 92, 84],
  ];
  bloecke.forEach(function (b) { platte(b[0], b[1], b[2], b[3], 2 * T, T, PAPPE, PAPPE_KANTE); });

  // Grünflächen (+1 Schicht, aufgeklebt)
  platte(120, 96, 46, 40, 3 * T, 3, "#6dbb7f", "#3f8a52");
  platte(236, 10, 30, 26, 3 * T, 3, "#6dbb7f", "#3f8a52");

  // Gebäude aus Schichten: [x, y, breite, tiefe, anzahl Schichten]
  var gebaeude = [
    [10, 10, 34, 50, 6], [52, 14, 30, 38, 4],
    [118, 10, 40, 26, 8], [168, 10, 36, 52, 5],
    [276, 40, 36, 24, 3],
    [10, 96, 30, 60, 5], [50, 120, 34, 40, 7],
    [176, 100, 30, 56, 4],
    [240, 96, 70, 30, 9], [240, 136, 34, 26, 3],
  ];
  // von hinten nach vorne zeichnen, damit vordere Gebäude davor liegen
  gebaeude.sort(function (a, b) { return (a[0] + a[1]) - (b[0] + b[1]); });
  gebaeude.forEach(function (g, i) {
    for (var s = 0; s < g[4]; s++) {
      platte(g[0], g[1], g[2], g[3], 3 * T + s * 5, 5, i === 6 ? "#e0405a" : "#f7f3ea", i === 6 ? "#a00d25" : "#bdb39c");
    }
  });

  // Brücke über das Wasser
  platte(150, 166, 22, 80, 2 * T + 2, 4, "#d9d3c4", "#a39983");
})();
