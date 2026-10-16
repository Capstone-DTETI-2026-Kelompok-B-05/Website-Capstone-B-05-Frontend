import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bus, Camera, LockKeyhole, Users, LogIn, RefreshCw } from 'lucide-react';
import AccessRequests from './AccessRequests.jsx';
import Dashboard from './App.jsx';
import { createApi } from './api.js';
import Login from './login.jsx';  

const SESSION_KEY = 'smart-busway-session';
function readSession() {
  try {
    const value = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    return value?.token && ['admin', 'petugas'].includes(value.user?.role) ? value : null;
  } catch { return null; }
}

export default function PortalApp() {
  const [session, setSession] = useState(readSession);
  const [page, setPage] = useState('dashboard');
  const [sessionMessage, setSessionMessage] = useState('');
  const logout = useCallback((expired = false) => {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    setPage('dashboard');
    setSessionMessage(expired ? 'Sesi berakhir. Silakan login kembali.' : '');
  }, []);
  const api = useMemo(() => createApi(session?.token, () => logout(true)), [session?.token, logout]);
  if (!session) return <Login message={sessionMessage} onLogin={data => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    setSession(data);
    setPage(data.user.mustChangePassword ? 'password' : 'dashboard');
    setSessionMessage('');
  }}/>;
  const navigate = next => {
    if (session.user.mustChangePassword && next !== 'password') return;
    if (['accounts', 'requests'].includes(next) && session.user.role !== 'admin') return;
    setPage(next);
  };
  return <Dashboard api={api} user={session.user} page={session.user.mustChangePassword ? 'password' : page} onNavigate={navigate} onLogout={() => logout()}>
    {page === 'requests' && session.user.role === 'admin' && <AccessRequests api={api}/>}
    {page === 'accounts' && session.user.role === 'admin' && <Accounts api={api} user={session.user}/>}
    {page === 'cameras' && <Cameras api={api} user={session.user}/>}
    {(page === 'password' || session.user.mustChangePassword) && <Password api={api} required={session.user.mustChangePassword} onUpdated={() => {
      const updated = { ...session, user: { ...session.user, mustChangePassword: false } };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated)); setSession(updated); setPage('dashboard');
    }}/>}
  </Dashboard>;
}

function Field({ label, children }) {
  return <label className="manage-field"><span>{label}</span>{children}</label>;
}
function PageTitle({ icon, title, description }) {
  return <div className="manage-heading"><span className="manage-icon">{icon}</span><div><h1>{title}</h1><p>{description}</p></div></div>;
}
function Feedback({ error, success }) {
  return <>{error && <div className="form-error" role="alert">{error}</div>}{success && <div className="form-success" role="status">{success}</div>}</>;
}
function useRecords(api, path, key) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try { const data = await api(path); setRows(data[key] || []); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [api, path, key]);
  useEffect(() => { reload(); }, [reload]);
  return { rows, loading, error, reload };
}
function RecordList({ title, records, children }) {
  return <section className="manage-card"><div className="list-heading"><h2>{title}</h2><button className="secondary-button" onClick={records.reload} disabled={records.loading}><RefreshCw size={14}/>Refresh</button></div>
    {records.error ? <div className="form-error" role="alert">{records.error}</div> : records.loading ? <p className="empty-state">Memuat data…</p> : !records.rows.length ? <p className="empty-state">Belum ada data.</p> : children}
  </section>;
}

