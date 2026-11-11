import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Compass, 
  Calendar, 
  Clock, 
  MapPin, 
  Plus, 
  CheckCircle2, 
  Sparkles, 
  Edit2, 
  Trash2, 
  ArrowRight,
  Filter,
  Shirt,
  CalendarCheck
} from 'lucide-react';
import { Plan, PlanCategory, PlanStatus, BudgetLevel } from '../types';
import { formatDate } from '../utils/date';
import { fireHeartConfetti } from '../utils/confetti';

interface PlansViewProps {
  plans: Plan[];
  onOpenNewPlan: () => void;
  onEditPlan: (plan: Plan) => void;
  onDeletePlan: (planId: string) => void;
  onUpdatePlanStatus: (planId: string, newStatus: PlanStatus) => void;
  onConvertToMemory: (plan: Plan) => void;
}

const CATEGORIES: ('Todos' | PlanCategory)[] = [
  'Todos',
  'Comida & Cafés',
  'Viajes',
  'Planes en Casa',
  'Aventura',
];

const BUDGETS: ('Todos' | BudgetLevel)[] = ['Todos', '$', '$$', '$$$'];

const STATUSES: { id: PlanStatus; title: string; emoji: string; color: string }[] = [
  { id: 'Idea / Antojo', title: 'Ideas & Antojos', emoji: '💡', color: 'bg-butter-light text-carbon' },
  { id: 'Agendado', title: 'Agendados', emoji: '📅', color: 'bg-rosePastel-light text-carbon' },
  { id: '¡Vivido!', title: '¡Vividos!', emoji: '🎉', color: 'bg-sage text-carbon' },
];

