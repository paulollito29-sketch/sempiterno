import {
  AuthProviderType,
  CoupleThought,
  FREE_PLAN_LIMITS,
  NotificationSettings,
  SubscriptionPlan,
  UserSession,
} from '../types';
import { getSupabase } from './supabase';

const SESSION_KEY = 'sempiterno_user_session_v1';
const PLAN_KEY = 'sempiterno_subscription_plan_v1';
const NOTIF_KEY = 'sempiterno_notif_prefs_v1';
const THOUGHT_KEY = 'sempiterno_latest_thought_v1';

export function generateCoupleCode(): string {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `SEMP-${digits}`;
}

export function loadUserSession(): UserSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserSession;
  } catch {
    return null;
  }
}

export function saveUserSession(session: UserSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage errors
  }
}

export function clearUserSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore
  }
}

export function loadSubscriptionPlan(): SubscriptionPlan {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (raw === 'monthly' || raw === 'annual' || raw === 'free') return raw;
    return 'free';
  } catch {
    return 'free';
  }
}

export function saveSubscriptionPlan(plan: SubscriptionPlan): void {
  try {
    localStorage.setItem(PLAN_KEY, plan);
  } catch {
    // Ignore
  }
}

export function loadNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    if (raw) return JSON.parse(raw) as NotificationSettings;
  } catch {
    // Fallback
  }
  return {
    kissesAndTouches: true,
    hapticsEnabled: true,
    dailyThoughtReminder: true,
  };
}

export function saveNotificationSettings(prefs: NotificationSettings): void {
  try {
    localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore
  }
}

/**
 * Authenticates via Supabase (if OAuth/OTP enabled) and creates a persistent mobile session.
 * Gracefully falls back to instant cloud-ready profile creation when testing locally or in APK before OAuth console setup.
 */