function Accounts({ api, user }) {
  const records = useRecords(api, '/accounts', 'accounts');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [resetting, setResetting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  async function perform(action, message) {
    setBusy(true); setError(''); setSuccess('');
    try { await action(); setSuccess(message); await records.reload(); return true; }
    catch (err) { setError(err.message); return false; }
    finally { setBusy(false); }
  }
  async function save(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = { username: data.get('username').trim(), role: data.get('role') };
    if (!editing || data.get('password')) body.password = data.get('password');
    if (await perform(() => api(editing ? `/accounts/${editing.id}` : '/accounts', { method: editing ? 'PATCH' : 'POST', body }), 'Akun berhasil disimpan.')) {
      setEditing(null); form.reset();
    }
  }
  async function reset(event) {
    event.preventDefault();
    const newPassword = new FormData(event.currentTarget).get('newPassword');
    if (await perform(() => api(`/auth/users/${resetting.id}/password-reset`, { method: 'POST', body: { newPassword } }), 'Password berhasil direset.')) setResetting(null);
  }
  return <div className="management-page">
    <PageTitle icon={<Users/>} title="Kelola Akun" description="Tambahkan akun admin dan petugas untuk operasional sistem."/>
    <Feedback error={error} success={success}/>
    <div className="manage-grid">
      <RecordList title="Daftar akun" records={records}>
        <div className="record-list">{records.rows.map(row => <div className="record-item" key={row.id}>
          <div><h3>{row.username} {row.id === user.id && <small>(Kamu)</small>}</h3><span className={`role-badge ${row.role}`}>{row.role}</span></div>
          <div className="record-actions"><button disabled={busy} onClick={() => { setEditing(row); setResetting(null); setError(''); }}>Edit</button>
            <button disabled={busy} onClick={() => { setResetting(row); setError(''); }}>Reset password</button>
            <button className="danger-text" disabled={busy || row.id === user.id} onClick={() => setDeleting(row)}>Hapus</button></div>
        </div>)}</div>
      </RecordList>
      <section className="manage-card"><h2>{editing ? 'Edit akun' : 'Tambah akun'}</h2>
        <form className="manage-form" key={editing?.id || 'new'} onSubmit={save}>
          <Field label="Username"><input name="username" defaultValue={editing?.username || ''} required disabled={busy} autoComplete="off"/></Field>
          <Field label={editing ? 'Password baru (opsional)' : 'Password'}><input name="password" type="password" required={!editing} minLength={8} pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,}" autoComplete="new-password" disabled={busy}/></Field>
          <small>Minimal 8 karakter, mengandung huruf dan angka.</small>
          <Field label="Role"><select name="role" defaultValue={editing?.role || 'petugas'} disabled={busy || editing?.id === user.id}><option value="petugas">Petugas</option><option value="admin">Admin</option></select></Field>
          {editing?.id === user.id && <input type="hidden" name="role" value="admin"/>}
          <button className="primary-button" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan akun'}</button>
          {editing && <button className="secondary-button" type="button" disabled={busy} onClick={() => setEditing(null)}>Batal edit</button>}
        </form>
      </section>
    </div>
    {deleting && <section className="manage-card confirm-card"><h2>Hapus akun {deleting.username}?</h2><p>Akun ini akan dihapus dari database.</p><div className="form-actions"><button className="danger-button" disabled={busy} onClick={async () => {
      if (await perform(() => api(`/accounts/${deleting.id}`, { method: 'DELETE' }), 'Akun berhasil dihapus.')) { if (editing?.id === deleting.id) setEditing(null); if (resetting?.id === deleting.id) setResetting(null); setDeleting(null); }
    }}>Ya, hapus</button><button className="secondary-button" disabled={busy} onClick={() => setDeleting(null)}>Batal</button></div></section>}
    {resetting && <section className="manage-card password-card"><h2>Reset password: {resetting.username}</h2><form className="manage-form" onSubmit={reset}>
      <Field label="Password baru"><input name="newPassword" type="password" required minLength={8} pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,}" autoComplete="new-password" disabled={busy}/></Field>
      <small>Minimal 8 karakter, mengandung huruf dan angka.</small>
      <div className="form-actions"><button className="primary-button" disabled={busy}>Reset password</button><button className="secondary-button" type="button" disabled={busy} onClick={() => setResetting(null)}>Batal</button></div>
    </form></section>}
  </div>;
}