export const PlansView: React.FC<PlansViewProps> = ({
  plans,
  onOpenNewPlan,
  onEditPlan,
  onDeletePlan,
  onUpdatePlanStatus,
  onConvertToMemory,
}) => {
  const [activeCategory, setActiveCategory] = useState<'Todos' | PlanCategory>('Todos');
  const [activeBudget, setActiveBudget] = useState<'Todos' | BudgetLevel>('Todos');
  const [activeStatusTab, setActiveStatusTab] = useState<PlanStatus | 'Todos'>('Todos');

  // Filter plans
  const filteredPlans = plans.filter((plan) => {
    const matchesCategory = activeCategory === 'Todos' || plan.category === activeCategory;
    const matchesBudget = activeBudget === 'Todos' || plan.budget === activeBudget;
    const matchesStatus = activeStatusTab === 'Todos' || plan.status === activeStatusTab;
    return matchesCategory && matchesBudget && matchesStatus;
  });

  const getPlansByStatus = (status: PlanStatus) => {
    return filteredPlans.filter((p) => p.status === status);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-nightCard border-3 border-carbon rounded-3xl p-5 sm:p-6 shadow-neo">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧭</span>
            <h2 className="font-display text-2xl font-black text-carbon dark:text-cream">
              Bucket List: Por Vivir
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-carbon/70 dark:text-cream/70 font-medium mt-1">
            Nuestros sueños, escapadas planeadas y aventuras por tachar de la lista.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNewPlan}
          className="neo-btn-primary py-2 px-4 text-xs sm:text-sm flex items-center justify-center gap-1.5 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Proponer Nuevo Plan</span>
        </button>
      </div>

      {/* Filters (Category & Budget) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-cream dark:bg-nightSurface border-2 border-carbon rounded-2xl p-3 shadow-neo-sm">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`text-xs font-bold px-3 py-1 rounded-full border-2 border-carbon transition-all whitespace-nowrap ${
                activeCategory === cat
                  ? 'bg-coral text-white shadow-neo-sm'
                  : 'bg-white dark:bg-nightCard text-carbon dark:text-cream hover:bg-cream'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Budget Pills */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs font-bold text-carbon/60 dark:text-cream/60">Gasto:</span>
          {BUDGETS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setActiveBudget(b)}
              className={`text-xs font-bold px-2.5 py-1 rounded-xl border border-carbon ${
                activeBudget === b
                  ? 'bg-butter text-carbon font-black shadow-xs'
                  : 'bg-white dark:bg-nightCard text-carbon dark:text-cream'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* Overall Empty Prompt if no plans yet */}
      {plans.length === 0 && (
        <div className="bg-cream dark:bg-nightSurface border-2 border-dashed border-carbon rounded-3xl p-6 text-center">
          <span className="text-3xl block mb-2">🧭</span>
          <h3 className="font-display font-bold text-base text-carbon dark:text-cream mb-1">
            Su lista de deseos "Por Vivir" está esperando sus primeras aventuras
          </h3>
          <p className="text-xs text-carbon/70 dark:text-cream/70 max-w-md mx-auto mb-3 leading-relaxed">
            ¿Una escapada de fin de semana, una cena especial o un plan en casa? Propongan sus ideas y antojos para verlos en el tablero.
          </p>
          <button
            type="button"
            onClick={onOpenNewPlan}
            className="neo-btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Proponer Primer Plan</span>
          </button>
        </div>
      )}

      {/* Status Columns (Kanban Board) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {STATUSES.map((statusGroup) => {
          const plansInColumn = getPlansByStatus(statusGroup.id);

          return (
            <div
              key={statusGroup.id}
              className="bg-white dark:bg-nightCard border-3 border-carbon rounded-3xl p-4 sm:p-5 shadow-neo flex flex-col min-h-[500px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-carbon/20">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{statusGroup.emoji}</span>
                  <h3 className="font-display font-black text-base sm:text-lg text-carbon dark:text-cream">
                    {statusGroup.title}
                  </h3>
                </div>
                <span className="neo-badge bg-butter text-carbon text-xs font-bold">
                  {plansInColumn.length}
                </span>
              </div>

              {/* Plans List in Column */}
              <div className="space-y-3.5 flex-1">
                {plansInColumn.map((plan) => (
                  <motion.div
                    key={plan.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-cream dark:bg-nightSurface border-2 border-carbon rounded-2xl p-4 shadow-neo-sm relative flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="neo-badge bg-white dark:bg-nightCard text-carbon dark:text-cream text-[10px]">
                          {plan.category}
                        </span>
                        <span className="text-xs font-black px-2 py-0.5 bg-butter text-carbon rounded-md border border-carbon">
                          {plan.budget}
                        </span>
                      </div>

                      <h4 className="font-display font-bold text-sm sm:text-base text-carbon dark:text-cream mb-1 break-words leading-snug">
                        {plan.title}
                      </h4>

                      {plan.description && (
                        <p className="text-xs text-carbon/80 dark:text-cream/80 mb-3 leading-relaxed">
                          {plan.description}
                        </p>
                      )}

                      {/* Scheduled Details */}
                      {plan.status === 'Agendado' && plan.scheduledDate && (
                        <div className="p-2.5 bg-butter-light/80 dark:bg-nightCard border border-carbon rounded-xl text-[11px] font-semibold text-carbon dark:text-cream space-y-1 mb-3">
                          <div className="flex items-center gap-1.5 text-coral">
                            <Calendar className="w-3.5 h-3.5 shrink-0" />
                            <span>{formatDate(plan.scheduledDate)} {plan.scheduledTime ? `a las ${plan.scheduledTime}` : ''}</span>
                          </div>
                          {plan.location && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-coral shrink-0" />
                              <span className="truncate">{plan.location}</span>
                            </div>
                          )}
                          {plan.dressCode && (
                            <div className="flex items-center gap-1.5">
                              <Shirt className="w-3.5 h-3.5 text-coral shrink-0" />
                              <span className="truncate">{plan.dressCode}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Lived Banner / Action */}
                      {plan.status === '¡Vivido!' && (
                        <div className="mb-3">
                          <button
                            type="button"
                            onClick={() => onConvertToMemory(plan)}
                            className="w-full neo-btn-primary py-2 px-3 text-xs flex items-center justify-center gap-1.5 font-bold"
                          >
                            <CalendarCheck className="w-3.5 h-3.5" />
                            <span>¡Convertir en Recuerdo! 📸</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Card Actions & State Transition */}
                    <div className="pt-2 border-t border-carbon/15 flex items-center justify-between text-xs">
                      {/* State Transitions */}
                      <div className="flex items-center gap-1">
                        {plan.status === 'Idea / Antojo' && (
                          <button
                            type="button"
                            onClick={() => onUpdatePlanStatus(plan.id, 'Agendado')}
                            className="text-[11px] font-bold text-coral hover:underline flex items-center gap-1"
                          >
                            <Calendar className="w-3 h-3" /> Agendar
                          </button>
                        )}

                        {plan.status === 'Agendado' && (
                          <button
                            type="button"
                            onClick={() => {
                              onUpdatePlanStatus(plan.id, '¡Vivido!');
                              fireHeartConfetti();
                            }}
                            className="text-[11px] font-bold text-coral hover:underline flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" /> ¡Ya fuimos!
                          </button>
                        )}

                        {plan.status === '¡Vivido!' && (
                          <button
                            type="button"
                            onClick={() => onUpdatePlanStatus(plan.id, 'Idea / Antojo')}
                            className="text-[10px] text-carbon/60 dark:text-cream/60 hover:underline"
                          >
                            Reabrir idea
                          </button>
                        )}
                      </div>

                      {/* Edit & Delete */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEditPlan(plan)}
                          className="p-1 border border-carbon rounded bg-white dark:bg-nightCard hover:bg-butter"
                          title="Editar plan"
                        >
                          <Edit2 className="w-3 h-3 text-carbon dark:text-cream" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`¿Eliminar el plan "${plan.title}"?`)) {
                              onDeletePlan(plan.id);
                            }
                          }}
                          className="p-1 border border-carbon rounded bg-rosePastel-light hover:bg-rosePastel"
                          title="Eliminar plan"
                        >
                          <Trash2 className="w-3 h-3 text-carbon" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}

                {plansInColumn.length === 0 && (
                  <div className="p-6 text-center border-2 border-dashed border-carbon/30 rounded-2xl">
                    <p className="text-xs text-carbon/50 dark:text-cream/50 font-medium">
                      Sin planes en esta columna.
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
