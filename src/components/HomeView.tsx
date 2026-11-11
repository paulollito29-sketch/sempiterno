import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, CalendarHeart, Clock, Dices, Heart, MapPin, Sparkles } from 'lucide-react';
import { CoupleSettings, CoupleThought, KissesData, UserSession } from '../types';
import { calculateElapsedTime, formatDate } from '../utils/date';
import { triggerHapticImpact, triggerHapticSuccess } from '../utils/native';
import { MobileTab } from './BottomNav';

interface HomeViewProps {
  settings: CoupleSettings;
  session: UserSession;
  thought: CoupleThought;
  kissesData?: KissesData;
  placesCount: number;
  capsulesCount: number;
  plansCount: number;
  hapticsEnabled: boolean;
  onSendKiss: () => Promise<void>;
  onOpenPairManage: () => void;
  onOpenThoughtModal: () => void;
  onNavigateTab: (tab: MobileTab) => void;
  onOpenBedtime: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  settings,
  session,
  thought,
  kissesData,
  placesCount,
  capsulesCount,
  plansCount,
  hapticsEnabled,
  onSendKiss,
  onOpenPairManage,
  onOpenThoughtModal,
  onNavigateTab,
  onOpenBedtime,
}) => {
  const [elapsed, setElapsed] = useState(() => calculateElapsedTime(settings.startDate));
  const [ripples, setRipples] = useState<number[]>([]);
  const [kissSentToast, setKissSentToast] = useState(false);

  useEffect(() => {
    setElapsed(calculateElapsedTime(settings.startDate));
    const timer = setInterval(() => {
      setElapsed(calculateElapsedTime(settings.startDate));
    }, 1000);
    return () => clearInterval(timer);
  }, [settings.startDate]);

  const p1Initial = (settings.partner1.name || 'P').charAt(0).toUpperCase();
  const p2Initial = (settings.partner2.name || 'A').charAt(0).toUpperCase();
  const partnerTargetName =
    settings.currentUser === 'Gigio'
      ? settings.partner2.name || 'Alexandra'
      : settings.partner1.name || 'Paulo';

  const handleKissPress = async () => {
    const id = Date.now();
    setRipples((prev) => [...prev, id]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r !== id));
    }, 800);

    await triggerHapticSuccess(hapticsEnabled);
    setKissSentToast(true);
    setTimeout(() => setKissSentToast(false), 2600);

    await onSendKiss();
  };

  // Relative time formatter for live thought
  const formatThoughtTime = (iso: string) => {
    const diffMins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
    if (diffMins < 1) return 'Justo ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours} h`;
    return formatDate(iso);
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Top Couple Header */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          {/* Partner 1 Avatar */}
          <div className="relative">
            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-stone-200 to-rose-100 dark:from-stone-700 dark:to-rose-900/50 border-2 border-white dark:border-stone-800 shadow-sm flex items-center justify-center font-bold text-stone-700 dark:text-stone-100 text-sm">
              {p1Initial}
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#FAF8F5] dark:border-[#0F1015] rounded-full" />
          </div>

          <span className="text-rose-400 text-xs font-semibold tracking-wider">&hearts;</span>

          {/* Partner 2 Avatar */}
          <div className="relative">
            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-rose-200 to-amber-100 dark:from-rose-900/60 dark:to-amber-900/40 border-2 border-white dark:border-stone-800 shadow-sm flex items-center justify-center font-bold text-rose-700 dark:text-rose-200 text-sm">
              {p2Initial}
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#FAF8F5] dark:border-[#0F1015] rounded-full" />
          </div>
        </div>

        {/* Right Controls: Bedtime button & Couple Code Badge */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              triggerHapticImpact('light', hapticsEnabled);
              onOpenBedtime();
            }}
            title="Modo Buenas Noches"
            className="w-9 h-9 rounded-full bg-white dark:bg-[#181A20] border border-stone-200/80 dark:border-stone-800 shadow-xs flex items-center justify-center text-stone-600 dark:text-stone-300 active:scale-95 transition-transform"
          >
            <Sparkles className="w-4 h-4 text-rose-500" />
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHapticImpact('light', hapticsEnabled);
              onOpenPairManage();
            }}
            className="px-3 py-1.5 rounded-full bg-white dark:bg-[#181A20] border border-stone-200/80 dark:border-stone-800 shadow-xs flex items-center gap-1.5 text-[11px] font-semibold text-stone-700 dark:text-stone-200 active:scale-95 transition-transform"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                session.isPaired ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <span className="font-mono text-[10px]">{session.coupleId}</span>
          </button>
        </div>
      </div>

      {/* Days Counter Hero Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-3xl bg-white dark:bg-[#181A20] border border-stone-200/60 dark:border-stone-800 shadow-sm relative overflow-hidden"
      >
        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-rose-50/80 dark:bg-rose-950/30 rounded-full blur-2xl pointer-events-none" />
        <span className="text-[11px] font-semibold text-rose-500 uppercase tracking-widest block">
          Juntos desde el primer día
        </span>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="serif-title text-4xl font-semibold text-stone-900 dark:text-stone-100 tracking-tight">
            {elapsed.totalDays}
          </span>
          <span className="text-sm font-medium text-stone-500 dark:text-stone-400">
            días llenos de amor
          </span>
        </div>
        <p className="text-xs text-stone-400 mt-1.5">
          {settings.partner1.name} & {settings.partner2.name} &bull;{' '}
          {formatDate(settings.startDate)}
        </p>

        <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs text-stone-600 dark:text-stone-400">
          <span>Tiempo exacto:</span>
          <span className="font-semibold text-rose-600 dark:text-rose-400 font-mono text-[11px]">
            {elapsed.years > 0 ? `${elapsed.years}a ` : ''}
            {elapsed.months}m {elapsed.days}d &bull; {String(elapsed.hours).padStart(2, '0')}:
            {String(elapsed.minutes).padStart(2, '0')}:{String(elapsed.seconds).padStart(2, '0')}
          </span>
        </div>
      </motion.div>

      {/* Live Thought Card (Dark Minimalist Editorial) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="p-5 rounded-3xl bg-gradient-to-br from-stone-900 to-stone-800 dark:from-[#1E2028] dark:to-[#16171D] text-white shadow-md relative"
      >
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
            <span className="text-[11px] font-medium tracking-wide uppercase text-stone-300">
              Pensamiento en vivo
            </span>
          </div>
          <span className="text-[10px] text-stone-400">{formatThoughtTime(thought.createdAt)}</span>
        </div>

        <p className="text-sm font-medium text-stone-100 leading-relaxed italic">
          "{thought.text}"
        </p>

        <div className="mt-3.5 flex items-center justify-between">
          <span className="text-xs text-rose-300 font-semibold">— {thought.senderName}</span>
          <button
            type="button"
            onClick={() => {
              triggerHapticImpact('light', hapticsEnabled);
              onOpenThoughtModal();
            }}
            className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs text-stone-100 transition-colors flex items-center gap-1.5 active:scale-95"
          >
            <span>Escribir pensamiento</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </motion.div>

      {/* Interactive Haptic Kiss Button (Obimy style) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-6 rounded-3xl bg-white dark:bg-[#181A20] border border-stone-200/60 dark:border-stone-800 shadow-sm text-center relative overflow-hidden"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
            Conexión Instantánea
          </span>
          {kissesData && (
            <span className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/50 px-2.5 py-0.5 rounded-full">
              {kissesData.totalKisses} toques
            </span>
          )}
        </div>

        <h3 className="serif-title text-lg font-semibold text-stone-900 dark:text-stone-100 mb-4">
          Envía un beso o caricia
        </h3>

        <div className="relative inline-flex items-center justify-center">
          <AnimatePresence>
            {ripples.map((r) => (
              <span
                key={r}
                className="absolute w-28 h-28 rounded-full bg-rose-400/35 ripple-effect pointer-events-none"
              />
            ))}
          </AnimatePresence>

          <button
            type="button"
            onClick={handleKissPress}
            className="w-24 h-24 rounded-full bg-gradient-to-tr from-rose-500 to-rose-400 text-white shadow-lg shadow-rose-500/30 flex flex-col items-center justify-center active:scale-90 transition-transform duration-150 relative z-10"
          >
            <Heart className="w-9 h-9 pulse-heart fill-current" />
            <span className="text-[10px] font-bold uppercase tracking-wider mt-1">Tocar</span>
          </button>
        </div>

        <p
          className={`text-xs mt-4 transition-all duration-300 ${
            kissSentToast
              ? 'text-rose-600 dark:text-rose-400 font-bold'
              : 'text-stone-400'
          }`}
        >
          {kissSentToast
            ? `¡Beso enviado a ${partnerTargetName} con vibración!`
            : 'Toca el corazón para enviar una vibración a su teléfono'}
        </p>
      </motion.div>

      {/* Quick Shortcuts Grid */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => {
            triggerHapticImpact('light', hapticsEnabled);
            onNavigateTab('rincones');
          }}
          className="text-left p-4 rounded-2xl bg-white dark:bg-[#181A20] border border-stone-200/60 dark:border-stone-800 shadow-xs active:scale-[0.98] transition-transform"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2">
            <MapPin className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-stone-800 dark:text-stone-100 block">
            Nuestros Rincones
          </span>
          <span className="text-[11px] text-stone-400">{placesCount} lugares guardados</span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHapticImpact('light', hapticsEnabled);
            onNavigateTab('capsulas');
          }}
          className="text-left p-4 rounded-2xl bg-white dark:bg-[#181A20] border border-stone-200/60 dark:border-stone-800 shadow-xs active:scale-[0.98] transition-transform"
        >
          <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-2">
            <Clock className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-stone-800 dark:text-stone-100 block">
            Cápsulas del Tiempo
          </span>
          <span className="text-[11px] text-stone-400">{capsulesCount} guardadas</span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHapticImpact('light', hapticsEnabled);
            onNavigateTab('planes');
          }}
          className="text-left p-4 rounded-2xl bg-white dark:bg-[#181A20] border border-stone-200/60 dark:border-stone-800 shadow-xs active:scale-[0.98] transition-transform"
        >
          <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-500 flex items-center justify-center mb-2">
            <CalendarHeart className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-stone-800 dark:text-stone-100 block">
            Planes & Citas
          </span>
          <span className="text-[11px] text-stone-400">{plansCount} planes por vivir</span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHapticImpact('light', hapticsEnabled);
            onNavigateTab('ruleta');
          }}
          className="text-left p-4 rounded-2xl bg-white dark:bg-[#181A20] border border-stone-200/60 dark:border-stone-800 shadow-xs active:scale-[0.98] transition-transform"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
            <Dices className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-stone-800 dark:text-stone-100 block">
            Ruleta de Citas
          </span>
          <span className="text-[11px] text-stone-400">¿No saben qué hacer?</span>
        </button>
      </div>
    </div>
  );
};
