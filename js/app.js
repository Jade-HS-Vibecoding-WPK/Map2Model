/* =========================================================
   Map2Model – gemeinsamer Zustand, Schritte wechseln, Rückmeldungen
   ========================================================= */

// Alles, was die einzelnen Teile der App teilen, liegt hier.
window.M2M = {
  // ausgewähltes Gebiet: { sued, west, nord, ost, breiteM, hoeheM }
  gebiet: null,
  // hochgeladene IFC-Datei (File-Objekt)
  datei: null,
};

var SCHRITTE = ["gebiet", "revit", "laser"];

// ---------- Schritt anzeigen ----------
M2M.zeigeAnsicht = function (name) {
  // Startbildschirm: ohne Adresse (#) oder bei #start
  var start = SCHRITTE.indexOf(name) < 0;
  document.getElementById("start").hidden = !start;
  document.querySelector(".app").hidden = start;
  if (start) return;

  document.querySelectorAll(".panel").forEach(function (el) {
    el.classList.toggle("aktiv", el.dataset.panel === name);
  });
  document.querySelectorAll(".schritt").forEach(function (el) {
    var i = SCHRITTE.indexOf(el.dataset.ansicht);
    el.classList.toggle("aktiv", el.dataset.ansicht === name);
    el.classList.toggle("erledigt", i < SCHRITTE.indexOf(name));
  });

  // rechts: Karte bei Schritt 1 + 2, Laserbett-Vorschau bei Schritt 3
  var laser = name === "laser";
  document.getElementById("karte").hidden = laser;
  document.getElementById("karte-hinweis").style.display = laser || M2M.gebiet ? "none" : "";
  document.getElementById("vorschau").hidden = !laser;

  if (!laser && M2M.karte) setTimeout(function () { M2M.karte.invalidateSize(); }, 0);
  if (laser && M2M.zeichneVorschau) M2M.zeichneVorschau();
};

function ansichtAusAdresse() {
  M2M.zeigeAnsicht(location.hash.replace("#", ""));
}
window.addEventListener("hashchange", ansichtAusAdresse);
document.addEventListener("DOMContentLoaded", ansichtAusAdresse);

// ---------- Kurze Rückmeldung unten im Bild ----------
var toastTimer = null;
M2M.melde = function (text, art) {
  var el = document.getElementById("toast");
  el.textContent = text;
  el.classList.toggle("fehler", art === "fehler");
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.hidden = true; }, art === "fehler" ? 6000 : 3500);
};
