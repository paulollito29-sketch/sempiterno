export type MemoryCategory = 
  | 'Aniversario' 
  | 'Cena' 
  | 'Viaje' 
  | 'Plan Casero' 
  | 'Concierto/Salida';

export interface Memory {
  id: string;
  title: string;
  date: string; // ISO string YYYY-MM-DD
  category: MemoryCategory;
  photos: string[];
  location: string;
  perspectiveGigio?: string; // Lo que sintió / versión de él (opcional)
  perspectiveRosita?: string; // Lo que sintió / versión de ella (opcional)
  rating: number; // 1 to 5
  songTitle?: string;
  songUrl?: string; // Spotify / YouTube link
  tags?: string[];
  isFavorite?: boolean;
}

export type PlanCategory = 
  | 'Comida & Cafés' 
  | 'Viajes' 
  | 'Planes en Casa' 
  | 'Aventura';

export type PlanStatus = 
  | 'Idea / Antojo' 
  | 'Agendado' 
  | '¡Vivido!';

export type BudgetLevel = '$' | '$$' | '$$$';

export interface Plan {
  id: string;
  title: string;
  description: string;
  category: PlanCategory;
  budget: BudgetLevel;
  status: PlanStatus;
  scheduledDate?: string; // YYYY-MM-DD
  scheduledTime?: string; // HH:mm
  location?: string;
  dressCode?: string;
  surpriseNote?: string;
  tag?: string;
  createdAt: string;
}

export type PlaceCategory = 
  | 'Restaurante' 
  | 'Café' 
  | 'Playa' 
  | 'Parque/Mirador' 
  | 'Bar' 
  | 'Aventura/Paseo';

export type ReturnVerdict = '¡Sí o sí!' | 'Una vez basta' | 'Pendiente de probar';

export interface Place {
  id: string;
  name: string;
  category: PlaceCategory;
  status: 'Visitado' | 'Por conocer';
  zone: string;
  whatWeOrdered?: string; // o qué se recomienda pedir
  review?: string;
  wouldReturn: ReturnVerdict;
  rating?: number; // 1-5
  priceRange: BudgetLevel;
  imageUrl?: string;
  googleMapsUrl?: string;
}

export interface TimeCapsule {
  id: string;
  title: string;
  sender: 'Gigio' | 'Rosita';
  recipient: 'Rosita' | 'Gigio' | 'Ambos';
  unlockDate: string; // ISO datetime
  secretMessage: string;
  photos?: string[];
  hint?: string;
  createdAt: string;
  isCustomOpened?: boolean; // If opened before or after
}

export interface CoupleSettings {
  startDate: string; // e.g. "2026-06-04T00:00:00"
  partner1: {
    name: string;
    nickname: string;
    avatarUrl?: string;
    role: 'Gigio';
  };
  partner2: {
    name: string;
    nickname: string;
    avatarUrl?: string;
    role: 'Rosita';
  };
  currentUser: 'Gigio' | 'Rosita';
  ratingStyle: 'cheese' | 'heart'; // quesitos vs corazones
  darkMode: boolean;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export interface KissesData {
  totalKisses: number;
  gigioKisses: number;
  rositaKisses: number;
  lastSender: 'Gigio' | 'Rosita';
  lastSenderName: string;
  lastKissAt: string;
}
