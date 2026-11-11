import React from 'react';
import { LogOut, Moon, SlidersHorizontal, Sparkles, Sun, UserCheck } from 'lucide-react';
import {
  CoupleSettings,
  NotificationSettings,
  UserSession,
} from '../types';
import { FreemiumUsage } from '../utils/coupleCloud';
import { triggerHapticImpact } from '../utils/native';

interface SettingsViewProps {
  settings: CoupleSettings;
  session: UserSession;
  usage: FreemiumUsage;
  notifications: NotificationSettings;
  onUpdateNotifications: (prefs: NotificationSettings) => void;
  onToggleDarkMode: () => void;
  onSwitchUserRole: (role: 'Gigio' | 'Rosita') => void;
  onOpenPairManage: () => void;
  onOpenPaywall: () => void;
  onOpenLegacySettings: () => void;
  onLogout: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  session,
  usage,
  notifications,
  onUpdateNotifications,
  onToggleDarkMode,
  onSwitchUserRole,
  onOpenPairManage,
  onOpenPaywall,
  onOpenLegacySettings,
  onLogout,
}) => {
  const memoriesPct = Math.min(100, Math.round((usage.memoriesUsed / usage.memoriesMax) * 100));
  const placesPct = Math.min(100, Math.round((usage.placesUsed / usage.placesMax) * 100));
  const capsulesPct = Math.min(100, Math.round((usage.capsulesUsed / usage.capsulesMax) * 100));

  return (
    <div className="space-y-4 pb-6 pt-2">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="serif-title text-2xl font-bold text-stone-900 dark:text-stone-100">
            Ajustes
          </h2>
          <p className="text-xs text-stone-400">Configuración de pareja y suscripción</p>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHapticImpact('light', notifications.hapticsEnabled);
            onOpenLegacySettings();
          }}
          className="p-2.5 rounded-full bg-white dark:bg-[#181A20] border border-stone-200/80 dark:border-stone-800 text-stone-600 dark:text-stone-300 shadow-xs active:scale-95 transition-transform"
          title="Configuración avanzada de pareja y Supabase"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Freemium Status Card */}
      <div className="p-5 rounded-3xl bg-white dark:bg-[#181A20] border border-stone-200/80 dark:border-stone-800 shadow-sm">
        <div className="flex items-center justify-between">
          <span
            className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full ${
              usage.isPremium
                ? 'bg-rose-500 text-white'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
            }`}
          >
            {usage.isPremium
              ? usage.plan === 'annual'
                ? 'Premium Anual Dúo'
                : 'Premium Mensual Dúo'
              : 'Plan Free Activo'}
          </span>
          {!usage.isPremium && (
            <button
              type="button"
              onClick={onOpenPaywall}
              className="text-xs text-rose-600 dark:text-rose-400 font-semibold hover:underline"
            >
              Subir de nivel →
            </button>
          )}
        </div>

        <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 mt-2.5">
          {usage.isPremium ? 'Todo Desbloqueado para Ambos' : 'Límites del Plan Gratuito'}
        </h3>
        <p className="text-xs text-stone-400 mt-0.5">
          {usage.isPremium
            ? 'Disfrutan de recuerdos en Ultra HD, cápsulas y toques hápticos sin restricciones.'
            : 'Disfruta las funciones básicas o pásate a Premium para recuerdos y fotos ilimitadas.'}
        </p>

        {!usage.isPremium && (
          <>
            <div className="mt-3.5 space-y-2.5 text-xs">
              <div>
                <div className="flex justify-between text-[11px] text-stone-600 dark:text-stone-400 mb-1">
                  <span>Recuerdos compartidos</span>
                  <span className={`font-bold ${!usage.canAddMemory ? 'text-rose-600' : ''}`}>
                    {usage.memoriesUsed} de {usage.memoriesMax} usados
                  </span>
                </div>
                <div className="w-full h-1.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full transition-all duration-300"
                    style={{ width: `${memoriesPct}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-stone-600 dark:text-stone-400 mb-1">
                  <span>Rincones guardados</span>
                  <span className={`font-bold ${!usage.canAddPlace ? 'text-rose-600' : ''}`}>
                    {usage.placesUsed} de {usage.placesMax} usados
                  </span>
                </div>
                <div className="w-full h-1.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-300"
                    style={{ width: `${placesPct}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-stone-600 dark:text-stone-400 mb-1">
                  <span>Cápsulas del tiempo</span>
                  <span className={`font-bold ${!usage.canAddCapsule ? 'text-rose-600' : ''}`}>
                    {usage.capsulesUsed} de {usage.capsulesMax}{' '}
                    {!usage.canAddCapsule ? '(Límite)' : 'usadas'}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all duration-300"
                    style={{ width: `${capsulesPct}%` }}
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenPaywall}
              className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 text-white text-xs font-bold shadow-sm shadow-rose-500/20 active:scale-[0.98] transition-transform flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Desbloquear Premium Ilimitado ($2.49/mes)</span>
            </button>
          </>
        )}
      </div>

      {/* Couple Space & Pairing Code */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#181A20] border border-stone-200/70 dark:border-stone-800 shadow-xs">
        <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
          Espacio de Pareja
        </span>
        <div className="flex items-center justify-between mt-1.5">
          <div>
            <span className="font-mono text-base font-bold text-stone-900 dark:text-stone-100">
              {session.coupleId}
            </span>
            <span
              className={`text-[11px] font-medium block ${
                session.isPaired ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'
              }`}
            >
              &bull;{' '}
              {session.isPaired
                ? `Vinculado con ${session.pairedPartnerName || settings.partner2.name}`
                : `Tu código personal (${session.myCode})`}
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenPairManage}
            className="px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-200 active:scale-95 transition-all"
          >
            Cambiar
          </button>
        </div>
      </div>

      {/* Identity Switcher */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#181A20] border border-stone-200/70 dark:border-stone-800 shadow-xs">
        <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
          <UserCheck className="w-3.5 h-3.5 text-rose-500" />
          ¿Quién usa este teléfono?
        </span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onSwitchUserRole('Gigio')}
            className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
              settings.currentUser === 'Gigio'
                ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 border-transparent'
                : 'bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700'
            }`}
          >
            {settings.partner1.name} ({settings.partner1.nickname})
          </button>
          <button
            type="button"
            onClick={() => onSwitchUserRole('Rosita')}
            className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
              settings.currentUser === 'Rosita'
                ? 'bg-rose-500 text-white border-transparent'
                : 'bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700'
            }`}
          >
            {settings.partner2.name} ({settings.partner2.nickname})
          </button>
        </div>
      </div>

      {/* Preferences & Toggles */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#181A20] border border-stone-200/70 dark:border-stone-800 shadow-xs space-y-3 text-xs text-stone-700 dark:text-stone-300">
        <label className="flex items-center justify-between cursor-pointer">
          <span>Notificaciones de besos y toques</span>
          <input
            type="checkbox"
            checked={notifications.kissesAndTouches}
            onChange={(e) =>
              onUpdateNotifications({ ...notifications, kissesAndTouches: e.target.checked })
            }
            className="accent-rose-500 w-4 h-4 rounded"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <span>Vibración háptica</span>
          <input
            type="checkbox"
            checked={notifications.hapticsEnabled}
            onChange={(e) =>
              onUpdateNotifications({ ...notifications, hapticsEnabled: e.target.checked })
            }
            className="accent-rose-500 w-4 h-4 rounded"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <span>Recordatorio diario de pensamiento</span>
          <input
            type="checkbox"
            checked={notifications.dailyThoughtReminder}
            onChange={(e) =>
              onUpdateNotifications({ ...notifications, dailyThoughtReminder: e.target.checked })
            }
            className="accent-rose-500 w-4 h-4 rounded"
          />
        </label>

        <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
          <span>Tema visual</span>
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 font-semibold flex items-center gap-1.5"
          >
            {settings.darkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{settings.darkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>
          </button>
        </div>
      </div>

      {/* Logout Button */}
      <button
        type="button"
        onClick={onLogout}
        className="w-full py-3.5 rounded-2xl bg-stone-100 dark:bg-stone-800/80 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
      >
        <LogOut className="w-4 h-4" />
        <span>Cerrar Sesión</span>
      </button>
    </div>
  );
};
