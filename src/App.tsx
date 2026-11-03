import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Navbar, NavTab } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { MemoriesView } from './components/MemoriesView';
import { PlansView } from './components/PlansView';
import { PlacesView } from './components/PlacesView';
import { RouletteView } from './components/RouletteView';
import { TimeCapsulesView } from './components/TimeCapsulesView';
import { MemoryModal } from './components/MemoryModal';
import { PlanModal } from './components/PlanModal';
import { PlaceModal } from './components/PlaceModal';
import { TimeCapsuleModal } from './components/TimeCapsuleModal';
import { BedtimeModal } from './components/BedtimeModal';
import { SettingsModal } from './components/SettingsModal';
import { 
  CoupleSettings, 
  Memory, 
  Plan, 
  Place, 
  TimeCapsule, 
  PlanStatus,
  MemoryCategory,
  ReturnVerdict
} from './types';
import {
  loadSettings,
  saveSettings,
  loadMemories,
  saveMemories,
  loadPlans,
  savePlans,
  loadPlaces,
  savePlaces,
  loadTimeCapsules,
  saveTimeCapsules,
  resetAllDataToDefault,
} from './utils/storage';
import { isBedtime, calculateCountdown } from './utils/date';
import { fireHeartConfetti, fireSuperCelebration } from './utils/confetti';
import { Heart } from 'lucide-react';
import {
  fetchAllFromSupabase,
  syncMemoryToSupabase,
  deleteMemoryFromSupabase,
  syncPlanToSupabase,
  deletePlanFromSupabase,
  syncPlaceToSupabase,
  deletePlaceFromSupabase,
  syncCapsuleToSupabase,
  deleteCapsuleFromSupabase,
  syncSettingsToSupabase,
  subscribeToSupabase,
} from './utils/supabase';

