import { CoupleSettings, Memory, Plan, Place, TimeCapsule } from '../types';

export interface GoogleSheetsSyncData {
  settings?: CoupleSettings;
  memories?: Memory[];
  plans?: Plan[];
  places?: Place[];
  capsules?: TimeCapsule[];
}

export async function testGoogleSheetsConnection(
  scriptUrl: string
): Promise<{ ok: boolean; message: string }> {
  try {
    if (!scriptUrl || !scriptUrl.trim().startsWith('http')) {
      return { ok: false, message: 'URL de Google Apps Script no válida' };
    }

    const testUrl = `${scriptUrl.trim()}${scriptUrl.includes('?') ? '&' : '?'}action=ping`;
    const res = await fetch(testUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      return { ok: false, message: `Error HTTP ${res.status}` };
    }

    const data = await res.json();
    if (data.status === 'ok') {
      return { ok: true, message: data.message || 'Conectado a Google Sheets' };
    }
    return { ok: false, message: data.message || 'Respuesta inesperada' };
  } catch (err: any) {
    return { ok: false, message: err.message || 'No se pudo conectar con el script' };
  }
}

export async function fetchFromGoogleSheets(
  scriptUrl: string
): Promise<GoogleSheetsSyncData | null> {
  try {
    if (!scriptUrl || !scriptUrl.trim().startsWith('http')) return null;

    const fetchUrl = `${scriptUrl.trim()}${scriptUrl.includes('?') ? '&' : '?'}action=getAll`;
    const res = await fetch(fetchUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) return null;

    const json = await res.json();
    if (json.status === 'ok' && json.data) {
      return json.data as GoogleSheetsSyncData;
    }
    return null;
  } catch (err) {
    console.warn('Fallback a almacenamiento local tras error en Google Sheets:', err);
    return null;
  }
}

export async function syncToGoogleSheets(
  scriptUrl: string,
  data: GoogleSheetsSyncData
): Promise<boolean> {
  try {
    if (!scriptUrl || !scriptUrl.trim().startsWith('http')) return false;

    // Use text/plain or POST with JSON string to avoid preflight issues in GAS
    const payload = {
      action: 'syncAll',
      data: data,
    };

    const res = await fetch(scriptUrl.trim(), {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!res.ok) return false;
    const json = await res.json();
    return json.status === 'ok';
  } catch (err) {
    console.warn('No se pudo enviar la sincronización a Google Sheets:', err);
    return false;
  }
}

export async function uploadPhotoToGoogleDrive(
  scriptUrl: string,
  file: File
): Promise<string | null> {
  try {
    if (!scriptUrl || !scriptUrl.trim().startsWith('http')) {
      throw new Error('Primero debes configurar la URL de tu Google Apps Script en Ajustes');
    }

    // Convert file to base64
    const base64 = await fileToBase64(file);

    const payload = {
      action: 'uploadPhoto',
      base64Data: base64,
      filename: `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
    };

    const res = await fetch(scriptUrl.trim(), {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Error en servidor: HTTP ${res.status}`);

    const json = await res.json();
    if (json.status === 'ok' && json.fileUrl) {
      return json.fileUrl;
    }

    throw new Error(json.message || 'No se obtuvo URL de Google Drive');
  } catch (err) {
    console.error('Error subiendo foto a Google Drive:', err);
    throw err;
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}
