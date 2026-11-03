import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Settings as SettingsIcon, 
  Download, 
  Upload, 
  RotateCcw, 
  Calendar, 
  Cloud, 
  CloudCheck, 
  RefreshCw, 
  FileSpreadsheet, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { CoupleSettings } from '../types';
import { downloadBackupFile, importBackupData } from '../utils/storage';
import { testGoogleSheetsConnection, syncToGoogleSheets } from '../utils/googleSheets';
import { fireHeartConfetti, fireSuperCelebration } from '../utils/confetti';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: CoupleSettings;
  onSaveSettings: (settings: CoupleSettings) => void;
  onResetAllData: () => void;
  onReloadAllData: () => void;
  onTriggerSync?: () => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onResetAllData,
  onReloadAllData,
  onTriggerSync,
}) => {
  const [startDate, setStartDate] = useState(settings.startDate.split('T')[0]);
  const [partner1Name, setPartner1Name] = useState(settings.partner1.name);
  const [partner1Nick, setPartner1Nick] = useState(settings.partner1.nickname);
  const [partner2Name, setPartner2Name] = useState(settings.partner2.name);
  const [partner2Nick, setPartner2Nick] = useState(settings.partner2.nickname);
  const [ratingStyle, setRatingStyle] = useState<'cheese' | 'heart'>(settings.ratingStyle);
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState(settings.googleSheetsUrl || '');
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTestConnection = async () => {
    if (!googleSheetsUrl.trim()) {
      setTestResult({ ok: false, message: 'Ingresa la URL de tu Google Apps Script primero' });
      return;
    }
    setIsTestingConn(true);
    setTestResult(null);
    const res = await testGoogleSheetsConnection(googleSheetsUrl);
    setIsTestingConn(false);
    setTestResult(res);
    if (res.ok) {
      fireHeartConfetti();
    }
  };

  const handleManualSync = async () => {
    if (!onTriggerSync) return;
    setIsSyncingNow(true);
    await onTriggerSync();
    setIsSyncingNow(false);
    fireSuperCelebration();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      ...settings,
      startDate: `${startDate}T19:30:00`,
      partner1: {
        ...settings.partner1,
        name: partner1Name.trim(),
        nickname: partner1Nick.trim(),
      },
      partner2: {
        ...settings.partner2,
        name: partner2Name.trim(),
        nickname: partner2Nick.trim(),
      },
      ratingStyle,
      googleSheetsUrl: googleSheetsUrl.trim() || undefined,
    });
    fireHeartConfetti();
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importBackupData(content);
        if (success) {
          setImportStatus('¡Datos importados con éxito!');
          fireHeartConfetti();
          setTimeout(() => {
            onReloadAllData();
            onClose();
          }, 1200);
        } else {
          setImportStatus('Error: Archivo inválido');
        }
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-carbon/75 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className="w-full max-w-lg bg-cream dark:bg-nightCard border-3 border-carbon rounded-3xl p-5 sm:p-7 shadow-neo-xl my-8 relative"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-white dark:bg-nightSurface border-2 border-carbon rounded-full hover:bg-rosePastel shadow-neo-sm"
        >
          <X className="w-4 h-4 text-carbon dark:text-cream" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <SettingsIcon className="w-6 h-6 text-coral" />
          <h2 className="font-display text-xl sm:text-2xl font-black text-carbon dark:text-cream">
            Ajustes & Copia de Seguridad
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
          {/* Start Date */}
          <div>
            <label className="block font-bold text-carbon dark:text-cream mb-1 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-coral" />
              <span>Fecha de Inicio de Nuestra Relación:</span>
            </label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="neo-input w-full"
            />
          </div>

          {/* Partner 1 Info */}
          <div className="p-3 bg-white dark:bg-nightSurface border-2 border-carbon rounded-2xl">
            <span className="text-xs font-bold text-coral block mb-2">
              🐭 Perfil de Gigio (Él):
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-carbon/70 dark:text-cream/70 block mb-0.5">
                  Nombre
                </label>
                <input
                  type="text"
                  value={partner1Name}
                  onChange={(e) => setPartner1Name(e.target.value)}
                  className="neo-input w-full text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-carbon/70 dark:text-cream/70 block mb-0.5">
                  Apodo
                </label>
                <input
                  type="text"
                  value={partner1Nick}
                  onChange={(e) => setPartner1Nick(e.target.value)}
                  className="neo-input w-full text-xs"
                />
              </div>
            </div>
          </div>

          {/* Partner 2 Info */}
          <div className="p-3 bg-white dark:bg-nightSurface border-2 border-carbon rounded-2xl">
            <span className="text-xs font-bold text-coral block mb-2">
              🎀 Perfil de Rosita (Ella):
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-carbon/70 dark:text-cream/70 block mb-0.5">
                  Nombre
                </label>
                <input
                  type="text"
                  value={partner2Name}
                  onChange={(e) => setPartner2Name(e.target.value)}
                  className="neo-input w-full text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-carbon/70 dark:text-cream/70 block mb-0.5">
                  Apodo
                </label>
                <input
                  type="text"
                  value={partner2Nick}
                  onChange={(e) => setPartner2Nick(e.target.value)}
                  className="neo-input w-full text-xs"
                />
              </div>
            </div>
          </div>

          {/* Rating style selection */}
          <div>
            <label className="block font-bold text-carbon dark:text-cream mb-1">
              Icono de Calificación Predeterminado:
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRatingStyle('cheese')}
                className={`flex-1 py-2 text-xs font-bold border-2 border-carbon rounded-xl flex items-center justify-center gap-2 ${
                  ratingStyle === 'cheese'
                    ? 'bg-butter text-carbon shadow-neo-sm'
                    : 'bg-white dark:bg-nightSurface text-carbon dark:text-cream'
                }`}
              >
                <span>🧀 Quesitos (Gigio)</span>
              </button>
              <button
                type="button"
                onClick={() => setRatingStyle('heart')}
                className={`flex-1 py-2 text-xs font-bold border-2 border-carbon rounded-xl flex items-center justify-center gap-2 ${
                  ratingStyle === 'heart'
                    ? 'bg-rosePastel text-carbon shadow-neo-sm'
                    : 'bg-white dark:bg-nightSurface text-carbon dark:text-cream'
                }`}
              >
                <span>❤️ Corazones</span>
              </button>
            </div>
          </div>

          {/* GOOGLE SHEETS & DRIVE SYNC SECTION */}
          <div className="p-4 bg-gradient-to-r from-butter-light via-cream to-rosePastel-light dark:from-nightSurface dark:to-nightCard border-3 border-carbon rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">📊</span>
                <span className="font-display font-black text-sm text-carbon dark:text-cream">
                  Nube: Google Sheets & Google Drive
                </span>
              </div>
              {settings.googleSheetsUrl ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sage text-carbon border border-carbon flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-green-700" /> Conectado
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-butter text-carbon border border-carbon">
                  ⚠️ Solo Local
                </span>
              )}
            </div>

            <p className="text-[11px] text-carbon/75 dark:text-cream/75 font-medium leading-relaxed">
              Sincroniza tus recuerdos y planes en vivo con tu pareja y guarda fotos automáticamente en tu Google Drive.
            </p>

            <div>
              <label className="text-[11px] font-bold text-carbon dark:text-cream block mb-1">
                URL de tu Google Apps Script (Web App):
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={googleSheetsUrl}
                  onChange={(e) => setGoogleSheetsUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="neo-input flex-1 text-xs"
                />
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTestingConn}
                  className="neo-btn-secondary text-xs px-3 py-2 shrink-0 flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingConn ? 'animate-spin' : ''}`} />
                  <span>Probar</span>
                </button>
              </div>
            </div>

            {testResult && (
              <div
                className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                  testResult.ok
                    ? 'bg-sage/70 border-carbon text-carbon'
                    : 'bg-rosePastel-light border-carbon text-carbon'
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            {/* Quick action buttons */}
            <div className="flex items-center gap-2 pt-1">
              {googleSheetsUrl && (
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncingNow}
                  className="neo-btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncingNow ? 'animate-spin' : ''}`} />
                  <span>{isSyncingNow ? 'Sincronizando...' : 'Sincronizar a Google Sheets ahora'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowInstructions(!showInstructions)}
                className="text-[11px] font-bold text-coral underline ml-auto flex items-center gap-0.5"
              >
                <span>{showInstructions ? 'Ocultar guía' : '¿Cómo obtener mi URL? (3 min)'}</span>
                {showInstructions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>

            {/* Accordion Instructions */}
            <AnimatePresence>
              {showInstructions && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden pt-2"
                >
                  <div className="p-3 bg-white dark:bg-nightCard border border-carbon rounded-xl text-[11px] space-y-1.5 text-carbon/80 dark:text-cream/80">
                    <p className="font-bold text-coral">Paso a paso súper fácil:</p>
                    <ol className="list-decimal pl-4 space-y-1 font-medium">
                      <li>Crea una hoja en blanco en <strong>Google Sheets</strong> (llámala <em>Sempiterno</em>).</li>
                      <li>Haz clic en el menú: <strong>Extensiones &gt; Apps Script</strong>.</li>
                      <li>Copia el archivo <code className="bg-cream px-1 py-0.5 rounded border border-carbon">google-apps-script.js</code> que creamos en tu proyecto y pégalo allí.</li>
                      <li>Haz clic en el botón azul <strong>Implementar &gt; Nueva implementación</strong>.</li>
                      <li>Tipo: <strong>Aplicación web</strong>. Ejecutar como: <em>Yo</em>. Quién tiene acceso: <strong>Cualquier persona</strong>.</li>
                      <li>Copia la URL que termina en <code className="bg-cream px-1 py-0.5 rounded border border-carbon">/exec</code> y pégala aquí arriba. ¡Listo! 🐭❤️</li>
                    </ol>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Backup / Export / Import */}
          <div className="pt-3 border-t-2 border-carbon/20">
            <span className="font-bold text-carbon dark:text-cream block mb-2">
              Respaldo de Datos (Para no perder sus recuerdos):
            </span>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={downloadBackupFile}
                className="neo-btn-secondary py-2 px-3 text-xs flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar JSON</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="neo-btn-white py-2 px-3 text-xs flex items-center justify-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Importar JSON</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {importStatus && (
              <p className="text-xs font-bold text-coral text-center mt-2">
                {importStatus}
              </p>
            )}
          </div>

          {/* Reset to initial mock data */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                if (confirm('¿Restablecer todos los datos a los valores de prueba originales? Se sobreescribirán los cambios.')) {
                  onResetAllData();
                  onClose();
                }
              }}
              className="text-[11px] font-semibold text-carbon/60 dark:text-cream/60 hover:text-coral flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restablecer datos de prueba iniciales</span>
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-carbon/20">
            <button
              type="button"
              onClick={onClose}
              className="neo-btn-white py-2 px-4 text-xs"
            >
              Cerrar
            </button>
            <button
              type="submit"
              className="neo-btn-primary py-2 px-5 text-xs font-bold"
            >
              Guardar Ajustes
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
