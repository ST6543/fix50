/**
 * Vaste mapping isolatorneus-uiterlijk → betekenis → actie.
 * Bron: docs/AFSTEL-KENNISBANK.md sectie 7 (NGK, geverifieerd).
 * De plug-photo-Edge-Function gebruikt dit om uit de AI-omschrijving een
 * richtlijn-advies te maken; de AI genoent zelf nooit een afstel-maat.
 */
export interface PlugConditionMeta {
  label: string;
  explanation: string;
  jet_direction: string | null;
  plug_grade_direction: string | null;
}

export const PLUG_CONDITIONS = {
  'koffiebruin-gezond': {
    label: 'Gezond afstel',
    explanation: 'Koffiebruin, droog en egaal: goed mengsel en goede ontsteking.',
    jet_direction: null,
    plug_grade_direction: null,
  },
  'lichtgrijs-as': {
    label: 'Grijs, maar waarschijnlijk normaal',
    explanation:
      'Lichtgrijs of grijze as is bij moderne 2-takt-olie vaak normaal. Alleen checken als de laag dik/verhard is; dan de olie-ratio (of mengverhouding) controleren.',
    jet_direction: null,
    plug_grade_direction: null,
  },
  'te-rijk': {
    label: 'Te rijk',
    explanation: 'Droog zwart roet: te rijk mengsel of zwakke vonk.',
    jet_direction: 'rijker aftoppen; sproeier kleiner',
    plug_grade_direction: null,
  },
  'te-veel-olie': {
    label: 'Te veel olie',
    explanation:
      'Zwart én nat/olieachtig: dit betekent te veel olie (mengverhouding/oliepomp of lekkende krukaskeering), niet alleen een te grote sproeier.',
    jet_direction: null,
    plug_grade_direction: null,
  },
  'te-arm-te-heet': {
    label: 'Te arm / te heet (GEVAAR)',
    explanation:
      'Wit of krijtwit: te arm mengsel of oververhitting. Direct stoppen, valse lucht checken (krukaskeering/vlotterbakflens), sproeier groter en overweeg een graad kouder.',
    jet_direction: 'rijker',
    plug_grade_direction: 'kouder',
  },
  'oververhitting': {
    label: 'Oververhitting / pre-ignition',
    explanation:
      'Gebladderde of gesmolten neus: ernstige oververhitting of pre-ignition. Niet opnieuw starten; cilinder en zuiger inspecteren.',
    jet_direction: 'rijker',
    plug_grade_direction: 'kouder',
  },
  'onduidelijk': {
    label: 'Niet duidelijk te lezen',
    explanation:
      'Neus niet goed te beoordelen. Doe een plug chop met een nieuwe bougie: 30-60 s onder belasting, contact af terwijl je nog rijdt, afkoelen, dan de isolatorneus fotograferen (niet de elektrode).',
    jet_direction: null,
    plug_grade_direction: null,
  },
} satisfies Record<string, PlugConditionMeta>;

export type PlugConditionKey = keyof typeof PLUG_CONDITIONS;

/** Ziekenhuis-testbare orderinginformatie voor de Zod-schema in plug-photo. */
export const PLUG_CONDITION_KEYS = Object.keys(PLUG_CONDITIONS) as [
  PlugConditionKey,
  ...PlugConditionKey[],
];
