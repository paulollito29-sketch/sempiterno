import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  RotateCw, 
  DollarSign, 
  Home, 
  Utensils, 
  Compass, 
  Check, 
  Flame, 
  HeartHandshake,
  Shuffle
} from 'lucide-react';
import { Plan, BudgetLevel, PlanCategory } from '../types';
import { fireSuperCelebration } from '../utils/confetti';

interface RouletteViewProps {
  plans: Plan[];
  onAcceptPlanChallenge: (plan: Plan) => void;
}

export const RouletteView: React.FC<RouletteViewProps> = ({
  plans,
  onAcceptPlanChallenge,
}) => {
  const [selectedBudget, setSelectedBudget] = useState<'Todos' | BudgetLevel>('Todos');
  const [selectedVibe, setSelectedVibe] = useState<'Todos' | 'En casa' | 'Salir' | 'Aventura'>('Todos');
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  // Available candidate plans from user's actual list
  const candidatePlans = plans.filter((p) => p.status !== '¡Vivido!');

  const filteredPool = candidatePlans.filter((p) => {
    const matchesBudget = selectedBudget === 'Todos' || p.budget === selectedBudget;
    let matchesVibe = true;
    if (selectedVibe === 'En casa') matchesVibe = p.category === 'Planes en Casa';
    if (selectedVibe === 'Salir') matchesVibe = p.category === 'Comida & Cafés';
    if (selectedVibe === 'Aventura') matchesVibe = p.category === 'Aventura' || p.category === 'Viajes';
    return matchesBudget && matchesVibe;
  });

  const finalPool = filteredPool.length > 0 ? filteredPool : candidatePlans;

  const handleSpinRoulette = () => {
    if (isSpinning || finalPool.length === 0) return;
    setIsSpinning(true);
    setSelectedPlan(null);

    // Fast cycling effect
    let cycles = 0;
    const maxCycles = 16;
    const interval = setInterval(() => {
      cycles++;
      const randomCandidate = finalPool[Math.floor(Math.random() * finalPool.length)];
      setSelectedPlan(randomCandidate);

      if (cycles >= maxCycles) {
        clearInterval(interval);
        setIsSpinning(false);
        fireSuperCelebration();
      }
    }, 120);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      {/* Banner */}
      <div className="bg-white dark:bg-nightCard border-3 border-carbon rounded-3xl p-6 sm:p-8 shadow-neo text-center relative overflow-hidden">
        <div className="inline-flex items-center gap-1.5 bg-butter border border-carbon px-3 py-1 rounded-full text-xs font-bold text-carbon mb-2">
          <Sparkles className="w-3.5 h-3.5 text-coral" />
          <span>¡Cero discusiones de qué hacer!</span>
        </div>

        <h2 className="font-display text-2xl sm:text-3xl font-black text-carbon dark:text-cream mb-2">
          ¿Qué hacemos hoy? 🎡
        </h2>
        <p className="text-xs sm:text-sm text-carbon/75 dark:text-cream/75 max-w-lg mx-auto font-medium">
          Elige los filtros según las ganas que tengan, gira la ruleta y dejen que el destino elija su próxima cita.
        </p>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 p-4 bg-cream dark:bg-nightSurface border-2 border-carbon rounded-2xl text-left">
          {/* Vibe filter */}
          <div>
            <label className="block text-xs font-black text-carbon dark:text-cream mb-1.5">
              Ganas de hoy:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'Todos', label: 'Cualquiera' },
                { id: 'En casa', label: '🏡 En casa' },
                { id: 'Salir', label: '🍽️ Salir a comer' },
                { id: 'Aventura', label: '🌿 Aventura' },
              ].map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVibe(v.id as any)}
                  className={`text-xs font-bold px-2.5 py-1 rounded-xl border border-carbon transition-all ${
                    selectedVibe === v.id
                      ? 'bg-coral text-white shadow-xs'
                      : 'bg-white dark:bg-nightCard text-carbon dark:text-cream'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Budget filter */}
          <div>
            <label className="block text-xs font-black text-carbon dark:text-cream mb-1.5">
              Presupuesto:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {['Todos', '$', '$$', '$$$'].map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setSelectedBudget(b as any)}
                  className={`text-xs font-bold px-3 py-1 rounded-xl border border-carbon transition-all ${
                    selectedBudget === b
                      ? 'bg-butter text-carbon font-black shadow-xs'
                      : 'bg-white dark:bg-nightCard text-carbon dark:text-cream'
                  }`}
                >
                  {b === 'Todos' ? 'Cualquiera' : b}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Spin Wheel Animation Box */}
        <div className="my-8 flex flex-col items-center justify-center">
          <div className="relative">
            {/* Outer Decorative Ring */}
            <motion.div
              animate={{ rotate: isSpinning ? 360 * 3 : 0 }}
              transition={{ duration: 2, ease: 'easeInOut' }}
              className="w-48 h-48 sm:w-56 sm:h-56 rounded-full border-4 border-carbon bg-gradient-to-tr from-coral via-butter to-rosePastel flex items-center justify-center shadow-neo-lg relative"
            >
              {/* Segments representation */}
              <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full border-3 border-carbon bg-white dark:bg-nightCard flex flex-col items-center justify-center p-4 text-center">
                <span className="text-3xl sm:text-4xl">
                  {isSpinning ? '🌀' : selectedPlan ? '🎉' : '✨'}
                </span>
                <span className="font-display font-black text-xs sm:text-sm text-carbon dark:text-cream mt-1">
                  {isSpinning ? 'Eligiendo cita...' : selectedPlan ? '¡Plan Elegido!' : 'Listos para girar'}
                </span>
              </div>
            </motion.div>

            {/* Pointer Pin */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 bg-coral border-2 border-carbon rotate-45 shadow-neo-sm z-10" />
          </div>

          {/* Spin Button or Empty State */}
          {finalPool.length === 0 ? (
            <div className="mt-6 p-4 max-w-md bg-cream dark:bg-nightSurface border-2 border-dashed border-carbon rounded-2xl text-center">
              <p className="text-xs font-bold text-carbon/75 dark:text-cream/75 mb-1">
                Aún no tienen planes registrados en su lista 🧭
              </p>
              <p className="text-[11px] text-carbon/60 dark:text-cream/60">
                Vayan a la pestaña <strong>"Por Vivir"</strong> y agreguen sus antojos o ideas para que la ruleta pueda elegir al azar entre sus planes reales.
              </p>
            </div>
          ) : (
            <>
              <button
                type="button"
                disabled={isSpinning}
                onClick={handleSpinRoulette}
                className="mt-6 neo-btn-primary py-3 px-8 text-base sm:text-lg flex items-center gap-2 font-black shadow-neo-lg"
              >
                <RotateCw className={`w-5 h-5 ${isSpinning ? 'animate-spin' : ''}`} />
                <span>{isSpinning ? 'Eligiendo...' : '¡Girar la Ruleta! 🎲'}</span>
              </button>
              <span className="text-[11px] font-semibold text-carbon/60 dark:text-cream/60 mt-2">
                Opciones disponibles en la tómbola: {finalPool.length} planes
              </span>
            </>
          )}
        </div>

        {/* Selected Plan Result Card */}
        <AnimatePresence>
          {selectedPlan && !isSpinning && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-butter-light border-3 border-carbon rounded-3xl p-6 shadow-neo-xl text-left relative"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="neo-badge bg-coral text-white text-xs">
                  {selectedPlan.category}
                </span>
                <span className="text-xs font-black px-2 py-0.5 bg-white border border-carbon rounded-md">
                  Presupuesto: {selectedPlan.budget}
                </span>
              </div>

              <h3 className="font-display text-xl sm:text-2xl font-black text-carbon mb-2">
                {selectedPlan.title}
              </h3>

              <p className="text-xs sm:text-sm text-carbon/80 font-medium mb-4 leading-relaxed">
                {selectedPlan.description || 'Un plan espontáneo y perfecto para disfrutar hoy juntos.'}
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 border-t-2 border-carbon/20">
                <button
                  type="button"
                  onClick={() => onAcceptPlanChallenge(selectedPlan)}
                  className="w-full sm:w-auto flex-1 neo-btn-primary py-2.5 px-4 text-xs sm:text-sm flex items-center justify-center gap-2 font-black"
                >
                  <HeartHandshake className="w-4 h-4" />
                  <span>¡Aceptamos el reto! (Agendar cita)</span>
                </button>

                <button
                  type="button"
                  onClick={handleSpinRoulette}
                  className="w-full sm:w-auto neo-btn-secondary py-2.5 px-4 text-xs sm:text-sm flex items-center justify-center gap-1.5"
                >
                  <Shuffle className="w-4 h-4" />
                  <span>Girar otra opción</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
