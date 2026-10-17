import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cameraIdFromUrl, cameraLabel, chartScale, confidenceTrend, countTrend, distribution, hourlyBuckets,
  peakHour, portalFromEvent, timeAgo, trackingLabel, typeCount, vehicleLabel,
} from '../src/dashboardData.js';

const at = (h, m = 0) => new Date(2026, 9, 16, h, m, 0).toISOString();
const ev = (vehicleType, h, m) => ({ vehicleType, detectedAt: at(h, m) });

test('Label kendaraan memakai nama tampilan dan jatuh kembali ke nilai asli', () => {
  assert.equal(vehicleLabel('bus'), 'TransJakarta');
  assert.equal(vehicleLabel('damkar'), 'Damkar');
  assert.equal(vehicleLabel('becak'), 'becak');
});

test('typeCount menjumlahkan jenis dari statistik backend', () => {
  const stats = { byVehicleType: [{ _id: 'bus', count: 5 }, { _id: 'ambulans', count: 2 }, { _id: 'damkar', count: 1 }] };
  assert.equal(typeCount(stats, 'bus'), 5);
  assert.equal(typeCount(stats, ['ambulans', 'damkar']), 3);
  assert.equal(typeCount(null, 'bus'), 0);
});

test('Tren dibanding kemarin: null bila kemarin kosong', () => {
  assert.equal(countTrend(10, 0), null);
  assert.deepEqual(countTrend(15, 10), { up: true, text: '50%' });
  assert.deepEqual(countTrend(5, 10), { up: false, text: '50%' });
  assert.equal(confidenceTrend(0.9, undefined), null);
  assert.deepEqual(confidenceTrend(0.9, 0.85), { up: true, text: '5 poin' });
});

test('hourlyBuckets membagi deteksi prioritas vs lainnya per jam (7 jam terakhir)', () => {
  const now = new Date(2026, 9, 16, 12, 30, 0);
  const buckets = hourlyBuckets(
    [ev('bus', 12, 5), ev('ambulans', 12, 10), ev('mobil', 12, 20), ev('motor', 7, 0), ev('bus', 6, 59)],
    { now }
  );
  assert.equal(buckets.length, 7);
  assert.deepEqual(buckets.map((b) => b.label), ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00']);
  assert.equal(buckets[6].priority, 2);
  assert.equal(buckets[6].other, 1);
  assert.equal(buckets[1].other, 1);
  assert.equal(buckets[0].priority, 1); // 06:59 masuk bucket 06:00
});

test('chartScale selalu memberi 5 tick kelipatan sama dan minimal skala 4', () => {
  assert.deepEqual(chartScale([{ priority: 0, other: 0 }]), { top: 4, ticks: [0, 1, 2, 3, 4] });
  assert.deepEqual(chartScale([{ priority: 18, other: 3 }]), { top: 20, ticks: [0, 5, 10, 15, 20] });
});

test('peakHour mencari jam tersibuk', () => {
  assert.equal(peakHour([]), null);
  assert.deepEqual(peakHour([ev('bus', 8, 1), ev('bus', 8, 30), ev('mobil', 9, 0)]), { label: '08:00 – 09:00', count: 2 });
});

test('distribution menghitung persentase per jenis', () => {
  const rows = distribution({ byVehicleType: [{ _id: 'bus', count: 3 }, { _id: 'motor', count: 1 }] });
  assert.equal(rows[0].pct, 75);
  assert.equal(rows[1].label, 'Motor');
  assert.deepEqual(distribution(null), []);
});

test('Status portal diambil dari deteksi terakhir backend', () => {
  assert.deepEqual(portalFromEvent({ portalOpen: true, portalMode: 'manual' }), { open: true, mode: 'MANUAL' });
  assert.deepEqual(portalFromEvent({ portalOpen: false, portalMode: 'otomatis' }), { open: false, mode: 'AUTO' });
  assert.equal(portalFromEvent(null), null);
});

test('ID kamera dibaca dari URL camera-ingest', () => {
  const url = 'http://xxx/api/v1/camera-ingest/camera-01/frame';
  assert.equal(cameraIdFromUrl(url), 'camera-01');
  assert.equal(cameraLabel(url), 'CAM-01');
  assert.equal(cameraLabel('http://x/lain'), 'CAMERA');
});

test('timeAgo dan trackingLabel', () => {
  const now = new Date('2026-10-16T10:00:00Z');
  assert.equal(timeAgo('2026-10-16T09:59:58Z', now), 'baru saja');
  assert.equal(timeAgo('2026-10-16T09:59:30Z', now), '30 dtk lalu');
  assert.equal(timeAgo('2026-10-16T09:50:00Z', now), '10 mnt lalu');
  assert.equal(trackingLabel('12'), '#12');
  assert.equal(trackingLabel('bus-3'), 'bus-3');
});
