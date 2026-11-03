import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sparkles, X, Heart } from 'lucide-react';
import { fireHeartConfetti } from '../utils/confetti';

interface BedtimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  partner1Name: string;
  partner2Name: string;
}

export const BedtimeModal: React.FC<BedtimeModalProps> = ({
  isOpen,
  onClose,
  partner1Name,
  partner2Name,
}) => {
  const [kissCount, setKissCount] = React.useState(0);

  const handleGoodNightKiss = () => {
    setKissCount((prev) => prev + 1);
    fireHeartConfetti();
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
            <div className="absolute top-10 left-6 text-yellow-300 animate-bounce text-sm">⭐</div>
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
                <div className="w-32 h-32 mx-auto rounded-2xl border-3 border-carbon overflow-hidden shadow-neo bg-night/10">
                  <img
                    src="/assets/gigio-rosita.jpg"
                    alt="Topo Gigio y Rosita"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-coral text-white text-xs font-bold px-2 py-1 rounded-full border-2 border-carbon shadow-neo-sm flex items-center gap-1">
                  <Moon className="w-3 h-3 fill-white" /> ¡Buenas noches!
                </div>
              </div>

              <span className="inline-block bg-butter text-carbon text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border-2 border-carbon mb-2">
                Easter Egg de Topo Gigio 🐭
              </span>

              <h3 className="font-display text-2xl font-black text-carbon dark:text-cream mb-2">
                "¡A la camita... a la camita!" 💤
              </h3>

              <p className="text-sm text-carbon/80 dark:text-cream/80 mb-5 leading-relaxed font-medium">
                Ya se hizo de noche para <span className="font-bold text-coral">{partner1Name}</span> y{' '}
                <span className="font-bold text-coral">{partner2Name}</span>. 
                <br />
                <em>"Hasta mañana si Dios quiere, que descansen bien, llegó la hora de acostarse y soñar también..."</em>
              </p>

              {/* Kiss interaction */}
              <div className="bg-white dark:bg-nightSurface border-2 border-carbon rounded-2xl p-4 mb-5 shadow-neo-sm">
                <p className="text-xs font-semibold text-carbon/70 dark:text-cream/70 mb-2">
                  Besitos de buenas noches enviados: <strong className="text-coral text-base">{kissCount}</strong>
                </p>
                <button
                  type="button"
                  onClick={handleGoodNightKiss}
                  className="w-full neo-btn-primary py-2.5 px-4 text-sm flex items-center justify-center gap-2"
                >
                  <Heart className="w-4 h-4 fill-white animate-pulse" />
                  ¡Dar besito de buenas noches! 💋
                </button>
              </div>

              {/* Dismiss button */}
              <button
                type="button"
                onClick={onClose}
                className="neo-btn-secondary w-full py-2.5 text-sm"
              >
                Cerrar y seguir recordando 💖
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
