// Fungsi murni untuk mengubah respons backend (/analytics/*) menjadi data tampilan dashboard.
export const VEHICLE_LABELS = {
  bus: 'TransJakarta', ambulans: 'Ambulans', damkar: 'Damkar', mobil: 'Mobil', motor: 'Motor', truk: 'Truk',
};
// Sama dengan PRIORITY_VEHICLE_TYPES di backend (kendaraan yang membuka portal).
export const PRIORITY_TYPES = ['bus', 'ambulans', 'damkar'];
export const SEGMENT_COLORS = ['27,79,184', '52,123,240', '91,147,245', '138,177,250', '188,211,255', '220,232,255'];

export const vehicleLabel = (type) => VEHICLE_LABELS[type] ?? (type || '-');
export const isPriority = (type) => PRIORITY_TYPES.includes(type);

const pad = (n) => String(n).padStart(2, '0');
export function formatClock(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '--:--:--';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function trackingLabel(id) {
  if (id === undefined || id === null || id === '') return '-';
  return /^\d+$/.test(String(id)) ? `#${id}` : String(id);
}

export function dayRange(offsetDays = 0, now = new Date()) {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() + offsetDays);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function typeCount(statistics, types) {
  const wanted = Array.isArray(types) ? types : [types];
  return (statistics?.byVehicleType ?? []).filter((row) => wanted.includes(row._id)).reduce((sum, row) => sum + row.count, 0);
}

// Perubahan relatif terhadap kemarin. null bila kemarin kosong (tidak bisa dibandingkan).
export function countTrend(current, previous) {
  if (!previous) return null;
  const delta = Math.round(((current - previous) / previous) * 100);
  return { up: delta >= 0, text: `${Math.abs(delta)}%` };
}
export function confidenceTrend(current, previous) {
  if (!(previous > 0) || !(current >= 0)) return null;
  const delta = Math.round((current - previous) * 100);
  return { up: delta >= 0, text: `${Math.abs(delta)} poin` };
}

export function hourlyBuckets(events, { hours = 7, now = new Date() } = {}) {
  const end = new Date(now);
  end.setMinutes(0, 0, 0);
  const buckets = Array.from({ length: hours }, (_, i) => {
    const start = new Date(end);
    start.setHours(end.getHours() - (hours - 1 - i));
    return { start: start.getTime(), label: `${pad(start.getHours())}:00`, priority: 0, other: 0 };
  });
  const first = buckets[0].start;
  const last = end.getTime() + 3600000;
  for (const event of events ?? []) {
    const time = new Date(event.detectedAt).getTime();
    if (!(time >= first && time < last)) continue;
    const bucket = buckets[Math.floor((time - first) / 3600000)];
    if (isPriority(event.vehicleType)) bucket.priority += 1;
    else bucket.other += 1;
  }
  return buckets;
}

export function chartScale(buckets) {
  const max = Math.max(4, ...buckets.map((b) => Math.max(b.priority, b.other)));
  const step = Math.ceil(max / 4);
  return { top: step * 4, ticks: [0, 1, 2, 3, 4].map((i) => i * step) };
}

export function peakHour(events) {
  const counts = new Map();
  for (const event of events ?? []) {
    const d = new Date(event.detectedAt);
    if (Number.isNaN(d.getTime())) continue;
    const hour = d.getHours();
    counts.set(hour, (counts.get(hour) ?? 0) + 1);
  }
  let best = null;
  for (const [hour, count] of counts) if (!best || count > best.count) best = { hour, count };
  return best ? { label: `${pad(best.hour)}:00 – ${pad((best.hour + 1) % 24)}:00`, count: best.count } : null;
}

export function distribution(statistics) {
  const rows = statistics?.byVehicleType ?? [];
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return rows.map((row, i) => ({
    key: row._id,
    label: vehicleLabel(row._id),
    count: row.count,
    pct: total ? (row.count / total) * 100 : 0,
    color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
  }));
}

export function timeAgo(value, now = new Date()) {
  const seconds = Math.round((new Date(now).getTime() - new Date(value).getTime()) / 1000);
  if (!Number.isFinite(seconds)) return '-';
  if (seconds < 5) return 'baru saja';
  if (seconds < 60) return `${seconds} dtk lalu`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} mnt lalu`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} jam lalu`;
  return `${Math.floor(seconds / 86400)} hari lalu`;
}

// Backend tidak punya endpoint status portal; status terakhir tercatat di setiap DetectionEvent.
export function portalFromEvent(event) {
  if (!event) return null;
  return { open: Boolean(event.portalOpen), mode: event.portalMode === 'manual' ? 'MANUAL' : 'AUTO' };
}

export function cameraIdFromUrl(url) {
  const match = /\/camera-ingest\/([^/?#]+)\/frame/.exec(url ?? '');
  return match ? decodeURIComponent(match[1]) : null;
}
export function cameraLabel(url) {
  const id = cameraIdFromUrl(url);
  return id ? id.toUpperCase().replace(/^CAMERA-/, 'CAM-') : 'CAMERA';
}
