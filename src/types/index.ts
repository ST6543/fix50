/** Centrale domein-types voor FIX50. Spiegelen de Supabase-tabellen. */
import type { EngineFamily } from '@/constants/branding';

export type UUID = string;

export interface Profile {
  id: UUID;
  user_id: UUID;
  display_name: string | null;
  avatar_url: string | null;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Scooter {
  id: UUID;
  user_id: UUID;
  name: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  engine_type: EngineFamily | null;
  engine_code: string | null;
  fuel_system: '2T' | '4T' | 'Injectie' | null;
  license_plate: string | null;
  current_km: number;
  /** Gemiddeld aantal km per week (gebruikersinvoer); null = niet ingesteld. */
  avg_km_per_week: number | null;
  notes: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScooterSetup {
  id: UUID;
  scooter_id: UUID;
  bloktype: string | null;
  cilinder: string | null;
  cilinderinhoud_cc: number | null;
  krukas: string | null;
  carburateur: string | null;
  carburateurmaat_mm: number | null;
  hoofdsproeier: number | null;
  stationairsproeier: number | null;
  naaldpositie: string | null;
  luchtfilter: string | null;
  spruitstuk: string | null;
  membraan: string | null;
  uitlaat: string | null;
  vertanding: string | null;
  variateur: string | null;
  rollen: string | null;
  drukveer: string | null;
  trekveren: string | null;
  koppeling: string | null;
  bougie: string | null;
  ontsteking: string | null;
  brandstof: string | null;
  olie: string | null;
  overig: string | null;
  updated_at: string;
}

export type DiagnosisSeverity = 'info' | 'let op' | 'risico';

export interface DiagnosisEntry {
  id: UUID;
  category: string;
  engine_type: string;
  problem: string;
  symptoms: string;
  causes: string;
  visual_test: string | null;
  measurement_test: string | null;
  road_test: string | null;
  solution: string | null;
  search_text: string;
  severity: DiagnosisSeverity;
  active: boolean;
  source: string;
  created_at: string;
  updated_at: string;
}

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatSession {
  id: UUID;
  user_id: UUID;
  scooter_id: UUID | null;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: UUID;
  chat_session_id: UUID;
  role: ChatRole;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export type MaintenanceStatus = 'gepland' | 'te laat' | 'voltooid' | 'overgeslagen';

export interface MaintenanceItem {
  id: UUID;
  name: string;
  category: string;
  interval_km_min: number | null;
  interval_km_max: number | null;
  interval_months_min: number | null;
  interval_months_max: number | null;
  applies_2t: boolean;
  applies_4t: boolean;
  applies_injectie: boolean;
  description: string | null;
  active: boolean;
}

export interface MaintenanceSchedule {
  id: UUID;
  scooter_id: UUID;
  item_id: UUID;
  interval_km: number | null;
  interval_months: number | null;
  enabled: boolean;
  last_done_km: number | null;
  last_done_at: string | null;
  next_due_km: number | null;
  next_due_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceRecord {
  id: UUID;
  scooter_id: UUID;
  item_id: UUID | null;
  custom_name: string | null;
  done_at: string;
  km_at_service: number | null;
  /** Totale kosten in centen (1250 = €12,50); null = niet ingevuld. */
  cost_cents: number | null;
  /** Gebruikte onderdelen als vrije tekst. */
  parts: string | null;
  notes: string | null;
  created_at: string;
}

/** Tankbeurt — bron voor verbruiksberekening (L/100km). */
export interface FuelLog {
  id: UUID;
  scooter_id: UUID;
  filled_at: string;
  odometer_km: number;
  liters: number;
  /** Prijs per liter in centen; optioneel. */
  price_per_liter_cents: number | null;
  /** Totaalbetaald in centen; optioneel. */
  total_cents: number | null;
  station: string | null;
  notes: string | null;
  created_at: string;
}

export type ReminderSeverity = 'info' | 'reminder' | 'warning';

export interface MaintenanceReminder {
  id: UUID;
  scooter_id: UUID;
  schedule_id: UUID | null;
  severity: ReminderSeverity;
  title: string;
  body: string;
  due_km: number | null;
  due_at: string | null;
  status: 'open' | 'afgerond' | 'genegeerd';
  created_at: string;
  updated_at: string;
}

export interface TuningSetup {
  id: UUID;
  scooter_id: UUID;
  name: string;
  parts: Record<string, string | number | null>;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TuningChange {
  id: UUID;
  scooter_id: UUID;
  setup_id: UUID | null;
  changed_at: string;
  km_at_change: number | null;
  part: string;
  old_value: string | null;
  new_value: string | null;
  result: string | null;
  notes: string | null;
  created_at: string;
}

export interface PerformancePoint {
  t_ms: number;
  speed_kmh: number;
  lat: number | null;
  lon: number | null;
  accuracy_m: number | null;
}

export interface PerformanceRun {
  id: UUID;
  scooter_id: UUID | null;
  setup_id: UUID | null;
  started_at: string;
  ended_at: string | null;
  duration_s: number | null;
  distance_m: number | null;
  max_speed_kmh: number | null;
  avg_speed_kmh: number | null;
  t0_50_s: number | null;
  t0_80_s: number | null;
  t50_80_s: number | null;
  gps_quality: 'goed' | 'matig' | 'slecht';
  points: PerformancePoint[];
  notes: string | null;
  created_at: string;
}

export type NotificationType =
  | 'maintenance'
  | 'diagnosis'
  | 'warning'
  | 'performance'
  | 'general';

export interface AppNotification {
  id: UUID;
  user_id: UUID;
  scooter_id: UUID | null;
  type: NotificationType;
  title: string;
  body: string;
  scheduled_for: string | null;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
}

export interface UserSettings {
  user_id: UUID;
  push_enabled: boolean;
  maintenance_notifications: boolean;
  reminder_days_ahead: number;
  reminder_km_before: number;
  weekly_overview: boolean;
  /** Kill switch uit het AI-plan: "AI meekijken" aan/uit. */
  ai_watch_enabled: boolean;
  language: string;
  units: string;
  theme: 'dark' | 'light';
  updated_at: string;
}

/** Status van een onderhoudstaak binnen een weekoverzicht. */
export interface WeekTask {
  schedule: MaintenanceSchedule;
  item: MaintenanceItem;
  dueLabel: string;
  overdue: boolean;
  dueThisWeek: boolean;
}
