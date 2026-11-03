/**
 * Blokken-kennisbank voor de diagnose-chat (_shared).
 * Leest de dataset uit src/data/engineBlocks.ts — één bron van waarheid met de app.
 * Pure TypeScript (geen Deno-globals), dus dezelfde code is te testen met jest.
 *
 * De AI krijgt dit PROFIEL alleen als het blok betrouwbaar is herkend; hij blijft
 * de redeneerlaag: het profiel is aangeleverde FIX50-data, de diagnoserecords
 * blijven de bron van waarheid.
 */
import { ENGINE_BLOCKS, findBlockFromText, type EngineBlock } from '../../../src/data/engineBlocks.ts';

/** Minimale scooter-shape zoals _shared context.ts aanlevert. */
export interface BlockContextScooter {
  engine_type: string | null;
  brand?: string | null;
  model?: string | null;
  setup?: Record<string, unknown> | null;
}

const KNOWN_BLOCK_IDS = new Set(ENGINE_BLOCKS.map((b) => b.id));

/**
 * Kiest het blok-profiel bij een scooter.
 * Volgorde: setup.bloktype (expliciet in de app gekozen) → engine_type →
 * → merk+model-tekst. Alleen een echte herkenning levert een profiel op.
 */
export function pickEngineBlock(scooter: BlockContextScooter | null | undefined): EngineBlock | null {
  if (!scooter) return null;

  const setupBlok = scooter.setup?.bloktype;
  if (typeof setupBlok === 'string') {
    const direct = ENGINE_BLOCKS.find((b) => b.id === setupBlok || b.label === setupBlok);
    if (direct) return direct;
  }

  const candidates: string[] = [];
  if (scooter.engine_type) candidates.push(scooter.engine_type);
  if (scooter.brand || scooter.model) candidates.push([scooter.brand, scooter.model].filter(Boolean).join(' '));

  for (const text of candidates) {
    const hit = findBlockFromText(text);
    if (hit) return hit;
  }
  return null;
}

function fmtRange([from, to]: [number, number]): string {
  return `${from}-${to} rpm`;
}

/** Bouwt de compacte prompt-sectie voor één blok-profiel. */
export function formatBlockForPrompt(block: EngineBlock): string {
  const transmission =
    block.transmission === 'schakel'
      ? 'SCHAKELBAK (5/6 versnellingen) — GEEN variator/rollen: powerband aansturen via vertanding (kettingtandwiel voor/achter)'
      : 'vario (CVT) — Experten via variator/rollen en drukveer';

  const lines: string[] = [
    `Blok: ${block.label} (id ${block.id}, familie ${block.family})`,
    `Bouw: ${block.orientation} · koeling ${block.koeling} · rietklep ${block.reed}`,
    `Aandrijving: ${transmission}`,
    `Standaard carburateurmaten: ${block.stockCarbMm.join(', ')} mm`,
    `Richtlijn powerband (standaard 50cc, ontgrensd): ${fmtRange(block.stockPowerband)}`,
    `Bougiefamilie: ${block.plugCode} ('x' = hittegraad, hogere graad = kouder bij opvoer)`,
  ];

  if (block.restrictors.length > 0) lines.push(`Fabrieksbegrenzingen: ${block.restrictors.join(' · ')}`);
  if (block.kits.length > 0)
    lines.push(`Opvoerstages: ${block.kits.map((k) => `${k.cc}cc - ${k.note}`).join(' · ')}`);
  if (block.pitfalls.length > 0)
    lines.push(`Bekende valkuilen: ${block.pitfalls.map((p) => `[${p}]`).join(' ')}`);
  if (block.note) lines.push(`Kennisbank-notitie: ${block.note}`);

  return lines.join('\n');
}

/**
 * Volledige blokken-sectie voor de systeemprompt, of null als het blok niet
 * betrouwbaar herkend is (dan krijg de AI gewoon geen profiel).
 */
export function buildBlockContext(scooter: BlockContextScooter | null | undefined): string | null {
  const block = pickEngineBlock(scooter);
  if (!block) return null;
  return formatBlockForPrompt(block);
}

export { KNOWN_BLOCK_IDS };
