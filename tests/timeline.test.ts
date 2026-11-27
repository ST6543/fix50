/**
 * De tijdlijn is de enige plek waar alle scootergegevens samenkomen. Deze tests
 * bewaken de volgorde, het samenvoegen van een sproeierwissel en eerlijke
 * teksten bij ontbrekende metingen.
 */
import {
  buildScooterTimeline,
  filterTimeline,
  timelineCounts,
  type TimelineInput,
} from '@/lib/timeline';
import type {
  ChatSession,
  FuelLog,
  MaintenanceItem,
  MaintenanceRecord,
  PerformanceRun,
  TuningChange,
} from '@/types';

const item: MaintenanceItem = {
  id: 'item-bougie',
  name: 'Bougie vervangen',
  category: 'ontsteking',
  interval_km_min: 6000,
  interval_km_max: 8000,
  interval_months_min: null,
  interval_months_max: null,
  applies_2t: true,
  applies_4t: true,
  applies_injectie: true,
  description: null,
  active: true,
};

function record(partial: Partial<MaintenanceRecord> = {}): MaintenanceRecord {
  return {
    id: 'record-1',
    scooter_id: 'scooter-1',
    item_id: 'item-bougie',
    custom_name: null,
    done_at: '2026-11-20T10:00:00.000Z',
    km_at_service: 12400,
    cost_cents: 1250,
    parts: 'NGK BR8ES',
    notes: null,
    created_at: '2026-11-20T10:00:00.000Z',
    ...partial,
  };
}

function fuelLog(partial: Partial<FuelLog> = {}): FuelLog {
  return {
    id: 'fuel-1',
    scooter_id: 'scooter-1',
    filled_at: '2026-11-18T08:00:00.000Z',
    odometer_km: 12200,
    liters: 5.5,
    price_per_liter_cents: null,
    total_cents: 990,
    station: 'Shell',
    notes: null,
    created_at: '2026-11-18T08:00:00.000Z',
    ...partial,
  };
}

function change(partial: Partial<TuningChange> = {}): TuningChange {
  return {
    id: 'change-1',
    scooter_id: 'scooter-1',
    setup_id: null,
    run_id: null,
    group_id: null,
    changed_at: '2026-11-16T12:00:00.000Z',
    km_at_change: 12050,
    part: 'Hoofdsproeier',
    old_value: '94',
    new_value: '96',
    result: 'stationair goed · volgas goed',
    notes: 'top 82 km/u — stationair goed · Volgende stap: bougie lezen',
    created_at: '2026-11-16T12:00:00.000Z',
    ...partial,
  };
}

function run(partial: Partial<PerformanceRun> = {}): PerformanceRun {
  return {
    id: 'run-1',
    scooter_id: 'scooter-1',
    setup_id: null,
    started_at: '2026-11-15T09:00:00.000Z',
    ended_at: '2026-11-15T09:01:00.000Z',
    duration_s: 60,
    distance_m: 900,
    max_speed_kmh: 78.4,
    avg_speed_kmh: 40,
    t0_50_s: 4.2,
    t0_80_s: null,
    t50_80_s: null,
    gps_quality: 'goed',
    points: [],
    notes: null,
    created_at: '2026-11-15T09:00:00.000Z',
    ...partial,
  };
}

function session(partial: Partial<ChatSession> = {}): ChatSession {
  return {
    id: 'session-1',
    user_id: 'user-1',
    scooter_id: 'scooter-1',
    title: 'Scooter valt weg bij volgas',
    created_at: '2026-11-10T09:00:00.000Z',
    updated_at: '2026-11-10T09:00:00.000Z',
    ...partial,
  };
}

const everything: TimelineInput = {
  records: [record()],
  items: [item],
  fuelLogs: [fuelLog()],
  changes: [change()],
  runs: [run()],
  sessions: [session()],
};

