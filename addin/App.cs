// =========================================================
//  Map2Model – Revit-Add-in
//  Öffnet die IFC-Datei, die die Map2Model-Website geschickt hat,
//  automatisch in Revit (wie „Datei → Öffnen → IFC“).
//
//  Ablauf:
//  1. Der Map2Model-Öffner legt einen Auftrag ab:
//       %LOCALAPPDATA%\Map2Model-Oeffner\auftrag.txt  (Zeile 1 = Pfad zur IFC)
//     und startet Revit (falls es noch nicht läuft).
//  2. Dieses Add-in schaut, sobald Revit nichts zu tun hat („Idling“),
//     etwa einmal pro Sekunde nach dem Auftrag.
//  3. Gefunden → Auftrag löschen → IFC öffnen → als <Name>.ifc.rvt neben der
//     IFC speichern (so macht es Revit auch selbst) → in Revit anzeigen.
// =========================================================
using System;
using System.IO;
using Autodesk.Revit.ApplicationServices;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using Autodesk.Revit.UI.Events;

namespace Map2ModelRevit
{
    public class App : IExternalApplication
    {
        static readonly string AuftragDatei = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Map2Model-Oeffner", "auftrag.txt");

        DateTime letztePruefung = DateTime.MinValue;

        public Result OnStartup(UIControlledApplication application)
        {
            application.Idling += BeimLeerlauf;
            return Result.Succeeded;
        }

        public Result OnShutdown(UIControlledApplication application)
        {
            application.Idling -= BeimLeerlauf;
            return Result.Succeeded;
        }

        void BeimLeerlauf(object sender, IdlingEventArgs e)
        {
            // höchstens einmal pro Sekunde nachsehen
            if ((DateTime.Now - letztePruefung).TotalSeconds < 1) return;
            letztePruefung = DateTime.Now;
            if (!File.Exists(AuftragDatei)) return;

            string pfad;
            try
            {
                pfad = File.ReadAllLines(AuftragDatei)[0].Trim();
                File.Delete(AuftragDatei); // Auftrag nur einmal ausführen
            }
            catch { return; }

            // Sicherheit: nur vorhandene .ifc-Dateien
            if (!pfad.EndsWith(".ifc", StringComparison.OrdinalIgnoreCase) || !File.Exists(pfad)) return;

            var uiapp = sender as UIApplication;
            if (uiapp == null) return;
            try
            {
                Application app = uiapp.Application;
                Document doc = app.OpenIFCDocument(pfad);
                string rvt = pfad + ".rvt";
                var optionen = new SaveAsOptions { OverwriteExistingFile = true };
                doc.SaveAs(rvt, optionen);
                doc.Close(false);
                uiapp.OpenAndActivateDocument(rvt);
            }
            catch (Exception fehler)
            {
                TaskDialog.Show("Map2Model",
                    "Die IFC-Datei konnte nicht automatisch geöffnet werden:\n" + fehler.Message +
                    "\n\nBitte über Datei → Öffnen → IFC öffnen. Der Pfad ist:\n" + pfad);
            }
        }
    }
}
