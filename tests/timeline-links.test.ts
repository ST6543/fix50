/**
 * Tijdlijn → detailscherm. Puur, dus geen navigator nodig: we controleren
 * alleen welke bestemming elke soort gebeurtenis krijgt.
 */
import { resolveTimelineTarget, timelineSourceId } from '@/lib/timeline-links';
import type { TimelineEvent } from '@/lib/timeline';

function event(kind: TimelineEvent['kind'], id: string) {
  return { kind, id };
}

describe('resolveTimelineTarget', () => {
  it('opent voor een meting het meetresultaat van die run', () => {
    expect(resolveTimelineTarget(event('meting', 'meting:run-42'))).toEqual({
      screen: 'PerformanceResult',
      runId: 'run-42',
    });
  });

  it('opent voor een diagnose het gesprek zelf', () => {
    expect(resolveTimelineTarget(event('diagnose', 'diagnose:session-7'))).toEqual({
      screen: 'ChatDetail',
      sessionId: 'session-7',
    });
  });

  it('stuurt onderhoud, tuning en tanken naar hun eigen overzicht', () => {
    expect(resolveTimelineTarget(event('onderhoud', 'onderhoud:record-1'))).toEqual({
      screen: 'MaintenanceHistory',
    });
    expect(resolveTimelineTarget(event('tuning', 'tuning:change-1'))).toEqual({
      screen: 'TuningHistory',
    });
    expect(resolveTimelineTarget(event('tankbeurt', 'tankbeurt:log-1'))).toEqual({
      screen: 'Garage',
      segment: 'tankbeurten',
    });
  });

  it('valt terug op de lijst als het bron-id ontbreekt', () => {
    expect(resolveTimelineTarget(event('meting', 'meting:'))).toEqual({
      screen: 'PerformanceHistory',
    });
    expect(resolveTimelineTarget(event('diagnose', 'diagnose'))).toEqual({
      screen: 'ChatHistory',
    });
  });
});

describe('timelineSourceId', () => {
  it('haalt het id achter het soort-voorvoegsel', () => {
    expect(timelineSourceId('meting:run-42')).toBe('run-42');
    expect(timelineSourceId('diagnose:session:7')).toBe('session:7');
    expect(timelineSourceId('zonder-voorvoegsel')).toBe('');
  });
});
