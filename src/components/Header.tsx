import React from 'react';
import { Moon, Sun, Settings as SettingsIcon, Heart, Sparkles } from 'lucide-react';
import { CoupleSettings } from '../types';
import { MouseEarsIcon } from './TopoEarsIcon';
import { isBedtime } from '../utils/date';

interface HeaderProps {
  settings: CoupleSettings;
  onUpdateSettings: (newSettings: CoupleSettings) => void;
  onOpenSettings: () => void;
  onOpenBedtime: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  onUpdateSettings,
  onOpenSettings,
  onOpenBedtime,
}) => {
  const isNightTime = isBedtime();

  const toggleUser = () => {
    const nextUser = settings.currentUser === 'Gigio' ? 'Rosita' : 'Gigio';
    onUpdateSettings({
      ...settings,
      currentUser: nextUser,
    });
  };

  const toggleRatingStyle = () => {
    const nextStyle = settings.ratingStyle === 'cheese' ? 'heart' : 'cheese';
    onUpdateSettings({
      ...settings,
      ratingStyle: nextStyle,
    });
  };

  const toggleDarkMode = () => {
    const nextDark = !settings.darkMode;
    onUpdateSettings({
      ...settings,
      darkMode: nextDark,
    });
    if (nextDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-cream/95 dark:bg-night/95 backdrop-blur-md border-b-2 border-carbon px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="relative group cursor-pointer" onClick={onOpenBedtime}>
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl border-2 border-carbon overflow-hidden bg-rosePastel shadow-neo-sm transform transition group-hover:-rotate-3 group-hover:scale-105">
              <img
                src="/assets/gigio-rosita.jpg"
                alt="Sempiterno Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-coral border border-carbon flex items-center justify-center text-[9px] text-white">
              ♥
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl sm:text-2xl font-black tracking-tight text-carbon dark:text-cream">
                Sempiterno
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold bg-butter border border-carbon px-2 py-0.5 rounded-full shadow-neo-sm">
                <Sparkles className="w-2.5 h-2.5 text-coral" /> Amor Infinito
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-carbon/70 dark:text-cream/70 font-semibold truncate">
              {settings.partner1?.nickname || 'Gigio'} & {settings.partner2?.nickname || 'Rosita'} • Nuestro Archivo
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Bedtime Easter Egg button */}
          <button
            type="button"
            onClick={onOpenBedtime}
            title={isNightTime ? "¡A la camita! (Modo noche activo)" : "Easter egg de buenas noches"}
            className={`p-2 border-2 border-carbon rounded-xl shadow-neo-sm transition-transform active:translate-x-[1px] active:translate-y-[1px] ${
              isNightTime
                ? 'bg-butter text-carbon animate-bounce'
                : 'bg-white dark:bg-nightCard text-carbon dark:text-cream hover:bg-cream'
            }`}
          >
            <span className="text-base sm:text-lg">🌙</span>
            <span className="hidden lg:inline-block ml-1.5 text-xs font-bold">
              {isNightTime ? '¡A la camita!' : 'Camita'}
            </span>
          </button>

          {/* User Profile Switcher */}
          <button
            type="button"
            onClick={toggleUser}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 border-2 border-carbon rounded-xl shadow-neo-sm text-xs font-bold transition-all active:translate-x-[1px] active:translate-y-[1px] ${
              settings.currentUser === 'Gigio'
                ? 'bg-rosePastel-light text-carbon hover:bg-rosePastel'
                : 'bg-lavender text-carbon hover:bg-lavender/80'
            }`}
            title="Cambiar quién está navegando (Gigio o Rosita)"
          >
            <MouseEarsIcon
              type={settings.currentUser === 'Gigio' ? 'gigio' : 'rosita'}
              size={18}
            />
            <span className="hidden sm:inline">
              {settings.currentUser === 'Gigio'
                ? `${settings.partner1?.nickname || 'Gigio'} (${settings.partner1?.name || 'Paulo'})`
                : `${settings.partner2?.nickname || 'Rosita'} (${settings.partner2?.name || 'Alexandra'})`}
            </span>
            <span className="text-[10px] bg-white/70 px-1 py-0.2 rounded border border-carbon">
              ⇄
            </span>
          </button>

          {/* Rating Style Switcher (Cheese vs Heart) */}
          <button
            type="button"
            onClick={toggleRatingStyle}
            title={`Modo de notas: ${settings.ratingStyle === 'cheese' ? 'Quesitos 🧀' : 'Corazones ❤️'}`}
            className="p-2 bg-white dark:bg-nightCard border-2 border-carbon rounded-xl shadow-neo-sm hover:bg-cream text-base active:translate-x-[1px] active:translate-y-[1px]"
          >
            {settings.ratingStyle === 'cheese' ? '🧀' : '❤️'}
          </button>

          {/* Dark Mode Switcher */}
          <button
            type="button"
            onClick={toggleDarkMode}
            title={settings.darkMode ? "Cambiar a modo crema claro" : "Cambiar a modo noche oscuro"}
            className="p-2 bg-white dark:bg-nightCard text-carbon dark:text-cream border-2 border-carbon rounded-xl shadow-neo-sm hover:bg-cream active:translate-x-[1px] active:translate-y-[1px]"
          >
            {settings.darkMode ? (
              <Sun className="w-4 h-4 text-butter" />
            ) : (
              <Moon className="w-4 h-4 text-carbon" />
            )}
          </button>

          {/* Settings / Backup Button */}
          <button
            type="button"
            onClick={onOpenSettings}
            title="Configuración y respaldos"
            className="p-2 bg-white dark:bg-nightCard text-carbon dark:text-cream border-2 border-carbon rounded-xl shadow-neo-sm hover:bg-cream active:translate-x-[1px] active:translate-y-[1px]"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
