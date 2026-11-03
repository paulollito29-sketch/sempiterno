/**
 * ==============================================================================
 * SEMPITERNO - GOOGLE APPS SCRIPT BACKEND
 * ==============================================================================
 * Este script convierte tu Google Sheet y Google Drive en una API REST gratuita
 * y privada para tu aplicación "Sempiterno".
 *
 * INSTRUCCIONES DE INSTALACIÓN (3 MINUTOS):
 * 1. Abre un Google Sheet nuevo en blanco (puedes llamarlo "Sempiterno BD").
 * 2. En el menú superior haz clic en: Extensiones > Apps Script.
 * 3. Borra todo el código que aparezca y pega este archivo completo.
 * 4. Haz clic en el botón azul "Implementar" (arriba a la derecha) > "Nueva implementación".
 * 5. En el ícono de engranaje (Seleccionar tipo) elige: "Aplicación web".
 * 6. Configura:
 *    - Descripción: "Sempiterno API v1"
 *    - Ejecutar como: "Yo (tu cuenta de Google)"
 *    - Quién tiene acceso: "Cualquier persona" (Anyone) -> ¡IMPORTANTE para que la app pueda conectar sin login complejo!
 * 7. Haz clic en "Implementar", autoriza los permisos con tu cuenta de Google.
 * 8. Copia la "URL de la aplicación web" (termina en /exec) y pégala en los Ajustes de Sempiterno.
 * ==============================================================================
 */

var DRIVE_FOLDER_NAME = "Sempiterno Fotos 💖";

// ------------------------------------------------------------------------------
// MANEJO DE SOLICITUDES GET
// ------------------------------------------------------------------------------
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "ping";

  try {
    if (action === "ping") {
      return jsonResponse({
        status: "ok",
        message: "¡Conexión exitosa con Sempiterno Google Sheets API! 🐭❤️",
        timestamp: new Date().toISOString()
      });
    }

    if (action === "getAll") {
      var data = getAllDataFromSheets();
      return jsonResponse({
        status: "ok",
        data: data
      });
    }

    return jsonResponse({ status: "error", message: "Acción no reconocida" }, 400);
  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() }, 500);
  }
}

// ------------------------------------------------------------------------------
// MANEJO DE SOLICITUDES POST
// ------------------------------------------------------------------------------
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ status: "error", message: "Sin contenido en el cuerpo del request" }, 400);
    }

    var payload = JSON.parse(e.postData.contents);
    var action = payload.action || "syncAll";

    // 1. Subida directa de foto a Google Drive
    if (action === "uploadPhoto") {
      var base64Data = payload.base64Data; // data:image/jpeg;base64,....
      var filename = payload.filename || ("foto_" + new Date().getTime() + ".jpg");

      var fileUrl = saveBase64ImageToDrive(base64Data, filename);
      return jsonResponse({
        status: "ok",
        fileUrl: fileUrl,
        message: "Foto guardada exitosamente en Google Drive 📸"
      });
    }

    // 2. Sincronización completa de datos
    if (action === "syncAll") {
      var dataToSync = payload.data;
      if (!dataToSync) {
        return jsonResponse({ status: "error", message: "Faltan datos para sincronizar" }, 400);
      }

      saveAllDataToSheets(dataToSync);
      return jsonResponse({
        status: "ok",
        message: "Datos sincronizados correctamente en Google Sheets ✨",
        timestamp: new Date().toISOString()
      });
    }

    return jsonResponse({ status: "error", message: "Acción POST no reconocida" }, 400);
  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() }, 500);
  }
}

