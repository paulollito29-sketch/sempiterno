import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Send, X } from 'lucide-react';
import { triggerHapticSuccess } from '../utils/native';

interface ThoughtModalProps {
  isOpen: boolean;
  partnerName: string;
  onClose: () => void;
  onSendThought: (text: string) => Promise<void>;
}

export const ThoughtModal: React.FC<ThoughtModalProps> = ({
  isOpen,
  partnerName,
  onClose,
  onSendThought,
}) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await onSendThought(text.trim());
      await triggerHapticSuccess();
      setText('');
      onClose();
    } finally {
      setSending(false);
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
                  ¿Qué estás pensando ahora?
                </h3>
                <p className="text-xs text-stone-400 mt-1">
                  Se actualizará al instante en el teléfono de {partnerName}.
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

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <textarea
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Escribe lo que sientes o un recuerdo bonito..."
                className="w-full p-3.5 rounded-2xl bg-stone-50 dark:bg-[#20222A] border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                autoFocus
              />

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={sending || !text.trim()}
                  className="flex-1 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white text-xs font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Enviar a mi Pareja</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
