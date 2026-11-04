import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Moon, Sun, Settings as SettingsIcon, RotateCw, Sparkles } from 'lucide-react';
import { CoupleSettings } from '../types';
import { MouseEarsIcon } from './TopoEarsIcon';
import { isBedtime } from '../utils/date';

interface HeaderProps {
  settings: CoupleSettings;
  onUpdateSettings: (newSettings: CoupleSettings) => void;
  onOpenSettings: () => void;
  onOpenBedtime: () => void;
  onReload?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  onUpdateSettings,
  onOpenSettings,
  onOpenBedtime,
  onReload,
}) => {
  const [isReloading, setIsReloading] = useState(false);
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

  const handleReloadClick = () => {
    if (isReloading) return;
    setIsReloading(true);
    if (onReload) {
      onReload();
      setTimeout(() => setIsReloading(false), 600);
    } else {
      setTimeout(() => {
        window.location.reload();
      }, 250);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-cream/95 dark:bg-night/95 backdrop-blur-md border-b-2 border-carbon px-2 sm:px-6 py-2 sm:py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-1 sm:gap-3">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <motion.div
            className="relative group cursor-pointer shrink-0"
            onClick={onOpenBedtime}
            whileHover={{ scale: 1.08, rotate: -3 }}
            whileTap={{ scale: 0.94 }}
            animate={{ y: [0, -2, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
          >
            <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl border-2 border-carbon overflow-hidden bg-rosePastel shadow-neo-sm">
              <img
                src="/assets/gigio-rosita.jpg"
                alt="Sempiterno Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-coral border border-carbon flex items-center justify-center text-[7px] sm:text-[9px] text-white font-bold">
              ♥
            </div>
          </motion.div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="font-display text-base sm:text-2xl font-black tracking-tight text-carbon dark:text-cream truncate">
                Sempiterno
              </h1>
              {settings.supabaseUrl && settings.supabaseAnonKey ? (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="hidden md:inline-flex items-center gap-1 text-[10px] font-bold bg-sage/60 border border-carbon px-2 py-0.5 rounded-full shadow-neo-sm text-carbon hover:bg-sage transition-colors"
                  title="Sincronización en tiempo real activa con Supabase"
                >
                  <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse"></span>
                  <span>En Vivo ⚡</span>
                </button>
              ) : null}
            </div>
            <p className="hidden xs:block text-[9px] sm:text-xs text-carbon/70 dark:text-cream/70 font-semibold truncate">
              {settings.partner1?.nickname || 'Gigio'} & {settings.partner2?.nickname || 'Rosita'} • Nuestro Archivo
            </p>
          </div>
        </div>

        {/* Action Controls - Always fit and visible on mobile & desktop */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Bedtime Easter Egg button */}
          <motion.button
            type="button"
            onClick={onOpenBedtime}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            animate={isNightTime ? { y: [0, -3, 0] } : undefined}
            transition={isNightTime ? { repeat: Infinity, duration: 2.2, ease: "easeInOut" } : undefined}
            title={isNightTime ? "¡A la camita! (Modo noche activo)" : "Easter egg de buenas noches"}
            className={`p-1.5 sm:p-2 border-2 border-carbon rounded-xl shadow-neo-sm transition-colors ${
              isNightTime
                ? 'bg-butter text-carbon'
                : 'bg-white dark:bg-nightCard text-carbon dark:text-cream hover:bg-cream'
            }`}
          >
            <span className="text-xs sm:text-base">🌙</span>
            <span className="hidden lg:inline-block ml-1 text-xs font-bold">
              {isNightTime ? '¡A la camita!' : 'Camita'}
            </span>
          </motion.button>

          {/* User Profile Switcher */}
          <motion.button
            type="button"
            onClick={toggleUser}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            className={`flex items-center gap-1 px-1.5 py-1 sm:px-2.5 sm:py-1.5 border-2 border-carbon rounded-xl shadow-neo-sm text-xs font-bold transition-colors ${
              settings.currentUser === 'Gigio'
                ? 'bg-rosePastel-light text-carbon hover:bg-rosePastel'
                : 'bg-lavender text-carbon hover:bg-lavender/80'
            }`}
            title="Cambiar quién está navegando (Gigio o Rosita)"
          >
            <MouseEarsIcon
              type={settings.currentUser === 'Gigio' ? 'gigio' : 'rosita'}
              size={15}
            />
            <span className="text-[10px] sm:text-xs font-bold">
              {settings.currentUser === 'Gigio'
                ? (settings.partner1?.nickname || 'Gigio')
                : (settings.partner2?.nickname || 'Rosita')}
            </span>
            <span className="text-[8px] sm:text-[9px] bg-white/80 dark:bg-night/80 px-1 rounded border border-carbon">
              ⇄
            </span>
          </motion.button>

          {/* Recargar App Button (especial para PWA instalada) */}
          <motion.button
            type="button"
            onClick={handleReloadClick}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.88 }}
            title="Recargar la aplicación y sincronizar datos"
            className="p-1.5 sm:p-2 bg-skyNeo/30 hover:bg-skyNeo/50 text-carbon dark:text-cream border-2 border-carbon rounded-xl shadow-neo-sm flex items-center justify-center shrink-0"
          >
            <RotateCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-carbon dark:text-cream ${isReloading ? 'animate-spin' : ''}`} />
          </motion.button>

          {/* Dark Mode Switcher */}
          <motion.button
            type="button"
            onClick={toggleDarkMode}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            title={settings.darkMode ? "Cambiar a modo crema claro" : "Cambiar a modo noche oscuro"}
            className="p-1.5 sm:p-2 bg-white dark:bg-nightCard text-carbon dark:text-cream border-2 border-carbon rounded-xl shadow-neo-sm hover:bg-cream shrink-0"
          >
            {settings.darkMode ? (
              <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-butter" />
            ) : (
              <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-carbon" />
            )}
          </motion.button>

          {/* Settings / Tuerca Button - ALWAYS PROMINENT ON MOBILE & DESKTOP */}
          <motion.button
            type="button"
            onClick={onOpenSettings}
            whileHover={{ scale: 1.1, rotate: 45 }}
            whileTap={{ scale: 0.9 }}
            title="Ajustes de pareja (apodos, fecha y sincronización)"
            className="p-1.5 sm:p-2 bg-butter hover:bg-butter-light text-carbon border-2 border-carbon rounded-xl shadow-neo-sm flex items-center justify-center shrink-0"
          >
            <SettingsIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-carbon" />
          </motion.button>
        </div>
      </div>
    </header>
  );
};
