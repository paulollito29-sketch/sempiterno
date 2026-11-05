import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, 
  Unlock, 
  Mail, 
  Clock, 
  Plus, 
  Sparkles, 
  Heart, 
  Trash2,
  X,
  KeyRound
} from 'lucide-react';
import { TimeCapsule, CoupleSettings } from '../types';
import { calculateCountdown, formatDate } from '../utils/date';
import { MouseEarsIcon } from './TopoEarsIcon';
import { fireSuperCelebration, fireHeartConfetti } from '../utils/confetti';

interface TimeCapsulesViewProps {
  capsules: TimeCapsule[];
  settings: CoupleSettings;
  onOpenNewCapsule: () => void;
  onDeleteCapsule: (capsuleId: string) => void;
  onOpenCapsuleContent: (capsuleId: string) => void;
}

export const TimeCapsulesView: React.FC<TimeCapsulesViewProps> = ({
  capsules,
  settings,
  onOpenNewCapsule,
  onDeleteCapsule,
  onOpenCapsuleContent,
}) => {
  // Live ticker for countdowns
  const [, setTick] = useState(0);
  const [readingCapsule, setReadingCapsule] = useState<TimeCapsule | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleOpenLetter = (capsule: TimeCapsule) => {
    setReadingCapsule(capsule);
    fireSuperCelebration();
    onOpenCapsuleContent(capsule.id);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-nightCard border-3 border-carbon rounded-3xl p-5 sm:p-6 shadow-neo">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">💌</span>
            <h2 className="font-display text-2xl font-black text-carbon dark:text-cream">
              Cápsulas del Tiempo & Cartas al Futuro
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-carbon/70 dark:text-cream/70 font-medium mt-1">
            Mensajes sellados con candado y cera para leer solo cuando llegue el día prometido.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNewCapsule}
          className="neo-btn-primary py-2 px-4 text-xs sm:text-sm flex items-center justify-center gap-1.5 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Sellar Nueva Carta</span>
        </button>
      </div>

      {/* Grid of Capsules */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {capsules.map((capsule, index) => {
          const countdown = calculateCountdown(capsule.unlockDate);
          const isUnlocked = countdown.isPast || capsule.isCustomOpened;

          return (
            <motion.div
              key={capsule.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`border-3 border-carbon rounded-3xl p-5 shadow-neo flex flex-col justify-between relative overflow-hidden transition-all duration-200 ${
                isUnlocked
                  ? 'bg-butter-light/80 dark:bg-nightCard'
                  : 'bg-white dark:bg-nightSurface'
              }`}
            >
              {/* Wax Seal / Stamp Effect */}
              <div className="absolute top-4 right-4">
                <div
                  className={`w-10 h-10 rounded-full border-2 border-carbon flex items-center justify-center shadow-neo-sm font-bold text-xs ${
                    isUnlocked
                      ? 'bg-sage text-carbon rotate-6'
                      : 'bg-coral text-white -rotate-6'
                  }`}
                  title={isUnlocked ? '¡Desbloqueada!' : 'Sellada'}
                >
                  {isUnlocked ? '🔓' : '🔒'}
                </div>
              </div>

              <div>
                {/* Sender & Recipient Badges */}
                <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                  <span className="neo-badge bg-rosePastel-light text-carbon text-[10px] flex items-center gap-1">
                    <MouseEarsIcon type={capsule.sender === 'Gigio' ? 'gigio' : 'rosita'} size={12} />
                    De: {capsule.sender}
                  </span>
                  <span className="text-[10px] font-bold text-carbon/60 dark:text-cream/60">→</span>
                  <span className="neo-badge bg-butter text-carbon text-[10px]">
                    Para: {capsule.recipient}
                  </span>
                </div>

                <h3 className="font-display font-black text-base sm:text-lg text-carbon dark:text-cream leading-snug mb-2 pr-10 break-words">
                  {capsule.title}
                </h3>

                <p className="text-xs text-carbon/70 dark:text-cream/70 font-semibold mb-4">
                  Fecha de apertura: <strong className="text-coral">{formatDate(capsule.unlockDate)}</strong>
                </p>

                {/* Locked vs Unlocked Content Preview */}
                {!isUnlocked ? (
                  <div className="bg-cream dark:bg-nightCard border-2 border-dashed border-carbon rounded-2xl p-4 text-center my-2 space-y-2">
                    <Lock className="w-6 h-6 text-coral mx-auto animate-pulse" />
                    <div className="text-xs font-black text-carbon dark:text-cream">
                      Mensaje bloqueado con candado
                    </div>
                    {/* Live countdown */}
                    <div className="text-xs font-bold text-coral bg-white dark:bg-nightSurface border border-carbon rounded-lg py-1 px-2 inline-block">
                      Faltan: {countdown.days}d {countdown.hours}h {countdown.minutes}m {countdown.seconds}s
                    </div>
                    {capsule.hint && (
                      <p className="text-[11px] text-carbon/60 dark:text-cream/60 italic mt-1">
                        Pista: "{capsule.hint}"
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-white dark:bg-nightSurface border-2 border-carbon rounded-2xl p-4 my-2 text-center space-y-2">
                    <div className="text-2xl">💌</div>
                    <div className="text-xs font-black text-carbon dark:text-cream">
                      ¡Esta carta ya puede ser leída!
                    </div>
                    <p className="text-[11px] text-carbon/75 dark:text-cream/75 italic line-clamp-2">
                      "{capsule.secretMessage}"
                    </p>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="mt-4 pt-3 border-t border-carbon/20 flex items-center justify-between">
                {isUnlocked ? (
                  <button
                    type="button"
                    onClick={() => handleOpenLetter(capsule)}
                    className="neo-btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 font-black"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Leer carta completa</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('¿Desean abrir la cápsula antes de tiempo con la llave secreta?')) {
                        handleOpenLetter(capsule);
                      }
                    }}
                    className="text-xs font-bold text-carbon/60 dark:text-cream/60 hover:text-coral flex items-center gap-1"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Abrir con llave secreta</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`¿Eliminar la cápsula "${capsule.title}"?`)) {
                      onDeleteCapsule(capsule.id);
                    }
                  }}
                  className="p-1.5 border border-carbon rounded-lg bg-rosePastel-light hover:bg-rosePastel"
                  title="Eliminar cápsula"
                >
                  <Trash2 className="w-3.5 h-3.5 text-carbon" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {capsules.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-nightCard border-3 border-dashed border-carbon rounded-3xl p-8">
          <span className="text-4xl block mb-2">💌</span>
          <h3 className="font-display text-lg font-bold text-carbon dark:text-cream">
            Aún no hay cartas selladas para el futuro
          </h3>
          <p className="text-xs text-carbon/60 dark:text-cream/60 mt-1 mb-4">
            Escribe un mensaje para una fecha especial: aniversario, próximo viaje o cumpleaños.
          </p>
          <button
            type="button"
            onClick={onOpenNewCapsule}
            className="neo-btn-primary text-xs py-2 px-4"
          >
            Sellar Primera Carta
          </button>
        </div>
      )}

      {/* READ FULL LETTER MODAL */}
      <AnimatePresence>
        {readingCapsule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-carbon/75 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg bg-[#FFFDF0] dark:bg-nightCard border-4 border-carbon rounded-3xl p-6 sm:p-8 shadow-neo-xl relative my-6 text-carbon dark:text-cream"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setReadingCapsule(null)}
                className="absolute top-4 right-4 p-2 bg-white dark:bg-nightSurface border-2 border-carbon rounded-full hover:bg-rosePastel shadow-neo-sm"
              >
                <X className="w-4 h-4 text-carbon dark:text-cream" />
              </button>

              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-coral border-3 border-carbon flex items-center justify-center text-white text-2xl mx-auto mb-2 shadow-neo-sm">
                  💌
                </div>
                <span className="text-xs font-bold text-coral uppercase tracking-wider">
                  Cápsula del Tiempo Desbloqueada
                </span>
                <h3 className="font-display text-2xl font-black mt-1">
                  {readingCapsule.title}
                </h3>
                <p className="text-xs text-carbon/60 dark:text-cream/60 font-semibold mt-0.5">
                  Escrita por {readingCapsule.sender} para {readingCapsule.recipient}
                </p>
              </div>

              {/* Romantic Letter Paper Content */}
              <div className="bg-white dark:bg-nightSurface border-2 border-carbon rounded-2xl p-6 shadow-neo-sm font-handwriting text-lg sm:text-xl leading-relaxed text-carbon dark:text-cream/90 whitespace-pre-line relative">
                {/* Little heart decoration */}
                <span className="absolute top-3 right-3 text-coral">♥</span>
                "{readingCapsule.secretMessage}"
              </div>

              {readingCapsule.hint && (
                <p className="text-xs text-carbon/70 dark:text-cream/70 italic text-center mt-4">
                  Pista original: "{readingCapsule.hint}"
                </p>
              )}

              <div className="mt-6 pt-4 border-t-2 border-carbon/20 flex justify-center">
                <button
                  type="button"
                  onClick={() => setReadingCapsule(null)}
                  className="neo-btn-primary py-2 px-6 text-xs sm:text-sm font-black"
                >
                  Guardar con amor en el corazón 💕
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