// ------------------------------------------------------------------------------
// FUNCIONES DE HOJAS DE CÁLCULO
// ------------------------------------------------------------------------------
function getOrCreateSheet(sheetName, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#FFF3CD");
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function getAllDataFromSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Settings
  var settingsSheet = getOrCreateSheet("Ajustes", ["Key", "Value"]);
  var settingsRows = settingsSheet.getDataRange().getValues();
  var settings = null;
  for (var i = 1; i < settingsRows.length; i++) {
    if (settingsRows[i][0] === "app_settings" && settingsRows[i][1]) {
      try {
        settings = JSON.parse(settingsRows[i][1]);
      } catch (e) {}
    }
  }

  // 2. Memories
  var memoriesSheet = getOrCreateSheet("Recuerdos", [
    "ID", "Titulo", "Fecha", "Categoria", "Ubicacion", "Rating",
    "Perspectiva_Gigio", "Perspectiva_Rosita", "Cancion", "Cancion_URL", "Fotos_JSON", "Tags_JSON"
  ]);
  var memoriesRows = memoriesSheet.getDataRange().getValues();
  var memories = [];
  for (var m = 1; m < memoriesRows.length; m++) {
    var row = memoriesRows[m];
    if (!row[0]) continue;
    var photos = [];
    var tags = [];
    try { photos = JSON.parse(row[10]); } catch (e) { if (row[10]) photos = [row[10]]; }
    try { tags = JSON.parse(row[11]); } catch (e) {}

    memories.push({
      id: String(row[0]),
      title: String(row[1]),
      date: String(row[2]),
      category: String(row[3]),
      location: String(row[4]),
      rating: Number(row[5]) || 5,
      perspectiveGigio: String(row[6]),
      perspectiveRosita: String(row[7]),
      songTitle: row[8] ? String(row[8]) : undefined,
      songUrl: row[9] ? String(row[9]) : undefined,
      photos: photos,
      tags: tags
    });
  }

  // 3. Plans
  var plansSheet = getOrCreateSheet("Planes", [
    "ID", "Titulo", "Descripcion", "Categoria", "Presupuesto", "Estado",
    "Fecha_Agendada", "Hora_Agendada", "Lugar", "Dress_Code", "Nota_Sorpresa", "Tag", "Creado"
  ]);
  var plansRows = plansSheet.getDataRange().getValues();
  var plans = [];
  for (var p = 1; p < plansRows.length; p++) {
    var pRow = plansRows[p];
    if (!pRow[0]) continue;
    plans.push({
      id: String(pRow[0]),
      title: String(pRow[1]),
      description: String(pRow[2] || ""),
      category: String(pRow[3]),
      budget: String(pRow[4]),
      status: String(pRow[5]),
      scheduledDate: pRow[6] ? String(pRow[6]) : undefined,
      scheduledTime: pRow[7] ? String(pRow[7]) : undefined,
      location: pRow[8] ? String(pRow[8]) : undefined,
      dressCode: pRow[9] ? String(pRow[9]) : undefined,
      surpriseNote: pRow[10] ? String(pRow[10]) : undefined,
      tag: pRow[11] ? String(pRow[11]) : undefined,
      createdAt: pRow[12] ? String(pRow[12]) : new Date().toISOString()
    });
  }

  // 4. Places
  var placesSheet = getOrCreateSheet("Lugares", [
    "ID", "Nombre", "Categoria", "Estado", "Zona", "Que_Pedimos",
    "Resena", "Volver", "Rating", "Presupuesto", "Foto_URL", "Google_Maps"
  ]);
  var placesRows = placesSheet.getDataRange().getValues();
  var places = [];
  for (var pl = 1; pl < placesRows.length; pl++) {
    var plRow = placesRows[pl];
    if (!plRow[0]) continue;
    places.push({
      id: String(plRow[0]),
      name: String(plRow[1]),
      category: String(plRow[2]),
      status: String(plRow[3]),
      zone: String(plRow[4] || ""),
      whatWeOrdered: plRow[5] ? String(plRow[5]) : undefined,
      review: plRow[6] ? String(plRow[6]) : undefined,
      wouldReturn: String(plRow[7] || "¡Sí o sí!"),
      rating: plRow[8] ? Number(plRow[8]) : undefined,
      priceRange: String(plRow[9] || "$$"),
      imageUrl: plRow[10] ? String(plRow[10]) : undefined,
      googleMapsUrl: plRow[11] ? String(plRow[11]) : undefined
    });
  }

  // 5. Capsules
  var capsulesSheet = getOrCreateSheet("Capsulas", [
    "ID", "Titulo", "Remitente", "Destinatario", "Fecha_Desbloqueo",
    "Mensaje_Secreto", "Pista", "Creado", "Abierta"
  ]);
  var capsulesRows = capsulesSheet.getDataRange().getValues();
  var capsules = [];
  for (var c = 1; c < capsulesRows.length; c++) {
    var cRow = capsulesRows[c];
    if (!cRow[0]) continue;
    capsules.push({
      id: String(cRow[0]),
      title: String(cRow[1]),
      sender: String(cRow[2]),
      recipient: String(cRow[3]),
      unlockDate: String(cRow[4]),
      secretMessage: String(cRow[5]),
      hint: cRow[6] ? String(cRow[6]) : undefined,
      createdAt: cRow[7] ? String(cRow[7]) : new Date().toISOString(),
      isCustomOpened: Boolean(cRow[8])
    });
  }

  return {
    settings: settings,
    memories: memories,
    plans: plans,
    places: places,
    capsules: capsules
  };
}

