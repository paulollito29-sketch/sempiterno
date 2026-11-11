import React from 'react';
import { Clock, Heart, Image as ImageIcon, MapPin, Settings } from 'lucide-react';
import { triggerHapticImpact } from '../utils/native';

export type MobileTab = 'inicio' | 'recuerdos' | 'rincones' | 'capsulas' | 'ajustes' | 'planes' | 'ruleta';

interface BottomNavProps {
  currentTab: MobileTab;
  onChangeTab: (tab: MobileTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onChangeTab }) => {
  const navItems: Array<{ id: MobileTab; label: string; icon: React.ReactNode }> = [
    {
      id: 'inicio',
      label: 'Inicio',
      icon: <Heart className="w-5 h-5" fill={currentTab === 'inicio' ? 'currentColor' : 'none'} />,
    },
    {
      id: 'recuerdos',
      label: 'Recuerdos',
      icon: <ImageIcon className="w-5 h-5" />,
    },
    {
      id: 'rincones',
      label: 'Rincones',
      icon: <MapPin className="w-5 h-5" />,
    },
    {
      id: 'capsulas',
      label: 'Cápsulas',
      icon: <Clock className="w-5 h-5" />,
    },
    {
      id: 'ajustes',
      label: 'Ajustes',
      icon: <Settings className="w-5 h-5" />,
    },
  ];

  const handleSelect = async (id: MobileTab) => {
    if (id !== currentTab) {
      await triggerHapticImpact('light');
      onChangeTab(id);
    }
  };

  return (
    <div className="fixed bottom-4 inset-x-0 z-40 px-4 pointer-events-none">
      <nav className="max-w-md mx-auto bg-white/90 dark:bg-[#181A20]/90 backdrop-blur-xl border border-stone-200/75 dark:border-stone-800 shadow-lg shadow-stone-900/10 rounded-full px-3 py-2 flex items-center justify-around pointer-events-auto">
        {navItems.map((item) => {
          const isActive =
            currentTab === item.id ||
            (item.id === 'inicio' && (currentTab === 'planes' || currentTab === 'ruleta'));
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={`flex flex-col items-center gap-1 py-1 px-3 transition-colors active:scale-95 ${
                isActive
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'
              }`}
            >
              {item.icon}
              <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
