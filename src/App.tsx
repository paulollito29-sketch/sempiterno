import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { App as CapApp } from '@capacitor/app';
import { BottomNav, MobileTab } from './components/BottomNav';
import { HomeView } from './components/HomeView';
import { MemoriesView } from './components/MemoriesView';
import { PlansView } from './components/PlansView';
import { PlacesView } from './components/PlacesView';
import { RouletteView } from './components/RouletteView';
import { TimeCapsulesView } from './components/TimeCapsulesView';
import { SettingsView } from './components/SettingsView';
import { AuthScreen } from './components/AuthScreen';
import { PairingScreen } from './components/PairingScreen';
import { PaywallScreen } from './components/PaywallScreen';
import { PairManageModal } from './components/PairManageModal';
import { ThoughtModal } from './components/ThoughtModal';
import { MemoryModal } from './components/MemoryModal';
import { PlanModal } from './components/PlanModal';
import { PlaceModal } from './components/PlaceModal';
import { TimeCapsuleModal } from './components/TimeCapsuleModal';
import { BedtimeModal } from './components/BedtimeModal';
import { SettingsModal } from './components/SettingsModal';
import {
  AuthProviderType,
  CoupleSettings,
  CoupleThought,
  KissesData,
  Memory,
  MemoryCategory,
  NotificationSettings,
  Place,
  Plan,
  PlanStatus,
  ReturnVerdict,
  SubscriptionPlan,
  TimeCapsule,
  UserSession,
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
import { fireHeartConfetti, fireSuperCelebration } from './utils/confetti';
import { ArrowLeft, Heart, X } from 'lucide-react';
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
import {
  clearUserSession,
  fetchCloudThought,
  getFreemiumUsage,
  loadLatestThought,
  loadNotificationSettings,
  loadSubscriptionPlan,
  loadUserSession,
  loginWithProvider,
  pairWithPartnerCode,
  publishCoupleThought,
  saveNotificationSettings,
  saveSubscriptionPlan,
  unlinkPartnerSession,
} from './utils/coupleCloud';
import { isNativePlatform, syncNativeStatusBar, triggerHapticSuccess } from './utils/native';

type AppFlowStage = 'login' | 'pair' | 'paywall' | 'app';

export function App() {
  // User Session, Flow Stage & Freemium State
  const [userSession, setUserSession] = useState<UserSession | null>(() => loadUserSession());
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan>(() =>
    loadSubscriptionPlan()
  );
  const [flowStage, setFlowStage] = useState<AppFlowStage>(() => {
    const existingSession = loadUserSession();
    if (!existingSession) return 'login';
    return 'app';
  });
  const [notifications, setNotifications] = useState<NotificationSettings>(() =>
    loadNotificationSettings()
  );
  const [latestThought, setLatestThought] = useState<CoupleThought>(() => loadLatestThought());

  // Settings & Theme
  const [settings, setSettings] = useState<CoupleSettings>(() => loadSettings());

  // Data State
  const [memories, setMemories] = useState<Memory[]>(() => loadMemories());
  const [plans, setPlans] = useState<Plan[]>(() => loadPlans());
  const [places, setPlaces] = useState<Place[]>(() => loadPlaces());
  const [capsules, setCapsules] = useState<TimeCapsule[]>(() => loadTimeCapsules());

  // Mobile Navigation
  const [currentTab, setCurrentTab] = useState<MobileTab>('inicio');
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);

  // Modals
  const [isPairManageOpen, setIsPairManageOpen] = useState(false);
  const [isThoughtModalOpen, setIsThoughtModalOpen] = useState(false);

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

  // Realtime Bedtime Kisses & Undo Banner
  const [kissesData, setKissesData] = useState<KissesData | undefined>(undefined);
  const [incomingKissAlert, setIncomingKissAlert] = useState<{
    senderName: string;
    time: string;
  } | null>(null);
  const [completedPlanUndo, setCompletedPlanUndo] = useState<{
    plan: Plan;
    prevStatus: PlanStatus;
  } | null>(null);
  const [freemiumLimitToast, setFreemiumLimitToast] = useState<string | null>(null);

  const usage = getFreemiumUsage(
    memories.length,
    places.length,
    capsules.length,
    subscriptionPlan
  );

  // Auto-dismiss undo & freemium banners
  useEffect(() => {
    if (!completedPlanUndo) return;
    const timer = setTimeout(() => setCompletedPlanUndo(null), 8000);
    return () => clearTimeout(timer);
  }, [completedPlanUndo]);

  useEffect(() => {
    if (!freemiumLimitToast) return;
    const timer = setTimeout(() => setFreemiumLimitToast(null), 4500);
    return () => clearTimeout(timer);
  }, [freemiumLimitToast]);

  // Sync dark mode class + native Android status bar
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    syncNativeStatusBar(settings.darkMode);
  }, [settings.darkMode]);

  // Native Android back button handler
  useEffect(() => {
    if (!isNativePlatform()) return;
    let listenerHandle: { remove: () => Promise<void> } | null = null;
    CapApp.addListener('backButton', () => {
      if (isMemoryModalOpen) setIsMemoryModalOpen(false);
      else if (isPlanModalOpen) setIsPlanModalOpen(false);
      else if (isPlaceModalOpen) setIsPlaceModalOpen(false);
      else if (isCapsuleModalOpen) setIsCapsuleModalOpen(false);
      else if (isThoughtModalOpen) setIsThoughtModalOpen(false);
      else if (isPairManageOpen) setIsPairManageOpen(false);
      else if (currentTab !== 'inicio') setCurrentTab('inicio');
      else CapApp.exitApp();
    }).then((h) => {
      listenerHandle = h;
    });

    return () => {
      listenerHandle?.remove();
    };
  }, [
    isMemoryModalOpen,
    isPlanModalOpen,
    isPlaceModalOpen,
    isCapsuleModalOpen,
    isThoughtModalOpen,
    isPairManageOpen,
    currentTab,
  ]);

  // Supabase Realtime & Cloud Data Fetch
  useEffect(() => {
    let isMounted = true;

    async function loadSupabase() {
      if (!settings.supabaseUrl && !(import.meta as any).env?.VITE_SUPABASE_URL) return;

      try {
        const cloudData = await fetchAllFromSupabase(
          settings.supabaseUrl,
          settings.supabaseAnonKey
        );
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
                if (notifications.kissesAndTouches) {
                  setIncomingKissAlert({
                    senderName: senderNick,
                    time: new Date().toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                  });
                  triggerHapticSuccess(notifications.hapticsEnabled);
                  fireHeartConfetti();
                }
              }
              return cloudData.kisses;
            });
          }
        }

        const cloudThought = await fetchCloudThought(
          userSession?.coupleId || 'couple_main',
          settings.supabaseUrl,
          settings.supabaseAnonKey
        );
        if (cloudThought && isMounted) {
          setLatestThought(cloudThought);
        }
      } catch (err) {
        console.warn('Error cargando datos de Supabase:', err);
      }
    }

    loadSupabase();

    const unsubscribe = subscribeToSupabase(
      () => {
        loadSupabase();
      },
      settings.supabaseUrl,
      settings.supabaseAnonKey
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [
    settings.supabaseUrl,
    settings.supabaseAnonKey,
    settings.currentUser,
    userSession?.coupleId,
    notifications.kissesAndTouches,
    notifications.hapticsEnabled,
  ]);

  // --- AUTH, PAIRING & PAYWALL HANDLERS ---
  const handleLogin = async (provider: AuthProviderType, email?: string, name?: string) => {
    const { session } = await loginWithProvider(
      provider,
      email,
      name,
      settings.supabaseUrl,
      settings.supabaseAnonKey
    );
    setUserSession(session);
    setFlowStage('pair');
  };

  const handlePairWithCode = async (partnerCode: string) => {
    if (!userSession) return;
    const { updatedSession } = await pairWithPartnerCode(
      userSession,
      partnerCode,
      settings.supabaseUrl,
      settings.supabaseAnonKey
    );
    setUserSession(updatedSession);
  };

  const handleUnlinkPartner = () => {
    if (!userSession) return;
    const updated = unlinkPartnerSession(userSession);
    setUserSession(updated);
    setFlowStage('pair');
  };

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    saveSubscriptionPlan(plan);
    setSubscriptionPlan(plan);
    setFlowStage('app');
    if (plan !== 'free') {
      fireSuperCelebration();
    }
  };

  const handleLogout = () => {
    clearUserSession();
    setUserSession(null);
    setFlowStage('login');
    setCurrentTab('inicio');
  };

  // --- LIVE THOUGHT & KISS HANDLERS ---
  const handleSendThought = async (text: string) => {
    const isGigio = settings.currentUser === 'Gigio';
    const senderRole = isGigio ? 'Gigio' : 'Rosita';
    const senderName = isGigio
      ? `${settings.partner1.name} (${settings.partner1.nickname})`
      : `${settings.partner2.name} (${settings.partner2.nickname})`;
    const created = await publishCoupleThought(
      userSession?.coupleId || 'couple_main',
      senderName,
      senderRole,
      text,
      settings.supabaseUrl,
      settings.supabaseAnonKey
    );
    setLatestThought(created);
  };

  const handleSendKiss = async () => {
    const isGigio = settings.currentUser === 'Gigio';
    const senderRole = isGigio ? 'Gigio' : 'Rosita';
    const senderName = isGigio
      ? settings.partner1.name || 'Paulo'
      : settings.partner2.name || 'Alexandra';
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

  // --- SETTINGS & DATA HANDLERS ---
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

  // --- GATED CREATION TRIGGERS (FREEMIUM LIMITS) ---
  const tryOpenNewMemory = () => {
    if (!usage.canAddMemory) {
      setFreemiumLimitToast('Alcanzaste el límite de 10 recuerdos del Plan Free.');
      setFlowStage('paywall');
      return;
    }
    setMemoryToEdit(null);
    setPrefillPlanForMemory(null);
    setIsMemoryModalOpen(true);
  };

  const tryOpenNewPlace = () => {
    if (!usage.canAddPlace) {
      setFreemiumLimitToast('Alcanzaste el límite de 5 rincones del Plan Free.');
      setFlowStage('paywall');
      return;
    }
    setPlaceToEdit(null);
    setIsPlaceModalOpen(true);
  };

  const tryOpenNewCapsule = () => {
    if (!usage.canAddCapsule) {
      setFreemiumLimitToast('El Plan Free incluye 1 cápsula. Pásate a Premium para crear ilimitadas.');
      setFlowStage('paywall');
      return;
    }
    setIsCapsuleModalOpen(true);
  };

  // --- MEMORY HANDLERS ---
  const handleSaveMemory = (newMemory: Memory) => {
    const exists = memories.some((m) => m.id === newMemory.id);
    const updated = exists
      ? memories.map((m) => (m.id === newMemory.id ? newMemory : m))
      : [newMemory, ...memories];
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
    const updated = exists
      ? plans.map((p) => (p.id === newPlan.id ? newPlan : p))
      : [newPlan, ...plans];
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

  const handleConvertPlanToMemory = (plan: Plan) => {
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

    handleUpdatePlanStatus(plan.id, '¡Vivido!');
    fireHeartConfetti();
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
    const updated = exists
      ? places.map((p) => (p.id === newPlace.id ? newPlace : p))
      : [newPlace, ...places];
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
    const newStatus: 'Visitado' | 'Por conocer' =
      place.status === 'Visitado' ? 'Por conocer' : 'Visitado';
    const newVerdict: ReturnVerdict =
      newStatus === 'Visitado' ? '¡Sí o sí!' : 'Pendiente de probar';
    let targetPlace: Place | undefined;
    const updated: Place[] = places.map((p) => {
      if (p.id === place.id) {
        targetPlace = { ...p, status: newStatus, wouldReturn: newVerdict };
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

  const handleAcceptPlanChallenge = (plan: Plan) => {
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
    setCurrentTab('planes');
  };

  // --- FLOW ROUTING ---
  if (flowStage === 'login' || !userSession) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  if (flowStage === 'pair') {
    return (
      <PairingScreen
        session={userSession}
        onPairWithCode={handlePairWithCode}
        onContinueToPlans={() => setFlowStage('paywall')}
        onLogout={handleLogout}
      />
    );
  }

  if (flowStage === 'paywall') {
    return (
      <>
        {freemiumLimitToast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-stone-900 text-white text-xs font-semibold shadow-lg">
            {freemiumLimitToast}
          </div>
        )}
        <PaywallScreen
          currentPlan={subscriptionPlan}
          onSelectPlan={handleSelectPlan}
          onBack={() => setFlowStage('app')}
        />
      </>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#FAF8F5] dark:bg-[#0F1015] flex flex-col selection:bg-rose-500 selection:text-white">
      {/* Main Content Area (Mobile Minimalist Container) */}
      <main className="flex-1 w-full max-w-xl mx-auto px-4 sm:px-6 pt-3 pb-28">
        {/* Back Breadcrumb when browsing secondary tabs (Planes / Ruleta) */}
        {(currentTab === 'planes' || currentTab === 'ruleta') && (
          <button
            type="button"
            onClick={() => setCurrentTab('inicio')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 mb-3 pt-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Inicio
          </button>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={currentTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {currentTab === 'inicio' && (
              <HomeView
                settings={settings}
                session={userSession}
                thought={latestThought}
                kissesData={kissesData}
                placesCount={places.length}
                capsulesCount={capsules.length}
                plansCount={plans.length}
                hapticsEnabled={notifications.hapticsEnabled}
                onSendKiss={handleSendKiss}
                onOpenPairManage={() => setIsPairManageOpen(true)}
                onOpenThoughtModal={() => setIsThoughtModalOpen(true)}
                onNavigateTab={(tab) => setCurrentTab(tab)}
                onOpenBedtime={() => setIsBedtimeModalOpen(true)}
              />
            )}

            {currentTab === 'recuerdos' && (
              <MemoriesView
                memories={memories}
                settings={settings}
                onOpenNewMemory={tryOpenNewMemory}
                onEditMemory={(mem) => {
                  setMemoryToEdit(mem);
                  setPrefillPlanForMemory(null);
                  setIsMemoryModalOpen(true);
                }}
                onDeleteMemory={handleDeleteMemory}
                selectedMemoryId={selectedMemoryId}
              />
            )}

            {currentTab === 'rincones' && (
              <PlacesView
                places={places}
                settings={settings}
                onOpenNewPlace={tryOpenNewPlace}
                onEditPlace={(place) => {
                  setPlaceToEdit(place);
                  setIsPlaceModalOpen(true);
                }}
                onDeletePlace={handleDeletePlace}
                onToggleStatus={handleTogglePlaceStatus}
              />
            )}

            {currentTab === 'capsulas' && (
              <TimeCapsulesView
                capsules={capsules}
                settings={settings}
                onOpenNewCapsule={tryOpenNewCapsule}
                onDeleteCapsule={handleDeleteCapsule}
                onOpenCapsuleContent={handleOpenCapsuleContent}
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

            {currentTab === 'ruleta' && (
              <RouletteView plans={plans} onAcceptPlanChallenge={handleAcceptPlanChallenge} />
            )}

            {currentTab === 'ajustes' && (
              <SettingsView
                settings={settings}
                session={userSession}
                usage={usage}
                notifications={notifications}
                onUpdateNotifications={(prefs) => {
                  saveNotificationSettings(prefs);
                  setNotifications(prefs);
                }}
                onToggleDarkMode={() =>
                  handleUpdateSettings({ ...settings, darkMode: !settings.darkMode })
                }
                onSwitchUserRole={(role) => handleUpdateSettings({ ...settings, currentUser: role })}
                onOpenPairManage={() => setIsPairManageOpen(true)}
                onOpenPaywall={() => setFlowStage('paywall')}
                onOpenLegacySettings={() => setIsSettingsModalOpen(true)}
                onLogout={handleLogout}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Floating Minimalist Bottom Navigation */}
      <BottomNav
        currentTab={currentTab}
        onChangeTab={(tab) => {
          setCurrentTab(tab);
          setSelectedMemoryId(null);
        }}
      />

      {/* Realtime Incoming Kiss Alert */}
      <AnimatePresence>
        {incomingKissAlert && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.95 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[92%] bg-white dark:bg-[#181A20] border border-rose-200 dark:border-rose-900 rounded-3xl p-4 shadow-xl flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center text-rose-500">
                <Heart className="w-5 h-5 fill-current animate-pulse" />
              </div>
              <div>
                <p className="font-bold text-xs text-stone-900 dark:text-stone-100">
                  ¡{incomingKissAlert.senderName} te mandó un besito!
                </p>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  Recibido a las {incomingKissAlert.time}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsBedtimeModalOpen(true);
                  setIncomingKissAlert(null);
                }}
                className="px-3 py-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold"
              >
                Ver
              </button>
              <button
                type="button"
                onClick={() => setIncomingKissAlert(null)}
                className="p-1.5 rounded-full text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Undo Banner for Completed Plan */}
      <AnimatePresence>
        {completedPlanUndo && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] bg-stone-900 text-white rounded-2xl p-3.5 shadow-xl flex items-center justify-between gap-3"
          >
            <p className="font-semibold text-xs leading-tight">
              Cita <strong>"{completedPlanUndo.plan.title}"</strong> marcada como vivida.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleUndoCompletePlan}
                className="px-3 py-1 rounded-full bg-rose-500 text-white text-xs font-bold"
              >
                Deshacer
              </button>
              <button
                type="button"
                onClick={() => setCompletedPlanUndo(null)}
                className="p-1 rounded-full hover:bg-white/10"
                aria-label="Cerrar notificación"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <PairManageModal
        isOpen={isPairManageOpen}
        session={userSession}
        onClose={() => setIsPairManageOpen(false)}
        onPairWithCode={handlePairWithCode}
        onUnlink={handleUnlinkPartner}
      />

      <ThoughtModal
        isOpen={isThoughtModalOpen}
        partnerName={
          settings.currentUser === 'Gigio' ? settings.partner2.name : settings.partner1.name
        }
        onClose={() => setIsThoughtModalOpen(false)}
        onSendThought={handleSendThought}
      />

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
