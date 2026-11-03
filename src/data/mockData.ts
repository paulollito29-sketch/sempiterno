import { Memory, Plan, Place, TimeCapsule, CoupleSettings } from '../types';

export const INITIAL_SETTINGS: CoupleSettings = {
  startDate: "2026-06-04T00:00:00",
  partner1: {
    name: "Paulo",
    nickname: "Gigio",
    avatarUrl: "/assets/gigio-rosita.jpg",
    role: "Gigio",
  },
  partner2: {
    name: "Alexandra",
    nickname: "Rosita",
    avatarUrl: "/assets/gigio-rosita.jpg",
    role: "Rosita",
  },
  currentUser: "Gigio",
  ratingStyle: "cheese",
  darkMode: false,
  supabaseUrl: "https://kzdtxkzriobixfismbce.supabase.co",
  supabaseAnonKey: "sb_publishable_M7W38LZzBVa-4rnqJEz3pQ_VM7ijH7l",
};

export const INITIAL_MEMORIES: Memory[] = [];

export const INITIAL_PLANS: Plan[] = [];

export const INITIAL_PLACES: Place[] = [];

export const INITIAL_TIME_CAPSULES: TimeCapsule[] = [];
