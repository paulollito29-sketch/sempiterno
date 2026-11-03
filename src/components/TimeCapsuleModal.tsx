import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Lock, Mail, Calendar, Sparkles } from 'lucide-react';
import { TimeCapsule, CoupleSettings } from '../types';
import { MouseEarsIcon } from './TopoEarsIcon';

interface TimeCapsuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (capsule: TimeCapsule) => void;
  settings: CoupleSettings;
}

export const TimeCapsuleModal: React.FC<TimeCapsuleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  settings,
}) => {
  const [title, setTitle] = useState('');
  const [sender, setSender] = useState<'Gigio' | 'Rosita'>(settings.currentUser);
  const [recipient, setRecipient] = useState<'Gigio' | 'Rosita' | 'Ambos'>(
    settings.currentUser === 'Gigio' ? 'Rosita' : 'Gigio'
  );
  
  // Default future date (1 month from now)
  const defaultFutureDate = new Date();
  defaultFutureDate.setMonth(defaultFutureDate.getMonth() + 3);
  const [unlockDate, setUnlockDate] = useState(defaultFutureDate.toISOString().split('T')[0]);

  const [secretMessage, setSecretMessage] = useState('');
  const [hint, setHint] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !secretMessage.trim()) return;

    const capsule: TimeCapsule = {
      id: `capsule-${Date.now()}`,
      title: title.trim(),
      sender,
      recipient,
      unlockDate: `${unlockDate}T00:00:00`,
      secretMessage: secretMessage.trim(),
      hint: hint.trim() || undefined,
      createdAt: new Date().toISOString(),
      isCustomOpened: false,
    };

    onSave(capsule);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-carbon/75 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className="w-full max-w-xl bg-cream dark:bg-nightCard border-3 border-carbon rounded-3xl p-5 sm:p-7 shadow-neo-xl my-8 relative"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-white dark:bg-nightSurface border-2 border-carbon rounded-full hover:bg-rosePastel shadow-neo-sm"
        >
          <X className="w-4 h-4 text-carbon dark:text-cream" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">⏳</span>
          <h2 className="font-display text-xl sm:text-2xl font-black text-carbon dark:text-cream">
            Sellar Nueva Cápsula del Tiempo
          </h2>
        </div>

        <p className="text-xs text-carbon/70 dark:text-cream/70 mb-4 font-medium">
          Escribe una carta de amor, un secreto o una promesa para que se desbloquee en una fecha especial.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
          {/* Title */}
          <div>
            <label className="block font-bold text-carbon dark:text-cream mb-1">
              Título o Motivo de la Carta *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Para cuando cumplamos 2 años / Para cuando nos mudemos..."
              className="neo-input w-full"
            />
          </div>

          {/* Sender & Recipient */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-carbon dark:text-cream mb-1">
                De parte de:
              </label>
              <div className="flex gap-2">
                {(['Gigio', 'Rosita'] as const).map((who) => (
                  <button
                    key={who}
                    type="button"
                    onClick={() => setSender(who)}
                    className={`flex-1 py-2 text-xs font-bold border-2 border-carbon rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                      sender === who
                        ? 'bg-rosePastel text-carbon shadow-neo-sm'
                        : 'bg-white dark:bg-nightSurface text-carbon dark:text-cream'
                    }`}
                  >
                    <MouseEarsIcon type={who === 'Gigio' ? 'gigio' : 'rosita'} size={16} />
                    <span>{who}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-bold text-carbon dark:text-cream mb-1">
                Para quién:
              </label>
              <select
                value={recipient}
                onChange={(e) => setRecipient(e.target.value as any)}
                className="neo-input w-full"
              >
                <option value="Rosita">🎀 Rosita</option>
                <option value="Gigio">🐭 Gigio</option>
                <option value="Ambos">👫 Para los dos</option>
              </select>
            </div>
          </div>

          {/* Unlock Date */}
          <div>
            <label className="block font-bold text-carbon dark:text-cream mb-1 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-coral" />
              <span>Fecha de desbloqueo en el futuro *</span>
            </label>
            <input
              type="date"
              required
              value={unlockDate}
              onChange={(e) => setUnlockDate(e.target.value)}
              className="neo-input w-full"
            />
          </div>

          {/* Secret Message */}
          <div>
            <label className="block font-bold text-carbon dark:text-cream mb-1 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-coral" />
              <span>Mensaje Secreto (permanecerá encriptado y bloqueado) *</span>
            </label>
            <textarea
              rows={4}
              required
              value={secretMessage}
              onChange={(e) => setSecretMessage(e.target.value)}
              placeholder="Escribe con el corazón todo lo que sueñas, sientes o prometes para ese día..."
              className="neo-input w-full"
            />
          </div>

          {/* Hint */}
          <div>
            <label className="block font-bold text-carbon dark:text-cream mb-1">
              Pista visible mientras está bloqueada (opcional)
            </label>
            <input
              type="text"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="Ej. Ábrelo cuando estemos tomando café en París..."
              className="neo-input w-full"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-carbon/20">
            <button
              type="button"
              onClick={onClose}
              className="neo-btn-white py-2 px-4 text-xs sm:text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="neo-btn-primary py-2 px-5 text-xs sm:text-sm flex items-center gap-1.5"
            >
              <Lock className="w-4 h-4" />
              <span>Sellar Cápsula</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
