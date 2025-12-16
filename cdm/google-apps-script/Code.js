/**
 * MJTranscripciones - CDM Proxy Script
 * 
 * Este script actúa como API Proxy para interactuar con la Google Sheet.
 * Maneja tanto las operaciones de lectura (Viewer) como las de escritura (Procesamiento).
 * 
 * ENDPOINTS (vía "path" parameter o "action"):
 * GET / (action=info) -> Status info
 * GET /read (action=read) -> Listar transcripciones
 * GET /getText (action=getText) -> Obtener contenido texto
 * GET /config (action=config) -> Leer configuración
 * POST /update (action=update) -> Actualizar resumen
 * POST /transcripcion (action=create) -> Guardar nueva transcripción
 * POST /log (action=log) -> Guardar log
 */

function doGet(e) {
    return handleRequest(e);
}

function doPost(e) {
    return handleRequest(e);
}

function handleRequest(e) {
    var lock = LockService.getScriptLock();
    // Wait for up to 30 seconds for other processes to finish.
    lock.tryLock(30000);

    try {
        var params = e.parameter || {};
        // Detect action from 'action' param OR 'path' param (for compatibility)
        var action = params.action || params.path || 'info';

        // Normalize action
        if (action.indexOf('/') === 0) action = action.substring(1); // remove leading slash

        var result = null;

        switch (action) {
            case 'info':
            case '':
                result = getInfo();
                break;
            case 'read':
                result = readTranscriptions();
                break;
            case 'getText':
                result = getTextContent(params.id);
                break;
            case 'config':
                result = getConfig();
                break;
            case 'update': // POST usually, but keeping GET fallback if needed or strict separation
                if (e.postData) {
                    var body = JSON.parse(e.postData.contents);
                    result = updateResumen(body.id, body.resumen);
                } else {
                    result = updateResumen(params.id, params.resumen);
                }
                break;
            case 'transcripcion':
            case 'create':
                var data = e.postData ? JSON.parse(e.postData.contents) : params;
                result = createTranscription(data);
                break;
            case 'log':
                var data = e.postData ? JSON.parse(e.postData.contents) : params;
                result = logEvent(data);
                break;
            default:
                throw new Error("Action not recognized: " + action);
        }

        return ContentService.createTextOutput(JSON.stringify(result))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        var errorResponse = {
            status: 'error',
            message: error.toString(),
            stack: error.stack
        };
        return ContentService.createTextOutput(JSON.stringify(errorResponse))
            .setMimeType(ContentService.MimeType.JSON);
    } finally {
        lock.releaseLock();
    }
}

// --- CORE FUNCTIONS ---

function getInfo() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet();
    return {
        status: 'ok',
        sheetName: sheet.getName(),
        time: new Date().toISOString(),
        user: Session.getActiveUser().getEmail()
    };
}

function readTranscriptions() {
    var sheet = getSheet('Transcripciones'); // User said "Transcripciones" tab
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var rows = data.slice(1);

    // Simple check for data
    if (rows.length === 0) return [];

    // Map to objects (assuming standard headers or dynamic)
    // For basic compatibility, we accept whatever columns exist
    var list = rows.map(function (row) {
        var item = {};
        headers.forEach(function (header, index) {
            item[header] = row[index];
        });
        return item;
    });

    return list;
}

function getTextContent(id) {
    // Logic to get text content. 
    // If content is in Drive, we need 'driveId' column.
    // If content is in Cell, we need 'text' column.
    // Let's assume 'file_id' matches row 'id' and we return metadata + content path

    // Reuse readTranscriptions to find the row
    var list = readTranscriptions();
    var item = list.find(r => r.id == id || r.ID == id);

    if (!item) throw new Error("Item not found");

    // IMPORTANT: For full text, if stored in Drive, we should fetch it here 
    // OR return the content if it's small.
    // For now, returning the item data.
    return item;
}

function updateResumen(id, resumen) {
    var sheet = getSheet('Transcripciones');
    var data = sheet.getDataRange().getValues();
    var headers = data[0];

    // Find column "id" and "resumen"
    var idCol = headers.indexOf('id');
    if (idCol === -1) idCol = headers.indexOf('ID');

    var resumenCol = headers.indexOf('resumen');
    if (resumenCol === -1) resumenCol = headers.indexOf('Resumen'); // try case insensitive?

    if (idCol === -1 || resumenCol === -1) throw new Error("Columns ID or Resumen not found");

    for (var i = 1; i < data.length; i++) {
        if (data[i][idCol] == id) {
            sheet.getRange(i + 1, resumenCol + 1).setValue(resumen); // +1 for 1-based index
            return { status: 'success', id: id, updated: true };
        }
    }

    throw new Error("ID not found for update");
}

function createTranscription(data) {
    var sheet = getSheet('Transcripciones');
    var headers = sheet.getDataRange().getValues()[0];

    // Prepare row based on headers
    var row = [];
    headers.forEach(function (header) {
        row.push(data[header] || '');
    });

    sheet.appendRow(row);
    return { status: 'success', created: true };
}

function logEvent(data) {
    var sheet = getSheet('Logs'); // User said "Logs"
    sheet.appendRow([new Date(), JSON.stringify(data)]);
    return { status: 'logged' };
}

function getConfig() {
    var sheet = getSheet('Config'); // User said "Config"
    var data = sheet.getDataRange().getValues();
    // Assume Key | Value
    var config = {};
    for (var i = 1; i < data.length; i++) {
        config[data[i][0]] = data[i][1];
    }
    return config;
}

// --- HELPER ---
function getSheet(name) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
        // Try to create it if missing? Or throw?
        // User template should have it.
        throw new Error("Sheet '" + name + "' not found");
    }
    return sheet;
}
