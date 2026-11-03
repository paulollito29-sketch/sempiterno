import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Calendar, Clock, MapPin, Shirt, Sparkles, DollarSign } from 'lucide-react';
import { Plan, PlanCategory, PlanStatus, BudgetLevel } from '../types';

interface PlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (plan: Plan) => void;
  planToEdit?: Plan | null;
}

const CATEGORIES: PlanCategory[] = [
  'Comida & Cafés',
  'Viajes',
  'Planes en Casa',
  'Aventura',
];

const BUDGETS: BudgetLevel[] = ['$', '$$', '$$$'];

export const PlanModal: React.FC<PlanModalProps> = ({
  isOpen,
  onClose,
  onSave,
  planToEdit,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<PlanCategory>('Comida & Cafés');
  const [budget, setBudget] = useState<BudgetLevel>('$$');
  const [status, setStatus] = useState<PlanStatus>('Idea / Antojo');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [location, setLocation] = useState('');
  const [dressCode, setDressCode] = useState('');
  const [surpriseNote, setSurpriseNote] = useState('');
  const [tag, setTag] = useState('');

  useEffect(() => {
    if (planToEdit) {
      setTitle(planToEdit.title);
      setDescription(planToEdit.description);
      setCategory(planToEdit.category);
      setBudget(planToEdit.budget);
      setStatus(planToEdit.status);
      setScheduledDate(planToEdit.scheduledDate || '');
      setScheduledTime(planToEdit.scheduledTime || '');
      setLocation(planToEdit.location || '');
      setDressCode(planToEdit.dressCode || '');
      setSurpriseNote(planToEdit.surpriseNote || '');
      setTag(planToEdit.tag || '');
    } else {
      setTitle('');
      setDescription('');
      setCategory('Comida & Cafés');
      setBudget('$$');
      setStatus('Idea / Antojo');
      setScheduledDate('');
      setScheduledTime('');
      setLocation('');
      setDressCode('');
      setSurpriseNote('');
      setTag('');
    }
  }, [planToEdit, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const plan: Plan = {
      id: planToEdit ? planToEdit.id : `plan-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      category,
      budget,
      status,
      scheduledDate: status === 'Agendado' ? scheduledDate || undefined : undefined,
      scheduledTime: status === 'Agendado' ? scheduledTime || undefined : undefined,
      location: location.trim() || undefined,
      dressCode: dressCode.trim() || undefined,
      surpriseNote: surpriseNote.trim() || undefined,
      tag: tag.trim() || undefined,
      createdAt: planToEdit ? planToEdit.createdAt : new Date().toISOString(),
    };

    onSave(plan);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-carbon/70 backdrop-blur-sm overflow-y-auto">
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
          <span className="text-2xl">✨</span>
          <h2 className="font-display text-xl sm:text-2xl font-black text-carbon dark:text-cream">
            {planToEdit ? 'Editar Plan' : 'Proponer Nuevo Plan o Antojo'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
          {/* Title */}
          <div>
            <label className="block font-bold text-carbon dark:text-cream mb-1">
              Nombre de la idea o plan *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Cabaña con chimenea en el bosque"
              className="neo-input w-full"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block font-bold text-carbon dark:text-cream mb-1">
              Descripción o detalles del plan
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Qué haríamos, qué comeríamos, por qué se nos antojó..."
              className="neo-input w-full"
            />
          </div>

          {/* Category, Budget, Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-carbon dark:text-cream mb-1">
                Categoría *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as PlanCategory)}
                className="neo-input w-full"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-carbon dark:text-cream mb-1">
                Presupuesto
              </label>
              <div className="flex gap-1.5">
                {BUDGETS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBudget(b)}
                    className={`flex-1 py-2 text-xs font-bold border-2 border-carbon rounded-xl transition-all ${
                      budget === b
                        ? 'bg-butter text-carbon shadow-neo-sm -translate-y-0.5'
                        : 'bg-white dark:bg-nightSurface text-carbon dark:text-cream hover:bg-cream'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-bold text-carbon dark:text-cream mb-1">
                Estado inicial *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PlanStatus)}
                className="neo-input w-full"
              >
                <option value="Idea / Antojo">💡 Idea / Antojo</option>
                <option value="Agendado">📅 Agendado</option>
                <option value="¡Vivido!">🎉 ¡Vivido!</option>
              </select>
            </div>
          </div>

          {/* Scheduling inputs if Agendado */}
          {status === 'Agendado' && (
            <div className="p-4 bg-butter-light/60 dark:bg-nightSurface border-2 border-carbon rounded-2xl space-y-3">
              <span className="text-xs font-bold text-coral block">
                Detalles para la Próxima Cita en el Dashboard:
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-carbon dark:text-cream mb-1 text-xs">
                    Fecha agendada *
                  </label>
                  <input
                    type="date"
                    required
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="neo-input w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-carbon dark:text-cream mb-1 text-xs">
                    Hora (opcional)
                  </label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="neo-input w-full text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-carbon dark:text-cream mb-1 text-xs">
                    Lugar o Zona
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Ej. The Velvet Jazz Club"
                    className="neo-input w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-carbon dark:text-cream mb-1 text-xs">
                    Dress code o Vibe
                  </label>
                  <input
                    type="text"
                    value={dressCode}
                    onChange={(e) => setDressCode(e.target.value)}
                    placeholder="Ej. Ropa formal oscura / Casual cómodo"
                    className="neo-input w-full text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-carbon dark:text-cream mb-1 text-xs">
                  Nota sorpresa secreta (opcional)
                </label>
                <input
                  type="text"
                  value={surpriseNote}
                  onChange={(e) => setSurpriseNote(e.target.value)}
                  placeholder="Ej. ¡Lleva una bufanda porque iremos a ver las estrellas!"
                  className="neo-input w-full text-xs"
                />
              </div>
            </div>
          )}

          {/* Optional tag */}
          <div>
            <label className="block font-bold text-carbon dark:text-cream mb-1">
              Etiqueta rápida (opcional)
            </label>
            <input
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="Ej. Escapada Soñada, Romántico, Gourmet"
              className="neo-input w-full text-xs"
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
              <Sparkles className="w-4 h-4" />
              <span>{planToEdit ? 'Guardar Cambios' : 'Crear Plan'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