describe('buildScooterTimeline', () => {
  it('zet alle vijf de bronnen op één lijn, nieuwste eerst', () => {
    const events = buildScooterTimeline(everything);

    expect(events.map((e) => e.kind)).toEqual([
      'onderhoud',
      'tankbeurt',
      'tuning',
      'meting',
      'diagnose',
    ]);
    expect(events.map((e) => e.kind)).toHaveLength(5);
  });

  it('noemt onderhoud bij de onderdeelnaam en toont km en kosten', () => {
    const [event] = buildScooterTimeline({ records: [record()], items: [item] });

    expect(event!.title).toBe('Bougie vervangen');
    expect(event!.detail).toBe('Onderdelen: NGK BR8ES');
    expect(event!.meta).toEqual(['12.400 km', '€12,50']);
  });

  it('valt terug op de eigen omschrijving en daarna op "Onderhoud"', () => {
    const custom = buildScooterTimeline({
      records: [record({ custom_name: 'Zelf kleppen gesteld' })],
      items: [item],
    });
    const loose = buildScooterTimeline({ records: [record({ item_id: null })] });

    expect(custom[0]!.title).toBe('Zelf kleppen gesteld');
    expect(loose[0]!.title).toBe('Onderhoud');
  });

  it('vat een tankbeurt samen met liters, stand en betaald bedrag', () => {
    const [event] = buildScooterTimeline({ fuelLogs: [fuelLog()] });

    expect(event!.title).toBe('Getankt bij Shell');
    expect(event!.detail).toBe('5,50 L getankt');
    expect(event!.meta).toEqual(['12.200 km', '€9,90']);
  });

  it('laat de prijs weg als die niet is ingevuld', () => {
    const [event] = buildScooterTimeline({
      fuelLogs: [fuelLog({ total_cents: null, station: null })],
    });

    expect(event!.title).toBe('Tankbeurt');
    expect(event!.meta).toEqual(['12.200 km']);
  });

  it('houdt een sproeierwissel met meerdere regels als één moment', () => {
    const events = buildScooterTimeline({
      changes: [
        change({ id: 'change-1', group_id: 'group-1', changed_at: '2026-11-16T12:00:00.000Z' }),
        change({
          id: 'change-2',
          group_id: 'group-1',
          changed_at: '2026-11-16T12:00:00.000Z',
          part: 'Stationairsproeier',
          old_value: '38',
          new_value: '40',
        }),
      ],
    });

    expect(events).toHaveLength(1);
    expect(events[0]!.title).toBe('Hoofdsproeier 94 → 96 +1');
    expect(events[0]!.detail).toBe('top 82 km/u — stationair goed');
    expect(events[0]!.meta).toEqual(['12.050 km']);
  });

  it('noemt een losse sproeierwijziging zonder groeps-id bij onderdeel en waarden', () => {
    const [event] = buildScooterTimeline({ changes: [change({ notes: null, result: null })] });

    expect(event!.title).toBe('Hoofdsproeier 94 → 96');
    expect(event!.detail).toBeNull();
  });

  it('noemt een andere tuningwijziging met een dubbele punt', () => {
    const [event] = buildScooterTimeline({
      changes: [change({ part: 'Uitlaat', old_value: 'standaard', new_value: 'Yasuni R' })],
    });

    expect(event!.title).toBe('Uitlaat: standaard → Yasuni R');
  });

  it('beschrijft een meting met de echte waarden en benoemt wat ontbreekt', () => {
    const measured = buildScooterTimeline({ runs: [run()] })[0]!;
    const partial = buildScooterTimeline({
      runs: [run({ t0_50_s: null, max_speed_kmh: null })],
    })[0]!;

    expect(measured.title).toBe('Meting: 78 km/h top');
    expect(measured.detail).toBe('0–50 4,20 s · top 78 km/h');
    expect(measured.meta).toEqual(['GPS goed']);
    expect(partial.title).toBe('GPS-meting');
    expect(partial.detail).toBe('0–50 niet gemeten · top niet gemeten');
  });

  it('neemt alleen diagnosegesprekken van deze scooter mee', () => {
    const events = buildScooterTimeline({
      scooterId: 'scooter-1',
      sessions: [
        session(),
        session({ id: 'session-2', scooter_id: 'scooter-2', title: 'Andere scooter' }),
        session({ id: 'session-3', scooter_id: null, title: 'Los gesprek' }),
      ],
    });

    expect(events).toHaveLength(1);
    expect(events[0]!.id).toBe('diagnose:session-1');
    expect(events[0]!.title).toBe('Scooter valt weg bij volgas');
  });

  it('houdt zonder scooter-id alle gesprekken die het krijgt', () => {
    const events = buildScooterTimeline({
      sessions: [session(), session({ id: 'session-2', scooter_id: 'scooter-2' })],
    });

    expect(events).toHaveLength(2);
  });

  it('slaat gebeurtenissen met een ongeldige datum over', () => {
    const events = buildScooterTimeline({
      records: [record({ done_at: 'geen datum' })],
      fuelLogs: [fuelLog()],
    });

    expect(events.map((e) => e.kind)).toEqual(['tankbeurt']);
  });

  it('houdt bij hetzelfde moment de vaste bronvolgorde aan', () => {
    const at = '2026-11-20T10:00:00.000Z';
    const events = buildScooterTimeline({
      runs: [run({ started_at: at })],
      records: [record({ done_at: at })],
    });

    expect(events.map((e) => e.kind)).toEqual(['onderhoud', 'meting']);
  });
});

describe('filterTimeline en timelineCounts', () => {
  it('telt per soort en filtert zonder de volgorde te veranderen', () => {
    const events = buildScooterTimeline({
      ...everything,
      changes: [change({ id: 'change-1', group_id: 'g1' }), change({ id: 'change-2', group_id: 'g2' })],
    });

    expect(timelineCounts(events)).toEqual({
      onderhoud: 1,
      tankbeurt: 1,
      tuning: 2,
      meting: 1,
      diagnose: 1,
    });
    expect(filterTimeline(events, 'tuning').map((e) => e.kind)).toEqual(['tuning', 'tuning']);
    expect(filterTimeline(events, 'alles')).toBe(events);
  });
});
