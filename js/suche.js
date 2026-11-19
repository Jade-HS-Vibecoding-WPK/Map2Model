/* =========================================================
   Adresssuche über Nominatim (OpenStreetMap)
   Regeln von Nominatim: höchstens 1 Anfrage pro Sekunde,
   keine Suche während des Tippens – nur beim Abschicken.
   ========================================================= */

(function () {
  var form = document.getElementById("suche");
  var eingabe = document.getElementById("suche-eingabe");
  var liste = document.getElementById("suche-treffer");
  var letzteAnfrage = 0;

  function trefferAusblenden() {
    liste.hidden = true;
    liste.innerHTML = "";
  }

  function geheZu(treffer) {
    trefferAusblenden();
    eingabe.value = treffer.display_name;
    // kurzer Ortsname für den Dateinamen, z. B. „Kaiser-Wilhelm-Brücke“
    M2M.ortName = (treffer.name || treffer.display_name.split(",")[0]).trim();
    M2M.springeZu(parseFloat(treffer.lat), parseFloat(treffer.lon), treffer.boundingbox);
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var text = eingabe.value.trim();
    if (!text) return;

    // höchstens eine Anfrage pro Sekunde
    var warten = 1000 - (Date.now() - letzteAnfrage);
    if (warten > 0) await new Promise(function (r) { setTimeout(r, warten); });
    letzteAnfrage = Date.now();

    M2M.melde("Suche läuft …");
    var url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=de&q=" +
      encodeURIComponent(text);

    try {
      var antwort = await fetch(url, { headers: { "Accept": "application/json" } });
      if (!antwort.ok) throw new Error("HTTP " + antwort.status);
      var treffer = await antwort.json();
      // doppelte Einträge (gleicher Name) nur einmal zeigen
      var gesehen = {};
      treffer = treffer.filter(function (t) {
        if (gesehen[t.display_name]) return false;
        gesehen[t.display_name] = true;
        return true;
      });

      if (!treffer.length) {
        trefferAusblenden();
        M2M.melde("Adresse nicht gefunden. Schreibweise prüfen?", "fehler");
        return;
      }
      if (treffer.length === 1) {
        geheZu(treffer[0]);
        M2M.melde("Gefunden.");
        return;
      }

      // mehrere Treffer: Liste zum Auswählen zeigen
      liste.innerHTML = "";
      treffer.forEach(function (t) {
        var li = document.createElement("li");
        var knopf = document.createElement("button");
        knopf.type = "button";
        knopf.textContent = t.display_name;
        knopf.addEventListener("click", function () { geheZu(t); });
        li.appendChild(knopf);
        liste.appendChild(li);
      });
      liste.hidden = false;
      document.getElementById("toast").hidden = true;
    } catch (fehler) {
      M2M.melde("Keine Verbindung zur Adresssuche. Internet prüfen und noch einmal versuchen.", "fehler");
    }
  });

  // Liste schließen bei Klick daneben oder Escape
  document.addEventListener("click", function (e) {
    if (!form.contains(e.target)) trefferAusblenden();
  });
  eingabe.addEventListener("keydown", function (e) {
    if (e.key === "Escape") trefferAusblenden();
  });

  // Direktlink: ?ort=53.5128,8.1430,Kaiser-Wilhelm-Brücke → springt ohne Suche dorthin (z. B. für Präsentation/Poster)
  var ort = new URLSearchParams(location.search).get("ort");
  if (ort) window.addEventListener("load", function () {
    var t = ort.split(","), lat = parseFloat(t[0]), lon = parseFloat(t[1]);
    if (!isFinite(lat) || !isFinite(lon) || !M2M.springeZu) return;
    M2M.ortName = (t.slice(2).join(",") || "Gebiet").trim();
    eingabe.value = M2M.ortName;
    M2M.springeZu(lat, lon);
  });
})();
