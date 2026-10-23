/**
 * Parser voor "Diagonose Fix50.xlsx".
 * De Excel is de bron van waarheid: inhoud wordt niet herschreven,
 * alleen genormaliseerd voor opslag (whitespace, lege cellen).
 */
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

export interface DiagnosisRow {
  category: string;
  engine_type: string;
  problem: string;
  symptoms: string;
  causes: string;
  visual_test: string | null;
  measurement_test: string | null;
  road_test: string | null;
  solution: string | null;
  keywords: string[];
  search_text: string;
  severity: 'info' | 'let op' | 'risico';
  content_hash: string;
  source: string;
}

export interface MaintenanceRow {
  name: string;
  category: string;
  interval_km_min: number | null;
  interval_km_max: number | null;
  interval_months_min: number | null;
  interval_months_max: number | null;
  applies_2t: boolean;
  applies_4t: boolean;
  applies_injectie: boolean;
  source: string;
}

const EXCEL_PATH = path.join(__dirname, '..', 'data', 'Diagonose Fix50.xlsx');
const SOURCE_NAME = 'Diagonose Fix50.xlsx';

/** Keywords die tijdens zoeken helpen maar de inhoud niet veranderen. */
const KEYWORD_SYNONYMS: Record<string, string[]> = {
  verzuipt: ['bougie nat', 'te rijk mengsel', 'te veel brandstof', 'verkeerde afstelling'],
  stottert: ['stotteren', 'houdt in', 'inhoud'],
  'loopt slecht': ['onregelmatig', 'stationair', 'houdt in'],
  'trekt slecht': ['slecht optrekken', 'vermogensverlies', 'traag optrekken'],
  heet: ['oververhitting', 'temperatuur'],
  'start niet': ['geen vonk', 'geen brandstof', 'startmotor', 'compressie'],
  'slaat af': ['valt uit', 'valt meteen uit'],
  tikt: ['tikkend geluid', 'tik', 'kleppen'],
  ratelt: ['ratelend geluid'],
  giert: ['gierend geluid'],
};

/** Afgeleide keywords: woorden uit de eigen probleem/symptoomtekst + synoniemenmap. */
function deriveKeywords(row: {
  problem: string;
  symptoms: string;
  causes: string;
  category: string;
}): string[] {
  const words = `${row.problem} ${row.symptoms} ${row.causes}`.toLowerCase();
  const tokens = words
    .split(/[^a-zà-ÿ0-9]+/)
    .filter((w) => w.length >= 4 && w.length <= 20);
  const uniq = Array.from(new Set(tokens)).slice(0, 12);

  const extra: string[] = [];
  for (const [key, synonyms] of Object.entries(KEYWORD_SYNONYMS)) {
    const haystack = `${row.problem} ${row.symptoms} ${row.causes}`.toLowerCase();
    if (haystack.includes(key)) extra.push(key, ...synonyms);
  }
  if (row.category === 'ECU' || row.category === 'Brandstof') extra.push('injectie', 'sensor');

  return Array.from(new Set([...uniq, ...extra.map((s) => s.toLowerCase())])).slice(0, 24);
}

/** Grofe severity-inschatting uitsluitend uit de eigen inhoud (geen nieuwe feiten). */
function deriveSeverity(row: { causes: string; problem: string }): 'info' | 'let op' | 'risico' {
  const text = `${row.problem} ${row.causes}`.toLowerCase();
  if (/(inslag|kortsluit|brand|schade|oververhit|lek(?!t)|verbrand|smelt)/.test(text)) return 'risico';
  if (/(versleten|verstopt|defect|slijtage|lekstroom|oud)/.test(text)) return 'let op';
  return 'info';
}

