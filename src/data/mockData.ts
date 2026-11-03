import { Memory, Plan, Place, TimeCapsule, CoupleSettings } from '../types';

export const INITIAL_SETTINGS: CoupleSettings = {
  startDate: "2023-08-18T19:30:00",
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
};

export const INITIAL_MEMORIES: Memory[] = [];

export const INITIAL_PLANS: Plan[] = [];

export const INITIAL_PLACES: Place[] = [];

export const INITIAL_TIME_CAPSULES: TimeCapsule[] = [];