function saveAllDataToSheets(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Settings
  if (data.settings) {
    var settingsSheet = getOrCreateSheet("Ajustes", ["Key", "Value"]);
    settingsSheet.clearContents();
    settingsSheet.appendRow(["Key", "Value"]);
    settingsSheet.appendRow(["app_settings", JSON.stringify(data.settings)]);
  }

  // 2. Memories
  if (data.memories && Array.isArray(data.memories)) {
    var memoriesSheet = getOrCreateSheet("Recuerdos", [
      "ID", "Titulo", "Fecha", "Categoria", "Ubicacion", "Rating",
      "Perspectiva_Gigio", "Perspectiva_Rosita", "Cancion", "Cancion_URL", "Fotos_JSON", "Tags_JSON"
    ]);
    memoriesSheet.clearContents();
    memoriesSheet.appendRow([
      "ID", "Titulo", "Fecha", "Categoria", "Ubicacion", "Rating",
      "Perspectiva_Gigio", "Perspectiva_Rosita", "Cancion", "Cancion_URL", "Fotos_JSON", "Tags_JSON"
    ]);

    for (var i = 0; i < data.memories.length; i++) {
      var m = data.memories[i];
      memoriesSheet.appendRow([
        m.id || "",
        m.title || "",
        m.date || "",
        m.category || "",
        m.location || "",
        m.rating || 5,
        m.perspectiveGigio || "",
        m.perspectiveRosita || "",
        m.songTitle || "",
        m.songUrl || "",
        JSON.stringify(m.photos || []),
        JSON.stringify(m.tags || [])
      ]);
    }
  }

  // 3. Plans
  if (data.plans && Array.isArray(data.plans)) {
    var plansSheet = getOrCreateSheet("Planes", [
      "ID", "Titulo", "Descripcion", "Categoria", "Presupuesto", "Estado",
      "Fecha_Agendada", "Hora_Agendada", "Lugar", "Dress_Code", "Nota_Sorpresa", "Tag", "Creado"
    ]);
    plansSheet.clearContents();
    plansSheet.appendRow([
      "ID", "Titulo", "Descripcion", "Categoria", "Presupuesto", "Estado",
      "Fecha_Agendada", "Hora_Agendada", "Lugar", "Dress_Code", "Nota_Sorpresa", "Tag", "Creado"
    ]);

    for (var j = 0; j < data.plans.length; j++) {
      var p = data.plans[j];
      plansSheet.appendRow([
        p.id || "",
        p.title || "",
        p.description || "",
        p.category || "",
        p.budget || "$$",
        p.status || "Idea / Antojo",
        p.scheduledDate || "",
        p.scheduledTime || "",
        p.location || "",
        p.dressCode || "",
        p.surpriseNote || "",
        p.tag || "",
        p.createdAt || new Date().toISOString()
      ]);
    }
  }

  // 4. Places
  if (data.places && Array.isArray(data.places)) {
    var placesSheet = getOrCreateSheet("Lugares", [
      "ID", "Nombre", "Categoria", "Estado", "Zona", "Que_Pedimos",
      "Resena", "Volver", "Rating", "Presupuesto", "Foto_URL", "Google_Maps"
    ]);
    placesSheet.clearContents();
    placesSheet.appendRow([
      "ID", "Nombre", "Categoria", "Estado", "Zona", "Que_Pedimos",
      "Resena", "Volver", "Rating", "Presupuesto", "Foto_URL", "Google_Maps"
    ]);

    for (var k = 0; k < data.places.length; k++) {
      var pl = data.places[k];
      placesSheet.appendRow([
        pl.id || "",
        pl.name || "",
        pl.category || "",
        pl.status || "Por conocer",
        pl.zone || "",
        pl.whatWeOrdered || "",
        pl.review || "",
        pl.wouldReturn || "¡Sí o sí!",
        pl.rating || "",
        pl.priceRange || "$$",
        pl.imageUrl || "",
        pl.googleMapsUrl || ""
      ]);
    }
  }

  // 5. Capsules
  if (data.capsules && Array.isArray(data.capsules)) {
    var capsulesSheet = getOrCreateSheet("Capsulas", [
      "ID", "Titulo", "Remitente", "Destinatario", "Fecha_Desbloqueo",
      "Mensaje_Secreto", "Pista", "Creado", "Abierta"
    ]);
    capsulesSheet.clearContents();
    capsulesSheet.appendRow([
      "ID", "Titulo", "Remitente", "Destinatario", "Fecha_Desbloqueo",
      "Mensaje_Secreto", "Pista", "Creado", "Abierta"
    ]);

    for (var l = 0; l < data.capsules.length; l++) {
      var c = data.capsules[l];
      capsulesSheet.appendRow([
        c.id || "",
        c.title || "",
        c.sender || "Gigio",
        c.recipient || "Rosita",
        c.unlockDate || "",
        c.secretMessage || "",
        c.hint || "",
        c.createdAt || new Date().toISOString(),
        c.isCustomOpened ? 1 : 0
      ]);
    }
  }
}

// ------------------------------------------------------------------------------
// SUBIDA DE FOTOS A GOOGLE DRIVE
// ------------------------------------------------------------------------------
function saveBase64ImageToDrive(base64Data, filename) {
  var contentType = "image/jpeg";
  var rawBytes = base64Data;

  if (base64Data.indexOf(";base64,") !== -1) {
    var parts = base64Data.split(";base64,");
    contentType = parts[0].split(":")[1] || "image/jpeg";
    rawBytes = parts[1];
  }

  var decodedBytes = Utilities.base64Decode(rawBytes);
  var blob = Utilities.newBlob(decodedBytes, contentType, filename);

  // Obtener o crear carpeta en Google Drive
  var folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  var targetFolder;
  if (folders.hasNext()) {
    targetFolder = folders.next();
  } else {
    targetFolder = DriveApp.createFolder(DRIVE_FOLDER_NAME);
    targetFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }

  var file = targetFolder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // Retornar enlace web directo o thumbnail para visualización en la app
  return "https://lh3.googleusercontent.com/d/" + file.getId();
}

// ------------------------------------------------------------------------------
// RESPUESTA JSON CON CABECERAS
// ------------------------------------------------------------------------------
function jsonResponse(data, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
