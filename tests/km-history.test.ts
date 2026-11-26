/** Kilometerstand vs. laatste beurt: waarschuwing vóór opslaan en in de plan-hero. */
import {
  highestDoneKm,
  isBelowLastService,
  kmBehindMessage,
  lastServiceKmFromRecords,
} from '@/lib/km-history';

const record = (km_at_service: number | null) => ({ km_at_service });

describe('lastServiceKmFromRecords', () => {
  it('pakt de hoogste km uit de beurten, niet de eerste rij', () => {
    expect(lastServiceKmFromRecords([record(9000), record(12400), record(11000)])).toBe(12400);
  });

  it('negeert beurten zonder km en ongeldige waarden', () => {
    expect(
      lastServiceKmFromRecords([record(null), record(Number.NaN), record(-5), record(8000)]),
    ).toBe(8000);
  });

  it('geeft null als er geen beurt met km is', () => {
    expect(lastServiceKmFromRecords([])).toBeNull();
    expect(lastServiceKmFromRecords([record(null)])).toBeNull();
  });
});

describe('highestDoneKm', () => {
  it('pakt de hoogste last_done_km uit de planning', () => {
    expect(
      highestDoneKm([{ last_done_km: 1000 }, { last_done_km: 12400 }, { last_done_km: null }]),
    ).toBe(12400);
  });

  it('geeft null zonder geregistreerde beurt', () => {
    expect(highestDoneKm([])).toBeNull();
    expect(highestDoneKm([{ last_done_km: null }])).toBeNull();
  });
});

describe('isBelowLastService', () => {
  it('waarschuwt alleen onder de laatste beurt', () => {
    expect(isBelowLastService(12100, 12400)).toBe(true);
    expect(isBelowLastService(12400, 12400)).toBe(false);
    expect(isBelowLastService(12500, 12400)).toBe(false);
    expect(isBelowLastService(0, null)).toBe(false);
  });
});

describe('kmBehindMessage', () => {
  it('noemt beide standen, zodat de melding zonder context te lezen is', () => {
    const text = kmBehindMessage(12100, 12400);
    expect(text).toContain('12.400 km');
    expect(text).toContain('12.100 km');
    expect(text).toContain('te laat');
  });
});
