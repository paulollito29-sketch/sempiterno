import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Heart, 
  Sparkles, 
  Calendar, 
  Clock, 
  MapPin, 
  Shirt, 
  Shuffle, 
  Eye, 
  EyeOff, 
  PlusCircle, 
  ArrowRight, 
  Compass, 
  Flame, 
  CalendarCheck,
  Edit3
} from 'lucide-react';
import { CoupleSettings, Memory, Plan } from '../types';
import { calculateElapsedTime, calculateCountdown, formatDate } from '../utils/date';
import { RatingDisplay } from './RatingDisplay';
import { fireHeartConfetti } from '../utils/confetti';
import { MouseEarsIcon } from './TopoEarsIcon';

interface DashboardProps {
  settings: CoupleSettings;
  memories: Memory[];
  plans: Plan[];
  onNavigateToMemories: (memoryId?: string) => void;
  onNavigateToPlans: () => void;
  onNavigateToRoulette: () => void;
  onOpenNewMemory: () => void;
  onOpenNewPlan: () => void;
  onUpdateStartDate: (newDate: string) => void;
  onCompletePlan: (plan: Plan) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  settings,
  memories,
  plans,
  onNavigateToMemories,
  onNavigateToPlans,
  onNavigateToRoulette,
  onOpenNewMemory,
  onOpenNewPlan,
  onUpdateStartDate,
  onCompletePlan,
}) => {
  // Real-time ticker for elapsed time
  const [elapsed, setElapsed] = useState(() => calculateElapsedTime(settings.startDate));
  const [isEditingStartDate, setIsEditingStartDate] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(settings.startDate.split('T')[0]);

  // Flashback state
  const [flashbackIndex, setFlashbackIndex] = useState(() => {
    return memories.length > 0 ? Math.floor(Math.random() * memories.length) : 0;
  });
  const [isFlipping, setIsFlipping] = useState(false);

  // Next upcoming date
  const upcomingPlans = plans
    .filter((p) => p.status === 'Agendado' && p.scheduledDate)
    .sort((a, b) => {
      const dateA = new Date(`${a.scheduledDate}T${a.scheduledTime || '00:00'}`).getTime();
      const dateB = new Date(`${b.scheduledDate}T${b.scheduledTime || '00:00'}`).getTime();
      return dateA - dateB;
    });

  const nextPlan = upcomingPlans[0] || null;
  const [nextPlanCountdown, setNextPlanCountdown] = useState(() => {
    if (!nextPlan || !nextPlan.scheduledDate) return null;
    return calculateCountdown(`${nextPlan.scheduledDate}T${nextPlan.scheduledTime || '20:00'}`);
  });
  const [showSurpriseNote, setShowSurpriseNote] = useState(false);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(calculateElapsedTime(settings.startDate));

      if (nextPlan && nextPlan.scheduledDate) {
        setNextPlanCountdown(
          calculateCountdown(`${nextPlan.scheduledDate}T${nextPlan.scheduledTime || '20:00'}`)
        );
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [settings.startDate, nextPlan]);

  const handleShuffleFlashback = () => {
    if (memories.length <= 1) return;
    setIsFlipping(true);
    setTimeout(() => {
      let nextIdx = Math.floor(Math.random() * memories.length);
      while (nextIdx === flashbackIndex && memories.length > 1) {
        nextIdx = Math.floor(Math.random() * memories.length);
      }
      setFlashbackIndex(nextIdx);
      setIsFlipping(false);
    }, 200);
  };

  const handleSaveStartDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempStartDate) {
      onUpdateStartDate(`${tempStartDate}T19:30:00`);
      setIsEditingStartDate(false);
      fireHeartConfetti();
    }
  };

  const currentFlashback = memories[flashbackIndex] || memories[0];

  return (
    <div className="space-y-6 sm:space-y-8 pb-16">
      {/* Top Banner / Warm Welcome */}
      <section className="bg-gradient-to-r from-rosePastel-light via-cream to-butter-light dark:from-nightSurface dark:via-night dark:to-nightCard border-3 border-carbon rounded-3xl p-5 sm:p-7 shadow-neo relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-carbon overflow-hidden shadow-neo-sm shrink-0 bg-white">
              <img
                src="/assets/gigio-rosita.jpg"
                alt="Gigio & Rosita"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 bg-white dark:bg-nightCard border border-carbon px-2.5 py-0.5 rounded-full text-xs font-bold text-coral mb-1.5 shadow-xs">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Nuestra historia de amor</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-black text-carbon dark:text-cream leading-tight">
                ¡Hola, {settings.currentUser === 'Gigio' ? settings.partner1.nickname : settings.partner2.nickname}! 🐭❤️
              </h2>
              <p className="text-xs sm:text-sm text-carbon/80 dark:text-cream/80 font-medium">
                Hoy es un día perfecto para recordar lo felices que somos y soñar con lo que viene.
              </p>
            </div>
          </div>

          {/* Quick Action Badges */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center">
            <button
              type="button"
              onClick={onOpenNewMemory}
              className="neo-btn-primary py-2 px-3 sm:px-4 text-xs sm:text-sm flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nuevo Recuerdo</span>
            </button>
            <button
              type="button"
              onClick={onNavigateToRoulette}
              className="neo-btn-secondary py-2 px-3 sm:px-4 text-xs sm:text-sm flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4" />
              <span>¿Qué hacemos hoy?</span>
            </button>
          </div>
        </div>
      </section>

      {/* 1. CONTADOR SEMPITERNO */}
      <section className="bg-white dark:bg-nightCard border-3 border-carbon rounded-3xl p-5 sm:p-8 shadow-neo relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b-2 border-carbon/20">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">⏳</span>
              <h3 className="font-display text-xl sm:text-2xl font-black text-carbon dark:text-cream">
                Contador Sempiterno
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-carbon/70 dark:text-cream/70 font-semibold mt-0.5">
              Tiempo amándonos desde el{' '}
              <strong className="text-coral underline cursor-pointer" onClick={() => setIsEditingStartDate(true)}>
                {formatDate(settings.startDate)}
              </strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="neo-badge bg-butter text-carbon flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-coral fill-coral" />
              <span>{elapsed.totalDays} días juntos</span>
            </span>
            <button
              type="button"
              onClick={() => setIsEditingStartDate(!isEditingStartDate)}
              className="p-1.5 border-2 border-carbon rounded-lg bg-cream dark:bg-nightSurface text-carbon dark:text-cream hover:bg-rosePastel shadow-neo-sm text-xs font-bold"
              title="Cambiar fecha de inicio"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Date editor modal inline */}
        {isEditingStartDate && (
          <form
            onSubmit={handleSaveStartDate}
            className="mb-6 p-4 bg-rosePastel-light/40 dark:bg-nightSurface border-2 border-dashed border-carbon rounded-2xl flex flex-wrap items-center gap-3"
          >
            <label className="text-xs font-bold text-carbon dark:text-cream">
              Fecha cuando comenzó nuestra historia:
            </label>
            <input
              type="date"
              value={tempStartDate}
              onChange={(e) => setTempStartDate(e.target.value)}
              className="neo-input text-xs py-1.5"
            />
            <button type="submit" className="neo-btn-primary text-xs py-1.5 px-3">
              Guardar fecha
            </button>
            <button
              type="button"
              onClick={() => setIsEditingStartDate(false)}
              className="text-xs font-bold text-carbon/60 dark:text-cream/60 hover:underline"
            >
              Cancelar
            </button>
          </form>
        )}

        {/* Live Counters Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-4">
          {[
            { label: 'Años', value: elapsed.years, color: 'bg-rosePastel-light' },
            { label: 'Meses', value: elapsed.months, color: 'bg-butter-light' },
            { label: 'Días', value: elapsed.days, color: 'bg-skyNeo/50' },
            { label: 'Horas', value: elapsed.hours, color: 'bg-lavender/60' },
            { label: 'Minutos', value: elapsed.minutes, color: 'bg-sage/70' },
            { label: 'Segundos', value: elapsed.seconds, color: 'bg-rosePastel/40', animate: true },
          ].map((item, idx) => (
            <div
              key={idx}
              className={`${item.color} dark:bg-nightSurface border-2 border-carbon rounded-2xl p-3 sm:p-4 text-center shadow-neo-sm relative`}
            >
              <div
                className={`font-display text-2xl sm:text-4xl font-black text-carbon dark:text-cream ${
                  item.animate ? 'tabular-nums' : ''
                }`}
              >
                {item.value < 10 ? `0${item.value}` : item.value}
              </div>
              <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-carbon/70 dark:text-cream/70 mt-1">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Grid: 2. Próxima Cita & 3. Flashback Aleatorio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        
        {/* 2. PRÓXIMA CITA AGENDADA (Col-span 6) */}
        <div className="lg:col-span-6 bg-cream dark:bg-nightCard border-3 border-carbon rounded-3xl p-5 sm:p-7 shadow-neo flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">💌</span>
                <h3 className="font-display text-lg sm:text-xl font-black text-carbon dark:text-cream">
                  Próxima Cita Agendada
                </h3>
              </div>
              <button
                type="button"
                onClick={onNavigateToPlans}
                className="text-xs font-bold text-coral hover:underline flex items-center gap-1"
              >
                Ver todos los planes <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {nextPlan ? (
              <div className="space-y-4">
                <div className="bg-white dark:bg-nightSurface border-2 border-carbon rounded-2xl p-4 sm:p-5 shadow-neo-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="neo-badge bg-coral text-white text-[11px] mb-2 inline-block">
                        {nextPlan.category}
                      </span>
                      <h4 className="font-display text-xl font-bold text-carbon dark:text-cream">
                        {nextPlan.title}
                      </h4>
                      <p className="text-xs sm:text-sm text-carbon/80 dark:text-cream/80 mt-1">
                        {nextPlan.description}
                      </p>
                    </div>
                    <span className="text-xs font-bold px-2 py-1 bg-butter rounded-lg border border-carbon shrink-0">
                      Presupuesto {nextPlan.budget}
                    </span>
                  </div>

                  {/* Date, Time, Location */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 pt-3 border-t-2 border-carbon/10 text-xs font-medium text-carbon/80 dark:text-cream/80">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-coral shrink-0" />
                      <span>{formatDate(nextPlan.scheduledDate || '')}</span>
                    </div>
                    {nextPlan.scheduledTime && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-coral shrink-0" />
                        <span>Hora: {nextPlan.scheduledTime}</span>
                      </div>
                    )}
                    {nextPlan.location && (
                      <div className="flex items-center gap-1.5 sm:col-span-2">
                        <MapPin className="w-4 h-4 text-coral shrink-0" />
                        <span>Lugar: {nextPlan.location}</span>
                      </div>
                    )}
                    {nextPlan.dressCode && (
                      <div className="flex items-center gap-1.5 sm:col-span-2">
                        <Shirt className="w-4 h-4 text-coral shrink-0" />
                        <span>Dress code: {nextPlan.dressCode}</span>
                      </div>
                    )}
                  </div>

                  {/* Surprise Note Accordion */}
                  {nextPlan.surpriseNote && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => setShowSurpriseNote(!showSurpriseNote)}
                        className="text-xs font-bold text-coral flex items-center gap-1 hover:underline"
                      >
                        {showSurpriseNote ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" /> Ocultar nota secreta
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" /> Ver nota sorpresa 👀
                          </>
                        )}
                      </button>

                      <AnimatePresence>
                        {showSurpriseNote && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden mt-2"
                          >
                            <div className="p-3 bg-butter-light border-2 border-dashed border-carbon rounded-xl text-xs text-carbon font-semibold">
                              🤫 {nextPlan.surpriseNote}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {/* Countdown Box */}
                {nextPlanCountdown && !nextPlanCountdown.isPast && (
                  <div className="bg-coral-light/20 dark:bg-coral-dark/20 border-2 border-carbon rounded-2xl p-3 flex items-center justify-between">
                    <span className="text-xs font-bold text-coral dark:text-coral-light flex items-center gap-1.5">
                      <Clock className="w-4 h-4 animate-spin" /> Faltan solo:
                    </span>
                    <div className="font-display font-black text-sm sm:text-base text-carbon dark:text-cream tracking-wide">
                      {nextPlanCountdown.days}d {nextPlanCountdown.hours}h {nextPlanCountdown.minutes}m {nextPlanCountdown.seconds}s
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-nightSurface border-2 border-dashed border-carbon rounded-2xl p-6 text-center">
                <p className="text-sm font-semibold text-carbon/70 dark:text-cream/70 mb-3">
                  Aún no tenemos una próxima cita con fecha fija en el calendario.
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={onOpenNewPlan}
                    className="neo-btn-primary text-xs py-2 px-3"
                  >
                    Agendar una cita ahora
                  </button>
                  <button
                    type="button"
                    onClick={onNavigateToRoulette}
                    className="neo-btn-secondary text-xs py-2 px-3"
                  >
                    Girar la Ruleta
                  </button>
                </div>
              </div>
            )}
          </div>

          {nextPlan && (
            <div className="mt-4 pt-3 flex gap-2">
              <button
                type="button"
                onClick={() => onCompletePlan(nextPlan)}
                className="neo-btn-primary w-full py-2 text-xs flex items-center justify-center gap-1.5"
              >
                <CalendarCheck className="w-4 h-4" />
                <span>¡Ya la vivimos! Convertir en Recuerdo</span>
              </button>
            </div>
          )}
        </div>

        {/* 3. FLASHBACK ALEATORIO ("Un recuerdo al azar") (Col-span 6) */}
        <div className="lg:col-span-6 bg-white dark:bg-nightCard border-3 border-carbon rounded-3xl p-5 sm:p-7 shadow-neo flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">📸</span>
                <h3 className="font-display text-lg sm:text-xl font-black text-carbon dark:text-cream">
                  Un Recuerdo al Azar
                </h3>
              </div>
              <button
                type="button"
                onClick={handleShuffleFlashback}
                disabled={isFlipping || memories.length <= 1}
                className="neo-btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <Shuffle className={`w-3.5 h-3.5 ${isFlipping ? 'animate-spin' : ''}`} />
                <span>Girar otro</span>
              </button>
            </div>

            {currentFlashback ? (
              <motion.div
                key={currentFlashback.id}
                initial={{ rotate: -2, scale: 0.96 }}
                animate={{ rotate: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                className="bg-cream dark:bg-nightSurface border-3 border-carbon rounded-2xl p-4 shadow-neo relative"
              >
                {/* Vintage Washi Tape Top Decoration */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-butter/90 border border-carbon rotate-1 shadow-xs pointer-events-none" />

                {/* Polaroid Photo Frame */}
                <div className="w-full h-44 sm:h-52 bg-carbon/10 rounded-xl overflow-hidden border-2 border-carbon mb-3 relative">
                  <img
                    src={currentFlashback.photos[0] || '/assets/gigio-rosita.jpg'}
                    alt={currentFlashback.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 bg-carbon/80 text-white text-[10px] font-bold px-2 py-0.5 rounded border border-carbon">
                    {formatDate(currentFlashback.date)}
                  </div>
                </div>

                {/* Title & Category */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="neo-badge bg-rosePastel text-carbon text-[10px] mb-1 inline-block">
                      {currentFlashback.category}
                    </span>
                    <h4 className="font-display text-base sm:text-lg font-bold text-carbon dark:text-cream leading-tight">
                      {currentFlashback.title}
                    </h4>
                  </div>
                  <RatingDisplay
                    rating={currentFlashback.rating}
                    type={settings.ratingStyle}
                    size="sm"
                  />
                </div>

                {/* Dual Perspective Snippet */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-white dark:bg-nightCard border border-carbon rounded-xl p-2.5 mt-2">
                  <div className="border-b sm:border-b-0 sm:border-r border-carbon/20 pb-2 sm:pb-0 sm:pr-2">
                    <span className="font-bold text-coral flex items-center gap-1 mb-0.5">
                      <MouseEarsIcon type="gigio" size={14} /> Gigio:
                    </span>
                    <p className="line-clamp-2 text-carbon/80 dark:text-cream/80 italic">
                      "{currentFlashback.perspectiveGigio}"
                    </p>
                  </div>
                  <div className="pt-2 sm:pt-0 sm:pl-2">
                    <span className="font-bold text-coral flex items-center gap-1 mb-0.5">
                      <MouseEarsIcon type="rosita" size={14} /> Rosita:
                    </span>
                    <p className="line-clamp-2 text-carbon/80 dark:text-cream/80 italic">
                      "{currentFlashback.perspectiveRosita}"
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="text-center p-8 text-sm text-carbon/60 dark:text-cream/60">
                Aún no tienes recuerdos guardados. ¡Crea el primero!
              </div>
            )}
          </div>

          {currentFlashback && (
            <div className="mt-4 pt-2">
              <button
                type="button"
                onClick={() => onNavigateToMemories(currentFlashback.id)}
                className="neo-btn-white w-full py-2 text-xs flex items-center justify-center gap-1.5"
              >
                <span>Ver este recuerdo completo en la Bitácora</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
