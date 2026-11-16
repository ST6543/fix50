/**
 * Vertandingsrekenwerk — exacte verhoudingen en toerentallen, geen vermogensclaims.
 *
 * Alles hier is rekenkundig: verhoudingen, relatieve verschillen en
 * theoretische snelheden bij een gekozen toerental. Of de motor dat toerental
 * ook echt haalt, hangt af van cilinder, uitlaat en afstelling — dat zegt dit
 * model niet.
 */

export type GearingGoal = 'trek' | 'top' | 'trekBehoudTop' | 'allround';

export const GEARING_GOAL_LABELS: Record<GearingGoal, string> = {
  trek: 'A · Sneller optrekken',
  top: 'B · Meer topsnelheid',
  trekBehoudTop: 'C · Sneller optrekken met behoud van top',
  allround: 'D · Beste allround combinatie',
};

export const GEARING_GOAL_SHORT: Record<GearingGoal, string> = {
  trek: 'Optrekken',
  top: 'Top',
  trekBehoudTop: 'Optrekken + top',
  allround: 'Allround',
};

/** Tandwielbereik zoals de simulator het aanbiedt. */
export const FRONT_RANGE = { min: 10, max: 16 } as const;
export const REAR_RANGE = { min: 40, max: 60 } as const;

/** Eindoverbrengingsverhouding R = achter / voor. */
export function finalDriveRatio(front: number, rear: number): number {
  if (front <= 0 || rear <= 0) return 0;
  return rear / front;
}

/** Relatief verschil in wielkoppel bij gelijk motorkoppel: (Rnieuw/Roud − 1) × 100. */
export function torqueDeltaPct(oldRatio: number, newRatio: number): number {
  if (oldRatio <= 0) return 0;
  return (newRatio / oldRatio - 1) * 100;
}

/** Relatief verschil in snelheid bij gelijk toerental: (Roud/Rnieuw − 1) × 100. */
export function speedDeltaPct(oldRatio: number, newRatio: number): number {
  if (newRatio <= 0) return 0;
  return (oldRatio / newRatio - 1) * 100;
}

/** Benodigd toerental voor dezelfde snelheid: RPMnieuw = RPMoud × (Rnieuw/Roud). */
export function rpmForSameSpeed(oldRpm: number, oldRatio: number, newRatio: number): number {
  if (oldRatio <= 0) return 0;
  return oldRpm * (newRatio / oldRatio);
}

/** Totale overbrenging: primair × versnelling × eindoverbrenging. */
export function totalRatio(primaryRatio: number | null, gearRatio: number, finalRatio: number): number | null {
  if (primaryRatio === null || primaryRatio <= 0) return null;
  return primaryRatio * gearRatio * finalRatio;
}

/** Theoretische snelheid (km/u) bij toerental, totale overbrenging en wielomtrek in meter. */
export function speedKmh(rpm: number, total: number, wheelCircumferenceM: number): number {
  if (total <= 0 || wheelCircumferenceM <= 0) return 0;
  const wheelRpm = rpm / total;
  return (wheelRpm * wheelCircumferenceM * 60) / 1000;
}

/** Theoretisch toerental (rpm) bij een snelheid. */
export function rpmAtSpeed(speed: number, total: number, wheelCircumferenceM: number): number {
  if (wheelCircumferenceM <= 0 || total <= 0) return 0;
  return (speed * 1000 * total) / (wheelCircumferenceM * 60);
}

export interface GearboxRatio {
  gear: number;
  ratio: number;
}

export interface GearSpeedRow {
  gear: number;
  gearRatio: number;
  total: number;
  speed: number;
}

/**
 * Snelheid per versnelling bij één toerental.
 * Zonder primaire verhouding is de uitkomst null: dan is alleen de
 * versnellingsbakverhouding bekend en is een snelheid niet te berekenen.
 */
