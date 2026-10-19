import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, AlertCircle, BarChart3, Bus, Camera, Check, ChevronDown,
  Clock3, DoorOpen, LogOut, RefreshCw, Settings, ShieldCheck, Wifi, X,
} from 'lucide-react';
import LiveFeed from './LiveFeed.jsx';
import { vehicleLabel } from './access.js';
import './dash.css';
import './profile.css';
import './smooth.css';

const COLORS = ['#347BF0', '#5B93F5', '#8BB2FA', '#BCD3FF', '#233c60', '#91a1b7'];
const TIME_ZONE = 'Asia/Jakarta';
const dayKey = date => date.toLocaleDateString('sv-SE', { timeZone: TIME_ZONE });
const dateTime = value => value
  ? new Date(value).toLocaleString('id-ID', { timeZone: TIME_ZONE })
  : '—';
const percent = value => `${((value || 0) * 100).toFixed(1)}%`;

function Head({ Icon, title, children }) {
  return (
    <div className="sl-head">
      <div className="sl-head-l">
        <span className="sl-chip"><Icon size={17} /></span>
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function App({
  api, token, user, page = 'dashboard', onNavigate, onLogout, children,
}) {
  const [health, setHealth] = useState('checking');
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [cameraId, setCameraId] = useState('');
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  const [updated, setUpdated] = useState(null);
  const [now, setNow] = useState(new Date());
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [stream, setStream] = useState('idle');
  const [pending, setPending] = useState('');
  const [refresh, setRefresh] = useState(0);

  const profile = useRef(null);
  const profileButton = useRef(null);
  const logoutRef = useRef(onLogout);
  logoutRef.current = onLogout;

  const handleExpired = useCallback(() => logoutRef.current(), []);
  const isAdmin = user.role === 'admin';
  const username = user.username?.trim() || 'Pengguna';

  useEffect(() => {
    let stopped = false, timer;

    async function poll() {
      const today = dayKey(new Date());
      const query = new URLSearchParams({
        from: `${today}T00:00:00.000+07:00`,
        to: `${today}T23:59:59.999+07:00`,
      });

      const results = await Promise.allSettled([
        api('/health'),
        api('/cameras'),
        api('/analytics/history?limit=100'),
        api(`/analytics/statistics?${query}`),
      ]);

      if (stopped) return;

      setHealth(results[0].status === 'fulfilled' ? 'online' : 'offline');

      if (results[1].status === 'fulfilled') {
        const active = results[1].value.cameras.filter(camera => camera.isActive);
        setCameras(active);
        setCameraId(id => active.some(camera => camera.id === id) ? id : active[0]?.id || '');
      }

      if (results[2].status === 'fulfilled') {
        setEvents(results[2].value.events);
      }

      if (results[3].status === 'fulfilled') {
        setStats({ ...results[3].value, day: today });
      }

      const labels = ['Koneksi', 'Kamera', 'Riwayat', 'Statistik'];

      setErrors(results.flatMap((result, index) =>
        result.status === 'rejected'
          ? [`${labels[index]}: ${result.reason.message}`]
          : []
      ));

      if (results.every(result => result.status === 'fulfilled')) {
        setUpdated(new Date());
      }

      setLoading(false);
      timer = setTimeout(poll, 5000);
    }

    poll();

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [api, refresh]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const outside = event => {
      if (!profile.current?.contains(event.target)) setMenu(false);
    };

    const keyboard = event => {
      if (event.key === 'Escape' && profile.current?.contains(event.target)) {
        setMenu(false);
        profileButton.current?.focus();
      }
    };

    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', keyboard);

    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', keyboard);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function command(body) {
    if (busy) return;
    setBusy(true);

    try {
      await api('/mqtt/portal/command', { method: 'POST', body });

      const label = body.aksi === 'buka'
        ? 'Buka portal'
        : body.aksi === 'tutup'
          ? 'Tutup portal'
          : `Mode ${body.mode}`;

      setPending(`${label} · terkirim`);
      setNotice('Perintah terkirim. Menunggu konfirmasi posisi portal.');
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  const dailyStats = stats?.day === dayKey(now) ? stats : null;
  const current = events[0];
  const rows = dailyStats?.byVehicleType || [];
  const total = dailyStats?.summary?.totalDetections || 0;
  const count = type => rows.find(row => row._id === type)?.count || 0;
  const selected = cameras.find(camera => camera.id === cameraId);
  const maxCount = Math.max(1, ...rows.map(row => row.count));
  const hour = Number(now.toLocaleTimeString('en-GB', {
    timeZone: TIME_ZONE, hour: '2-digit', hourCycle: 'h23',
  }));

  const greeting = hour < 4 ? 'malam'
    : hour < 11 ? 'pagi'
      : hour < 15 ? 'siang'
        : hour < 18 ? 'sore' : 'malam';

  const backendLabel = health === 'online' ? 'Online'
    : health === 'checking' ? 'Menghubungkan' : 'Offline';

  const cameraLabel = stream === 'live' ? 'Terhubung'
    : stream === 'connecting' ? 'Menghubungkan' : 'Belum terhubung';

  let offset = 0;
  const gradient = rows.map((row, index) => {
    const start = offset;
    offset += total ? row.count / total * 100 : 0;
    return `${COLORS[index % COLORS.length]} ${start}% ${offset}%`;
  }).join(',');

  const metrics = [
    ['TransJakarta', count('bus'), Bus],
    ['Ambulans & Damkar', count('ambulans') + count('damkar'), Activity],
    ['Kendaraan Lain', count('motor') + count('mobil') + count('truk'), BarChart3],
    ['Total Deteksi', total, Camera],
  ];

  const details = [
    ['Jenis Kendaraan', vehicleLabel(current?.vehicleType)],
    ['Tracking ID', current?.vehicleId || '—'],
    ['Confidence', current ? percent(current.confidence) : '—'],
    ['Zona Trigger', current ? current.inZone ? 'Di dalam zona' : 'Di luar zona' : '—'],
    ['Strobo', current ? current.strobo ? 'Terdeteksi' : 'Tidak terdeteksi' : '—'],
    ['Brightness', current ? percent(current.brightness) : '—'],
    ['Latensi', current ? `${current.latencyMs} ms` : '—'],
  ];

  const systemItems = [
    [Camera, 'Camera', cameraLabel, stream === 'live' ? 'g' : 'n'],
    [Wifi, 'ESP32-S3', 'Belum tersedia', 'n'],
    [Activity, 'FPS', '—', 'b'],
    [Clock3, 'Latency terakhir', current ? `${current.latencyMs} ms` : '—', 'b'],
    [Settings, 'Servo', 'Belum tersedia', 'n'],
  ];

  return (
    <div className="dash">
      <div className="sl-shell">
        <header className="sl-top">
          <div className="sl-pill sl-brand">
            <span className="sl-brand-ic"><Bus size={18} /></span>
            Smart Busway Portal
          </div>

          {isAdmin && (
            <nav className="sl-pill sl-nav" aria-label="Navigasi admin">
              {[
                ['dashboard', 'Dashboard'],
                ['cameras', 'Kelola Kamera'],
                ['accounts', 'Kelola Akun'],
              ].map(([id, title]) => (
                <button
                  key={id}
                  type="button"
                  className={page === id ? 'on' : ''}
                  aria-current={page === id ? 'page' : undefined}
                  onClick={() => onNavigate(id)}
                >
                  {title}
                </button>
              ))}
            </nav>
          )}

          <div className="sl-right">
            <div className="sl-pill sl-health">
              <i className={`sl-dot ${health}`} />
              <b>Backend {backendLabel}</b>
              <button
                type="button"
                className="sl-icbtn"
                aria-label="Refresh data"
                onClick={() => setRefresh(value => value + 1)}
              >
                <RefreshCw size={15} />
              </button>
            </div>

            <div ref={profile} className="sl-profile">
              <button
                ref={profileButton}
                type="button"
                className={`sl-pill sl-me ${menu ? 'is-open' : ''}`}
                aria-expanded={menu}
                aria-controls="account-dropdown"
                onClick={() => setMenu(value => !value)}
              >
                <span className="sl-av">{username[0].toUpperCase()}</span>
                <span className="sl-me-t">
                  <b>{username}</b>
                  <small>{isAdmin ? 'Admin' : 'Petugas'}</small>
                </span>
                <ChevronDown className={menu ? 'turned' : ''} size={16} />
              </button>

              {menu && (
                <div className="sl-account-menu" id="account-dropdown">
                  <div className="sl-account-info">
                    <b>{username}</b>
                    <small>{isAdmin ? 'Administrator' : 'Petugas operasional'}</small>
                  </div>

                  {isAdmin && (
                    <button type="button" onClick={() => {
                      setMenu(false);
                      onNavigate('password');
                    }}>
                      <Settings size={16} />Ganti password
                    </button>
                  )}

                  <button type="button" className="sl-logout" onClick={onLogout}>
                    <LogOut size={16} />Keluar akun
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="sl-body sl-without-rail">
          <main className="sl-main">
            {page !== 'dashboard' ? (
              <div key={page} className="sl-page-enter">{children}</div>
            ) : (
              <div className="sl-page-enter">
                <h1 className="sl-h1">Selamat {greeting}, {username}</h1>
                <p className="sl-sub">
                  {now.toLocaleDateString('id-ID', {
                    timeZone: TIME_ZONE,
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                  })}
                  {' · '}
                  {now.toLocaleTimeString('id-ID', { timeZone: TIME_ZONE })} WIB
                </p>

                {errors.length > 0 && (
                  <div className="sl-banner sl-error" role="alert">
                    <AlertCircle size={18} />
                    <span>
                      {errors.join(' · ')}
                      {updated && (
                        <small>
                          Data terakhir: {updated.toLocaleTimeString('id-ID', {
                            timeZone: TIME_ZONE,
                          })} WIB
                        </small>
                      )}
                    </span>
                  </div>
                )}

                {user.mustChangePassword && (
                  <div className="sl-banner">
                    <ShieldCheck size={18} />
                    Akun menggunakan password awal. Hubungi admin untuk memperbarui password.
                  </div>
                )}

                <div className="sl-grid-m" aria-busy={loading || !dailyStats}>
                  {metrics.map(([title, value, Icon], index) => (
                    <div key={title} className={`sl-card sl-metric ${index === 0 ? 'hero' : ''}`}>
                      <div className="sl-metric-top">
                        {title}<span className="sl-chip"><Icon size={18} /></span>
                      </div>
                      <div className="sl-metric-val">
                        {dailyStats ? value.toLocaleString('id-ID') : '—'}
                      </div>
                      <small>Deteksi hari ini · WIB</small>
                    </div>
                  ))}
                </div>

                <div className="sl-grid-a">
                  <section className="sl-card sl-feed-card">
                    <Head Icon={Camera} title="Live Camera Feed">
                      <span className={`sl-stream-badge ${stream}`}>
                        {stream === 'live' ? '● LIVE' : stream === 'connecting' ? 'Connecting' : 'Offline'}
                      </span>
                    </Head>

                    <label className="sl-camera-select">
                      Kamera
                      <select
                        aria-label="Pilih kamera monitoring"
                        value={cameraId}
                        onChange={event => setCameraId(event.target.value)}
                        disabled={!cameras.length}
                      >
                        <option value="" disabled>Belum ada kamera aktif</option>
                        {cameras.map(camera => (
                          <option value={camera.id} key={camera.id}>{camera.name}</option>
                        ))}
                      </select>
                    </label>

                    <LiveFeed
                      cameraId={cameraId}
                      token={token}
                      onExpired={handleExpired}
                      onStatus={setStream}
                    />

                    <div className="sl-feed-stats">
                      {[
                        ['Kamera', selected?.name || '—'],
                        ['Stream', stream === 'live' ? 'Terhubung' : 'Menunggu'],
                        ['Sumber', 'Frame kamera'],
                      ].map(([label, value]) => (
                        <div className="sl-fs" key={label}>
                          <small>{label}</small><b>{value}</b>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="sl-card">
                    <Head Icon={Activity} title="Deteksi Terakhir" />
                    <p className="sl-muted">{dateTime(current?.detectedAt)}</p>

                    {details.map(([label, value]) => (
                      <div className="sl-kv" key={label}><span>{label}</span><b>{value}</b></div>
                    ))}

                    <div className="sl-ev-h"><h2>Recent Event</h2></div>
                    {events.slice(0, 2).map(event => (
                      <div className="sl-ev" key={event._id}>
                        <i />
                        <div>
                          <b>{vehicleLabel(event.vehicleType)}</b>
                          <small>{dateTime(event.detectedAt)}</small>
                        </div>
                      </div>
                    ))}
                    {!current && <p className="empty-state">Belum ada deteksi.</p>}
                  </section>

                  <section className="sl-card sl-portal">
                    <Head Icon={DoorOpen} title="Portal Control" />

                    <div className={`sl-gate ${current?.portalOpen ? 'open' : ''} ${!current ? 'unknown' : ''}`}>
                      <div className="sl-post" /><div className="sl-arm" />
                    </div>

                    <div className="sl-status-l">Status pada deteksi terakhir</div>
                    <div className={`sl-state ${!current ? 'unknown' : current.portalOpen ? '' : 'closed'}`}>
                      {current ? current.portalOpen ? 'OPEN' : 'CLOSED' : 'BELUM ADA DATA'}
                    </div>

                    <p className="sl-muted">
                      {dateTime(current?.detectedAt)}<br />
                      Posisi portal saat ini belum dikonfirmasi.
                    </p>

                    <div className="sl-modes">
                      {[['otomatis', 'AUTO'], ['manual', 'MANUAL']].map(([mode, title]) => (
                        <button
                          key={mode}
                          type="button"
                          disabled={busy || health !== 'online'}
                          className={current?.portalMode === mode ? 'on' : ''}
                          onClick={() => command({ mode })}
                        >
                          {title} MODE
                        </button>
                      ))}
                    </div>

                    <div className="sl-acts">
                      <button
                        type="button"
                        className="open"
                        disabled={busy || health !== 'online'}
                        onClick={() => command({ aksi: 'buka' })}
                      >
                        Buka Portal
                      </button>
                      <button
                        type="button"
                        className="close"
                        disabled={busy || health !== 'online'}
                        onClick={() => command({ aksi: 'tutup' })}
                      >
                        Tutup Portal
                      </button>
                    </div>

                    <div className="sl-wait" role="status">
                      {busy ? 'Mengirim perintah…' : pending || 'Siap mengirim perintah'}
                    </div>
                  </section>
                </div>

                <div className="sl-grid-b">
                  <section className="sl-card">
                    <Head Icon={ShieldCheck} title="Log Kendaraan" />
                    <div className="sl-log-scroll">
                      <table className="sl-table">
                        <thead><tr><th>JENIS KENDARAAN</th><th>TIMESTAMP</th></tr></thead>
                        <tbody>
                          {events.map(event => (
                            <tr key={event._id}>
                              <td>{vehicleLabel(event.vehicleType)}</td>
                              <td className="t">{dateTime(event.detectedAt)}</td>
                            </tr>
                          ))}
                          {!events.length && (
                            <tr><td colSpan="2">
                              {loading ? 'Memuat riwayat…' : 'Belum ada riwayat kendaraan.'}
                            </td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <p className="sl-muted">100 deteksi terbaru</p>
                  </section>

                  <section className="sl-card">
                    <Head Icon={BarChart3} title="Jumlah Kendaraan Hari Ini" />
                    <div className="sl-bars">
                      {rows.map((row, index) => (
                        <div key={row._id}>
                          <div className="sl-bar-label">
                            <span>{vehicleLabel(row._id)}</span><b>{row.count}</b>
                          </div>
                          <div className="sl-bar-track">
                            <div style={{
                              width: `${row.count / maxCount * 100}%`,
                              background: COLORS[index % COLORS.length],
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {!rows.length && (
                      <p className="empty-state">
                        {dailyStats ? 'Belum ada deteksi hari ini.' : 'Statistik hari ini belum tersedia.'}
                      </p>
                    )}

                    <p className="sl-muted">Rekap hari ini · 00.00–23.59 WIB</p>
                  </section>

                  <section className="sl-card">
                    <Head Icon={Activity} title="Distribusi Kendaraan Hari Ini" />
                    <div className="sl-dn">
                      <div
                        className="sl-donut"
                        style={{ background: total ? `conic-gradient(${gradient})` : '#EEF4FF' }}
                      >
                        <div className="sl-donut-c">
                          <b>{dailyStats ? total : '—'}</b>Deteksi
                        </div>
                      </div>

                      <div className="sl-dl">
                        {rows.map((row, index) => (
                          <span key={row._id} className="sl-dl-i">
                            <i style={{ background: COLORS[index % COLORS.length] }} />
                            {vehicleLabel(row._id)}
                            <b>{total ? (row.count / total * 100).toFixed(0) : 0}%</b>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="sl-peak">
                      <Check size={18} />
                      <div>
                        <small>Rata-rata Confidence Hari Ini</small>
                        <b>
                          {dailyStats && total > 0
                            ? percent(dailyStats.summary?.averageConfidence)
                            : '—'}
                        </b>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="sl-card sl-sys">
                  <b>Status Sistem</b>
                  {systemItems.map(([Icon, label, value, tone]) => (
                    <div className="sl-si" key={label}>
                      <span className="sl-ic"><Icon size={16} /></span>
                      <div>
                        <small>{label}</small>
                        <span className={`sl-tag ${tone}`}>{value}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="sl-foot"><span>Busway • Smart Portal</span></div>
                <div className="sl-logo-capstone">
                  <img src="/logo-capstone.png" alt="Logo Capstone" />
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      <div role="status" aria-live="polite" className={`sl-toast ${notice ? 'show' : ''}`}>
        <Activity size={16} /><span>{notice}</span>
        <button type="button" aria-label="Tutup pemberitahuan" onClick={() => setNotice('')}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
}