export async function loginWithProvider(
  provider: AuthProviderType,
  email?: string,
  displayName?: string,
  customUrl?: string,
  customKey?: string
): Promise<{ session: UserSession; magicLinkSent?: boolean }> {
  const client = getSupabase(customUrl, customKey);
  const userId = `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const code = generateCoupleCode();

  // Attempt Supabase OTP if email provided and client active
  let magicLinkSent = false;
  if (client && provider === 'email' && email && email.includes('@')) {
    try {
      const { error } = await client.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
        },
      });
      if (!error) {
        magicLinkSent = true;
      }
    } catch {
      // Proceed with local+cloud session
    }
  }

  // Register user pairing code in Supabase table if available
  const cleanName =
    displayName?.trim() ||
    (email ? email.split('@')[0] : provider === 'google' ? 'Paulo' : provider === 'apple' ? 'Paulo' : 'Pareja');

  const newSession: UserSession = {
    id: userId,
    email: email?.trim(),
    name: cleanName,
    provider,
    myCode: code,
    coupleId: code, // Defaults to own code until linked with partner
    isPaired: false,
  };

  if (client) {
    try {
      await client.from('sempiterno_couples').upsert({
        code,
        couple_id: code,
        owner_name: cleanName,
        owner_email: email?.trim() || null,
        paired_with_code: null,
        updated_at: new Date().toISOString(),
      });
    } catch {
      // Silently handle if schema hasn't had sempiterno_couples added yet
    }
  }

  saveUserSession(newSession);
  return { session: newSession, magicLinkSent };
}

/**
 * Bidirectional Pairing:
 * Either partner can enter the other's code (e.g., SEMP-1234).
 * Both partners converge automatically onto the target coupleId in Supabase!
 */
export async function pairWithPartnerCode(
  currentSession: UserSession,
  rawPartnerCode: string,
  customUrl?: string,
  customKey?: string
): Promise<{ updatedSession: UserSession; partnerName?: string }> {
  const targetCode = rawPartnerCode.trim().toUpperCase();
  if (!targetCode || targetCode.length < 4) {
    throw new Error('Ingresa un código de pareja válido (ej. SEMP-7492).');
  }
  if (targetCode === currentSession.myCode) {
    throw new Error('Ese es tu propio código. Ingresa el código que aparece en el teléfono de tu pareja.');
  }

  const client = getSupabase(customUrl, customKey);
  let resolvedCoupleId = targetCode;
  let partnerName = 'Alexandra';

  if (client) {
    try {
      const { data: existing } = await client
        .from('sempiterno_couples')
        .select('*')
        .eq('code', targetCode)
        .maybeSingle();

      if (existing) {
        resolvedCoupleId = existing.couple_id || targetCode;
        partnerName = existing.owner_name || partnerName;

        // Mark partner row as paired too so their device updates automatically via Realtime!
        await client
          .from('sempiterno_couples')
          .update({
            paired_with_code: currentSession.myCode,
            partner_name: currentSession.name,
            updated_at: new Date().toISOString(),
          })
          .eq('code', targetCode);
      }

      // Update current user's row to share the exact same couple_id
      await client.from('sempiterno_couples').upsert({
        code: currentSession.myCode,
        couple_id: resolvedCoupleId,
        owner_name: currentSession.name,
        owner_email: currentSession.email || null,
        paired_with_code: targetCode,
        partner_name: partnerName,
        updated_at: new Date().toISOString(),
      });
    } catch {
      // Fallback gracefully if table isn't created yet
    }
  }

  const updatedSession: UserSession = {
    ...currentSession,
    coupleId: resolvedCoupleId,
    pairedPartnerName: partnerName,
    isPaired: true,
  };
  saveUserSession(updatedSession);
  return { updatedSession, partnerName };
}

export function unlinkPartnerSession(currentSession: UserSession): UserSession {
  const updated: UserSession = {
    ...currentSession,
    coupleId: currentSession.myCode,
    pairedPartnerName: undefined,
    isPaired: false,
  };
  saveUserSession(updated);
  return updated;
}

export function loadLatestThought(): CoupleThought {
  try {
    const raw = localStorage.getItem(THOUGHT_KEY);
    if (raw) return JSON.parse(raw) as CoupleThought;
  } catch {
    // Fallback
  }
  return {
    id: 'default-thought',
    senderName: 'Alexandra (Rosita)',
    senderRole: 'Rosita',
    text: 'Recordando nuestra última cita... te extraño mucho hoy ❤️',
    createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  };
}

export async function publishCoupleThought(
  coupleId: string,
  senderName: string,
  senderRole: 'Gigio' | 'Rosita',
  text: string,
  customUrl?: string,
  customKey?: string
): Promise<CoupleThought> {
  const thought: CoupleThought = {
    id: `th_${Date.now()}`,
    senderName,
    senderRole,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(THOUGHT_KEY, JSON.stringify(thought));
  } catch {
    // Ignore
  }

  const client = getSupabase(customUrl, customKey);
  if (client) {
    try {
      await client.from('sempiterno_thoughts').upsert({
        id: 'latest_' + (coupleId || 'couple_main'),
        couple_id: coupleId || 'couple_main',
        sender_name: senderName,
        sender_role: senderRole,
        content: text.trim(),
        created_at: thought.createdAt,
      });
    } catch {
      // Ignore if table not yet migrated
    }
  }
  return thought;
}

export async function fetchCloudThought(
  coupleId: string,
  customUrl?: string,
  customKey?: string
): Promise<CoupleThought | null> {
  const client = getSupabase(customUrl, customKey);
  if (!client) return null;
  try {
    const { data } = await client
      .from('sempiterno_thoughts')
      .select('*')
      .eq('couple_id', coupleId || 'couple_main')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return null;
    const thought: CoupleThought = {
      id: data.id,
      senderName: data.sender_name,
      senderRole: data.sender_role,
      text: data.content,
      createdAt: data.created_at,
    };
    localStorage.setItem(THOUGHT_KEY, JSON.stringify(thought));
    return thought;
  } catch {
    return null;
  }
}

export interface FreemiumUsage {
  isPremium: boolean;
  plan: SubscriptionPlan;
  memoriesUsed: number;
  memoriesMax: number;
  placesUsed: number;
  placesMax: number;
  capsulesUsed: number;
  capsulesMax: number;
  canAddMemory: boolean;
  canAddPlace: boolean;
  canAddCapsule: boolean;
}

export function getFreemiumUsage(
  memoriesCount: number,
  placesCount: number,
  capsulesCount: number,
  plan: SubscriptionPlan
): FreemiumUsage {
  const isPremium = plan === 'monthly' || plan === 'annual';
  return {
    isPremium,
    plan,
    memoriesUsed: memoriesCount,
    memoriesMax: FREE_PLAN_LIMITS.maxMemories,
    placesUsed: placesCount,
    placesMax: FREE_PLAN_LIMITS.maxPlaces,
    capsulesUsed: capsulesCount,
    capsulesMax: FREE_PLAN_LIMITS.maxCapsules,
    canAddMemory: isPremium || memoriesCount < FREE_PLAN_LIMITS.maxMemories,
    canAddPlace: isPremium || placesCount < FREE_PLAN_LIMITS.maxPlaces,
    canAddCapsule: isPremium || capsulesCount < FREE_PLAN_LIMITS.maxCapsules,
  };
}
