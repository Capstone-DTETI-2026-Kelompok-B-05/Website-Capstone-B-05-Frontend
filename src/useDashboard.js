import { useEffect, useRef, useState } from 'react';
import { dayRange, portalFromEvent } from './dashboardData.js';

const FRAME_INTERVAL_MS = 200; // maks ~5 permintaan/detik
const FRAME_RETRY_MS = 2500;
const FRAME_STALE_MS = 8000; // tidak ada frame baru selama ini -> dianggap berhenti
const OVERRIDE_HOLD_MS = 8000;

/* Mengambil frame JPEG terbaru dari backend (GET + JWT) dan menampilkannya sebagai blob URL.
   <img src> biasa tidak bisa mengirim header Authorization, jadi memakai fetch. */
export function useLiveFrame({ url, token, enabled = true, onExpired }) {
  const [state, setState] = useState({ src: null, status: 'connecting', fps: 0 });
  const expired = useRef(onExpired);
  expired.current = onExpired;

  useEffect(() => {
    if (!enabled || !url || !token) return undefined;
    const controller = new AbortController();
    let objectUrl = null;
    let signature = null;
    let lastChange = Date.now();
    let stamps = [];
    let timer;
    const sleep = (ms) => new Promise((resolve) => { timer = setTimeout(resolve, ms); });

    async function run() {
      while (!controller.signal.aborted) {
        const started = performance.now();
        let delay = FRAME_INTERVAL_MS;
        try {
          const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
            signal: controller.signal,
          });
          if (response.status === 401) { expired.current?.(); return; }
          if (response.status === 404) {
            setState((s) => ({ ...s, status: 'waiting', fps: 0 }));
            delay = FRAME_RETRY_MS;
          } else if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          } else {
            if (!(response.headers.get('content-type') || '').includes('image/')) throw new Error('Respons bukan gambar');
            const blob = await response.blob();
            const next = `${response.headers.get('last-modified')}:${blob.size}`;
            const now = Date.now();
            if (next !== signature) {
              signature = next;
              lastChange = now;
              stamps = [...stamps.filter((t) => now - t < 3000), now];
              const previous = objectUrl;
              objectUrl = URL.createObjectURL(blob);
              const fps = stamps.length > 1 ? Math.round(((stamps.length - 1) * 1000) / (now - stamps[0])) : 0;
              setState({ src: objectUrl, status: 'live', fps });
              if (previous) setTimeout(() => URL.revokeObjectURL(previous), 1000);
            } else if (now - lastChange > FRAME_STALE_MS) {
              setState((s) => (s.status === 'stale' ? s : { ...s, status: 'stale', fps: 0 }));
            } else {
              // Respons sukses walau frame belum berganti: pulihkan dari status error/menunggu.
              setState((s) => (s.status === 'error' || s.status === 'waiting' ? { ...s, status: 'live' } : s));
            }
          }
        } catch {
          if (controller.signal.aborted) return;
          setState((s) => ({ ...s, status: 'error', fps: 0 }));
          delay = FRAME_RETRY_MS;
        }
        await sleep(Math.max(0, delay - (performance.now() - started)));
      }
    }
    run();

    return () => {
      controller.abort();
      clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setState({ src: null, status: 'connecting', fps: 0 }); // blob lama sudah dicabut
    };
  }, [url, token, enabled]);

  return state;
}

/* Riwayat deteksi + statistik hari ini/kemarin dari /analytics. Polling hanya saat tab terlihat. */
export function useDashboardData(api, enabled = true) {
  const [events, setEvents] = useState({ list: [], total: 0 });
  const [stats, setStats] = useState({ today: null, yesterday: null });
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled || !api) return undefined;
    let alive = true;
    let loadingEvents = false;
    let loadingStats = false;

    async function loadEvents() {
      if (loadingEvents || document.hidden) return;
      loadingEvents = true;
      try {
        const data = await api('/analytics/history?limit=100');
        if (!alive) return;
        setEvents({ list: data.events ?? [], total: data.pagination?.total ?? 0 });
        setError('');
        setLoaded(true);
      } catch (err) {
        if (alive) setError(err.message);
      } finally { loadingEvents = false; }
    }
    async function loadStats() {
      if (loadingStats || document.hidden) return;
      loadingStats = true;
      const today = dayRange(0);
      const yesterday = dayRange(-1);
      try {
        const [a, b] = await Promise.all([
          api(`/analytics/statistics?from=${encodeURIComponent(today.from)}`),
          api(`/analytics/statistics?from=${encodeURIComponent(yesterday.from)}&to=${encodeURIComponent(yesterday.to)}`),
        ]);
        if (alive) setStats({ today: a, yesterday: b });
      } catch (err) {
        if (alive) setError(err.message);
      } finally { loadingStats = false; }
    }

    loadEvents();
    loadStats();
    const eventTimer = setInterval(loadEvents, 4000);
    const statsTimer = setInterval(loadStats, 15000);
    return () => { alive = false; clearInterval(eventTimer); clearInterval(statsTimer); };
  }, [api, enabled]);

  return { events, stats, error, loaded };
}

/* Kontrol portal lewat POST /mqtt/portal/command.
   Backend tidak punya GET status portal, jadi status diambil dari deteksi terakhir dan
   sementara ditimpa (override) oleh perintah yang baru dikirim. */
export function usePortalControl({ api, latestEvent, notify }) {
  const [override, setOverride] = useState(null);
  const [busy, setBusy] = useState(false);

  const fromEvent = portalFromEvent(latestEvent);
  const latestId = latestEvent?._id ?? null;
  const active = override && (override.baseId === latestId || Date.now() - override.at < OVERRIDE_HOLD_MS) ? override : null;
  const open = active?.open ?? fromEvent?.open ?? false;
  const mode = active?.mode ?? fromEvent?.mode ?? 'AUTO';

  async function send(body, apply, message) {
    if (busy) return;
    setBusy(true);
    try {
      await api('/mqtt/portal/command', { method: 'POST', body });
      setOverride({ open, mode, ...apply, baseId: latestId, at: Date.now() });
      notify(message);
    } catch (err) {
      notify(err.message);
    } finally { setBusy(false); }
  }

  return {
    open, mode, busy, known: Boolean(fromEvent || active),
    // Backend mengembalikan controller ke mode otomatis setiap menerima perintah buka/tutup.
    openPortal: () => send({ aksi: 'buka' }, { open: true, mode: 'AUTO' }, 'Perintah buka portal terkirim. Mode kembali ke AUTO.'),
    closePortal: () => send({ aksi: 'tutup' }, { open: false, mode: 'AUTO' }, 'Perintah tutup portal terkirim. Mode kembali ke AUTO.'),
    changeMode: (next) => send({ mode: next === 'MANUAL' ? 'manual' : 'otomatis' }, { mode: next }, `Mode ${next} terkirim.`),
  };
}
