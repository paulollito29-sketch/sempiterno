import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CoupleSettings, Memory, Plan, Place, TimeCapsule } from '../types';

let cachedClient: SupabaseClient | null = null;
let cachedUrl = '';
let cachedKey = '';

export function getSupabase(customUrl?: string, customKey?: string): SupabaseClient | null {
  const url = (customUrl || (import.meta as any).env?.VITE_SUPABASE_URL || '').trim();
  const key = (customKey || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '').trim();

  if (!url || !key) return null;

  if (cachedClient && cachedUrl === url && cachedKey === key) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    cachedUrl = url;
    cachedKey = key;
    return cachedClient;
  } catch (err) {
    console.error('Error inicializando Supabase client:', err);
    return null;
  }
}

export async function testSupabaseConnection(
  url: string,
  key: string
): Promise<{ ok: boolean; message: string }> {
  try {
    if (!url.startsWith('http')) {
      return { ok: false, message: 'La URL de Supabase debe comenzar con https://' };
    }
    if (!key || key.length < 20) {
      return { ok: false, message: 'La Anon Key de Supabase parece inválida' };
    }

    const client = createClient(url, key);
    // Try pinging settings table or auth
    const { error } = await client.from('sempiterno_settings').select('*').limit(1);

    if (error) {
      // If table doesn't exist yet, it still reached Supabase!
      if (error.code === '42P01') {
        return {
          ok: true,
          message: '¡Conexión establecida! (Falta ejecutar el script SQL para crear las tablas)',
        };
      }
      return { ok: false, message: `Error de Supabase: ${error.message}` };
    }

    return { ok: true, message: '¡Conexión a Supabase exitosa y tablas listas! 🚀❤️' };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'No se pudo conectar a Supabase' };
  }
}

// ------------------------------------------------------------------------------
// TRANSFORMERS (CamelCase <-> SnakeCase)
// ------------------------------------------------------------------------------

function memoryFromRow(row: any): Memory {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    category: row.category,
    photos: Array.isArray(row.photos) ? row.photos : (typeof row.photos === 'string' ? JSON.parse(row.photos || '[]') : []),
    location: row.location || '',
    perspectiveGigio: row.perspective_gigio || '',
    perspectiveRosita: row.perspective_rosita || '',
    rating: row.rating || 5,
    songTitle: row.song_title || undefined,
    songUrl: row.song_url || undefined,
    tags: Array.isArray(row.tags) ? row.tags : (typeof row.tags === 'string' ? JSON.parse(row.tags || '[]') : []),
    isFavorite: !!row.is_favorite,
  };
}

function memoryToRow(m: Memory) {
  return {
    id: m.id,
    title: m.title,
    date: m.date,
    category: m.category,
    photos: m.photos || [],
    location: m.location || '',
    perspective_gigio: m.perspectiveGigio || '',
    perspective_rosita: m.perspectiveRosita || '',
    rating: m.rating || 5,
    song_title: m.songTitle || null,
    song_url: m.songUrl || null,
    tags: m.tags || [],
    is_favorite: !!m.isFavorite,
    updated_at: new Date().toISOString(),
  };
}

