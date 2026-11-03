import React from 'react';
import { motion } from 'framer-motion';
import { 
  Heart, 
  Clock, 
  Compass, 
  MapPin, 
  Sparkles, 
  Mail,
  CalendarDays
} from 'lucide-react';

export type NavTab = 'presente' | 'archivo' | 'planes' | 'rincones' | 'ruleta' | 'capsulas';

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  unlockedCapsulesCount?: number;
  upcomingPlansCount?: number;
  onOpenSettings?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  unlockedCapsulesCount = 0,
  upcomingPlansCount = 0,
}) => {
  const tabs: { id: NavTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'presente',
      label: 'Presente',
      icon: <Heart className="w-4 h-4 sm:w-5 sm:h-5" />,
    },
    {
      id: 'archivo',
      label: 'Bitácora',
      icon: <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5" />,
    },
    {
      id: 'planes',
      label: 'Por Vivir',
      icon: <Compass className="w-4 h-4 sm:w-5 sm:h-5" />,
      badge: upcomingPlansCount,
    },
    {
      id: 'rincones',
      label: 'Rincones',
      icon: <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />,
    },
    {
      id: 'ruleta',
      label: 'Ruleta',
      icon: <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />,
    },
    {
      id: 'capsulas',
      label: 'Cápsulas',
      icon: <Mail className="w-4 h-4 sm:w-5 sm:h-5" />,
      badge: unlockedCapsulesCount,
    },
  ];

  return (
    <>
      {/* Desktop Sub-Header Navigation Bar */}
      <nav className="hidden md:block bg-white dark:bg-nightCard border-b-2 border-carbon px-6 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.94 }}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 transition-colors ${
                  isActive
                    ? 'bg-coral text-white border-carbon shadow-neo'
                    : 'bg-transparent text-carbon dark:text-cream border-transparent hover:border-carbon/30 hover:bg-cream dark:hover:bg-nightSurface'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.badge && tab.badge > 0 ? (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`ml-1 text-[10px] font-black px-1.5 py-0.5 rounded-full border border-carbon ${
                      isActive ? 'bg-butter text-carbon' : 'bg-coral text-white'
                    }`}
                  >
                    {tab.badge}
                  </motion.span>
                ) : null}
              </motion.button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Floating Bottom Bar */}
      <div className="fixed bottom-3 left-0 right-0 z-40 px-2 sm:px-3 md:hidden pointer-events-none">
        <nav className="max-w-md mx-auto pointer-events-auto bg-white/95 dark:bg-nightCard/95 backdrop-blur-md border-3 border-carbon rounded-2xl p-1 shadow-neo-lg flex items-center justify-around">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                whileTap={{ scale: 0.88 }}
                className={`relative flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-colors ${
                  isActive
                    ? 'bg-coral text-white border-2 border-carbon shadow-neo-sm font-bold'
                    : 'text-carbon/80 dark:text-cream/80 hover:bg-cream dark:hover:bg-nightSurface border-2 border-transparent font-medium'
                }`}
              >
                <div className="relative">
                  {tab.icon}
                  {tab.badge && tab.badge > 0 ? (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1.5 -right-2 bg-butter text-carbon font-black text-[9px] w-4 h-4 rounded-full border border-carbon flex items-center justify-center shadow-xs"
                    >
                      {tab.badge}
                    </motion.span>
                  ) : null}
                </div>
                <span className="text-[9px] sm:text-[10px] mt-0.5 tracking-tight truncate max-w-full">
                  {tab.label}
                </span>
              </motion.button>
            );
          })}
        </nav>
      </div>
    </>
  );
};
