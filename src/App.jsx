import { useEffect, useRef, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, Bus, Camera, Check, Clock3, DoorOpen,
  ChevronDown, Gauge, Home, LogOut, Settings, ShieldAlert, ShieldCheck, SlidersHorizontal, Wifi, X,
} from 'lucide-react'
import './dash.css'
import './profile.css' 

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1').replace(/\/+$/, '')
const VIDEO_URL = import.meta.env.VITE_VIDEO_FEED_URL

function CarIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 17h14l1-6-2-4H6l-2 4 1 6Z" /><path d="M4 11h16M7 17v2m10-2v2M7 14h.01M17 14h.01" />
    </svg>
  )
}
// 4 menu pertama = pill atas; sisanya = rail kiri. notice = menu yang belum punya halaman
const ITEMS = [
  { id: 'dashboard', label: 'Dashboard', Icon: Home },
  { id: 'cameras', label: 'Kelola Kamera', Icon: Camera },
  { id: 'logs', label: 'Log Kendaraan', Icon: ShieldAlert, to: 'dashboard', notice: 'Log kendaraan tersedia di bagian bawah dashboard.' },
  { id: 'analytics', label: 'Analytics', Icon: BarChart3, to: 'dashboard', notice: 'Ringkasan kendaraan tersedia di bagian bawah dashboard.' },
  { id: 'system', label: 'System Control', Icon: SlidersHorizontal, to: 'dashboard', notice: 'Gunakan panel Portal Control pada dashboard.' },
  { id: 'accounts', label: 'Kelola Akun', Icon: ShieldCheck, admin: true },
  { id: 'password', label: 'Ganti Password', Icon: Settings },
]

const Tag = ({ t = 'g', children }) => <span className={`sl-tag ${t}`}>{children}</span>
const Head = ({ Icon, title, badge, action, onAction }) => (
  <div className="sl-head">
    <div className="sl-head-l">
      <span className="sl-chip"><Icon size={17} /></span>
      <h2>{title}</h2>{badge}
    </div>
    {action && <button type="button" className="sl-link" onClick={onAction}>{action}</button>}
  </div>
)

/* animasi donut: semua segmen dihitung ulang tiap frame, jadi selalu menyatu */
function useSweep(cnt) {
  const ref = useRef({ v: cnt, p: 0 })
  const [s, setS] = useState(ref.current)
  useEffect(() => {
    let raf, t0 = null
    const from = [...ref.current.v], p0 = ref.current.p
    const f = (t) => {
      if (t0 === null) t0 = t
      const k = Math.min((t - t0) / 900, 1), e = 1 - (1 - k) ** 3
      ref.current = { v: from.map((x, i) => x + (cnt[i] - x) * e), p: p0 + (1 - p0) * e }
      setS(ref.current)
      if (k < 1) raf = requestAnimationFrame(f)
    }
    raf = requestAnimationFrame(f)
    return () => cancelAnimationFrame(raf)
  }, [cnt.join()])
  return s
}

