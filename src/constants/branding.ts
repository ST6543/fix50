/** Vaste FIX50 constanten — brand, lijsten en limieten. */

export const APP_NAME = 'FIX50';
export const APP_TAGLINE = 'Brommer- en scooterassistent';
export const APP_VERSION = '1.0.0';

/** Geldige bloktypes — gelijk aan de diagnose-database (Excel kolom "Bloktype"). */
export const ENGINE_FAMILIES = [
  'Piaggio',
  'GY6',
  'Vespa',
  'AM6',
  'Derbi',
  'Tomos',
  'Puch',
  'Orion',
  'PureJet',
  'Vespa iGet',
  'Universeel',
] as const;
export type EngineFamily = (typeof ENGINE_FAMILIES)[number];

/** Brandstofsystemen zoals in de diagnose- en onderhoudsdatabase (kolommen 2T/4T/Injectie). */
export const FUEL_SYSTEMS = ['2T', '4T', 'Injectie'] as const;
export type FuelSystem = (typeof FUEL_SYSTEMS)[number];

/** Categorieën uit de diagnose-Excel (voor chips en filters). */
export const DIAGNOSIS_CATEGORIES = [
  'Accu & Elektra',
  'Startsysteem',
  'Ontsteking',
  'Brandstof',
  'Luchtinlaat',
  'CVT',
  'Vermogen',
  'Motor Intern',
  'Versnellingsbak',
  'Remmen',
  'Koeling',
  'Frame',
  'Geluid',
  'ECU',
] as const;

/** Snelle chips in de diagnose-chat (shortcuts, vrije tekst blijft altijd mogelijk). */
export const CHAT_QUICK_ACTIONS = [
  'Start niet',
  'Loopt slecht',
  'Trekt slecht',
  'Wordt heet',
  'Maakt geluid',
  'Elektrisch probleem',
] as const;

/** Invoerlimieten — matig streng, voorkomt onnodige frustratie. */
export const LIMITS = {
  scooterName: 60,
  displayName: 60,
  brand: 40,
  model: 40,
  km: 2_000_000,
  yearMin: 1950,
  yearMax: 2100,
  chatMessage: 2000,
  jetValue: 40,
  rollerWeight: 30,
} as const;
