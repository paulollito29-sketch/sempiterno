import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Copy, Loader2, Sparkles } from 'lucide-react';
import { UserSession } from '../types';
import { triggerHapticImpact, triggerHapticSuccess } from '../utils/native';

interface PairingScreenProps {
  session: UserSession;
  onPairWithCode: (partnerCode: string) => Promise<void>;
  onContinueToPlans: () => void;
  onLogout: () => void;
}

export const PairingScreen: React.FC<PairingScreenProps> = ({
  session,
  onPairWithCode,
  onContinueToPlans,
  onLogout,
}) => {
  const [partnerCode, setPartnerCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pairedSuccess, setPairedSuccess] = useState<string | null>(null);

  const handleCopy = async () => {
    await triggerHapticImpact('light');
    try {
      await navigator.clipboard.writeText(session.myCode);
    } catch {
      // Ignore if clipboard blocked
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLink = async () => {
    setErrorMsg(null);
    if (!partnerCode.trim()) {
      setErrorMsg('Escribe el código que aparece en el teléfono de tu pareja.');
      return;
    }
    setIsLinking(true);
    await triggerHapticImpact('medium');
    try {
      await onPairWithCode(partnerCode);
      await triggerHapticSuccess();
      setPairedSuccess('¡Conexión bidireccional establecida!');
      setTimeout(() => {
        onContinueToPlans();
      }, 900);
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo vincular el código.');
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#FAF8F5] dark:bg-[#0F1015] flex flex-col justify-between px-6 py-8 max-w-md mx-auto">
      <div>
        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 font-medium mb-5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Cerrar Sesión
        </button>

        <span className="text-[11px] font-bold tracking-widest text-rose-500 uppercase block">
          Paso 2 &bull; Conexión Bidireccional
        </span>
        <h1 className="serif-title text-3xl font-bold text-stone-900 dark:text-stone-100 mt-1">
          Conecta con <br />
          <span className="italic font-normal text-rose-500">tu pareja</span>
        </h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-2 leading-relaxed">
          Cualquiera de los dos puede ingresar el código del otro. En cuanto uno lo envíe, ambos teléfonos se conectan automáticamente.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="my-6 space-y-4"
      >
        {/* Option A: Share Your Code */}
        <div className="p-5 rounded-3xl bg-white dark:bg-[#181A20] border border-stone-200/75 dark:border-stone-800 shadow-sm">
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
            Tu Código Personal
          </span>
          <div className="flex items-center justify-between mt-2">
            <span className="font-mono text-2xl font-extrabold tracking-widest text-stone-900 dark:text-stone-100">
              {session.myCode}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-1.5 rounded-full bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-[11px] font-bold shadow-xs active:scale-95 transition-transform flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
            </button>
          </div>
          <p className="text-[11px] text-stone-400 mt-2">
            Pásale este código a tu pareja para que lo escriba en su app.
          </p>
        </div>

        {/* Divider */}
        <div className="relative py-1 flex items-center justify-center">
          <div className="w-full border-t border-stone-200 dark:border-stone-800" />
          <span className="absolute bg-[#FAF8F5] dark:bg-[#0F1015] px-3 text-[10px] font-semibold text-stone-400 uppercase tracking-widest">
            o ingresa su código
          </span>
        </div>

        {/* Option B: Enter Partner Code */}
        <div className="p-5 rounded-3xl bg-white dark:bg-[#181A20] border border-stone-200/75 dark:border-stone-800 shadow-sm">
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
            Código de tu Pareja
          </span>
          <div className="mt-2.5 flex gap-2">
            <input
              type="text"
              value={partnerCode}
              onChange={(e) => setPartnerCode(e.target.value.toUpperCase())}
              placeholder="Ej: SEMP-1234"
              className="flex-1 uppercase font-mono px-4 py-3 rounded-2xl bg-stone-50 dark:bg-[#20222A] border border-stone-200 dark:border-stone-700 text-sm font-bold text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
            <button
              type="button"
              disabled={isLinking}
              onClick={handleLink}
              className="px-4 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold active:scale-95 transition-all flex items-center gap-1.5"
            >
              {isLinking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Vincular'}
            </button>
          </div>
          {errorMsg && <p className="text-[11px] font-medium text-rose-500 mt-2">{errorMsg}</p>}
          {pairedSuccess && (
            <p className="text-[11px] font-semibold text-emerald-600 mt-2 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              {pairedSuccess}
            </p>
          )}
        </div>
      </motion.div>

      <button
        type="button"
        onClick={onContinueToPlans}
        className="w-full py-4 rounded-2xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-bold text-xs shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
      >
        <span>Continuar a Planes</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};