export default function App({ api, user, page = 'dashboard', onNavigate = () => {}, onLogout = () => {}, children }) {
  const [health, setHealth] = useState('checking')
  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef(null)
  const accountButtonRef = useRef(null)
  const logoutButtonRef = useRef(null)
  useEffect(() => {
    if (!accountOpen) return
    logoutButtonRef.current?.focus()
    const outside = event => {
      if (!accountRef.current?.contains(event.target)) setAccountOpen(false)
    }
    const escape = event => {
      if (event.key === 'Escape') {
        setAccountOpen(false)
        accountButtonRef.current?.focus()
      }
    }
    const focusOutside = event => {
      if (!accountRef.current?.contains(event.target)) setAccountOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    document.addEventListener('focusin', focusOutside)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
      document.removeEventListener('focusin', focusOutside)
    }
  }, [accountOpen])
  const [monitor, setMonitor] = useState(null)
  const [frame, setFrame] = useState(null)
  const [monitorError, setMonitorError] = useState('')
  const [busy, setBusy] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [notice, setNotice] = useState('')
  const [now, setNow] = useState(new Date())
  const [banner, setBanner] = useState(true)
  const [act, setAct] = useState(null)
  const donut = useRef(null)
  const counts = monitor?.counts || {}
  const TOTAL_VEHICLES = Object.values(counts).reduce((sum, count) => sum + count, 0)
  const groups = [counts.bus || 0, (counts.ambulans || 0) + (counts.damkar || 0), (counts.mobil || 0) + (counts.motor || 0) + (counts.truk || 0)]
  const PCT = groups.map(value => TOTAL_VEHICLES ? value / TOTAL_VEHICLES * 100 : 0)
  const DC = [['TransJakarta', 'TransJakarta', '27,79,184'], ['Ambulans & Damkar', 'Darurat', '91,147,245'], ['Kendaraan lain', 'Lainnya', '188,211,255']]
  const METRICS = [
    { title: 'TransJakarta', value: counts.bus || 0, Icon: Bus },
    { title: 'Ambulans', value: counts.ambulans || 0, Icon: Activity },
    { title: 'Damkar', value: counts.damkar || 0, Icon: ShieldCheck },
    { title: 'Total Kendaraan', value: TOTAL_VEHICLES, Icon: CarIcon },
  ]
  const sw = useSweep(PCT)
  const detection = monitor?.detection
  const portalOpen = monitor?.portal?.status === 'OPEN'
  const mode = monitor?.portal?.operationMode || 'AUTO'
  const portalLabel = monitor?.portal?.status || 'UNKNOWN'
  const cameraId = monitor?.camera?.id
  const vehicleName = value => ({ bus: 'TransJakarta', ambulans: 'Ambulans', damkar: 'Damkar', mobil: 'Mobil', motor: 'Motor', truk: 'Truk' }[value] || value)
  const timestamp = value => value ? new Date(value).toLocaleString('id-ID') : '—'
  const EVENTS = (monitor?.logs || []).map(log => ({ id: log.id, vehicle: vehicleName(log.vehicle), time: timestamp(log.timestamp) }))
  const videoSrc = VIDEO_URL || (frame ? `data:${frame.mime};base64,${frame.data}` : null)
  useEffect(() => {
    let cancelled = false, timer
    async function poll() {
      try {
        const data = await api('/dashboard')
        if (!cancelled) { setMonitor(data); setMonitorError(''); setHealth('online') }
      } catch (error) {
        if (!cancelled) { setMonitor(null); setFrame(null); setMonitorError(error.message); setHealth('offline') }
      } finally { if (!cancelled) timer = setTimeout(poll, 2000) }
    }
    poll()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [api])
  useEffect(() => {
    let cancelled = false, timer
    setFrame(null)
    if (!cameraId || VIDEO_URL) return
    async function pollFrame() {
      try {
        const data = await api(`/cameras/${cameraId}/frame`)
        if (!cancelled) setFrame(data.frame)
      } catch { if (!cancelled) setFrame(null) }
      finally { if (!cancelled) timer = setTimeout(pollFrame, 700) }
    }
    pollFrame()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [api, cameraId])
  useEffect(() => setVideoError(false), [videoSrc])

  async function checkHealth() {
    setHealth('checking')
    try {
      const response = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(4000) })
      const data = await response.json()
      setHealth(response.ok && data.success ? 'online' : 'offline')
    } catch { setHealth('offline') }
  }
  useEffect(() => {
    checkHealth()
    const clock = window.setInterval(() => setNow(new Date()), 1000)
    const poll = window.setInterval(checkHealth, 30000)
    return () => { window.clearInterval(clock); window.clearInterval(poll) }
  }, [])
  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(''), 3300)
    return () => window.clearTimeout(t)
  }, [notice])

  const go = (item) => {
    if (item.notice) setNotice(item.notice)
    if (!item.notice || item.to) onNavigate(item.to || item.id)
  }
  async function command(body) {
    if (!cameraId || !monitor?.mqttConnected) { setNotice('Kamera aktif dan koneksi MQTT diperlukan.'); return }
    setBusy(true)
    try {
      const result = await api(`/cameras/${cameraId}/portal/command`, { method: 'POST', body })
      setNotice(result.message)
      setMonitor(await api('/dashboard'))
    } catch (error) { setNotice(error.message) }
    finally { setBusy(false) }
  }
  function controlPortal(open) { return command({ aksi: open ? 'buka' : 'tutup' }) }

  const timeText = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const dateText = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const hr = now.getHours()
  const greet = hr < 4 ? 'malam' : hr < 11 ? 'pagi' : hr < 15 ? 'siang' : hr < 18 ? 'sore' : 'malam'
  const healthLabel = { online: 'System Online', checking: 'Connecting', offline: 'System Offline' }[health]

  const username = user?.username?.trim() || 'Pengguna'
  const isAdmin = user?.role === 'admin'
  const visible = ITEMS.filter((i) => !i.admin || isAdmin)

  // donut
  let acc = 0
  const stops = sw.v.map((v, i) => {
    const f = v * sw.p
    const s = `rgba(${DC[i][2]},${act === null || act === i ? 1 : 0.25}) ${acc}% ${acc + f}%`
    acc += f; return s
  })
  stops.push(`#EEF4FF ${acc}% 100%`)
  const pick = (e) => {
    const r = donut.current.getBoundingClientRect(), dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2, d = Math.hypot(dx, dy)
    if (d < r.width * 0.28 || d > r.width / 2) return null
    const f = (((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360) / 3.6
    let c = 0
    for (let i = 0; i < 3; i++) { c += PCT[i]; if (f <= c) return i }
    return 2
  }

  const railBtn = (item, extra = '') => (
    <button key={item.id} type="button" title={item.label} aria-label={item.label} onClick={() => go(item)}
      className={`${extra} ${page === item.id ? 'on' : ''}`}>
      <item.Icon size={18} />
    </button>
  )

  return (
    <div className="dash">
      <div className="sl-shell">
        {/* top bar */}
        <header className="sl-top">
          <div className="sl-pill sl-brand">
            <span className="sl-brand-ic"><Bus size={18} /></span>Smart Busway Portal
          </div>
          <nav aria-label="Navigasi utama" className="sl-pill sl-nav">
            {ITEMS.slice(0, 4).map((i) => (
              <button key={i.id} type="button" onClick={() => go(i)} className={page === i.id ? 'on' : ''}>{i.label}</button>
            ))}
          </nav>
          <div className="sl-right">
            <div className="sl-pill sl-health">
              <i className={`sl-dot ${health}`} />
              <b>{healthLabel}</b>
              <button type="button" className="sl-icbtn" title="Periksa koneksi" aria-label="Periksa koneksi backend" onClick={checkHealth}><Activity size={15} /></button>
            </div>
            <div className="sl-account" ref={accountRef}>
              <button type="button" className="sl-pill sl-me" ref={accountButtonRef}
                aria-label={`Akun ${username}`} aria-expanded={accountOpen} aria-controls="sl-account-panel"
                onClick={() => setAccountOpen(open => !open)}>
                <span className="sl-av">{Array.from(username)[0].toUpperCase()}</span>
                <span className="sl-me-t"><b title={username}>{username}</b><small>{isAdmin ? 'Admin' : 'Petugas'}</small></span>
                <ChevronDown size={15} className={`sl-account-chevron ${accountOpen ? 'open' : ''}`} />
              </button>
              {accountOpen && <div id="sl-account-panel" className="sl-account-panel" role="group" aria-label="Pilihan akun">
                <button type="button" className="sl-account-logout" ref={logoutButtonRef}
                  onClick={() => { setAccountOpen(false); onLogout() }}>
                  <LogOut size={17} /><span>Keluar akun</span>
                </button>
              </div>}
            </div>
          </div>
        </header>

        <div className="sl-body">
          {/* rail ikon (di layar kecil memuat semua menu) */}
          <aside className="sl-pill sl-rail">
            {visible.slice(0, 4).map((i) => railBtn(i, 'sl-mobile-only'))}
            {visible.slice(4).map((i) => railBtn(i))}
          </aside>

          <main className="sl-main">
            {page !== 'dashboard' ? (
              <div className="dashboard-content">{children}</div>
            ) : (
              <>
                <h1 className="sl-h1">Selamat {greet}, {username}</h1>
                <p className="sl-sub">{dateText} · {timeText}</p>

                {banner && (
                  <div className="sl-banner">
                    <ShieldCheck size={17} />{monitorError || monitor?.configurationMessage || 'Data dari backend diperbarui setiap 2 detik. Status portal menunggu laporan perangkat.'}
                    <button type="button" aria-label="Tutup" onClick={() => setBanner(false)}><X size={16} /></button>
                  </div>
                )}

                {/* metrik */}
                <div className="sl-grid-m">
                  {METRICS.map(({ title, value, Icon }, i) => (
                    <div key={title} className={`sl-card sl-metric ${i === 0 ? 'hero' : ''}`}>
                      <div className="sl-metric-top">{title}<span className="sl-chip"><Icon size={18} /></span></div>
                      <div className="sl-metric-val">{value}</div>
                      <small>Akumulasi kendaraan masuk zona trigger</small>
                    </div>
                  ))}
                </div>

                <div className="sl-grid-a">
                  {/* live feed */}
                  <div className="sl-card sl-feed-card">
                    <Head Icon={Camera} title="Live Camera Feed" badge={<span className="sl-live"><i />{videoSrc && !videoError ? "FEED" : "WAITING"}</span>} />
                    <div className="sl-feed">
                      {videoSrc && !videoError ? <img src={videoSrc} alt="Kamera gerbang busway" onError={() => setVideoError(true)} /> :
                        <div style={{ display: 'grid', placeItems: 'center', minHeight: 260, color: '#233c60' }}>Menunggu frame kamera</div>}
                      <div className="sl-osd top">
                        <span><i className="sl-rec" />{monitor?.camera?.name || 'Belum ada kamera aktif'}</span>
                        <span>{now.toLocaleDateString('sv-SE')} {timeText}</span>
                      </div>
                      <div className="sl-osd bottom"><span>{frame ? `Frame diterima: ${timestamp(frame.receivedAt)}` : 'Frame JPEG/PNG atau HTTP MJPEG'}</span></div>
                    </div>
                    <div className="sl-feed-stats">
                      {[['Kamera', monitor?.camera?.name || '—'], ['MQTT', monitor?.mqttConnected ? 'Terhubung' : 'Terputus'], ['Frame', videoSrc && !videoError ? 'Tersedia' : 'Menunggu'], ['Data terakhir', timestamp(detection?.receivedAt)]].map(([l, v]) => (
                        <div key={l} className="sl-fs"><small>{l}</small><b>{v}</b></div>))}
                    </div>
                  </div>

                  {/* deteksi */}
                  <div className="sl-card">
                    <Head Icon={Activity} title="Current Detection" />
                    <div className="sl-thumb"><span>{timestamp(detection?.receivedAt)}</span></div>
                    {[
                      ['Jenis Kendaraan', detection ? vehicleName(detection.jenis) : '—'],
                      ['Tracking ID', detection?.id ?? '—'],
                      ['Confidence', detection ? `${Math.round(detection.conf * 100)}%` : '—'],
                      ['Zona Trigger', detection ? (detection.zona ? 'Di dalam zona' : 'Di luar zona') : '—'],
                      ['Strobo', detection ? (detection.strobo ? 'Aktif' : 'Tidak aktif') : '—'],
                      ['Kecerahan', detection ? `${Math.round(detection.kecerahan * 100)}%` : '—'],
                      ['Status Portal', portalLabel],
                      ['Latensi Deteksi', detection ? `${detection.latensi} ms` : '—'],
                    ].map(([a, b]) => <div key={a} className="sl-kv"><span>{a}</span><b>{b}</b></div>)}
                    <div className="sl-ev-h"><h2>Deteksi Terbaru</h2></div>
                    {EVENTS.slice(0, 2).map(event => <div key={event.id} className="sl-ev"><i/><div><b>{event.vehicle}</b><small>{event.time}</small></div></div>)}
                  </div>

                  {/* portal */}
                  <div className="sl-card sl-portal">
                    <Head Icon={DoorOpen} title="Portal Control" />
                    <div className={`sl-gate ${portalOpen ? 'open' : ''}`}><div className="sl-post" /><div className="sl-arm" /></div>
                    <div className="sl-status-l">Status Portal</div>
                    <div className={`sl-state ${portalOpen ? '' : 'closed'}`}>{portalLabel}</div>
                    <div className="sl-modes">
                      {['AUTO', 'MANUAL'].map((m) => (
                        <button key={m} type="button" className={mode === m ? 'on' : ''} disabled={busy || !cameraId || !monitor?.mqttConnected} onClick={() => command({ mode: m === 'AUTO' ? 'otomatis' : 'manual' })}>{m} MODE</button>))}
                    </div>
                    <div className="sl-acts">
                      <button type="button" className="open" disabled={busy || portalOpen || mode !== 'MANUAL' || !cameraId || !monitor?.mqttConnected || monitor?.portal?.commandPending} onClick={() => controlPortal(true)}>Open Portal</button>
                      <button type="button" className="close" disabled={busy || portalLabel === 'CLOSED' || mode !== 'MANUAL' || !cameraId || !monitor?.mqttConnected || monitor?.portal?.commandPending} onClick={() => controlPortal(false)}>Close Portal</button>
                    </div>
                    <div className="sl-wait">{monitor?.portal?.commandPending ? 'Menunggu status perangkat. Jika macet, periksa ESP dan koneksi MQTT.' : mode === 'AUTO' ? 'Mode otomatis: mengikuti zona trigger dan deteksi' : 'Mode manual: kontrol oleh petugas'}</div>
                  </div>
                </div>

                <div className="sl-grid-b">
                  {/* log */}
                  <div className="sl-card">
                    <Head Icon={ShieldAlert} title="Log Kendaraan" action="Lihat Semua →" onAction={() => setNotice('Menampilkan 100 log terbaru dari database.')} />
                    <table className="sl-table">
                      <thead><tr><th>JENIS KENDARAAN</th><th>TIMESTAMP</th></tr></thead>
                      <tbody>{!EVENTS.length && <tr><td colSpan="2">Belum ada log kendaraan.</td></tr>}{EVENTS.map((e) => (<tr key={e.id}><td>{e.vehicle}</td><td className="t">{e.time}</td></tr>))}</tbody>
                    </table>
                  </div>

                  <div className="sl-card">
                    <Head Icon={BarChart3} title="Jumlah per Jenis Kendaraan" />
                    {['bus', 'ambulans', 'damkar', 'mobil', 'motor', 'truk'].map(type => <div key={type} style={{ margin: '18px 0' }}>
                      <div className="sl-kv"><span>{vehicleName(type)}</span><b>{counts[type] || 0}</b></div>
                      <div style={{ height: 8, background: '#eef4ff', borderRadius: 8 }}><div style={{ height: 8, background: '#347bf0', borderRadius: 8, width: `${TOTAL_VEHICLES ? (counts[type] || 0) / TOTAL_VEHICLES * 100 : 0}%` }}/></div>
                    </div>)}
                  </div>

                  {/* donut */}
                  <div className="sl-card">
                    <Head Icon={Activity} title="Distribusi Kendaraan" />
                    <div className="sl-dn">
                      <div ref={donut} className="sl-donut" style={{ background: `conic-gradient(${stops.join(',')})` }}
                        onMouseMove={(e) => { const k = pick(e); if (k !== act) setAct(k) }} onMouseLeave={() => setAct(null)}
                        onClick={(e) => { const k = pick(e); setAct(k === act ? null : k) }}>
                        <div className="sl-donut-c">
                          <b>{act === null ? Math.round(TOTAL_VEHICLES * sw.p) : Math.round((TOTAL_VEHICLES * PCT[act]) / 100)}</b>
                          {act === null ? 'Kendaraan' : DC[act][1]}
                        </div>
                      </div>
                      <div className="sl-dl">
                        {DC.map((d, i) => (
                          <span key={d[0]} className={`sl-dl-i ${act !== null && act !== i ? 'dim' : ''} ${act === i ? 'act' : ''}`}
                            onMouseEnter={() => setAct(i)} onMouseLeave={() => setAct(null)} onClick={() => setAct(act === i ? null : i)}>
                            <i style={{ background: `rgb(${d[2]})` }} />{d[0]}<b>{Math.round(PCT[i])}%</b>
                          </span>))}
                      </div>
                    </div>
                    <div className="sl-peak"><BarChart3 size={18}/><div><small>Sumber</small><b>Log kendaraan zona trigger</b><small>{TOTAL_VEHICLES} kendaraan tercatat</small></div></div>
                  </div>
                </div>

                {/* status sistem */}
                <div className="sl-card sl-sys">
                  <b>System Status</b>
                  {[[Camera, 'Kamera', videoSrc && !videoError ? 'Frame tersedia' : 'Menunggu', 'b'], [Wifi, 'MQTT', monitor?.mqttConnected ? 'Terhubung' : 'Terputus', 'b'], [Gauge, 'Deteksi', detection ? 'Data diterima' : 'Menunggu', 'b'],
                    [Clock3, 'Latensi', detection ? `${detection.latensi} ms` : '—', 'b'], [Settings, 'Portal', portalLabel, 'b']].map(([I, l, v, t]) => (
                    <div key={l} className="sl-si">
                      <span className="sl-ic"><I size={15} /></span>
                      <div><small>{l}</small><Tag t={t}>{v}</Tag></div>
                    </div>))}
                </div>

                <div className="sl-foot">
                  <span>TransJakarta • Smart Lane</span>
                  <span><ShieldCheck size={12} />{monitorError ? 'Koneksi terputus' : 'Monitoring backend'}</span>
                </div>
                <div className="sl-tj">
                  <img src="/logo-tj.png" alt="Logo TransJakarta" onError={(e) => { e.currentTarget.parentElement.hidden = true }} />
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      <div role="status" aria-live="polite" className={`sl-toast ${notice ? 'show' : ''}`}>
        <Check size={15} />{notice}
        <button type="button" aria-label="Tutup pemberitahuan" onClick={() => setNotice('')}><X size={14} /></button>
      </div>
    </div>
  )
}