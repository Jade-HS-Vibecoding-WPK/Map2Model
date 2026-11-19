/* =========================================================
   Feine Einstrich-Schrift für die Gravur
   Jeder Buchstabe besteht aus wenigen dünnen Linien mit runden
   Bögen (wie eine Schablonen- oder Plotterschrift). Der Laser
   fährt jede Linie genau einmal ab – es wird keine Schriftart
   gebraucht, und nichts muss gefüllt werden.

   Raster: Großbuchstaben 10 Einheiten hoch, Umlaut-Punkte bis 12.
   Die Schrifthöhe h in mm entspricht diesen 12 Einheiten.
   Ein Strich: "x,y x,y …" – Punkte werden verbunden.
   "@cx,cy,rx,ry,von,bis" – Bogen (Ellipse, Winkel in Grad,
   gegen den Uhrzeigersinn positiv) wird an den Strich angehängt.
   ========================================================= */

(function () {
  var EINHEIT = 12;   // Höhe der Schrift in Raster-Einheiten
  var LUECKE = 2;     // Abstand zwischen zwei Zeichen
  var O = "@4,5,4,5,0,360";

  var Z = {
    "A": [7, "0,0 3.5,10 7,0", "1.3,3.6 5.7,3.6"],
    "B": [6.1, "0,5 3.6,5 @3.6,2.5,2.5,2.5,90,-90 0,0 0,10 3.3,10 @3.3,7.5,2.5,2.5,90,-90 0,5"],
    "C": [6.9, "@3.9,5,3.9,5,42,318"],
    "D": [6.5, "0,0 0,10 2.5,10 @2.5,5,4,5,90,-90 0,0"],
    "E": [5.4, "5.4,10 0,10 0,0 5.4,0", "0,5 4.4,5"],
    "F": [5.4, "5.4,10 0,10 0,0", "0,5 4.4,5"],
    "G": [7.6, "@3.9,5,3.9,5,42,360 7.8,4.4 4.4,4.4"],
    "H": [6, "0,0 0,10", "6,0 6,10", "0,5 6,5"],
    "I": [0, "0,0 0,10"],
    "J": [4, "4,10 4,2.6 @2,2.6,2,2.6,0,-180"],
    "K": [5.8, "0,0 0,10", "5.5,10 0,3.5", "1.8,5.6 5.8,0"],
    "L": [5, "0,10 0,0 5,0"],
    "M": [7.6, "0,0 0,10 3.8,1.8 7.6,10 7.6,0"],
    "N": [6, "0,0 0,10 6,0 6,10"],
    "O": [8, O],
    "P": [6, "0,0 0,10 3.3,10 @3.3,7.3,2.7,2.7,90,-90 0,4.6"],
    "Q": [8, O, "5.2,2.6 8,0"],
    "R": [6, "0,0 0,10 3.3,10 @3.3,7.3,2.7,2.7,90,-90 0,4.6", "3.2,4.6 6,0"],
    "S": [6, "@3,7.5,2.9,2.5,25,270 @3,2.5,3,2.5,90,-155"],
    "T": [6, "0,10 6,10", "3,10 3,0"],
    "U": [6, "0,10 0,3 @3,3,3,3,180,360 6,10"],
    "V": [6.6, "0,10 3.3,0 6.6,10"],
    "W": [9.6, "0,10 2.4,0 4.8,8 7.2,0 9.6,10"],
    "X": [6, "0,10 6,0", "0,0 6,10"],
    "Y": [6, "0,10 3,5 6,10", "3,5 3,0"],
    "Z": [6, "0,10 6,10 0,0 6,0"],
    "Ä": [7, "0,0 3.5,10 7,0", "1.3,3.6 5.7,3.6", "2.4,11.2 2.4,12", "4.6,11.2 4.6,12"],
    "Ö": [8, O, "2.9,11.2 2.9,12", "5.1,11.2 5.1,12"],
    "Ü": [6, "0,10 0,3 @3,3,3,3,180,360 6,10", "1.9,11.2 1.9,12", "4.1,11.2 4.1,12"],
    "ß": [5.6, "0,0 0,7.5 @2.5,7.5,2.5,2.5,180,-30 1.8,5.2 3,5.2 @3,2.6,2.6,2.6,90,-130"],
    "0": [6, "@3,5,3,5,0,360"],
    "1": [3.2, "0,7.8 3.2,10 3.2,0"],
    "2": [6, "@3,7.2,2.9,2.8,160,-35 0,0 6,0"],
    "3": [6, "@2.8,7.6,2.6,2.4,150,-90 @3,2.6,3,2.6,90,-150"],
    "4": [6, "4.6,0 4.6,10 0,3 6,3"],
    "5": [6, "5.6,10 1,10 0.5,5.4 @2.9,3.1,3,3.1,130,-150"],
    "6": [6, "4.6,10 0.4,4.5", "@3,3,3,3,0,360"],
    "7": [6, "0,10 6,10 2,0"],
    "8": [6, "@3,7.5,2.6,2.5,0,360", "@3,2.6,3,2.6,0,360"],
    "9": [6, "@3,7,3,3,0,360", "5.6,5.5 1.4,0"],
    "-": [3.5, "0,4.5 3.5,4.5"],
    "−": [3.5, "0,4.5 3.5,4.5"],
    "–": [5, "0,4.5 5,4.5"],
    ".": [0, "0,0 0,0.7"],
    ",": [0.5, "0.5,0.8 0,-0.8"],
    ":": [0, "0,0 0,0.7", "0,6 0,6.7"],
    "/": [4, "0,0 4,10"],
    "(": [1.6, "@3.2,5,3.2,6,120,240"],
    ")": [1.6, "@-1.6,5,3.2,6,60,-60"],
    "·": [0, "0,4.6 0,5.4"],
    "'": [0.4, "0.4,10 0,7.6"],
    "+": [6, "0,5 6,5", "3,2 3,8"],
    "&": [6, "0,5 6,5", "3,2 3,8"],
    "_": [6, "0,0 6,0"],
    "#": [6, "1.6,0 2.6,10", "3.6,0 4.6,10", "0,3.5 6,3.5", "0,6.5 6,6.5"],
    "?": [5.8, "@2.9,7.5,2.9,2.5,160,-60 2.9,4 2.9,2.6", "2.9,0 2.9,0.7"],
    "!": [0, "0,10 0,2.6", "0,0 0,0.7"],
    "|": [0, "0,-1 0,11"],
    "<": [5, "5,9 0,5 5,1"],
    ">": [5, "0,9 5,5 0,1"],
    " ": [3.5],
  };

  // Strich-Beschreibung → Liste von Linienzügen (in Raster-Einheiten)
  var cache = {};
  function striche(zeichen) {
    if (cache[zeichen]) return cache[zeichen];
    var def = Z[zeichen] || Z[zeichen.normalize("NFD").replace(/[̀-ͯ]/g, "")] || Z["?"];
    var aus = def.slice(1).map(function (strich) {
      var pts = [];
      strich.split(" ").forEach(function (tok) {
        if (tok[0] === "@") {
          var a = tok.slice(1).split(",").map(Number);
          var von = a[4] * Math.PI / 180, bis = a[5] * Math.PI / 180;
          var n = Math.max(4, Math.ceil(Math.abs(bis - von) / (Math.PI / 16)));
          for (var i = 0; i <= n; i++) {
            var w = von + (bis - von) * i / n;
            pts.push([a[0] + a[2] * Math.cos(w), a[1] + a[3] * Math.sin(w)]);
          }
        } else {
          var p = tok.split(",").map(Number);
          pts.push(p);
        }
      });
      return pts;
    });
    cache[zeichen] = { w: def[0], striche: aus };
    return cache[zeichen];
  }

  // Großbuchstaben, aber „ß“ bleibt „ß“ (statt „SS“)
  M2M.gross = function (text) {
    return Array.from(String(text)).map(function (c) { return c === "ß" ? c : c.toUpperCase(); }).join("");
  };
  function zeichenVon(text) { return Array.from(M2M.gross(text)); }

  // Text → Linienzüge [[x,y], …] in mm. (x, y) = linke untere Ecke, h = Schrifthöhe in mm
  M2M.textLinien = function (text, x, y, h) {
    var s = h / EINHEIT, cx = 0, aus = [];
    zeichenVon(text).forEach(function (z) {
      var g = striche(z);
      g.striche.forEach(function (pts) {
        aus.push(pts.map(function (p) { return [x + (cx + p[0]) * s, y + p[1] * s]; }));
      });
      cx += g.w + LUECKE;
    });
    return aus;
  };

  // Breite eines Textes in mm bei Schrifthöhe h
  M2M.textBreite = function (text, h) {
    var z = zeichenVon(text);
    if (!z.length) return 0;
    var w = z.reduce(function (summe, c) { return summe + striche(c).w + LUECKE; }, 0) - LUECKE;
    return Math.max(0, w) * h / EINHEIT;
  };
})();