export function speedPerGear(args: {
  rpm: number;
  front: number;
  rear: number;
  primaryRatio: number | null;
  gears: GearboxRatio[];
  wheelCircumferenceM: number;
}): GearSpeedRow[] {
  const final = finalDriveRatio(args.front, args.rear);
  return args.gears.map((g) => {
    const total = totalRatio(args.primaryRatio, g.ratio, final) ?? 0;
    return {
      gear: g.gear,
      gearRatio: g.ratio,
      total,
      speed: total > 0 ? speedKmh(args.rpm, total, args.wheelCircumferenceM) : 0,
    };
  });
}

export interface GearingState {
  front: number;
  rear: number;
  ratio: number;
  /** Verschil in verhouding t.o.v. de referentie, in %. */
  ratioDeltaPct: number;
  /** Relatief verschil in wielkoppel bij gelijk motorkoppel. */
  torquePct: number;
  /** Relatief verschil in snelheid bij gelijk toerental. */
  speedPct: number;
  /** Benodigd toerental om de referentiesnelheid te houden (null zonder referentietoerental). */
  requiredRpm: number | null;
}

export function compareGearing(args: {
  baseFront: number;
  baseRear: number;
  front: number;
  rear: number;
  baseRpm?: number | null;
}): GearingState {
  const baseRatio = finalDriveRatio(args.baseFront, args.baseRear);
  const ratio = finalDriveRatio(args.front, args.rear);
  const requiredRpm =
    args.baseRpm && args.baseRpm > 0 && baseRatio > 0 ? rpmForSameSpeed(args.baseRpm, baseRatio, ratio) : null;
  return {
    front: args.front,
    rear: args.rear,
    ratio,
    ratioDeltaPct: baseRatio > 0 ? ((ratio - baseRatio) / baseRatio) * 100 : 0,
    torquePct: torqueDeltaPct(baseRatio, ratio),
    speedPct: speedDeltaPct(baseRatio, ratio),
    requiredRpm,
  };
}

export interface GearCandidate extends GearingState {
  /** Hoogst haalbare snelheid bij het opgegeven toerentalplafond. */
  topSpeedKmh: number | null;
  /** Is de referentiesnelheid haalbaar binnen het toerentalplafond? */
  keepsTopSpeed: boolean | null;
  /** Waarschuwing als de combinatie buiten de gekozen gebruiksgrenzen valt. */
  warning: string | null;
  /** Betrouwbaarheid van dit advies: puur rekenkundig, geen vermogensclaim. */
  reliability: 'hoog' | 'gemiddeld' | 'laag';
}

export interface GearingRecommendation {
  kind: 'accel' | 'balans' | 'top';
  title: string;
  front: number;
  rear: number;
  ratio: number;
  ratioDeltaPct: number;
  torquePct: number;
  speedPct: number;
  requiredRpm: number | null;
  topSpeedKmh: number | null;
  keepsTopSpeed: boolean | null;
  pros: string;
  cons: string;
  compatibility: string;
  reliability: 'hoog' | 'gemiddeld' | 'laag';
}

export interface GearingSearchInput {
  front: number;
  rear: number;
  measuredTopSpeedKmh: number | null;
  measuredTopRpm: number | null;
  maxRpm: number;
  minTopSpeedKmh: number | null;
  goal: GearingGoal;
  usage: 'dagelijks' | 'sportief';
  wheelCircumferenceM: number;
  primaryRatio: number | null;
  gears: GearboxRatio[];
}

