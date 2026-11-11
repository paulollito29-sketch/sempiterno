import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Copy, Loader2, X } from 'lucide-react';
import { UserSession } from '../types';
import { triggerHapticImpact, triggerHapticSuccess } from '../utils/native';

interface PairManageModalProps {
  isOpen: boolean;
  session: UserSession;
  onClose: () => void;
  onPairWithCode: (code: string) => Promise<void>;
  onUnlink: () => void;
}

export const PairManageModal: React.FC<PairManageModalProps> = ({
  isOpen,
  session,
  onClose,
  onPairWithCode,
  onUnlink,
}) => {
  const [newCode, setNewCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCopy = async () => {
    await triggerHapticImpact('light');
    try {
      await navigator.clipboard.writeText(session.myCode);
    } catch {
      // Ignore
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    setError(null);
    if (!newCode.trim()) {
      setError('Escribe el código de pareja.');
      return;
    }
    setLoading(true);
    try {
      await onPairWithCode(newCode);
      await triggerHapticSuccess();
      setNewCode('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al vincular código.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-[#181A20] rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-stone-200/70 dark:border-stone-800"
          >
            <div className="w-10 h-1 bg-stone-300 dark:bg-stone-700 rounded-full mx-auto mb-4 sm:hidden" />
            <div className="flex items-start justify-between">
              <div>
                <h3 className="serif-title text-xl font-bold text-stone-900 dark:text-stone-100">
                  Vincular o Cambiar Código
                </h3>
                <p className="text-xs text-stone-400 mt-1">
                  Conecta a ambos teléfonos bajo el mismo espacio compartido.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 p-4 rounded-2xl bg-stone-50 dark:bg-[#20222A] border border-stone-200/80 dark:border-stone-700">
              <span className="text-[10px] font-bold text-stone-400 uppercase block">
                Tu código personal:
              </span>
              <div className="flex items-center justify-between mt-1">
                <span className="font-mono text-lg font-bold text-stone-800 dark:text-stone-100">
                  {session.myCode}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-xs text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? '¡Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1.5">
                Unirse con otro código de pareja
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  placeholder="SEMP-XXXX"
                  className="flex-1 uppercase font-mono px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#20222A] border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-900 dark:text-stone-100"
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSave}
                  className="px-4 py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold flex items-center gap-1"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Guardar
                </button>
              </div>
              {error && <p className="text-[11px] text-rose-500 mt-1.5 font-medium">{error}</p>}
            </div>

            <div className="mt-5 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
              {session.isPaired ? (
                <button
                  type="button"
                  onClick={() => {
                    onUnlink();
                    onClose();
                  }}
                  className="text-xs font-semibold text-red-500 hover:text-red-700"
                >
                  Desvincular pareja actual
                </button>
              ) : (
                <span className="text-[11px] text-stone-400">Sin pareja conectada aún</span>
              )}
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-semibold text-stone-500"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
