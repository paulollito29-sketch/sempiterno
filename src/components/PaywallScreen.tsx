import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Heart, Sparkles } from 'lucide-react';
import { SubscriptionPlan } from '../types';
import { triggerHapticImpact, triggerHapticSuccess } from '../utils/native';

interface PaywallScreenProps {
  currentPlan: SubscriptionPlan;
  onSelectPlan: (plan: SubscriptionPlan) => void;
  onBack?: () => void;
}

export const PaywallScreen: React.FC<PaywallScreenProps> = ({
  currentPlan,
  onSelectPlan,
  onBack,
}) => {
  const [selectedTier, setSelectedTier] = useState<'annual' | 'monthly'>(
    currentPlan === 'monthly' ? 'monthly' : 'annual'
  );

  const handleSubscribe = async () => {
    await triggerHapticSuccess();
    onSelectPlan(selectedTier);
  };

  const handleContinueFree = async () => {
    await triggerHapticImpact('light');
    onSelectPlan('free');
  };

  return (
    <div className="min-h-[100dvh] bg-[#FAF8F5] dark:bg-[#0F1015] flex flex-col justify-between px-6 py-8 max-w-md mx-auto">
      <div>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 font-medium mb-3 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Atrás
          </button>
        )}

        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 text-[10px] font-bold tracking-wider uppercase mb-2">
            <Heart className="w-3 h-3 fill-current" />
            Plan para dos personas
          </span>
          <h1 className="serif-title text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
            Sempiterno Duo
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Un único plan cubre a <b>ambos</b>. Disfruta todo sin límites o usa el plan gratuito.
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="my-5 space-y-3"
      >
        {/* Annual Card */}
        <button
          type="button"
          onClick={() => {
            triggerHapticImpact('light');
            setSelectedTier('annual');
          }}
          className={`w-full text-left p-4 rounded-3xl bg-white dark:bg-[#181A20] relative transition-all ${
            selectedTier === 'annual'
              ? 'border-2 border-rose-500 shadow-md shadow-rose-500/10'
              : 'border border-stone-200/80 dark:border-stone-800 shadow-xs'
          }`}
        >
          <div className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-rose-500 to-rose-600 text-white text-[9px] font-extrabold uppercase tracking-wider shadow-xs">
            Ahorra 50% &bull; Más elegido
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider">
                Plan Anual Dúo
              </h4>
              <p className="text-[11px] text-stone-400 mt-0.5">Facturado $29.99 al año</p>
            </div>
            <div className="text-right">
              <span className="text-xl font-extrabold text-stone-900 dark:text-stone-100">$2.49</span>
              <span className="text-[10px] text-stone-500 block -mt-1">/ mes</span>
            </div>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Incluye 7 días gratis
            </span>
            <span className="text-stone-400 font-normal">Para los dos</span>
          </div>
        </button>

        {/* Monthly Card */}
        <button
          type="button"
          onClick={() => {
            triggerHapticImpact('light');
            setSelectedTier('monthly');
          }}
          className={`w-full text-left p-4 rounded-3xl bg-white dark:bg-[#181A20] relative transition-all ${
            selectedTier === 'monthly'
              ? 'border-2 border-rose-500 shadow-md shadow-rose-500/10'
              : 'border border-stone-200/80 dark:border-stone-800 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider">
                Plan Mensual Dúo
              </h4>
              <p className="text-[11px] text-stone-400 mt-0.5">Cancela cuando quieras</p>
            </div>
            <div className="text-right">
              <span className="text-xl font-extrabold text-stone-900 dark:text-stone-100">$4.99</span>
              <span className="text-[10px] text-stone-500 block -mt-1">/ mes</span>
            </div>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-[11px] text-stone-600 dark:text-stone-400">
            <span>Cobro mes a mes</span>
            <span className="text-stone-400">Para los dos</span>
          </div>
        </button>

        {/* Free vs Premium Comparison */}
        <div className="p-4 rounded-3xl bg-white/80 dark:bg-[#181A20]/80 border border-stone-200/80 dark:border-stone-800 text-[11px] space-y-2.5">
          <div className="flex items-center justify-between pb-2 border-b border-stone-200/80 dark:border-stone-800 text-stone-400 font-bold uppercase text-[9px] tracking-wider">
            <span>Característica</span>
            <div className="flex gap-4">
              <span className="w-12 text-center text-stone-500">Free</span>
              <span className="w-16 text-center text-rose-600 dark:text-rose-400 font-bold">Premium</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-stone-700 dark:text-stone-300">
            <span>Recuerdos compartidos</span>
            <div className="flex gap-4 text-[10px]">
              <span className="w-12 text-center text-stone-500">Hasta 10</span>
              <span className="w-16 text-center font-bold text-rose-600 dark:text-rose-400">Ilimitados</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-stone-700 dark:text-stone-300">
            <span>Calidad de fotos</span>
            <div className="flex gap-4 text-[10px]">
              <span className="w-12 text-center text-stone-500">Estándar</span>
              <span className="w-16 text-center font-bold text-rose-600 dark:text-rose-400">Ultra HD</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-stone-700 dark:text-stone-300">
            <span>Cápsulas del tiempo</span>
            <div className="flex gap-4 text-[10px]">
              <span className="w-12 text-center text-stone-500">Solo 1</span>
              <span className="w-16 text-center font-bold text-rose-600 dark:text-rose-400">Ilimitadas</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-stone-700 dark:text-stone-300">
            <span>Pensamientos y toques</span>
            <div className="flex gap-4 text-[10px]">
              <span className="w-12 text-center text-stone-500">Básicos</span>
              <span className="w-16 text-center font-bold text-rose-600 dark:text-rose-400">Tiempo Real</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-stone-700 dark:text-stone-300">
            <span>Rincones y favoritos</span>
            <div className="flex gap-4 text-[10px]">
              <span className="w-12 text-center text-stone-500">Hasta 5</span>
              <span className="w-16 text-center font-bold text-rose-600 dark:text-rose-400">Ilimitados</span>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={handleSubscribe}
          className="w-full py-3.5 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-md shadow-rose-500/25 active:scale-[0.98] transition-all text-center"
        >
          Comenzar 7 Días de Prueba Gratis
        </button>

        <button
          type="button"
          onClick={handleContinueFree}
          className="w-full py-2.5 text-center text-xs font-semibold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
        >
          O continuar con Plan Free →
        </button>

        <p className="text-[10px] text-stone-400 text-center">
          $0 hoy. Sin compromiso, puedes cancelar en cualquier momento.
        </p>
      </div>
    </div>
  );
};
