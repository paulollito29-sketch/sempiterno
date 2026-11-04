import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, X, Heart, Sparkles, Send } from 'lucide-react';
import { CoupleSettings, KissesData } from '../types';
import { fireHeartConfetti } from '../utils/confetti';

interface BedtimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: CoupleSettings;
  kissesData?: KissesData;
  onSendKiss: () => Promise<void>;
}

export const BedtimeModal: React.FC<BedtimeModalProps> = ({
  isOpen,
  onClose,
  settings,
  kissesData,
  onSendKiss,
}) => {
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  const isGigio = settings.currentUser === 'Gigio';
  const myNickname = isGigio ? (settings.partner1.nickname || 'Gigio') : (settings.partner2.nickname || 'Rosita');
  const targetNickname = isGigio ? (settings.partner2.nickname || 'Rosita') : (settings.partner1.nickname || 'Gigio');

  const totalKisses = kissesData?.totalKisses || 0;
  const gigioKisses = kissesData?.gigioKisses || 0;
  const rositaKisses = kissesData?.rositaKisses || 0;

  const handleSend = async () => {
    if (isSending) return;
    setIsSending(true);
    fireHeartConfetti();
    try {
      await onSendKiss();
      setSentSuccess(true);
      setTimeout(() => setSentSuccess(false), 3000);
    } finally {
      setIsSending(false);
    }
  };

  const formatLastKissTime = (iso?: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-carbon/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="w-full max-w-md bg-cream dark:bg-nightCard border-3 border-carbon rounded-3xl p-6 shadow-neo-xl relative overflow-hidden"
          >
            {/* Background stars */}
            <div className="absolute top-3 right-12 text-yellow-400 animate-pulse text-lg">✨</div>
            <motion.div
              animate={{ y: [0, -5, 0], rotate: [0, 15, 0] }}
              transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}
              className="absolute top-10 left-6 text-yellow-300 text-sm"
            >
              ⭐
            </motion.div>
            <div className="absolute bottom-6 right-8 text-yellow-400 opacity-60 text-base">🌙</div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 bg-white dark:bg-nightSurface border-2 border-carbon rounded-full hover:bg-rosePastel transition-colors"
            >
              <X className="w-5 h-5 text-carbon dark:text-cream" />
            </button>

            {/* Content */}
            <div className="text-center pt-2">
              <div className="relative inline-block mb-4">
                <div className="w-28 h-28 mx-auto rounded-2xl border-3 border-carbon overflow-hidden shadow-neo bg-night/10">
                  <img
                    src="/assets/gigio-rosita.jpg"
                    alt="Topo Gigio y Rosita"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-coral text-white text-[11px] font-bold px-2.5 py-1 rounded-full border-2 border-carbon shadow-neo-sm flex items-center gap-1">
                  <Moon className="w-3 h-3 fill-white" /> ¡Buenas noches!
                </div>
              </div>

              <span className="inline-block bg-butter text-carbon text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border-2 border-carbon mb-2">
                Easter Egg de Topo Gigio 🐭
              </span>

              <h3 className="font-display text-2xl font-black text-carbon dark:text-cream mb-2">
                "¡A la camita... a la camita!" 💤
              </h3>

              <p className="text-xs sm:text-sm text-carbon/80 dark:text-cream/80 mb-4 leading-relaxed font-medium">
                Ya se hizo de noche para <span className="font-bold text-coral">{settings.partner1.nickname || 'Gigio'}</span> y{' '}
                <span className="font-bold text-coral">{settings.partner2.nickname || 'Rosita'}</span>. 
                <br />
                <em>"Hasta mañana si Dios quiere, que descansen bien, llegó la hora de acostarse y soñar también..."</em>
              </p>

              {/* Realtime Kisses Card */}
              <div className="bg-white dark:bg-nightSurface border-2 border-carbon rounded-2xl p-4 mb-4 shadow-neo-sm text-left">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black font-display uppercase tracking-wider text-carbon dark:text-cream flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-coral" /> Besitos de Buenas Noches
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rosePastel text-carbon border border-carbon">
                    En Vivo ⚡
                  </span>
                </div>

                <div className="flex items-baseline justify-between py-1 border-b border-carbon/10">
                  <span className="text-xs text-carbon/70 dark:text-cream/70 font-semibold">Total compartidos:</span>
                  <span className="font-display text-xl font-black text-coral">{totalKisses} 💋</span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2 pt-1 text-center">
                  <div className="p-2 bg-cream/70 dark:bg-night border border-carbon/30 rounded-xl">
                    <p className="text-[10px] text-carbon/70 dark:text-cream/70 font-bold uppercase truncate">
                      🐭 {settings.partner1.nickname || 'Gigio'}
                    </p>
                    <p className="font-black text-sm text-carbon dark:text-cream">{gigioKisses} besitos</p>
                  </div>
                  <div className="p-2 bg-cream/70 dark:bg-night border border-carbon/30 rounded-xl">
                    <p className="text-[10px] text-carbon/70 dark:text-cream/70 font-bold uppercase truncate">
                      🎀 {settings.partner2.nickname || 'Rosita'}
                    </p>
                    <p className="font-black text-sm text-carbon dark:text-cream">{rositaKisses} besitos</p>
                  </div>
                </div>

                {kissesData?.lastKissAt && (
                  <p className="text-[10px] text-center text-carbon/60 dark:text-cream/60 mt-2 font-medium">
                    Último besito enviado por{' '}
                    <strong className="text-coral font-bold">
                      {kissesData.lastSender === 'Gigio' ? (settings.partner1.nickname || 'Gigio') : (settings.partner2.nickname || 'Rosita')}
                    </strong>{' '}
                    {formatLastKissTime(kissesData.lastKissAt) ? `a las ${formatLastKissTime(kissesData.lastKissAt)}` : ''} ❤️
                  </p>
                )}

                <div className="mt-3">
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={isSending}
                    className="w-full neo-btn-primary py-2.5 px-4 text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  >
                    <Heart className="w-4 h-4 fill-white animate-pulse" />
                    <span>
                      {isSending
                        ? 'Enviando besito...'
                        : `¡Mandar besito a ${targetNickname}! 💋`}
                    </span>
                  </button>

                  {sentSuccess && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center text-xs font-bold text-green-600 mt-2 flex items-center justify-center gap-1"
                    >
                      <span>¡Besito entregado a {targetNickname} en tiempo real! 💌✨</span>
                    </motion.p>
                  )}
                </div>
              </div>

              {/* Dismiss button */}
              <button
                type="button"
                onClick={onClose}
                className="neo-btn-secondary w-full py-2.5 text-xs sm:text-sm"
              >
                Cerrar y descansar 💖
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
