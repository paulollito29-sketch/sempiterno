import {
  INITIAL_MEMORIES,
  INITIAL_PLANS,
  INITIAL_PLACES,
  INITIAL_TIME_CAPSULES,
  INITIAL_SETTINGS,
} from '../data/mockData';
import { CoupleSettings, Memory, Place, Plan, TimeCapsule } from '../types';

const STORAGE_KEYS = {
  SETTINGS: 'sempiterno_settings_v3',
  MEMORIES: 'sempiterno_memories_v3',
  PLANS: 'sempiterno_plans_v3',
  PLACES: 'sempiterno_places_v3',
  CAPSULES: 'sempiterno_capsules_v3',
};

export function loadSettings(): CoupleSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS) || localStorage.getItem('sempiterno_settings_v1');
    if (!raw) return INITIAL_SETTINGS;
    const parsed = JSON.parse(raw);
    const settings: CoupleSettings = {
      ...INITIAL_SETTINGS,
      ...parsed,
      googleSheetsUrl: parsed.googleSheetsUrl || INITIAL_SETTINGS.googleSheetsUrl,
      partner1: {
        ...INITIAL_SETTINGS.partner1,
        ...(parsed.partner1 || {}),
      },
      partner2: {
        ...INITIAL_SETTINGS.partner2,
        ...(parsed.partner2 || {}),
        name: (!parsed.partner2?.name || parsed.partner2.name === 'Mi Amor') ? 'Alexandra' : parsed.partner2.name,
      },
    };
    return settings;
  } catch {
    return INITIAL_SETTINGS;
  }
}

export function saveSettings(settings: CoupleSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (err) {
    console.error('Error saving settings', err);
  }
}

export function loadMemories(): Memory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MEMORIES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMemories(memories: Memory[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.MEMORIES, JSON.stringify(memories));
  } catch (err) {
    console.error('Error saving memories', err);
  }
}

export function loadPlans(): Plan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PLANS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePlans(plans: Plan[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PLANS, JSON.stringify(plans));
  } catch (err) {
    console.error('Error saving plans', err);
  }
}

export function loadPlaces(): Place[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PLACES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePlaces(places: Place[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PLACES, JSON.stringify(places));
  } catch (err) {
    console.error('Error saving places', err);
  }
}

export function loadTimeCapsules(): TimeCapsule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CAPSULES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTimeCapsules(capsules: TimeCapsule[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CAPSULES, JSON.stringify(capsules));
  } catch (err) {
    console.error('Error saving capsules', err);
  }
}

export function exportBackupData(): string {
  const data = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    settings: loadSettings(),
    memories: loadMemories(),
    plans: loadPlans(),
    places: loadPlaces(),
    capsules: loadTimeCapsules(),
  };
  return JSON.stringify(data, null, 2);
}

export function downloadBackupFile(): void {
  const json = exportBackupData();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sempiterno-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importBackupData(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    if (data.settings) saveSettings(data.settings);
    if (data.memories) saveMemories(data.memories);
    if (data.plans) savePlans(data.plans);
    if (data.places) savePlaces(data.places);
    if (data.capsules) saveTimeCapsules(data.capsules);
    return true;
  } catch (err) {
    console.error('Failed to import backup', err);
    return false;
  }
}

export function resetAllDataToDefault(): void {
  localStorage.removeItem(STORAGE_KEYS.SETTINGS);
  localStorage.removeItem(STORAGE_KEYS.MEMORIES);
  localStorage.removeItem(STORAGE_KEYS.PLANS);
  localStorage.removeItem(STORAGE_KEYS.PLACES);
  localStorage.removeItem(STORAGE_KEYS.CAPSULES);
  localStorage.removeItem('sempiterno_settings_v1');
  localStorage.removeItem('sempiterno_memories_v1');
  localStorage.removeItem('sempiterno_plans_v1');
  localStorage.removeItem('sempiterno_places_v1');
  localStorage.removeItem('sempiterno_capsules_v1');
}