function Cameras({ api, user }) {
  const records = useRecords(api, '/cameras', 'cameras');
  const [staff, setStaff] = useState([]);
  const [staffError, setStaffError] = useState('');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(null);
  const [connections, setConnections] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  useEffect(() => {
    if (user.role === 'admin') api('/accounts').then(data => setStaff(data.accounts.filter(a => a.role === 'petugas'))).catch(err => setStaffError(err.message));
  }, [api, user.role]);
  async function save(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const body = { name: values.get('name').trim(), rtspUrl: values.get('rtspUrl').trim(), isActive: values.get('isActive') === 'on' };
    if (user.role === 'admin' && !staffError) body.assignedPetugas = values.get('assignedPetugas') || null;
    setBusy(true); setError(''); setSuccess('');
    try {
      await api(editing ? `/cameras/${editing.id}` : '/cameras', { method: editing ? 'PATCH' : 'POST', body });
      if (editing) setConnections(current => { const next = { ...current }; delete next[editing.id]; return next; });
      setSuccess('Kamera berhasil disimpan.'); setEditing(null); form.reset(); await records.reload();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function check(row) {
    setChecking(row.id); setError('');
    try { const result = await api(`/cameras/${row.id}/connection-status`); setConnections(current => ({ ...current, [row.id]: result })); }
    catch (err) { setError(err.message); }
    finally { setChecking(null); }
  }
  return <div className="management-page">
    <PageTitle icon={<Camera/>} title="Kelola Kamera" description="Atur kamera dan periksa koneksi ke alamat RTSP."/>
    <Feedback error={error} success={success}/>
    <div className="manage-grid">
      <RecordList title="Daftar kamera" records={records}><div className="record-list">{records.rows.map(row => {
        const connection = connections[row.id];
        return <div className="record-item camera-record" key={row.id}>
          <div><h3>{row.name}</h3><span className={`role-badge ${row.isActive ? 'petugas' : 'inactive'}`}>{row.isActive ? 'Aktif' : 'Nonaktif'}</span>
            <p>Petugas: {staff.find(a => a.id === row.assignedPetugas)?.username || row.assignedPetugas || 'Belum ditugaskan'}</p>
            {connection && <p className={connection.connected ? 'connection-ok' : 'connection-failed'}>{connection.connected ? 'Port kamera terhubung' : `Tidak terhubung: ${connection.reason || 'Tidak tersedia'}`}<br/><small>Diperiksa: {new Date(connection.checkedAt).toLocaleString('id-ID')}</small></p>}
          </div>
          <div className="record-actions"><button disabled={busy || checking !== null} onClick={() => check(row)}>{checking === row.id ? 'Memeriksa…' : 'Cek koneksi'}</button><button disabled={busy} onClick={() => { setEditing(row); setError(''); }}>Edit</button><button className="danger-text" disabled={busy} onClick={() => setDeleting(row)}>Hapus</button></div>
        </div>;
      })}</div></RecordList>
      <section className="manage-card"><h2>{editing ? 'Edit kamera' : 'Tambah kamera'}</h2><form className="manage-form" key={editing?.id || 'new'} onSubmit={save}>
        <Field label="Nama kamera"><input name="name" defaultValue={editing?.name || ''} required disabled={busy}/></Field>
        <Field label="Alamat RTSP"><input name="rtspUrl" type="url" defaultValue={editing?.rtspUrl || ''} placeholder="rtsp://192.168.1.100:554/stream" pattern="rtsps?://.+" required disabled={busy}/></Field>
        {user.role === 'admin' && <><Field label="Petugas"><select name="assignedPetugas" defaultValue={editing?.assignedPetugas || ''} disabled={busy || !!staffError}>
          <option value="">Belum ditugaskan</option>
          {editing?.assignedPetugas && !staff.some(a => a.id === editing.assignedPetugas) && <option value={editing.assignedPetugas}>{editing.assignedPetugas}</option>}
          {staff.map(a => <option value={a.id} key={a.id}>{a.username}</option>)}
        </select></Field>{staffError && <div className="form-error">Daftar petugas gagal dimuat: {staffError}</div>}</>}
        <label className="check-field"><input name="isActive" type="checkbox" defaultChecked={editing?.isActive ?? true} disabled={busy}/>Kamera aktif</label>
        <button className="primary-button" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan kamera'}</button>
        {editing && <button className="secondary-button" type="button" disabled={busy} onClick={() => setEditing(null)}>Batal edit</button>}
      </form></section>
    </div>
    <p className="manage-note">Cek koneksi memeriksa port kamera. Dashboard menerima frame JPEG/PNG melalui MQTT. RTSP perlu dikonversi oleh worker kamera menjadi frame atau HTTP MJPEG.</p>
    {deleting && <section className="manage-card confirm-card"><h2>Hapus kamera {deleting.name}?</h2><p>Data kamera ini akan dihapus dari database.</p><div className="form-actions"><button className="danger-button" disabled={busy} onClick={async () => {
      setBusy(true); setError(''); setSuccess('');
      try { await api(`/cameras/${deleting.id}`, { method: 'DELETE' }); if (editing?.id === deleting.id) setEditing(null); setDeleting(null); setSuccess('Kamera berhasil dihapus.'); await records.reload(); }
      catch (err) { setError(err.message); }
      finally { setBusy(false); }
    }}>Ya, hapus</button><button className="secondary-button" disabled={busy} onClick={() => setDeleting(null)}>Batal</button></div></section>}
  </div>;
}

function Password({ api, required = false, onUpdated = () => {} }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError(''); setSuccess('');
    if (data.get('newPassword') !== data.get('confirmation')) { setError('Konfirmasi password belum sama.'); return; }
    setBusy(true);
    try { await api('/auth/password', { method: 'PUT', body: { currentPassword: data.get('currentPassword'), newPassword: data.get('newPassword') } }); setSuccess('Password berhasil diganti.'); form.reset(); if (required) onUpdated(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <div className="management-page"><PageTitle icon={<LockKeyhole/>} title="Ganti Password" description={required ? 'Ganti password awal sebelum mengakses dashboard.' : 'Perbarui password akun yang sedang kamu gunakan.'}/>
    <section className="manage-card password-card"><form className="manage-form" onSubmit={submit}>
      <Field label="Password saat ini"><input name="currentPassword" type="password" autoComplete="current-password" required disabled={busy}/></Field>
      <Field label="Password baru"><input name="newPassword" type="password" autoComplete="new-password" required minLength={8} pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,}" disabled={busy}/></Field>
      <Field label="Konfirmasi password baru"><input name="confirmation" type="password" autoComplete="new-password" required disabled={busy}/></Field>
      <small>Minimal 8 karakter, mengandung huruf dan angka.</small>
      <Feedback error={error} success={success}/><button className="primary-button" disabled={busy}>{busy ? 'Menyimpan…' : 'Ganti password'}</button>
    </form></section></div>;
}
