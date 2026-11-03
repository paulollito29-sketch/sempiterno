import React from 'react';
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
      icon: <Heart className="w-5 h-5" />,
    },
    {
      id: 'archivo',
      label: 'Bitácora',
      icon: <CalendarDays className="w-5 h-5" />,
    },
    {
      id: 'planes',
      label: 'Por Vivir',
      icon: <Compass className="w-5 h-5" />,
      badge: upcomingPlansCount,
    },
    {
      id: 'rincones',
      label: 'Rincones',
      icon: <MapPin className="w-5 h-5" />,
    },
    {
      id: 'ruleta',
      label: 'Ruleta',
      icon: <Sparkles className="w-5 h-5" />,
    },
    {
      id: 'capsulas',
      label: 'Cápsulas',
      icon: <Mail className="w-5 h-5" />,
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
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                  isActive
                    ? 'bg-coral text-white border-carbon shadow-neo -translate-y-0.5'
                    : 'bg-transparent text-carbon dark:text-cream border-transparent hover:border-carbon/30 hover:bg-cream dark:hover:bg-nightSurface'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.badge && tab.badge > 0 ? (
                  <span
                    className={`ml-1 text-[10px] font-black px-1.5 py-0.5 rounded-full border border-carbon ${
                      isActive ? 'bg-butter text-carbon' : 'bg-coral text-white'
                    }`}
                  >
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Floating Bottom Bar */}
      <div className="fixed bottom-3 left-0 right-0 z-40 px-3 md:hidden pointer-events-none">
        <nav className="max-w-md mx-auto pointer-events-auto bg-white/95 dark:bg-nightCard/95 backdrop-blur-md border-3 border-carbon rounded-2xl p-1.5 shadow-neo-lg flex items-center justify-around">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-150 ${
                  isActive
                    ? 'bg-coral text-white border-2 border-carbon shadow-neo-sm font-bold scale-105'
                    : 'text-carbon/80 dark:text-cream/80 hover:bg-cream dark:hover:bg-nightSurface border-2 border-transparent font-medium'
                }`}
              >
                <div className="relative">
                  {tab.icon}
                  {tab.badge && tab.badge > 0 ? (
                    <span className="absolute -top-1.5 -right-2 bg-butter text-carbon font-black text-[9px] w-4 h-4 rounded-full border border-carbon flex items-center justify-center shadow-xs">
                      {tab.badge}
                    </span>
                  ) : null}
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
};
