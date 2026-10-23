/** Kleine opmaak-helpers (nl-NL). */
export function formatKm(km: number | null | undefined): string {
  if (km === null || km === undefined) return '—';
  return `${km.toLocaleString('nl-NL')} km`;
}

export function formatKmShort(km: number | null | undefined): string {
  if (km === null || km === undefined) return '—';
  return km.toLocaleString('nl-NL');
}

export function formatSeconds(s: number | null | undefined, decimals = 2): string {
  if (s === null || s === undefined || Number.isNaN(s)) return '—';
  return `${s.toFixed(decimals)} s`;
}

export function formatSpeed(kmh: number | null | undefined): string {
  if (kmh === null || kmh === undefined || Number.isNaN(kmh)) return '—';
  return `${Math.round(kmh)} km/h`;
}

export function formatDistance(m: number | null | undefined): string {
  if (m === null || m === undefined || Number.isNaN(m)) return '—';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('nl-NL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'net nu';
  if (minutes < 60) return `${minutes} min geleden`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} uur geleden`;
  const days = Math.floor(hours / 24);
  if (days < 31) return `${days} dag${days === 1 ? '' : 'en'} geleden`;
  const months = Math.floor(days / 30);
  return `${months} maand${months === 1 ? '' : 'en'} geleden`;
}

/** Interval-label zoals "elke 2.000 km" of "elke 12 maanden". */
export function intervalLabel(km: number | null, months: number | null): string {
  const parts: string[] = [];
  if (km) parts.push(`elke ${km.toLocaleString('nl-NL')} km`);
  if (months) parts.push(`elke ${months} mnd`);
  return parts.join(' · ') || 'geen interval';
}

/** Verdeling van items over de laatste 7 dagen (oud→nieuw) met korte weekdaglabels. */
export function activityLast7Days<T>(
  items: T[],
  getDate: (item: T) => string | null | undefined,
): { label: string; value: number }[] {
  const labels = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  const days: { label: string; value: number }[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    const value = items.filter((it) => {
      const ts = getDate(it);
      if (!ts) return false;
      const t = new Date(ts).getTime();
      return !Number.isNaN(t) && t >= start.getTime() && t < end.getTime();
    }).length;
    days.push({ label: labels[start.getDay()] ?? '', value });
  }
  return days;
}
