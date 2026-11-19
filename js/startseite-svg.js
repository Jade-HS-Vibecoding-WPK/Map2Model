/* =========================================================
   Startseite: bewegtes Lasermodell (Ersatz, falls 3D nicht geht)
   Ein kleines Stadtmodell in Isometrie, so gebaut wie die App es
   später lasert: Wasserplatte, Straßenboden, Baublöcke, Grün,
   Gebäude aus Schichten. Die Teile fallen nacheinander von oben
   herein und setzen sich zusammen – kurz stehen lassen, wieder
   auseinander, von vorn. Bei „Bewegung reduzieren“: steht still.
   ========================================================= */

M2M.startSvg = function () {
  var svg = document.getElementById("start-grafik");
  if (!svg) return;
  var NS = "http://www.w3.org/2000/svg";
  var ruhig = false; // Bewegung immer zeigen (Wunsch des Teams)

  // ---------- Isometrie ----------
  var S = 1.12, CX = 286, CY = 118, C30 = 0.866;
  function iso(x, y, z) { return [CX + (x - y) * C30 * S, CY + (x + y) * 0.5 * S - z * S]; }
  function punkte(liste) { return liste.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" "); }
  function el(name, attr, eltern) {
    var e = document.createElementNS(NS, name);
    for (var k in attr) e.setAttribute(k, attr[k]);
    if (eltern) eltern.appendChild(e);
    return e;
  }

  // Farben: [oben, vorne (+y), rechts (+x)]
  var F = {
    wasser:  ["#6aa1d4", "#3f78ad", "#2f6496"],
    strasse: ["#c3c8ce", "#9aa1a9", "#868d96"],
    pappe:   ["#f1ebdd", "#d9cfb9", "#c8bca2"],
    haus:    ["#fbf8f1", "#e3dccb", "#d2c8b2"],
    neu:     ["#e2425b", "#b51a33", "#981229"],
    gruen:   ["#86c594", "#5ea56f", "#4f9160"],
    bruecke: ["#e4ddcd", "#c4b9a2", "#b2a68c"],
  };

  // Quader zeichnen (nur die drei sichtbaren Seiten)
  function quader(eltern, x, y, w, d, z, h, farbe) {
    var g = el("g", {}, eltern);
    el("polygon", { points: punkte([iso(x, y + d, z + h), iso(x + w, y + d, z + h), iso(x + w, y + d, z), iso(x, y + d, z)]), fill: farbe[1] }, g);
    el("polygon", { points: punkte([iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x + w, y + d, z), iso(x + w, y, z)]), fill: farbe[2] }, g);
    el("polygon", { points: punkte([iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)]), fill: farbe[0], stroke: "rgba(60,50,30,.12)", "stroke-width": "0.6", "stroke-linejoin": "round" }, g);
    return g;
  }

  // ---------- Das Modell ----------
  var B = 300, T = 210, D = 4;           // Plattengröße und Materialstärke
  var WASSER_Y = 158;                    // ab hier (vorne) Wasser
  var STR_X = [[92, 108], [204, 220]], STR_Y = [70, 84];

  var schatten = el("ellipse", {}, svg);
  var mitteUnten = iso(B / 2, T / 2, 0);
  schatten.setAttribute("cx", mitteUnten[0]); schatten.setAttribute("cy", mitteUnten[1] + 18);
  schatten.setAttribute("rx", 300); schatten.setAttribute("ry", 92);
  schatten.setAttribute("fill", "rgba(20,30,45,.10)");
  var defs = el("defs", {}, svg);
  var blur = el("filter", { id: "start-weich", x: "-20%", y: "-50%", width: "140%", height: "200%" }, defs);
  el("feGaussianBlur", { stdDeviation: "14" }, blur);
  schatten.setAttribute("filter", "url(#start-weich)");

  var modell = el("g", {}, svg);
  var teile = []; // { g, start, gruppe }

  function teil(g, start, hoehe) { teile.push({ g: g, start: start, hoehe: hoehe || 60 }); return g; }

  // 1) Wasserplatte, 2) Straßenboden, 3) Baublöcke
  teil(quader(modell, 0, 0, B, T, 0, D, F.wasser), 0, 70);
  teil(quader(modell, 0, 0, B, WASSER_Y, D, D, F.strasse), 220, 70);
  var xs = [[0, STR_X[0][0]], [STR_X[0][1], STR_X[1][0]], [STR_X[1][1], B]];
  var ys = [[0, STR_Y[0]], [STR_Y[1], WASSER_Y]];
  var bloecke = [];
  ys.forEach(function (yy) { xs.forEach(function (xx) { bloecke.push([xx[0], yy[0], xx[1] - xx[0], yy[1] - yy[0]]); }); });
  bloecke.forEach(function (b, i) { teil(quader(modell, b[0], b[1], b[2], b[3], 2 * D, D, F.pappe), 440 + i * 50, 60); });

  // Brücke über das Wasser
  var brueckeG = el("g", {}, modell);
  quader(brueckeG, 150, WASSER_Y - 6, 22, T - WASSER_Y + 6, 2 * D + 2, 3, F.bruecke);
  teil(brueckeG, 800, 50);

  // Grünfläche (Park) auf dem mittleren hinteren Block
  teil(quader(modell, 116, 8, 80, 54, 3 * D, 2.5, F.gruen), 860, 40);

  // Gebäude: [x, y, breite, tiefe, Schichten, neu?]
  var Z0 = 3 * D, SCH = 5;
  var gebaeude = [
    [8, 8, 34, 28, 9], [48, 8, 36, 22, 6], [8, 42, 22, 22, 4], [40, 38, 44, 26, 5],
    [228, 8, 64, 24, 7], [228, 38, 30, 26, 11], [264, 40, 28, 24, 5],
    [8, 92, 40, 30, 6], [54, 92, 30, 56, 8], [8, 128, 40, 22, 3],
    [116, 92, 36, 58, 10, true], [160, 92, 36, 26, 4], [160, 124, 36, 26, 6],
    [228, 92, 64, 22, 5], [228, 120, 28, 30, 7], [262, 120, 30, 30, 4],
  ];
  // von hinten nach vorne zeichnen (kleinere x + y zuerst)
  gebaeude.sort(function (a, b) { return (a[0] + a[1] + a[2] / 2 + a[3] / 2) - (b[0] + b[1] + b[2] / 2 + b[3] / 2); });
  var BAU_START = 1000, JE_SCHICHT = 110;
  gebaeude.forEach(function (g, i) {
    for (var s = 0; s < g[4]; s++) {
      var q = quader(modell, g[0], g[1], g[2], g[3], Z0 + s * SCH, SCH, g[5] ? F.neu : F.haus);
      teil(q, BAU_START + s * JE_SCHICHT + (i % 5) * 35, 70);
    }
  });

  // Bäume (kleine Kugeln) im Park
  var baeume = [[132, 22], [150, 46], [176, 20], [184, 50], [126, 52], [160, 30]];
  var letzterBau = BAU_START + 11 * JE_SCHICHT + 4 * 35;
  baeume.forEach(function (b, i) {
    var aufPark = b[0] > 116 && b[0] < 196 && b[1] < 62;
    var p = iso(b[0], b[1], (aufPark ? 3 * D + 2.5 : 2 * D) + 7);
    var g = el("g", {}, modell);
    el("circle", { cx: p[0], cy: p[1], r: 7, fill: "#5a9e6a" }, g);
    el("circle", { cx: p[0] - 2, cy: p[1] - 2.4, r: 3.6, fill: "#82c391" }, g);
    teil(g, letzterBau + 150 + i * 60, 30);
  });

  // ---------- Bewegung ----------
  if (ruhig || !modell.animate) return;

  var laeuft = [];
  var EASE = "cubic-bezier(.2,.8,.25,1)";
  function stopp() { laeuft.forEach(function (a) { a.cancel(); }); laeuft = []; }

  function zusammensetzen() {
    stopp();
    teile.forEach(function (t) {
      laeuft.push(t.g.animate([
        { transform: "translate(0px," + (-t.hoehe) + "px)", opacity: 0 },
        { transform: "translate(0px,0px)", opacity: 1 },
      ], { duration: 650, delay: t.start, easing: EASE, fill: "backwards" }));
    });
    laeuft.push(schatten.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, fill: "backwards" }));
  }

  function auseinander() {
    stopp();
    var n = teile.length;
    teile.forEach(function (t, i) {
      laeuft.push(t.g.animate([
        { transform: "translate(0px,0px)", opacity: 1 },
        { transform: "translate(0px," + (-t.hoehe * 0.8) + "px)", opacity: 0 },
      ], { duration: 420, delay: (n - 1 - i) * 9, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" }));
    });
    laeuft.push(schatten.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, delay: n * 9, fill: "forwards" }));
  }

  // Ablauf: zusammensetzen → stehen lassen → auseinander → von vorn
  var DAUER_AUFBAU = letzterBau + 150 + baeume.length * 60 + 700;
  var timer = null;
  function zyklus() {
    clearTimeout(timer);
    zusammensetzen();
    timer = setTimeout(function () {
      auseinander();
      timer = setTimeout(zyklus, teile.length * 9 + 700);
    }, DAUER_AUFBAU + 5500);
  }

  // Leichtes Schweben des ganzen Modells
  modell.animate([{ transform: "translate(0px,0px)" }, { transform: "translate(0px,-5px)" }, { transform: "translate(0px,0px)" }],
    { duration: 6000, iterations: Infinity, easing: "ease-in-out" });

  // Nur laufen lassen, wenn die Startseite zu sehen ist – und beim Öffnen neu aufbauen
  var start = document.getElementById("start");
  function pruefe() {
    if (start && !start.hidden) zyklus();
    else { clearTimeout(timer); stopp(); }
  }
  window.addEventListener("hashchange", function () { setTimeout(pruefe, 0); });
  if (start && window.MutationObserver) new MutationObserver(function () { setTimeout(pruefe, 0); }).observe(start, { attributes: true, attributeFilter: ["hidden"] });
  setTimeout(pruefe, 0);
};
