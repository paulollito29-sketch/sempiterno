import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  X, 
  Settings as SettingsIcon, 
  Download, 
  Upload, 
  Calendar, 
  CheckCircle2, 
  Sparkles,
  Zap
} from 'lucide-react';
import { CoupleSettings } from '../types';
import { downloadBackupFile, importBackupData } from '../utils/storage';
import { fireHeartConfetti } from '../utils/confetti';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: CoupleSettings;
  onSaveSettings: (settings: CoupleSettings) => void;
  onResetAllData: () => void;
  onReloadAllData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onReloadAllData,
}) => {
  const [startDate, setStartDate] = useState(settings.startDate.split('T')[0] || '2026-06-04');
  const [partner1Name, setPartner1Name] = useState(settings.partner1?.name || 'Paulo');
  const [partner1Nick, setPartner1Nick] = useState(settings.partner1?.nickname || 'Gigio');
  const [partner2Name, setPartner2Name] = useState(settings.partner2?.name || 'Alexandra');
  const [partner2Nick, setPartner2Nick] = useState(settings.partner2?.nickname || 'Rosita');
  const [ratingStyle, setRatingStyle] = useState<'cheese' | 'heart'>(settings.ratingStyle || 'cheese');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      ...settings,
      startDate: `${startDate}T00:00:00`,
      partner1: {
        ...settings.partner1,
        name: partner1Name.trim() || 'Paulo',
        nickname: partner1Nick.trim() || 'Gigio',
      },
      partner2: {
        ...settings.partner2,
        name: partner2Name.trim() || 'Alexandra',
        nickname: partner2Nick.trim() || 'Rosita',
      },
      ratingStyle,
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
      const success = importBackupData(content);
      if (success) {
        setImportStatus('¡Datos importados con éxito! 🐭❤️');
        onReloadAllData();
        fireHeartConfetti();
      } else {
        setImportStatus('Error al importar el archivo JSON.');
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2.5 sm:p-4 bg-carbon/75 backdrop-blur-sm overflow-y-auto overscroll-contain">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="neo-modal w-full max-w-lg my-2 sm:my-8 bg-cream dark:bg-nightCard border-3 border-carbon shadow-neo-lg rounded-3xl p-5 sm:p-6 max-h-[92dvh] sm:max-h-[88vh] overflow-y-auto flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-carbon/20">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-coral/20 border-2 border-carbon">
              <SettingsIcon className="w-5 h-5 text-coral" />
            </div>
            <div>
              <h3 className="font-display font-black text-lg text-carbon dark:text-cream">
                Ajustes de Pareja 🐭❤️🎀
              </h3>
              <p className="text-xs text-carbon/70 dark:text-cream/70 font-medium">
                Personaliza sus apodos y su fecha de aniversario
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl border-2 border-carbon hover:bg-rosePastel-light transition-colors"
          >
            <X className="w-4 h-4 text-carbon" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs sm:text-sm">
          {/* Cloud Status Badge */}
          <div className="p-3 bg-sage/50 border-2 border-carbon rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-green-500/20 border border-carbon rounded-lg text-green-700">
                <Zap className="w-4 h-4 fill-green-600" />
              </div>
              <div>
                <span className="font-display font-black text-xs text-carbon dark:text-cream flex items-center gap-1">
                  Nube de Paulo & Ale Activa
                  <Sparkles className="w-3 h-3 text-coral" />
                </span>
                <span className="text-[10px] text-carbon/70 dark:text-cream/70 block">
                  Todo lo que guardes aquí se sincroniza en ambos teléfonos al instante
                </span>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sage text-carbon border border-carbon flex items-center gap-1 shrink-0">
              <CheckCircle2 className="w-3 h-3 text-green-700" /> En Vivo
            </span>
          </div>

          {/* Anniversary Date / Contador Sempiterno */}
          <div className="p-3.5 bg-butter-light dark:bg-nightSurface border-2 border-carbon rounded-2xl space-y-1.5">
            <label className="flex items-center gap-1.5 font-display font-black text-xs text-carbon dark:text-cream">
              <Calendar className="w-4 h-4 text-coral" />
              <span>Fecha Oficial de Aniversario (Contador Sempiterno):</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="neo-input w-full font-bold text-sm bg-white dark:bg-night"
              required
            />
            <p className="text-[11px] text-carbon/70 dark:text-cream/70 font-medium">
              Al guardar, se actualiza el contador en el teléfono de Paulo y en el de Alexandra.
            </p>
          </div>

          {/* Profiles: Paulo & Alexandra */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Partner 1 Info (Paulo / Gigio) */}
            <div className="p-3 bg-white dark:bg-nightSurface border-2 border-carbon rounded-2xl space-y-2">
              <span className="text-xs font-bold text-coral flex items-center gap-1">
                🐭 Perfil de Paulo (Gigio):
              </span>
              <div>
                <label className="text-[11px] font-semibold text-carbon/70 dark:text-cream/70 block mb-0.5">
                  Nombre
                </label>
                <input
                  type="text"
                  value={partner1Name}
                  onChange={(e) => setPartner1Name(e.target.value)}
                  className="neo-input w-full text-xs"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-carbon/70 dark:text-cream/70 block mb-0.5">
                  Apodo romántico
                </label>
                <input
                  type="text"
                  value={partner1Nick}
                  onChange={(e) => setPartner1Nick(e.target.value)}
                  className="neo-input w-full text-xs"
                  required
                />
              </div>
            </div>

            {/* Partner 2 Info (Alexandra / Rosita) */}
            <div className="p-3 bg-white dark:bg-nightSurface border-2 border-carbon rounded-2xl space-y-2">
              <span className="text-xs font-bold text-coral flex items-center gap-1">
                🎀 Perfil de Alexandra (Rosita):
              </span>
              <div>
                <label className="text-[11px] font-semibold text-carbon/70 dark:text-cream/70 block mb-0.5">
                  Nombre
                </label>
                <input
                  type="text"
                  value={partner2Name}
                  onChange={(e) => setPartner2Name(e.target.value)}
                  className="neo-input w-full text-xs"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-carbon/70 dark:text-cream/70 block mb-0.5">
                  Apodo romántico
                </label>
                <input
                  type="text"
                  value={partner2Nick}
                  onChange={(e) => setPartner2Nick(e.target.value)}
                  className="neo-input w-full text-xs"
                  required
                />
              </div>
            </div>
          </div>

          {/* Rating style selection */}
          <div>
            <label className="block font-bold text-carbon dark:text-cream mb-1 text-xs">
              Icono de Calificación de Citas:
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

          {/* Backup / Export / Import */}
          <div className="pt-2 border-t-2 border-carbon/20">
            <span className="font-bold text-carbon dark:text-cream block mb-1.5 text-xs">
              Respaldo en Archivo (Opcional):
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
              Guardar Ajustes para Ambos
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
