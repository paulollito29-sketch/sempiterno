import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  ReturnVerdict,
  KissesData
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
import { Heart, X } from 'lucide-react';
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
  sendKissToSupabase,
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

  // Realtime Bedtime Kisses
  const [kissesData, setKissesData] = useState<KissesData | undefined>(undefined);
  const [incomingKissAlert, setIncomingKissAlert] = useState<{ senderName: string; time: string } | null>(null);
  const [completedPlanUndo, setCompletedPlanUndo] = useState<{ plan: Plan; prevStatus: PlanStatus } | null>(null);

  // Auto-dismiss undo banner
  useEffect(() => {
    if (!completedPlanUndo) return;
    const timer = setTimeout(() => {
      setCompletedPlanUndo(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [completedPlanUndo]);

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
          if (cloudData.kisses) {
            setKissesData((prev) => {
              // If new kisses received from the other partner, alert the user!
              if (
                prev &&
                cloudData.kisses &&
                cloudData.kisses.totalKisses > prev.totalKisses &&
                cloudData.kisses.lastSender !== settings.currentUser
              ) {
                const senderNick =
                  cloudData.kisses.lastSender === 'Gigio'
                    ? settings.partner1?.nickname || 'Gigio'
                    : settings.partner2?.nickname || 'Rosita';
                setIncomingKissAlert({
                  senderName: senderNick,
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                });
                fireHeartConfetti();
              }
              return cloudData.kisses;
            });
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
  }, [settings.supabaseUrl, settings.supabaseAnonKey, settings.currentUser]);

  // Send bedtime kiss in real time
  const handleSendKiss = async () => {
    const isGigio = settings.currentUser === 'Gigio';
    const senderRole = isGigio ? 'Gigio' : 'Rosita';
    const senderName = isGigio ? (settings.partner1.name || 'Paulo') : (settings.partner2.name || 'Alexandra');
    const updated = await sendKissToSupabase(
      senderRole,
      senderName,
      settings.supabaseUrl,
      settings.supabaseAnonKey
    );
    if (updated) {
      setKissesData(updated);
    }
  };

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

    const previousStatus = plan.status;
    setPrefillPlanForMemory({
      title: plan.title,
      category: memCat,
      location: plan.location,
    });
    setMemoryToEdit(null);
    setIsMemoryModalOpen(true);

    // Mark plan as lived
    handleUpdatePlanStatus(plan.id, '¡Vivido!');
    fireHeartConfetti();

    // Enable undo safety
    setCompletedPlanUndo({ plan, prevStatus: previousStatus });
  };

  const handleUndoCompletePlan = () => {
    if (!completedPlanUndo) return;
    handleUpdatePlanStatus(completedPlanUndo.plan.id, completedPlanUndo.prevStatus);
    setIsMemoryModalOpen(false);
    setPrefillPlanForMemory(null);
    setCompletedPlanUndo(null);
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

      {/* Main Content Area with Page Transition Animation */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 pt-4 sm:pt-6 pb-12 sm:pb-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTab}
            initial={{ opacity: 0, y: 15, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.99 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
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
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Realtime Incoming Kiss Alert */}
      <AnimatePresence>
        {incomingKissAlert && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.95 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[92%] bg-butter border-3 border-carbon rounded-2xl p-3.5 shadow-neo-lg flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5">
              <motion.span
                animate={{ scale: [1, 1.25, 1], y: [0, -3, 0] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                className="text-2xl inline-block"
              >
                💋
              </motion.span>
              <div>
                <p className="font-display font-black text-xs text-carbon">
                  ¡{incomingKissAlert.senderName} te mandó un besito! ❤️
                </p>
                <p className="text-[10px] text-carbon/70 font-semibold">
                  "¡A la camita... que descanses bien!" 💤
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsBedtimeModalOpen(true);
                  setIncomingKissAlert(null);
                }}
                className="neo-btn-primary text-[10px] py-1 px-2.5 font-bold"
              >
                Ver 🐭
              </button>
              <button
                type="button"
                onClick={() => setIncomingKissAlert(null)}
                className="p-1 rounded-lg border border-carbon hover:bg-carbon/10 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-carbon" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Undo Banner for Completed Plan */}
      <AnimatePresence>
        {completedPlanUndo && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] bg-butter border-3 border-carbon rounded-2xl p-3.5 shadow-neo-lg flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">🎉</span>
              <p className="font-display font-bold text-xs text-carbon leading-tight">
                Cita <strong>"{completedPlanUndo.plan.title}"</strong> marcada como vivida.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleUndoCompletePlan}
                className="neo-btn-primary text-xs py-1 px-3 font-bold"
              >
                Deshacer
              </button>
              <button
                type="button"
                onClick={() => setCompletedPlanUndo(null)}
                className="p-1 rounded-lg border border-carbon hover:bg-carbon/10 transition-colors"
                title="Cerrar"
                aria-label="Cerrar notificación"
              >
                <X className="w-3.5 h-3.5 text-carbon" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer - With ample pb-28 for mobile floating navbar */}
      <footer className="border-t-2 border-carbon bg-white dark:bg-nightCard pt-6 pb-28 sm:pb-8 px-4 text-center text-xs font-semibold text-carbon/70 dark:text-cream/70">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3.5">
          <div className="flex items-center gap-2">
            <span className="font-display font-black text-carbon dark:text-cream text-sm">
              Sempiterno
            </span>
            <span>•</span>
            <span>Para toda la vida</span>
          </div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="inline-flex items-center gap-1.5 text-xs bg-rosePastel-light/70 dark:bg-nightSurface border-2 border-carbon px-3 py-1.5 rounded-2xl shadow-neo-sm"
          >
            <span>Hecho con</span>
            <Heart className="w-3.5 h-3.5 text-coral fill-coral inline animate-pulse" />
            <span className="font-bold text-coral">solo para {settings.partner2?.name || 'Alexandra'} 🎀❤️</span>
          </motion.div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsBedtimeModalOpen(true)}
              className="text-[11px] font-bold text-coral hover:underline"
            >
              "¡A la camita... a la camita!" 🐭💤
            </button>
            <button
              type="button"
              onClick={() => setIsSettingsModalOpen(true)}
              className="text-[11px] font-bold text-carbon/70 dark:text-cream/70 hover:underline flex items-center gap-1"
            >
              ⚙️ Ajustes
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
            >
              🔄 Recargar
            </button>
          </div>
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
        settings={settings}
        kissesData={kissesData}
        onSendKiss={handleSendKiss}
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