export function stableHash(parts: (string | null | undefined)[]): string {
  const normalized = parts.map((p) => (p ?? '').toLowerCase().replace(/\s+/g, ' ').trim());
  return crypto.createHash('sha256').update(normalized.join('|'), 'utf8').digest('hex');
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function nullable(value: unknown): string | null {
  const v = cell(value);
  if (!v || v.toLowerCase() === 'geen') return null;
  return v;
}

/** "2000–4000" / "10000" / "—" / "1 jaar" → {min,max}. */
function parseRange(raw: unknown): { min: number | null; max: number | null } {
  const s = cell(raw).replace(',', '.');
  if (!s || s === '—' || s === '-') return { min: null, max: null };
  const nums = s.match(/\d+(\.\d+)?/g);
  if (!nums || nums.length === 0) return { min: null, max: null };
  const parsed = nums.map(Number);
  if (parsed.length === 1) return { min: parsed[0]!, max: parsed[0]! };
  return { min: parsed[0]!, max: parsed[parsed.length - 1]! };
}

/** "6 maanden"/"2 jaar"/"1–2 jaar" → maanden (bovengrens als max). */
function parseTimeMonths(raw: unknown): { min: number | null; max: number | null } {
  const s = cell(raw).toLowerCase();
  if (!s || s === '—' || s === '-') return { min: null, max: null };
  const { min, max } = parseRange(s);
  const factor = s.includes('jaar') ? 12 : 1;
  const scale = (n: number | null) => (n === null ? null : Math.round(n * factor));
  return { min: scale(min), max: scale(max) };
}

function bool(v: unknown): boolean {
  const s = cell(v).toLowerCase();
  return s === '✔️' || s === '✔' || s === 'v' || s === 'x' || s === 'ja' || s === 'true' || s === '1';
}

export function loadWorkbookBuffer(): Buffer {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(
      `Excel-bestand niet gevonden: ${EXCEL_PATH}. Zet "Diagonose Fix50.xlsx" in scripts/data/.`,
    );
  }
  return fs.readFileSync(EXCEL_PATH);
}

export function parseDiagnosisRows(buffer: Buffer = loadWorkbookBuffer()): DiagnosisRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets['Diagnose'];
  if (!sheet) throw new Error('Sheet "Diagnose" niet gevonden in de Excel.');

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
  const out: DiagnosisRow[] = [];
  let currentCategory = '';

  for (const raw of rows) {
    const cells = raw ?? [];
    const c0 = cell(cells[0]);
    const c1 = cell(cells[1]);

    // Header-rijen herkennen en overslaan; categorie carry-forward voor lege eerste kolom.
    if (c0 === 'Categorie') continue;
    if (!c0 && !c1 && cell(cells[2]) === '') continue;
    if (c0 && !c1 && !cell(cells[2])) {
      currentCategory = c0;
      continue;
    }

    const category = c0 || currentCategory;
    const problem = cell(cells[2]) || c1;
    const engineType = (c1 || 'Universeel').replace(/\s+/g, ' ').trim();
    if (!problem || !c1) continue;

    const symptoms = cell(cells[3]);
    const causes = cell(cells[4]);
    const row: DiagnosisRow = {
      category,
      engine_type: engineType,
      problem,
      symptoms,
      causes,
      visual_test: nullable(cells[5]),
      measurement_test: nullable(cells[6]),
      road_test: nullable(cells[7]),
      solution: nullable(cells[8]),
      keywords: deriveKeywords({ problem, symptoms, causes, category }),
      search_text: [problem, symptoms, causes, category, engineType].join(' ').toLowerCase(),
      severity: deriveSeverity({ causes, problem }),
      content_hash: stableHash([category, engineType, problem, symptoms]),
      source: SOURCE_NAME,
    };
    out.push(row);
  }
  return out;
}

export function parseMaintenanceRows(buffer: Buffer = loadWorkbookBuffer()): MaintenanceRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets['Onderhoud'];
  if (!sheet) throw new Error('Sheet "Onderhoud" niet gevonden in de Excel.');

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
  const out: MaintenanceRow[] = [];

  for (const raw of rows) {
    const cells = raw ?? [];
    const name = cell(cells[0]);
    if (!name || name === 'Onderdeel') continue;

    const km = parseRange(cells[1]);
    const months = parseTimeMonths(cells[2]);
    const cleanName = name
      .replace(/\s*\(4T\)\s*$/, '')
      .replace('Throttle body reinigen', 'Throttle body reinigen');

    out.push({
      name,
      category: cleanName.includes('Rem')
        ? 'Remmen'
        : cleanName.includes('Koel')
          ? 'Koeling'
          : cleanName.includes('Carburateur') || cleanName.includes('Throttle')
            ? 'Brandstof'
            : cleanName.includes('Luchtfilter')
              ? 'Lucht'
              : cleanName.includes('Zuiger') || cleanName.includes('Krukas') || cleanName.includes('Keerring')
                ? 'Motor intern'
                : cleanName.includes('Koppeling') || cleanName.includes('Rollen') || cleanName.includes('snaar')
                  ? 'Aandrijving'
                  : 'Algemeen',
      interval_km_min: km.min,
      interval_km_max: km.max,
      interval_months_min: months.min,
      interval_months_max: months.max,
      applies_2t: bool(cells[3]),
      applies_4t: bool(cells[4]),
      applies_injectie: bool(cells[5]),
      source: SOURCE_NAME,
    });
  }
  return out;
}