export function App() {
  // Settings & Theme
  const [settings, setSettings] = useState<CoupleSettings>(() => loadSettings());
  
  // Data State
  const [memories, setMemories] = useState<Memory[]>(() => loadMemories());
  const [plans, setPlans] = useState<Plan[]>(() => loadPlans());
  const [places, setPlaces] = useState<Place[]>(() => loadPlaces());
  const [capsules, setCapsules] = useState<TimeCapsule[]>(() => loadTimeCapsules());

  // Navigation
  const [currentTab, setCurrentTab] = useState<NavTab>('presente');
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);

  // Modals
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [memoryToEdit, setMemoryToEdit] = useState<Memory | null>(null);
  const [prefillPlanForMemory, setPrefillPlanForMemory] = useState<{
    title: string;
    category: MemoryCategory;
    location?: string;
  } | null>(null);

  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [planToEdit, setPlanToEdit] = useState<Plan | null>(null);

  const [isPlaceModalOpen, setIsPlaceModalOpen] = useState(false);
  const [placeToEdit, setPlaceToEdit] = useState<Place | null>(null);

  const [isCapsuleModalOpen, setIsCapsuleModalOpen] = useState(false);
  const [isBedtimeModalOpen, setIsBedtimeModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Sync dark mode class
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.darkMode]);

  // 1. Supabase Realtime & Cloud Data Fetch
  useEffect(() => {
    let isMounted = true;

    async function loadSupabase() {
      if (!settings.supabaseUrl && !(import.meta as any).env?.VITE_SUPABASE_URL) return;

      try {
        const cloudData = await fetchAllFromSupabase(settings.supabaseUrl, settings.supabaseAnonKey);
        if (cloudData && isMounted) {
          if (cloudData.settings) {
            setSettings((prev) => {
              const merged = {
                ...prev,
                ...cloudData.settings,
                currentUser: prev.currentUser || 'Gigio',
              };
              saveSettings(merged);
              return merged;
            });
          }
          if (cloudData.memories) {
            setMemories(cloudData.memories);
            saveMemories(cloudData.memories);
          }
          if (cloudData.plans) {
            setPlans(cloudData.plans);
            savePlans(cloudData.plans);
          }
          if (cloudData.places) {
            setPlaces(cloudData.places);
            savePlaces(cloudData.places);
          }
          if (cloudData.capsules) {
            setCapsules(cloudData.capsules);
            saveTimeCapsules(cloudData.capsules);
          }
        }
      } catch (err) {
        console.warn('Error cargando datos de Supabase:', err);
      }
    }

    loadSupabase();

    const unsubscribe = subscribeToSupabase(() => {
      console.log('⚡ Sincronización en vivo recibida desde Supabase');
      loadSupabase();
    }, settings.supabaseUrl, settings.supabaseAnonKey);

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [settings.supabaseUrl, settings.supabaseAnonKey]);

  // Save changes to storage & sync live to Supabase for both Paulo and Alexandra
  const handleUpdateSettings = (newSettings: CoupleSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    syncSettingsToSupabase(newSettings, newSettings.supabaseUrl, newSettings.supabaseAnonKey);
  };

  const handleReloadAll = () => {
    setSettings(loadSettings());
    setMemories(loadMemories());
    setPlans(loadPlans());
    setPlaces(loadPlaces());
    setCapsules(loadTimeCapsules());
  };

  const handleResetData = () => {
    resetAllDataToDefault();
    handleReloadAll();
    fireSuperCelebration();
  };

  // --- MEMORY HANDLERS ---
  const handleSaveMemory = (newMemory: Memory) => {
    const exists = memories.some((m) => m.id === newMemory.id);
    let updated: Memory[];
    if (exists) {
      updated = memories.map((m) => (m.id === newMemory.id ? newMemory : m));
    } else {
      updated = [newMemory, ...memories];
    }
    setMemories(updated);
    saveMemories(updated);
    syncMemoryToSupabase(newMemory, settings.supabaseUrl, settings.supabaseAnonKey);
  };

  const handleDeleteMemory = (memoryId: string) => {
    const updated = memories.filter((m) => m.id !== memoryId);
    setMemories(updated);
    saveMemories(updated);
    deleteMemoryFromSupabase(memoryId, settings.supabaseUrl, settings.supabaseAnonKey);
  };

  // --- PLAN HANDLERS ---
  const handleSavePlan = (newPlan: Plan) => {
    const exists = plans.some((p) => p.id === newPlan.id);
    let updated: Plan[];
    if (exists) {
      updated = plans.map((p) => (p.id === newPlan.id ? newPlan : p));
    } else {
      updated = [newPlan, ...plans];
    }
    setPlans(updated);
    savePlans(updated);
    syncPlanToSupabase(newPlan, settings.supabaseUrl, settings.supabaseAnonKey);
  };

  const handleDeletePlan = (planId: string) => {
    const updated = plans.filter((p) => p.id !== planId);
    setPlans(updated);
    savePlans(updated);
    deletePlanFromSupabase(planId, settings.supabaseUrl, settings.supabaseAnonKey);
  };

  const handleUpdatePlanStatus = (planId: string, newStatus: PlanStatus) => {
    let targetPlan: Plan | undefined;
    const updated = plans.map((p) => {
      if (p.id === planId) {
        targetPlan = { ...p, status: newStatus };
        return targetPlan;
      }
      return p;
    });
    setPlans(updated);
    savePlans(updated);
    if (targetPlan) {
      syncPlanToSupabase(targetPlan, settings.supabaseUrl, settings.supabaseAnonKey);
    }
  };

  // Convert Plan to Memory
  const handleConvertPlanToMemory = (plan: Plan) => {
    // Map plan category to memory category
    let memCat: MemoryCategory = 'Cena';
    if (plan.category === 'Comida & Cafés') memCat = 'Cena';
    if (plan.category === 'Viajes') memCat = 'Viaje';
    if (plan.category === 'Planes en Casa') memCat = 'Plan Casero';
    if (plan.category === 'Aventura') memCat = 'Concierto/Salida';

    setPrefillPlanForMemory({
      title: plan.title,
      category: memCat,
      location: plan.location,
    });
    setMemoryToEdit(null);
    setIsMemoryModalOpen(true);

    // Mark plan as lived
    handleUpdatePlanStatus(plan.id, '¡Vivido!');
  };

  // --- PLACE HANDLERS ---
  const handleSavePlace = (newPlace: Place) => {
    const exists = places.some((p) => p.id === newPlace.id);
    let updated: Place[];
    if (exists) {
      updated = places.map((p) => (p.id === newPlace.id ? newPlace : p));
    } else {
      updated = [newPlace, ...places];
    }
    setPlaces(updated);
    savePlaces(updated);
    syncPlaceToSupabase(newPlace, settings.supabaseUrl, settings.supabaseAnonKey);
  };

  const handleDeletePlace = (placeId: string) => {
    const updated = places.filter((p) => p.id !== placeId);
    setPlaces(updated);
    savePlaces(updated);
    deletePlaceFromSupabase(placeId, settings.supabaseUrl, settings.supabaseAnonKey);
  };

  const handleTogglePlaceStatus = (place: Place) => {
    const newStatus: 'Visitado' | 'Por conocer' = place.status === 'Visitado' ? 'Por conocer' : 'Visitado';
    const newVerdict: ReturnVerdict = newStatus === 'Visitado' ? '¡Sí o sí!' : 'Pendiente de probar';
    let targetPlace: Place | undefined;
    const updated: Place[] = places.map((p) => {
      if (p.id === place.id) {
        targetPlace = {
          ...p,
          status: newStatus,
          wouldReturn: newVerdict,
        };
        return targetPlace;
      }
      return p;
    });
    setPlaces(updated);
    savePlaces(updated);
    if (targetPlace) {
      syncPlaceToSupabase(targetPlace, settings.supabaseUrl, settings.supabaseAnonKey);
    }
    fireHeartConfetti();
  };

  // --- CAPSULE HANDLERS ---
  const handleSaveCapsule = (newCapsule: TimeCapsule) => {
    const updated = [newCapsule, ...capsules];
    setCapsules(updated);
    saveTimeCapsules(updated);
    syncCapsuleToSupabase(newCapsule, settings.supabaseUrl, settings.supabaseAnonKey);
    fireHeartConfetti();
  };

  const handleDeleteCapsule = (capsuleId: string) => {
    const updated = capsules.filter((c) => c.id !== capsuleId);
    setCapsules(updated);
    saveTimeCapsules(updated);
    deleteCapsuleFromSupabase(capsuleId, settings.supabaseUrl, settings.supabaseAnonKey);
  };

  const handleOpenCapsuleContent = (capsuleId: string) => {
    let targetCap: TimeCapsule | undefined;
    const updated = capsules.map((c) => {
      if (c.id === capsuleId) {
        targetCap = { ...c, isCustomOpened: true };
        return targetCap;
      }
      return c;
    });
    setCapsules(updated);
    saveTimeCapsules(updated);
    if (targetCap) {
      syncCapsuleToSupabase(targetCap, settings.supabaseUrl, settings.supabaseAnonKey);
    }
  };

  // --- ROULETTE CHALLENGE ACCEPT ---
  const handleAcceptPlanChallenge = (plan: Plan) => {
    // Schedule for this weekend / upcoming date
    const today = new Date();
    today.setDate(today.getDate() + 3);
    const dateStr = today.toISOString().split('T')[0];

    const scheduledPlan: Plan = {
      ...plan,
      status: 'Agendado',
      scheduledDate: dateStr,
      scheduledTime: '20:00',
    };

    handleSavePlan(scheduledPlan);
    fireSuperCelebration();
    setCurrentTab('presente'); // Take them back to dashboard to see their countdown!
  };

  // Calculate badges
  const unlockedCapsulesCount = capsules.filter((c) => {
    const cd = calculateCountdown(c.unlockDate);
    return cd.isPast || c.isCustomOpened;
  }).length;

  const upcomingPlansCount = plans.filter((p) => p.status === 'Agendado').length;

  return (
    <div className="min-h-screen bg-cream dark:bg-night flex flex-col selection:bg-coral selection:text-white">
      {/* Header */}
      <Header
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenBedtime={() => setIsBedtimeModalOpen(true)}
      />

      {/* Navigation */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          setSelectedMemoryId(null);
        }}
        unlockedCapsulesCount={unlockedCapsulesCount}
        upcomingPlansCount={upcomingPlansCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6 pb-24">
        {currentTab === 'presente' && (
          <Dashboard
            settings={settings}
            memories={memories}
            plans={plans}
            onNavigateToMemories={(memId) => {
              if (memId) setSelectedMemoryId(memId);
              setCurrentTab('archivo');
            }}
            onNavigateToPlans={() => setCurrentTab('planes')}
            onNavigateToRoulette={() => setCurrentTab('ruleta')}
            onOpenNewMemory={() => {
              setMemoryToEdit(null);
              setPrefillPlanForMemory(null);
              setIsMemoryModalOpen(true);
            }}
            onOpenNewPlan={() => {
              setPlanToEdit(null);
              setIsPlanModalOpen(true);
            }}
            onUpdateStartDate={(newDate) => {
              handleUpdateSettings({ ...settings, startDate: newDate });
            }}
            onCompletePlan={handleConvertPlanToMemory}
          />
        )}

        {currentTab === 'archivo' && (
          <MemoriesView
            memories={memories}
            settings={settings}
            onOpenNewMemory={() => {
              setMemoryToEdit(null);
              setPrefillPlanForMemory(null);
              setIsMemoryModalOpen(true);
            }}
            onEditMemory={(mem) => {
              setMemoryToEdit(mem);
              setPrefillPlanForMemory(null);
              setIsMemoryModalOpen(true);
            }}
            onDeleteMemory={handleDeleteMemory}
            selectedMemoryId={selectedMemoryId}
          />
        )}

        {currentTab === 'planes' && (
          <PlansView
            plans={plans}
            onOpenNewPlan={() => {
              setPlanToEdit(null);
              setIsPlanModalOpen(true);
            }}
            onEditPlan={(plan) => {
              setPlanToEdit(plan);
              setIsPlanModalOpen(true);
            }}
            onDeletePlan={handleDeletePlan}
            onUpdatePlanStatus={handleUpdatePlanStatus}
            onConvertToMemory={handleConvertPlanToMemory}
          />
        )}

        {currentTab === 'rincones' && (
          <PlacesView
            places={places}
            settings={settings}
            onOpenNewPlace={() => {
              setPlaceToEdit(null);
              setIsPlaceModalOpen(true);
            }}
            onEditPlace={(place) => {
              setPlaceToEdit(place);
              setIsPlaceModalOpen(true);
            }}
            onDeletePlace={handleDeletePlace}
            onToggleStatus={handleTogglePlaceStatus}
          />
        )}

        {currentTab === 'ruleta' && (
          <RouletteView
            plans={plans}
            onAcceptPlanChallenge={handleAcceptPlanChallenge}
          />
        )}

        {currentTab === 'capsulas' && (
          <TimeCapsulesView
            capsules={capsules}
            settings={settings}
            onOpenNewCapsule={() => setIsCapsuleModalOpen(true)}
            onDeleteCapsule={handleDeleteCapsule}
            onOpenCapsuleContent={handleOpenCapsuleContent}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-carbon bg-white dark:bg-nightCard py-6 px-4 text-center text-xs font-semibold text-carbon/70 dark:text-cream/70">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-display font-black text-carbon dark:text-cream text-sm">
              Sempiterno
            </span>
            <span>•</span>
            <span>Para toda la vida</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span>Hecho con</span>
            <Heart className="w-3.5 h-3.5 text-coral fill-coral inline" />
            <span>para {settings.partner1.name} & {settings.partner2.name} 🐭❤️</span>
          </div>

          <button
            type="button"
            onClick={() => setIsBedtimeModalOpen(true)}
            className="text-[11px] font-bold text-coral hover:underline"
          >
            "¡A la camita... a la camita!" 🐭💤
          </button>
        </div>
      </footer>

      {/* Modals */}
      <MemoryModal
        isOpen={isMemoryModalOpen}
        onClose={() => {
          setIsMemoryModalOpen(false);
          setMemoryToEdit(null);
          setPrefillPlanForMemory(null);
        }}
        onSave={handleSaveMemory}
        memoryToEdit={memoryToEdit}
        settings={settings}
        prefillPlanTitle={prefillPlanForMemory?.title}
        prefillCategory={prefillPlanForMemory?.category}
        prefillLocation={prefillPlanForMemory?.location}
      />

      <PlanModal
        isOpen={isPlanModalOpen}
        onClose={() => {
          setIsPlanModalOpen(false);
          setPlanToEdit(null);
        }}
        onSave={handleSavePlan}
        planToEdit={planToEdit}
      />

      <PlaceModal
        isOpen={isPlaceModalOpen}
        onClose={() => {
          setIsPlaceModalOpen(false);
          setPlaceToEdit(null);
        }}
        onSave={handleSavePlace}
        placeToEdit={placeToEdit}
        settings={settings}
      />

      <TimeCapsuleModal
        isOpen={isCapsuleModalOpen}
        onClose={() => setIsCapsuleModalOpen(false)}
        onSave={handleSaveCapsule}
        settings={settings}
      />

      <BedtimeModal
        isOpen={isBedtimeModalOpen}
        onClose={() => setIsBedtimeModalOpen(false)}
        partner1Name={settings.partner1?.name || 'Paulo'}
        partner2Name={settings.partner2?.name || 'Alexandra'}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSaveSettings={handleUpdateSettings}
        onResetAllData={handleResetData}
        onReloadAllData={handleReloadAll}
      />
    </div>
  );
}

export default App;