export interface GearingSearchResult {
  candidates: GearCandidate[];
  recommendations: GearingRecommendation[];
  /** True als er zonder meting geen verantwoord advies te geven is. */
  needsMeasurement: boolean;
  /** Uitleg waarom er geen (of minder) advies is. */
  explanation: string | null;
  /** De aanbeveling die als eerste getest zou moeten worden. */
  bestFirst: GearingRecommendation | null;
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const fmt = (v: number) => String(round1(v)).replace('.', ',');

function torqueCap(usage: 'dagelijks' | 'sportief'): number {
  return usage === 'sportief' ? 18 : 12;
}

function reliabilityFor(torquePct: number): 'hoog' | 'gemiddeld' | 'laag' {
  const abs = Math.abs(torquePct);
  if (abs <= 8) return 'hoog';
  if (abs <= 15) return 'gemiddeld';
  return 'laag';
}

function candidateWarning(c: GearCandidate, cap: number): string | null {
  if (c.torquePct > cap) {
    return `Meer dan ${cap}% korter dan nu: de motor kan zijn toeren niet meer kwijt en de ketting/achtertandwiel slijten sneller.`;
  }
  if (c.torquePct < -12) {
    return 'Meer dan 12% langer: het blok komt mogelijk niet meer op zijn powerband.';
  }
  if (c.keepsTopSpeed === false) {
    return 'De oude topsnelheid is met dit toerentalplafond niet meer haalbaar.';
  }
  return null;
}

/**
 * Zoekt alle tandwielcombinaties binnen het bereik en rangschikt ze naar doel.
 *
 * Zonder gemeten topsnelheid én toerental bij die snelheid is er geen
 * verantwoorde snelheids- of toerentalvoorspelling: dan komen er geen
 * aanbevelingen, alleen de vraag om te meten.
 */
export function findOptimalGearing(input: GearingSearchInput): GearingSearchResult {
  const baseRatio = finalDriveRatio(input.front, input.rear);
  const hasMeasurement =
    typeof input.measuredTopSpeedKmh === 'number' &&
    input.measuredTopSpeedKmh > 0 &&
    typeof input.measuredTopRpm === 'number' &&
    input.measuredTopRpm > 0;

  const candidates: GearCandidate[] = [];
  for (let front = FRONT_RANGE.min; front <= FRONT_RANGE.max; front += 1) {
    for (let rear = REAR_RANGE.min; rear <= REAR_RANGE.max; rear += 1) {
      if (front === input.front && rear === input.rear) continue;
      const state = compareGearing({
        baseFront: input.front,
        baseRear: input.rear,
        front,
        rear,
        baseRpm: hasMeasurement ? input.measuredTopRpm : null,
      });
      // Bij vaste vertanding schaalt de snelheid lineair met het toerental:
      // haal je de oude top bij requiredRpm, dan is de top bij maxRpm evenredig hoger.
      const topSpeedKmh =
        hasMeasurement && state.requiredRpm && state.requiredRpm > 0
          ? round1((input.measuredTopSpeedKmh as number) * (input.maxRpm / state.requiredRpm))
          : null;
      const keepsTopSpeed = state.requiredRpm !== null ? state.requiredRpm <= input.maxRpm : null;
      const candidate: GearCandidate = {
        ...state,
        topSpeedKmh,
        keepsTopSpeed,
        warning: null,
        reliability: reliabilityFor(state.torquePct),
      };
      candidate.warning = candidateWarning(candidate, torqueCap(input.usage));
      candidates.push(candidate);
    }
  }

  if (!hasMeasurement) {
    return {
      candidates: [],
      recommendations: [],
      needsMeasurement: true,
      explanation:
        'Vul je gemeten topsnelheid én het toerental bij die snelheid in (GPS-rit of toerenteller). Zonder die twee getallen is elke snelheidsvoorspelling verzonnen: alleen de verhouding en het relatieve koppelverschil zijn dan te berekenen.',
      bestFirst: null,
    };
  }

  const measuredTop = input.measuredTopSpeedKmh as number;
  const cap = torqueCap(input.usage);
  const minTop = input.minTopSpeedKmh ?? 0;

  const withinMinTop = (c: GearCandidate) => (c.topSpeedKmh ?? 0) >= minTop;

  // A · optrekken: zoveel mogelijk koppelwinst binnen de gebruiksgrens.
  const accelPool = candidates
    .filter((c) => c.torquePct > 0 && withinMinTop(c))
    .sort((a, b) => b.torquePct - a.torquePct);
  const accelCapped = accelPool.filter((c) => c.torquePct <= cap);
  const accel = (accelCapped[0] ?? accelPool[0]) ?? null;

  // B · top: zo lang mogelijk, met een grens op koppelverlies.
  const topPool = candidates
    .filter((c) => c.torquePct < 0 && withinMinTop(c) && c.torquePct >= -12)
    .sort((a, b) => (b.topSpeedKmh ?? 0) - (a.topSpeedKmh ?? 0));
  const top = topPool[0] ?? null;

  // C · optrekken met behoud van top: alleen combinaties die de oude top halen.
  const keepPool = candidates
    .filter((c) => c.torquePct > 0 && c.keepsTopSpeed === true && withinMinTop(c))
    .sort((a, b) => b.torquePct - a.torquePct);
  // D · allround: koppelwinst met behoud van top, zo dicht mogelijk bij +5%.
  // Valt de top niet te behouden, dan alleen bij een allround-doel een
  // combinatie tonen die top inlevert — nooit bij "behoud van top".
  const balancePool =
    keepPool.length > 0
      ? keepPool
      : input.goal === 'trekBehoudTop'
        ? []
        : candidates.filter((c) => c.torquePct > 0 && withinMinTop(c));
  const balance = balancePool.slice().sort((a, b) => Math.abs(a.torquePct - 5) - Math.abs(b.torquePct - 5))[0] ?? null;

  const toRec = (c: GearCandidate, kind: 'accel' | 'balans' | 'top'): GearingRecommendation => {
    const keeps = c.keepsTopSpeed;
    const pros =
      c.torquePct > 0
        ? `${fmt(c.torquePct)}% meer wielkoppel bij gelijk motorkoppel; hij pakt dus makkelijker op.`
        : `${fmt(Math.abs(c.torquePct))}% minder wielkoppel, maar bij gelijk toerental ${fmt(Math.abs(c.speedPct))}% meer snelheid.`;
    const cons =
      c.warning ??
      (keeps === false
        ? 'De oude topsnelheid valt buiten je toerentalplafond.'
        : `Bij gelijk toerental ${fmt(Math.abs(c.speedPct))}% ${c.speedPct < 0 ? 'minder' : 'meer'} snelheid.`);
    return {
      kind,
      title:
        kind === 'accel'
          ? 'Beste acceleratiegerichte combinatie'
          : kind === 'balans'
            ? 'Beste balans tussen optrekken en top'
            : 'Beste combinatie voor topsnelheid',
      front: c.front,
      rear: c.rear,
      ratio: c.ratio,
      ratioDeltaPct: c.ratioDeltaPct,
      torquePct: c.torquePct,
      speedPct: c.speedPct,
      requiredRpm: c.requiredRpm,
      topSpeedKmh: c.topSpeedKmh,
      keepsTopSpeed: keeps,
      pros,
      cons,
      compatibility: `${c.front} tanden voor en ${c.rear} achter valt binnen het gangbare bereik (${FRONT_RANGE.min}–${FRONT_RANGE.max} / ${REAR_RANGE.min}–${REAR_RANGE.max}). Controleer kettinglengte en of het tandwiel op jouw naaf past.`,
      reliability: c.reliability,
    };
  };

  const recommendations: GearingRecommendation[] = [];
  if (accel) recommendations.push(toRec(accel, 'accel'));
  if (balance) recommendations.push(toRec(balance, 'balans'));
  if (top) recommendations.push(toRec(top, 'top'));

  const bestKind: 'accel' | 'balans' | 'top' =
    input.goal === 'trek' ? 'accel' : input.goal === 'top' ? 'top' : 'balans';
  const ordered = [...recommendations].sort((a, b) => (a.kind === bestKind ? -1 : b.kind === bestKind ? 1 : 0));

  let explanation: string | null = null;
  if (input.goal === 'trekBehoudTop' && keepPool.length === 0) {
    explanation = `Geen enkele combinatie binnen ${FRONT_RANGE.min}–${FRONT_RANGE.max} / ${REAR_RANGE.min}–${REAR_RANGE.max} haalt je oude top van ${fmt(measuredTop)} km/u binnen ${input.maxRpm.toLocaleString('nl-NL')} rpm én geeft meer wielkoppel. Korter vertanden vraagt meer toeren voor dezelfde snelheid; dat kan deze motor met deze grens niet leveren. Eerst winst halen uit cilinder, uitlaat of afstelling is dan de eerlijke route — of je accepteert een lagere top.`;
  }

  return {
    candidates,
    recommendations: ordered,
    needsMeasurement: false,
    explanation,
    bestFirst: ordered[0] ?? null,
  };
}
