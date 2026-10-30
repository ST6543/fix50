/** Tests voor de teller-scan-service (fase D): plausibiliteitscheck. */
import { isPlausibleOdometerScan } from '../src/services/odometer-scan';

describe('isPlausibleOdometerScan', () => {
  it('accepteert een stand zonder bekende referentie (eerste registratie)', () => {
    expect(isPlausibleOdometerScan(17542, null)).toBe(true);
  });

  it('accepteert standen rond of boven de laatst bekende km', () => {
    expect(isPlausibleOdometerScan(17550, 17542)).toBe(true);
    expect(isPlausibleOdometerScan(18_000, 17542)).toBe(true);
  });

  it('duldt een kleine opschuiving (foto net vóór het logboek, 100 km)', () => {
    expect(isPlausibleOdometerScan(17450, 17542)).toBe(true);
    expect(isPlausibleOdometerScan(17442, 17542)).toBe(true); // randje
  });

  it('markeert een veel lagere stand als onwaarschijnlijk (oudere foto/andere brommer)', () => {
    expect(isPlausibleOdometerScan(16000, 17542)).toBe(false);
    expect(isPlausibleOdometerScan(0, 500)).toBe(false);
  });
});
