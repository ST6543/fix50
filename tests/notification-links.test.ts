/**
 * Melding → taak en km → lokale herinnering. Beide koppelingen zijn puur, dus
 * we testen ze zonder notificatiemodule of navigator.
 */
import {
  DEFAULT_REMINDER_KM,
  localReminderCandidates,
  resolveMaintenanceTarget,
  resolveNotificationTarget,
} from '@/lib/notification-links';
import type { MaintenanceItem, MaintenanceSchedule } from '@/types';

const bougie: MaintenanceItem = {
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

const olie: MaintenanceItem = {
  ...bougie,
  id: 'item-olie',
  name: 'Oliewissel',
  category: 'motor',
  interval_km_min: 3000,
  interval_km_max: 3000,
  interval_months_min: 12,
  interval_months_max: 12,
};

const datumTaak: MaintenanceItem = {
  ...bougie,
  id: 'item-rem',
  name: 'Remblokken controleren',
  interval_km_min: null,
  interval_km_max: null,
  interval_months_min: 6,
  interval_months_max: 6,
};

function schedule(
  id: string,
  item_id: string,
  partial: Partial<MaintenanceSchedule> = {},
): MaintenanceSchedule {
  return {
    id,
    scooter_id: 'scooter-1',
    item_id,
    interval_km: 6000,
    interval_months: null,
    enabled: true,
    last_done_km: null,
    last_done_at: null,
    next_due_km: null,
    next_due_at: null,
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

/** Bougie bij 14.000 km; olie is al over het interval (12.000 km). */
const schedules = [
  schedule('s-bougie', bougie.id, { next_due_km: 14000, last_done_km: 8000 }),
  schedule('s-olie', olie.id, { next_due_km: 12000, last_done_km: 9000, interval_km: 3000 }),
];

const base = {
  schedules,
  items: [bougie, olie],
  currentKm: 12400,
  fuelSystem: '2T',
};

describe('resolveMaintenanceTarget', () => {
  it('opent de taak die in de meldingstekst staat', () => {
    expect(
      resolveMaintenanceTarget({
        ...base,
        notification: {
          type: 'maintenance',
          title: 'Bougie vervangen komt eraan',
          body: 'Nog 1.600 km tot je volgende beurt.',
        },
      }),
    ).toEqual({ screen: 'MaintenanceDetail', scheduleId: 's-bougie' });
  });

  it('valt bij een algemene onderhoudsmelding terug op de meest urgente taak', () => {
    expect(
      resolveMaintenanceTarget({
        ...base,
        notification: {
          type: 'maintenance',
          title: '2 onderhoudstaken te laat',
          body: 'Plan ze zo snel mogelijk in.',
        },
      }),
    ).toEqual({ screen: 'MaintenanceDetail', scheduleId: 's-olie' });
  });

  it('koppelt geen niet-onderhoudsmelding zonder taaknaam aan een taak', () => {
    expect(
      resolveMaintenanceTarget({
        ...base,
        notification: { type: 'warning', title: 'Verbruik verslechterd', body: 'Je rijdt onzuiniger.' },
      }),
    ).toBeNull();
  });

  it('geeft null zonder planning', () => {
    expect(
      resolveMaintenanceTarget({
        ...base,
        schedules: [],
        notification: { type: 'maintenance', title: 'Onderhoud te laat', body: '' },
      }),
    ).toBeNull();
  });
});

describe('resolveNotificationTarget', () => {
  it('houdt onderhoud bij de taak', () => {
    expect(
      resolveNotificationTarget({
        ...base,
        notification: {
          type: 'maintenance',
          title: 'Oliewissel komt eraan',
          body: 'Nog 100 km tot je volgende beurt.',
        },
      }),
    ).toEqual({ screen: 'MaintenanceDetail', scheduleId: 's-olie' });
  });

  it('opent bij een verbruiksmelding het tankboek', () => {
    expect(
      resolveNotificationTarget({
        ...base,
        notification: { type: 'warning', title: 'Verbruik verslechterd', body: 'Je rijdt onzuiniger.' },
      }),
    ).toEqual({ screen: 'Garage', segment: 'tankbeurten' });
  });

  it('opent bij een prestatiemelding de metingen', () => {
    expect(
      resolveNotificationTarget({
        ...base,
        notification: {
          type: 'performance',
          title: 'Trager dan je beste meting',
          body: 'Denk aan bandenspanning.',
        },
      }),
    ).toEqual({ screen: 'PerformanceHistory' });
  });

  it('opent bij een diagnosemelding de gesprekken', () => {
    expect(
      resolveNotificationTarget({
        ...base,
        notification: { type: 'diagnosis', title: 'Nieuw advies', body: 'Lees het gesprek terug.' },
      }),
    ).toEqual({ screen: 'ChatHistory' });
  });

  it('laat een algemene melding zonder bestemming staan', () => {
    expect(
      resolveNotificationTarget({
        ...base,
        notification: { type: 'general', title: 'Welkom bij FIX50', body: 'Veel plezier.' },
      }),
    ).toBeNull();
  });

  it('geeft ook zonder onderhoudsplan een bestemming voor signalen', () => {
    expect(
      resolveNotificationTarget({
        ...base,
        schedules: [],
        notification: { type: 'warning', title: 'Verbruik verslechterd', body: '' },
      }),
    ).toEqual({ screen: 'Garage', segment: 'tankbeurten' });
  });
});

describe('localReminderCandidates', () => {
  it('waarschuwt binnen de km-marge en bij een gemiste beurt', () => {
    const candidates = localReminderCandidates({
      ...base,
      currentKm: 13900,
      thresholdKm: 250,
    });

    expect(candidates.map((c) => c.scheduleId)).toEqual(['s-olie', 's-bougie']);
    const bougieCandidate = candidates.find((c) => c.scheduleId === 's-bougie')!;
    expect(bougieCandidate.title).toBe('Bougie vervangen komt eraan');
    expect(bougieCandidate.body).toContain('Nog 100 km');
    expect(bougieCandidate.dueKm).toBe(14000);
  });

  it('meldt een taak die nog ver weg is niet', () => {
    const candidates = localReminderCandidates({ ...base, thresholdKm: 250 });

    expect(candidates.map((c) => c.scheduleId)).toEqual(['s-olie']);
    expect(candidates[0]!.title).toBe('Oliewissel is te laat');
    expect(candidates[0]!.body).toContain('400 km');
  });

  it('geeft een stabiele sleutel per taak en vervalstand', () => {
    const first = localReminderCandidates({ ...base, currentKm: 13900, thresholdKm: 250 });
    const second = localReminderCandidates({ ...base, currentKm: 13920, thresholdKm: 250 });

    expect(first.map((c) => c.key)).toEqual(['s-olie:12000', 's-bougie:14000']);
    expect(second.map((c) => c.key)).toEqual(first.map((c) => c.key));
  });

  it('slaat taken zonder km-vervalstand over', () => {
    const candidates = localReminderCandidates({
      schedules: [schedule('s-rem', datumTaak.id, { interval_km: null, next_due_at: '2026-12-01' })],
      items: [datumTaak],
      currentKm: 12400,
      fuelSystem: '2T',
      thresholdKm: 250,
      today: new Date('2026-11-26T12:00:00.000Z'),
    });

    expect(candidates).toEqual([]);
  });

  it('gebruikt standaard 250 km als marge', () => {
    expect(DEFAULT_REMINDER_KM).toBe(250);
    expect(localReminderCandidates({ ...base, currentKm: 13700 }).map((c) => c.scheduleId)).toEqual([
      's-olie',
    ]);
    expect(localReminderCandidates({ ...base, currentKm: 13780 })).toHaveLength(2);
  });
});