function planFromRow(row: any): Plan {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    category: row.category,
    budget: row.budget || '$$',
    status: row.status,
    scheduledDate: row.scheduled_date || undefined,
    scheduledTime: row.scheduled_time || undefined,
    location: row.location || undefined,
    dressCode: row.dress_code || undefined,
    surpriseNote: row.surprise_note || undefined,
    tag: row.tag || undefined,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function planToRow(p: Plan) {
  return {
    id: p.id,
    title: p.title,
    description: p.description || '',
    category: p.category,
    budget: p.budget,
    status: p.status,
    scheduled_date: p.scheduledDate || null,
    scheduled_time: p.scheduledTime || null,
    location: p.location || null,
    dress_code: p.dressCode || null,
    surprise_note: p.surpriseNote || null,
    tag: p.tag || null,
    created_at: p.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function placeFromRow(row: any): Place {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    status: row.status,
    zone: row.zone || '',
    whatWeOrdered: row.what_we_ordered || undefined,
    review: row.review || undefined,
    wouldReturn: row.would_return || '¡Sí o sí!',
    rating: row.rating || undefined,
    priceRange: row.price_range || '$$',
    imageUrl: row.image_url || undefined,
    googleMapsUrl: row.google_maps_url || undefined,
  };
}

function placeToRow(p: Place) {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    status: p.status,
    zone: p.zone || '',
    what_we_ordered: p.whatWeOrdered || null,
    review: p.review || null,
    would_return: p.wouldReturn,
    rating: p.rating || null,
    price_range: p.priceRange,
    image_url: p.imageUrl || null,
    google_maps_url: p.googleMapsUrl || null,
    updated_at: new Date().toISOString(),
  };
}

function capsuleFromRow(row: any): TimeCapsule {
  return {
    id: row.id,
    title: row.title,
    sender: row.sender,
    recipient: row.recipient,
    unlockDate: row.unlock_date,
    secretMessage: row.secret_message,
    photos: Array.isArray(row.photos) ? row.photos : (typeof row.photos === 'string' ? JSON.parse(row.photos || '[]') : []),
    hint: row.hint || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    isCustomOpened: !!row.is_custom_opened,
  };
}

function capsuleToRow(c: TimeCapsule) {
  return {
    id: c.id,
    title: c.title,
    sender: c.sender,
    recipient: c.recipient,
    unlock_date: c.unlockDate,
    secret_message: c.secretMessage,
    photos: c.photos || [],
    hint: c.hint || null,
    created_at: c.createdAt || new Date().toISOString(),
    is_custom_opened: !!c.isCustomOpened,
    updated_at: new Date().toISOString(),
  };
}

// ------------------------------------------------------------------------------
// DATA FETCHING & SYNCHRONIZATION
// ------------------------------------------------------------------------------

export interface SupabaseFullData {
  settings?: CoupleSettings;
  memories: Memory[];
  plans: Plan[];
  places: Place[];
  capsules: TimeCapsule[];
}

export async function fetchAllFromSupabase(
  customUrl?: string,
  customKey?: string
): Promise<SupabaseFullData | null> {
  const client = getSupabase(customUrl, customKey);
  if (!client) return null;

  try {
    const [settingsRes, memRes, plansRes, placesRes, capsRes] = await Promise.all([
      client.from('sempiterno_settings').select('*').limit(1),
      client.from('sempiterno_memories').select('*').order('date', { ascending: false }),
      client.from('sempiterno_plans').select('*').order('created_at', { ascending: false }),
      client.from('sempiterno_places').select('*').order('name', { ascending: true }),
      client.from('sempiterno_capsules').select('*').order('unlock_date', { ascending: true }),
    ]);

    let loadedSettings: CoupleSettings | undefined = undefined;
    if (settingsRes.data && settingsRes.data.length > 0) {
      const s = settingsRes.data[0];
      loadedSettings = {
        startDate: s.start_date,
        partner1: s.partner1,
        partner2: s.partner2,
        currentUser: s.current_user || 'Gigio',
        ratingStyle: s.rating_style || 'cheese',
        darkMode: !!s.dark_mode,
        supabaseUrl: customUrl,
        supabaseAnonKey: customKey,
      };
    }

    return {
      settings: loadedSettings,
      memories: (memRes.data || []).map(memoryFromRow),
      plans: (plansRes.data || []).map(planFromRow),
      places: (placesRes.data || []).map(placeFromRow),
      capsules: (capsRes.data || []).map(capsuleFromRow),
    };
  } catch (err) {
    console.warn('Error fetching all from Supabase:', err);
    return null;
  }
}

// ------------------------------------------------------------------------------
// CRUD OPERATIONS
// ------------------------------------------------------------------------------

export async function syncMemoryToSupabase(memory: Memory, customUrl?: string, customKey?: string) {
  const client = getSupabase(customUrl, customKey);
  if (!client) return false;
  const { error } = await client.from('sempiterno_memories').upsert(memoryToRow(memory));
  if (error) console.error('Error saving memory to Supabase:', error);
  return !error;
}

export async function deleteMemoryFromSupabase(id: string, customUrl?: string, customKey?: string) {
  const client = getSupabase(customUrl, customKey);
  if (!client) return false;
  const { error } = await client.from('sempiterno_memories').delete().eq('id', id);
  return !error;
}

export async function syncPlanToSupabase(plan: Plan, customUrl?: string, customKey?: string) {
  const client = getSupabase(customUrl, customKey);
  if (!client) return false;
  const { error } = await client.from('sempiterno_plans').upsert(planToRow(plan));
  if (error) console.error('Error saving plan to Supabase:', error);
  return !error;
}

export async function deletePlanFromSupabase(id: string, customUrl?: string, customKey?: string) {
  const client = getSupabase(customUrl, customKey);
  if (!client) return false;
  const { error } = await client.from('sempiterno_plans').delete().eq('id', id);
  return !error;
}

export async function syncPlaceToSupabase(place: Place, customUrl?: string, customKey?: string) {
  const client = getSupabase(customUrl, customKey);
  if (!client) return false;
  const { error } = await client.from('sempiterno_places').upsert(placeToRow(place));
  if (error) console.error('Error saving place to Supabase:', error);
  return !error;
}

export async function deletePlaceFromSupabase(id: string, customUrl?: string, customKey?: string) {
  const client = getSupabase(customUrl, customKey);
  if (!client) return false;
  const { error } = await client.from('sempiterno_places').delete().eq('id', id);
  return !error;
}

export async function syncCapsuleToSupabase(capsule: TimeCapsule, customUrl?: string, customKey?: string) {
  const client = getSupabase(customUrl, customKey);
  if (!client) return false;
  const { error } = await client.from('sempiterno_capsules').upsert(capsuleToRow(capsule));
  if (error) console.error('Error saving capsule to Supabase:', error);
  return !error;
}

export async function deleteCapsuleFromSupabase(id: string, customUrl?: string, customKey?: string) {
  const client = getSupabase(customUrl, customKey);
  if (!client) return false;
  const { error } = await client.from('sempiterno_capsules').delete().eq('id', id);
  return !error;
}

export async function syncSettingsToSupabase(settings: CoupleSettings, customUrl?: string, customKey?: string) {
  const client = getSupabase(customUrl, customKey);
  if (!client) return false;
  const row = {
    id: 'couple_main',
    start_date: settings.startDate,
    partner1: settings.partner1,
    partner2: settings.partner2,
    rating_style: settings.ratingStyle,
    dark_mode: settings.darkMode,
    updated_at: new Date().toISOString(),
  };
  const { error } = await client.from('sempiterno_settings').upsert(row);
  if (error) console.error('Error saving settings to Supabase:', error);
  return !error;
}

// ------------------------------------------------------------------------------
// PHOTO UPLOAD (Supabase Storage)
// ------------------------------------------------------------------------------

export async function uploadPhotoToSupabase(file: File, customUrl?: string, customKey?: string): Promise<string | null> {
  const client = getSupabase(customUrl, customKey);
  if (!client) return null;

  try {
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `photos/${fileName}`;

    const { error: uploadError } = await client.storage
      .from('sempiterno-photos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error subiendo foto a Supabase Storage:', uploadError);
      return null;
    }

    const { data } = client.storage.from('sempiterno-photos').getPublicUrl(filePath);
    return data.publicUrl;
  } catch (err) {
    console.error('Error uploadPhotoToSupabase:', err);
    return null;
  }
}

// ------------------------------------------------------------------------------
// REALTIME LISTENER
// ------------------------------------------------------------------------------

export function subscribeToSupabase(
  onUpdate: () => void,
  customUrl?: string,
  customKey?: string
) {
  const client = getSupabase(customUrl, customKey);
  if (!client) return () => {};

  const channel = client
    .channel('sempiterno-sync-channel')
    .on('postgres_changes', { event: '*', schema: 'public' }, () => {
      onUpdate();
    })
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
