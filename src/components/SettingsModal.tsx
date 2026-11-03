import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Settings as SettingsIcon, 
  Download, 
  Upload, 
  RotateCcw, 
  Calendar, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  CheckCircle2, 
  AlertCircle,
  Database,
  Zap,
  Sparkles,
  Check
} from 'lucide-react';
import { CoupleSettings } from '../types';
import { downloadBackupFile, importBackupData } from '../utils/storage';
import { testGoogleSheetsConnection } from '../utils/googleSheets';
import { testSupabaseConnection } from '../utils/supabase';
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
  const [startDate, setStartDate] = useState(settings.startDate.split('T')[0] || '2026-06-04');
  const [partner1Name, setPartner1Name] = useState(settings.partner1.name);
  const [partner1Nick, setPartner1Nick] = useState(settings.partner1.nickname);
  const [partner2Name, setPartner2Name] = useState(settings.partner2.name);
  const [partner2Nick, setPartner2Nick] = useState(settings.partner2.nickname);
  const [ratingStyle, setRatingStyle] = useState<'cheese' | 'heart'>(settings.ratingStyle);

  // Supabase states
  const [supabaseUrl, setSupabaseUrl] = useState(settings.supabaseUrl || '');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(settings.supabaseAnonKey || '');
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [supabaseTestResult, setSupabaseTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSupabaseGuide, setShowSupabaseGuide] = useState(false);

  // Google Sheets states
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState(settings.googleSheetsUrl || '');
  const [isTestingSheets, setIsTestingSheets] = useState(false);
  const [sheetsTestResult, setSheetsTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showSheetsGuide, setShowSheetsGuide] = useState(false);

  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTestSupabase = async () => {
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      setSupabaseTestResult({ ok: false, message: 'Ingresa la URL y la Anon Key de Supabase' });
      return;
    }
    setIsTestingSupabase(true);
    setSupabaseTestResult(null);
    const res = await testSupabaseConnection(supabaseUrl.trim(), supabaseAnonKey.trim());
    setIsTestingSupabase(false);
    setSupabaseTestResult(res);
    if (res.ok) {
      fireSuperCelebration();
    }
  };

  const handleCopySql = () => {
    const sql = `-- SEMPITERNO SQL SETUP
CREATE TABLE IF NOT EXISTS public.sempiterno_settings (
  id TEXT PRIMARY KEY DEFAULT 'couple_main',
  start_date TEXT NOT NULL DEFAULT '2026-06-04T00:00:00',
  partner1 JSONB DEFAULT '{"name": "Paulo", "nickname": "Gigio", "role": "Gigio"}'::jsonb,
  partner2 JSONB DEFAULT '{"name": "Alexandra", "nickname": "Rosita", "role": "Rosita"}'::jsonb,
  rating_style TEXT DEFAULT 'cheese',
  dark_mode BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO public.sempiterno_settings (id, start_date) VALUES ('couple_main', '2026-06-04T00:00:00') ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.sempiterno_memories (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, date TEXT NOT NULL, category TEXT NOT NULL, photos JSONB DEFAULT '[]'::jsonb,
  location TEXT DEFAULT '', perspective_gigio TEXT DEFAULT '', perspective_rosita TEXT DEFAULT '', rating INTEGER DEFAULT 5,
  song_title TEXT, song_url TEXT, tags JSONB DEFAULT '[]'::jsonb, is_favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sempiterno_plans (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '', category TEXT NOT NULL, budget TEXT DEFAULT '$$',
  status TEXT NOT NULL, scheduled_date TEXT, scheduled_time TEXT, location TEXT, dress_code TEXT, surprise_note TEXT, tag TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sempiterno_places (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, status TEXT NOT NULL, zone TEXT DEFAULT '',
  what_we_ordered TEXT, review TEXT, would_return TEXT DEFAULT '¡Sí o sí!', rating INTEGER, price_range TEXT DEFAULT '$$',
  image_url TEXT, google_maps_url TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sempiterno_capsules (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, sender TEXT NOT NULL, recipient TEXT NOT NULL, unlock_date TEXT NOT NULL,
  secret_message TEXT NOT NULL, photos JSONB DEFAULT '[]'::jsonb, hint TEXT, is_custom_opened BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sempiterno_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sempiterno_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sempiterno_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sempiterno_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sempiterno_capsules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Público settings" ON public.sempiterno_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Público memories" ON public.sempiterno_memories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Público plans" ON public.sempiterno_plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Público places" ON public.sempiterno_places FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Público capsules" ON public.sempiterno_capsules FOR ALL USING (true) WITH CHECK (true);

BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE public.sempiterno_settings, public.sempiterno_memories, public.sempiterno_plans, public.sempiterno_places, public.sempiterno_capsules;
COMMIT;

INSERT INTO storage.buckets (id, name, public) VALUES ('sempiterno-photos', 'sempiterno-photos', true) ON CONFLICT (id) DO UPDATE SET public = true;
CREATE POLICY "Lectura fotos" ON storage.objects FOR SELECT USING (bucket_id = 'sempiterno-photos');
CREATE POLICY "Subida fotos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'sempiterno-photos');
`;
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleTestSheets = async () => {
    if (!googleSheetsUrl.trim()) {
      setSheetsTestResult({ ok: false, message: 'Ingresa la URL de tu Google Apps Script' });
      return;
    }
    setIsTestingSheets(true);
    setSheetsTestResult(null);
    const res = await testGoogleSheetsConnection(googleSheetsUrl);
    setIsTestingSheets(false);
    setSheetsTestResult(res);
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
      startDate: `${startDate}T00:00:00`,
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
      supabaseUrl: supabaseUrl.trim() || undefined,
      supabaseAnonKey: supabaseAnonKey.trim() || undefined,
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
      const res = importBackupData(content);
      if (res.success) {
        setImportStatus('¡Datos importados con éxito! 🐭❤️');
        onReloadAllData();
        fireHeartConfetti();
      } else {
        setImportStatus(`Error al importar: ${res.message}`);
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-carbon/50 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="neo-modal w-full max-w-lg my-8 bg-cream dark:bg-nightCard border-3 border-carbon shadow-neo-lg rounded-3xl p-5 sm:p-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-carbon/20">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-coral/20 border-2 border-carbon">
              <SettingsIcon className="w-5 h-5 text-coral" />
            </div>
            <div>
              <h3 className="font-display font-black text-lg text-carbon dark:text-cream">
                Ajustes & Sincronización
              </h3>
              <p className="text-xs text-carbon/70 dark:text-cream/70 font-medium">
                Contador Sempiterno y conexión en tiempo real
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
              El contador calcula en tiempo real los días, meses, horas y segundos a partir de esta fecha.
            </p>
          </div>

          {/* SUPABASE REALTIME SYNC (FEATURED & RECOMMENDED) */}
          <div className="p-4 bg-gradient-to-br from-sage-light via-cream to-butter-light dark:from-nightSurface dark:to-nightCard border-3 border-carbon rounded-2xl space-y-3 shadow-neo-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-green-500/20 border border-carbon rounded-lg text-green-700">
                  <Zap className="w-4 h-4 fill-green-600" />
                </div>
                <div>
                  <span className="font-display font-black text-sm text-carbon dark:text-cream flex items-center gap-1.5">
                    Supabase: Sincronización en Tiempo Real
                    <Sparkles className="w-3.5 h-3.5 text-coral" />
                  </span>
                  <span className="text-[10px] text-carbon/70 dark:text-cream/70 block">
                    Actualizaciones instantáneas entre el teléfono de Paulo y Alexandra
                  </span>
                </div>
              </div>
              {isSupabaseConfigured ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sage text-carbon border border-carbon flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-green-700" /> Activo
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-butter text-carbon border border-carbon shrink-0">
                  ⚡ Por conectar
                </span>
              )}
            </div>

            <div className="space-y-2 pt-1">
              <div>
                <label className="text-[11px] font-bold text-carbon dark:text-cream block mb-1">
                  Project URL de Supabase:
                </label>
                <input
                  type="url"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://xyzabcdefg.supabase.co"
                  className="neo-input w-full text-xs bg-white dark:bg-night"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-carbon dark:text-cream block mb-1">
                  Anon / Public API Key de Supabase:
                </label>
                <input
                  type="password"
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                  className="neo-input w-full text-xs font-mono bg-white dark:bg-night"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestSupabase}
                  disabled={isTestingSupabase}
                  className="neo-btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingSupabase ? 'animate-spin' : ''}`} />
                  <span>{isTestingSupabase ? 'Probando...' : 'Probar conexión'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopySql}
                  className="neo-btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5 text-green-700" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? '¡Copiado al portapapeles!' : 'Copiar Script SQL de Tablas'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowSupabaseGuide(!showSupabaseGuide)}
                  className="text-[11px] font-bold text-coral underline ml-auto flex items-center gap-0.5"
                >
                  <span>{showSupabaseGuide ? 'Ocultar guía' : '¿Cómo obtener mis llaves? (2 min)'}</span>
                  {showSupabaseGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

              {supabaseTestResult && (
                <div
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                    supabaseTestResult.ok
                      ? 'bg-sage/80 border-carbon text-carbon'
                      : 'bg-rosePastel-light border-carbon text-carbon'
                  }`}
                >
                  {supabaseTestResult.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span>{supabaseTestResult.message}</span>
                </div>
              )}

              {/* Supabase Accordion Guide */}
              <AnimatePresence>
                {showSupabaseGuide && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden pt-2"
                  >
                    <div className="p-3 bg-white dark:bg-nightCard border-2 border-carbon rounded-xl text-[11px] space-y-1.5 text-carbon/80 dark:text-cream/80">
                      <p className="font-bold text-coral">Configuración en 3 pasos sencillos:</p>
                      <ol className="list-decimal pl-4 space-y-1 font-medium">
                        <li>Entra a <strong>supabase.com</strong> y crea un proyecto nuevo (es 100% gratuito).</li>
                        <li>Ve a <strong>Project Settings &gt; API</strong> y copia la <em>Project URL</em> y la clave <em>anon / public</em>. Pégalas aquí arriba.</li>
                        <li>En el menú de Supabase haz clic en <strong>SQL Editor</strong>, haz clic arriba en el botón <strong>"Copiar Script SQL de Tablas"</strong>, pégalo y dale a <strong>Run</strong>. ¡Y listo! Ambos tendrán sincronización instantánea y almacenamiento de fotos! 🐭💖🎀</li>
                      </ol>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Profiles: Paulo & Alexandra */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Partner 1 Info */}
            <div className="p-3 bg-white dark:bg-nightSurface border-2 border-carbon rounded-2xl">
              <span className="text-xs font-bold text-coral block mb-2">
                🐭 Perfil de Paulo (Gigio):
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
                🎀 Perfil de Alexandra (Rosita):
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

          {/* Backup / Export / Import */}
          <div className="pt-2 border-t-2 border-carbon/20">
            <span className="font-bold text-carbon dark:text-cream block mb-2">
              Respaldo de Datos (Descarga o Recuperación en Archivo):
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
              Guardar Ajustes
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
