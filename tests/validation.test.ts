/** Tests voor Zod-validaties. */
import { chatMessageSchema, kmUpdateSchema, performanceRunSchema, scooterSchema } from '../src/lib/validation';

describe('kmUpdateSchema', () => {
  it('accepteert een normale kilometerstand', () => {
    expect(kmUpdateSchema.safeParse(12450).success).toBe(true);
  });
  it('weigert negatieve km', () => {
    expect(kmUpdateSchema.safeParse(-1).success).toBe(false);
  });
  it('weigert absurd hoge km', () => {
    expect(kmUpdateSchema.safeParse(9_999_999).success).toBe(false);
  });
});

describe('scooterSchema', () => {
  it('vereist een naam', () => {
    expect(scooterSchema.safeParse({ name: '' }).success).toBe(false);
  });
  it('weigert onrealistisch bouwjaar', () => {
    expect(scooterSchema.safeParse({ name: 'X', year: 1800 }).success).toBe(false);
  });
  it('accepteert minimale invoer', () => {
    expect(scooterSchema.safeParse({ name: 'Mijn Aerox' }).success).toBe(true);
  });
});

describe('chatMessageSchema', () => {
  it('accepteert gewone spreektaal', () => {
    expect(chatMessageSchema.safeParse('mijn am6 start wel maar valt meteen uit').success).toBe(true);
  });
  it('weigert lege en te lange berichten', () => {
    expect(chatMessageSchema.safeParse('   ').success).toBe(false);
    expect(chatMessageSchema.safeParse('a'.repeat(2500)).success).toBe(false);
  });
});

describe('performanceRunSchema', () => {
  it('accepteert een fysiek plausibele run', () => {
    expect(
      performanceRunSchema.safeParse({
        duration_s: 30,
        distance_m: 500,
        max_speed_kmh: 65,
        avg_speed_kmh: 40,
      }).success,
    ).toBe(true);
  });
  it('weigert onplausibele snelheid (>200 km/h)', () => {
    expect(
      performanceRunSchema.safeParse({
        duration_s: 30,
        distance_m: 500,
        max_speed_kmh: 280,
        avg_speed_kmh: 120,
      }).success,
    ).toBe(false);
  });
});
