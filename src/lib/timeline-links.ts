/**
 * Tijdlijn → detailscherm.
 *
 * Elke gebeurtenis draagt een bron-id in de vorm `soort:id`. Deze module
 * vertaalt dat naar het scherm waar je verder kunt kijken: een meting opent
 * het meetresultaat, een diagnose het gesprek, en de lijstsoorten openen hun
 * eigen geschiedenis (voor een tankbeurt is dat het tankboek in de Garage-tab).
 *
 * Zuiver en los van React, net als `notification-links.ts`, zodat de
 * koppelingen zonder navigator getest kunnen worden.
 */
import type { TimelineEvent } from './timeline';

export type TimelineTarget =
  | { screen: 'MaintenanceHistory' }
  | { screen: 'Garage'; segment: 'tankbeurten' }
  | { screen: 'TuningHistory' }
  | { screen: 'PerformanceHistory' }
  | { screen: 'PerformanceResult'; runId: string }
  | { screen: 'ChatHistory' }
  | { screen: 'ChatDetail'; sessionId: string };

/** Het bron-id achter het `soort:`-voorvoegsel; leeg als het ontbreekt. */
export function timelineSourceId(id: string): string {
  const index = id.indexOf(':');
  return index === -1 ? '' : id.slice(index + 1);
}

/** Waar hoort een tik op deze gebeurtenis naartoe? */
export function resolveTimelineTarget(event: Pick<TimelineEvent, 'kind' | 'id'>): TimelineTarget {
  const sourceId = timelineSourceId(event.id);
  switch (event.kind) {
    case 'onderhoud':
      return { screen: 'MaintenanceHistory' };
    case 'tankbeurt':
      return { screen: 'Garage', segment: 'tankbeurten' };
    case 'tuning':
      return { screen: 'TuningHistory' };
    case 'meting':
      // Een meting heeft altijd een run-id; zonder id blijft de lijst over.
      return sourceId
        ? { screen: 'PerformanceResult', runId: sourceId }
        : { screen: 'PerformanceHistory' };
    case 'diagnose':
      return sourceId ? { screen: 'ChatDetail', sessionId: sourceId } : { screen: 'ChatHistory' };
  }
}
