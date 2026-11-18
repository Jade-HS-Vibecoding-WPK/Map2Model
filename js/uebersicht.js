/* =========================================================
   Übersicht / Bauplan zur Laserdatei (00_Uebersicht.html)
   - Lageplan des ganzen Modells mit allen Gravuren
   - Bauanleitung in der richtigen Reihenfolge
   - Liste aller Platten mit Inhalt
   - Liste aller Bauteile: Gravur → Name aus Revit → Platten
   Die Datei öffnet sich im Browser und lässt sich als PDF drucken.
   ========================================================= */

(function () {
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function zahl(x, st) { return Number(x).toLocaleString("de-DE", { maximumFractionDigits: st || 0 }); }

  // Liste von Schichtnummern → „1–5, 8, Dach“
  function bereiche(liste) {
    var zahlen = liste.filter(function (s) { return typeof s === "number"; }).sort(function (a, b) { return a - b; });
    var rest = liste.filter(function (s) { return typeof s !== "number"; });
    var aus = [], start = null, vor = null;
    zahlen.forEach(function (z) {
      if (start === null) { start = vor = z; return; }
      if (z === vor + 1) { vor = z; return; }
      aus.push(start === vor ? String(start) : start + "–" + vor); start = vor = z;
    });
    if (start !== null) aus.push(start === vor ? String(start) : start + "–" + vor);
    return aus.concat(rest).join(", ");
  }

  // ---------- Lageplan als SVG ----------
  function lageplan(plan) {
    var W = plan.breite, H = plan.hoehe;
    function pfad(mp) {
      return mp.map(function (poly) {
        return poly.map(function (ring) {
          return "M" + ring.map(function (p) { return p[0].toFixed(1) + " " + (H - p[1]).toFixed(1); }).join("L") + "Z";
        }).join("");
      }).join("");
    }
    function mitte(mp) {
      var best = null, a = -1;
      mp.forEach(function (poly) {
        var fl = Math.abs(M2M.geo.flaeche(poly[0]));
        if (fl > a) { a = fl; best = poly[0]; }
      });
      var s = M2M.geo.schwerpunkt(best);
      return [s[0], H - s[1], Math.sqrt(a)];
    }
    var t = [];
    t.push('<svg class="plan" viewBox="-4 -4 ' + (W + 8).toFixed(1) + " " + (H + 8).toFixed(1) + '" xmlns="http://www.w3.org/2000/svg">');
    t.push('<rect x="0" y="0" width="' + W.toFixed(1) + '" height="' + H.toFixed(1) + '" fill="#efe9dc" stroke="#999" stroke-width="0.6"/>');
    if (plan.wasser.length) t.push('<path d="' + pfad(plan.wasser) + '" fill="#9cc3e6" fill-rule="evenodd"/>');
    if (plan.strasse.length) t.push('<path d="' + pfad(plan.strasse) + '" fill="#c9cdd2" fill-rule="evenodd"/>');
    if (plan.bahn.length) t.push('<path d="' + pfad(plan.bahn) + '" fill="#555" fill-rule="evenodd"/>');
    var reihenfolge = ["Grün", "Brücke", "Gebäude"];
    reihenfolge.forEach(function (kat) {
      plan.markierungen.filter(function (m) { return m.kategorie === kat; }).forEach(function (m) {
        var farbe = kat === "Grün" ? (m.neubau ? "#86efac" : "#a8d5b0") : kat === "Brücke" ? "#d6c7a6" : (m.neubau ? "#bbf7d0" : "#ffffff");
        var rand = m.neubau ? "#15803d" : "#555";
        t.push('<path d="' + pfad(m.mp) + '" fill="' + farbe + '" stroke="' + rand + '" stroke-width="' + (m.neubau ? 0.8 : 0.4) + '" fill-rule="evenodd"/>');
      });
    });
    plan.baeume.forEach(function (b) {
      t.push('<circle cx="' + b.c[0].toFixed(1) + '" cy="' + (H - b.c[1]).toFixed(1) + '" r="' + Math.max(0.8, b.r).toFixed(1) + '" fill="#4f9a5f" opacity=".7"/>');
    });
    // Beschriftungen
    reihenfolge.forEach(function (kat) {
      plan.markierungen.filter(function (m) { return m.kategorie === kat; }).forEach(function (m) {
        var c = mitte(m.mp);
        var gr = Math.max(2.2, Math.min(7, c[2] * 0.22));
        t.push('<text x="' + c[0].toFixed(1) + '" y="' + (c[1] + gr * 0.35).toFixed(1) + '" font-size="' + gr.toFixed(1) +
          '" text-anchor="middle" class="' + (m.neubau ? "neu" : "") + '">' + esc(m.label) + "</text>");
      });
    });
    // Teile der Grundplatte
    var k = plan.kacheln;
    if (k.nx * k.ny > 1) {
      for (var j = k.ny - 1, idx = 0; j >= 0; j--) {
        for (var i = 0; i < k.nx; i++, idx++) {
          var x = i * k.b, y = H - (j + 1) * k.h;
          t.push('<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + k.b.toFixed(1) + '" height="' + k.h.toFixed(1) +
            '" fill="none" stroke="#d00" stroke-width="1.2" stroke-dasharray="6 4"/>');
          t.push('<text x="' + (x + 8).toFixed(1) + '" y="' + (y + 22).toFixed(1) + '" font-size="20" class="teil">' + String.fromCharCode(65 + idx) + "</text>");
        }
      }
    }
    t.push("</svg>");
    return t.join("");
  }

  M2M.uebersichtHtml = function (erg, cfg, quelle) {
    var bauteile = erg.bauteile.slice().sort(function (a, b) {
      var ord = { "Gebäude": 0, "Brücke": 1, "Grün": 2 };
      return (a.neubau - b.neubau) || (ord[a.kategorie] - ord[b.kategorie]) || String(a.kurz).localeCompare(String(b.kurz), "de", { numeric: true });
    });
    var nameVon = {};
    bauteile.forEach(function (b) { nameVon[b.gravur] = b; });

    // Inhalt jeder Platte
    var plattenZeilen = erg.blaetter.map(function (bl) {
      var inhalt;
      if (bl.gruppe === "Übersicht") {
        inhalt = "Verkleinerter Plan des ganzen Modells: wo die Teile A, B … liegen und welche Platten-Nummern dazugehören. Kann als Plakette mitgelasert werden.";
      } else if (bl.gruppe === "Grundplatte") {
        inhalt = /Bodenplatte/.test(bl.name) && !/darunter/.test(bl.name)
          ? "Straßen und Wasser ausgeschnitten; Umrisse der Gebäude, Grünflächen und Brücken blau angeritzt mit Gravur; Bäume, Gleise, Beschriftung"
          : /Wasser/.test(bl.name) ? "Durchgehende Platte – Wasserspiegel (ganz unten)"
          : /Straßenboden \(unten\)/.test(bl.name) ? "Durchgehende Platte – Straßenboden (ganz unten)"
          : "Wasser ausgeschnitten – Straßen liegen hier auf";
      } else {
        var je = {}, reihe = [];
        bl.inhalt.forEach(function (it) {
          var g = it.element.label;
          if (!je[g]) { je[g] = []; reihe.push(g); }
          je[g].push(it.schicht);
        });
        inhalt = reihe.map(function (g) { return "<b>" + esc(g) + "</b> (" + esc(bereiche(je[g])) + ")"; }).join(", ");
      }
      return "<tr><td class='nr'>" + String(bl.nummer).padStart(2, "0") + "</td><td>" + esc(bl.name.replace(/^Platte \d+ · /, "").replace(/ \(\d+× schneiden\)$/, "")) +
        "</td><td class='nr'>" + (bl.anzahl ? bl.anzahl + "×" : "nicht lasern") + "</td><td>" + inhalt + "</td></tr>";
    }).join("");

    var teileZeilen = bauteile.map(function (b) {
      var art = (b.neubau ? "Neubau · " : "") + b.kategorie;
      return "<tr" + (b.neubau ? " class='neu'" : "") + "><td><b>" + esc(b.gravur) + "</b>" + (b.gravur !== b.kurz ? "<br><small>kurz: " + esc(b.kurz) + "</small>" : "") +
        "</td><td>" + esc(b.name) + "</td><td>" + esc(art) + "</td><td class='nr'>" + zahl(b.hoeheM, 1) + " m</td><td class='nr'>" + b.teile +
        "</td><td>" + b.platten.map(function (p) { return String(p).padStart(2, "0"); }).join(", ") + "</td></tr>";
    }).join("");

    // Bauanleitung
    var schritte = [];
    var arten = erg.ebenenArten.slice().reverse(); // von unten nach oben
    var mehrereTeile = erg.teile.grundplatte > 1;
    arten.forEach(function (a) {
      var nr = erg.blaetter.filter(function (b) { return b.gruppe === "Grundplatte" && b.name.indexOf(a.art) >= 0; })
        .map(function (b) { return String(b.nummer).padStart(2, "0"); });
      if (!nr.length) return;
      schritte.push("<b>" + esc(a.art) + "</b> – Platte " + nr.join(", ") + (a.anzahl > 1 ? " (jeweils " + a.anzahl + "× schneiden und stapeln)" : "") +
        (mehrereTeile ? ". Teile A, B … wie im Lageplan nebeneinanderlegen (Gravur „> B“ zeigt den Nachbarn)." : "."));
    });
    schritte.push("Ebenen deckungsgleich <b>aufeinanderkleben</b>. Die Gravur in der Ecke (z. B. „A OBEN“, „A MITTE“) zeigt, welche Ebene es ist.");
    if (bauteile.some(function (b) { return b.kategorie === "Grün"; })) schritte.push("<b>Grünflächen</b> auf die blau angeritzten Umrisse kleben (Gravur „G…“ auf Teil und Bodenplatte gleich).");
    schritte.push(cfg.bauweise === "volumen"
      ? "<b>Gebäude</b>: Wände A, B, C … ringsum aufstellen (Reihenfolge wie die Buchstaben), Dach obenauf. Position: blau angeritzter Umriss mit gleicher Gravur."
      : "<b>Gebäude</b>: Schichten in Zahlenfolge stapeln – „-1“ unten, die höchste Zahl oben. Position: blau angeritzter Umriss mit gleicher Gravur auf der Bodenplatte.");
    if (bauteile.some(function (b) { return b.neubau; })) schritte.push("<b>Neubauten</b> (grün markiert) liegen auf eigenen Platten – ideal in anderem Material.");
    if (bauteile.some(function (b) { return b.kategorie === "Brücke"; })) schritte.push("<b>Brücken</b>: Fahrbahn über das ausgeschnittene Wasser legen.");

    var datum = new Date().toLocaleDateString("de-DE");
    return "<!doctype html><html lang='de'><head><meta charset='utf-8'><title>Map2Model – Bauplan</title>" +
      "<meta name='viewport' content='width=device-width, initial-scale=1'><style>" +
      "body{font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif;color:#14171a;margin:0;padding:32px;max-width:1100px;margin:0 auto;line-height:1.45}" +
      "h1{font-size:28px;margin:0 0 4px;letter-spacing:-.02em}h2{font-size:18px;margin:32px 0 10px;padding-top:12px;border-top:2px solid #14171a}" +
      ".kopf{color:#5f6670;font-size:13px;margin-bottom:18px}.zahlen{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}" +
      ".zahl{border:1px solid #e4e7eb;border-radius:10px;padding:10px 14px;min-width:150px}.zahl span{display:block;font-size:12px;color:#5f6670}.zahl b{font-size:20px}" +
      ".plan{width:100%;height:auto;border:1px solid #e4e7eb;border-radius:8px;background:#fff}.plan text{font-family:Inter,system-ui,sans-serif;font-weight:700;fill:#14171a;paint-order:stroke;stroke:#fff;stroke-width:.6}" +
      ".plan text.neu{fill:#0f6b32}.plan text.teil{fill:#d00;font-weight:800}" +
      ".legende{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:#5f6670;margin:8px 0}.legende i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:6px;vertical-align:-2px;border:1px solid #999}" +
      "table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#5f6670;border-bottom:2px solid #14171a;padding:6px 8px}" +
      "td{border-bottom:1px solid #e4e7eb;padding:6px 8px;vertical-align:top}td.nr{font-variant-numeric:tabular-nums;white-space:nowrap}tr.neu td{background:#effaf3}" +
      "ol li{margin-bottom:8px}small{color:#5f6670}" +
      "@media print{body{padding:0}h2{break-after:avoid}tr{break-inside:avoid}.plan{break-inside:avoid}}" +
      "</style></head><body>" +
      "<h1>Bauplan Lasermodell</h1>" +
      "<div class='kopf'>Quelle: " + esc(quelle) + " · Maßstab 1:" + esc(cfg.massstab) + " · " + esc(cfg.material) + " " + esc(cfg.staerke) + " mm · Platte " +
      esc(cfg.plattenB) + " × " + esc(cfg.plattenH) + " mm · " + (cfg.bauweise === "volumen" ? "Volumen" : "Geschichtet") + " · " + datum + "</div>" +
      "<div class='zahlen'>" +
      "<div class='zahl'><span>Einkaufen</span><b>" + erg.finnpappen + " Platten à " + esc(cfg.plattenB) + " × " + esc(cfg.plattenH) + " mm</b></div>" +
      "<div class='zahl'><span>Dateien</span><b>" + erg.blaetter.length + "</b></div>" +
      "<div class='zahl'><span>Modellgröße</span><b>" + zahl(erg.modellMM[0]) + " × " + zahl(erg.modellMM[1]) + " mm</b></div>" +
      "<div class='zahl'><span>Grundplatte</span><b>" + erg.teile.grundplatte + " Teil" + (erg.teile.grundplatte > 1 ? "e" : "") + " · " + erg.teile.ebenen + " Ebenen</b></div>" +
      "<div class='zahl'><span>Bauteile</span><b>" + bauteile.length + "</b></div>" +
      "</div>" +
      "<h2>1 · Lageplan – wo was hinkommt</h2>" +
      "<div class='legende'><span><i style='background:#fff'></i>Bestand</span><span><i style='background:#bbf7d0;border-color:#15803d'></i>Neubau</span>" +
      "<span><i style='background:#a8d5b0'></i>Grün</span><span><i style='background:#c9cdd2'></i>Straße (ausgeschnitten)</span>" +
      "<span><i style='background:#9cc3e6'></i>Wasser (ausgeschnitten)</span><span><i style='background:#d6c7a6'></i>Brücke</span>" +
      (mehrereTeile ? "<span><i style='background:#fff;border:2px dashed #d00'></i>Teile der Grundplatte</span>" : "") + "</div>" +
      lageplan(erg.plan) +
      "<h2>2 · Bauanleitung</h2><ol>" + schritte.map(function (s) { return "<li>" + s + "</li>"; }).join("") + "</ol>" +
      "<h2>3 · Platten – was liegt wo</h2><table><thead><tr><th>Platte</th><th>Art</th><th>Schneiden</th><th>Inhalt (Gravur und Schichten)</th></tr></thead><tbody>" + plattenZeilen + "</tbody></table>" +
      "<h2>4 · Bauteile – Gravur und Name</h2><table><thead><tr><th>Gravur</th><th>Name (aus Revit)</th><th>Art</th><th>Höhe</th><th>Teile</th><th>Auf Platte</th></tr></thead><tbody>" + teileZeilen + "</tbody></table>" +
      "<p><small>Farben der Laserdateien: Rot = schneiden · Blau = anritzen · Gelb = Rahmen · Schwarz = gravieren. Erzeugt mit Map2Model · Kartendaten © OpenStreetMap-Mitwirkende.</small></p>" +
      "</body></html>";
  };
})();
